# Apex1000 Rally — World Raid v0.3.2

Juego estático para navegador, single player, con 11 equipos rivales simulados. Se ejecuta en GitHub Pages o con `node server.mjs` y no necesita instalar dependencias para jugar.

## Esta entrega

El incremental v0.3.2 agrega una barra **Admin** para todos los controles de tiempo, próxima parada y próxima carrera, y una **Bitácora** con aspecto de cuaderno y letra manuscrita. Cada etapa registra una o dos notas basadas en sus averías, temperatura, fatiga, combustible, configuración e incidentes, con consejos para preparar la siguiente. Las notas anteriores a esta actualización no se inventan. Se conserva la compatibilidad con partidas anteriores.

Esta entrega incluye el avance solicitado mientras se definen las nuevas reglas. **Todavía se mantiene el campeonato con puntos de v0.3.1.** Siguen pendientes las carreras independientes, inscripción por carrera, corte a las 24 horas del primer finalista, cuenta regresiva entre carreras y progresión de nivel con decaimiento, logros e hitos. No se incluyen como funciones terminadas.

La barra Admin se adapta a móvil y pantalla completa. “Próxima carrera” se habilita cuando todos los equipos terminaron, según las reglas actuales; “+24 horas” permite avanzar mientras se espera. Para ocultar toda la barra, configurar `ADMIN_ENABLED = false` en `src/admin-ui.js`; se bloquean los controles de avance del prototipo y se usa el reloj a 1×. Esto no reemplaza la autoridad de un servidor futuro.

## Visor y funciones existentes

El visor conserva el zoom hasta 120×, escudos de tamaño constante, posición y distancias al anterior/siguiente, alertas rojas pulsantes por averías y amarillas por riesgo elevado. Las 120 etapas tienen curvas y desvíos de diseño. Los vehículos recorren la misma geometría que se dibuja; los kilómetros deportivos y el balance de simulación se conservan.

Para acercar: botones, rueda sobre el punto de interés o deslizador de 1× a 120×. “Seguirme” enfoca al equipo a 12× y conserva aumentos mayores; “Ver ruta” vuelve a la vista general. Los escudos muestran el puesto. En pantalla completa, el panel detalla los kilómetros de separación según el orden de carrera; si ambos equipos terminaron, también indica la diferencia de tiempo.

La alerta amarilla de pieza aparece desde un 8% estimado de avería en la próxima hora de conducción. Usa la fórmula real del simulador y supone estado, exigencia y temperatura constantes; no es una garantía del resultado. Las reservas mantienen riesgo de avería cero. Temperatura superior a 112 °C activa aviso amarillo y superior a 122 °C activa rojo. Las averías existentes se señalan en rojo. La animación respeta la preferencia de movimiento reducido del dispositivo.

Los trazados detallados son especiales ficticias entre localidades reales; no son carreteras verificadas. Colores: azul para asfalto, ocre para ripio, amarillo para arena, coral para piedras y verde para montaña.

- Campeonato de 8 carreras y 120 etapas, entre 9.300 y 12.600 km por carrera. Primera prueba: Andes, 10.240 km. Largadas compartidas y fijas, con descanso y avance independientes por equipo.
- 4 vehículos reales ilustrados; 54 ofertas de piezas nuevas y usadas con precio y stock. Las piezas y los autos adquiridos se conservan durante el campeonato.
- 6 pilotos y 8 mecánicos ficticios en el catálogo. Máximo 3 pilotos y 5 mecánicos por equipo. Ofertas temporizadas, depósito, devolución, salario por carrera y titularidad exclusiva dentro de la partida.
- 100 escudos, nombre de equipo editable y 24 imágenes originales generadas con IA, optimizadas en WebP.
- Mapa mundial local, seguimiento de rivales, zoom y pantalla completa con vehículo, piloto, combustible, temperatura y piezas.
- Guardados anteriores v0.2 migrados, conservando avance, presupuesto y piezas. Se conserva un respaldo local previo a la migración.
- Catálogo administrativo: XLSX con guía y 7 hojas, CSVs, importador validado y workflow de GitHub preparado.

**Pendiente externo:** no se crearon aún las hojas nativas de Google Sheets ni se conectaron al repositorio. El usuario eligió reactivar el conector de Drive. `config/sheets.json` permanece desactivado; el juego utiliza su catálogo incluido y funciona independientemente de ese paso.

## Jugar localmente

Con Node.js 22 o superior: `node server.mjs`. Abrir http://127.0.0.1:4182. No abrir `index.html` directamente con `file://`, porque utiliza módulos ES y un Web Worker.

1. Elegir vehículo, nombre y largada. La inscripción incluye tres pilotos y una mecánica; se descuentan vehículo y primeros sueldos.
2. En Equipo, elegir escudo. Para contratar otro piloto primero hay que liberar un cupo; se necesita al menos un piloto.
3. En Mercado, comprar o enviar ofertas. El plazo inicial es de seis horas del reloj de simulación. Ganar paga el primer sueldo con el depósito; perder o cancelar lo devuelve.
4. En Roadbook, estudiar terreno, temperatura y distancias. Campamento permite guardar el plan de cada etapa. Se pueden completar automáticamente los planes faltantes.
5. En la barra Admin, usar el reloj o “Próxima parada”. El mapa permite seguir cualquier participante y entrar en pantalla completa; Escape cierra esa vista. Bitácora muestra las observaciones de las etapas recorridas desde la actualización.
6. Al llegar todos a meta, Campeonato cierra los puntos y se habilita “Próxima carrera” en Admin. Se cobran los siguientes sueldos. Los premios de temporada se pagan una sola vez tras la octava prueba; este sistema sigue vigente hasta la próxima modificación.

## Publicación e incremental

El incremental **v0.3.2 requiere v0.3.1**. Descomprimir en la raíz del repositorio `servicios`, conservando la carpeta `Apex1000-Rally/`, y agregar o reemplazar sólo los archivos incluidos. No borrar los demás. Este ZIP no incluye cambios en workflows ni en la conexión de Sheets. Después de subirlo, recargar con Ctrl+F5. Ver `INCREMENTAL-v0.3.2.md` para el contenido y los límites de esta entrega.

Para subir la carpeta completa, conservar `src/`, `data/`, `assets/`, `style.css` e `index.html`. La carpeta `qa/` contiene respaldos y verificaciones locales y no debe publicarse. No se eliminaron los archivos de QA que ya existían en la versión publicada.

## Validación

`npm test` ejecuta 49 pruebas de simulación, desgaste, energía, presupuesto, ocho carreras, premios, contratos, reservas, stock, migración, lectura CSV, visor y bitácora. `npm run catalog:check` valida los CSV locales sin modificar el catálogo. No se requieren dependencias npm para estas pruebas. El ZIP v0.3.2 se aplicó sobre una copia de v0.3.1 y se ejecutaron las mismas pruebas sobre el resultado.

## Alcance

Modelos de vehículos y localidades reales; rendimiento comparativo, salarios, stock, precios, premios, condiciones de terreno y rutas deportivas son parámetros ficticios. Las imágenes son ilustraciones generadas, no fotografías oficiales. Los retratos representan personajes inventados. No se reproduce el reglamento Dakar ni se ofrece navegación vial.

`src/worker.js` pertenece al navegador. La arquitectura del servidor futuro se documenta en `docs/ONLINE.md` y `docs/ONLINE-MERCADO.md`; no hay multijugador, login ni adjudicación entre jugadores reales en esta versión.
