# SEIS · Looper de audio

Aplicación estática publicada en **https://emanuelmkt.com.ar/loop/** mediante el GitHub Pages existente del repositorio. La ruta `/loop` redirige a `/loop/`. No requiere compilación, servidor de audio ni dependencias externas.

**Versión 1.4.0:** el botón **Descargar última versión de escritorio** ofrece el ejecutable portátil para Windows x64. Código fuente, requisitos y compilación en [`loop-desktop`](../loop-desktop/README.md). La versión de escritorio incluye captura nativa de aplicaciones y salidas de Windows; la versión web mantiene los permisos y opciones del navegador.

**Aplicar a todas**, disponible en cada pista, copia fuente, ganancia, silencio y compensación de entrada a las seis. Si la fuente ya está conectada, comparte la conexión. Conserva el audio grabado, los nombres y la mezcla. Si está desconectada, copia la asignación; conectá una pista y volvé a aplicar para compartirla. No funciona durante una toma.

La vista de escritorio distribuye los seis loops en dos filas y ajusta las ondas al alto disponible. El transporte, la duración y las seis pistas caben desde una ventana de 780 × 600 píxeles de contenido a escala 100 %. Ayuda, exportación y descarga están después del escritorio; la descarga es el último bloque. En móviles se prioriza la legibilidad y se permite desplazamiento.

## Uso

**Simple / Avanzado (1.4.0):** primera visita en Simple. El selector superior recuerda la preferencia en este navegador o perfil de escritorio; no guarda audio. Simple muestra fuente, conexión, grabar/silenciar, volumen, borrado, medidor y Aplicar a todas. Avanzado agrega Solo, ganancia y silencio de entrada, escucha y sincronización. Cambiar de modo no altera tomas, conexiones, niveles ni compensación. Simple indica si siguen activos Solo, Escuchar, entrada silenciada o compensación; Ajustes abre Avanzado en esa pista. Si el almacenamiento de preferencias está bloqueado, la aplicación sigue funcionando.

**Revisar audio:** informa las funciones disponibles en el entorno y guía la conexión. Comprobar señal observa durante tres segundos una entrada ya conectada: distingue señal, silencio, saturación, entrada silenciada y desconexión. No crea una captura nueva ni guarda audio. Probar salida emite un tono suave de un segundo, respeta el volumen general y requiere loops detenidos y escucha apagada; enviar el tono no certifica que el usuario lo haya oído. Cerrar cancela la prueba. Reactivar audio permite recuperar un motor suspendido sin reemplazar la sesión. Dentro de los diálogos, Espacio actúa sobre su control y no ejecuta atajos de loops.

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

Usá auriculares para no volver a grabar la reproducción. Para sesiones largas, conviene detener la reproducción antes de guardar o exportar. La escucha directa está desactivada al abrir.

## Sincronizar nuevas capas

En cada pista, **Sincronizar** permite elegir estimación automática, retardo total manual (0–750 ms), medición de retorno o desactivar la compensación. La estimación automática solo se aplica cuando el navegador informa entrada y salida de un dispositivo; no inventa la demora de Pro Tools ni usa el cero de un MediaStream sintético como latencia real.

**Medir retorno** emite tres señales suaves y mide su regreso por la fuente conectada. Detené la reproducción, prepará el retorno y marcá la casilla antes de medir. La emisión y la captura usan el mismo reloj de muestras. Sin retorno reconocible, con saturación o con variación superior a 3 ms, la prueba no aplica ningún ajuste. Después de una medición válida, pulsá **Aplicar a esta entrada**. El total medido reemplaza la estimación; no se suma dos veces.

El primer loop conserva la referencia. Las capas nuevas esperan el inicio del ciclo más el retardo compensado y capturan un ciclo completo, incluida su cola; no reemplazan esa cola con audio de antes del comienzo. La duración común permanece intacta. Solo se modifican tomas nuevas. Al cerrar una capa con Espacio, SEIS muestra Cerrando mientras recibe su final retrasado; pulsaciones repetidas no extienden ni borran esa toma.

La sesión guarda el ajuste por entrada y la combinación de entrada, salida y frecuencia. Si cambia esa combinación, aparece **Recalibrar** y el valor anterior no se aplica automáticamente. El programa no puede detectar un cambio de búfer o efectos dentro de Pro Tools: repetí la medición cuando los cambies. Las sesiones anteriores siguen abriendo.

**Scarlett 2i2 de 3.ª generación y Pro Tools:** esta placa no tiene loopback interno. El audio debe llegar primero a SEIS por una ruta compatible. ASIO puede no aparecer en la captura por aplicación de Windows. Para medir el recorrido completo de Pro Tools, la señal de SEIS debe pasar por su misma pista/efectos y volver a la fuente seleccionada; puede requerir una ruta virtual o conexión física. La ayuda del ajuste explica el retorno por entrada de línea, Direct Monitor apagado y cómo evitar devolver la señal al mismo cable. La calibración alinea grabaciones, no elimina la demora del monitoreo en vivo.

Referencias: [Focusrite: interfaces con loopback](https://support.focusrite.com/hc/en-gb/articles/27140338179858-Which-Focusrite-interfaces-feature-Loopback), [latencia de salida Web Audio](https://www.w3.org/TR/webaudio-1.1/#dom-audiocontext-outputlatency), [latencia de entrada Media Capture](https://www.w3.org/TR/mediacapture-streams/#dom-mediatracksettings-latency). También se revisaron las páginas 10 y 13 de Scarlett 2i2 3rd Gen User Guide V2, suministrado por el usuario; el PDF no se redistribuye.

## Desarrollo y pruebas

`node --test tests/*.test.mjs` incluye 55 comprobaciones. `tests/calibration.html` ejecuta cinco pruebas con AudioWorklet real, retorno sintético de 83 ms, ausencia de señal y cancelación. La medición física con la Scarlett y la sesión de Pro Tools del usuario requiere su ruta de audio configurada; no se ha certificado esa cadena real.

- Todos los recursos de producción están en `loop/`. Las rutas de la interfaz resuelven bajo `/loop/`; el procesador se carga con una URL relativa al módulo.
- Ejecutá `node --test loop/tests/*.test.mjs` desde la raíz del repositorio, o `npm test` dentro de `loop`.
- Abrí `/loop/tests/browser.html` para doce verificaciones del AudioWorklet real con seis señales sintéticas diferentes, sin pedir el micrófono ni emitir sonido.
- `/loop/tests/ui.html` permite probar los controles y la cuenta regresiva con señales sintéticas; usa la interfaz de producción y empieza con la salida en cero. **Verificar fuentes y teclas** ejecuta 37 comprobaciones, incluyendo Guardar, reapertura, captura sin audio, finalización de fuentes, compensación y Aplicar a todas. La aplicación normal no carga ese entorno de prueba.
- `/loop/tests/native.html` ejecuta cinco comprobaciones del puente PCM de escritorio mediante paquetes sintéticos y el AudioWorklet real.
- Las pruebas unitarias incluyen enrutamiento por pista, entradas compartidas, permisos rechazados, capturas sin audio, liberación de medios, pérdida de fuentes y compatibilidad de sesiones anteriores.
- No hace falta modificar el dominio, los workflows de catálogo ni los demás proyectos.

Las pruebas sintéticas verifican captura, mezcla, sincronización, guardado y WAV; no sustituyen una escucha del micrófono y la latencia del equipo de cada usuario.

Referencias de compatibilidad: [captura de pantalla y audio](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia), [controles de captura de Chrome](https://developer.chrome.com/docs/web-platform/screen-sharing-controls), [selección de salida](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/setSinkId).
