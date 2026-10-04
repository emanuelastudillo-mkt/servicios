# Verificación del prototipo

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
