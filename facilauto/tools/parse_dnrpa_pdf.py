#!/usr/bin/env python3
import argparse, json, re, subprocess, tempfile
from pathlib import Path
from datetime import datetime, timezone
from lxml import etree

YEARS=['0km']+[str(y) for y in range(2025,2001,-1)]
NS='{http://www.w3.org/1999/xhtml}'

def group_rows(words,tol=.7):
    words=sorted(words,key=lambda w:(w[2],w[0]))
    rows=[]
    for w in words:
        if rows and abs(rows[-1][0]-w[2])<=tol:
            rows[-1][1].append(w)
        else:
            rows.append([w[2],[w]])
    for r in rows:r[1].sort(key=lambda w:w[0])
    return rows

def parse_pdf(pdf_path):
    with tempfile.NamedTemporaryFile(suffix='.html', delete=False) as tmp:bbox=tmp.name
    subprocess.run(['pdftotext','-bbox-layout',str(pdf_path),bbox],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    cols={}; out=[]; vigencia=''; page_no=0
    for event,page in etree.iterparse(bbox,events=('end',),tag=NS+'page'):
        page_no+=1
        words=[]
        for w in page.iter(NS+'word'):
            t=''.join(w.itertext()).strip()
            if t:
                words.append((float(w.get('xMin')),float(w.get('xMax')),float(w.get('yMin')),t))
        for y,row in group_rows(words):
            line=' '.join(w[3] for w in row)
            if not vigencia and 'Vigencia' in line:
                m=re.search(r'(\d{2}/\d{2}/\d{4})',line)
                if m:vigencia=m.group(1)
            if not cols and '0Km' in line and '2025' in line and 'Desc.' in line:
                for x0,x1,_,t in row:
                    key='0km' if t=='0Km' else (t if t in YEARS else None)
                    if key:cols[key]=(x0+x1)/2
                continue
            if not row or row[0][3] not in {'I','N'} or row[0][0]>23 or not cols:
                continue
            def tr(a,b):return ' '.join(t for x0,x1,_,t in row if a<=x0<b).strip()
            code=tr(25,55);brand=tr(95,130);model=tr(130,180);body=tr(180,231)
            if not brand or not model:continue
            vals={}
            for x0,x1,_,t in row:
                if x0<228 or not re.fullmatch(r'\d+',t):continue
                c=(x0+x1)/2;k=min(cols,key=lambda z:abs(cols[z]-c))
                if abs(cols[k]-c)<=12:vals[k]=int(t)
            out.append({'id':f'dnrpa-{len(out)+1}','code':code,'brand':brand,'model':model,'body_type':body,'values_ars':vals,'page':page_no})
        page.clear()
        while page.getprevious() is not None: del page.getparent()[0]
    Path(bbox).unlink(missing_ok=True)
    return {'source':'DNRPA - Tabla de valuación de automotores','source_url':'https://www.dnrpa.gov.ar/valuacion/valuaciones.php','source_file':Path(pdf_path).name,'valid_from':vigencia,'generated_at':datetime.now(timezone.utc).isoformat(timespec='seconds'),'currency':'ARS','rows':out}

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('pdf');ap.add_argument('-o','--output',default='data/dnrpa.json');args=ap.parse_args()
    d=parse_pdf(args.pdf);out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')),encoding='utf-8');print(f"OK: {len(d['rows'])} registros -> {out}")
