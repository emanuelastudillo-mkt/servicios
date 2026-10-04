# Fuentes y decisiones de simulación

Consultadas para este prototipo el 4 de octubre de 2026. No se descargan imágenes ni servicios de fabricantes al jugar.

## Referencias oficiales de vehículos

- **Toyota GR DKR Hilux EVO**: [Toyota Gazoo Racing, presentación para Dakar 2025](https://toyotagazooracing.com/dakar/release/2024/1126-01/). V6 biturbo de 3,5 L, tanque 540 L, peso mínimo 2.010 kg. Especificaciones de la versión referida, no garantía de futuras versiones.
- **Ford Raptor T1+**: [Ford Media, presentación de Goodwood, 12/07/2024](https://media.ford.com/content/fordmedia/feu/de/de/news/2024/07/12/weltpremiere-in-goodwood--neuer-ford-raptor-t1--zeigt-sich-berei.html). V8 Coyote de 5,0 L. La capacidad de tanque de 520 L usada en el juego es un parámetro de balance, no un dato verificado en esa fuente.
- **Dacia Sandrider**: [Dacia Media, presentación del Sandrider](https://media.dacia.com/dacia-presents-sandrider-adventurous-brand-heads-for-dakar/?lang=eng). V6 biturbo de 3,0 L. El tanque de 500 L y la masa asignada en el catálogo son valores de simulación.
- **MINI JCW Rally 3.0i**: [X-raid, ficha del vehículo](https://www.x-raid.de/en/vehicles/mini-jcw-rally-3-0i/). Seis cilindros en línea de 3,0 L, tanque 580 L, peso seco 2.020 kg y máximo limitado de 170 km/h. El límite de 250 km/h en asfalto corresponde al reglamento ficticio del juego, no a la ficha de este MINI.

Los nombres identifican referencias reales. Las siluetas son ilustraciones propias simplificadas, sin logos ni promesa de representación exacta de carrocería. Pilotos y rivales son personajes ficticios.

## Cartografía y localidades

- **Natural Earth**, Admin 0 Countries, escala 1:110m. [Datos](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson), [dominio público](https://www.naturalearthdata.com/about/terms-of-use/). `assets/south-america.json` filtra Sudamérica y conserva sólo el nombre de país y su geometría. Proyección plana simplificada, sin proveedor de mosaicos ni claves API.
- **GeoNames**: [descarga cities15000](https://download.geonames.org/export/dump/), [licencia CC BY](https://www.geonames.org/export/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Se seleccionaron las coordenadas de las localidades y se agregaron puntos intermedios sintéticos para el trazado. [San Pedro de Atacama](https://www.geonames.org/3871781/san-pedro-de-atacama.html) se incorporó como localidad adicional.

Los 10.240 km son distancias deportivas de diseño por etapa, no longitud geodésica del dibujo ni kilometraje vial. Superficies, temperaturas y alturas máximas representan escenarios de juego. El mapa es un visor estratégico de la competición, no un mapa de navegación por rutas o fronteras.

## Parámetros que no provienen de especificaciones reales

Velocidad relativa, confiabilidad, eficiencia y afinidad por superficie de cada modelo; presupuestos y precios; calidades y desgaste; probabilidad de averías/errores; curva de temperatura; descanso; altitud deportiva y consumo. Todos se encuentran en `src/catalog.js`, `src/route.js` y `src/engine.js` para poder revisarlos al balancear el juego.

La masa nominal se conserva como referencia en el catálogo; la penalización dinámica actual modela únicamente el combustible transportado. No hay aerodinámica, clima dinámico, pinchazos por neumático individual, navegación manual ni física de suspensión completa.

## Ampliación World Raid v0.3

Las siete pruebas adicionales usan 112 registros de localidades del archivo GeoNames cities15000. Los identificadores GeoNames y las coordenadas verificadas se conservan en data/routes.js. La cartografía mundial de assets/world.json proviene del mismo conjunto Natural Earth utilizado para el mapa original, reducido a geometría y nombre.

Los recorridos deportivos, distancias por etapa, clima, altitud de diseño y premios fueron creados para el juego. Las líneas entre localidades no representan carreteras verificadas ni itinerarios transitables.
