# Incremental online 1.5.0

Aplicar sobre 1.4.0. Publicar la interfaz compilada en apex1000rally y actualizar el Worker conservando D1, bindings y SEASON_EPOCH. No requiere nuevas tablas, plan pago, credenciales ni migraciones SQL. No altera la beta offline ni reinicia equipos.

- Seis barras 0–100 en Inscripciones. Efectos ponderados por superficie, de −30% a +30% conjuntamente. El objetivo permanece en el servidor; ni objetivos ni multiplicadores se incluyen en APIs privadas o públicas.
- Cinco horas de preparación antes de E1, también sprints. Horario y cierre compartidos; únicamente la salida individual se retrasa si falta margen.
- Inscripción cerrada después de la largada oficial. En sprints hace falta más de una hora de margen antes de largar para completar cinco horas y salir antes de su cierre de cuatro horas. Inscribirse con cinco horas de margen permite largar a tiempo.
- Asignación y reglajes se editan hasta el inicio de la preparación. Luego quedan fijos, incluso en campamentos y al reemplazar una pieza; el reglaje corresponde al tipo de pieza, no a su ejemplar.
- Reserva de auto, kit, repuestos y empleados desde la preparación hasta el cierre máximo publicado. El personal asignado deja de trabajar en la base al comenzar. Cancelar antes de la largada libera la inscripción; reinscribirse reinicia la preparación.
- Las inscripciones anteriores sin nuevos campos mantienen su comportamiento previo, para no añadir retrasos o bonos inesperados a partidas existentes.
- Los límites de velocidad, averías, desgaste, descanso y reparación se conservan. Los BOT llegan preparados y usan valores centrales, sin conocer el óptimo.
- Se conserva el coordinador por eventos, sin consultas adicionales por segundo ni por deslizador. Cambiar una barra sólo modifica el borrador; guardar envía una única operación idempotente.

Compilar desde online: npm install y npm run build. Publicar con npm run deploy o pegar el bundle de Worker producido por wrangler deploy --dry-run --minify en el editor de Cloudflare si la publicación por CLI falla por permisos. El editor debe conservar los bindings originales. Publicar index.html, online-game.js y online.css junto al código y catálogos actuales.
