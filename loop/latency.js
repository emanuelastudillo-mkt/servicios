export const MAX_LATENCY_MS = 750;
export function latencyConfig(value) {
  if (value == null) return { mode: 'auto', ms: 0, route: '' };
  if (!['auto', 'manual', 'measured', 'off'].includes(value.mode) || !Number.isFinite(value.ms) || value.ms < 0 || value.ms > MAX_LATENCY_MS || typeof value.route !== 'string' || value.route.length > 1800) throw Error('Compensación de latencia inválida.');
  return { mode: value.mode, ms: value.ms, route: value.route };
}
export function routeKey(config, settings, outputKey, rate) {
  return JSON.stringify([config.kind, config.deviceId, config.kind === 'device' ? settings.deviceId || '' : '', outputKey, rate]);
}
export function resolveLatency(config, settings = {}, context = {}, route = '') {
  const value = latencyConfig(config.latency);
  if (value.mode === 'off') return { ms: 0, ready: true, label: 'Sin compensar', detail: 'La compensación está desactivada.' };
  if (value.mode === 'manual' || value.mode === 'measured') {
    if (!route || route !== value.route) return { ms: 0, ready: false, label: 'Revisar ruta', detail: 'Cambió la entrada, la salida o la frecuencia. Volvé a medir o confirmá el total manual para esta ruta.' };
    return { ms: value.ms, ready: true, label: value.mode === 'measured' ? 'Medida' : 'Manual', detail: value.mode === 'measured' ? 'Retorno medido. Repetí la medición si cambiás el búfer, los efectos o la ruta de Pro Tools.' : 'Total ingresado para esta entrada y salida. Incluí la demora de Pro Tools si corresponde.' };
  }
  // A MediaStreamDestination's latency does not describe the WASAPI/DAW path.
  const known = config.kind === 'device' && [settings.latency, context.baseLatency, context.outputLatency].every(n => Number.isFinite(n) && n >= 0);
  const ms = known ? (settings.latency + context.baseLatency + context.outputLatency) * 1000 : 0;
  if (!known || ms > MAX_LATENCY_MS) return { ms: 0, ready: false, label: 'Sin calibrar', detail: 'Esta fuente no informa su retardo completo. Medí el retorno o ingresá el total manual; todavía no se aplica compensación.' };
  return { ms, ready: true, label: 'Estimada', detail: 'Estimación de entrada y salida informada por el navegador. Para mayor precisión, medí el retorno. No incluye efectos de un programa externo.' };
}
export function probeDefinition(rate) {
  return { starts: [.3, 1.6, 2.9].map(t => Math.round(t * rate)), pulseFrames: Math.round(.04 * rate), frames: Math.round(4 * rate) };
}
export function probeSample(frame, rate) {
  const duration = .04, t = frame / rate;
  if (t < 0 || t >= duration) return 0;
  return .025 * Math.sin(Math.PI * t / duration) ** 2 * Math.sin(2 * Math.PI * (500 * t + 2000 * t * t / (2 * duration)));
}
export class LatencyProbe {
  constructor(rate) { this.rate = rate; this.definition = probeDefinition(rate); this.position = 0; this.samples = new Float32Array(this.definition.frames); }
  process(input, output) {
    for (let i = 0; i < output.length; i++, this.position++) {
      const at = this.position;
      if (at >= this.samples.length) { output[i] = 0; continue; }
      this.samples[at] = Number.isFinite(input?.[i]) ? input[i] : 0;
      output[i] = 0;
      for (const start of this.definition.starts) if (at >= start && at < start + this.definition.pulseFrames) { output[i] = probeSample(at - start, this.rate); break; }
    }
    return this.position >= this.samples.length;
  }
}
export function measureLatency(samples, rate) {
  const { starts, pulseFrames, frames } = probeDefinition(rate);
  if (!(samples instanceof Float32Array) || samples.length !== frames) throw Error('La captura de calibración está incompleta.');
  const step = Math.max(1, Math.floor(rate / 12000));
  const template = Array.from({ length: Math.floor(pulseFrames / step) }, (_, i) => probeSample(i * step, rate));
  const mean = template.reduce((a, b) => a + b, 0) / template.length;
  template.forEach((n, i) => { template[i] = n - mean; });
  const energy = template.reduce((sum, n) => sum + n * n, 0), maxLag = Math.round(rate * MAX_LATENCY_MS / 1000);
  const correlation = (start, lag) => {
    let dot = 0, sum = 0, power = 0, clipped = 0;
    for (let i = 0; i < template.length; i++) {
      const n = samples[start + lag + i * step];
      if (!Number.isFinite(n)) return 0;
      dot += template[i] * n; sum += n; power += n * n; if (Math.abs(n) >= .98) clipped++;
    }
    const variance = power - sum * sum / template.length;
    if (variance < 1e-8 || clipped > template.length * .01) return 0;
    return Math.abs(dot) / Math.sqrt(energy * variance);
  };
  const hits = starts.map(start => {
    let lag = 0, score = 0;
    for (let at = 0; at <= maxLag; at += step) { const c = correlation(start, at); if (c > score) { score = c; lag = at; } }
    const coarse = lag;
    for (let at = Math.max(0, coarse - step); at <= Math.min(maxLag, coarse + step); at++) { const c = correlation(start, at); if (c > score) { score = c; lag = at; } }
    return { lag, score };
  });
  if (hits.some(hit => hit.score < .6)) throw Error('No se detectó un retorno claro en las tres señales. Revisá la ruta, el nivel y los efectos; no se cambió la compensación.');
  const delays = hits.map(hit => hit.lag).sort((a, b) => a - b), spreadMs = (delays[2] - delays[0]) * 1000 / rate;
  if (spreadMs > 3) throw Error('La demora varió más de 3 ms durante la prueba. Revisá cortes de audio o carga de Pro Tools y repetí; no se aplicó un valor inestable.');
  return { ms: delays[1] * 1000 / rate, frames: delays[1], spreadMs, confidence: Math.min(...hits.map(hit => hit.score)) };
}
