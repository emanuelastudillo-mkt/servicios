# AutoCierre v0.01

Prototipo funcional de una calculadora integral para operaciones de vehículos usados en Argentina.

## Qué resuelve esta versión

El usuario elige **marca, modelo, versión, año y kilometraje**. A partir de eso, la web reúne cuatro capas:

1. **Valor orientativo de mercado** desde el PDF mensual cargado.
2. **Rango operativo** de toma/compra y publicación/venta, con márgenes configurables.
3. **Financiación bancaria** usando tasas publicadas por ComparaTasas y sistema francés.
4. **Transferencia aproximada** usando la valuación oficial de DNRPA y parámetros impositivos configurados.

El bloque de **seguro automotor** ya aparece en la interfaz, pero queda desactivado para la siguiente etapa.

## Estructura

```text
index.html                   Calculadora pública
admin.html                   Estado y guía de actualización
assets/css/styles.css        Estilos
assets/js/app.js             Motor de cálculo y matching
data/vehicle_market.json     Valores del PDF mensual
data/dnrpa.json              Valuaciones oficiales DNRPA
data/rates.json              Tasas bancarias
data/config.json             Reglas editables
tools/parse_market_pdf.py    Parser del PDF mensual
tools/import_market_pdf.py   Importación mensual simplificada
tools/parse_dnrpa_pdf.py     Parser de DNRPA
tools/update_dnrpa.py        Descarga + actualización DNRPA
tools/update_rates.py        Scraper de ComparaTasas
tools/update_all.py          Actualiza tasas + DNRPA
```

## Fuentes precargadas en v0.01

- Mercado: `Autos AGOSTO 2026.pdf`, procesado en una base de aproximadamente 6.000 variantes.
- DNRPA: tabla con vigencia `01/08/2026`, convertida a JSON para búsqueda local.
- Tasas: préstamos personales publicados en `https://comparatasas.ar/prestamos-personales/` al 23/08/2026.
- Tipo de cambio inicial: referencia editable de ARS 1.525/USD. **No es una fuente estructural del cálculo y puede cambiarse en cada simulación.**

## Ejecutar localmente

No abras `index.html` directamente con `file://`, porque los navegadores bloquean los `fetch()` a JSON locales.

```bash
cd autocierre-v.0.01
python -m http.server 8080
```

Luego abrir:

```text
http://localhost:8080/
```

Panel de mantenimiento:

```text
http://localhost:8080/admin.html
```

## Dependencias para actualizar datos

Python 3.10+ y Poppler (`pdftotext`) instalado en el sistema.

```bash
pip install -r requirements.txt
```

## Actualización mensual del PDF de mercado

Cuando llegue el PDF nuevo:

```bash
python tools/import_market_pdf.py "/ruta/Autos SEPTIEMBRE 2026.pdf"
```

El script guarda una copia en `sources/` y reemplaza `data/vehicle_market.json`.

El parser se apoya en la estructura visual del PDF: bandas grises para marcas, bandas rosas para modelos y columnas por año. Si el proveedor cambia el diseño del documento, hay que revisar `tools/parse_market_pdf.py` antes de publicar.

## Actualización DNRPA

Mes actual:

```bash
python tools/update_dnrpa.py
```

Mes específico:

```bash
python tools/update_dnrpa.py --year 2026 --month 9
```

La URL se construye con el formato:

```text
https://www.dnrpa.gov.ar/valuacion/informacion/01-MM-YYYY.pdf
```

## Actualización semanal de tasas

```bash
python tools/update_rates.py
```

El scraper tiene una protección básica: si extrae menos de 5 productos, aborta y conserva la base anterior. Esto evita que un cambio de HTML publique datos incompletos silenciosamente.

Cron semanal sugerido:

```cron
0 4 * * 1 cd /ruta/autocierre && /ruta/venv/bin/python tools/update_rates.py
```

Cron mensual DNRPA sugerido:

```cron
30 4 2 * * cd /ruta/autocierre && /ruta/venv/bin/python tools/update_dnrpa.py
```

## Reglas de cálculo configurables

Todo se concentra en `data/config.json`.

### Mercado

- `purchase_factor`: factor sobre la guía para estimar toma/compra.
- `sale_factor`: factor sobre la guía para estimar publicación/venta.
- reglas de ajuste por kilometraje.

Estos porcentajes **no provienen del PDF**. Son reglas comerciales iniciales para el prototipo y deben calibrarse con operaciones reales.

### Financiación

La cuota estimada aplica **sistema francés sobre la TNA publicada**, siguiendo la metodología descripta por ComparaTasas. El **CFT TEA** queda visible como referencia para comparar el costo integral. El cálculo es orientativo: cada entidad puede sumar seguros, impuestos, cargos, condiciones por perfil y redondeos propios.

### Transferencia

La v0.01 modela:

- arancel registral por transferencia configurado en 1% de la valuación oficial DNRPA;
- impuesto de sellos de Provincia de Buenos Aires según el tipo de operación configurado;
- un bloque mínimo de aranceles fijos configurables.

No incluye automáticamente multas, patentes, deuda, verificación policial, formularios extraordinarios, gestoría, prenda, cambio de radicación u otros conceptos variables.

Para jurisdicciones distintas de Provincia de Buenos Aires, el impuesto de sellos queda marcado como **no modelado** en esta primera versión.

## Matching DNRPA

El PDF de mercado y DNRPA no usan exactamente las mismas denominaciones. La web hace una coincidencia aproximada por:

- marca;
- año;
- tokens del modelo;
- cilindrada/versión;
- tipo de carrocería cuando aporta coincidencia.

La interfaz muestra la versión DNRPA utilizada y un porcentaje de coincidencia. Antes de una operación real conviene verificar manualmente unidades con coincidencia baja.

## Datos y mantenimiento

La arquitectura deliberadamente evita hacer scraping desde el navegador. Las fuentes se actualizan del lado del servidor y la calculadora consume archivos JSON locales. Esto mejora estabilidad, velocidad y evita problemas de CORS.

Para una v0.02 conviene agregar:

- backend + panel de administración autenticado para subir el PDF desde la web;
- histórico mensual de valuaciones;
- cache y logs de scraping;
- cotización automática del tipo de cambio elegido;
- reglas impositivas por provincia;
- cotizador aproximado de seguros;
- captación de lead y envío a WhatsApp/agencia;
- URLs indexables por marca/modelo para SEO.

## Aviso

El resultado es una estimación comercial e informativa. Para cerrar una operación se deben verificar los importes vigentes en las fuentes oficiales y con la entidad financiera correspondiente.
