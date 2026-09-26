# Sistema militar — parámetros editables de diseño (v7.16)

Este documento describe reglas de juego, no estadísticas reales. Si cambiás una cifra acá, el motor no se modifica solo: pedí adaptar `catalog-v6.js` y `simulation-v6.js` a este documento.

| Elemento | Regla actual |
|---|---|
| Base militar | 5.000 plazas por módulo. Costo fijo US$ 75 M, 18 meses, 35 ha, cemento 700 u, acero 180 u, combustible 35 u. Requiere Organización militar. |
| Base naval | Permite atacar a países de otro continente. Costo fijo US$ 320 M, 30 meses, 60 ha, costa, cemento 2.400 u, acero 850 u, combustible 130 u. Requiere Operaciones navales. |
| Escuela militar | Hasta 2.000 soldados formados por mes y módulo. Costo fijo US$ 60 M, 18 meses, 12 ha, cemento 550 u, acero 100 u, combustible 25 u. Requiere Formación militar. |
| Reclutamiento | Se cubren vacantes desde desempleados adultos (18 años o más), hasta 0,4 % de la fuerza laboral por mes y hasta el límite de bases. Los soldados son empleos permanentes hasta baja o recorte. |
| Formación | Tope mensual: menor entre reclutas sin formar, plazas de escuelas y 12 soldados por instructor asignado; se ajusta por educación y cobertura salarial. Los instructores son funcionarios del ministerio de Educación, no nuevas personas. |
| Potencia | Soldados × factor de formación (0,38 a 1) × factor de nómina × sueldo relativo × tecnología combinada. El defensor recibe ventaja de 18 % más fortificación moderada por bases. Ataque remoto: 20 % menos potencia. |
| Resultado | Potencia ofensiva / defensiva multiplicada por incertidumbre de ±12 %. Con 1 o más, la incursión tiene éxito; no hay anexión. |
| Bajas | Victoria: atacante alrededor de 1,5 % ajustado, defensor 1–7 %. Derrota: atacante 3,5–8 %, defensor 0,4 %. Un 25 % de bajas son muertes, el resto deja el ejército y retorna al mercado laboral. |
| Daños y saqueo | Si gana, destruye hasta 2 módulos existentes y hasta 3 stocks aleatorios. De cada stock se pierde 1–5 %; hasta la mitad del daño puede pasar al inventario público del atacante si hay espacio. |
| Relaciones | Cada par con comercio ejecutado gana entre 0,1 y 0,55 puntos por ciclo; cada ataque resta 30 puntos. Escala 0–100. |
| Ataque automático | Si la relación con el jugador es menor a 25, el otro país tiene alcance y al menos 55 % de su potencia defensiva, hay un máximo de una posibilidad mensual (8 %) de incursión de la nación más hostil. |

La relación geográfica usa continentes simplificados: dentro del mismo continente se puede realizar una ofensiva terrestre sin datos de fronteras; fuera se requiere base naval. Malta, Chipre, Turquía y Rusia se agrupan con Europa para esta regla. Es una simplificación de jugabilidad, no una afirmación geográfica exhaustiva.

La partida conserva como máximo 80 enfrentamientos recientes. Los coeficientes se aplican desde esta versión; los guardados previos reciben una dotación inicial proporcional a población y empleo de seguridad, sin gasto nuevo.
