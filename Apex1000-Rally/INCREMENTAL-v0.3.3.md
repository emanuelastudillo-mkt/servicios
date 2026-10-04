# Incremental v0.3.3 — Home y taller

Requiere **v0.3.2 completa**. Extraer en la raíz de `servicios`, conservando la carpeta `Apex1000-Rally/`. Agregar/reemplazar los archivos incluidos, sin borrar los demás. Subir esos cambios a GitHub y recargar con Ctrl+F5. No incluye publicaciones automáticas ni cambios a Sheets o workflows.

## Incluido

- Home con fecha y cuenta regresiva de la próxima carrera del calendario, presupuesto/deuda, recorrido, trabajos pendientes e hitos.
- Garaje de 3 unidades con compra, elección del auto activo, venta y parte de pago. Es posible tener varias unidades del mismo modelo.
- Estado independiente que se desgasta con kilómetros e incidentes; performance y fiabilidad de 50 a 100. Nuevos: 100/50/50. Mejoras de +5, más costosas y lentas al acercarse a 100.
- Mecánicos: 1–4 en carrera, 0–4 en taller, máximo total 5. Reasignación al estar detenido; no se cambia una asistencia ya empezada. Cero en el taller pausa la cola sin perder avance. Un solo mecánico inicial.
- Cola de 8 trabajos, una tarea por vez, con todos los mecánicos de la base. Presupuesto reservado al programar y devolución proporcional de lo no trabajado al cancelar. Las mejoras se aplican al finalizar.
- Reparación de repuestos del lote. `original` comienza en 100; reparar reduce ese valor y encarece/ralentiza las siguientes reconstrucciones, limitando el estado recuperable. También se aplica a las piezas reparadas en campamento.
- Guardado formato 3, motor `rally-3`; pruebas de migración, finanzas, bloqueos, personal, reloj y conservación entre carreras.

## Cómo usarlo

1. Abrir Home y luego Taller. Comprar autos desde Mercado; elegir uno para carrera antes de largar.
2. Contratar mecánicos mediante las ofertas existentes. Asignar al menos uno a carrera; enviar los adicionales a Taller para activar trabajos.
3. Programar reparación o una mejora. El plazo mostrado depende del personal actual; la cola indica la demora acumulada. Los costos se muestran antes de confirmar.
4. Usar Admin para acelerar el reloj. El taller avanza durante la carrera y la espera. En modo 1× también recupera el tiempo al reabrir.
5. Las piezas reservadas como reemplazo en planes futuros deben liberarse de esos planes para repararlas en la base. Una pieza en trabajo no se puede montar.

El auto activo no se cambia durante una carrera. Los otros autos pueden desarrollarse en paralelo. Las seis piezas instaladas forman un kit de la escudería que pasa al auto seleccionado; cada auto guarda sus tres atributos y kilometraje. No se regala otro kit al comprar un vehículo.

La venta considera estado y mejoras. Vender una unidad usada no repone stock de autos nuevos. Para vender el último auto se debe entregar como parte de pago de otro, validando el cambio y el saldo juntos.

## Guardados anteriores

Se mantiene un respaldo en el almacenamiento del navegador antes de migrar. Conviene además usar **Exportar partida** antes de actualizar. El respaldo permanece en el mismo navegador y origen.

- Los autos existentes reciben estado 100, performance/fiabilidad 50 y kilometraje observado 0: antes no había historial individual. No se inventa desgaste retrospectivo. Se conserva el recorrido del equipo.
- Las piezas conservan estado, calidad y averías; original se inicia en 100 por falta de historial de reconstrucción.
- Una partida antigua con 4 autos conserva los 4. No puede sumar otra unidad y debe vender uno para volver al límite de 3; no se elimina ninguno.
- Una partida antigua que liberó todos sus mecánicos conserva el avance. Si estaba corriendo puede completar esa etapa, pero necesita contratar uno para iniciar la siguiente. El primero contratado se asigna a carrera.
- El personal existente se reparte con el primero en carrera y el resto en el taller. Puede redistribuirse al detenerse.

## Límites

Sigue siendo single player. El campeonato con puntos aún está vigente; carreras independientes, inscripción, cierre a 24 h y nivel con decaimiento quedan pendientes. Los hitos de Home son seguimiento, sin premios nuevos. No se conectaron Google Sheets ni un servidor online en esta entrega. Los valores de rendimiento y economía son balance del juego, no especificaciones de fabricantes.
