# Pulso Global — cadena de producción editable

**Estado:** valores de las tablas aplicados en v7.13.0. **Base anterior:** v7.12.0. Este archivo sigue siendo la referencia editable para futuros ajustes. Los números son reglas de juego, no rendimientos industriales reales. En caso de contradicción, **mandan las cifras de las tablas**.

## Cómo editar este documento

- Editá las cantidades de las tablas. Usá punto decimal (`0.1`), sin separador de miles, y conservá los identificadores técnicos (`fuel`, `iron_ore`, etc.).
- En la tabla de transformación, **todos los insumos están expresados por 1 unidad de producto**. Ejemplo: `fuel` necesita `crude_oil=0.01`, por lo que 1 unidad de petróleo permite hasta 100 de combustible, si la refinería tiene capacidad.
- Varios insumos separados por `;` se necesitan **todos**; no son alternativas. `steel: iron_ore=0.1; fuel=0.001` significa que 10 de acero requieren 1 de mineral de hierro y 0.01 de combustible.
- La columna «capacidad» es la salida de referencia de **una instalación durante un mes**. No es la receta ni una producción garantizada. Puede bajar por falta de funcionarios, energía, tecnología, insumos, depósitos o almacén.
- Si cambiás una receta, revisá sus productos posteriores en el árbol y las pruebas de balance del final. No agregues otro producto con el mismo `id` ni una receta que se consuma a sí misma, directa o indirectamente.

## Unidades y alcance de esta propuesta

Las cantidades de recursos se tratan como **unidades de juego (`u`)**, no como toneladas físicas. Una unidad de petróleo y una de combustible no afirman tener la misma masa. Los depósitos descubiertos, inventarios y operaciones conservaron sus números guardados; la etiqueta `t` pasó a `u` en recursos a granel, almacenes y comercio. Los bienes discretos —vehículos, chips, computadoras, etc.— siguen en `unidades`.

Las tablas aumentan la **capacidad de extracción por instalación** de diez materias primas (y la capacidad de leche y carne), además de reducir insumos de transformación. Eso permite más extracción mensual pero **puede agotar un depósito antes** si hay espacio y demanda suficientes; el rendimiento posterior compensa parte de ese uso. Las capacidades de las instalaciones transformadoras y los precios iniciales de v7.12 se conservan. Los rendimientos principales ahora son 1→100 para petróleo, minerales, cobre, litio y combustible→químicos; 1→10 para hierro→acero; 1→20 para grano→alimento elaborado/balanceado. Son techos de receta, no salidas garantizadas.

En todas las recetas continúa vigente la mejora tecnológica existente que reduce el consumo de insumos. Los rendimientos de la tabla son **base**: con tecnología de ahorro pueden ser algo mayores.

## Árbol resumido

```text
Petróleo crudo → Combustible → Químicos → Componentes electrónicos → Electrónica, vehículos y tecnología
Mineral de hierro → Acero → Vehículos, maquinaria, electrodomésticos y construcciones
Minerales industriales → Cemento → Construcciones
Cobre → Componentes electrónicos → Electrónica y vehículos
Litio bruto → Litio refinado → Celdas → Baterías → Vehículos eléctricos
Oro bruto → Oro refinado ┐
Diamantes en bruto → Diamantes procesados ┴→ Joyería y herramientas
Granos → Alimento balanceado → Ganadería; Granos → Alimentos elaborados
Ganadería → Leche → Lácteos; Ganadería → Cuero → Cuero acondicionado; Lana → Textiles
Uranio → Plutonio procesado / energía nuclear
Residuos orgánicos → Compostaje → Biomasa → Energía
Madera → Construcciones y energía a partir de madera
```

Este árbol muestra dependencias principales; las recetas completas, incluidas las entradas secundarias, están debajo.

## Fuentes primarias y subproductos (18 recursos)

En estos recursos no hay receta de transformación en `catalog-v6.js`. La columna expresa la capacidad objetivo por instalación en v7.13, incluidas las ampliaciones que escribiste. Un `0` significa que el recurso aparece por otro proceso de simulación, no que sea imposible obtenerlo.

| id | Recurso | Unidad | Capacidad objetivo/instalación/mes | Fuente o límite principal |
|---|---|---|---:|---|
| grains | Granos | u | 33000 | Agricultura: hectáreas, riego, empleo y energía. |
| timber | Madera | u | 15000 | Explotación forestal; también sirve para energía y obras. |
| crude_oil | Petróleo crudo | u | 50000 | Pozo/plataforma y depósito terrestre o marítimo finito. |
| iron_ore | Mineral de hierro | u | 100000 | Planta extractiva y depósito terrestre finito. |
| copper | Cobre | u | 8000 | Planta extractiva y depósito terrestre finito. |
| uranium | Uranio | u | 50 | Planta extractiva y depósito terrestre finito. |
| minerals | Minerales industriales | u | 200000 | Planta extractiva y depósito terrestre finito. |
| lithium | Litio bruto | u | 10000 | Planta extractiva y depósito terrestre finito. |
| gold | Oro bruto | u | 0.8 | Planta extractiva y depósito terrestre finito. |
| diamonds | Diamantes en bruto | u | 0.04 | Planta extractiva y depósito terrestre finito. |
| milk | Leche cruda | u | 500 | Ganadería; requiere animales y capacidad operativa. |
| meat | Carne | u | 300 | Ganadería y faena; requiere animales. |
| raw_leather | Cuero sin procesar | u | 15 | Subproducto ganadero y de faena. |
| wool | Lana | u | 8 | Ganadería ovina. |
| organic_waste | Residuos orgánicos | u | 0 | Generación urbana; tratamiento/compostaje aparte. |
| recyclables | Residuos reciclables | u | 0 | Generación urbana; separación/reciclaje aparte. |
| waste | Basura no aprovechable | u | 0 | Generación urbana; tratamiento/exportación aparte. |
| biomass | Biomasa agrícola | u | 0 | Agricultura/compostaje; uso energético aparte. |

## Recetas de transformación (30 recursos)

**Esta tabla es la parte a editar para cambiar rendimientos.** Cada fila tiene salida de **1** producto. Los `id` de insumos son los mismos que en las tablas. `Cambiar` indica modificación aplicada frente a v7.12; `Conservar` mantiene la receta anterior. Las capacidades de transformación se mantienen en esta entrega.

| id producto | Producto | Unidad | Capacidad objetivo/instalación/mes | Insumos por 1 producto | Decisión |
|---|---|---|---:|---|---|
| cement | Cemento | u | 8000 | minerals=0.01; fuel=0.01 | Cambiar: 1 mineral → hasta 100 cemento, con combustible. |
| steel | Acero | u | 6000 | iron_ore=0.1; fuel=0.001 | Cambiar: 1 hierro → hasta 10 acero. |
| fuel | Combustible | u | 4500 | crude_oil=0.01 | Cambiar: 1 petróleo → hasta 100 combustible. |
| chemicals | Químicos | u | 2000 | fuel=0.01 | Cambiar: 1 combustible → hasta 100 químicos; se elimina el petróleo directo. |
| components | Componentes electrónicos | u | 200 | copper=0.01; chemicals=0.01 | Cambiar: 1 cobre → hasta 100 componentes, con químicos disponibles. |
| refined_lithium | Litio refinado | u | 300 | lithium=0.01; chemicals=0.03 | Cambiar: 1 litio bruto → hasta 100 refinado, con químicos disponibles. |
| refined_gold | Oro refinado | u | 0.06 | gold=1.5; chemicals=0.1 | Conservar: no multiplicar metal precioso. |
| cut_diamonds | Diamantes procesados | u | 0.002 | diamonds=1.6 | Conservar: merma de talla. |
| semiconductors | Semiconductores | unidades | 300000 | minerals=0.0001; components=0.00001; chemicals=0.00002 | Conservar: ya usa insumos a escala de piezas. |
| chips | Microchips avanzados | unidades | 30000 | semiconductors=2; components=0.00002 | Conservar. |
| cells | Celdas de batería | unidades | 100000 | refined_lithium=0.00003; components=0.00005; chemicals=0.0001 | Conservar. |
| feed | Alimento balanceado | u | 2000 | grains=0.05 | Cambiar: 1 grano → hasta 20 alimentos balanceados. |
| food_products | Alimentos elaborados | u | 1500 | grains=0.05; fuel=0.02 | Cambiar: 1 grano → hasta 20 alimentos elaborados; sigue usando combustible. |
| automobiles | Automóviles | unidades | 100 | steel=1.2; components=0.015; fuel=0.05 | Conservar. |
| machinery | Maquinaria productiva | unidades | 60 | steel=2.4; components=0.03; fuel=0.08 | Conservar. |
| electronics | Equipos electrónicos | unidades | 1500 | components=0.005; semiconductors=4 | Conservar. |
| plutonium | Plutonio procesado | u | 0.002 | uranium=3; chemicals=1 | Cambiar: requiere 3 uranio en lugar de 5; material estratégico. |
| batteries | Baterías | unidades | 3000 | cells=20; components=0.0001 | Conservar. |
| computers | Computadoras | unidades | 2000 | chips=2; components=0.005 | Conservar. |
| smartphones | Teléfonos de alta gama | unidades | 4000 | chips=3; cells=2; components=0.001 | Conservar. |
| servers | Servidores | unidades | 500 | chips=16; components=0.01 | Conservar. |
| supercomputers | Supercomputadoras | unidades | 0.1 | servers=3000; chips=100000; components=5 | Conservar; producción fraccionaria mensual acumulable. |
| electric_vehicles | Vehículos eléctricos | unidades | 100 | steel=1.2; batteries=30; chips=20 | Conservar. |
| jewelry | Joyería | unidades | 5000 | refined_gold=0.000004; cut_diamonds=0.0000002 | Conservar. |
| diamond_tools | Herramientas de diamante | unidades | 4000 | cut_diamonds=0.0000003; steel=0.002 | Conservar. |
| appliances | Electrodomésticos | unidades | 2000 | steel=0.04; components=0.002; semiconductors=3 | Conservar. |
| transport_vehicles | Vehículos de transporte | unidades | 40 | steel=5; components=0.05; fuel=0.1 | Conservar. |
| dairy | Lácteos | u | 400 | milk=0.75 | Cambiar: 1 leche → hasta 1.33 lácteos. |
| leather | Cuero acondicionado | u | 50 | raw_leather=0.2; chemicals=0.1 | Cambiar: 1 cuero sin procesar → hasta 5 acondicionados, con químicos. |
| textiles | Textiles de lana | u | 40 | wool=0.1; chemicals=0.08 | Cambiar: 1 lana → hasta 10 textiles, con químicos. |

## Reglas para llevar esta propuesta al código

1. Los coeficientes `inputs` de los doce productos marcados `Cambiar` y las capacidades de fuente de la primera tabla son los valores aplicados. Instalaciones, tecnología y cantidades de depósitos permanecen como estaban. Los rendimientos son teóricos y están sujetos a otros insumos y límites operativos.
2. La etiqueta de los recursos a granel pasa de `t` a `u` **sin multiplicar ni dividir números guardados**. `u` a granel usa el mismo espacio de almacén que usaba `t`; los bienes discretos conservan `unidades` y su espacio específico.
3. El depósito se descuenta cuando se **extrae**, no cuando se refina. El refino consume stock de materia prima real; nunca crea entradas gratis. El mismo stock no puede alimentar dos recetas en un mes.
4. Producción pública y privada usan la misma receta; solo cambian dueño, personal, instalaciones, impuestos y caja. La compra o importación consume dinero una vez; venta manual y automática retiran stock una vez.
5. Esta implementación conserva precios base, demanda por habitante, capacidad de almacenes, consumo de obras y costos fijos anteriores. La mayor rentabilidad potencial es intencional para la prueba de juego, **no una garantía de equilibrio**. Si se ajustan precios después, se editará este documento antes de alterar el código.
6. Migración: guardados anteriores conservan cantidades de depósitos, stock, proyectos, dinero y préstamos. El nuevo rendimiento se aplica solo a ciclos futuros. No convertir inventarios pasados ni recalcular ganancias históricas.
7. En la ficha de cada recurso, mostrar «**Receta base**», «**Producción máxima de mis instalaciones/mes**», «**Producción efectiva pública/privada**» y «**Materia prima disponible**». Para un insumo limitante, mostrar `stock / coeficiente` como máximo teórico, no como producción garantizada.

## Pruebas obligatorias de esta implementación

- Con instalaciones, personal, energía y espacio suficientes: 1 `crude_oil` + refinería permite hasta 100 `fuel`; 1 `iron_ore` + 0.01 `fuel` permite hasta 10 `steel`; 1 `fuel` permite hasta 100 `chemicals`.
- Con 0.5 unidades del insumo principal, el techo baja proporcionalmente (50 de combustible o 5 de acero); con cualquier insumo secundario ausente, no se produce. Ningún stock puede volverse negativo.
- Extraer 1 unidad reduce el depósito en 1, aunque luego se obtengan 10 o 100 unidades transformadas. Producir o vender lo transformado no vuelve a agotar el depósito.
- La capacidad mensual de cada fábrica y la de su almacén siguen limitando la salida. Construir más fábricas puede aumentar el techo, pero no saltea empleo, energía ni insumos.
- Pasar 12 meses con un país pequeño (Malta o Nauru) y uno grande (China) debe conservar caja, comercio, stock, guardados y progreso diario. Comparar agotamiento de depósitos, hambre, PBI, reservas y precios con una partida v7.12 equivalente; documentar cualquier salto económico excesivo antes de publicar.

**Para futuros cambios:** editá las cifras de este archivo y pedime que las adapte al código. No hace falta volver a describir las recetas.
