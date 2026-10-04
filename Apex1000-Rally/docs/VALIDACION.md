# Validación de v0.3.3 — Home y taller

4 de octubre de 2026. Windows, Node.js 24.19.0 y Chrome mediante interacción real con los controles del juego.

## Motor y migración

64 pruebas automatizadas aprobadas, con `node --test --test-isolation=none tests/engine.test.mjs tests/management.test.mjs tests/catalog.test.mjs tests/visor.test.mjs tests/journal.test.mjs tests/workshop.test.mjs`. El mismo comando está declarado en `npm test`; en este entorno se ejecutó Node directamente.

Se verificaron capacidad de tres autos e IDs únicos; venta/canje y rechazo sin cobros parciales; desgaste sólo del activo; efecto de performance y fiabilidad; reparto 1–4/0–4, máximo cinco; pausa/reanudación conservando trabajo; mejoras hasta 100; reconstrucción, original y deterioro del potencial; reservas de piezas; devolución parcial al cancelar; validación de guardados corruptos y determinismo por bloques. Se agregó una partida producida por v0.3.2 con cuatro autos, una etapa completada y ningún mecánico: migra conservando saldo, recorrido y bienes, y vuelve a salir después de contratar.

La prueba del campeonato completo recorre ocho carreras y comprueba que autos, estado, original de piezas, asignaciones y taller se conservan en cada transición. La prueba de Home evita contar dos veces la carrera y no anuncia el calendario completo mientras se corre la última prueba.

## Navegador

Comprobados en partidas locales de QA:

- Home y taller, compras hasta tres autos, selección, venta por 31.770 cr y canje de Hilux por MINI con diferencia de 11.400 cr; saldo posterior correcto en cada operación.
- Ofertas y contratación con destino inicial en la base; reparto visible y tiempos actualizados.
- Mejora de Raptor: 11% tras una hora; al dejar cero mecánicos otra hora conserva exactamente 11%; reanudar y avanzar completa performance 55.
- Primera etapa de 450 km: Hilux activo queda en estado 99,7, Raptor y MINI de la base siguen en 100; la mejora de fiabilidad del MINI avanza 31,1% mientras el Hilux corre.
- Reparación de motor usado: estado 100 y original 96, con techo de próxima reparación 97,6. Recarga conserva métricas, asignaciones, caja y trabajos.
- Home refleja una etapa, 450 km, hito de primera parada y próxima fecha. Menús, tarjetas y controles revisados en escritorio y viewport de 390×844; sin desbordamiento horizontal global. El menú superior se desplaza dentro de su propia barra en móvil.
- Sin errores ni advertencias capturados en la consola de la partida final de QA.

Evidencia local: `qa/home-v0.3.3.png`, `qa/workshop-v0.3.3.png`, `qa/workshop-v0.3.3-mobile.png` y registros de pruebas. No se publican archivos de QA.

## Distribución y límites

El script `qa/build-workshop-incremental.py` compara hashes contra una copia de v0.3.2, crea el ZIP, lo aplica a otra copia, comprueba todos los archivos, sintaxis JS, las 64 pruebas y el catálogo. El informe local es `qa/release-v0.3.3-report.json`.

No se probó multijugador, dispositivos físicos móviles ni varios días reales de servicio. Se simula ese tiempo con el reloj del prototipo. El balance requiere más partidas antes de abrir competencia. El cambio a carreras independientes e inscripciones, cierre a 24 h y niveles con decaimiento sigue pendiente; no se afirma completado con esta entrega. Google Sheets y GitHub no se conectaron ni publicaron desde este incremental.

---

## Registro histórico anterior (v0.2)

El siguiente registro pertenece a la entrega inicial y no describe nuevas pruebas realizadas para v0.3.3.

### Verificación del prototipo inicial

Fecha: 4 de octubre de 2026. Entorno: Windows, Node.js 24.19.0, Microsoft Edge/Chromium en modo headless.

## Motor

25 pruebas automáticas aprobadas con `node --test --test-isolation=none tests/engine.test.mjs`.

Cubren la continuidad de 15 etapas, largada simultánea, espera por falta de plan, cierre de planes, determinismo con distintas divisiones del tiempo, efectos de terreno/exigencia/pilotos, límites de velocidad, diferencias de calidad y estado, compra y montaje sin duplicar piezas, presupuesto contable, reparación y descanso en paralelo, recuperación de energía, estimación con reparaciones, reservas a estado cero, averías y combustible sin dinero, desgaste/consumo, doce llegadas, premio único, guardado/importación, rechazo de datos corruptos, privacidad del snapshot público y bloqueo del avance de cliente en modo online. También recuperan el avance de rivales cuando se elige una largada pasada, comprueban la penalización de combustible impago en la primera salida y verifican el efecto de la calidad de refrigeración sobre el calor.

## Navegador

Probado mediante controles reales de la aplicación: inscripción con MINI, guardar configuración, comprar motor Endurance usado al 75%, montarlo, elegir navegante, completar planes futuros, largada, avanzar una hora, zoom, seguir un rival, volver a ruta completa, recorrer las 15 etapas, cobrar premio, recargar, exportar/importar y recuperar tiempo en modo 1×.

La partida de prueba terminó en **187,616 horas simuladas**, posición **3**, premio neto **36.000 créditos**. Es un resultado de prueba con decisiones y semilla determinadas, no una predicción para cualquier estrategia. También se comprobó la selección de una etapa tocando directamente el trazado del mapa.

Sin excepciones JavaScript ni solicitudes HTTP fallidas en ese recorrido. Verificados anchos de 390, 1440 y 1920 px sin desbordamiento horizontal global. Se revisaron capturas de inscripción, carrera, campamento y mercado; se generaron también capturas del roadbook, equipo y llegada. Los archivos locales de evidencia están en `qa/`, fuera del paquete de distribución.

## Límites de esta verificación

No se ensayó un servidor multijugador, una carrera transcurrida durante varios días de reloj real ni dispositivos físicos iOS/Android. La continuación al reabrir se verificó con una fecha de guardado controlada. El esquema SQL se ejecutó en SQLite en memoria y creó sus once tablas; esto comprueba sintaxis, no un backend online. El balance es inicial: conviene jugar estrategias variadas antes de fijar economía y probabilidades competitivas. No hay despliegue público automático ni cuenta de GitHub vinculada por esta entrega.

## Paquete estático

Comprobado desde una subcarpeta HTTP, equivalente al prefijo de un repositorio de GitHub Pages: carga de HTML/CSS, módulos, cartografía y Web Worker; inscripción, guardado y primera etapa completa, sin errores HTTP o JavaScript. El ZIP incluye el código legible, pruebas y documentación y excluye los datos de QA y herramientas locales.
