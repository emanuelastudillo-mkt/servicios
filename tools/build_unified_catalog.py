#!/usr/bin/env python3
import json, re, unicodedata
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[1]
MARKET_PATH = ROOT / 'data' / 'vehicle_market.json'
DNRPA_PATH = ROOT / 'data' / 'dnrpa.json'
OUT_PATH = ROOT / 'data' / 'unified_catalog.json'

STOP = {'DE','DEL','LA','EL','CON','CV','AT','MT','AUT','AUTO','MANUAL','SEDAN','RURAL','PICK','UP','TODO','TERRENO'}
MODEL_NOISE = {'PICKUP','PICK-UP','PICK','UP'}
MODIFIER_FIRST = {'GRAND','NEW','SANTA','LAND','RANGE','ALFA','CITROEN','DS'}


def norm(value=''):
    text = unicodedata.normalize('NFD', str(value)).encode('ascii', 'ignore').decode('ascii').upper()
    return re.sub(r'[^A-Z0-9]+', ' ', text).strip()


def clean_model_key(value=''):
    parts = [p for p in norm(value).split() if p not in MODEL_NOISE]
    return ' '.join(parts)


def toks(value=''):
    return [t for t in norm(value).split() if len(t) > 1 and t not in STOP]


def jaccard(a, b):
    a, b = set(a), set(b)
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def trim_body(value=''):
    # El parser DNRPA puede arrastrar una valuación al texto de carrocería.
    return re.sub(r'\s+\d{6,}(?:\.\d+)?\s*$', '', str(value)).strip()


def fallback_base_model(value):
    raw = norm(value).split()
    if not raw:
        return 'OTROS'
    # Modelos numéricos (208, 308, 500, etc.) se conservan como un único token.
    if raw[0].isdigit():
        return raw[0]
    # Nombres compuestos frecuentes cuando no hay referencia en la guía mensual.
    if len(raw) > 1 and raw[0] in MODIFIER_FIRST:
        return f'{raw[0]} {raw[1]}'
    # Si el segundo token no parece especificación técnica, se conserva cuando el primero
    # es muy genérico o corto. En los demás casos, el primer token evita crear miles de modelos.
    if len(raw) > 1 and len(raw[0]) <= 2 and not re.search(r'\d', raw[1]):
        return f'{raw[0]} {raw[1]}'
    return raw[0]


def model_match(dnrpa_model, market_models):
    dm = clean_model_key(dnrpa_model)
    dt = toks(dnrpa_model)
    candidates = []
    for display_model in market_models:
        mm = clean_model_key(display_model)
        if not mm:
            continue
        score = 0.0
        if dm == mm:
            score = 1.0
        elif dm.startswith(mm + ' '):
            score = 0.94 + min(len(mm), 30) / 1000
        elif (' ' + dm + ' ').find(' ' + mm + ' ') >= 0:
            score = 0.82 + min(len(mm), 30) / 1000
        else:
            mt = toks(display_model)
            jac = jaccard(dt[:5], mt)
            if jac >= .5:
                score = 0.62 + jac * .18
        if score:
            candidates.append((score, len(mm), display_model))
    return max(candidates, default=(0, 0, None))[2]


def variant_score(drow, mrow):
    dt = toks(f"{drow.get('model','')} {trim_body(drow.get('body_type',''))}")
    mt = toks(f"{mrow.get('model','')} {mrow.get('variant','')}")
    if not dt or not mt:
        return 0.0
    ds, ms = set(dt), set(mt)
    overlap = len(ds & ms) / max(1, len(ms))
    jac = len(ds & ms) / max(1, len(ds | ms))
    score = overlap * .66 + jac * .34
    # Coincidencias de cilindrada / potencia pesan más para separar versiones.
    technical = [t for t in ms if re.fullmatch(r'\d{2,4}|\d{1,2}L|\d{2,3}CV', t)]
    if technical:
        hit = sum(t in ds for t in technical) / len(technical)
        score = score * .86 + hit * .14
    return score


def years_for(market_rows, dnrpa_rows):
    numeric = set()
    has_0km = False
    for r in market_rows:
        for y in (r.get('prices') or {}):
            if y == '0km':
                has_0km = True
            elif str(y).isdigit():
                numeric.add(int(y))
    for r in dnrpa_rows:
        for y in (r.get('values_ars') or {}):
            if str(y).isdigit():
                numeric.add(int(y))
    if numeric:
        # Completar huecos internos habilita interpolaciones cuando una fuente omite un año.
        lo, hi = min(numeric), max(numeric)
        numeric.update(range(lo, hi + 1))
    years = [str(y) for y in sorted(numeric, reverse=True)]
    if has_0km:
        years.insert(0, '0km')
    return years


def main():
    market = json.loads(MARKET_PATH.read_text(encoding='utf-8'))
    dnrpa = json.loads(DNRPA_PATH.read_text(encoding='utf-8'))
    mrows = market.get('rows', [])
    drows = dnrpa.get('rows', [])
    m_by_id = {r['id']: r for r in mrows}
    d_by_id = {r['id']: r for r in drows}

    market_models_by_brand = defaultdict(list)
    market_rows_by_brand_model = defaultdict(list)
    for r in mrows:
        if r.get('brand') and r.get('model'):
            market_models_by_brand[r['brand']].append(r['model'])
            market_rows_by_brand_model[(r['brand'], r['model'])].append(r)
    for brand in market_models_by_brand:
        market_models_by_brand[brand] = sorted(set(market_models_by_brand[brand]), key=lambda x: (-len(clean_model_key(x)), x))

    entries = []
    entry_by_market_id = {}
    entries_by_brand_model = defaultdict(list)

    # Cada fila de la guía mensual nace como una versión seleccionable.
    for mr in mrows:
        e = {
            'id': f"u-{len(entries)+1}",
            'brand': mr.get('brand',''),
            'model': mr.get('model',''),
            'variant': mr.get('variant','') or mr.get('model',''),
            'market_ids': [mr['id']],
            'dnrpa_ids': [],
            'source': 'market',
        }
        entries.append(e)
        entry_by_market_id[mr['id']] = e
        entries_by_brand_model[(e['brand'], e['model'])].append(e)

    unmatched_dnrpa = 0
    matched_to_market = 0

    # DNRPA amplía la lista. Si puede asociarse a una versión de mercado con confianza,
    # se fusiona; de lo contrario se agrega como variante propia bajo el mejor modelo.
    for dr in drows:
        brand = dr.get('brand','').strip()
        if not brand:
            continue
        base_model = model_match(dr.get('model',''), market_models_by_brand.get(brand, []))
        best_entry = None
        best_score = 0.0
        if base_model:
            for mr in market_rows_by_brand_model.get((brand, base_model), []):
                score = variant_score(dr, mr)
                if score > best_score:
                    best_score = score
                    best_entry = entry_by_market_id[mr['id']]
        if best_entry is not None and best_score >= .64:
            best_entry['dnrpa_ids'].append(dr['id'])
            best_entry['source'] = 'both'
            matched_to_market += 1
            continue

        if not base_model:
            base_model = fallback_base_model(dr.get('model',''))
        body = trim_body(dr.get('body_type',''))
        label = dr.get('model','').strip() or base_model
        if body and norm(body) not in norm(label):
            label = f"{label} · {body}"
        e = {
            'id': f"u-{len(entries)+1}",
            'brand': brand,
            'model': base_model,
            'variant': label,
            'market_ids': [],
            'dnrpa_ids': [dr['id']],
            'source': 'dnrpa',
        }
        entries.append(e)
        entries_by_brand_model[(brand, base_model)].append(e)
        unmatched_dnrpa += 1

    # IDs de mercado relacionados por mismo modelo para poder estimar una versión DNRPA-only.
    for e in entries:
        related = []
        for candidate in entries_by_brand_model.get((e['brand'], e['model']), []):
            related.extend(candidate.get('market_ids') or [])
        market_rows = [m_by_id[mid] for mid in e['market_ids'] if mid in m_by_id]
        dnrpa_rows = [d_by_id[did] for did in e['dnrpa_ids'] if did in d_by_id]
        e['years'] = years_for(market_rows, dnrpa_rows)
        if not e['years'] and related:
            rel_rows = [m_by_id[mid] for mid in sorted(set(related)) if mid in m_by_id]
            e['years'] = years_for(rel_rows, [])
        # Evitar variantes sin ningún año seleccionable.
        if not e['years']:
            e['years'] = [str(y) for y in range(2026, 1980, -1)]

    # Eliminar duplicados DNRPA exactos que quedaron como entradas separadas por parser/body.
    deduped = []
    seen = {}
    for e in entries:
        key = (e['brand'], norm(e['model']), norm(e['variant']), tuple(e['years']))
        if key not in seen:
            seen[key] = e
            deduped.append(e)
        else:
            tgt = seen[key]
            tgt['market_ids'] = sorted(set(tgt['market_ids'] + e['market_ids']))
            tgt['dnrpa_ids'] = sorted(set(tgt['dnrpa_ids'] + e['dnrpa_ids']))
            tgt['source'] = 'both' if tgt['market_ids'] and tgt['dnrpa_ids'] else ('market' if tgt['market_ids'] else 'dnrpa')

    brands = sorted(set(e['brand'] for e in deduped if e['brand']))
    out = {
        'generated_at': market.get('generated_at'),
        'market_report': f"{market.get('report_month','')} {market.get('report_year','')}".strip(),
        'dnrpa_valid_from': dnrpa.get('valid_from'),
        'stats': {
            'entries': len(deduped),
            'brands': len(brands),
            'market_rows': len(mrows),
            'dnrpa_rows': len(drows),
            'dnrpa_linked_to_market': matched_to_market,
            'dnrpa_added_as_catalog': unmatched_dnrpa,
        },
        'entries': deduped,
    }
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f"OK {OUT_PATH}: {len(deduped)} entradas, {len(brands)} marcas, {matched_to_market} DNRPA fusionadas, {unmatched_dnrpa} agregadas")


if __name__ == '__main__':
    main()
