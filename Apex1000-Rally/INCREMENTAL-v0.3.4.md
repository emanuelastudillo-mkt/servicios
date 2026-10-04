# Incremental v0.3.4 — Zoom, seguimiento y dinero Admin

Requiere el juego v0.3.3. Descomprimir el ZIP en la raíz del repositorio `servicios` y conservar la carpeta `Apex1000-Rally`. Agregar/reemplazar los archivos incluidos y recargar con Ctrl+F5. No borrar otros archivos. Las partidas guardadas siguen siendo compatibles.

- Zoom máximo 2000×, también en pantalla completa. Botones, rueda y deslizador usan el mismo límite. Cambiar de equipo conserva el aumento.
- El panel del visor actualiza los datos sin recrear el selector de equipo ni las opciones de un menú activo. Las reconstrucciones automáticas por cambios de etapa se aplazan mientras se edita un control; la telemetría sigue en marcha.
- Admin: importe editable, botón “Inyectar dinero a tu equipo”, guardado inmediato y movimiento identificado en las finanzas. Sólo el jugador recibe el dinero. Se admiten enteros entre 1 y 10.000.000 cr por operación, hasta 100.000.000 cr de saldo; sin superar los 5.000 movimientos admitidos por el guardado. No es un premio ni una compra. Se bloquea en modo online o con `ADMIN_ENABLED = false`.
- Escape sobre un control evita que el manejador del juego cierre el mapa ampliado; salir de pantalla completa actualiza el texto del botón.

Archivos: `src/app.js`, `src/visuals.js`, `src/admin-ui.js`, nuevos `src/live-ui.js` y `src/admin-commands.js`, `src/catalog.js`, `style.css`, `package.json`, `tests/visor.test.mjs`, nuevo `tests/admin.test.mjs`, `README.md` y este documento. El ZIP incluye un manifiesto con hashes. No modifica catálogos, precios, planillas ni workflows.

Validación: 67 pruebas automáticas; comprobación en Chrome del zoom 2000×, cambio y seguimiento de rivales con reloj 3600×, continuidad del foco durante ticks y cambios de fase, inyección y saldo tras recargar. Una regresión local de 100 actualizaciones verifica identidad del selector y sus opciones, conservación del foco, telemetría viva y conservación del importe escrito.

La ampliación usa la cartografía y el trazado existentes; no agrega nuevos datos geográficos. Las reglas de competición pendientes de v0.3.3 siguen pendientes.
