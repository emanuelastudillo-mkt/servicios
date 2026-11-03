import { InputManager } from '../inputs.js?v=1.2.0';
const results = document.querySelector('#results');
let listener, starts = 0, stops = 0;
const streams = new Map();
window.seisDesktop = { version: '1.2.0' };
window.chrome ||= {};
window.chrome.webview = {
  addEventListener(name, fn) { listener = fn; },
  postMessage({ id, action, args }) {
    if (action === 'capture.start') {
      starts++; let sequence = 0;
      const floats = new Float32Array(480).fill(.2), bytes = new Uint8Array(floats.buffer);
      const samples = btoa(String.fromCharCode(...bytes));
      const timer = setInterval(() => listener({ data: { type: 'pcm', captureId: args.captureId, samples, rate: 48000, sequence: ++sequence } }), 10);
      streams.set(args.captureId, timer);
      queueMicrotask(() => listener({ data: { type: 'reply', id, result: { label: 'Aplicación sintética', rate: 48000 } } }));
    } else {
      stops++; clearInterval(streams.get(args.captureId)); streams.delete(args.captureId);
      queueMicrotask(() => listener({ data: { type: 'reply', id, result: { stopped: true } } }));
    }
  }
};
document.querySelector('#run').onclick = async () => {
  document.querySelector('#run').disabled = true; results.textContent = ''; starts = 0; stops = 0;
  let ctx, manager;
  const assert = (ok, text) => { if (!ok) throw Error(text); results.textContent += 'OK · ' + text + '\n'; };
  const wait = check => new Promise((resolve, reject) => {
    const start = performance.now(), timer = setInterval(() => { if (check()) { clearInterval(timer); resolve(); } else if (performance.now() - start > 6500) { clearInterval(timer); reject(Error('Tiempo agotado')); } }, 25);
  });
  try {
    const { captureNative } = await import('../desktop.js?v=1.2.0');
    ctx = new AudioContext({ sampleRate: 48000 }); await ctx.resume(); await ctx.audioWorklet.addModule('../processor.js?v=1.2.0');
    const node = new AudioWorkletNode(ctx, 'seis-looper', { numberOfInputs: 6, outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit' });
    const gain = ctx.createGain(); gain.gain.value = 0; node.connect(gain).connect(ctx.destination);
    const getGraph = async () => ({ ctx, node });
    manager = new InputManager({ getGraph, nativeCapture: config => captureNative(config, getGraph) });
    manager.setConfig(0, { kind: 'native', deviceId: 'app:fake', label: 'Aplicación sintética', gain: 1, muted: false });
    await manager.connect(0); await manager.applyToAll(0);
    assert(starts === 1 && manager.slots.every(Boolean), 'Una captura nativa compartida entre seis pistas');
    let status, snapshot, error;
    node.port.onmessage = ({ data }) => { if (data.type === 'status') status = data.data; if (data.type === 'snapshot') snapshot = data.data; if (data.type === 'error') error = data.message; };
    node.port.postMessage({ type: 'record', id: 0 }); await wait(() => status?.recording?.written >= 18000 || error);
    if (error) throw Error(error); node.port.postMessage({ type: 'finish' }); await wait(() => status?.tracks[0].hasAudio);
    manager.setConfig(1, { ...manager.configs[1], gain: .5 });
    node.port.postMessage({ type: 'record', id: 1 }); await wait(() => status?.tracks[1].hasAudio);
    node.port.postMessage({ type: 'snapshot', requestId: 1 }); await wait(() => snapshot);
    const average = samples => samples.slice(200, -200).reduce((n, x) => n + x, 0) / (samples.length - 400);
    assert(Math.abs(average(snapshot.tracks[0].samples) - .2) < .015, 'Paquetes PCM atraviesan el puente y llegan al loop');
    assert(Math.abs(average(snapshot.tracks[1].samples) - .1) < .015, 'Cada pista conserva su ganancia antes de grabar la entrada compartida');
    manager.disconnect(0); assert(stops === 0, 'Desconectar una pista no interrumpe las otras');
    manager.disconnectAll(); assert(stops === 1 && streams.size === 0, 'La última desconexión libera la captura nativa');
    results.textContent += '\nRESULTADO: 5 comprobaciones correctas.';
  } catch (e) { results.textContent += 'ERROR: ' + (e.stack || e.message); }
  finally { manager?.disconnectAll(); await ctx?.close(); document.querySelector('#run').disabled = false; }
};
