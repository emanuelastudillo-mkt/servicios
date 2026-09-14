# Fuentes y criterio de los países

## Incorporaciones de v6 — 13 de septiembre de 2026

Se consultó la API oficial WDI del Banco Mundial para los 128 países/territorios de la base. `country-facts.js` conserva valor, año y código de serie de cada observación. Se seleccionó el último dato no nulo entre 2010 y 2025; no se atribuye el año de descarga al dato.

- [Superficie terrestre](https://data.worldbank.org/indicator/AG.LND.TOTL.K2): 128 registros; km² de tierra, sin usar aguas territoriales como espacio construible. Nauru conserva la regla de 21 km² solicitada.
- [Superficie agrícola](https://data.worldbank.org/indicator/AG.LND.AGRI.K2): 127 registros; se convierte de km² a hectáreas e incluye uso agropecuario. No equivale únicamente a hectáreas sembradas.
- [Esperanza de vida al nacer](https://data.worldbank.org/indicator/SP.DYN.LE00.IN): 128 registros. Es la base inicial; la evolución posterior corresponde a la simulación.
- [Líneas ferroviarias](https://data.worldbank.org/indicator/IS.RRS.TOTL.KM): 77 registros; longitud de rutas, no suma de todas las vías paralelas. Si falta, se estima la red de escenario.
- [Tierra agrícola irrigada](https://data.worldbank.org/indicator/AG.LND.IRIG.AG.ZS): 79 registros. Se aplica el porcentaje al área agrícola disponible; algunas observaciones son antiguas y no se presentan como censo actual de distritos.

La población, PBI, empleo y nombres de figuras mantienen la base v5 descrita debajo. Esta entrega no vuelve a certificar que una figura continúe en el cargo ni recalcula todos esos indicadores a septiembre de 2026.

Instalaciones, carreteras, viviendas, ganado, capacidades logísticas, propiedad pública/privada y distribución energética son **estimaciones de escenario** derivadas de escala, educación y actividad. No hay una fuente que respalde cada cantidad como inventario real. Las listas de conocimientos industriales y zonas con depósitos son supuestos de diseño; no constituyen un mapa geológico comprobado ni estimaciones oficiales de reservas explotables. La inicialización calibra capacidades equivalentes para disponer de cadenas productivas; no crea abastecimiento gratuito durante los ticks.

Precios, recetas, rendimiento de plantas, impuestos, probabilidades de exploración, cohortes sintéticas, velocidades de deterioro y respuestas de IA son parámetros de juego. Los datos de observación, las estimaciones y las reglas del motor deben mantenerse diferenciados al interpretar una partida.

## Metodología de la base anterior

Consulta y generación realizadas el 12 de septiembre de 2026. Pulso Global usa una foto estática para establecer una base reconocible; no intenta reproducir legislación, presupuestos ni estadísticas en tiempo real.

## Indicadores

Para los 112 países incorporados en v5 se consultó la [API v2 del Banco Mundial](https://api.worldbank.org/v2/) y se eligió el último valor no nulo entre 2019 y 2026 de población (`SP.POP.TOTL`), PBI nominal (`NY.GDP.MKTP.CD`), desempleo (`SL.UEM.TOTL.ZS`), natalidad y mortalidad (`SP.DYN.CBRT.IN`, `SP.DYN.CDRT.IN`), grupos etarios, crecimiento real, inflación, reservas y consumo eléctrico. `countries-extra.js` conserva `dataYears` por país y serie. La mayoría de los valores corresponde a 2024 o 2025; electricidad puede corresponder a 2023 y la cobertura varía entre países.

Los nombres de las figuras de esos países se obtuvieron de [Wikidata](https://www.wikidata.org/) a partir de declaraciones presentes o históricas de jefatura de gobierno (`P6`) y jefatura de Estado (`P35`), con etiquetas en español o inglés. Se excluyeron personas con fecha de fallecimiento registrada y se conservaron tres nombres distintos por país.

La presencia de una persona solo representa un escenario hipotético. No afirma candidatura, elegibilidad, ideología, probabilidad electoral ni equivalencia entre sistemas políticos. Las descripciones y bonificaciones son decisiones de diseño.

### Contraste manual de los seis países de v4.1

Población, PBI nominal, desempleo, natalidad, mortalidad y estructura por edades se contrastaron con la [API de datos del Banco Mundial](https://api.worldbank.org/v2/country/CUB;ZMB;NGA;URY;HTI;NRU?format=json). Se tomaron los datos disponibles de 2024 o 2025 y se redondearon. Cuando una serie no estaba disponible —como PBI reciente de Cuba o desempleo de Nauru— se utilizó una aproximación de juego.

Educación, infraestructura, estabilidad, productividad, reservas, deuda, popularidad, recursos sectoriales, eficiencia tributaria e impuestos son parámetros de balance. Las tasas impositivas resumen sistemas nacionales complejos y no deben leerse como asesoramiento ni como una tabla fiscal real.

Los grupos demográficos del juego son 0–17, 18–64 y 65 años o más. Las series internacionales publican principalmente 0–14, 15–64 y 65+; por eso la distribución inicial fue adaptada a los límites del motor y normalizada al 100%.

## Fuentes públicas de figuras de v4.1

- Cuba: [World Leaders — Cuba](https://www.cia.gov/resources/world-leaders/foreign-governments/cuba) y [jefaturas de gobierno, DFAT Australia](https://www.dfat.gov.au/geo/heads-of-government/cuba).
- Zambia: [State House](https://www.sh.gov.zm/president-hakainde-hichilema-secures-second-term-in-decisive-election-victory/) e [IFES, elecciones generales 2026](https://www.ifes.org/tools-resources/election-snapshots/elections-zambia-2026-general-elections).
- Nigeria: [Presidencia de Nigeria](https://statehouse.gov.ng/team/bola-ahmed-tinubu/) e [informe electoral 2023 de INEC](https://inecnigeria.org/wp-content/uploads/2024/02/2023-GENERAL-ELECTION-REPORT-1.pdf).
- Uruguay: [Presidencia de Uruguay](https://www.gub.uy/presidencia/comunicacion/noticias/yamandu-orsi-fue-investido-presidente-republica) y [Corte Electoral](https://www.gub.uy/corte-electoral/institucional/informacion-gestion/actas/acta-n-107622024).
- Haití: [Primature de la République d’Haïti](https://www.primature.gouv.ht/le-conseil-presidentiel-de-transition-cpt-a-procede-a-la-ceremonie-dinstallation-du-nouveau-gouvernement-de-transition-a-la-villa-daccueil-le-samedi-16-novembre-2024/).
- Nauru: [Gobierno de Nauru](https://www.nauru.gov.nr/government/ministries/hon-lionel-rouwen-aingimea%2C-mp.aspx) y [Nauru Bulletin](https://www.nauru.gov.nr/media/209190/nauru_bulletin__16_4nov2025__299_.pdf).

La presencia de una persona solo representa un escenario hipotético de conducción. Los rasgos y bonificaciones son decisiones de diseño, no valoraciones sobre su desempeño ni afirmaciones sobre una candidatura futura.
