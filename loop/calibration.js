import { measureLatency } from './latency.js?v=1.3.0';
const modules = new WeakMap();
export async function calibrate(ctx, input, signal, output = ctx.destination) {
  if (!modules.has(ctx)) modules.set(ctx, ctx.audioWorklet.addModule(new URL('./latency-processor.js?v=1.3.0', import.meta.url)).catch(error => { modules.delete(ctx); throw error; }));
  await modules.get(ctx);
  if (signal.aborted) throw new DOMException('Medición cancelada.', 'AbortError');
  return new Promise((resolve, reject) => {
    const node = new AudioWorkletNode(ctx, 'seis-latency-probe', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit' });
    let finished = false;
    const done = (error, result) => {
      if (finished) return; finished = true; clearTimeout(timeout); signal.removeEventListener('abort', cancel);
      node.port.postMessage({ type: 'stop' }); node.port.onmessage = null;
      try { input.disconnect(node); } catch { /* Source disconnected while measuring. */ }
      node.disconnect(); node.port.close();
      if (error) reject(error); else resolve(result);
    };
    const cancel = () => done(new DOMException('Medición cancelada. Se conserva el ajuste anterior.', 'AbortError'));
    const timeout = setTimeout(() => done(Error('La medición se interrumpió o el audio quedó suspendido. Repetí con SEIS visible.')), 10000);
    signal.addEventListener('abort', cancel, { once: true });
    node.onprocessorerror = () => done(Error('No se pudo completar la medición de audio.'));
    node.port.onmessage = ({ data }) => { try { done(null, measureLatency(data.samples, ctx.sampleRate)); } catch (error) { done(error); } };
    try { input.connect(node); node.connect(output); node.port.postMessage({ type: 'start' }); } catch (error) { done(error); }
  });
}
