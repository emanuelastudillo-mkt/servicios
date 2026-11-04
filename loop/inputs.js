import { latencyConfig } from './latency.js?v=1.5.0';
export const INPUT_KINDS = ['device', 'window', 'tab', 'system', 'native'];
export function inputConfig(value) {
  if (value == null) return { kind: 'device', deviceId: '', label: '', gain: 1, muted: false, latency: latencyConfig() };
  if (!INPUT_KINDS.includes(value.kind) || typeof value.deviceId !== 'string' || value.deviceId.length > 512 ||
      typeof value.label !== 'string' || value.label.length > 200 || !Number.isFinite(value.gain) ||
      value.gain < 0 || value.gain > 2 || typeof value.muted !== 'boolean') throw Error('Configuración de entrada inválida.');
  return { kind: value.kind, deviceId: ['device', 'native'].includes(value.kind) ? value.deviceId : '', label: value.label, gain: value.gain, muted: value.muted, latency: latencyConfig(value.latency) };
}

export function captureOptions(kind) {
  return { video: { displaySurface: kind === 'tab' ? 'browser' : kind === 'window' ? 'window' : 'monitor' },
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    systemAudio: kind === 'system' ? 'include' : 'exclude', windowAudio: 'window',
    selfBrowserSurface: 'exclude', surfaceSwitching: 'exclude',
    ...(kind === 'system' ? {} : { monitorTypeSurfaces: 'exclude' }) };
}

const stop = stream => { stream?.release?.(); stream?.getTracks().forEach(track => track.stop()); };

// Each slot has its own gain/analyser and Worklet input. Only physical-device
// streams are shared, with reference counting; captures require a fresh chooser.
export class InputManager {
  constructor({ getGraph, nativeCapture, media = globalThis.navigator?.mediaDevices, makeStream = tracks => new MediaStream(tracks), onChange = () => {}, onEnded = () => {} }) {
    Object.assign(this, { getGraph, nativeCapture, media, makeStream, onChange, onEnded });
    this.configs = Array.from({ length: 6 }, () => inputConfig());
    this.slots = Array(6).fill(null);
    this.pool = new Map(); this.pending = -1; this.generation = 0;
  }
  setConfig(id, value) {
    const next = inputConfig(value), previous = this.configs[id];
    if (next.kind !== previous.kind || next.deviceId !== previous.deviceId) this.disconnect(id);
    this.configs[id] = next;
    const slot = this.slots[id];
    if (slot) slot.gain.gain.setTargetAtTime(next.muted ? 0 : next.gain, slot.ctx.currentTime, .005);
    this.onChange();
  }
  async connect(id) {
    if (this.pending !== -1) return false;
    this.pending = id; this.onChange();
    const config = this.configs[id], generation = this.generation;
    const key = config.kind === 'device' ? config.deviceId || 'default' : config.kind === 'native' ? 'native:' + config.deviceId : null;
    let stream, entry, route, acquired = false;
    try {
      entry = key ? this.pool.get(key) : null;
      if (entry?.dead) entry = null;
      if (!entry) {
        if (!this.media?.getUserMedia) throw Error('Las entradas necesitan HTTPS y una versión actual de Chrome o Edge.');
        if (config.kind === 'native' && !this.nativeCapture) throw Error('Esta fuente necesita SEIS de escritorio. Elegí otra entrada o descargá el ejecutable.');
        if (!['device', 'native'].includes(config.kind) && !this.media.getDisplayMedia) throw Error('Este navegador no permite capturar aplicaciones. Usá Chrome o Edge en la PC.');
        // Invoke the chooser before any await: getDisplayMedia needs the click's
        // transient user activation, even when the AudioContext is still loading.
        const capture = config.kind === 'native' ? this.nativeCapture(config) : config.kind === 'device' ? this.media.getUserMedia({ video: false, audio: {
          ...(config.deviceId ? { deviceId: { exact: config.deviceId } } : {}), channelCount: 1,
          latency: { ideal: .01 }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } }) : this.media.getDisplayMedia(captureOptions(config.kind));
        const [captureResult, graphResult] = await Promise.allSettled([capture, this.getGraph()]);
        if (captureResult.status === 'fulfilled') stream = captureResult.value;
        else throw captureResult.reason;
        if (graphResult.status === 'rejected') throw graphResult.reason;
        const { ctx } = graphResult.value;
        if (!stream.getAudioTracks().some(t => t.readyState === 'live')) throw Error('La selección no comparte audio. Activá «Compartir audio» o usá una entrada loopback/virtual.');
        const surface = stream.getVideoTracks()[0]?.getSettings().displaySurface;
        const expected = { tab: 'browser', window: 'window', system: 'monitor' }[config.kind];
        if (surface && expected && surface !== expected) throw Error('Elegí el tipo de fuente indicado, o cambiá la entrada del loop antes de conectar.');
        entry = { stream, source: ctx.createMediaStreamSource(this.makeStream(stream.getAudioTracks())), refs: new Set(), key, dead: false };
        acquired = true;
      }
      const { ctx, node } = await this.getGraph();
      if (generation !== this.generation) { if (acquired) stop(stream); return false; }
      if (entry.dead || entry.stream.getAudioTracks().some(t => t.readyState !== 'live')) throw Error('La fuente se desconectó. Volvé a conectarla.');
      route = this.attach(id, entry, ctx, node);
      if (key) this.pool.set(key, entry);
      if (acquired) for (const track of entry.stream.getTracks()) track.addEventListener('ended', () => this.endEntry(entry), { once: true });
      this.configs[id] = { ...config, label: (entry.stream.sourceLabel || entry.stream.getAudioTracks()[0].label || config.label).slice(0, 200) };
      return true;
    } catch (e) {
      if (route) { entry.source.disconnect(route.gain); route.gain.disconnect(); route.analyser.disconnect(); }
      if (acquired) entry.source.disconnect();
      if (stream) stop(stream);
      throw e;
    } finally { this.pending = -1; this.onChange(); }
  }
  attach(id, entry, ctx, node) {
    const config = this.configs[id], gain = ctx.createGain(), analyser = ctx.createAnalyser();
    analyser.fftSize = 256; gain.gain.value = config.muted ? 0 : config.gain;
    const route = { ctx, entry, gain, analyser, values: new Float32Array(256), reference: {} };
    try { entry.source.connect(gain); gain.connect(analyser); analyser.connect(node, 0, id); }
    catch (error) { entry.source.disconnect(gain); gain.disconnect(); analyser.disconnect(); throw error; }
    // Reference first, so rebinding the last user never stops its source.
    entry.refs.add(route.reference); this.disconnect(id); this.slots[id] = route;
    return route;
  }
  async applyToAll(id) {
    if (this.pending >= 0) throw Error('Esperá a que termine la conexión actual.');
    const config = inputConfig(this.configs[id]), original = this.slots[id];
    this.pending = id; this.onChange();
    try {
      const graph = original ? await this.getGraph() : null;
      if (original && (original.entry.dead || this.slots[id] !== original)) throw Error('La fuente se desconectó. Volvé a conectarla.');
      for (let i = 0; i < 6; i++) {
        if (i === id) continue;
        this.configs[i] = { ...config };
        if (original) this.attach(i, original.entry, graph.ctx, graph.node);
        else this.disconnect(i);
      }
      return !!original;
    } finally { this.pending = -1; this.onChange(); }
  }
  disconnect(id) {
    const slot = this.slots[id]; if (!slot) return;
    this.slots[id] = null;
    const { entry, gain, analyser, reference } = slot;
    entry.source.disconnect(gain); gain.disconnect(); analyser.disconnect();
    entry.refs.delete(reference);
    if (!entry.refs.size) {
      entry.dead = true; entry.source.disconnect(); stop(entry.stream);
      if (entry.key && this.pool.get(entry.key) === entry) this.pool.delete(entry.key);
    }
    this.onChange();
  }
  endEntry(entry) {
    if (entry.dead) return;
    const ids = this.slots.flatMap((s, i) => s?.entry === entry ? [i] : []);
    for (const id of ids) { this.disconnect(id); this.onEnded(id); }
  }
  disconnectAll() { this.generation++; for (let i = 0; i < 6; i++) this.disconnect(i); }
  peak(id) {
    const slot = this.slots[id]; if (!slot) return 0;
    slot.analyser.getFloatTimeDomainData(slot.values);
    let peak = 0; for (const value of slot.values) peak = Math.max(peak, Math.abs(value));
    return peak;
  }
}
