# FACIL AUTO v0.05

Versión completa lista para publicar. No depende de archivos de versiones anteriores.

## Incluye

- Catálogo unificado: guía mensual + DNRPA.
- Valuación de mercado y estimación cuando falta un año exacto.
- Lectura de oportunidad con ajuste comercial de 15 p.p.
- Valuación DNRPA y transferencia estimada.
- Tasas bancarias y simulación de financiación.
- Herramientas de actualización de fuentes.

## Publicación

Subí **todo el contenido de esta carpeta** manteniendo la estructura de directorios.
La página debe servirse por HTTP/HTTPS. No funciona abriendo `index.html` directamente con `file://`, porque los navegadores bloquean la lectura de los JSON locales.

## Diagnóstico de carga

Desde v0.05 el cargador informa qué archivo falta o devuelve error, en lugar de dejar el selector en “Cargando marcas…”. También evita caché durante la carga de las bases para reducir problemas después de una actualización.

## Prueba local

```bash
python -m http.server 8000
```

Luego abrir `http://localhost:8000/`.
