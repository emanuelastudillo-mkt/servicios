# Pulso Global — modelo de árbol tecnológico

Referencia visual aportada por el usuario: [imagen original de árbol horizontal](referencias/arbol-tecnologico-modelo.png). Se conserva sin modificar para futuras ampliaciones. **No se copian sus nombres ni su balance**: sirve como modelo de ramas, conexiones, progresión y lectura visual.

## Disposición elegida para Pulso Global

- Lectura **vertical**, desplazándose hacia abajo: el fundamento de cada rama aparece arriba y sus tecnologías más complejas debajo. En pantallas pequeñas se reduce la sangría, sin desplazamiento horizontal obligatorio.
- Cada nodo indica el nivel logrado (0 a 4), sus prerrequisitos y uno de tres estados: **Investigada**, **Sin investigar** (requisitos completados), **Faltan otras investigaciones** (requisitos pendientes). Un proyecto en cola se señala aparte, sin alterar el estado.
- La vista **Investigaciones posibles** muestra solo tecnologías nuevas cuyos prerrequisitos ya fueron completados y que no estén en cola. Separa las **mejoras disponibles** de tecnologías existentes: investigar un nuevo nivel no vuelve a mostrar como pendiente el nivel ya investigado. Las bloqueadas y las completadas se consultan en el árbol.
- Una tecnología hija se desbloquea cuando la anterior está **completada**, no solo agregada a la cola. El laboratorio, los científicos, la educación y el presupuesto afectan la ejecución; la falta de laboratorio aparece como bloqueo operativo de una tecnología ya desbloqueada.
- El árbol muestra todo el catálogo del sector elegido (o todos los sectores), incluso los nodos completados y los lejanos. Las 124 tecnologías actuales se agrupan en 41 ramas de 8 sectores; esta estructura es extensible.

## Datos y compatibilidad

El catálogo de `catalog-v6.js` mantiene identificadores estables. Cada tecnología tiene `requires` (prerrequisitos), `sector`, `branchId` y `depth` (posición vertical). Los niveles ya guardados, colas y avances no se convierten ni se borran. La interfaz calcula el estado a partir de la partida; no añade campos al guardado.

Para una ampliación futura, primero se definirá para cada nueva tecnología: rama/sector, prerrequisitos concretos, efecto o desbloqueo, niveles máximos, coste/tiempo de investigación y tratamiento de partidas anteriores. No basta con agregar un icono al árbol: cada nodo debe tener utilidad verificable en el motor.
