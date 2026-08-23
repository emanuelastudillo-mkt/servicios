#!/usr/bin/env python3
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
market=json.load(open(ROOT/'data/vehicle_market.json',encoding='utf-8'))
dnrpa=json.load(open(ROOT/'data/dnrpa.json',encoding='utf-8'))
rates=json.load(open(ROOT/'data/rates.json',encoding='utf-8'))
assert len(market['rows'])>5000
assert len(dnrpa['rows'])>10000
assert len(rates['products'])>=10
assert all('prices' in r for r in market['rows'][:200])
# Common used values should be normalized from thousands of ARS.
onix=[r for r in market['rows'] if r['brand']=='CHEVROLET' and r['model']=='ONIX' and '2017' in r.get('prices',{})]
assert onix and onix[0]['prices']['2017']['currency']=='ARS' and onix[0]['prices']['2017']['amount']>5_000_000
# Explicit 0km US$ note should remain in dollars.
audi=[r for r in market['rows'] if r['brand']=='AUDI' and '0km' in r.get('prices',{})]
assert audi and audi[0]['prices']['0km']['currency']=='USD'
# Ferrari source is fully US$ and used values are expressed in thousands.
ferrari=[r for r in market['rows'] if r['brand']=='FERRARI']
assert ferrari and next(iter(ferrari[0]['prices'].values()))['currency']=='USD'
print('OK smoke test',len(market['rows']),len(dnrpa['rows']),len(rates['products']))
