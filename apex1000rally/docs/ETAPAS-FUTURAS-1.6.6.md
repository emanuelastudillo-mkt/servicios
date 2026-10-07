# Planificación de etapas futuras · cliente 1.6.6 / Worker 1.5.1

En carreras largas se pueden configurar y guardar las etapas futuras mientras
el auto recorre otra etapa o recibe asistencia. El plan de la etapa actual queda
cerrado durante asistencia y conducción; las etapas completadas también. La
modificación se aplica al llegar al campamento correspondiente. No modifica la
conducción actual ni los reglajes de toda la carrera, que siguen bloqueados.

Si no hay un plan guardado, el motor genera al comenzar la asistencia un plan
con reparación de las seis piezas hasta su máximo recuperable, descanso del
piloto elegido hasta 100% y carga del tanque completo del auto asignado. Usa
ritmo equilibrado, exigencia normal y la sugerencia existente para el terreno;
rota entre los pilotos asignados a esa carrera. Los planes manuales existentes
se conservan, incluida la salida automática desactivada.

Las reparaciones mantienen costos, duración y pérdida de original. Un original
gastado puede impedir recuperar 100/100; no se regenera artificialmente. Si
falta presupuesto, la reparación se omite y se mantiene la asistencia de
combustible existente con deuda/penalización. El descanso completo se respeta
también si el piloto llega agotado a la primera etapa. No hay asistencia nueva
en los sprints: siguen siendo una etapa, un piloto y sin reparación o descanso.

La predicción del coordinador se invalida al guardar una decisión, conservando
su simulación por eventos. No se agregan lecturas periódicas por cada auto.
No requiere tablas nuevas, migraciones de D1 ni reinicio de cuentas o carreras.
Las partidas locales existentes incorporan el comportamiento al siguiente paso
del reloj; la beta conserva sus BOTs y almacenamiento independientes.

## Actualización

El incremental se aplica sobre el cliente 1.6.5. Copiar su carpeta
`apex1000rally/` sobre la existente. El sitio usa `online-game.js`, compilado
para online, y un hash nuevo en `index.html` para renovar la caché. `src/app.js`
se conserva como fuente offline de compilación, no como entrada online.

**También hay que desplegar el Worker 1.5.1**: desde la carpeta `online`, ejecutar
`node node_modules/wrangler/bin/wrangler.js deploy`. El cliente solo no cambia
las validaciones del servidor. No ejecutar migraciones ni reset de D1.

## Verificación

192 pruebas del juego y 64 pruebas online aprobadas. Cubren bloqueo de etapa
actual, edición de futuras durante conducción/asistencia, límites de personal
y repuestos asignados, costos y límites de reparación, descanso completo,
preservación de planes manuales y predicción reproducible de campamentos sin
plan. La compilación del cliente y el empaquetado de Wrangler también se revisan.

En navegador se probó con un equipo ficticio de una beta local: largada automática
sin plan manual, guardado de E2 mientras se conduce E1, y bloqueo del botón al
consultar E1. No se usan cuentas reales para pruebas de conducción o compras.
