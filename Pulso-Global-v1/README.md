# Pulso Global 6.3 — tutorial completo de Economía y deuda

Actualización incremental sobre **v6.1**. No es un paquete completo: conserva el mapa, las banderas y los demás archivos que no cambiaron. No requiere backend, instalación de dependencias ni compilación.

## Instalar el incremental

1. Antes de actualizar, exportá tu partida desde el menú **••• → Exportar** y conservá ese JSON.
2. Descomprimí el incremental sobre una copia de la carpeta de v6.1, respetando las rutas y reemplazando los archivos coincidentes. No borres los archivos antiguos que no aparecen en el ZIP.
3. Para GitHub Pages, subí los archivos del incremental a la misma raíz del repositorio donde está `index.html`. No subas una carpeta contenedora adicional.
4. Recargá el juego con conexión una vez, dejá terminar la actualización offline y cerrá las otras pestañas antiguas del juego antes de seguir.
5. Comprobá que la pantalla inicial indique **6.3**; si todavía aparece v6.1, esperá a que termine la descarga y recargá una segunda vez. No borres los datos del sitio.

La migración conserva país, fecha, reservas, deuda nominal, préstamos, inventarios públicos y avance de obras. Inicializa los sistemas nuevos con capacidades equivalentes estimadas. Guarda una copia previa a v6 en el navegador, pero ese respaldo no sustituye tu exportación externa. No puede reconstruir dinero que una versión anterior ya hubiera descontado incorrectamente y guardado: preserva el saldo existente, sin inventar compensaciones.

No importes una partida v6 en v5.4. Para volver, usá una copia de v5.4 y el JSON anterior a la actualización.

## Jugar localmente y guardar

Con Python instalado, ejecutá `python -m http.server 4173` desde la carpeta del juego y abrí `http://localhost:4173/`. No abras el HTML con doble clic: se necesita HTTP en localhost o HTTPS.

Usá siempre el mismo navegador, perfil, dominio y puerto. El guardado pertenece a esa dirección. Cambiarla no borra la partida original, pero la nueva dirección no puede verla: trasladala mediante exportar/importar. Borrar datos del sitio o usar navegación privada puede hacerte perder guardados.

Después de cargar todos los archivos, funciona sin Internet. No hay avance con la pestaña cerrada. Cada tick representa un mes; las velocidades son máximos deseados, sujetos a la capacidad del dispositivo. El menú **Cómo jugar** está disponible desde el inicio y durante la partida.

## Qué incorpora v6

## Ajuste 6.3: tutorial de Economía y deuda

- La parte superior de Economía y deuda incluye una guía desplegable que explica ingresos, impuestos, gastos, pensiones, obras, intereses, amortización, reservas, deuda, crédito automático y una lectura práctica para decidir.
- Cada explicación separa qué puede aumentar o disminuir el valor y qué condiciones requiere. El tutorial recalca que alícuotas, préstamos y recortes no producen resultados instantáneos ni garantizados.

## Ajuste 6.1: leer y destrabar la economía

- Economía y deuda abre con un resumen de un mes: impuestos, ventas públicas, salarios, pensiones, funcionamiento, obra/investigación, intereses, amortización y cambio efectivo de reservas. Los importes se muestran en escala compacta.
- El panel indica el plazo estimado de reservas si hay pérdida mensual, la proporción de ingresos absorbida por intereses y los tres mayores pagos. Es una lectura del último mes, no una previsión garantizada.
- Cada obra activa explica si avanzará el mes siguiente o cuál es el bloqueo exacto: materiales y faltante, Tesoro, presupuesto autorizado del ministerio o falta de desocupados.
- La situación de cada ministerio muestra los recursos que hoy impiden producir; no presenta una instalación aún en construcción como producción ya disponible.
- Impuestos ahora enseña la base gravada del último mes y el cambio monetario estimado frente al esquema vigente. La alícuota se cobra recién al avanzar un mes y no recauda si no existen operaciones gravadas.

- Tesoro, empresas y hogares con cuentas separadas; registro de operaciones, cuotas, intereses y amortización. Comprar recursos no vuelve a descontar el préstamo en el tick siguiente.
- Presupuestos y subsidios editados en dinero mensual; funcionarios solicitados, salarios, vacantes, cualificación y competencia entre empleadores. Los impuestos siguen siendo alícuotas.
- Propiedad pública/privada, producción diferenciada, inversión y cierres privados graduales, nacionalización y eficiencia sectorial.
- 48 recursos con recetas, instalaciones y tecnologías; ganadería, lácteos, cuero, lana, litio, electrónica avanzada y residuos. 48 iconos SVG de 100 × 100 y las 128 banderas existentes.
- Almacenes especializados con capacidad compartida por familia. El espacio se reparte entre productos para que los insumos no bloqueen toda la cadena. Las pérdidas y basura sin recoger quedan registradas.
- Consumo doméstico, reposición y existencias de bienes durables, prohibición de importaciones por recurso/categoría o general, compraventa pública y acuerdos bilaterales.
- Obras de cantidad física fija: viviendas, km de redes, aeropuertos y puertos por unidad; riego en hectáreas. Costo laboral y plazo dependen del país, sin cambiar el tamaño de una central o fábrica.
- Territorio, agricultura y vivienda; aviso y confirmación al ocupar suelo agrícola. Viviendas nuevas, normales y a refaccionar.
- Cohortes por edad, edad laboral configurable (18–65 al inicio; extremos permitidos 12–80), pensiones, esperanza de vida y migración entre países. Nauru muestra habitantes e importes pequeños con precisión.
- Educación primaria, secundaria, técnica/superior y universitaria, más siete ramas de formación. Los docentes e investigadores se asignan desde los funcionarios de Educación, no se duplican.
- Laboratorios, árbol tecnológico de cuatro niveles y exploración terrestre/marítima con probabilidad de fracaso. Un hallazgo descubre reservas finitas; no crea producción sin construir.
- Nuclear, hidroeléctrica, eólica terrestre, geotérmica, solar, fósil y biomasa. La electricidad se limita por demanda, combustible, personal y almacenamiento específico.
- Eventos pasivos, ciclos económicos, rankings numerados y ordenables y ficha de cada recurso con producción nacional y mundial.

## Cómo funciona la economía

**Reservas = Tesoro disponible**, no todo el dinero del país. Un superávit comercial privado no entra íntegro al Estado. Solo impuestos, operaciones públicas y financiación identificada cambian el Tesoro.

Una compra manual exige reservas suficientes según la cotización conservadora y no solicita un préstamo por sí sola. Puede ejecutarse menos cantidad si faltan vendedor, excedente, transporte o capacidad. El préstamo recibido sigue disponible hasta que una operación o gasto real lo utiliza. No existe el antiguo piso de −20 MM.

El crédito automático cubre obligaciones y ciertos insumos públicos dentro del presupuesto y del límite crediticio. Puede desactivarse en Economía. Aumentar presupuesto no obliga a gastarlo entero: faltas de trabajadores, recursos, instalaciones o caja dejan parte sin ejecutar. Obras e investigación pueden detenerse.

El saldo mensual incluye ingresos y gastos efectivos. Un superávit recupera caja y permite amortizar deuda; una caída del cociente deuda/PBI no significa que se haya cancelado capital. Los intereses impagos se registran, no desaparecen.

Se mantiene una única derrota económica: **deuda superior al 205% del PBI y reservas agotadas**, evaluada al cerrar el mes. No hay derrota por respaldo, crisis institucional, fecha ni cantidad de mandatos.

El comercio mueve las mismas unidades entre dos países. Los acuerdos no garantizan ventas sin demanda ni obligan al Estado a comprar producción privada. Los insumos importados tras la fase productiva se utilizan desde el mes siguiente. Quien exporta basura de precio negativo paga por su recepción; los reciclables pueden valer positivamente.

## Datos, escala y límites del modelo

Se conservan 128 países/territorios jugables y sus figuras reales de la base anterior. La selección de una persona es un escenario hipotético, no una afirmación de candidatura o elegibilidad.

`country-facts.js` incorpora superficie terrestre, tierra agrícola, esperanza de vida y, donde hay cobertura, ferrocarril y riego del Banco Mundial. Conserva año y serie por campo; **no son todos datos de 2026**. Las cifras de población y PBI continúan con las fuentes y años de v5. Ver `FUENTES.md`.

Las cantidades iniciales de establecimientos, almacenes, ganado, matriz energética y tecnologías son **equivalentes de escenario**, no censos reales. Las reservas minerales, precios, recetas, costos, probabilidades y coeficientes sociales son parámetros de juego. La agricultura incluye tierra agropecuaria, no solo cultivos.

El PBI real usa valor añadido de bienes sin volver a sumar sus insumos y un componente de servicios agregado, anclado a la economía inicial y ajustado por empleo y eficiencia. Los bienes y servicios fuera del catálogo tienen pagos entre hogares y proveedores públicos/privados según su participación; no representan tarifas reales de cada servicio. No se simula un sistema bancario completo, tipos de cambio ni contratos laborales individuales.

Los sectores pagan un salario agregado; las ramas educativas influyen en la oferta ponderada del ministerio. La migración y la población se calculan por cohortes, con participación laboral de referencia del 72%. Con edad inicial menor de 18, “menores” y “edad laboral habilitada” se superponen: no deben sumarse como grupos exclusivos.

El límite de 60.000 habitantes/km² es una regla de diseño. Nauru tiene 21 km² y un máximo de 1.260.000 habitantes. Un guardado antiguo ya excedido no elimina habitantes de golpe; se frena el nuevo crecimiento por encima de capacidad.

Las abreviaturas conservan la escala de la interfaz: B = billones, MM = mil millones, M = millones; m = miles y k se usa en magnitudes de cientos de miles. Para tomar decisiones, los controles monetarios muestran el importe completo en US$.

Esta es una simulación para jugar y probar decisiones, no una predicción económica. El balance requiere pruebas de juego continuadas, especialmente después de migrar economías muy avanzadas o alterar fuertemente salarios, nacionalización e impuestos.

## Verificación y archivos

El código editable está en los JavaScript y CSS de esta carpeta. `catalog-v6.js` define el catálogo, `simulation-v6.js` el motor ampliado y `ui-v6.js` las pantallas. No modifiques archivos del navegador ni guardados para instalar la actualización.

`CAMBIOS-v6.md` resume cobertura, criterios y comprobaciones de esta entrega. No se publicó ningún cambio automáticamente en GitHub.
