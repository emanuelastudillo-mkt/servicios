#!/usr/bin/env python3
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def load(name):
    return json.loads((ROOT/'data'/name).read_text(encoding='utf-8'))

market=load('vehicle_market.json'); dnrpa=load('dnrpa.json'); rates=load('rates.json'); config=load('config.json')
assert len(market.get('rows',[])) > 5000, 'Base de mercado demasiado pequeña'
assert len(dnrpa.get('rows',[])) > 15000, 'Base DNRPA demasiado pequeña'
assert len(rates.get('products',[])) >= 5, 'Base de tasas demasiado pequeña'
assert market.get('currency') == 'USD'
assert dnrpa.get('currency') == 'ARS'
assert 0 < config['market']['purchase_factor'] < config['market']['sale_factor']
assert any(r.get('brand')=='CHEVROLET' and r.get('model')=='ONIX' for r in market['rows'])
assert any(r.get('brand')=='FORD' and 'ECOSPORT' in r.get('model','') for r in market['rows'])
assert any(r.get('brand')=='CHEVROLET' and 'ONIX' in r.get('model','') for r in dnrpa['rows'])
assert not any(r.get('brand','').startswith('4P ') or r.get('brand','').startswith('5P ') for r in market['rows']), 'Se detectaron variantes mal clasificadas como marcas'
print('OK')
print('mercado:',len(market['rows']),'variantes')
print('dnrpa:',len(dnrpa['rows']),'registros')
print('tasas:',len(rates['products']),'productos')
