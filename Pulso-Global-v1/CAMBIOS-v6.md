# Pulso Global 7.8 — depósitos ampliados

## Ajuste v7.8

- Reservas físicas de depósitos naturales terrestres y marítimos ×100, incluidas las ya descubiertas y los nuevos resultados de exploración.
- Migración de una sola ejecución: no altera Tesoro, préstamos, inventarios, obras ni exploraciones; los depósitos agotados siguen agotados.

## Historial v7.7

## Ajuste 7.7: controles directos y mercado automático

- Exploración conserva recurso, zona y presupuesto tras agregar a la cola. Otro clic repite el pedido durante la sesión.
- Construcciones de 1 a 999 módulos, sin confirmación. Costo estimado, plazo y conversión de suelo agrícola se muestran antes de construir. Continúan la bolsa compartida y la cola de acciones durante cálculos.
- Comercio exterior reemplaza los acuerdos por recursos habilitados para vender excedentes, seleccionar todos e importar bajo un umbral. Aplicar guarda los cambios. La venta habilita exportaciones públicas y privadas; las compras automáticas usan solo el stock y las reservas públicos. Las empresas mantienen sus compras privadas.
- El mercado opera el día 14 mensual. Respeta prohibiciones, reservas, oferta, transporte y almacenes. No toma crédito, pero puede agotar las reservas disponibles. Protege el umbral importado de reventa automática. El stock mínimo de cada ficha sigue vigente.
- También admite residuos: exportar a precio negativo cuesta dinero. Recibirlos requiere espacio y capacidad de tratamiento. Vender no está garantizado sin demanda.
- Precio base de productos finales ×10 respecto a v7.6, con fluctuaciones posteriores. No garantiza rentabilidad neta ×10: depende de costos y compradores solventes.
- Pequeña demanda profesional proporcional a población para maquinaria, baterías, servidores, supercomputadoras, transporte y herramientas. El plutonio tiene demanda industrial especializada muy baja, nunca consumo doméstico.
- Los duraderos salen del inventario comercial hacia bienes en uso y se desgastan mensualmente (vidas útiles de 3–25 años). Alimentos y lácteos siguen consumiéndose regularmente.
- Bienes en uso: felicidad hasta ×1,15; producción ×1,25; construcción e investigación ×1,35. Se calculan por cobertura por habitante, sin acumularse exponencialmente. El almacén no da bonificaciones. La ficha de un producto final muestra los multiplicadores nacionales.

### Compatibilidad y límites

Se conservan reservas, deuda, inventarios, obras y cola científica. Los precios se actualizan una sola vez. Los acuerdos del jugador se cierran sin liquidaciones adicionales; se reemplazan por el mercado automático. Las importaciones automáticas comienzan desactivadas. Las exportaciones no residuales continúan habilitadas por defecto, como antes.

Exportá un respaldo antes de actualizar; no abras un guardado v7.8 en versiones anteriores. El equilibrio económico a largo plazo sigue siendo experimental: las pruebas verifican contabilidad y funcionamiento, no garantizan prosperidad para todas las políticas.

## Historial

# Pulso Global 7.6 — investigaciones y exploraciones en cola

Fecha de entrega: 20 de septiembre de 2026. Incremental sobre v7.5. Motor jugable de gestión nacional, con balance de largo plazo experimental. No es una previsión económica ni una reproducción exacta de cada país.

## Ajuste 7.6

- Cola FIFO compartida entre tecnologías y exploraciones, sin máximo fijo de proyectos y con paginación de 40 elementos.
- Solo el primero avanza y paga; la siguiente tarea arranca en la próxima etapa mensual. Los proyectos bloqueados conservan su lugar.
- Avance y plazo relativo a científicos, formación, laboratorios, presupuesto efectivo, nivel y tipo de exploración. Sin trabajo efectivo no se cobra el presupuesto del proyecto; el último tramo se cobra proporcionalmente.
- Niveles y prerrequisitos encolables en orden, cancelación individual y conservación del progreso y sorteos al guardar/cargar.
- Migración desde v7.5: investigación activa primero, exploraciones según su orden registrado, sin reiniciar porcentajes.

## Ajuste 7.5

- Actualización diaria parcial de indicadores: evita reconstruir mapa y formularios durante el avance. Detalles actualizados cada dos segundos, sin reemplazar formularios; la edición ya no pausa automáticamente.
- Cola FIFO de acciones recibidas durante un cálculo, con captura de cantidades/formularios, validación al ejecutar y avisos de pendientes o errores.
- Estado persistente en el Worker, envío de países modificados y reutilización de formatos numéricos. Autoguardados próximos agrupados.
- Cantidad de módulos por construcción, revisión de totales y plazo según mano de obra compartida. Sin límite de ocho obras públicas.
- Reparto igualitario de la bolsa entre obras activas; aceleración por concentración de personal, costos proporcionales al trabajo realizado y disponibilidad siempre visible.
- El avance de obras conserva la liquidación mensual del motor; el plazo teórico puede ser inferior a un mes pero la entrega ocurre en esa etapa.

## Ajuste 7.4

- **Revisar nacionalización** abre su confirmación de inmediato aunque en ese instante esté terminando el cálculo diario en segundo plano.
- La ficha detallada del recurso ya incorpora el cuadro de confirmación; antes un retorno anticipado calculaba la revisión pero omitía el diálogo del HTML.
- Las acciones que solo navegan o abren/cancelan vistas previas ya no se descartan durante el cálculo ni generan un autoguardado innecesario.
- Las confirmaciones que cambian dinero, instalaciones o políticas continúan protegidas hasta que termine la jornada, para evitar que el resultado del Worker sobrescriba la decisión.
- La prueba de navegador inicia deliberadamente un día y abre/cancela la revisión de nacionalización mientras el cálculo está ocupado.

## Cobertura de la lista consolidada

| Pedido | Implementación en esta entrega |
|---|---|
| Préstamos y compras | Saldo del Tesoro y capital nominal separados; compras con vista previa, fondos suficientes y sin doble cargo en el mes siguiente. |
| Consumo nacional | Los hogares compran existencias públicas/privadas. Los durables se conservan y deterioran; el consumo depende de ingreso, disponibilidad y reposición. |
| Prohibir importaciones | Controles generales, por categoría y por recurso; afectan mercado automático, manual y acuerdos. La escasez afecta bienestar. |
| Necesidades de vivienda y empleo | Viviendas útiles y ocupación participan del bienestar y de la atracción migratoria; no hay bonificación instantánea por mover un control. |
| Puestos de trabajo reales | Las vacantes se cubren gradualmente con población laboral disponible y cualificación. Obras y empleos permanentes no duplican personas. |
| Almacenamiento | Familias logísticas con volumen compartido, almacenes construibles, mínimos protegidos, pérdidas y residuos sin recoger visibles. |
| Acuerdos comerciales | Acuerdos bilaterales de duración y cantidad máxima; solo se ejecuta lo que permite excedente, demanda, dinero y transporte. |
| Rankings | Posiciones numeradas y orden ascendente/descendente por valores numéricos. Tablas nacionales, demográficas y de producción/comercio por recurso. |
| Riego | Distritos expresados en hectáreas irrigadas; son un subconjunto de la tierra agrícola. |
| Presupuestos monetarios | Edición en US$/mes; porcentajes como información. IVA, ganancias, herencias e impuestos al comercio siguen siendo alícuotas. |
| Funcionarios | Solicitud de puestos, salario, presupuesto, vacantes y traslado de trabajadores entre sectores públicos/privados. |
| Energías | Siete fuentes, capacidades fijas por módulo, combustibles efectivos, límites por demanda y almacenamiento eléctrico separado. |
| Basura | Orgánicos, reciclables, biomasa y basura no aprovechable; tratamiento/reciclaje, efectos de acumulación y pagos por recibir residuos. |
| Investigación | Laboratorios, proyectos financiados, científicos limitados a la plantilla y resultados persistentes. |
| Educación | Cuatro niveles y siete ramas, presupuesto y personal por programa; egresos por cohortes y efectos de formación. |
| Territorio | Superficie terrestre, usos residenciales/agropecuarios/industriales y conversión de agricultura en vivienda con confirmación. |
| Edades y esperanza de vida | Cohortes de 0 a 100+, edad inicial/retiro editables, mortalidad, pensiones, nacimientos y migración. |
| Público y privado | Existencias, instalaciones, personal y producción diferenciados; cuentas de empresas, hogares y Estado. |
| Nacionalización | Transferencia al Estado de activos, stocks, empleo y responsabilidades; conserva el volumen logístico total y el ganado. |
| Infraestructura física | Aeropuertos/puertos por cantidad; carreteras, autopistas, ferrocarriles, subtes y tren de alta velocidad por km. |
| Árbol tecnológico | 124 tecnologías, prerequisitos y hasta cuatro niveles; las mejoras tienen límites y no crean insumos. |
| Recursos y ganadería | 48 recursos en tres niveles; bovinos, porcinos, aves, ovinos y derivados; litio y productos avanzados. |
| Depósitos inciertos | Exploración con resultado guardado, éxito bajo y posibilidad de fracaso; petróleo terrestre/marítimo y depósitos finitos. |
| Instalaciones iniciales | Equivalentes estimados según población, actividad y formación; no hay obligación de construir toda la economía desde cero. |
| Competencia salarial | Aumentar sueldo público puede captar trabajadores privados; el empleo total no aumenta por el mero traslado. |
| Eficiencia y especialización | Formación, experiencia y tecnología modifican rendimiento y prioridad comercial. Los proveedores reciben el resultado de sus ventas intermedias. |
| Ficha de recursos | Receta, instalación, tecnología, capacidad, producción pública/privada/mundial, existencias, costos, precio, faltantes y comercio. |

## Correcciones adicionales encontradas durante la revisión

- La nacionalización ahora se aplica por recurso producido o extraído. Transfiere la instalación vinculada, el inventario concreto y una proporción de trabajadores; no absorbe las demás fábricas y existencias del ministerio.
- Los formularios ministeriales conservan solamente puestos solicitados y sueldo. Nómina, insumos y obras se pagan desde el Tesoro y los topes propios de cada programa; desaparece el bloqueo duplicado por presupuesto general del sector.
- La falta de pago de funcionarios reduce la producción pública mediante una cobertura salarial explícita, evitando que trabajadores impagos produzcan a pleno.
- Los países simulados reciben dos o tres dependencias de materias primas deterministas. El país del jugador queda excluido y los faltantes entran al comercio automático y a los acuerdos existentes.
- Hierro, cobre y los demás depósitos finitos ahora alcanzan cero exactamente aunque la energía disponible sea parcial; los residuos microscópicos de partidas existentes se normalizan al cargarlas.
- Una exploración exitosa cambia a **Agotado** al consumirse las reservas de su zona, genera un aviso, puede borrarse y bloquea nuevas plantas extractivas hasta descubrir otra reserva.
- La ficha del recurso distingue **No descubierto**, **Activo** y **Agotado**. El diagnóstico conjunto público/privado evita mostrar “Falta instalación” cuando sí existe capacidad pública.
- Los acuerdos vencidos ahora quedan identificados como finalizados y pueden renovarse por su plazo original o cerrarse definitivamente. El cierre conserva el historial y no permite reactivación.
- Los resultados de exploración “Sin hallazgo” se pueden borrar individualmente; la acción rechaza campañas activas y depósitos descubiertos.
- Tutorial desplegable de Economía y deuda: explica el origen y los factores de aumento/disminución de cada valor visible, más un orden de lectura para déficit, intereses y obras detenidas.
- Programa pasivo de vivienda y refacción dentro de Infraestructura, con presupuesto, cuadrillas, materiales, suelo y caja contabilizados cada mes.
- Calendario diario persistente y ciclo mensual repartido por etapas, manteniendo un solo cobro/pago mensual por concepto.
- Web Worker local para procesar cada jornada fuera del hilo de interfaz, con fallback compatible y nuevo archivo `simulation-worker.js` precargado offline.

- Resumen de Tesoro simplificado, separando ingresos de operación, gastos cotidianos, intereses, amortización y variación real de reservas.
- Diagnóstico anticipado de obras: distingue falta de material, Tesoro, presupuesto ministerial y trabajadores disponibles, en lugar de mostrar una etiqueta genérica.
- Diagnóstico de producción por ministerio y panel fiscal con bases gravadas y efecto monetario previsto de las alícuotas.

- Reparto del espacio logístico para que los materiales intermedios no ocupen permanentemente todo el almacén y bloqueen los productos finales.
- Comprobación conjunta de insumos y dinero antes de producir: la misma caja no puede respaldar por separado varias compras incompatibles.
- Compra de insumos públicos limitada por el Tesoro y la capacidad crediticia; el stock ya propio no se compra de nuevo.
- Registro del ingreso de proveedores y costo de compradores, incluidos intercambios entre ramas privadas. Estas asignaciones no crean caja ni suman nuevamente los insumos al PBI.
- Plantas de biomasa que aprovechan residuos orgánicos o biomasa agrícola; tratamiento a precio negativo con dirección de pago correcta.
- Inversión privada en módulos enteros y escalables, limitada por recursos, suelo y caja, sin imponer el mismo techo de una fábrica a países de tamaños muy distintos.
- Servicios agregados repartidos entre proveedores públicos/privados, para no seguir abonando actividad a un sector privado completamente nacionalizado.
- Bienes durables de hogares con reposición, sin tratarlos como alimentos que desaparecen al terminar el mes.
- Migración que preserva reservas antiguas negativas, sin piso artificial de −20 MM y sin inventar un reembolso histórico.
- Caché offline específica de la versión; precarga completa antes de activarse y respaldo previo al convertir un guardado.

## Datos observados y estimaciones

La base conserva 128 países/territorios y 384 figuras reales. Los nuevos campos WDI tienen años por observación: superficie y agricultura 2023, esperanza de vida 2024, ferrocarril entre 2011–2021 y riego entre 2011–2023, según disponibilidad. No se presentan como mediciones de septiembre de 2026.

El inventario inicial de fábricas, almacenes, viviendas, tecnologías, ganado, redes sin serie y matriz energética utiliza equivalentes de escenario. Depósitos, recetas, costos y probabilidades son diseño de juego. El PBI usa valor añadido de bienes más servicios agregados; el sector financiero externo es una cuenta de contrapartida, no un sistema bancario individualizado. Las ramas educativas emplean una oferta salarial ponderada del ministerio. Estas simplificaciones están detalladas en README y FUENTES.

## Verificación de la entrega

Validación específica v7.6: cinco pruebas de cola mixta, más de 150 pendientes, niveles y prerrequisitos, avance proporcional, cobro final parcial y migración de progresos. Prueba del menú con 47 proyectos, paginación, cancelación, guardado/recarga y ancho móvil. Las 41 pruebas generales también se ejecutaron con la lógica secuencial actualizada.

Validación específica v7.5: tres pruebas de bolsa compartida y cantidades, cola FIFO con valores capturados y aplicación única, edición a velocidad 6× y equivalencia completa de 31 días entre Worker incremental y motor directo. En una partida nueva de Nauru con 24 días y el panel de recursos abierto, las tareas largas del hilo principal acumularon 1.974 ms antes y 109 ms después; las reconstrucciones completas bajaron de 24 a cero. Es una medición local en Edge, no una garantía de tiempos para todos los dispositivos o guardados.

Los resultados exactos se incluyen en `VERIFICACION-v6.json`, generado desde las ejecuciones locales. La revisión abarca:

- Pruebas de motor: dinero, deuda, nacionalización, límites físicos, población, producción, investigación, importaciones, rankings y guardado reproducible.
- Migración de un guardado v5.4 situado en noviembre de 2205, con préstamo, obra en curso y saldo negativo exacto.
- Navegación de los 16 menús, selección de Nauru, controles monetarios, préstamo/compra, guardado, recarga y modo offline en Edge.
- Vista de escritorio y móvil de 390 × 844, sin desbordamiento de página; las tablas anchas se desplazan horizontalmente dentro de su contenedor.
- Actualización real de caché v5.4 a v7.6, exportación del respaldo antiguo y reapertura offline.
- Simulación actual de 60 meses (1.826 jornadas) con 128 países: valores finitos, conciliación de dinero y recursos y empleo no superior a la población disponible. Esta prueba financia artificialmente el país del jugador para que una derrota por falta de gestión no detenga el ensayo; no prueba que una partida normal se sostenga sin intervenir.
- ZIP incremental contrastado por hash con la base preservada y aplicado a una copia nueva: el resultado debe coincidir byte a byte con la carpeta final del juego.

**Límite de validación:** aprobar conservación contable no equivale a garantizar un balance económico divertido o estable en todas las políticas y semillas. Los ensayos prolongados muestran escenarios de escasez y recesión persistentes; la calibración macroeconómica y las decisiones de la IA siguen siendo experimentales. No se certificaron otros navegadores, teléfonos físicos, uso simultáneo en varias pestañas ni publicación en GitHub.

## Uso y conservación de partidas

Aplicá todos los archivos del incremental sobre v7.5, conservando los que no vienen en el ZIP. Exportá antes tu partida. Recargá con conexión hasta ver **Motor económico v7.6** y luego continuá. No hay fecha de finalización ni derrota institucional; sigue existiendo cesación de pagos cuando la deuda supera 205% del PBI y el Tesoro está agotado.

La carpeta base anterior y los guardados de prueba se preservaron. No se publicó el proyecto ni se eliminaron archivos del usuario.
