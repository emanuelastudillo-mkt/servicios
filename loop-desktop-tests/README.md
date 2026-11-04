# Comprobaciones de la escucha nativa

Este proyecto ejecuta únicamente cálculo DSP, decodificación PCM y colas con muestras sintéticas. No inicia SEIS, no abre dispositivos y no sustituye una medición con la placa.

```powershell
node loop-desktop-tests/fixtures.mjs 'C:/ruta/fixtures'
dotnet run --project loop-desktop-tests/MonitorTests.csproj -c Release -- 'C:/ruta/fixtures'
node --test loop/tests/native-monitor.test.mjs loop/tests/inputs.test.mjs
```

Las referencias se generan con `loop/effects.js` a 44,1 y 48 kHz: 16 efectos, cadena completa y vacía, parámetros extremos, cambios de orden, bypass y encendido. Se comparan 72 renderizados completos con el DSP C#, con tolerancia absoluta 0,00002. También se comprueban colas acotadas, subalimentación, remuestreo, valores no finitos, separación de canales y PCM de 24 bits.

En el servidor local, `loop/tests/native-monitor-ui.html` prueba el flujo completo con el puente Windows simulado y salida en cero: captura por canal, retorno web apagado, efectos, selección de salida, afinador, desconexión y fallo de salida. `loop/tests/native.html` comprueba que el puente PCM sigue grabando y compartiendo las entradas entre seis pistas.
