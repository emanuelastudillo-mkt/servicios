# Código fuente de Aeronauta

Versión autónoma React + TypeScript + Vite. No requiere Sites, cuentas de OpenAI, servidor propio ni API para jugar. Las dependencias del proyecto original se conservan con su archivo de versiones.

## Modificar

1. Instalá Node.js 24 y pnpm.
2. Abrí una terminal en esta carpeta y ejecutá `pnpm install`.
3. Ejecutá `pnpm dev` para trabajar localmente.
4. Ejecutá `pnpm test` y `pnpm typecheck`.
5. Ejecutá `pnpm build`. El juego compilado aparece en `dist/`.
6. Copiá el contenido de `dist/` a la raíz de tu repositorio, conservando `.nojekyll`.

La compilación conserva archivos existentes. Para una entrega limpia, usá una carpeta nueva con `pnpm build --outDir dist-v2`.

## Archivos principales

- `lib/engine.ts`: economía, turnos y validación de partidas.
- `lib/catalog.ts`: aeropuertos, aviones y eventos.
- `components/`: mapa, rutas, flota, finanzas y ventanas.
- `app/`: estilos visuales.
- `tests/engine.test.ts`: siete pruebas del motor y de la campaña.

Esta edición compila con rutas relativas para funcionar tanto en la raíz de un dominio como dentro de una carpeta de GitHub Pages. El mapa también se carga desde la carpeta del juego.

Las herramientas opcionales WebMCP detectan soporte del navegador; su funcionamiento en un navegador compatible no se ha verificado.
