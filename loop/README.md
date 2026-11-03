# SEIS · Looper de micrófono

Aplicación estática publicada en **https://emanuelmkt.com.ar/loop/** mediante el GitHub Pages existente del repositorio. La ruta `/loop` redirige a `/loop/`. No requiere compilación, servidor de audio ni dependencias externas.

## Uso

1. Abrí el enlace en Chrome o Edge, conectá auriculares y pulsá **Activar micrófono**. Permití el acceso cuando el navegador lo solicite.
2. Pulsá **Grabar** en una pista. En **Loop 1** aparece una cuenta regresiva de **3, 2, 1** antes de empezar; ese tiempo no se graba ni forma parte del loop. Podés cancelarla con el mismo botón, `Escape` o **Detener todo**. Volvé a pulsar **Cerrar loop** para fijar la duración del primer ciclo. Si volvés a grabar Loop 1 con otras pistas sonando, después de la cuenta espera el inicio de la próxima vuelta.
3. Grabá otras pistas: esperan el inicio de la próxima vuelta, graban exactamente un ciclo y se suman a la reproducción. Se pueden reproducir seis pistas a la vez; se graba una pista por vez.
4. Ajustá volumen, **Silenciar** y **Solo** por pista. **Detener todo** vuelve al principio y cancela una grabación incompleta.
5. **Guardar sesión** descarga un `.seisloop` con el audio de las seis pistas, nombres y mezcla. **Abrir** permite recuperarlo. No hay guardado automático.
6. **Mezcla WAV** exporta de una a ocho vueltas de la mezcla actual en PCM mono de 16 bits. Respeta el volumen general, los silencios y los solos; no graba una actuación en vivo.

**Espacio** inicia la primera pista vacía o cierra la grabación en curso conservando el audio. Durante la cuenta regresiva o la espera del ciclo, no cancela la preparación. Si cerrás una capa antes de tiempo, conserva lo grabado y completa el resto del ciclo con silencio para mantener la sincronización. Con las seis pistas completas, reproduce/detiene sin borrar. Nunca ejecuta el borrado, aunque ese botón tenga el foco del teclado.

Los atajos `1`–`6` graban, cierran o silencian la pista; `Escape` cancela una grabación. Los atajos se desactivan al editar campos y deslizadores. **Cancelar**, `Escape` y **Detener todo** siguen permitiendo descartar una grabación incompleta de forma explícita.

## Audio y privacidad

La entrada es mono y cada loop dura entre 0,25 y 120 segundos. Un único AudioWorklet mantiene las seis pistas en el mismo ciclo de muestras. La sesión guarda muestras flotantes de 32 bits sin compresión con pérdida. La exportación tiene un máximo de diez minutos.

El audio y los archivos de sesión se procesan en el navegador. No se suben al sitio ni se incluyen en el repositorio. HTTPS permite solicitar el micrófono. La web no lo activa automáticamente y no usa cuentas, analítica ni almacenamiento remoto.

Usá auriculares para no volver a grabar la reproducción. La latencia depende del dispositivo; en la guía desplegable se puede adelantar la captura de nuevas capas hasta 500 ms. Para sesiones largas, conviene detener la reproducción antes de guardar o exportar. La escucha directa está desactivada al abrir.

## Desarrollo y pruebas

- Todos los recursos de producción están en `loop/`. Las rutas de la interfaz resuelven bajo `/loop/`; el procesador se carga con una URL relativa al módulo.
- Ejecutá `node --test loop/tests/*.test.mjs` desde la raíz del repositorio, o `npm test` dentro de `loop`.
- Abrí `/loop/tests/browser.html` para once verificaciones del AudioWorklet real con señal sintética, sin pedir el micrófono ni emitir sonido.
- `/loop/tests/ui.html` permite probar los controles y la cuenta regresiva con una señal sintética; usa la interfaz de producción y empieza con la salida en cero. La aplicación normal no carga ese entorno de prueba.
- No hace falta modificar el dominio, los workflows de catálogo ni los demás proyectos.

Las pruebas sintéticas verifican captura, mezcla, sincronización, guardado y WAV; no sustituyen una escucha del micrófono y la latencia del equipo de cada usuario.
