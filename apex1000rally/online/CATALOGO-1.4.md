# Catálogo online 1.4

## Vehículos y arte

Los ocho modelos tienen imágenes 3:2, sin estirar ni recortar el vehículo. Niva, Hunter y Audi se reencuadraron mediante edición de imagen; Manx es nuevo. Los pesos operativos simulados son: Manx 960 kg, Niva 1.510, Sandrider 2.180, Hilux 2.360, Mini 2.520, Raptor 2.740, Hunter 2.990 y Audi 3.260. No representan fichas homologadas: incluyen preparación, tripulación y combustible de juego. Se conservan las referencias técnicas documentadas en vehicle-stats.js.

Meyers Manx Sprint cuesta 36.000 cr: velocidad 93, aceleración 18, comodidad 12 y control 16. Su preparación y atributos son ficticios, inspirados en el [Meyers Manx oficial](https://meyersmanx.com/pages/the-classic-resorter). Sigue habiendo un Niva más barato para el presupuesto inicial de 30.000 cr.

## Repuestos

Se muestran 18 modelos de marcas conocidas, con 54 ofertas considerando estado 100, 75 y 50. Nombres de preparación, precios, compatibilidad, rendimiento y probabilidades son ficticios de juego; no son datos de fabricantes ni una recomendación comercial. Los identificadores internos endurance/standard/racing se conservan para compatibilidad de partidas y planes, pero la tienda muestra marca, modelo y atributos. Hay una imagen diferente por modelo; las reservas estándar irrompibles siguen disponibles y reparables.

Las piezas compradas guardan una ficha propia: editar Sheets no modifica retroactivamente su rendimiento o riesgo. Las piezas antiguas sin ficha usan el perfil de su tipo y código anterior, conservando estado, desgaste original y averías. Los pesos sólo se migran una vez, cuando coinciden con la antigua referencia; se conserva cualquier peso personalizado, saldo y mejoras.

## Especialistas

Sólo el piloto que conduce protege su pieza especializada de averías aleatorias durante esa etapa. Un piloto descansando no protege; tampoco un mecánico. La protección no restaura averías previas ni elimina desgaste, golpes o temperatura.

Un mecánico especialista aporta 50% más trabajo para reparar esa pieza en campamento. El beneficio se pondera por su aporte de eficiencia y condición dentro del personal asignado a la carrera. No cambia precio, combustible, recambios, descanso ni reparación del taller. El presupuesto y el checklist usan el mismo tiempo calculado.

## Edición diaria desde Google Sheets

Planilla: https://docs.google.com/spreadsheets/d/1RnlQEN6uLO1nxxxXP74Q2sl1AGmUrqwsk1MpJuOF3qk/edit

- Vehiculos: weightKg es peso operativo; columnas speed, acceleration, comfort y control de 0 a 100.
- Repuestos: brand, model, performance (multiplicador), durability (multiplicador), failure (probabilidad por hora), heat (multiplicador), price, stock y available. No cambiar IDs ni usar imágenes externas.
- Ajustes: startingBudget = 30000 sólo afecta nuevos equipos.
- Carreras: máximo de 192 horas para cada raid; el servidor sigue limitando las largas a ocho días.

GitHub Actions descarga las siete pestañas diariamente a las 07:23 de Argentina, valida todos los datos y ejecuta pruebas antes de publicar data/catalog.json y data/catalog.js en apex1000rally. También actualiza sus huellas SHA256. Las ejecuciones programadas y publicación de Sheets/Pages pueden demorarse. Puede ejecutarse manualmente desde Actions → Apex1000 - catálogo diario → Run workflow.

El Worker consulta ese JSON público como máximo una vez por día UTC cuando la sala se activa por solicitud o alarma. Usa memoria y almacenamiento persistente del coordinador; los espectadores no provocan nuevas descargas. Puede haber aproximadamente un día adicional entre la publicación y adopción en el juego. Si no hay actividad, se adopta al reactivarse. Un catálogo inválido conserva el anterior hasta el siguiente intento diario. Publicar código nuevo adopta inmediatamente el catálogo incluido en esa versión.

El estado existente, los stocks ya consumidos y las carreras con configuración fijada se preservan. No hay nuevas tablas ni migraciones SQL, ni tokens de Cloudflare en GitHub. La beta offline permanece separada.
