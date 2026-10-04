# Incremental v0.3.0 — Apex1000 Rally

Base: carpeta `Apex1000-Rally` del repositorio `emanuelastudillo-mkt/servicios`, commit `9a770e175df7a1417f1fe8a1e7ee53bc094b8b0b` (v0.2).

## Aplicación

1. Conservar una copia de la versión actual y exportar la partida desde el juego.
2. Descomprimir el ZIP **en la raíz del repositorio `servicios`**, no dentro de `Apex1000-Rally`.
3. Agregar o reemplazar únicamente los archivos incluidos. Conservar todos los demás. El paquete no requiere borrar archivos y no modifica las otras páginas del repositorio.
4. Comprobar que el workflow quede en `.github/workflows/apex1000-catalog.yml` y el juego en `Apex1000-Rally/`.
5. En `Apex1000-Rally`, ejecutar `npm test`. Para jugar localmente, ejecutar `node server.mjs` y abrir `http://127.0.0.1:4182`. Para publicar, subir los cambios al repositorio y utilizar su despliegue habitual de GitHub Pages.
6. Recargar el navegador tras actualizar. Los guardados v0.2 se migran conservando progreso, caja y piezas; también se guarda una copia previa de la partida en el almacenamiento local del navegador.

Si el repositorio tiene cambios posteriores a la base indicada, revisar el diff antes de reemplazar archivos coincidentes. `incremental-v0.3-manifest.json` identifica cada archivo del paquete, su hash SHA-256 y, cuando corresponde, el hash de su versión base.

## Contenido

- Campeonato de ocho carreras, 120 etapas y premios por posición de carrera y campeonato.
- Mercado con cuatro vehículos, 54 ofertas de piezas, seis pilotos y ocho mecánicos. Límite de tres pilotos y cinco mecánicos; ofertas, depósitos, vencimientos y contratos exclusivos dentro de la partida.
- Caja, contratos, vehículos y repuestos persistentes entre carreras; salarios por carrera y mecánicos que reducen el tiempo de trabajo.
- Nombre de equipo, 100 escudos y 24 ilustraciones originales optimizadas.
- Mapas de localidades reales, zoom, seguimiento y pantalla completa con información del vehículo y piloto.
- Libro administrativo XLSX, siete CSV, importador validado y workflow de actualización del catálogo mediante un PR.

## Conexión pendiente

Las hojas nativas de Google Sheets **todavía no se crearon**. Falta reactivar el conector elegido por el usuario, importar el libro a su carpeta de Drive, verificar las siete URLs CSV y activar la conexión en GitHub. Las instrucciones están en `docs/CATALOGOS.md`.

El juego funciona con el catálogo local incluido. El workflow queda desactivado para ejecuciones programadas mientras no exista `APEX_SHEETS_ENABLED=true`; ejecutarlo manualmente sin configurar Sheets informa que la conexión está pendiente.

Continúa siendo single player. No incluye login, servidor multijugador ni contrataciones entre jugadores reales. La migración futura de mercado a servidor está documentada en `docs/ONLINE-MERCADO.md`.

## Verificación de la entrega

38 pruebas automatizadas: simulación, presupuesto, desgaste, stock, contratos, migración de una partida real v0.2 y campeonato completo de ocho carreras. Catálogo local validado. Recorrido de navegador: compras, contratación de piloto y mecánica, guardado, dos carreras completas, cambio de carrera, mapa y seguimiento; revisión visual en escritorio y móvil.

El ZIP se comprobó aplicándolo sobre una copia de la base indicada y ejecutando nuevamente las pruebas en esa copia. No se incluyeron respaldos locales, dependencias de autoría ni archivos de QA en el incremental.
