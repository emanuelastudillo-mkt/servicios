# API online 1.2

Usar HTTPS. El servidor obtiene el director de la sesiÃ³n (cookie o Bearer); nunca aceptar `teamId`, saldo, kilÃ³metros ni tiempos enviados por el cliente. Un navegador no calcula resultados autoritativos.

## Endpoints

| MÃ©todo / ruta                                  | Uso                                                                                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/passkey/register/options`           | `{username,email,teamName,shieldId,vehicleId}` â†’ `{challengeId,options}` para WebAuthn.                                                                  |
| `POST /api/passkey/register/verify`            | `{challengeId,response}` con la respuesta WebAuthn â†’ usuario y sesiÃ³n.                                                                                   |
| `POST /api/passkey/login/options`              | `{}` â†’ desafÃ­o y opciones para credencial descubrible.                                                                                                   |
| `POST /api/passkey/login/verify`               | `{challengeId,response}` â†’ usuario y sesiÃ³n.                                                                                                             |
| `POST /api/logout`                             | Cierra sesiÃ³n y cookie.                                                                                                                                  |
| `GET /api/bootstrap`                           | SesiÃ³n requerida. Usuario, revisiÃ³n, fecha UTC en ms, equipo completo, catÃ¡logo, stock, ofertas propias, calendario, inscripciones y proyecciÃ³n pÃºblica. |
| `GET /api/public`                              | BOT, stock/modelos iniciales, directores pÃºblicos y carreras con posiciones. CachÃ© 30 s. Primera inicializaciÃ³n mediante cron o registro.                |
| `GET /api/rankings?circuit=andes&vehicle=niva` | Mejores llegadas por tiempo total de carrera, incluyendo paradas; modelo opcional. Hasta 100 registros, no suma puntos.                                  |
| `GET /api/rankings?race=EVENT_ID&bots=1`       | ClasificaciÃ³n de una ediciÃ³n, terminados y pendientes. BOT excluidos por defecto.                                                                        |
| `GET /api/profile?id=USER_ID`                  | EstadÃ­sticas histÃ³ricas agrupadas por circuito y modelo, sin email ni finanzas privadas.                                                                 |
| `GET /api/ledger?limit=50&before=SEQUENCE`     | EconomÃ­a propia, mÃ¡s recientes primero; usar Ãºltima secuencia como cursor de pÃ¡gina siguiente.                                                           |
| `GET /api/health`                              | Salud/versiÃ³n, sin D1.                                                                                                                                   |
| `POST /api/command`                            | IntenciÃ³n validada; requiere sesiÃ³n e `Idempotency-Key`. Retorna confirmaciÃ³n mÃ­nima.                                                                    |

`rules=online-1` filtra rankings por versiÃ³n de reglas (default actual). `vehicle` es modelo (`niva`, `hilux`...), no ID de una unidad del garaje. Los rÃ©cords son registros de llegadas; un director puede tener varios tiempos. Para mostrar su mejor marca agrupÃ¡ por director o agregÃ¡ una consulta especÃ­fica. `race` usa `eventId` completo, incluyendo fecha, tomado del calendario. La clasificaciÃ³n de una ediciÃ³n cerrada es definitiva.

## Cliente y pocas requests

```javascript
import { ApexAPI } from "./api-client.js";
const api = new ApexAPI();
const state = await api.bootstrap();
render(state); // Actualizar sÃ³lo textos, agujas y posiciones que cambiaron.
const stop = api.watch(render, showError, 60, false);

const key = crypto.randomUUID();
try {
  await api.command({ type: "rename-team", name: "Pampa Raid" }, key);
} catch (error) {
  // Si hay timeout o 503, conservar key y reintentar EXACTAMENTE esa acciÃ³n.
  // Nunca generar otra clave para la misma compra o repetirla con otro cuerpo.
  throw error;
}
render(await api.bootstrap());
```

El servidor no recibe ticks del navegador. Animar el mapa a 60 FPS puede interpolar visualmente entre posiciones; la simulaciÃ³n real sigue usando la distancia/velocidad del snapshot. No reconstruir formularios y dropdowns durante cada actualizaciÃ³n; conservar selecciÃ³n/foco y actualizar nodos especÃ­ficos. El cliente incluido evita pollings concurrentes y sÃ³lo trabaja con la pestaÃ±a visible.

## Comandos admitidos

Todos se envÃ­an a `/api/command`; los ID se obtienen del `bootstrap`.

```json
{"type":"enroll","eventId":"EVENT_ID","carId":"CAR_ID","driverIds":["DRIVER_1","DRIVER_2"],"mechanicIds":["MECHANIC_ID"],"partIds":{"engine":"PIECE_ID","gearbox":"PIECE_ID","suspension":"PIECE_ID","tyres":"PIECE_ID","cooling":"PIECE_ID","brakes":"PIECE_ID"},"spareIds":[]}
{"type":"configure-enrollment","eventId":"EVENT_ID","carId":"CAR_ID","driverIds":["DRIVER_ID"],"mechanicIds":["MECHANIC_ID"],"partIds":{},"spareIds":[]}
{"type":"cancel-enrollment","eventId":"EVENT_ID"}
{"type":"save-plan","eventId":"EVENT_ID","stageIndex":0,"plan":{}}
{"type":"buy-part","partType":"engine","grade":"endurance","condition":50}
{"type":"sell-part","id":"PIECE_ID"}
{"type":"purchase-car","modelId":"mini","tradeId":null}
{"type":"select-car","id":"CAR_ID"}
{"type":"sell-car","id":"CAR_ID"}
{"type":"enqueue-work","kind":"condition","id":"CAR_ID","points":5}
{"type":"enqueue-work","kind":"performance","id":"CAR_ID","points":3}
{"type":"enqueue-work","kind":"reliability","id":"CAR_ID","points":2}
{"type":"enqueue-work","kind":"part","id":"PIECE_ID","points":5}
{"type":"cancel-work","id":"JOB_ID"}
{"type":"assign-mechanic","id":"MECHANIC_ID","place":"workshop"}
{"type":"bid","kind":"mechanic","personId":"PERSON_ID","salary":3000}
{"type":"cancel-bid","id":"AUCTION_ID"}
{"type":"renew-contract","kind":"driver","id":"DRIVER_ID"}
{"type":"release","kind":"mechanic","id":"MECHANIC_ID"}
{"type":"choose-shield","shieldId":12}
{"type":"rename-team","name":"Pampa Raid"}
```

Para `save-plan`, copiar un plan completo de `entries[].plans`, modificar opciones y enviarlo entero; `{}` es ilustrativo, no vÃ¡lido. `stageIndex` comienza en cero. `enqueue-work kind=part` repara una pieza. La asignaciÃ³n del mecÃ¡nico utiliza `workshop`/`race`. `kind` de personal admite `driver`/`mechanic`. `tradeId` es unidad propia opcional, no modelo.

La inscripciÃ³n guarda el auto activo y piloto; reserva todo el intervalo mÃ¡ximo. Si falta piloto, mecÃ¡nico o auto disponible al largar se marca DNS y no se corre. En la versiÃ³n actual esos DNS no producen fila de resultados ni premio. Vender/entregar un auto cancela sus inscripciones futuras. El kit de carrera queda bloqueado hasta el cierre global; los autos y piezas de reserva sÃ­ pueden trabajarse. Planes con piloto secundario que ya no estÃ© en el equipo se reemplazan por el piloto inscrito al largar.

Estados: `scheduled`, `running`, `closed`. Cada inscripciÃ³n tiene su propio avance y planes. Los raids aceptan 1â€“3 pilotos, 1â€“4 mecÃ¡nicos y un auto; los sprints exactamente uno de cada rol. `partIds` debe contener los seis tipos y sus IDs fÃ­sicos; `spareIds` reserva los repuestos adicionales. NingÃºn recurso puede repetirse en intervalos mÃ¡ximos superpuestos. `configure-enrollment` utiliza el mismo cuerpo completo y solo se admite antes de largar. El JSON de ejemplo usa IDs simbÃ³licos: reemplazar cada `PIECE_ID` por una pieza distinta y completar `partIds`; `{}` se rechaza. Los planes solo pueden usar los pilotos y repuestos asignados a esa inscripciÃ³n. Las largas se limitan a 192 horas y 15 etapas; las cortas a cuatro horas, sin asistencia ni reparaciones durante el trayecto.

`view.teams[0]` es el equipo enviado a la carrera del visor, con su kit y plantilla asignados. `view.online.baseTeam` conserva el patrimonio completo para taller, personal y finanzas. `view.online.ownRaces` permite cambiar entre las participaciones activas y `view.online.reservations` contiene las reservas y lÃ­mites por inscripciÃ³n. No publicar el estado autoritativo ni los RNG internos. No requiere otro endpoint, polling ni tabla SQL por carrera simultÃ¡nea.

## Consistencia y autenticaciÃ³n

Passkeys ES256 con verificaciÃ³n de usuario, RP ID y origen. DesafÃ­os de cinco minutos y un solo uso. Sesiones de siete dÃ­as, token aleatorio de 256 bits; sÃ³lo hash en D1. Cookie HttpOnly/Secure/SameSite Strict en mismo origen. Para el frontend autorizado en otro origen, token Bearer devuelto al autenticar y conservado en sessionStorage. No hay recuperaciÃ³n de cuenta ni verificaciÃ³n de email implementadas.

SÃ³lo se admite Origin de ALLOWED_ORIGINS o del propio Worker; WebAuthn exige ademÃ¡s AUTH_ORIGINS/RP_ID. OPTIONS responde con CORS para los orÃ­genes permitidos. 60 intentos passkey por IP en 15 minutos; acciones 30/minuto por usuario y ubicaciÃ³n Cloudflare. Los endpoints /api/login y /api/register antiguos devuelven 410 en producciÃ³n.

GET /api/bootstrap?race=EVENT_ID agrega `view`, la proyecciÃ³n de interfaz con el equipo propio identificado como player y sÃ³lo atributos pÃºblicos del rival. `save-plans` admite hasta 24 filas `{stageIndex,plan}` para un eventId, en una sola transacciÃ³n. El frontend mantiene la clave idempotente pendiente en sessionStorage para reintentar sin duplicar operaciones.

La revisiÃ³n se comprueba antes de guardar y todas las escrituras posteriores dependen del mismo `commit_key`; una colisiÃ³n revierte o reintenta desde el estado reciente. No usar `INSERT OR REPLACE` para usuarios/stock. Los recibos tienen clave Ãºnica usuario+acciÃ³n. Cierre y premio quedan archivados de forma atÃ³mica con el estado actualizado.

Errores: 400 intenciÃ³n invÃ¡lida, 401 sesiÃ³n ausente/vencida, 403 origen prohibido, 409 conflicto/duplicaciÃ³n, 429 lÃ­mite y 503 recuperaciÃ³n pendiente/configuraciÃ³n faltante. La interfaz debe mostrar el mensaje sin reemplazar un error por una operaciÃ³n local.


## Coordinador por eventos (1.3.0)

La API conserva sus rutas y autenticación; Worker las deriva a RaceRoom. GET
/api/health agrega scheduler="events" y nextEventAt (timestamp UTC). Las consultas
materializan la hora real sin persistir un tick por minuto. D1 conserva la revisión
del último evento; una misma revisión puede tener telemetry más reciente.

save-plan y save-plans se rechazan mientras la escudería recorre la etapa o está
en asistencia, incluso para etapas futuras. Se admiten en campamento y antes de
la largada. El bloqueo se aplica por inscripción, no a otras carreras simultáneas.
El histórico contable combina movimientos confirmados con pendientes en memoria
para mantener la economía visible actual. Ver EVENTOS.md.
