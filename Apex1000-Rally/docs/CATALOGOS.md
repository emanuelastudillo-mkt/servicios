# Catálogos v0.4.0 · Google Sheets

Planilla activa del incremental: [Apex1000-Catalogos (v0.4.0)](https://docs.google.com/spreadsheets/d/1RnlQEN6uLO1nxxxXP74Q2sl1AGmUrqwsk1MpJuOF3qk/edit). Se actualizó el documento ya conectado, conservando su URL. Su respaldo anterior está en `catalogos/Respaldo-Catalogos-v0.3.5-antes-v0.4.0.xlsx`. La copia privada de trabajo `Apex1000-Catalogos-v0.4.0` no es la fuente de sincronización.

El incremental cambia `config/sheets.json` al mismo documento actualizado; entra en uso cuando subís esos archivos a GitHub. La automatización existente en la raíz del repositorio `servicios` continúa leyendo ese archivo a las 07:23 de Argentina. No hace falta crear otra automatización ni usar credenciales en el juego. Los CSV publicados sólo contienen datos ficticios del catálogo.

| Pestaña   | Filas de datos | Qué podés editar                           |
| --------- | -------------: | ------------------------------------------ |
| Vehiculos |              7 | price, stock, available, name, image       |
| Repuestos |             54 | condition, price, stock, available, image  |
| Pilotos   |             16 | name, profile, salary, available, image    |
| Mecanicos |             28 | name, salary, efficiency, available, image |
| Carreras  |             32 | name, region, prizeFactor, maxHours        |
| Premios   |             12 | race, short                                |
| Ajustes   |              4 | valores admitidos de cada regla            |

Conservá los encabezados y los ID: son referencias del juego. No agregues vehículos o circuitos arbitrarios: necesitan características y trazados implementados. `available` usa TRUE/FALSE; los números no llevan separador de miles y aceptan punto o coma decimal. `profile` usa technical, fast o navigator. Las rutas `image` deben existir en la carpeta del juego. Las contrataciones del prototipo son ficticias y locales, no representan empleo real.

En Carreras, los ocho raids tienen kind=raid y los 24 sprints kind=short. Los sprints usan startDay de 2 a 48, cada dos días, y maxHours=4. Las fechas se calculan desde el inicio del calendario de prueba. Los raids están separados por 28 días. El intervalo `[inicio, inicio+maxHours)` bloquea inscripciones superpuestas, aunque el equipo termine antes. Los máximos de raid se admiten de 24 a 672 horas; la duración estimada puede modificarse dentro de esos límites.

Premios contiene position, race y short. No hay points ni premio de campeonato. El pago usa el factor de la carrera y ocurre una sola vez al cerrar. Los sprints cobran 20% de los sueldos contratados y tienen premios mínimos. Ajustar salarios puede cambiar su rentabilidad.

El importador valida todas las hojas antes de escribir `data/catalog.json` y `data/catalog.js`. Un error mantiene el catálogo anterior. Cada partida guarda su propio catálogo; las modificaciones diarias se aplican a partidas nuevas. No recalculan las compras o contratos existentes.

Revisá [Actions del catálogo](https://github.com/emanuelastudillo-mkt/servicios/actions/workflows/apex1000-catalog.yml) para confirmar la ejecución. Se puede usar Run workflow para probar una edición antes del día siguiente. Google puede demorar la republicación y GitHub la tarea programada. La publicación del juego se comprueba con `scripts/verify-catalog-published.mjs`.

Validación local: `node scripts/sync-catalog.mjs --source-dir catalogos --check`. Comprobar Sheets sin escribir: `node --use-system-ca scripts/sync-catalog.mjs --check` en un equipo cuya configuración de certificados lo requiera. Sin `--check`, el comando genera ambos archivos de datos. No pongas datos personales ni credenciales en las pestañas publicadas.

La planilla conectada ya usa el formato v2. Hasta subir el incremental, el importador anterior de GitHub rechazará la nueva estructura sin reemplazar el catálogo válido ni alterar el juego publicado. Aplicar los archivos del ZIP y ejecutar el workflow recupera la sincronización con el catálogo nuevo. La copia privada preparada durante la edición no se usa como fuente.
