# AutoCierre v0.04

Actualización incremental sobre v0.03.

## Cambios

- La valuación de mercado, valor literal del PDF, ajuste por kilometraje, toma y venta no cambian.
- La **Lectura de oportunidad** incorpora un margen comercial configurable de **15 puntos porcentuales**.
- Con la configuración por defecto, si el precio ingresado coincide exactamente con la valuación guía, la lectura muestra **15% debajo del mercado ajustado**.
- El ajuste solo afecta la lectura de oportunidad y su clasificación; no altera transferencia, financiación ni valores fuente.
- Se muestra también una referencia comercial equivalente a `valor guía × 1,15` para explicar la diferencia monetaria.
- El porcentaje mostrado es una lectura comercial ajustada, no una modificación del dato original de la guía.

## Configuración

`data/config.json` → `opportunity.market_offset_percent`
