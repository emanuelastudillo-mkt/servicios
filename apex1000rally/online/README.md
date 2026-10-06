# Tutorial offline 1.6.2

Corrección de llegada: el cambio de etapa requiere recorrer sus kilómetros. No
hay traslado automático a los cinco minutos. Combustible agotado o límite de 40
minutos cierran el intento en su posición real, con el informe correspondiente.

El tutorial incluye un mapa vectorial del recorrido virtual, seis equipos en
movimiento, posición e intervalos, zoom ×1–×16 y pantalla completa. La interfaz
del visor permanece montada durante las transiciones y funciona sin consultas
al Worker ni descarga de mapas externos.

La interfaz incorpora `tutorial/`, un simulador virtual independiente que se abre
desde «Tutorial offline», incluso sin iniciar sesión. Cinco etapas, hasta 40 min
simulados, ×1/×2/×10, pausas, guardado local y apertura sin conexión tras la primera
carga en navegadores compatibles. Una única solución, pistas y errores explicados.
No consulta el Worker ni modifica dinero, inventario, estadísticas o inscripciones.
El Worker conserva 1.5.0: esta entrega sólo publica archivos estáticos, sin SQL ni
migraciones. Ver `tutorial/README.md` y `tests/tutorial.test.mjs`.

# Apex1000 Rally Online 1.6.2

Juego: https://emanuelmkt.com.ar/apex1000rally/
API: https://apex1000-online.emanuelmkt.workers.dev

La interfaz completa (mapa, tablero, campamento, taller, mercado, personal, finanzas, inscripciones y rankings) utiliza el servidor autoritativo Worker + D1. La beta offline permanece independiente. No se admiten importación de partidas, dinero admin, reset ni aceleración online.

## Logos de carrera (interfaz 1.5.1)

32 emblemas SVG para los ocho raids y 24 sprints. Cada uno lleva la bandera del país de largada y un pictograma del terreno predominante, calculado por kilómetros de recorrido. Se muestran en home, calendario, inscripciones y encabezado del mapa. Sus descripciones accesibles incluyen país, localidad inicial y terreno. Los trazados pequeños son decorativos.

Los archivos están en `assets/races/`; datos en `data/race-logos.js` y generador en `scripts/build-race-logos.mjs` (desde la raíz). Las banderas locales de flag-icons 7.3.2 conservan su licencia MIT en `assets/race-flags/LICENSE.txt`. No hay imágenes remotas durante el juego ni consultas nuevas al Worker. Esta actualización sólo publica la interfaz; Worker 1.5.0, D1 y Sheets conservan su configuración.

## Reglajes y puesta a punto (1.5.0)

Inscripciones muestra seis barras de 0 a 100 para motor, transmisión, suspensión, neumáticos, refrigeración y frenos. Se guardan con la inscripción. El óptimo es privado, específico de cada edición y depende de superficies y clima. El efecto conjunto ponderado sobre velocidad queda entre −30% y +30%; no se multiplican seis bonos completos. Se conservan los límites de sector y los 30 km/h por avería. El centro no garantiza neutralidad.

La puesta a punto dura cinco horas, una sola vez antes de la primera etapa, también en sprints. Inscribirse con antelación programa las cinco horas anteriores a la largada; inscribirse más tarde inicia cinco horas desde ese momento y retrasa únicamente la salida del equipo. La inscripción cierra en la largada oficial; se rechaza una inscripción cuya preparación terminaría en o después del cierre.

Desde el comienzo de la preparación, la asignación y los reglajes quedan bloqueados. Los recursos se reservan desde ese comienzo hasta el límite máximo; el mecánico asignado deja de trabajar en la base. Se puede cancelar antes de la largada; reinscribirse vuelve a exigir las cinco horas. Los planes tácticos se siguen eligiendo en campamento; no cambian estos reglajes.

El contador y el tablero muestran la preparación. No agrega consultas por segundo: el coordinador despierta en los cambios de estado. Inscripciones y carreras heredadas conservan su preparación anterior y rendimiento neutro, sin imponer retrasos retroactivos. No hay migración SQL ni reset.

Ver [REGLAJES-1.5.md](REGLAJES-1.5.md).

## Arquitectura y mantenimiento

Una sala para hasta 20 directores y cinco BOT. Una sola base D1. El estado privado de cada equipo se guarda dentro del estado compartido; economía y resultados también quedan en tablas históricas. Cada operación comprueba propietario, presupuesto y stock. Las escrituras son atómicas y los reintentos conservan su clave para evitar cobros duplicados.

El sitio de GitHub Pages usa `online-game.js`, compilado desde el código original en `src/`, el catálogo `data/` y la integración `online/client/`. No editar el bundle a mano. La API aplica CORS sólo para el dominio configurado.

Desde esta carpeta, con Node.js 24 o superior:

```powershell
npm install
npx wrangler login
npm test
npm run db:remote
npm run deploy
```

La base y el Worker ya existen; no volver a crearlos. `wrangler.jsonc` contiene sus identificadores públicos. Las dos migraciones son incrementales y Wrangler registra cuáles ya aplicó. No cambiar SEASON_EPOCH para reiniciar: la fecha inicial queda persistida en D1.

Para publicar cambios visuales, copiar de `online/public/` al directorio público `apex1000rally/`: `index.html`, `online-game.js`, `style.css`, `economy.css`, `identity.css`, `online.css`, `favicon.svg` y `assets/`. Conservar los fuentes originales `src/` y `data/` junto con `online/`; no reemplazarlos por `online/public/src/`. Subir el resultado al repositorio servicios/main.

## Presupuesto inicial

30.000 créditos por nueva escudería. Niva: 16.000; saldo tras comprar: 14.000. Incluye tres pilotos y un mecánico de academia, con sueldos de 4.600 créditos/mes. Base y taller: 1.500 créditos/mes. Al comprar el auto inicial el servidor exige conservar esos 6.100 créditos; quedan 7.900 de margen operativo con el Niva. Los vehículos se muestran de menor a mayor precio. El cambio afecta a nuevas escuderías; los saldos ya guardados permanecen como están.

## Acceso

Passkeys ES256 mediante SimpleWebAuthn. El dispositivo verifica al usuario con PIN, huella o gestor de credenciales; esos datos no llegan al juego. D1 guarda la clave pública y desafíos de cinco minutos, consumidos una sola vez. Las sesiones duran siete días; D1 almacena sólo su hash. En GitHub Pages el token se guarda en sessionStorage, no en el almacenamiento persistente localStorage; abrir otra pestaña puede requerir ingresar nuevamente. En mismo origen se utiliza además cookie HttpOnly/Secure.

Los endpoints antiguos de usuario/contraseña devuelven 410 en producción. AUTH_MODE=password-test es exclusivo de pruebas automatizadas; nunca habilitarlo en el Worker publicado. AUTH_PEPPER no es necesario para passkeys.

El email no se verifica ni permite recuperar una cuenta. La primera versión admite una passkey por cuenta: usar un gestor sincronizado. No perder esa credencial. La prueba del autenticador físico de cada usuario requiere su intervención.

## Free y consumo

Se mantiene costo cero. Worker + D1 incorpora un coordinador Durable Object SQLite,
disponible en Free, con alarmas persistentes para el siguiente evento. Se quitó el
cron de cada minuto; queda una recuperación diaria a las 00:00 UTC. D1 no cambia
ni se reinicia. Ver [EVENTOS.md](EVENTOS.md) para detalle, instalación y recuperación.

El mundo sólo se guarda al cambiar una fase/etapa, terminar un trabajo, cerrar una
carrera, vencer una oferta o contrato, liquidar sueldos o confirmar una acción.
El visor consulta cada 60 segundos y pausa oculto; mientras la sala vive en memoria,
esas consultas no leen ni escriben el mundo en D1. La sesión todavía se valida en
D1; rankings e histórico contable consultan sus tablas. No son cero requests:
20 navegadores siempre visibles generan unas 28.800 consultas por día, más acciones,
preflight, alarmas de eventos y una recuperación diaria.

Las predicciones usan el mismo motor y RNG por vehículo; no revelan resultados
futuros al cliente. Las configuraciones se bloquean durante la etapa y asistencia,
y se editan en el campamento o antes de largar. La beta mantiene su flujo independiente.
Una interrupción larga se recupera en tramos, con 503 y reintento cuando aún hay atraso.

La integración real con Wrangler local se comprobó con el binding DO y D1. La
prueba de 20 directores y 40 participaciones calculó el siguiente evento en unos
0,4 segundos en Node local: no equivale a una prueba sostenida con personas reales.
Se conservan los límites de 20 directores, 1,8 MB por estado, 100 parámetros por
sentencia y 40 sentencias por lote. Revisar métricas antes de ampliar.

## Persistencia

- users / sessions: identidad, email privado y sesiones.
- passkeys / passkey_challenges: claves públicas y desafíos de acceso.
- world: vehículos, piezas, dinero, deuda, empleados, contratos, talleres, inscripciones, stocks y subastas.
- snapshots: proyección pública, sin inventarios, salarios ni finanzas rivales.
- results: resultados permanentes por edición, circuito, director, modelo y versión de reglas.
- ledger: historial económico paginado, importes en centésimas de crédito.
- receipts: respuestas idempotentes; auth_limits: protección de acceso.

El estado compacto conserva 120 movimientos recientes y tres carreras cerradas recientes. Los históricos completos de resultados y economía siguen en SQL. El límite preventivo de estado es 1,8 MB.

## BOT y carreras

Polvo Sur (nivel 1), Ruta Vieja (1), Pampa Taller (2), Horizonte Amateur (3), Cóndor Club (5). Al comenzar cada carrera se sortean estado de auto y piezas, forma, moral y energía mediante semilla privada persistida. Al cerrar se restauran. Las cinco identidades son permanentes; en pruebas simultáneas corren instancias independientes.

Inscripción previa obligatoria. Los ocho raids tienen 15 etapas (dentro del rango 12–16) y un límite de 192 horas: ocho días. Sprints cada 48 horas, una etapa y hasta cuatro horas. Cierre al terminar todos, al máximo publicado o 24 horas después de la primera llegada, lo que ocurra antes. Se ordena por distancia a quienes no llegaron y se pagan premios una sola vez. Rankings por circuito y modelo, sin puntos de campeonato.

Cada inscripción asigna una unidad del garaje, 1–3 pilotos y 1–4 mecánicos para un raid; un sprint exige exactamente un auto, un piloto y un mecánico. El formulario propone dos pilotos para los raids, dejando el tercero para un sprint. Siempre exige las seis piezas de un kit propio; los repuestos adicionales son opcionales. El servidor compara los intervalos máximos de las inscripciones y rechaza compartir cualquier auto, persona o pieza entre carreras superpuestas. Una carrera cerrada antes conserva su reserva hasta el límite publicado. Se puede modificar la asignación o cancelar antes de largar. No se regalan recursos adicionales.

Los avances, planes, combustible, averías y paradas se guardan por inscripción. Los autos, piezas y empleados existen una sola vez en el patrimonio del director. La caja, deuda, nómina y nivel son comunes; el día 1 se paga una sola nómina. Los pilotos enviados de relevo descansan a 0,1× en ruta y a 1× en campamento; el piloto que queda en la base descansa a 1×. El taller utiliza únicamente sus mecánicos disponibles. El visor permite alternar entre el raid y el sprint. La migración del estado JSON es automática, sin reinicios ni nuevas tablas D1.

La prueba anterior simuló 193 horas, 20 directores con dos inscripciones y diez
instancias BOT en el pico: 60 resultados y estado menor a 1,34 MB. El procesamiento
directo en Workers Free mostró picos de 17–33 ms; desde 1.3.0 el coordinador DO
recibe el cálculo y las alarmas, usando un margen de CPU mayor. La validación
sostenida remota sigue siendo distinta de estas pruebas sintéticas.

## Catálogos

El servidor consume `data/catalog.js` al desplegar. La sincronización diaria de Sheets del directorio antiguo no despliega automáticamente este Worker. Para aplicar cambios al online hay que generar el catálogo, compilar y desplegar Worker y frontend juntos. Automatizar ese despliegue requiere un secreto de servicio Cloudflare en GitHub Actions; no se exportan las credenciales OAuth personales de Wrangler. No prometer actualización diaria online hasta configurar esa integración.

## Pruebas locales

La beta offline es la versión para partidas de prueba aceleradas. Para pruebas del servidor: `npm run db:local`, configurar RP_ID=localhost y AUTH_ORIGINS/ALLOWED_ORIGINS=http://localhost:8787 mediante vars locales, compilar con APEX_API_URL=http://localhost:8787 y ejecutar Wrangler dev en ese origen. No publicar esa compilación. La base de Wrangler es local y separada de D1 remota.

Nunca publicar node_modules, .wrangler, .dev.vars, .env, claves o archivos de qa. Las credenciales de usuarios reales tampoco deben copiarse a fixtures.

## Catálogo online 1.4

Ocho vehículos con pesos operativos de juego diferenciados, 18 modelos de repuestos de marca y especialistas activos por pieza. Ver [CATALOGO-1.4.md](CATALOGO-1.4.md). La fuente editable sigue siendo Google Sheets y el presupuesto de equipos nuevos es 30.000 cr.
