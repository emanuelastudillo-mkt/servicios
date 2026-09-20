# Pulso Global 7.6 — cola de investigación y exploración

Actualización incremental sobre **v7.5**. No es un paquete completo: conserva el mapa, las banderas y los demás archivos que no cambiaron. No requiere backend, instalación de dependencias ni compilación.

## Instalar el incremental

1. Antes de actualizar, exportá tu partida desde el menú **••• → Exportar** y conservá ese JSON.
2. Descomprimí el incremental sobre una copia de la carpeta de v7.5, respetando las rutas y reemplazando los archivos coincidentes. No borres los archivos antiguos que no aparecen en el ZIP.
3. Para GitHub Pages, subí los archivos del incremental a la misma raíz del repositorio donde está `index.html`. No subas una carpeta contenedora adicional.
4. Recargá el juego con conexión una vez, dejá terminar la actualización offline y cerrá las otras pestañas antiguas del juego antes de seguir.
5. Comprobá que la pantalla inicial indique **7.6**; si todavía aparece v7.5, esperá a que termine la descarga y recargá una segunda vez. No borres los datos del sitio.

La migración conserva país, fecha, reservas, deuda nominal, préstamos, inventarios públicos y avance de obras. Inicializa los sistemas nuevos con capacidades equivalentes estimadas. Guarda una copia previa a v6 en el navegador, pero ese respaldo no sustituye tu exportación externa. No puede reconstruir dinero que una versión anterior ya hubiera descontado incorrectamente y guardado: preserva el saldo existente, sin inventar compensaciones.

No importes una partida v6 en v5.4. Para volver, usá una copia de v5.4 y el JSON anterior a la actualización.

## Jugar localmente y guardar

Con Python instalado, ejecutá `python -m http.server 4173` desde la carpeta del juego y abrí `http://localhost:4173/`. No abras el HTML con doble clic: se necesita HTTP en localhost o HTTPS.

Usá siempre el mismo navegador, perfil, dominio y puerto. El guardado pertenece a esa dirección. Cambiarla no borra la partida original, pero la nueva dirección no puede verla: trasladala mediante exportar/importar. Borrar datos del sitio o usar navegación privada puede hacerte perder guardados.

Después de cargar todos los archivos, funciona sin Internet. No hay avance con la pestaña cerrada. La interfaz avanza por días; salarios, impuestos, intereses, producción y demografía conservan su escala mensual y se ejecutan una sola vez en su etapa. El menú **Cómo jugar** está disponible desde el inicio y durante la partida.

## Evolución del motor

## Ajuste 7.6: cola compartida sin límite fijo

- Investigaciones y exploraciones se agregan a una única cola en orden de solicitud. Solo avanza y consume presupuesto el primer proyecto. No existe el anterior máximo de tres exploraciones; la lista muestra 40 elementos por página para mantener la interfaz liviana.
- Se pueden encolar niveles sucesivos de una tecnología y sus dependencias si estas ya están antes en la cola. Se respeta el nivel máximo del catálogo. Al cancelar un requisito, los dependientes permanecen bloqueados hasta corregir la cola; nunca se saltan proyectos automáticamente.
- El progreso mensual es `100 / duración base × cobertura de científicos × capacidad de laboratorios × formación × financiamiento`. Cada cobertura llega como máximo al 100% de su referencia; el nivel aumenta la duración de investigación. Una exploración terrestre tiene referencia de 12 meses y una marítima de 18.
- Sin científicos, laboratorio, formación, fondos o prerrequisitos, el avance es cero y no se cobra presupuesto de proyecto. El financiamiento se limita al presupuesto de referencia; la etapa final cobra solo la fracción necesaria para completar el trabajo. Las nóminas educativas siguen siendo gastos independientes.
- El panel muestra posición, estado, porcentaje, puntos porcentuales por mes, meses restantes estimados y causas de bloqueo. El plazo cambia al variar los recursos disponibles. Finalizar una exploración no garantiza un descubrimiento.
- La siguiente tarea empieza en la próxima etapa mensual de investigación. Agregar, cancelar o recargar no vuelve a sortear el resultado de una campaña existente.
- Al cargar una partida anterior, se conserva el progreso: la investigación activa va primero y luego las exploraciones en el orden en que estaban registradas. Ese es el orden recuperable de los guardados anteriores, que no tenían una cola común.

## Ajuste 7.5: rendimiento y construcciones

- El avance diario actualiza la barra superior sin reconstruir el mapa, botones y formularios. Los detalles se actualizan durante el avance, como máximo cada dos segundos, conservando formularios y campos editados. También podés pulsar **Actualizar datos**. Podés editar con el reloj en marcha, sin pausa automática.
- Las acciones recibidas durante un cálculo diario se encolan en orden y se validan contra el estado al terminar esa jornada. El aviso y el encabezado indican las acciones pendientes; no hace falta repetir el clic. Si ya faltan fondos, recursos o requisitos, la acción muestra el error correspondiente.
- El proceso de simulación conserva su estado y devuelve solo los países modificados. Los formatos numéricos se reutilizan y los autoguardados de acciones próximas se agrupan.
- Cada construcción acepta de 1 a 100 módulos por pedido. El módulo conserva su tamaño físico (viviendas, kilómetros o instalaciones); la revisión muestra cantidad total, costo, trabajadores y plazo estimado.
- No hay límite de ocho obras públicas. Todos los proyectos comparten los trabajadores desocupados disponibles y se reparten la bolsa por igual. La demanda de trabajo crece con módulos y complejidad; la educación mejora el rendimiento. Una obra puede recibir más trabajadores que la dotación de referencia y acelerar proporcionalmente.
- Diez obras iguales reciben una décima parte cada una y requieren diez veces más tiempo que una sola, con igual bolsa, educación, materiales y Tesoro. La finalización y los pagos se liquidan en la etapa mensual de obras; un plazo teórico menor a un mes se completa en esa etapa.
- La barra superior muestra la bolsa de personas disponible para construir. Se contabilizan solo las jornadas efectivamente utilizadas; el remanente puede abastecer los programas pasivos de vivienda y la construcción privada, sin duplicar trabajadores.

## Ajuste 7.4: revisión de nacionalización sin clics perdidos

- **Revisar nacionalización** abre la vista previa aun cuando coincida con el cálculo diario en segundo plano.
- La ficha de cada recurso ahora renderiza correctamente el cuadro de confirmación que antes quedaba omitido.
- Navegar, ordenar o abrir/cancelar una confirmación no queda bloqueado y ya no fuerza un autoguardado.
- La confirmación final que modifica la partida sigue esperando a que termine el día para mantener el guardado coherente.

## Ajuste 7.3: propiedad por producción y dependencia comercial

- Las nacionalizaciones se realizan desde la ficha de cada recurso: producción de acero, automóviles o alimentos, o extracción de petróleo, hierro, cobre y otros recursos naturales. Ya no absorben automáticamente todo el sector.
- La transferencia incluye las instalaciones vinculadas, el stock de ese producto y una proporción coherente de empleos. Si una instalación fabrica más de un producto, la confirmación lo advierte.
- Cada ministerio se administra con puestos solicitados y sueldo. Se eliminó el presupuesto sectorial duplicado y su tope de subsidio; la nómina, los insumos, las obras y los proyectos específicos siguen consumiendo Tesoro real.
- Si el Estado no logra pagar toda la nómina, la cobertura salarial visible limita la producción pública. Las obras se detienen por Tesoro, materiales o trabajadores, no por una segunda autorización ministerial.
- Cada uno de los 127 países no controlados por el jugador tiene dos o tres dependencias estables entre granos, madera, petróleo, hierro, cobre y minerales. No puede producirlas localmente y, al consumir sus existencias, debe importarlas mediante el mercado mundial o acuerdos.
- La comparación mundial de cada recurso identifica a esos países con **Requiere importar**, permitiendo detectar mercados potenciales para el jugador.
- El país elegido por el jugador nunca recibe estos bloqueos automáticos. La distribución es determinista y se conserva al guardar y cargar.

## Ajuste 7.2: agotamiento de depósitos

- Las reservas minerales consumen correctamente su última fracción incluso con suministro eléctrico parcial: ya no queda una cantidad microscópica invisible que impida declarar el agotamiento.
- Al llegar a cero, la campaña correspondiente cambia de **Depósito descubierto** a **Agotado**, se informa en la actividad nacional y la ficha del recurso muestra el estado.
- Los depósitos agotados se pueden borrar del historial de exploraciones. Las campañas activas y los depósitos con reservas continúan protegidos.
- Una planta extractiva nueva queda bloqueada si el depósito de su zona está agotado. El diagnóstico de hierro, cobre y demás recursos naturales ya no confunde una instalación pública existente con “Falta instalación” por ausencia de plantas privadas.

## Ajuste 7.1: acuerdos y exploraciones

- Un acuerdo que agota su plazo queda como **Finalizado** y ofrece renovarlo por la duración original o cerrarlo definitivamente. Renovar conserva socio, recurso, dirección, cantidad máxima y arancel, y vuelve a validar la política de importación del destino.
- **Cerrar acuerdo** reemplaza la cancelación ambigua: conserva el registro histórico, detiene el intercambio y evita renovaciones accidentales.
- Cada campaña con resultado **Sin hallazgo** ofrece **Borrar resultado**. Las campañas activas y los depósitos descubiertos no se pueden borrar desde esa acción.

## Ajuste 7.0: calendario diario y rendimiento

- El calendario muestra día, mes y año. Pausa, 1×, 3×, 6× y “+1 día” trabajan con jornadas; cada mes se cierra según su cantidad real de días, incluidos años bisiestos.
- El ciclo mensual se distribuye por etapas: apertura/eventos, empleo y salarios, producción, consumo, comercio, obras y cierre fiscal, demografía, precios y consolidación.
- La simulación de cada día se calcula en un Web Worker. La interfaz permanece en el hilo principal y muestra la etapa en curso; si el navegador bloquea Workers, utiliza un modo compatible sin perder la partida.
- Los guardados incluyen la jornada y el estado intermedio. Reanudar a mitad de mes continúa la secuencia sin repetir impuestos, salarios, intereses ni consumos.

## Ajuste 6.4: vivienda pasiva

- Infraestructura permite asignar por separado un tope mensual y cuadrillas temporales para construcción y refacción de viviendas.
- El programa se ejecuta cada mes con el presupuesto realmente disponible, desempleados, materiales, Tesoro y suelo residencial libre. Informa producción, refacciones y causa concreta de una pausa; no convierte agricultura automáticamente.

## Ajuste 6.3: tutorial de Economía y deuda

- La parte superior de Economía y deuda incluye una guía desplegable que explica ingresos, impuestos, gastos, pensiones, obras, intereses, amortización, reservas, deuda, crédito automático y una lectura práctica para decidir.
- Cada explicación separa qué puede aumentar o disminuir el valor y qué condiciones requiere. El tutorial recalca que alícuotas, préstamos y recortes no producen resultados instantáneos ni garantizados.

## Ajuste 6.1: leer y destrabar la economía

- Economía y deuda abre con un resumen de un mes: impuestos, ventas públicas, salarios, pensiones, funcionamiento, obra/investigación, intereses, amortización y cambio efectivo de reservas. Los importes se muestran en escala compacta.
- El panel indica el plazo estimado de reservas si hay pérdida mensual, la proporción de ingresos absorbida por intereses y los tres mayores pagos. Es una lectura del último mes, no una previsión garantizada.
- Cada obra activa explica si avanzará el mes siguiente o cuál es el bloqueo exacto: materiales y faltante, Tesoro o falta de desocupados.
- La situación de cada ministerio muestra los recursos que hoy impiden producir; no presenta una instalación aún en construcción como producción ya disponible.
- Impuestos ahora enseña la base gravada del último mes y el cambio monetario estimado frente al esquema vigente. La alícuota se cobra en la próxima etapa fiscal aplicable y no recauda si no existen operaciones gravadas.

- Tesoro, empresas y hogares con cuentas separadas; registro de operaciones, cuotas, intereses y amortización. Comprar recursos no vuelve a descontar el préstamo en el cierre siguiente.
- Ministerios administrados mediante funcionarios solicitados y salarios; vacantes, cualificación, competencia entre empleadores y cobertura efectiva de la nómina. Los programas específicos conservan sus costos monetarios. Los impuestos siguen siendo alícuotas.
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

El crédito automático cubre obligaciones y ciertos insumos públicos dentro del límite crediticio. Puede desactivarse en Economía. Aumentar puestos o salarios eleva la nómina potencial, pero faltas de trabajadores, recursos, instalaciones o caja pueden reducir producción y dejar obras o investigaciones detenidas.

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
