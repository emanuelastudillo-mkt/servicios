# Peso de referencia de los vehículos · v0.4.1

Referencias consultadas el 5 de octubre de 2026. `weightKg` es un peso base fijo en kilogramos. Los cuatro índices restantes son balance ficticio del juego, no mediciones de fabricantes.

| Modelo                  |   kg | Criterio y fuente primaria                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | ---: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toyota GR DKR Hilux EVO | 2010 | Mínimo FIA en seco para Dakar 2025 declarado por [Toyota Gazoo Racing](https://toyotagazooracing.com/dakar/release/2024/1126-01/).                                                                                                                                                                                                                                                                                          |
| Ford Raptor T1+         | 2010 | Peso mínimo declarado en la presentación 2024 de [Ford](https://media.ford.com/content/fordmedia/feu/de/en/news/2024/07/12/new-ford-raptor-t1--ready-for-rally-raid-terrains--including-dak.html).                                                                                                                                                                                                                          |
| Dacia Sandrider         | 2010 | Referencia: mínimo T1+ gasolina de [FIA, Apéndice J 2024, artículo 285 §11.3, página 18](https://www.fia.com/sites/default/files/285_2024_wmsc_2024.10.17_final.pdf). [Dacia](https://media.dacia.com/dacia-presents-sandrider-adventurous-brand-heads-for-dakar/?lang=eng) identifica categoría y motor, pero no publica peso absoluto en esa ficha. Es una referencia reglamentaria inferida, no un pesaje del Sandrider. |
| MINI JCW Rally 3.0i     | 2020 | Peso en vacío declarado en la ficha técnica de [X-raid](https://www.x-raid.de/en/vehicles/mini-jcw-rally-3-0i/).                                                                                                                                                                                                                                                                                                            |
| LADA Niva Legend · Raid | 1210 | Peso en vacío del auto de serie **3 puertas**, [manual LADA 2024](https://static.lada.ru/files/manuals/lada_niva_legend_re_20_08_24.pdf), tabla de características. “Raid” es una preparación ficticia del juego: no hay un peso oficial comprobado para ella. Se usa el auto de serie como referencia, sin inventar kilos de preparación.                                                                                  |
| Prodrive Hunter T1+     | 2010 | Referencia: mínimo T1+ gasolina de [FIA 2024 §11.3](https://www.fia.com/sites/default/files/285_2024_wmsc_2024.10.17_final.pdf). La [ficha W2RC](https://www.worldrallyraidchampionship.com/en/competitor/f9c39d2d-6188-414c-8c20-db41acafe396) identifica el Hunter T1+. Es una referencia reglamentaria inferida, no un pesaje publicado por Prodrive.                                                                    |
| Audi RS Q e-tron        | 2100 | Mínimo reglamentario Dakar 2024 señalado por [Audi](https://www.audi.com/en/press-releases/audi-rs-q-e-tron-for-2024-innovative-prototype-with-many-new-details-15738). Audi dice que optimizó el auto para acercarse al mínimo; no afirma un peso real exactamente igual.                                                                                                                                                  |

Los criterios de las fuentes difieren: vacío, mínimo en seco y mínimo reglamentario. El juego los usa como referencias base y muestra el criterio en la ficha. No representan un pesaje con tripulación, repuestos y combustible. El combustible conserva su efecto de carga separado en la simulación. Se fijan estas variantes históricas: una modificación reglamentaria posterior no altera automáticamente las partidas.

## Efectos en la simulación

- Velocidad: multiplica el ritmo de base del sector, respetando sus límites y los 30 km/h de emergencia por avería.
- Aceleración: favorece el ritmo medio especialmente en roca y montaña. Es una aproximación de juego, no una integración física instantánea.
- Comodidad: reduce cansancio del conductor activo. No altera el descanso de los relevos.
- Control: disminuye errores de conducción y favorece el ritmo en terreno difícil.
- Peso: mayor masa aumenta consumo y desgaste; penaliza más el ritmo en arena, roca y montaña.

Referencia de balance: 2010 kg. Con `d=(weightKg-2010)/2010`, consumo y desgaste se multiplican por `1+0,3d`; el ritmo por `1/(1+kd)`, con `k=0,3` en arena/roca/montaña y `0,1` en los demás sectores. Son coeficientes aproximados de juego, no datos técnicos de fabricantes.

## Edición y persistencia

`Vehiculos.weightKg` admite enteros de 700 a 6000, sin separadores de miles: escribir `2010`, no `2.010`. Los cuatro índices admiten enteros de 0 a 100. El intervalo de kg valida el catálogo; no define límites reglamentarios.

Cada auto guarda los atributos al crearse o comprarse; daños y mejoras no los cambian. Las partidas antiguas incorporan referencias al cargarse y conservan saldo, flota y trabajos. Cambios diarios de Sheets se aplican a partidas nuevas. Un peso editado distinto de la referencia original se rotula como peso configurado en el catálogo, evitando atribuirlo a una fuente que no lo respalda.
