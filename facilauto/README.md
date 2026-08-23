# AutoCierre v0.02

Calculadora web estática para estimar una operación automotor en Argentina.

## Qué cambia en v0.02

- Rediseño completo con una estética editorial/automotor más sobria: menos tarjetas redondeadas, sin ilustraciones decorativas y mayor foco en datos.
- Valuación de mercado basada en el PDF mensual **Autos AGOSTO 2026**.
- Corrección de unidades del PDF:
  - por defecto, los importes están expresados en **miles de pesos** y se multiplican por 1.000;
  - cuando la publicación aclara **0KM EN US$**, el 0 km se conserva en dólares;
  - cuando una marca está indicada **EN US$**, los usados se interpretan en miles de dólares y el 0 km como importe nominal en dólares;
  - se contemplan notas especiales visibles en la fuente, como excepciones por modelo.
- Nueva lectura de **oportunidad**: compara el precio publicado/pactado contra la valuación estimada ajustada por kilometraje y muestra el porcentaje por arriba o debajo del mercado.
- La valuación literal del PDF siempre queda visible por separado del ajuste interno.

## Estructura

- `index.html`: calculadora pública.
- `admin.html`: estado e instrucciones de mantenimiento.
- `data/vehicle_market.json`: 6.004 versiones extraídas de la guía mensual.
- `data/dnrpa.json`: valuaciones DNRPA.
- `data/rates.json`: productos/tasas bancarias.
- `data/config.json`: supuestos configurables.
- `tools/import_market_pdf.py`: importa un nuevo PDF mensual.
- `tools/parse_market_pdf.py`: parser de la guía de mercado y reglas de moneda.
- `tools/update_dnrpa.py`: actualiza DNRPA.
- `tools/update_rates.py`: actualiza ComparaTasas.

## Ejecutar localmente

Desde la carpeta del proyecto:

```bash
python -m http.server 8000
```

Abrir `http://localhost:8000/`.

No abrir `index.html` directamente con `file://`, porque el navegador bloqueará la carga de los JSON.

## Actualizar el PDF mensual

```bash
python tools/import_market_pdf.py "/ruta/Autos SEPTIEMBRE 2026.pdf"
```

El importador copia el PDF a `sources/` y regenera `data/vehicle_market.json`.

### Control recomendado tras cada importación

1. Revisar un usado normal expresado en miles de pesos.
2. Revisar un 0 km cuya marca/modelo tenga la nota `0KM EN US$`.
3. Revisar una marca con la nota completa `EN US$`.
4. Comparar tres precios finales con las páginas originales del PDF.

## Oportunidad de compra

El porcentaje se calcula así:

`(precio pactado - valor ajustado) / valor ajustado × 100`

Lectura incluida en el front-end:

- `≤ -15%`: Oportunidad fuerte.
- `-15% a -7%`: Buena oportunidad.
- `-7% a +7%`: En precio de mercado.
- `+7% a +15%`: Precio exigente.
- `≥ +15%`: Muy por encima del mercado.

Estas bandas son una clasificación orientativa. El porcentaje exacto siempre se muestra.

## Ajuste por kilometraje

La guía mensual se conserva como valor base. El sitio aplica un ajuste moderado según kilometraje esperado por antigüedad usando los parámetros de `data/config.json`. El usuario ve ambos valores: **valor literal de la fuente** y **valor ajustado**.

## Limitaciones

- No reemplaza una tasación física ni una revisión mecánica.
- El matching con DNRPA es aproximado por texto y debe verificarse antes de una operación real.
- La transferencia es una estimación: puede haber deudas, multas, verificaciones, gestoría u otros conceptos.
- El módulo de seguro todavía no está implementado.
