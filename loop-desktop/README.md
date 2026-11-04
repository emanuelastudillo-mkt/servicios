# SEIS 1.8.0 · Escritorio para Windows

Ejecutable portátil de 64 bits. La interfaz y el motor de loops están incluidos en el archivo: funcionan sin cargar el sitio ni iniciar un servidor local. Incluye .NET; requiere **Microsoft Edge WebView2 Runtime**, normalmente presente en Windows 10/11. Descarga oficial del runtime: https://developer.microsoft.com/microsoft-edge/webview2/.

## Instrumento con efectos y menor retardo

Elegí la entrada **Instrumentos · escucha nativa**, el canal físico y conectala. En **FX**, seleccioná la **Salida de escucha nativa** de la placa y activá **Escuchar con efectos**. Desactivá Direct Monitor en la Scarlett para escuchar solo el retorno procesado. La salida superior reproduce los loops; las dos salidas se vinculan si sus nombres identifican inequívocamente el mismo dispositivo. Si no, elegí la placa en ambas.

El retorno nativo usa WASAPI / IAudioClient3 y los 16 efectos en C#, evitando el trayecto Web Audio. Mantiene grabaciones secas y parámetros editables. Los períodos mostrados no son una medición de latencia de ida y vuelta. Si el controlador no concede período mínimo se indica modo compatible. No incluye ASIO ni promete latencia cero; hay que comprobar el resultado con el instrumento y la placa. La escucha de aplicaciones conserva la ruta anterior.

Pruebas DSP y de canales/cola: [`loop-desktop-tests`](../loop-desktop-tests/README.md). La prueba del estudio con hardware real sigue pendiente por el bloqueo automático de ejecución del entorno.

## Usar

1. Abrí `SEIS-1.8.0-Windows-x64.exe`. La versión aparece en la ventana y en la interfaz.
2. Elegí la **Salida de reproducción**: auriculares, altavoces o interfaz. Esto afecta SEIS, no cambia la salida predeterminada de Windows.
3. Elegí la **Entrada de grabación** de una pista: micrófono/interfaz, aplicación de Windows o audio de una salida (loopback). Pulsá **Conectar** y comprobá el medidor. Actualizá la lista si abriste otra aplicación.
4. **Sincronizar** mide el retorno de la entrada o permite ingresar su retardo total. Prepará el retorno según la ayuda antes de medir. **Aplicar a todas** copia fuente, ganancia, silencio y compensación de entrada. Si está conectada, comparte esa captura con las otras cinco pistas. Conserva las tomas, nombres, mezcla y volúmenes de reproducción. Está deshabilitado durante una grabación.
5. Grabá una pista por vez. Loop 1 mantiene sus tres segundos de preparación; Espacio inicia o cierra la toma sin borrar. Guardá la sesión antes de cerrar. Guardar y exportar WAV abren el diálogo de archivos de Windows.

Las aplicaciones se identifican por proceso y sus descendientes, no por pestaña. Al elegir Chrome/Edge se captura el audio de ese proceso del navegador, que puede incluir varias pestañas. Los procesos se vuelven a validar al conectar para evitar que un PID reutilizado capture otra aplicación.

**Pro Tools y ASIO:** la captura por aplicación usa WASAPI de Windows. No es un controlador ASIO y no garantiza capturar un programa que usa ASIO, modo exclusivo o audio protegido. En ese caso elegí una entrada loopback de la placa o un dispositivo virtual configurado. La captura de una salida incluye todo lo que suena por ella, incluso SEIS; su escucha directa se deshabilita para evitar realimentación. La disponibilidad del loopback por proceso depende de Windows y sus actualizaciones.

Las sesiones `.seisloop` conservan el audio y son compatibles con la web. Las entradas de escritorio quedan desconectadas al abrir y deben reconectarse. Si la aplicación se reinició o un identificador de micrófono cambia entre la web y el escritorio, elegí de nuevo esa fuente. Las sesiones anteriores siguen abriendo.

La ventana inicia maximizada y la vista compacta mantiene seis pistas, duración y transporte en el área principal. La descarga/actualizaciones queda al final, después de la ayuda y el pie.

## Latencia y Scarlett 2i2 de 3.ª generación

Esta placa no incluye loopback interno. La sincronización no habilita por sí misma una captura ASIO: primero comprobá que el medidor de SEIS reciba el audio de Pro Tools. Si hace falta un retorno virtual o físico, debe estar configurado antes de medir.

La calibración emite tres señales y mide el recorrido real hasta la entrada elegida, incluidos los efectos de Pro Tools solo si la señal pasa por ellos. No hay un valor fijo para esta placa. Un retorno ausente, saturado o inestable no se aplica. El modo manual permite ingresar el total en ms sin sumar otra estimación encima. La compensación se guarda en la sesión; se invalida si cambia entrada, salida o frecuencia. Volvé a medir cuando cambies búfer, efectos o ruta. Ver [guía de sincronización](../loop/README.md#sincronizar-nuevas-capas).

Solo se alinean las tomas nuevas; el primer loop y las grabaciones existentes se conservan. La captura espera el retardo configurado y recibe también el final de la interpretación. El monitoreo en vivo mantiene la demora de su recorrido.

## Privacidad y distribución

No se envía audio a servidores. No se captura video. La captura comienza únicamente al pulsar Conectar o Grabar (si la fuente todavía no estaba conectada), y se libera con Desconectar o al cerrar. El perfil local de WebView2 vive en `%LOCALAPPDATA%\SEIS\WebView2`; no contiene un guardado automático de las tomas. Los archivos de sesión los guarda el usuario donde elige.

El ejecutable no tiene firma Authenticode. Las licencias de NAudio, .NET y WebView2 están incluidas y se pueden consultar con **Versión y licencias**. La aplicación abre solamente los recursos incorporados; no expone un puerto local ni acceso general al sistema de archivos desde la interfaz.

Desde 1.5.0 se incorpora la interfaz analógica, luces de estado y perillas accesibles también sin conexión. El motor de audio y los archivos de sesión mantienen su formato.

## Compilar y publicar

Desde 1.4.0, Simple / Avanzado y Revisar audio están incluidos también sin conexión a internet. La captura por proceso se comprueba mediante activación del propio SEIS, sin empezar a grabar ni emitir sonido. No se decide solo por el número de Windows: la prueba local confirmó captura en build 19045, anterior al mínimo publicado en el ejemplo de Microsoft. Una incompatibilidad explícita oculta aplicaciones; un fallo temporal se informa como capacidad sin confirmar y permite intentar conectar. La espera inicial está limitada a tres segundos y una activación tardía se libera. Esto no convierte ASIO en WASAPI ni certifica que una aplicación listada entregue señal. Si falta WebView2, el inicio muestra un botón a la descarga oficial de Microsoft y otro a SEIS web; no instala nada automáticamente. Los errores de inicio de otro origen se muestran sin atribuirlos a WebView2.

Requiere Windows x64 y el SDK .NET 10.0.403. Dependencias fijadas en `packages.lock.json`.

```powershell
./loop-desktop/build.ps1 -DotnetPath 'C:/ruta/al/sdk/dotnet.exe'
```

El script genera el ejecutable con versión y actualiza el tamaño/SHA-256 en `loop/desktop-release.json`. No elimina versiones anteriores. El enlace de `loop/index.html`, el manifiesto, el proyecto C# y `loop/package.json` deben compartir versión; las pruebas verifican esta consistencia.

Publicá el ejecutable como activo de GitHub Releases, etiqueta **seis-v1.8.0**, nombre exacto **SEIS-1.8.0-Windows-x64.exe**. El código fuente debe estar en el commit de esa etiqueta. Publicá el activo antes de actualizar `/loop` para que el botón tenga una descarga disponible. En versiones siguientes, actualizá conjuntamente versión, manifiesto y enlace; este repositorio también contiene otros proyectos, por eso no se usa una redirección genérica a cualquier release del repositorio.

## Verificación

```powershell
node --test loop/tests/*.test.mjs
./SEIS-1.8.0-Windows-x64.exe --self-test 'C:/ruta/reporte-audio.json'
./SEIS-1.8.0-Windows-x64.exe --smoke-test 'C:/ruta/reporte-inicio.json'
```

`--self-test` enumera fuentes y comprueba captura WASAPI del propio proceso con un tono de diagnóstico de -80 dBFS; no graba el micrófono ni guarda muestras de otras aplicaciones. El informe incluye activación, muestras recibidas y conversión PCM. `--smoke-test` abre la interfaz, comprueba versión, seis pistas, entradas nativas, salidas y botones, y carga los tres AudioWorklets incorporados; luego cierra la instancia. Los informes quedan solo en las rutas elegidas.

La prueba web `/loop/tests/native.html` verifica el puente PCM, la ganancia por pista y la liberación de una captura compartida. `/loop/tests/ui.html` comprueba Aplicar a todas, Espacio, guardado y reapertura. Las pruebas no certifican todas las placas, versiones de Windows o configuraciones de Pro Tools.

Referencias: [WASAPI por aplicación, Microsoft](https://learn.microsoft.com/en-us/samples/microsoft/windows-classic-samples/applicationloopbackaudio-sample/), [NAudio WasapiRecorder](https://github.com/naudio/NAudio/blob/main/Docs/WasapiRecorder.md).

Desde 1.6.0, la vista comienza en Loop 1 y avanza panel por panel al terminar cada toma. Los loops listos se compactan sin cortar audio; su botón permite detener/reanudar. Abrir los 6 conserva la vista completa, y Paso a paso vuelve a la primera pista vacía. Grabar también conecta la entrada elegida si hace falta. No se inicia ninguna captura al abrir la aplicación.

Desde 1.7.0, FX abre una cadena de 16 efectos editables por loop y un afinador. Escuchar con efectos permite monitorear antes o durante la toma; la grabación original se conserva. El WAV usa los efectos y se genera en segundo plano con progreso y cancelación. La mezcla sigue siendo mono. Las nuevas sesiones conservan los pedales y requieren v1.7 o posterior; la v1.7 abre las sesiones anteriores. Consultá la guía web para controles, afinador y límites del pitch granular.
