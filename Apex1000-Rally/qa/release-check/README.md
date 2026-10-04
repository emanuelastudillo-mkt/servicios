# Apex1000 · Endurance Rally

Prototipo **single player**, en español, de gestión de un rally de resistencia. Corre en el navegador y se puede publicar como sitio estático en GitHub Pages. No requiere cuentas, claves, base de datos ni instalación de dependencias para jugar.

## Jugar

Con Node.js 22 o posterior, desde esta carpeta:

```sh
node server.mjs
```

Abrir **http://127.0.0.1:4182**. El servidor es sólo para desarrollo local. También sirve cualquier servidor de archivos estáticos. Abrir `index.html` con doble clic (`file://`) no es compatible con los módulos, el mapa y el worker.

1. Elegir vehículo, nombre del equipo y horario de largada. La partida empieza pausada.
2. En **Campamento**, preparar y **guardar** el plan de la primera etapa.
3. Usar **Ir a la largada**, **1×**, una velocidad acelerada o **Mi próxima parada**.
4. Estudiar el **Roadbook**, comprar piezas en **Mercado** y asignar reparaciones, repuestos, combustible y descanso en cada plan.
5. Configurar etapas futuras por adelantado. **Completar planes faltantes** propone reparación completa, pilotos rotativos, descanso hasta 100% y tanque lleno; conserva los planes existentes.
6. Llegar a Santiago para recibir el premio y exportar el resultado.

## Publicar en GitHub Pages

El ZIP de entrega contiene esta aplicación lista para subir, sin los datos de pruebas locales.

1. Crear un repositorio y subir el contenido del ZIP a su raíz. `index.html` debe quedar en la raíz del repositorio, no dentro de otra carpeta.
2. Conservar las carpetas `src` y `assets`, `style.css`, `favicon.svg` y `.nojekyll`.
3. En **Settings → Pages**, elegir **Deploy from a branch → main → / (root)**.
4. Abrir la dirección que indique GitHub una vez completado el despliegue.

[Instrucciones oficiales de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

Todas las rutas son relativas. Admite la dirección habitual `https://usuario.github.io/repositorio/`. No hay un paso de compilación. El material de `docs` y `tests` puede permanecer en el repositorio, pero no es necesario para jugar. `qa/` guarda verificaciones locales y está excluido de Git y del ZIP.

## Qué incluye

- **15 etapas y 10.240 km**: Argentina, Bolivia y Chile, desde Buenos Aires hasta Santiago. Localidades y cartografía reales, trazado deportivo ficticio.
- **Una largada compartida** y doce equipos: vos y once rivales simulados. Cada uno corre, repara y descansa a su ritmo; pueden estar en distintas etapas.
- **Cuatro vehículos**: Toyota GR DKR Hilux EVO, Ford Raptor T1+, Dacia Sandrider y MINI JCW Rally 3.0i. Autonomía y modificadores diferentes.
- **180.000 créditos iniciales**, incluyendo inscripción y uso del vehículo. Compras, combustible y taller se descuentan durante toda la prueba. Premios únicamente al llegar a meta.
- **Seis componentes**: motor, transmisión, suspensión, neumáticos, refrigeración y frenos. Tres calidades comerciales y estado de compra de 100%, 75% o 50%.
- **Una reserva gratis por componente**, siempre conservada en el vehículo o el inventario. Nunca se avería; su rendimiento cae con el desgaste.
- **Tres pilotos** con energía propia: técnica, velocista y navegante. Los relevos recuperan energía mientras otro conduce.
- **Plan por etapa**: piloto, ritmo, exigencia, altura, presión de neumáticos, transmisión, refrigeración, combustible, descanso y acción sobre cada pieza.
- **Asistencia en paralelo con descanso**: el trabajo mecánico y la carga se suman entre sí; la espera total es el máximo entre ese trabajo y el descanso elegido. Nunca se obliga a dormir más de lo necesario para llegar al 100%.
- **Mapa 2D** con ruta completa, arrastre, zoom, selección de tramos y seguimiento de cualquier equipo.
- **Guardado local**, exportación/importación JSON y resultado final con tiempos por etapa y movimientos del presupuesto.

## Tiempo y continuidad

La largada se guarda como fecha UTC y se muestra en la hora local del navegador. Cada plan se cierra al comenzar su asistencia; los planes futuros siguen editables. Si falta un plan, ese equipo espera mientras el reloj y los rivales siguen avanzando.

En **1×**, al reabrir se recupera el tiempo transcurrido desde el último guardado. En modo pausado no transcurre tiempo. Las sesiones aceleradas vuelven a abrirse pausadas. El motor usa pasos de 30 segundos simulados; por eso en 1× el progreso visible se actualiza por esos intervalos. **Mi próxima parada** pausa el prototipo al completar una etapa del jugador. Cada avance se limita a 30 días y ese botón a 100 horas por pulsación.

Las reparaciones sin presupuesto se omiten. Si una pieza sigue averiada se monta su reserva disponible. Sin combustible, la asistencia permite continuar con **4 horas de demora y 40% de recargo**; lo no financiable queda como deuda a descontar del premio. Si el premio no alcanza, el saldo permanece visible. Es una regla de continuidad del prototipo, pendiente de balance competitivo.

La asistencia de la primera etapa se considera preparación previa sin tiempo de carrera; sí paga sus costos. Una asistencia por combustible impago conserva la penalidad de cuatro horas también en la primera salida. Las piezas quedan reparadas o intercambiadas al comenzar el servicio, pero el vehículo no sale hasta cumplir la espera. Los trabajos mecánicos se ejecutan en serie y los pilotos descansan en paralelo. Los planes son órdenes, no reservas de dinero: el presupuesto y las piezas disponibles se revisan al ejecutarlos.

## Realismo y límites

El modelo conecta terreno, calor, altura, combustible transportado, estado de piezas, energía, configuración y riesgo. Es **una simulación estratégica**, sin física completa de neumáticos, dinámica vehicular ni telemetría de fabricantes. Los coeficientes comparativos, costos, desgaste y probabilidades son de diseño, no mediciones de estos vehículos.

Se eligió una modalidad ficticia de **preparación libre**: hay sectores de asfalto que permiten alcanzar 250 km/h y un modo de emergencia de 30 km/h. No pretende reproducir la homologación Dakar; por ejemplo, X-raid publica 170 km/h como máximo limitado del MINI. La ruta une localidades reales mediante geometría simplificada: no es un recorrido oficial ni instrucciones para conducir por caminos reales.

Los consumos y tiempos del campamento son estimaciones con el estado actual y las acciones elegidas. Las etapas futuras pueden llegar con un estado distinto; durante el recorrido, desgaste, fatiga e incidentes alteran los resultados. Ni temperaturas ni altitudes son pronósticos o perfiles GPS medidos.

## Preparación para online

**Esta versión todavía no tiene multijugador.** GitHub Pages aloja el cliente single player; no ejecuta un servidor de carreras. El `src/worker.js` incluido es un **Web Worker local del navegador**, que evita bloquear la interfaz al acelerar. No es un Cloudflare Worker ni sincroniza usuarios.

El motor está separado de la interfaz, usa azar determinista por equipo y produce `publicSnapshot(state)` con posiciones públicas sin planes, dinero, piezas o semilla. Se incluye el contrato y un esquema inicial de tablas en [docs/ONLINE.md](docs/ONLINE.md) y [docs/schema.sql](docs/schema.sql). La etapa futura necesita autenticación, reloj y simulación autoritativos en servidor, validación transaccional de órdenes y sincronización del visor. El guardado editable de este prototipo no ofrece protección contra trampas.

## Archivos

| Archivo                                       | Función                                                  |
| --------------------------------------------- | -------------------------------------------------------- |
| `index.html`, `style.css`                     | Entrada y diseño adaptable                               |
| `src/app.js`                                  | Interfaz, comandos, persistencia y navegación            |
| `src/catalog.js`                              | Vehículos, piezas, pilotos, economía y coeficientes      |
| `src/route.js`                                | Etapas, superficies y posiciones geográficas             |
| `src/engine.js`                               | Motor determinista independiente del DOM                 |
| `src/worker.js`                               | Ejecución del motor fuera de la interfaz                 |
| `src/storage.js`                              | Validación de partidas importadas                        |
| `src/visuals.js`, `assets/south-america.json` | Visor SVG y cartografía sin servicios externos           |
| `tests/`                                      | Pruebas del motor y recorrido de navegador               |
| `docs/`                                       | Diseño del modelo, fuentes y próxima arquitectura online |

## Verificación

Pruebas del motor, sin instalar paquetes, con Node.js 24:

```sh
node --test --test-isolation=none tests/engine.test.mjs
```

Pruebas de navegador opcionales: instalar `playwright`, instalar Chromium y ejecutar `node tests/browser.cjs` con el servidor abierto. Se admiten `PLAYWRIGHT_MODULE`, `BROWSER_PATH` y `TEST_URL` para un navegador o entorno ya instalado. El script deja capturas y un informe en `qa/`. Ver el alcance comprobado en [docs/VALIDACION.md](docs/VALIDACION.md).

Se conserva el prototipo de F1 en sus carpetas anteriores. Las partidas de F1 no son compatibles con esta nueva carrera.

## Créditos

Cartografía: **Natural Earth**, dominio público. Localidades: **GeoNames**, CC BY 4.0; coordenadas seleccionadas y geometría deportiva creada para el juego. Ilustraciones SVG propias y simplificadas, sin fotografías ni logos de fabricantes. Marcas y modelos se usan como referencia. Ver [docs/FUENTES.md](docs/FUENTES.md).
