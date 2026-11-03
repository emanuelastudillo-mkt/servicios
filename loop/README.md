# SEIS · Looper de audio

Aplicación estática publicada en **https://emanuelmkt.com.ar/loop/** mediante el GitHub Pages existente del repositorio. La ruta `/loop` redirige a `/loop/`. No requiere compilación, servidor de audio ni dependencias externas.

## Uso

1. Abrí el enlace en Chrome o Edge y conectá auriculares. En **Entrada de grabación**, elegí una fuente para cada loop y pulsá **Conectar**. Permití el acceso cuando el navegador lo solicite y comprobá el medidor.
2. Pulsá **Grabar** en una pista. En **Loop 1** aparece una cuenta regresiva de **3, 2, 1** antes de empezar; ese tiempo no se graba ni forma parte del loop. Podés cancelarla con el mismo botón, `Escape` o **Detener todo**. Volvé a pulsar **Cerrar loop** para fijar la duración del primer ciclo. Si volvés a grabar Loop 1 con otras pistas sonando, después de la cuenta espera el inicio de la próxima vuelta.
3. Grabá otras pistas: esperan el inicio de la próxima vuelta, graban exactamente un ciclo y se suman a la reproducción. Se pueden reproducir seis pistas a la vez; se graba una pista por vez.
4. Ajustá volumen, **Silenciar** y **Solo** por pista. **Detener todo** vuelve al principio y cancela una grabación incompleta.
5. **Guardar sesión** descarga un `.seisloop` con el audio de las seis pistas, nombres, mezcla y fuentes asignadas con sus niveles/silencios de entrada. **Abrir** permite recuperarlo, incluyendo archivos de la versión anterior. Las fuentes quedan desconectadas al abrir: pulsá **Conectar** para autorizar una nueva captura. No hay guardado automático.
6. **Mezcla WAV** exporta de una a ocho vueltas de la mezcla actual en PCM mono de 16 bits. Respeta el volumen general, los silencios y los solos; no graba una actuación en vivo.

**Espacio** inicia la primera pista vacía o cierra la grabación en curso conservando el audio. Durante la cuenta regresiva o la espera del ciclo, no cancela la preparación. Si cerrás una capa antes de tiempo, conserva lo grabado y completa el resto del ciclo con silencio para mantener la sincronización. Con las seis pistas completas, reproduce/detiene sin borrar. Nunca ejecuta el borrado, aunque ese botón tenga el foco del teclado.

Los atajos `1`–`6` graban, cierran o silencian la pista; `Escape` cancela una grabación. Los atajos se desactivan al editar campos y deslizadores. **Cancelar**, `Escape` y **Detener todo** siguen permitiendo descartar una grabación incompleta de forma explícita.

## Audio y privacidad

Cada loop puede usar una fuente diferente. Las entradas de hardware se comparten internamente cuando varias pistas eligen el mismo dispositivo, pero cada pista tiene su propia ganancia y silencio **antes de grabar**. El volumen **VOL** modifica solamente la reproducción. Se graba una pista por vez. **Escuchar entrada** permite monitorear una sola fuente a la vez y empieza apagado; al grabar otra fuente se apaga la escucha anterior.

- **Micrófono / dispositivos**: entradas que Windows y el navegador exponen, incluida una interfaz Focusrite o una entrada loopback/virtual ya configurada. Una salida de altavoces no se convierte automáticamente en entrada. Si faltan nombres, conectá primero una entrada para dar permiso y actualizá los dispositivos.
- **Aplicación / ventana**: abre el selector del navegador, donde podés elegir Pro Tools si está disponible. Activá **Compartir audio**. La captura de una ventana con audio depende del navegador, Windows y el controlador; SEIS rechaza selecciones sin pista de audio. Los programas en modo ASIO/exclusivo pueden requerir loopback o una entrada virtual configurada fuera de SEIS.
- **Pestaña del navegador**: seleccioná la pestaña con audio del navegador donde abriste SEIS. Para capturar una pestaña de Edge, abrí SEIS también en Edge; desde Chrome podés intentar capturar la ventana de Edge.
- **Todo el audio del sistema**: incluye otras aplicaciones y la propia reproducción de SEIS. No aísla Pro Tools. Su escucha directa se deshabilita para evitar realimentación; revisá qué está sonando antes de grabar.

El selector de aplicaciones lo administra el navegador; no es una lista de procesos de Windows. SEIS solicita audio de ventana aislado como preferencia, pero la disponibilidad y el alcance final son los que ofrece el diálogo del navegador. No instala controladores ni modifica la configuración de Pro Tools. Si la fuente se desconecta durante una toma, conserva la parte válida grabada y completa con silencio cuando corresponde; no borra las otras pistas.

**Salida de reproducción** permite seleccionar auriculares/interfaz cuando el navegador implementa `AudioContext.setSinkId` y autoriza el dispositivo. En otros navegadores usa la salida del sistema. No cambia el volumen de otras aplicaciones ni la salida predeterminada de Windows.

La entrada es mono y cada loop dura entre 0,25 y 120 segundos. Un único AudioWorklet mantiene las seis pistas en el mismo ciclo de muestras. La sesión guarda muestras flotantes de 32 bits sin compresión con pérdida. La exportación tiene un máximo de diez minutos.

El audio y los archivos de sesión se procesan en el navegador. No se suben al sitio ni se incluyen en el repositorio. HTTPS permite solicitar el micrófono y las capturas. Para habilitar sonido de aplicaciones, `getDisplayMedia` también exige compartir una superficie visual: SEIS mantiene la captura abierta, pero solo conecta sus pistas de audio al motor, sin guardar ni transmitir video. **Desconectar entradas** detiene todas las capturas. La web no las activa automáticamente y no usa cuentas, analítica ni almacenamiento remoto. Los archivos guardan identificadores y etiquetas de las fuentes, nunca permisos ni capturas activas.

Usá auriculares para no volver a grabar la reproducción. La latencia depende del dispositivo; en la guía desplegable se puede adelantar la captura de nuevas capas hasta 500 ms. Para sesiones largas, conviene detener la reproducción antes de guardar o exportar. La escucha directa está desactivada al abrir.

## Desarrollo y pruebas

- Todos los recursos de producción están en `loop/`. Las rutas de la interfaz resuelven bajo `/loop/`; el procesador se carga con una URL relativa al módulo.
- Ejecutá `node --test loop/tests/*.test.mjs` desde la raíz del repositorio, o `npm test` dentro de `loop`.
- Abrí `/loop/tests/browser.html` para doce verificaciones del AudioWorklet real con seis señales sintéticas diferentes, sin pedir el micrófono ni emitir sonido.
- `/loop/tests/ui.html` permite probar los controles y la cuenta regresiva con señales sintéticas; usa la interfaz de producción y empieza con la salida en cero. **Verificar fuentes y teclas** ejecuta trece comprobaciones, incluyendo el archivo producido por Guardar, reapertura, captura sin audio y finalización de fuentes. La aplicación normal no carga ese entorno de prueba.
- Las pruebas unitarias incluyen enrutamiento por pista, entradas compartidas, permisos rechazados, capturas sin audio, liberación de medios, pérdida de fuentes y compatibilidad de sesiones anteriores.
- No hace falta modificar el dominio, los workflows de catálogo ni los demás proyectos.

Las pruebas sintéticas verifican captura, mezcla, sincronización, guardado y WAV; no sustituyen una escucha del micrófono y la latencia del equipo de cada usuario.

Referencias de compatibilidad: [captura de pantalla y audio](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia), [controles de captura de Chrome](https://developer.chrome.com/docs/web-platform/screen-sharing-controls), [selección de salida](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/setSinkId).
