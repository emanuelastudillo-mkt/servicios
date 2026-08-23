#!/usr/bin/env python3
import argparse, subprocess, sys
from datetime import date
from pathlib import Path
import requests

ROOT=Path(__file__).resolve().parents[1]

def main():
    today=date.today()
    ap=argparse.ArgumentParser(description='Descarga y procesa la tabla mensual DNRPA.')
    ap.add_argument('--year',type=int,default=today.year)
    ap.add_argument('--month',type=int,default=today.month)
    args=ap.parse_args()
    url=f'https://www.dnrpa.gov.ar/valuacion/informacion/01-{args.month:02d}-{args.year}.pdf'
    sources=ROOT/'sources';sources.mkdir(exist_ok=True)
    pdf=sources/f'dnrpa-{args.year}-{args.month:02d}.pdf'
    r=requests.get(url,timeout=60,headers={'User-Agent':'Mozilla/5.0 FACIL AUTO/0.03'})
    r.raise_for_status();pdf.write_bytes(r.content)
    subprocess.run([sys.executable,str(ROOT/'tools/parse_dnrpa_pdf.py'),str(pdf),'-o',str(ROOT/'data/dnrpa.json')],check=True)
    subprocess.run([sys.executable,str(ROOT/'tools/build_unified_catalog.py')],check=True)
    print('DNRPA actualizado y catálogo unificado regenerado:',url)
if __name__=='__main__':main()
