#!/usr/bin/env python3
import argparse, shutil, subprocess, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def main():
    ap=argparse.ArgumentParser(description='Importa el PDF mensual de valores de mercado.')
    ap.add_argument('pdf')
    args=ap.parse_args()
    src=Path(args.pdf)
    if not src.exists(): raise SystemExit(f'No existe: {src}')
    sources=ROOT/'sources';sources.mkdir(exist_ok=True)
    copy=sources/src.name
    if src.resolve()!=copy.resolve(): shutil.copy2(src,copy)
    cmd=[sys.executable,str(ROOT/'tools/parse_market_pdf.py'),str(copy),'-o',str(ROOT/'data/vehicle_market.json')]
    subprocess.run(cmd,check=True)
    subprocess.run([sys.executable,str(ROOT/'tools/build_unified_catalog.py')],check=True)
    print('Importación lista. Catálogo unificado regenerado. Recargá la web.')
if __name__=='__main__':main()
