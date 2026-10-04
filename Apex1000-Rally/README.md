# Apex1000 Rally — World Raid v0.3

Juego estático para navegador, single player, con 11 equipos rivales simulados. Se ejecuta en GitHub Pages o con `node server.mjs` y no necesita instalar dependencias para jugar.

## Esta entrega

- Campeonato de 8 carreras y 120 etapas, entre 9.300 y 12.600 km por carrera. Primera prueba: Andes, 10.240 km. Largadas compartidas y fijas, con descanso y avance independientes por equipo.
- 4 vehículos reales ilustrados; 54 ofertas de piezas nuevas y usadas con precio y stock. Las piezas y los autos adquiridos se conservan durante el campeonato.
- 6 pilotos y 8 mecánicos ficticios en el catálogo. Máximo 3 pilotos y 5 mecánicos por equipo. Ofertas temporizadas, depósito, devolución, salario por carrera y titularidad exclusiva dentro de la partida.
- 100 escudos, nombre de equipo editable y 24 imágenes originales generadas con IA, optimizadas en WebP.
- Mapa mundial local, seguimiento de rivales, zoom y pantalla completa con vehículo, piloto, combustible, temperatura y piezas.
- Guardados anteriores v0.2 migrados, conservando avance, presupuesto y piezas. Se conserva un respaldo local previo a la migración.
- Catálogo administrativo: XLSX con guía y 7 hojas, CSVs, importador validado y workflow de GitHub preparado.

**Pendiente externo:** no se crearon aún las hojas nativas de Google Sheets ni se conectaron al repositorio. El usuario eligió reactivar el conector de Drive. `config/sheets.json` permanece desactivado; el juego utiliza su catálogo incluido y funciona independientemente de ese paso.

## Jugar localmente

Con Node.js 22 o superior: `node server.mjs`. Abrir http://127.0.0.1:4182. No abrir `index.html` directamente con `file://`, porque utiliza módulos ES y un Web Worker.

1. Elegir vehículo, nombre y largada. La inscripción incluye tres pilotos y una mecánica; se descuentan vehículo y primeros sueldos.
2. En Equipo, elegir escudo. Para contratar otro piloto primero hay que liberar un cupo; se necesita al menos un piloto.
3. En Mercado, comprar o enviar ofertas. El plazo inicial es de seis horas del reloj de simulación. Ganar paga el primer sueldo con el depósito; perder o cancelar lo devuelve.
4. En Roadbook, estudiar terreno, temperatura y distancias. Campamento permite guardar el plan de cada etapa. Se pueden completar automáticamente los planes faltantes.
5. En Carrera, usar el reloj o “Mi próxima parada”. El mapa permite seguir cualquier participante y entrar en pantalla completa; Escape cierra esa vista.
6. Al llegar todos a meta, Campeonato cierra los puntos y habilita la siguiente carrera. Se cobran los siguientes sueldos. Los premios de temporada se pagan una sola vez tras la octava prueba.

## Publicación e incremental

El paquete incremental se aplica en la raíz del repositorio `servicios`: contiene `Apex1000-Rally/` y `.github/workflows/apex1000-catalog.yml`. Conservar todos los archivos que no figuran en el ZIP. No reemplaza otras webs del repositorio. La documentación específica de la conexión está en `docs/CATALOGOS.md`.

Para subir la carpeta completa, conservar `src/`, `data/`, `assets/`, `style.css` e `index.html`. La carpeta `qa/` contiene respaldos y verificaciones locales y no debe publicarse. No se eliminaron los archivos de QA que ya existían en la versión publicada.

## Validación

`npm test` ejecuta pruebas de simulación, desgaste, energía, presupuesto, ocho carreras, premios, contratos, reservas, stock, migración y lectura CSV. `npm run catalog:check` valida los CSV locales sin modificar el catálogo. No se requieren dependencias npm para estas pruebas.

## Alcance

Modelos de vehículos y localidades reales; rendimiento comparativo, salarios, stock, precios, premios, condiciones de terreno y rutas deportivas son parámetros ficticios. Las imágenes son ilustraciones generadas, no fotografías oficiales. Los retratos representan personajes inventados. No se reproduce el reglamento Dakar ni se ofrece navegación vial.

`src/worker.js` pertenece al navegador. La arquitectura del servidor futuro se documenta en `docs/ONLINE.md` y `docs/ONLINE-MERCADO.md`; no hay multijugador, login ni adjudicación entre jugadores reales en esta versión.
