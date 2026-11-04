export const desktop = typeof window !== 'undefined' && window.seisDesktop?.version && window.chrome?.webview ? window.seisDesktop : null;
const requests = new Map(), captures = new Map();
let requestId = 0, modulePromise;
export function desktopRequest(action, args = {}) {
  if (!desktop) return Promise.reject(Error('Esta opción necesita SEIS de escritorio.'));
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    const timer = setTimeout(() => { requests.delete(id); reject(Error('Windows no respondió a tiempo. Volvé a intentar.')); }, 20000);
    requests.set(id, { resolve, reject, timer });
    window.chrome.webview.postMessage({ id, action, args });
  });
}
if (desktop) window.chrome.webview.addEventListener('message', ({ data }) => {
  if (data.type === 'reply') {
    const request = requests.get(data.id); if (!request) return;
    clearTimeout(request.timer); requests.delete(data.id);
    if (data.error) request.reject(Error(data.error)); else request.resolve(data.result);
  } else if (data.type === 'pcm') {
    const capture = captures.get(data.captureId); if (!capture) return;
    const raw = atob(data.samples), bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    if (bytes.length % 4) return;
    const samples = new Float32Array(bytes.buffer);
    capture.node.port.postMessage({ samples, rate: data.rate, sequence: data.sequence }, [samples.buffer]);
  } else if (data.type === 'ended') {
    const capture = captures.get(data.captureId); if (!capture) return;
    capture.stream.release();
    for (const track of capture.stream.getTracks()) { track.stop(); track.dispatchEvent(new Event('ended')); }
  }
});

export async function captureNative(config, getGraph) {
  const { ctx } = await getGraph();
  modulePromise ||= ctx.audioWorklet.addModule(new URL('./native-processor.js?v=1.6.0', import.meta.url)).catch(e => { modulePromise = null; throw e; });
  await modulePromise;
  const id = crypto.randomUUID(), node = new AudioWorkletNode(ctx, 'seis-native-input', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
  const destination = ctx.createMediaStreamDestination(); node.connect(destination);
  const stream = destination.stream; stream.sourceLabel = config.label;
  let released = false;
  stream.release = () => {
    if (released) return; released = true;
    captures.delete(id); node.port.postMessage({ type: 'stop' }); node.disconnect(); destination.disconnect();
    desktopRequest('capture.stop', { captureId: id }).catch(() => {});
  };
  captures.set(id, { node, stream });
  try {
    const result = await desktopRequest('capture.start', { sourceId: config.deviceId, captureId: id });
    stream.sourceLabel = result.label || config.label;
    if (released) throw Error('La entrada se desconectó durante la conexión.');
    return stream;
  } catch (e) { stream.release(); stream.getTracks().forEach(t => t.stop()); throw e; }
}
