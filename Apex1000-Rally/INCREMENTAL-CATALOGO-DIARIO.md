# Incremental: catálogo diario

Base requerida: Apex1000 Rally v0.3.3. Esta entrega conecta [Apex1000-Catalogos en Google Sheets](https://docs.google.com/spreadsheets/d/1RnlQEN6uLO1nxxxXP74Q2sl1AGmUrqwsk1MpJuOF3qk/edit) a una actualización automática diaria del juego. La planilla nativa y sus siete URLs CSV están verificadas y activas.

## Instalación y estado

Los cambios de código y el workflow ya se guardaron en `main` de `emanuelastudillo-mkt/servicios`. El ZIP sirve como copia local del incremental. Si se aplica a otra copia del repositorio, descomprimir en la raíz de `servicios` y agregar o reemplazar sólo los archivos incluidos. Conservar todos los demás archivos.

El workflow operativo debe quedar en `.github/workflows/apex1000-catalog.yml` (con **s** final). La carpeta `.github/workflow` no es reconocida por GitHub Actions. La copia en `Apex1000-Rally/integration/github/workflows/` sirve de referencia.

## Funcionamiento

- Ejecución diaria a las 07:23 de Argentina, con posibles demoras de GitHub; ejecución manual desde Actions.
- Lectura de las siete hojas, validación completa y pruebas antes de publicar.
- Commit automático de los dos archivos de catálogo cuando cambien, sin force push.
- Verificación del JSON y del JavaScript públicos; solicitud explícita de publicación en Pages si hace falta.
- Mientras `config/sheets.json` tenga `enabled: false`, informa la conexión pendiente y ejecuta las pruebas sin modificar datos.

No requiere dependencias npm nuevas ni cambia las reglas de competición. Las partidas en curso conservan su copia del catálogo; los cambios publicados se aplican a partidas nuevas. Para editar celdas y consultar el estado diario, ver `docs/CATALOGOS.md`.

## Verificación realizada

65 pruebas locales aprobadas. [La ejecución conectada en GitHub](https://github.com/emanuelastudillo-mkt/servicios/actions/runs/37231870725) descargó y validó las siete hojas, ejecutó las pruebas y verificó ambos archivos públicos del catálogo (revisión `6d24940244b043c2`). Se revisaron visualmente la guía y las siete hojas nativas, con sus encabezados y controles importados.

La [prueba completa de guardado y despliegue](https://github.com/emanuelastudillo-mkt/servicios/actions/runs/37232389434) restauró automáticamente una línea en blanco del JSON de auditoría. `github-actions[bot]` guardó el catálogo canónico en el commit `37ea296`, solicitó el build de Pages y confirmó ambos archivos públicos después del despliegue. La conversión y la prueba conservan los valores originales: no se cambiaron precios, premios ni reglas.

El ZIP `Apex1000-Rally-incremental-catalogo-diario.zip` es la entrega conectada. El archivo anterior terminado en `-preparado.zip` se conserva como respaldo de la preparación previa; usar la entrega conectada.

No se eliminaron archivos locales ni de Drive.
