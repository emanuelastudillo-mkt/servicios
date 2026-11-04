import { calibrate } from '../calibration.js?v=1.6.0';
const run = document.querySelector('#run'), results = document.querySelector('#results');
run.onclick = async () => {
  run.disabled = true; results.textContent = ''; let checks = 0, ctx;
  const assert = (condition, text) => { if (!condition) throw Error(text); checks++; results.textContent += 'OK · ' + text + '\n'; };
  try {
    ctx = new AudioContext({ sampleRate: 48000 }); await ctx.resume();
    const input = ctx.createGain(), output = ctx.createGain(), delay = ctx.createDelay(1), silent = ctx.createGain();
    delay.delayTime.value = .083; silent.gain.value = 0;
    output.connect(delay); delay.connect(input); output.connect(silent); silent.connect(ctx.destination);
    const measurement = await calibrate(ctx, input, new AbortController().signal, output);
    assert(measurement.ms >= 82.5 && measurement.ms <= 90, `AudioWorklet detecta retorno de 83 ms (medido ${measurement.ms.toFixed(2)} ms, incluye el ciclo del grafo)`);
    assert(measurement.confidence > .9 && measurement.spreadMs < 1, 'Tres señales consistentes y correlación alta');
    delay.disconnect(input);
    let missing;
    try { await calibrate(ctx, input, new AbortController().signal, output); } catch (error) { missing = error; }
    assert(missing?.message.includes('retorno claro'), 'Una fuente sin retorno no produce una calibración falsa');
    delay.connect(input); const abort = new AbortController();
    const canceled = calibrate(ctx, input, abort.signal, output).catch(error => error); setTimeout(() => abort.abort(), 150);
    assert((await canceled).name === 'AbortError', 'Cancelar interrumpe y limpia el AudioWorklet');
    const again = await calibrate(ctx, input, new AbortController().signal, output);
    assert(Math.abs(again.ms - measurement.ms) < .2, 'Se puede medir otra vez después de error y cancelación');
    results.textContent += `\nRESULTADO: ${checks} comprobaciones correctas.`;
  } catch (error) { results.textContent += 'ERROR: ' + (error.stack || error.message); }
  finally { await ctx?.close(); run.disabled = false; }
};
