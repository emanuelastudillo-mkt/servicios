# Apex1000 Rally Online 1.1.1

Juego: https://emanuelmkt.com.ar/apex1000rally/
API: https://apex1000-online.emanuelmkt.workers.dev

La interfaz completa (mapa, tablero, campamento, taller, mercado, personal, finanzas, inscripciones y rankings) utiliza el servidor autoritativo Worker + D1. La beta offline permanece independiente. No se admiten importación de partidas, dinero admin, reset ni aceleración online.

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

Se mantiene Workers Free. No se habilitó ningún plan pago. Cron cada minuto; cada navegador visible consulta cada 60 segundos y deja de hacerlo al ocultarse. Las acciones generan una petición y una actualización posterior. No hay peticiones por pieza o vehículo.

20 navegadores abiertos todo el día generan aproximadamente 28.800 consultas más 1.440 cron diarios, acciones y preflight CORS. Los límites gratuitos son compartidos con otros Workers de la cuenta. El paso máximo recupera 120 segundos por ejecución; una interrupción prolongada necesita varias ejecuciones. Si el servidor está atrasado, una acción devuelve 503 para que se reintente con la misma clave.

La carga de 20 directores + 5 BOT se comprobó con seis horas simuladas, estado de unos 490 KB y menos de 40 sentencias por lote. Los lotes respetan 100 parámetros por consulta. Las pruebas sintéticas remotas tuvieron ticks calientes de 8–10 ms y un arranque de 16 ms. No equivalen a una prueba sostenida con 20 personas reales: Workers Free tiene 10 ms de CPU garantizados por invocación y puede tolerar algunos picos. Mantener el límite de 20 y revisar métricas antes de ampliar.

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

Inscripción previa obligatoria, bloqueo por intervalo máximo, sprints cada 48 horas y raids de varios días. Cierre al terminar todos, al máximo publicado o 24 horas después de la primera llegada, lo que ocurra antes. Se ordena por distancia a quienes no llegaron y se pagan premios una sola vez. Rankings por circuito y modelo, sin puntos de campeonato. El personal de academia inicial es propio de cada director; las contrataciones del mercado son exclusivas y las ofertas rivales privadas.

## Catálogos

El servidor consume `data/catalog.js` al desplegar. La sincronización diaria de Sheets del directorio antiguo no despliega automáticamente este Worker. Para aplicar cambios al online hay que generar el catálogo, compilar y desplegar Worker y frontend juntos. Automatizar ese despliegue requiere un secreto de servicio Cloudflare en GitHub Actions; no se exportan las credenciales OAuth personales de Wrangler. No prometer actualización diaria online hasta configurar esa integración.

## Pruebas locales

La beta offline es la versión para partidas de prueba aceleradas. Para pruebas del servidor: `npm run db:local`, configurar RP_ID=localhost y AUTH_ORIGINS/ALLOWED_ORIGINS=http://localhost:8787 mediante vars locales, compilar con APEX_API_URL=http://localhost:8787 y ejecutar Wrangler dev en ese origen. No publicar esa compilación. La base de Wrangler es local y separada de D1 remota.

Nunca publicar node_modules, .wrangler, .dev.vars, .env, claves o archivos de qa. Las credenciales de usuarios reales tampoco deben copiarse a fixtures.