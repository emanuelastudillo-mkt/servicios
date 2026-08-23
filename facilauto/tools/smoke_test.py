#!/usr/bin/env python3
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
market=json.load(open(ROOT/'data/vehicle_market.json',encoding='utf-8'))
dnrpa=json.load(open(ROOT/'data/dnrpa.json',encoding='utf-8'))
rates=json.load(open(ROOT/'data/rates.json',encoding='utf-8'))
catalog=json.load(open(ROOT/'data/unified_catalog.json',encoding='utf-8'))
config=json.load(open(ROOT/'data/config.json',encoding='utf-8'))
assert len(market['rows'])>5000
assert len(dnrpa['rows'])>10000
assert len(rates['products'])>=10
assert len(catalog['entries'])>len(market['rows'])
assert config['version']=='0.06'
assert config['opportunity']['market_offset_percent']==10
# Toda fila de ambas fuentes debe quedar seleccionable en el catálogo, fusionada o individual.
market_ids={x for e in catalog['entries'] for x in e.get('market_ids',[])}
dnrpa_ids={x for e in catalog['entries'] for x in e.get('dnrpa_ids',[])}
assert {r['id'] for r in market['rows']} <= market_ids
assert {r['id'] for r in dnrpa['rows']} <= dnrpa_ids
# Un modelo ausente en la guía mensual pero presente en DNRPA debe aparecer.
assert any(e['brand']=='CHEVROLET' and e['model']=='ASTRA' and e['source']=='dnrpa' for e in catalog['entries'])
# Un modelo presente en ambas fuentes debe mantener las versiones de mercado y sumar DNRPA.
assert any(e['brand']=='CHEVROLET' and e['model']=='ONIX' and e.get('market_ids') for e in catalog['entries'])
assert any(e['brand']=='CHEVROLET' and e['model']=='ONIX' and e.get('dnrpa_ids') for e in catalog['entries'])
# Los huecos internos de año se completan para permitir interpolación.
assert any('2018' in e['years'] and '2019' in e['years'] and e['brand']=='AGRALE' and e['model']=='MARRUA' and 'AM 200' in e['variant'] for e in catalog['entries'])
print('OK smoke test',len(catalog['entries']),'catalog entries',len(market['rows']),'market',len(dnrpa['rows']),'dnrpa')
