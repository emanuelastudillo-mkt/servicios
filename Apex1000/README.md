# Apex1000 — juego listo para GitHub Pages

Esta carpeta contiene la versión estática del prototipo **Apex Lab 0.1**. Se juega completamente en el navegador. No necesita instalación de paquetes, compilación, Node.js ni un servidor propio para publicarse en GitHub Pages.

## Publicar

1. Crear un repositorio en GitHub, por ejemplo `Apex1000`.
2. Subir **el contenido de esta carpeta a la raíz del repositorio**. `index.html` debe quedar directamente en la raíz, junto a `style.css`, `favicon.svg`, `.nojekyll` y la carpeta `src`. Conservar los nombres y la estructura.
3. En el repositorio, abrir **Settings → Pages**.
4. En **Build and deployment → Source**, elegir **Deploy from a branch**.
5. Elegir la rama que contiene los archivos (habitualmente **main**) y la carpeta **/(root)**. Guardar con **Save**.
6. Cuando GitHub complete el despliegue, abrir la dirección que aparece en Pages. Si el repositorio se llama `Apex1000`, normalmente será `https://TU-USUARIO.github.io/Apex1000/`.

Si se carga desde la web de GitHub, arrastrar también la carpeta `src`, no sólo los archivos HTML/CSS. Incluir el archivo `.nojekyll`; evita que GitHub procese el juego como un sitio Jekyll. Si no aparece al subirlo, se puede crear como archivo vacío desde **Add file → Create new file**, con el nombre `.nojekyll`.

[Documentación oficial de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Archivos

```text
index.html
style.css
favicon.svg
.nojekyll
README.md
src/
  app.js
  catalog.js
  engine.js
  race-worker.js
  storage.js
  track.js
  visuals.js
```

Las rutas son relativas, por lo que funciona tanto en un dominio raíz como bajo `/Apex1000/` o con otro nombre de repositorio. El motor de carrera se ejecuta en un Web Worker del navegador.

## Probar el juego

1. En **Taller**, elegir un auto y ejecutar una tanda.
2. Cambiar los ajustes y volver a probar. **Telemetría** compara los resultados.
3. Guardar configuraciones para volver a cargarlas desde la biblioteca.
4. En **Carrera**, elegir la estrategia, cargar combustible sugerido y simular.
5. Reproducir la carrera en 2D o saltar al resultado.

El guardado pertenece a ese navegador y al dominio de la página. Para trasladar la partida del prototipo local a GitHub Pages, exportarla desde **Configuraciones** e importar el JSON en el juego publicado. No se sincroniza automáticamente entre dispositivos.

Abrir la URL publicada por GitHub Pages. Abrir `index.html` directamente como archivo local no sirve para los módulos y el Worker.

## Alcance

Incluye Barcelona-Catalunya en 2D, cuatro monoplazas ficticios, pruebas, configuraciones, telemetría y carreras contra once rivales. Es una simulación simplificada con efectos de potencia, carga aerodinámica, masa, agarre, combustible, temperatura y desgaste. El trazado se aproxima al mapa real; las características de los autos y los tiempos no están validados contra telemetría de F1. Es single player; no incluye multijugador.

Esta entrega está preparada para publicación. La activación y el despliegue real en GitHub Pages se realizan al completar los pasos anteriores.
