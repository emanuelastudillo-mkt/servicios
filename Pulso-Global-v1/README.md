# Pulso Global v5.1 - paquete para GitHub Pages

Subí todos los archivos de esta carpeta a la raíz de un repositorio. Después activá GitHub Pages desde **Settings > Pages > Deploy from a branch**, seleccionando `main` y `/ (root)`.

El juego no necesita backend ni base de datos remota. Las partidas se guardan localmente en el navegador. El menú `•••` permite exportarlas como JSON para conservar una copia o moverlas a otro dispositivo. Este ZIP es el sitio estático completo: no necesita instalación ni compilación.

## Jugar localmente

Desde la carpeta descomprimida, con Python instalado, ejecutá `python -m http.server 4173` y abrí `http://localhost:4173/`. Usá siempre el mismo navegador y dirección para encontrar tus partidas. No abras directamente el HTML con doble clic: el mapa y el modo offline requieren HTTP.

Después de una primera carga completa por localhost o HTTPS, los recursos quedan disponibles offline en ese navegador. No hay progreso mientras la pestaña está cerrada. Borrar los datos del sitio o usar navegación privada puede eliminar las partidas; exportá una copia importante antes de actualizar o cambiar de dirección.

## Qué cambia en v5.1

- Se integran 128 banderas nacionales SVG y 17 iconos SVG de recursos. Cada archivo tiene lienzo de 100 × 100 px, funciona sin conexión y está listado en `assets/icons-manifest.json`.
- Las banderas se muestran en la selección de país, paneles de gobierno y comercio. Los recursos reemplazan las abreviaturas del inventario por iconos reconocibles.
- `assets/ATTRIBUTION.md` documenta la licencia MIT de las banderas base y el origen de los iconos de recursos.

- El mundo jugable pasa a 128 países y 384 figuras públicas reales, tres por país. La pantalla inicial incorpora búsqueda por nombre, código o región.
- Los 112 países nuevos parten de indicadores del Banco Mundial con el año de cada serie preservado en `countries-extra.js`; los valores corresponden principalmente a 2024–2025.
- **Economía y deuda** detalla PBI nominal y per cápita, variación mensual, ingresos, gasto, reservas, comercio, inflación, desempleo, deuda y riesgo de cesación de pagos.
- Se pueden pedir cuatro clases de préstamo. Antes de contratar se muestran monto, tasa, plazo, primera cuota, deuda resultante y riesgo proyectado. La cuota consume reservas y amortiza capital mes a mes.
- La interfaz usa la escala acordada: `B` billones, `MM` mil millones, `M` millones, `k` cientos de miles y `m` miles.
- Población y PBI ahora conservan seis decimales internos. En Nauru se ven movimientos de decenas de personas y montos inferiores al millón.
- Los guardados v1–v4 migran al formato v5 y reciben países, préstamos y campos nuevos sin perder progreso.

## Sistemas incorporados en v4.1

- Se agregan Cuba, Zambia, Nigeria, Uruguay, Haití y Nauru. Los seis pueden elegirse en la pantalla inicial y tienen tres figuras, parámetros nacionales, impuestos, demografía, recursos, producción y comercio propios.
- El mapa, la comparación demográfica y el mercado mundial integran ahora 128 países. Las partidas existentes reciben los países faltantes al cargarse, sin perder el país jugado ni sus avances.
- Hay 17 recursos en tres niveles: básicos, intermedios y productos finales. Cada transformación consume existencias reales; los productos finales exigen una fábrica o laboratorio.
- Las 26 construcciones tienen el mismo costo fijo y requerimiento material en cualquier país. El desempleo, el nivel educativo y el salario relativo modifican costo laboral y plazo. Una central nuclear siempre suma 12 TWh, por lo que su peso cambia según la demanda nacional.
- Las viviendas se dividen en nuevas, normales y a refaccionar. Envejecen y se deterioran cada mes; los proyectos de mantenimiento reparan un lote fijo.
- Los países atraviesan ciclos diferentes. Pandemias, epidemias, terremotos, tsunamis, tornados, tormentas y sequías aparecen como shocks pasivos: no abren decisiones, pero alteran producción, PBI, población, vivienda y migración.
- Cada recurso tiene una cotización mundial que fluctúa mensualmente según existencias, producción y consumo. En **Recursos y producción** se puede elegir una cantidad y comprarla o venderla; importaciones y exportaciones aplican los impuestos configurados.
- Una crisis institucional ya no finaliza el gobierno. La estabilidad puede llegar a cero y la simulación continúa; también se reabren automáticamente los guardados anteriores que habían terminado por esa causa.

## Sistemas conservados y ampliados

- No hay fecha final, límite de mandatos ni victoria automática a los ocho años. Cada tick sigue representando un mes. Se mantienen las derrotas por cuatro meses de respaldo inferior al 18% o deuda extrema sin reservas.
- Impuestos editables: IVA, ganancias, herencias, derechos de importación y derechos de exportación. Podés mover los deslizadores o escribir la alícuota; una vista previa muestra el efecto estimado. Solo cambian al pulsar **Aplicar impuestos** y sus resultados se calculan al avanzar el mes. **Restablecer** descarta el borrador, sin alterar la política vigente.
- Población del país propio siempre visible en la barra superior. Al seleccionar países en el mapa se muestra su población; Demografía permite consultar y comparar los 128 países.
- Menores, población en edad laboral y jubilados evolucionan mensualmente, con nacimientos, envejecimiento, fallecimientos y migración.
- Los guardados v1, v2, v3 y v4 se migran automáticamente a v5. Una partida que ganó por alcanzar el antiguo límite temporal o terminó por crisis institucional vuelve a estar activa. Las demás derrotas previas se conservan. Las obras, existencias e indicadores se mantienen y los campos nuevos se inicializan.

Se conservan el mapa mundial, ocho ministerios, presupuestos, mano de obra, subsidios e impuestos. Los eventos son automáticos y no detienen el tiempo.

## Impuestos y economía

Las alícuotas iniciales son parámetros de juego, no una reproducción de la legislación de cada país. Ganancias agrupa ingresos y utilidades; el modelo no distingue escalas, exenciones ni tributos provinciales.

- IVA reduce el consumo a tasas más altas y aumenta la presión de precios. Ganancias reduce ingreso disponible y el impulso de crecimiento. Herencias aporta una base fiscal menor y un pequeño efecto social definido para el juego.
- Los derechos de importación reducen los intercambios y presionan los precios; los de exportación reducen la oferta externa. La recaudación aduanera parte del valor efectivamente comerciado, no del PBI total.
- Las bases domésticas se aproximan con coeficientes sobre el PBI: IVA × 0,38; ganancias × 0,29 ajustado por la proporción en edad laboral; herencias × 0,02. Se aplica la eficiencia recaudatoria del país.
- Para aduanas, la proyección anual es flujo mensual × alícuota × 12 × eficiencia / PBI, expresada en puntos de PBI. Los impuestos internos no se descuentan de la balanza comercial: esta compara exportaciones e importaciones brutas.
- **Otros ingresos** resume recursos públicos no gestionados individualmente. **Ajuste de gestión** muestra la bonificación del perfil elegido. Balance fiscal = ingresos con ese ajuste − gasto público − subsidios. Las obras agregan su costo a la deuda a medida que avanzan.
- Las proyecciones no son promesas: empleo, productividad, demografía, PBI, precios y comercio cambian cada mes. El resto de países evoluciona con gestión simplificada.

## Cómo leer la demografía

Los tres grupos no se superponen y suman la población: menores de 0–17 años, edad laboral de 18–64 años y jubilados de 65 años o más. La última categoría es una aproximación etaria; no un padrón real de beneficiarios. No se simulan edades de retiro particulares por país.

La fuerza laboral es el 72% de quienes están en edad laboral. Se reparte en ocupados y desocupados según la tasa de desempleo; el resto son inactivos. Por eso “edad laboral” no equivale a “personas empleadas”.

Cada mes se agregan nacimientos, se descuentan muertes y se aplica migración neta; parte de los menores pasa a edad laboral y parte de los adultos se jubila. Los movimientos se calculan como población × tasa anual por mil / 12.000. Las cohortes se expresan internamente en millones y se actualizan para todos los países. Las diferencias mínimas entre cifras mostradas corresponden al redondeo.

La proporción de adultos modifica la capacidad productiva y la base de ganancias. Esta versión no implementa todavía un sistema previsional individual, pirámide por edad ni presupuesto jubilatorio separado.

## Alcance del prototipo

Es un motor agregado para experimentar, no una predicción económica. Los mercados de alimentos, energía, manufacturas y tecnología usan oferta, consumo y precios dinámicos, con el resto del mundo como contraparte simplificada. Los 17 recursos usan inventarios y recetas nacionales. Hay eventos pasivos, pero no elecciones ni un plazo automático de salida del cargo.

Se guardan los últimos 120 meses de gráficos y 80 avisos, sin limitar la duración total. Las obras activas se conservan; el listado histórico mantiene las 40 completadas más recientes, mientras el total construido sigue acumulado.

Los perfiles de figuras públicas y los valores iniciales son abstracciones para una simulación hipotética, no evaluaciones ni estadísticas oficiales.

Las fuentes y la metodología de los 112 países nuevos están detalladas en `FUENTES.md`. El año exacto varía por serie. Los parámetros no cubiertos por datos públicos fueron derivados o ajustados deliberadamente para equilibrar el juego.
