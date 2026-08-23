#!/usr/bin/env python3
"""Actualiza data/rates.json desde https://comparatasas.ar/prestamos-personales/.
Pensado para cron semanal. Si la estructura del sitio cambia, conserva el archivo previo y avisa.
"""
import argparse, json, re
from datetime import datetime, timezone
from pathlib import Path
import requests
from bs4 import BeautifulSoup

BANK_RE=re.compile(r'(Banco\s+(?:Macro|Nación|Ciudad|Galicia|Santander|Patagonia|Hipotecario)|Bancor|BBVA)',re.I)
RATE_RE=re.compile(r'([0-9]+(?:[.,][0-9]+)?)%\s*CFT\s*TEA\s*desde\s*TNA\s*desde\s*([0-9]+(?:[.,][0-9]+)?)%',re.I)
TERM_RE=re.compile(r'(\d+)\s*[–-]\s*(\d+)m')

def parse(url):
    r=requests.get(url,timeout=30,headers={'User-Agent':'Mozilla/5.0 FACIL AUTO/0.01'})
    r.raise_for_status()
    text=' '.join(BeautifulSoup(r.text,'html.parser').stripped_strings)
    products=[]
    for m in RATE_RE.finditer(text):
        before=text[max(0,m.start()-240):m.start()]
        banks=list(BANK_RE.finditer(before))
        if not banks: continue
        bm=banks[-1]; bank=bm.group(1).strip(); product=before[bm.end():].strip()
        product=re.sub(r'\s+',' ',product)[-150:].strip(' ·-|') or 'Préstamo personal'
        terms=TERM_RE.findall(before)
        minm,maxm=(1,72)
        if terms:
            minm,maxm=map(int,terms[-1])
        cft=float(m.group(1).replace(',','.'));tna=float(m.group(2).replace(',','.'))
        key=(bank.lower(),product.lower(),tna,cft)
        if any(x['_key']==key for x in products): continue
        products.append({'_key':key,'bank':bank,'product':product,'tna':tna,'cft_tea':cft,'min_months':minm,'max_months':maxm,'requires_client':'Requiere cliente' in before})
    for p in products:p.pop('_key',None)
    return products

def main():
    ap=argparse.ArgumentParser();ap.add_argument('-o','--output',default='data/rates.json');ap.add_argument('--url',default='https://comparatasas.ar/prestamos-personales/');args=ap.parse_args()
    out=Path(args.output)
    products=parse(args.url)
    if len(products)<5: raise RuntimeError(f'Parser devolvió solo {len(products)} productos; se evita sobrescribir el archivo vigente.')
    payload={'source':'ComparaTasas.ar - Préstamos Personales','source_url':args.url,'updated_at':datetime.now(timezone.utc).date().isoformat(),'calculation_note':'La cuota aproximada usa sistema francés sobre la TNA publicada. El CFT TEA se muestra como referencia del costo real. Las condiciones dependen del tramo, perfil y banco.','products':products}
    out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8');print(f'OK: {len(products)} productos')
if __name__=='__main__':main()
