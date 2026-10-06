# API online 1.1

Usar HTTPS. El servidor obtiene el director de la sesión (cookie o Bearer); nunca aceptar `teamId`, saldo, kilómetros ni tiempos enviados por el cliente. Un navegador no calcula resultados autoritativos.

## Endpoints

| Método / ruta                                  | Uso                                                                                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/passkey/register/options` | `{username,email,teamName,shieldId,vehicleId}` → `{challengeId,options}` para WebAuthn. |
| `POST /api/passkey/register/verify` | `{challengeId,response}` con la respuesta WebAuthn → usuario y sesión. |
| `POST /api/passkey/login/options` | `{}` → desafío y opciones para credencial descubrible. |
| `POST /api/passkey/login/verify` | `{challengeId,response}` → usuario y sesión. |
| `POST /api/logout`                             | Cierra sesión y cookie.                                                                                                                                  |
| `GET /api/bootstrap`                           | Sesión requerida. Usuario, revisión, fecha UTC en ms, equipo completo, catálogo, stock, ofertas propias, calendario, inscripciones y proyección pública. |
| `GET /api/public`                              | BOT, stock/modelos iniciales, directores públicos y carreras con posiciones. Caché 30 s. Primera inicialización mediante cron o registro.                |
| `GET /api/rankings?circuit=andes&vehicle=niva` | Mejores llegadas por tiempo total de carrera, incluyendo paradas; modelo opcional. Hasta 100 registros, no suma puntos.                                  |
| `GET /api/rankings?race=EVENT_ID&bots=1`       | Clasificación de una edición, terminados y pendientes. BOT excluidos por defecto.                                                                        |
| `GET /api/profile?id=USER_ID`                  | Estadísticas históricas agrupadas por circuito y modelo, sin email ni finanzas privadas.                                                                 |
| `GET /api/ledger?limit=50&before=SEQUENCE`     | Economía propia, más recientes primero; usar última secuencia como cursor de página siguiente.                                                           |
| `GET /api/health`                              | Salud/versión, sin D1.                                                                                                                                   |
| `POST /api/command`                            | Intención validada; requiere sesión e `Idempotency-Key`. Retorna confirmación mínima.                                                                    |

`rules=online-1` filtra rankings por versión de reglas (default actual). `vehicle` es modelo (`niva`, `hilux`...), no ID de una unidad del garaje. Los récords son registros de llegadas; un director puede tener varios tiempos. Para mostrar su mejor marca agrupá por director o agregá una consulta específica. `race` usa `eventId` completo, incluyendo fecha, tomado del calendario. La clasificación de una edición cerrada es definitiva.

## Cliente y pocas requests

```javascript
import { ApexAPI } from "./api-client.js";
const api = new ApexAPI();
const state = await api.bootstrap();
render(state); // Actualizar sólo textos, agujas y posiciones que cambiaron.
const stop = api.watch(render, showError, 60, false);

const key = crypto.randomUUID();
try {
  await api.command({ type: "rename-team", name: "Pampa Raid" }, key);
} catch (error) {
  // Si hay timeout o 503, conservar key y reintentar EXACTAMENTE esa acción.
  // Nunca generar otra clave para la misma compra o repetirla con otro cuerpo.
  throw error;
}
render(await api.bootstrap());
```

El servidor no recibe ticks del navegador. Animar el mapa a 60 FPS puede interpolar visualmente entre posiciones; la simulación real sigue usando la distancia/velocidad del snapshot. No reconstruir formularios y dropdowns durante cada actualización; conservar selección/foco y actualizar nodos específicos. El cliente incluido evita pollings concurrentes y sólo trabaja con la pestaña visible.

## Comandos admitidos

Todos se envían a `/api/command`; los ID se obtienen del `bootstrap`.

```json
{"type":"enroll","eventId":"EVENT_ID","driverId":"DRIVER_ID"}
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

Para `save-plan`, copiar un plan completo de `entries[].plans`, modificar opciones y enviarlo entero; `{}` es ilustrativo, no válido. `stageIndex` comienza en cero. `enqueue-work kind=part` repara una pieza. La asignación del mecánico utiliza `workshop`/`race`. `kind` de personal admite `driver`/`mechanic`. `tradeId` es unidad propia opcional, no modelo.

La inscripción guarda el auto activo y piloto; reserva todo el intervalo máximo. Si falta piloto, mecánico o auto disponible al largar se marca DNS y no se corre. En la versión actual esos DNS no producen fila de resultados ni premio. Vender/entregar un auto cancela sus inscripciones futuras. El kit de carrera queda bloqueado hasta el cierre global; los autos y piezas de reserva sí pueden trabajarse. Planes con piloto secundario que ya no esté en el equipo se reemplazan por el piloto inscrito al largar.

Estados: `scheduled`, `running`, `closed`. Cada equipo puede estar esperando, en servicio, conduciendo o terminado. Un plan puede bloquear la salida si lo configura el director; la inscripción genera planes iniciales válidos para todas las etapas. Las carreras cortas siguen las reglas existentes: un piloto, sin asistencia/reparaciones.

## Consistencia y autenticación

Passkeys ES256 con verificación de usuario, RP ID y origen. Desafíos de cinco minutos y un solo uso. Sesiones de siete días, token aleatorio de 256 bits; sólo hash en D1. Cookie HttpOnly/Secure/SameSite Strict en mismo origen. Para el frontend autorizado en otro origen, token Bearer devuelto al autenticar y conservado en sessionStorage. No hay recuperación de cuenta ni verificación de email implementadas.

Sólo se admite Origin de ALLOWED_ORIGINS o del propio Worker; WebAuthn exige además AUTH_ORIGINS/RP_ID. OPTIONS responde con CORS para los orígenes permitidos. 60 intentos passkey por IP en 15 minutos; acciones 30/minuto por usuario y ubicación Cloudflare. Los endpoints /api/login y /api/register antiguos devuelven 410 en producción.

GET /api/bootstrap?race=EVENT_ID agrega `view`, la proyección de interfaz con el equipo propio identificado como player y sólo atributos públicos del rival. `save-plans` admite hasta 24 filas `{stageIndex,plan}` para un eventId, en una sola transacción. El frontend mantiene la clave idempotente pendiente en sessionStorage para reintentar sin duplicar operaciones.

La revisión se comprueba antes de guardar y todas las escrituras posteriores dependen del mismo `commit_key`; una colisión revierte o reintenta desde el estado reciente. No usar `INSERT OR REPLACE` para usuarios/stock. Los recibos tienen clave única usuario+acción. Cierre y premio quedan archivados de forma atómica con el estado actualizado.

Errores: 400 intención inválida, 401 sesión ausente/vencida, 403 origen prohibido, 409 conflicto/duplicación, 429 límite y 503 recuperación pendiente/configuración faltante. La interfaz debe mostrar el mensaje sin reemplazar un error por una operación local.
