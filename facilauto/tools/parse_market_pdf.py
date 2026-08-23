#!/usr/bin/env python3
import argparse, json, re, unicodedata
from pathlib import Path
from datetime import datetime, timezone
import pdfplumber

YEARS = ['0km'] + [str(y) for y in range(2025, 2011, -1)]
MONTHS = r'Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre'

# Source labels occasionally abbreviate the brand in the currency note.
BRAND_ALIASES = {
    'ALFA': 'ALFA ROMEO',
    'G W': 'GREAT WALL',
    'M BENZ': 'MERCEDES BENZ',
    'DFSK SERIE': 'DFSK',
}


def norm(s):
    s=unicodedata.normalize('NFD',str(s).upper())
    s=''.join(c for c in s if unicodedata.category(c)!='Mn')
    s=s.replace('&',' Y ')
    s=re.sub(r'[^A-Z0-9]+',' ',s)
    return re.sub(r'\s+',' ',s).strip()


def parse_number(s):
    s=s.strip().replace('$','').replace(' ','')
    if not re.fullmatch(r'[0-9][0-9.,]*', s):
        return None
    if ',' in s and '.' in s:
        s=s.replace('.', '').replace(',', '.')
    elif ',' in s:
        tail=s.rsplit(',',1)[1]
        # The report uses comma both as thousands separator in US$ (41,300)
        # and as decimal separator for some peso 0km values (53532,9).
        if len(tail)==3:
            s=s.replace(',', '')
        else:
            s=s.replace(',', '.')
    try: return float(s)
    except ValueError: return None


def group_lines(words,tol=1.2):
    lines=[]
    for w in sorted(words,key=lambda x:(x['top'],x['x0'])):
        placed=False
        for line in lines[-3:]:
            if abs(line['top']-w['top'])<=tol:
                line['words'].append(w);placed=True;break
        if not placed: lines.append({'top':w['top'],'words':[w]})
    for line in lines: line['words'].sort(key=lambda x:x['x0'])
    return lines


def detect_columns(page):
    ws=page.extract_words(x_tolerance=1,y_tolerance=2)
    hdr=[w for w in ws if 130<w['top']<148]
    cols={}
    for w in hdr:
        txt=w['text'].strip()
        if txt in [str(y) for y in range(2025,2011,-1)]: cols[txt]=(w['x0']+w['x1'])/2
    z=[w for w in hdr if w['text']=='0']; km=[w for w in hdr if w['text'].lower()=='km']
    if z and km: cols['0km']=(z[0]['x0']+km[0]['x1'])/2
    if len(cols)<10:
        fixed=[348,396.5,433.7,469.2,506.2,544.6,581.6,618.3,655.7,694.8,733.5,769.7,806.0,843.0,881.1]
        cols=dict(zip(YEARS,fixed))
    return cols


def line_values(ws,cols):
    vals={}
    for w in ws:
        c=(w['x0']+w['x1'])/2
        nearest=min(cols,key=lambda k:abs(cols[k]-c))
        if abs(cols[nearest]-c)<=25:
            n=parse_number(w['text'])
            if n is not None: vals[nearest]=n
    return vals


def note_texts(pdf):
    # Use page text because some notes wrap (JEEP/RAM) and line-only parsing truncates the exception.
    notes=[]
    for page_no,page in enumerate(pdf.pages,start=1):
        txt=page.extract_text(x_tolerance=1,y_tolerance=2) or ''
        compact=' '.join(txt.split())
        for m in re.finditer(r'([A-Z0-9&.\- ]{2,45}?)(?:\s+0KM)?\s+EN\s+US\$(?:\s+MENOS\s+([A-Z0-9&.\- ]{2,60}?))?(?=\s+Autos\s+-|\s+Visite\s+Nuestro|$)',compact,re.I):
            full=m.group(0).strip();notes.append({'page':page_no,'text':full})
        # Broad fallback catches standalone visual footer notes that are not followed by the header string.
        for raw in (page.extract_text(x_tolerance=1,y_tolerance=2) or '').splitlines():
            if 'US$' in raw.upper() and not any(n['page']==page_no and raw.strip() in n['text'] for n in notes):
                notes.append({'page':page_no,'text':raw.strip()})
    # de-duplicate
    out=[];seen=set()
    for n in notes:
        k=(n['page'],norm(n['text']))
        if k not in seen: seen.add(k);out.append(n)
    return out


def resolve_currency_rules(rows,notes):
    brands=sorted({r['brand'] for r in rows if r['brand']})
    models_by_brand={}
    for r in rows:
        models_by_brand.setdefault(r['brand'],set()).add(r['model'])
    nb={norm(b):b for b in brands}
    for a,b in BRAND_ALIASES.items():
        if b in brands: nb[norm(a)]=b

    all_usd_brands=set(); zero_usd_brands=set(); zero_usd_models={}; zero_usd_variant_contains={}; exceptions={}

    def add_model_rule(target):
        nt=norm(target)
        # Direct/partial model matching across all brands. Prefer longest model matches.
        hits=[]
        for b,models in models_by_brand.items():
            for m in models:
                nm=norm(m)
                if nm and (nm==nt or nt.startswith(nm+' ') or nm.startswith(nt+' ')):
                    hits.append((len(nm),b,m))
        if hits:
            _,b,m=max(hits)
            zero_usd_models.setdefault(b,set()).add(m)
            return True
        return False

    for note in notes:
        up=note['text'].upper()
        is_zero='0KM' in up
        # Strip known suffixes/continuations before target matching.
        before=re.split(r'\s+0KM\s+EN\s+US\$|\s+EN\s+US\$',up,1)[0].strip()
        target=before
        nt=norm(target)
        brand=nb.get(nt)
        if brand:
            (zero_usd_brands if is_zero else all_usd_brands).add(brand)
        elif is_zero:
            # Multi-model notes such as "86 Y bZ4X".
            pieces=[p.strip() for p in re.split(r'\s+Y\s+|\s*,\s*',target,flags=re.I) if p.strip()]
            matched=False
            for p in pieces: matched=add_model_rule(p) or matched
            if not matched: add_model_rule(target)

        # Explicit exceptions visible in the source.
        if 'JEEP' in up and 'MENOS' in up:
            zero_usd_brands.add('JEEP')
            exceptions.setdefault('JEEP',set()).update({'COMMANDER','COMPASS','RENEGADE','RENAGADE'})
        if 'RAM' in up and ('DAKOTA' in up or 'RAMPAGE' in up):
            zero_usd_brands.add('RAM')
            exceptions.setdefault('RAM',set()).update({'DAKOTA PICK - UP','RAMPAGE PICK -UP','RAMPAGE PICK - UP'})

        # Toyota source notes are model/subvariant-specific.
        if 'HIACE 2 PRIMEROS' in up:
            zero_usd_models.setdefault('TOYOTA',set()).add('HIACE')
        if 'YARIS 3P' in up:
            zero_usd_variant_contains.setdefault('TOYOTA',[]).append(('YARIS','3P'))
        if re.search(r'\bL\s+CRUISER\b',up): zero_usd_models.setdefault('TOYOTA',set()).add('LAND CRUISER')
        if re.search(r'\bRAV\b',up): zero_usd_models.setdefault('TOYOTA',set()).add('RAV - 4')

    # High-confidence source-derived all-dollar brands.
    # Kept as a fallback if text extraction misses a footer on a future import.
    for b in ['FERRARI','JAGUAR','LOTUS','MASERATI','McLAREN','PORSCHE']:
        if b in brands: all_usd_brands.add(b)

    return {
        'all_usd_brands':sorted(all_usd_brands),
        'zero_km_usd_brands':sorted(zero_usd_brands),
        'zero_km_usd_models':{b:sorted(v) for b,v in zero_usd_models.items()},
        'zero_km_usd_variant_contains':{b:v for b,v in zero_usd_variant_contains.items()},
        'zero_km_usd_exceptions':{b:sorted(v) for b,v in exceptions.items()},
        'notes':notes,
    }


def is_zero_km_usd(row,rules):
    b=row['brand'];m=row['model'];v=row['variant']
    if b in rules['zero_km_usd_brands']:
        ex={norm(x) for x in rules['zero_km_usd_exceptions'].get(b,[])}
        if norm(m) not in ex: return True
    if m in rules['zero_km_usd_models'].get(b,[]): return True
    for rm,needle in rules['zero_km_usd_variant_contains'].get(b,[]):
        if m==rm and norm(needle) in norm(v): return True
    return False


def build_price(raw,year,row,rules):
    b=row['brand']
    if b in rules['all_usd_brands']:
        if year=='0km':
            return {'raw':raw,'currency':'USD','unit':'actual','amount':round(raw,2),'source_note':'Valores en US$'}
        return {'raw':raw,'currency':'USD','unit':'thousands','amount':round(raw*1000,2),'source_note':'Valores usados en miles de US$'}
    if year=='0km' and is_zero_km_usd(row,rules):
        return {'raw':raw,'currency':'USD','unit':'actual','amount':round(raw,2),'source_note':'0 km en US$'}
    return {'raw':raw,'currency':'ARS','unit':'thousands','amount':round(raw*1000,2),'source_note':'Valor expresado en miles de pesos'}


def parse_pdf(pdf_path):
    rows=[];brand='';model='';report_month='';report_year=''
    with pdfplumber.open(pdf_path) as pdf:
        cols=detect_columns(pdf.pages[0])
        for page_no,page in enumerate(pdf.pages,start=1):
            words=page.extract_words(x_tolerance=1,y_tolerance=2,extra_attrs=['fontname','size'])
            if page_no==1:
                alltxt=' '.join(w['text'] for w in words if 90<w['top']<120)
                m=re.search(rf'({MONTHS})\s+(20\d{{2}})',alltxt,re.I)
                if m: report_month,report_year=m.group(1).title(),m.group(2)
            lines=group_lines([w for w in words if w['top']>146])
            prepared=[]
            for line in lines:
                ws=line['words'];left=[w for w in ws if w['x0']<300]
                if not left: continue
                label=' '.join(w['text'] for w in left).strip()
                vals=line_values(ws,cols)
                fonts=' '.join(w.get('fontname','') for w in left)
                prepared.append({'top':line['top'],'ws':ws,'left':left,'label':label,'vals':vals,'italic':'Italic' in fonts})
            for i,item in enumerate(prepared):
                label=item['label']; vals=item['vals']; left=item['left']; italic=item['italic']
                if not label: continue
                up=label.upper()
                if 'US$' in up or up.startswith('AUTOS - PICK UPS') or up.startswith('VISITE NUESTRO'):
                    continue
                if not vals:
                    if italic and left[0]['x0']<60:
                        model=label
                        continue
                    # A brand line is bold/non-italic and is normally followed by an italic model line.
                    nxt=prepared[i+1] if i+1<len(prepared) else None
                    next_is_model=bool(nxt and not nxt['vals'] and nxt['italic'] and nxt['left'][0]['x0']<60)
                    if next_is_model and left[0]['x0']<60 and len(label)<=45:
                        brand=label;model=''
                    continue
                rows.append({'id':f'mkt-{page_no}-{len(rows)+1}','brand':brand,'model':model,'variant':label,'raw_values':vals,'page':page_no})

        notes=note_texts(pdf)

    # Remove malformed rows that were parsed before a brand/model could be established.
    rows=[r for r in rows if r['brand'] and r['model']]
    rules=resolve_currency_rules(rows,notes)
    for r in rows:
        r['prices']={y:build_price(raw,y,r,rules) for y,raw in r.pop('raw_values').items()}

    return {
        'source':'NuestrosAutos / Autos - Pick Ups - Todo Terreno - Utilitarios',
        'source_file':Path(pdf_path).name,
        'report_month':report_month,'report_year':report_year,
        'generated_at':datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'default_currency_rule':'ARS values are expressed in thousands; US$ exceptions follow the notes printed in the PDF.',
        'currency_rules':rules,
        'rows':rows,
    }

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('pdf');ap.add_argument('-o','--output',default='data/vehicle_market.json');args=ap.parse_args()
    data=parse_pdf(args.pdf);out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f"OK: {len(data['rows'])} variantes -> {out}")
    print(f"Marcas completas en US$: {len(data['currency_rules']['all_usd_brands'])}; 0km US$: {len(data['currency_rules']['zero_km_usd_brands'])}")
