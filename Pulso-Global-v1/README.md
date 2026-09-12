# Pulso Global v3 - paquete para GitHub Pages

Subí todos los archivos de esta carpeta a la raíz de un repositorio. Después activá GitHub Pages desde **Settings > Pages > Deploy from a branch**, seleccionando `main` y `/ (root)`.

El juego no necesita backend ni base de datos remota. Las partidas se guardan localmente en el navegador. El menú `•••` permite exportarlas como JSON para conservar una copia o moverlas a otro dispositivo. Este ZIP es el sitio estático completo: no necesita instalación ni compilación.

## Jugar localmente

Desde la carpeta descomprimida, con Python instalado, ejecutá `python -m http.server 4173` y abrí `http://localhost:4173/`. Usá siempre el mismo navegador y dirección para encontrar tus partidas. No abras directamente el HTML con doble clic: el mapa y el modo offline requieren HTTP.

Después de una primera carga completa por localhost o HTTPS, los recursos quedan disponibles offline en ese navegador. No hay progreso mientras la pestaña está cerrada. Borrar los datos del sitio o usar navegación privada puede eliminar las partidas; exportá una copia importante antes de actualizar o cambiar de dirección.

## Qué cambia en v3

- No hay fecha final, límite de mandatos ni victoria automática a los ocho años. Cada tick sigue representando un mes. Se mantienen las derrotas económicas y sociales: cuatro meses de bajo respaldo, crisis institucional o deuda extrema sin reservas.
- Impuestos editables: IVA, ganancias, herencias, derechos de importación y derechos de exportación. Podés mover los deslizadores o escribir la alícuota; una vista previa muestra el efecto estimado. Solo cambian al pulsar **Aplicar impuestos** y sus resultados se calculan al avanzar el mes. **Restablecer** descarta el borrador, sin alterar la política vigente.
- Población del país propio siempre visible en la barra superior. Al seleccionar países en el mapa se muestra su población; Demografía permite consultar y comparar los diez países.
- Menores, población en edad laboral y jubilados evolucionan mensualmente, con nacimientos, envejecimiento, fallecimientos y migración.
- Los guardados v1 y v2 se migran automáticamente. Una partida que ganó por alcanzar el antiguo límite temporal vuelve a estar activa. Las derrotas previas se conservan. Las obras, existencias e indicadores se mantienen y los campos nuevos se inicializan.

Se conservan el mapa mundial, ocho ministerios, presupuestos, mano de obra, subsidios, materias primas y diecinueve construcciones. Los eventos naturales y políticos siguen desactivados para probar el motor base.

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

La proporción de adultos modifica la capacidad productiva y la base de ganancias. Esta versión no implementa todavía un sistema previsional individual, pirámide por edad, presupuesto jubilatorio separado ni migración bilateral conservada entre países.

## Alcance del prototipo

Es un motor agregado para experimentar, no una predicción económica. Los mercados de alimentos, energía, manufacturas y tecnología usan oferta, consumo y precios dinámicos, con el resto del mundo como contraparte simplificada. Los seis materiales de obra utilizan un inventario nacional separado. No hay eventos aleatorios, elecciones ni un plazo automático de salida del cargo.

Se guardan los últimos 120 meses de gráficos y 80 avisos, sin limitar la duración total. Las obras activas se conservan; el listado histórico mantiene las 40 completadas más recientes, mientras el total construido sigue acumulado.

Los perfiles de figuras públicas y los valores iniciales son abstracciones para una simulación hipotética, no evaluaciones ni estadísticas oficiales.
