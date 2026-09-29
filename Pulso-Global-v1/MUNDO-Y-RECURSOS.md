# Mundo productivo — Pulso Global v7.17

Documento editable para proponer futuros ajustes. Editarlo no cambia automáticamente el juego: pedí aplicar los valores al código, igual que con CADENA-DE-PRODUCCION.md.

## Cuota primaria mínima mensual por país proveedor

| Recurso | Unidades del recurso/mes |
|---|---:|
| Granos | 60 |
| Madera | 12 |
| Petróleo crudo | 2 |
| Mineral de hierro | 3 |
| Cobre | 1 |
| Uranio | 0,002 |
| Minerales | 6 |
| Litio | 0,08 |
| Oro | 0,0001 |
| Diamantes | 0,00001 |

Las unidades son las de la ficha de cada recurso, no toneladas para todos. Son parámetros ficticios de balance, no afirmaciones sobre reservas reales.

Los 128 países reciben dos especialidades por distribución determinista de identificadores. No todas las combinaciones son únicas, pero ningún país produce todo con este mecanismo. Se excluyen sus materias bloqueadas de importación dependiente. Los diez recursos tienen proveedores; la pantalla Base primaria mundial enumera el reparto real y el total.

La cuota se genera una vez por ciclo mensual, dentro de los días 6–9, y entra al stock público. No consume depósitos finitos, presupuesto ni empleos: representa aprovechamientos dispersos residuales. Es independiente del tamaño del país, tecnología y plantas. Necesita espacio: con el almacén lleno no se entrega ni acumula producción pendiente. Se garantiza capacidad productiva, no stock mundial permanentemente disponible ni compradores.

Cada especialidad tiene espacio mínimo para seis cuotas. Esta es la única capacidad gratuita nueva: no se añade inventario al cargar una partida. Las minas, cultivos, pozos y depósitos industriales siguen sus reglas y permiten escalar mucho más allá de este piso minúsculo.

## Transformación

Las 48 definiciones y las 30 recetas conservan los valores de CADENA-DE-PRODUCCION.md. El motor procesa insumos antes que sus derivados. Ninguna transformación genera productos sin descontar insumos reales. La ganadería obtiene alimento de los granos; lana, leche y cueros alimentan sus propias cadenas. Los residuos proceden de actividad urbana y productiva, no de yacimientos.

Ejemplos: crudo → combustible → químicos → componentes; mineral de hierro + combustible → acero → vehículos. Tecnología habilitante, edificios, personal, energía y almacenes limitan el resultado. La ficha de un recurso desglosa su equivalente primario teórico por unidad; los residuos y los subproductos ganaderos no se contabilizan como extracción directa.

## Tecnologías

129 nodos en 43 ramas. El grafo tiene orden progresivo y cruces entre sectores; no puede contener ciclos. Universidades precede a Física nuclear; Electrónica exige Petroquímica y Refinación de minerales; Vehículos eléctricos exige Baterías. Cada nodo muestra desbloqueos y efectos. Los niveles de optimización existentes siguen mejorando eficiencia sin multiplicar la cuota residual gratuita. Ver ARBOL-TECNOLOGIAS.md.

## Construir y demoler

Las obras se inician desde ministerios o fichas de recursos. Edificios enumera activos terminados públicos y privados. Solo el gobierno puede demoler los públicos; debe nacionalizar primero los privados que quiera controlar. Cada operación admite hasta 999 módulos y las capacidades heredadas fraccionarias.

La demolición cuesta 2% del costo fijo (gratis en modo admin), no devuelve recursos y requiere reservas disponibles. Reduce capacidad productiva, viviendas, infraestructura física, ganado o plazas militares según corresponda. No se permite retirar un almacén si el stock resultante superaría la capacidad restante. No se demuelen servicios históricos de reparación ni almacenes familiares migrados.

Se libera el terreno atribuible a edificios construidos desde esta versión. No se inventa terreno libre para activos heredados sin huella individual registrada. La reducción de vivienda o empleo puede deteriorar el bienestar en los ciclos siguientes. Obras en curso no son edificios terminados y no entran en esta operación.

## Comercio y conflictos

Las cuotas residuales no reemplazan importaciones: abastecer una economía avanzada exige depósitos, producción, acuerdos de política comercial y bienes intermedios. Las ventas/importaciones automáticas configuradas siguen usando existencias y dinero reales.

Faltantes relevantes por tres meses pueden llevar a países simulados a intentar obtener materias primas mediante incursiones. Se evalúan reservas físicas del rival, relaciones, fuerza, alcance y almacenes propios. Importar, producir o mantener reservas puede evitarlo. No toda escasez causa guerra; no hay ataques del jugador sin su orden ni anexiones. El historial es mundial. Ver SISTEMA-MILITAR.md para límites.

## Compatibilidad y balance

Se conservan fecha, caja, deuda, inventarios, depósitos, obras, niveles y cola de investigación. No hay reinicio de partida. Nuevos requisitos pueden bloquear proyectos pendientes sin borrar progreso. La IA recibe tres meses de gracia en partidas antiguas avanzadas; partidas nuevas habilitan conflictos por recursos desde el mes 24.

Las pruebas de conservación y funcionamiento no sustituyen pruebas de balance humano durante décadas de juego. El reparto abstracto busca diversidad comercial, no exactitud geológica por país.
