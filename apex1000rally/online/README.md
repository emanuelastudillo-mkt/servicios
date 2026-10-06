# Apex1000 Rally — Worker + D1 (online 1.0)

Este paquete entrega el servidor autoritativo, la migración SQL y una consola web para verificar cuentas, inscripciones y rankings. Está preparado para una sala de hasta 20 directores humanos y cinco escuderías BOT. La interfaz completa del prototipo (mapa, tablero y mercado) todavía debe conectarse a esta API; la consola incluida permite comprobar el backend desde el navegador.

Las pruebas locales del juego se hacen en **Apex1000-Rally-beta**, una copia offline con su propio guardado. El servidor online rechaza importaciones, aceleración, reset y dinero admin.

## Publicar: una vez

Necesitás Node.js 24 o superior, npm y una cuenta Cloudflare. Conservá juntos `online/`, `src/` y `data/`: el Worker reutiliza las reglas del juego, no las descarga de GitHub.

1. Abrí una terminal en `online` e instalá/iniciá sesión:

```powershell
npm install
npx wrangler login
npx wrangler d1 create apex1000-online
```

2. Copiá el `database_id` que devuelve Cloudflare en `wrangler.jsonc`, reemplazando `REEMPLAZAR_CON_ID_DE_D1`. Hay **una sola base**. No crees una base por jugador.
3. En ese archivo ajustá `SEASON_EPOCH` a la primera largada futura, UTC y con segundos `00`. La fecha de ejemplo es 7/10/2026 a las 00:00 de Argentina (`2026-10-07T03:00:00Z`). `MAX_PLAYERS` limita los humanos; los cinco BOT no ocupan esos cupos. Una vez creada la sala, su época queda guardada: cambiar la variable no reinicia la competencia.
4. Generá una clave aleatoria con este comando y guardala en tu gestor de contraseñas:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
npx wrangler secret put AUTH_PEPPER
```

Pegá esa clave cuando Wrangler la solicite. Nunca la pongas en GitHub. Cambiarla sin una migración invalida las claves existentes de los jugadores.

5. Aplicá el esquema y publicá:

```powershell
npm run db:remote
npm run deploy
```

6. Abrí la URL HTTPS que devuelve Wrangler. Esperá el primer cron (aproximadamente un minuto), creá una cuenta y comprobá saldo, inscripción y cinco BOT. Para integrar la interfaz, alojá el frontend en el **mismo origen** del Worker: este paquete usa cookies y no habilita CORS entre dominios.

El namespace `10001` del límite de acciones debe ser exclusivo de esta aplicación dentro de tu cuenta; cambialo si otra aplicación ya lo utiliza. No requiere crear otro servicio.

Para esta simulación recomiendo Workers Paid por su margen de CPU; no se ha verificado carga en producción ni un costo mensual definitivo. Consultá [límites actuales](https://developers.cloudflare.com/workers/platform/limits/) y [precios](https://developers.cloudflare.com/workers/platform/pricing/).

## Probar Worker y D1 localmente

Desde `online`:

```powershell
npm install
Copy-Item .dev.vars.example .dev.vars
# Editar AUTH_PEPPER dentro de .dev.vars: clave local de al menos 32 caracteres.
npm run db:local
npm run dev -- --port 8787 --test-scheduled
```

Abrí `http://127.0.0.1:8787/`. La base local queda en `.wrangler` y no se sube a GitHub. El cron no se ejecuta automáticamente en Wrangler dev: para probarlo, visitá `http://127.0.0.1:8787/__scheduled?cron=*+*+*+*+*`. Esa ruta pertenece al entorno de desarrollo de Wrangler; no existe en el Worker publicado.

No publiques `.dev.vars`, `.wrangler`, `node_modules` ni bases de pruebas. El ZIP no los incluye. Para pruebas del juego completo utilizá la beta independiente, con aceleración y herramientas admin.

## Consumo y funcionamiento

- Un cron por minuto procesa internamente pasos de 30 segundos para toda la sala. No hay una petición por auto, pieza, piloto ni sector. El tiempo sigue avanzando aunque nadie tenga el juego abierto.
- Cada tick guarda una fila compacta de estado y una proyección pública; sólo agrega los movimientos y resultados nuevos. Los comandos también actualizan estas proyecciones. `D1.batch` los agrupa en una transacción. [Documentación oficial](https://developers.cloudflare.com/d1/worker-api/d1-database/).
- Cada navegador visible consulta su estado completo cada 60 segundos: dos consultas SQL (sesión + sala). Oculto deja de consultar; al volver refresca. No hay WebSockets ni consultas por atributo.
- Con 20 jugadores conectados las 24 horas: **28.800 consultas HTTP/día**, más 1.440 ejecuciones cron y acciones/login. Es un cálculo de frecuencia, no una medición de facturación. Los índices, resultados y movimientos generan escrituras adicionales.
- La proyección pública usa caché de 30 segundos. Reduce lecturas D1; no elimina invocaciones HTTP. Las lecturas privadas no se cachean.
- Atrasos se recuperan en bloques de hasta diez minutos por ejecución. Si una acción encuentra más atraso, conserva el avance y devuelve 503: reintentar con la misma clave después de recuperar. Una interrupción prolongada puede necesitar varias ejecuciones; no se promete recuperación instantánea.
- Control de revisión evita que dos compras pierdan cambios. `Idempotency-Key` impide cobrar otra vez el mismo comando. Las ofertas de empleados son globales y se adjudica la mejor al vencer; empate favorece la primera. No hay ofertas ficticias de los BOT.

## Qué se conserva en D1

| Tabla               | Contenido                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`, `sessions` | Director, email, hash de clave y sesiones con vencimiento.                                                                                                     |
| `world`             | Estado privado de sala: hasta 3 autos/equipo, características y daños, piezas/lote, dinero/deuda, personal/contratos, taller, inscripciones, stock y subastas. |
| `snapshots`         | Posiciones y datos públicos, sin inventarios privados ni emails.                                                                                               |
| `results`           | Historial persistente por circuito, edición, director, vehículo utilizado y versión de reglas.                                                                 |
| `ledger`            | Movimientos económicos, importes en centésimas de crédito y paginación.                                                                                        |
| `receipts`          | Respuestas a comandos para reintentos sin duplicar operaciones.                                                                                                |
| `auth_limits`       | Límite persistente de intentos de acceso.                                                                                                                      |

La sala tiene límite preventivo de **1,8 MB** por estado. Se conservan pocas carreras cerradas en esa fila; resultados y economía completos siguen en tablas históricas. La prueba de seis horas con 20 humanos y cinco BOT ocupó menos de 500 KB. Si crecen los inventarios o la cantidad de inscripciones muy lejanas, habrá que normalizar o dividir el estado antes de ampliar la sala. Los recibos se conservan: no vencen silenciosamente y no permiten repetir una compra antigua.

## Los cinco BOT

Polvo Sur (nivel 1), Ruta Vieja (1), Pampa Taller (2), Horizonte Amateur (3) y Cóndor Club (5). Identidades estables, dos Niva, un MINI y dos Hilux. Sus pilotos y performance son mayormente modestos. No son cinco clones iguales.

Al comenzar **cada carrera** se sortean estado del auto y piezas, energía, forma y moral mediante una semilla privada guardada en D1. Se sortea una sola vez y todos ven el mismo resultado; recargar el navegador no cambia el sorteo. Al cerrar se restauran vehículo, piezas y energía. El historial registra el estado previo a esa asistencia. En carreras simultáneas actúan como participantes virtuales independientes con las mismas cinco identidades.

Las carreras se cierran al terminar todos, al máximo publicado o a las 24 horas del primer finalista, lo que ocurra antes. Pendientes se ordenan por distancia. Las inscripciones bloquean el intervalo máximo aunque se llegue antes. Los cinco BOT ocupan puestos y pueden ganar; el catálogo actual paga hasta el puesto 12, puestos posteriores reciben cero. Esto se puede ajustar en el catálogo de premios.

El personal inicial es una academia exclusiva por equipo (3 pilotos y 1 mecánico); las personas del mercado son únicas entre jugadores. No se duplica un empleado compartido al crear nuevas cuentas.

## Catálogos, GitHub y mantenimiento

El Worker consume `data/catalog.js`. Los CSV/Sheets son la fuente editorial, **no una consulta desde cada navegador**. La sincronización diaria existente debe regenerar ese archivo en GitHub; luego hay que desplegar el Worker para incorporar cambios. Este paquete no configura tu cuenta ni añade un despliegue automático sin credenciales. El servidor detecta revisiones nuevas sin restaurar stock consumido; sólo inicializa stock de productos nuevos.

Una carrera congela el catálogo al largar para sus premios y reglas de piezas. Cambios de código de física/trazados requieren esperar los cierres y cambiar `RULES_VERSION`; el servidor actual no conserva motores antiguos dentro de un despliegue. Los récords se filtran por versión de reglas. La beta empaquetada es una foto de este catálogo y no se actualiza sola.

Hacé una copia antes de cada migración:

```powershell
npx wrangler d1 export apex1000-online --remote --output backup-apex.sql
```

No hay migraciones destructivas ni reset público. Usá backups/Time Travel de D1 para operaciones de recuperación.

## Alcance verificado

19 pruebas del backend: identidad de BOT, azar persistente, cierre/premios únicos, 24 horas, contratos compartidos, propiedad, stock, concurrencia, rollback, claves, sesiones, límites, rankings y prueba de 20 jugadores. 139 pruebas del motor original. Migración y peticiones reales en Wrangler local; bundle compilado con `deploy --dry-run`.

**No se desplegó en tu cuenta Cloudflare.** Falta configurar ID/secret y publicar. No se ha probado CPU, latencia ni costos en infraestructura remota. Recuperación de contraseña, verificación de email y conexión de todas las pantallas del juego quedan fuera de este paquete inicial de servidor; se requieren antes de abrir la versión definitiva a usuarios públicos.

Para desarrollar:

```powershell
npm test
```

El contrato de integración y ejemplos están en `API.md`.
