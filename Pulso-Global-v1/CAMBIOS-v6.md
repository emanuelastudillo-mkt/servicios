# Pulso Global 6.0 — incremental sobre 5.4

Fecha de entrega: 13 de septiembre de 2026. Motor jugable de gestión nacional, con balance de largo plazo experimental. No es una previsión económica ni una reproducción exacta de cada país.

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

- Reparto del espacio logístico para que los materiales intermedios no ocupen permanentemente todo el almacén y bloqueen los productos finales.
- Comprobación conjunta de insumos y dinero antes de producir: la misma caja no puede respaldar por separado varias compras incompatibles.
- Compra de insumos públicos dentro del presupuesto autorizado y la capacidad crediticia; el stock ya propio no se compra de nuevo.
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

Los resultados exactos se incluyen en `VERIFICACION-v6.json`, generado desde las ejecuciones locales. La revisión abarca:

- Pruebas de motor: dinero, deuda, nacionalización, límites físicos, población, producción, investigación, importaciones, rankings y guardado reproducible.
- Migración de un guardado v5.4 situado en noviembre de 2205, con préstamo, obra en curso y saldo negativo exacto.
- Navegación de los 16 menús, selección de Nauru, controles monetarios, préstamo/compra, guardado, recarga y modo offline en Edge.
- Vista de escritorio y móvil de 390 × 844, sin desbordamiento de página; las tablas anchas se desplazan horizontalmente dentro de su contenedor.
- Actualización real de caché v5.4 a v6, exportación del respaldo antiguo y reapertura offline.
- Simulación de 360 meses con 128 países: valores finitos, conciliación de dinero y recursos y empleo no superior a la población disponible. Esta prueba financia artificialmente el país del jugador para que una derrota por falta de gestión no detenga el ensayo; no prueba que una partida normal se sostenga sin intervenir.
- ZIP incremental contrastado por hash con la base preservada y aplicado a una copia nueva: el resultado debe coincidir byte a byte con la carpeta final del juego.

**Límite de validación:** aprobar conservación contable no equivale a garantizar un balance económico divertido o estable en todas las políticas y semillas. Los ensayos prolongados muestran escenarios de escasez y recesión persistentes; la calibración macroeconómica y las decisiones de la IA siguen siendo experimentales. No se certificaron otros navegadores, teléfonos físicos, uso simultáneo en varias pestañas ni publicación en GitHub.

## Uso y conservación de partidas

Aplicá todos los archivos del incremental sobre v5.4, conservando los que no vienen en el ZIP. Exportá antes tu partida. Recargá con conexión hasta ver **Motor económico v6.0** y luego continuá. No hay fecha de finalización ni derrota institucional; sigue existiendo cesación de pagos cuando la deuda supera 205% del PBI y el Tesoro está agotado.

La carpeta base anterior y los guardados de prueba se preservaron. No se publicó el proyecto ni se eliminaron archivos del usuario.
