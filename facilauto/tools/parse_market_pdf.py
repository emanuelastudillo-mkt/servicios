#!/usr/bin/env python3
import argparse, json, re
from pathlib import Path
from datetime import datetime, timezone
import pdfplumber

YEARS = ['0km'] + [str(y) for y in range(2025, 2011, -1)]


def parse_number(s):
    s = s.strip().replace('$','').replace(' ','')
    if not re.fullmatch(r'[0-9][0-9.,]*', s):
        return None
    if ',' in s and '.' in s:
        s = s.replace('.', '').replace(',', '.')
    elif ',' in s:
        tail = s.rsplit(',',1)[1]
        if len(tail) == 3:
            s = s.replace(',', '')
        else:
            s = s.replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return None


def group_lines(words, tol=1.2):
    lines=[]
    for w in sorted(words, key=lambda x:(x['top'],x['x0'])):
        placed=False
        for line in lines[-3:]:
            if abs(line['top']-w['top']) <= tol:
                line['words'].append(w); placed=True; break
        if not placed:
            lines.append({'top':w['top'],'words':[w]})
    for line in lines:
        line['words'].sort(key=lambda x:x['x0'])
    return lines


def detect_columns(page):
    ws=page.extract_words(x_tolerance=1,y_tolerance=2)
    hdr=[w for w in ws if 130 < w['top'] < 148]
    cols={}
    for w in hdr:
        txt=w['text'].strip()
        if txt in [str(y) for y in range(2025,2011,-1)]:
            cols[txt]=(w['x0']+w['x1'])/2
    z=[w for w in hdr if w['text']=='0']
    km=[w for w in hdr if w['text'].lower()=='km']
    if z and km:
        cols['0km']=(z[0]['x0']+km[0]['x1'])/2
    if len(cols) < 10:
        # Known stable coordinates in this report format
        fixed=[348,396.5,433.7,469.2,506.2,544.6,581.6,618.3,655.7,694.8,733.5,769.7,806.0,843.0,881.1]
        cols=dict(zip(YEARS,fixed))
    return cols


def parse_pdf(pdf_path):
    rows=[]; brand=''; model=''
    report_month=''; report_year=''
    with pdfplumber.open(pdf_path) as pdf:
        cols=detect_columns(pdf.pages[0])
        for page_no,page in enumerate(pdf.pages, start=1):
            words=page.extract_words(x_tolerance=1,y_tolerance=2, extra_attrs=['fontname','size'])
            if page_no==1:
                alltxt=' '.join(w['text'] for w in words if 95 < w['top'] < 115)
                m=re.search(r'(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+(20\d{2})', alltxt, re.I)
                if m: report_month,report_year=m.group(1).title(),m.group(2)
            # The report uses a full-width gray band for brand rows and a pink band for model rows.
            # Using the band is safer than guessing from text: some valid vehicle variants have no value
            # in a given month and otherwise look like brand rows.
            gray_bands=[r for r in page.rects if r.get('fill') and r.get('x0',999)<35 and r.get('x1',0)>300 and tuple(r.get('non_stroking_color') or ())==(0.75,0.75,0.75)]
            for line in group_lines([w for w in words if w['top'] > 146]):
                ws=line['words']
                left=[w for w in ws if w['x0'] < 300]
                if not left: continue
                # Values are words whose centers are close to one of the year columns.
                vals={}
                for w in ws:
                    c=(w['x0']+w['x1'])/2
                    nearest=min(cols, key=lambda k:abs(cols[k]-c))
                    if abs(cols[nearest]-c) <= 25:
                        n=parse_number(w['text'])
                        if n is not None:
                            vals[nearest]=n
                label=' '.join(w['text'] for w in left).strip()
                if not label: continue
                fonts=' '.join(w.get('fontname','') for w in left)
                italic='Italic' in fonts
                if not vals:
                    if italic and left[0]['x0'] < 55:
                        model=label
                    else:
                        y=line['top']+3
                        is_brand_band=any(r['top']-1 <= y <= r['bottom']+1 for r in gray_bands)
                        if is_brand_band and left[0]['x0'] < 55 and len(label) <= 40:
                            if label.upper() not in {'AUTOS - PICK UPS - TODO TERRENO - UTILITARIOS'} and '0KM EN US$' not in label.upper():
                                brand=label; model=''
                    continue
                if not brand or not model:
                    # Some pages continue a model from the prior page; brand/model state persists.
                    pass
                rows.append({
                    'id': f'mkt-{page_no}-{len(rows)+1}',
                    'brand': brand,
                    'model': model,
                    'variant': label,
                    'values_usd': vals,
                    'page': page_no,
                })
    return {
        'source':'NuestrosAutos / Autos - Pick Ups - Todo Terreno - Utilitarios',
        'source_file':Path(pdf_path).name,
        'report_month':report_month,
        'report_year':report_year,
        'generated_at':datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'currency':'USD',
        'rows':rows,
    }

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('pdf')
    ap.add_argument('-o','--output',default='data/vehicle_market.json')
    args=ap.parse_args()
    data=parse_pdf(args.pdf)
    out=Path(args.output); out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f"OK: {len(data['rows'])} variantes -> {out}")
