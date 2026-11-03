import { encodeSession, decodeSession, encodeWav } from '../files.js';
const results = document.querySelector('#results');
const write = text => { results.textContent += `${text}\n`; };
const assert = (condition, text) => { if (!condition) throw Error(text); write(`OK · ${text}`); };
document.querySelector('#run').onclick = async () => {
  document.querySelector('#run').disabled = true; results.textContent = '';
  let ctx;
  try {
    ctx = new AudioContext({ sampleRate: 48000 }); await ctx.resume();
    await ctx.audioWorklet.addModule(new URL('../processor.js?v=1.0.1', import.meta.url));
    const node = new AudioWorkletNode(ctx, 'seis-looper', { outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit' });
    const muted = ctx.createGain(); muted.gain.value = 0; node.connect(muted).connect(ctx.destination);
    const osc = ctx.createOscillator(); osc.frequency.value = 440;
    const amplitude = ctx.createGain(); amplitude.gain.value = .1; osc.connect(amplitude).connect(node); osc.start();
    let status, lastError, captured, recorded = [];
    node.port.onmessage = ({ data }) => {
      if (data.type === 'status') status = data.data;
      if (data.type === 'error') lastError = data.message;
      if (data.type === 'recorded') recorded.push(data.id);
      if (data.type === 'snapshot') captured = data.data;
    };
    const waitFor = (check, timeout = 5000) => new Promise((resolve, reject) => {
      const start = performance.now();
      const timer = setInterval(() => {
        if (lastError) { clearInterval(timer); reject(Error(lastError)); }
        else if (check()) { clearInterval(timer); resolve(); }
        else if (performance.now() - start > timeout) { clearInterval(timer); reject(Error('Tiempo de espera agotado.')); }
      }, 20);
    });
    node.port.postMessage({ type: 'record', id: 0 });
    await waitFor(() => status?.recording?.countdownFrames > 0);
    assert(status.recording.written === 0, 'Loop 1 muestra la preparación antes de capturar audio');
    await waitFor(() => status?.recording?.countdownFrames <= ctx.sampleRate * 2);
    assert(status.recording.countdownFrames > 0 && status.recording.written === 0, 'La cuenta avanza sin incluir muestras en la grabación');
    await waitFor(() => status?.recording?.written >= 18000);
    node.port.postMessage({ type: 'finish' });
    await waitFor(() => recorded.includes(0));
    const length = status.length;
    assert(length >= 18000 && length < 30000, 'AudioWorklet captura el primer loop y fija el ciclo');
    for (let i = 1; i < 6; i++) {
      node.port.postMessage({ type: 'record', id: i });
      await waitFor(() => recorded.includes(i));
    }
    node.port.postMessage({ type: 'snapshot', requestId: 1 }); await waitFor(() => captured);
    assert(captured.tracks.every(t => t.samples?.length === length), 'Las seis grabaciones tienen exactamente la misma cantidad de muestras');
    assert(captured.tracks.every(t => t.samples.some(x => Math.abs(x) > .05)), 'Las seis pistas contienen la señal de entrada');
    assert(status.playing && status.outputPeak > .01, 'El motor reproduce la mezcla en el navegador');
    const reopened = decodeSession(encodeSession(captured, 'QA navegador', ['A', 'B', 'C', 'D', 'E', 'F']));
    assert(reopened.tracks.every((t, i) => t.samples.every((n, j) => n === captured.tracks[i].samples[j])), 'Guardar y abrir conserva cada muestra de las seis pistas');
    const wav = encodeWav(reopened, 2); const decoded = await ctx.decodeAudioData(wav.slice(0));
    assert(decoded.numberOfChannels === 1 && Math.abs(decoded.duration - length * 2 / ctx.sampleRate) < .0001, 'El WAV se decodifica con duración y canales correctos');
    assert(decoded.getChannelData(0).some(x => Math.abs(x) > .01), 'El WAV exportado contiene audio');
    node.port.postMessage({ type: 'stop' }); await waitFor(() => !status.playing);
    assert(status.position === 0, 'Detener vuelve al inicio del ciclo');
    node.port.postMessage({ type: 'load', data: reopened });
    node.port.postMessage({ type: 'play' }); await waitFor(() => status.playing);
    assert(status.tracks.filter(t => t.hasAudio).length === 6, 'La sesión reabierta vuelve a reproducir las seis pistas');
    osc.stop(); node.disconnect();
    write('\nRESULTADO: 11 comprobaciones correctas.');
  } catch (e) { write(`ERROR: ${e.stack || e.message}`); }
  finally { await ctx?.close(); document.querySelector('#run').disabled = false; }
};
