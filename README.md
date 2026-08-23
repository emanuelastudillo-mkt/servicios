# AutoCierre v0.03

Actualización incremental sobre v0.02.

## Cambios

- Catálogo unificado entre guía mensual y DNRPA.
- Toda fila de mercado y toda fila DNRPA queda representada en `data/unified_catalog.json`.
- Los selectores Marca → Modelo → Versión → Año se alimentan del catálogo combinado.
- Las versiones que solo existen en DNRPA aparecen como alternativas adicionales dentro del mismo modelo cuando puede determinarse.
- Si no existe un precio exacto para año/versión, la valuación sigue esta jerarquía:
  1. misma versión, interpolando entre años;
  2. misma versión, proyectando desde años cercanos;
  3. promedio ponderado de versiones similares del mismo modelo;
  4. relación observada entre precios de mercado y valuaciones DNRPA de comparables.
- Cada estimación informa método y nivel de confianza.
- DNRPA también puede interpolar/proyectar una valuación faltante, siempre marcada como estimada.
- `import_market_pdf.py` y `update_dnrpa.py` regeneran el catálogo unificado automáticamente.

## Regenerar catálogo manualmente

```bash
python tools/build_unified_catalog.py
```

## Verificación

```bash
python tools/smoke_test.py
```
