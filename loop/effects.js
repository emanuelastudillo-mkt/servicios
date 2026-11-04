// Local, mono DSP. The same processors render the live mix and exported WAV.
const param = (label, min, max, value, step = 1, unit = '%') => ({ label, min, max, value, step, unit });
export const EFFECTS = {
  gate: { name: 'Noise Gate', group: 'Dinámica', info: 'Reduce ruido entre notas; no elimina el zumbido mientras tocás.', params: { threshold: param('Umbral', -80, -10, -48, 1, 'dB'), release: param('Cierre', 20, 600, 120, 5, 'ms') } },
  compressor: { name: 'Compresor', group: 'Dinámica', info: 'Controla los picos y permite recuperar nivel con Ganancia.', params: { threshold: param('Umbral', -48, 0, -20, 1, 'dB'), ratio: param('Ratio', 1, 12, 4, .5, ':1'), attack: param('Ataque', 1, 100, 10, 1, 'ms'), release: param('Relajación', 20, 600, 150, 5, 'ms'), makeup: param('Ganancia', 0, 18, 3, .5, 'dB') } },
  boost: { name: 'Booster', group: 'Dinámica', info: 'Ganancia limpia antes de la saturación. Revisá el nivel de salida.', params: { gain: param('Ganancia', 0, 18, 6, .5, 'dB') } },
  volume: { name: 'Pedal de volumen', group: 'Dinámica', info: 'Seleccioná la perilla y usá flechas; Home silencia y End abre al máximo.', params: { level: param('Apertura', 0, 100, 100) } },
  overdrive: { name: 'Overdrive', group: 'Saturación', info: 'Saturación suave con control de tono y nivel.', params: { drive: param('Drive', 0, 100, 35), tone: param('Tono', 0, 100, 55), level: param('Nivel', 0, 100, 70) } },
  distortion: { name: 'Distorsión', group: 'Saturación', info: 'Recorte más intenso y comprimido.', params: { drive: param('Drive', 0, 100, 55), tone: param('Tono', 0, 100, 50), level: param('Nivel', 0, 100, 55) } },
  fuzz: { name: 'Fuzz', group: 'Saturación', info: 'Saturación áspera con armónicos y textura vintage.', params: { drive: param('Fuzz', 0, 100, 65), tone: param('Tono', 0, 100, 45), level: param('Nivel', 0, 100, 50) } },
  chorus: { name: 'Chorus', group: 'Modulación', info: 'Copia con retardo modulado; la mezcla de SEIS es mono.', params: { rate: param('Velocidad', .1, 6, .8, .1, 'Hz'), depth: param('Profundidad', 0, 100, 40), mix: param('Mezcla', 0, 100, 35) } },
  flanger: { name: 'Flanger', group: 'Modulación', info: 'Retardo corto con barrido y realimentación.', params: { rate: param('Velocidad', .05, 5, .3, .05, 'Hz'), depth: param('Profundidad', 0, 100, 65), feedback: param('Feedback', 0, 85, 40), mix: param('Mezcla', 0, 100, 45) } },
  phaser: { name: 'Phaser', group: 'Modulación', info: 'Seis etapas de desplazamiento de fase en movimiento.', params: { rate: param('Velocidad', .05, 6, .5, .05, 'Hz'), depth: param('Profundidad', 0, 100, 65), mix: param('Mezcla', 0, 100, 50) } },
  tremolo: { name: 'Trémolo', group: 'Modulación', info: 'Pulso de volumen, sin cambiar la afinación.', params: { rate: param('Velocidad', .1, 15, 4, .1, 'Hz'), depth: param('Profundidad', 0, 100, 60) } },
  vibrato: { name: 'Vibrato', group: 'Modulación', info: 'Modula la afinación mediante un retardo corto.', params: { rate: param('Velocidad', .1, 10, 4, .1, 'Hz'), depth: param('Profundidad', 0, 100, 25) } },
  delay: { name: 'Delay', group: 'Tiempo y espacio', info: 'Eco en milisegundos. Las repeticiones continúan entre vueltas.', params: { time: param('Tiempo', 20, 1500, 320, 5, 'ms'), feedback: param('Repeticiones', 0, 85, 35), mix: param('Mezcla', 0, 100, 30) } },
  reverb: { name: 'Reverb', group: 'Tiempo y espacio', info: 'Reverberación algorítmica, desde ambiente corto hasta sala profunda.', params: { decay: param('Duración', .2, 8, 2.2, .1, 's'), damping: param('Oscuridad', 0, 95, 45), mix: param('Mezcla', 0, 100, 25) } },
  wah: { name: 'Wah-Wah', group: 'Filtros y afinación', info: 'Mové Apertura con mouse o flechas. Home/End recorren los extremos.', params: { position: param('Apertura', 0, 100, 45), resonance: param('Resonancia', 1, 8, 3, .1, 'Q'), mix: param('Mezcla', 0, 100, 100) } },
  pitch: { name: 'Octavador / Pitch', group: 'Filtros y afinación', info: 'Cambio granular de tono: ±12 es una octava. Mezcla duplica la nota. Puede dar textura a acordes y transitorios.', params: { semitones: param('Intervalo', -24, 24, -12, 1, 'st'), mix: param('Mezcla', 0, 100, 50) } }
};
export const EFFECT_ORDER = Object.keys(EFFECTS);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const db = x => 10 ** (x / 20);
export function pedal(type) {
  const def = EFFECTS[type]; if (!def) throw Error('Efecto desconocido.');
  return { type, enabled: true, params: Object.fromEntries(Object.entries(def.params).map(([key, p]) => [key, p.value])) };
}
export function effectsConfig(value) {
  if (value == null) return { bypass: false, pedals: [] };
  if (typeof value.bypass !== 'boolean' || !Array.isArray(value.pedals) || value.pedals.length > EFFECT_ORDER.length) throw Error('Cadena de efectos inválida.');
  const seen = new Set();
  return { bypass: value.bypass, pedals: value.pedals.map(p => {
    if (!p || !Object.hasOwn(EFFECTS, p.type) || seen.has(p.type) || typeof p.enabled !== 'boolean' || !p.params || typeof p.params !== 'object') throw Error('Pedal inválido o repetido.');
    seen.add(p.type); const params = {};
    for (const [key, def] of Object.entries(EFFECTS[p.type].params)) {
      const n = p.params[key];
      if (!Number.isFinite(n) || n < def.min || n > def.max) throw Error('Parámetro de efecto fuera de rango.');
      params[key] = n;
    }
    return { type: p.type, enabled: p.enabled, params };
  }) };
}

class DelayLine {
  constructor(size) { this.data = new Float32Array(Math.ceil(size) + 4); this.at = 0; }
  read(delay) {
    let pos = this.at - clamp(delay, 1, this.data.length - 2);
    if (pos < 0) pos += this.data.length;
    const a = Math.floor(pos), f = pos - a;
    return this.data[a] * (1 - f) + this.data[(a + 1) % this.data.length] * f;
  }
  push(x) { this.data[this.at] = x; if (++this.at === this.data.length) this.at = 0; }
}

class Effect {
  constructor(rate, config) {
    this.rate = rate; this.type = config.type; this.blend = config.enabled ? 1 : 0;
    this.smooth = 1 - Math.exp(-1 / (.012 * rate));
    this.phase = 0; this.tick = 0; this.envelope = 0; this.gate = 0; this.low = 0; this.last = 0; this.dc = 0; this.previous = 0; this.gain = 1; this.time = 0;
    this.z = new Float64Array(6); this.w1 = 0; this.w2 = 0; this.a = 0;
    if (['chorus','flanger','vibrato','delay','pitch'].includes(this.type)) this.line = new DelayLine(rate * (this.type === 'delay' ? 1.51 : .15));
    if (this.type === 'reverb') {
      this.combs = [.0297,.0371,.0411,.0437].map(seconds => ({ line: new DelayLine(Math.round(rate * seconds)), size: Math.round(rate * seconds), low: 0, feedback: 0 }));
      this.diffusers = [.005,.0017].map(seconds => ({ line: new DelayLine(Math.round(rate * seconds)), size: Math.round(rate * seconds) }));
    }
    this.set(config); this.gain = this.targetGain ?? 1; this.time = (this.p.time || 20) * rate / 1000;
  }
  set(config) {
    this.enabled = config.enabled; this.p = config.params;
    const p = this.p, r = this.rate;
    this.attack = 1 - Math.exp(-1 / (r * (p.attack || 2) / 1000));
    this.release = 1 - Math.exp(-1 / (r * (p.release || 120) / 1000));
    this.threshold = db(p.threshold || -48); this.makeup = db(p.makeup || 0);
    this.targetGain = this.type === 'boost' ? db(p.gain) : p.level != null ? p.level / 100 : 1;
    this.tone = 1 - Math.exp(-2 * Math.PI * Math.min(r * .2, 600 + (p.tone || 0) * 65) / (r * 2));
    if (this.combs) for (const c of this.combs) c.feedback = 10 ** (-3 * c.size / (r * p.decay));
  }
  run(x) {
    this.blend += ((this.enabled ? 1 : 0) - this.blend) * this.smooth;
    if (!this.enabled && this.blend < 1e-7) return x;
    const p = this.p, rate = this.rate;
    let y = x;
    switch (this.type) {
      case 'gate': {
        const abs = Math.abs(x);
        this.envelope += (abs - this.envelope) * (abs > this.envelope ? this.attack : this.release);
        const target = this.envelope > this.threshold * (this.gate > .5 ? .65 : 1) ? 1 : 0;
        this.gate += (target - this.gate) * (target > this.gate ? this.attack : this.release);
        y = x * this.gate; break;
      }
      case 'compressor': {
        const abs = Math.abs(x);
        this.envelope += (abs - this.envelope) * (abs > this.envelope ? this.attack : this.release);
        const over = Math.max(0, 20 * Math.log10(Math.max(1e-9, this.envelope)) - p.threshold);
        const gain = db(-over * (1 - 1 / p.ratio));
        this.gain += (gain - this.gain) * (gain < this.gain ? this.attack : this.release);
        y = x * this.gain * this.makeup; break;
      }
      case 'boost': case 'volume': this.gain += (this.targetGain - this.gain) * this.smooth; y = x * this.gain; break;
      case 'overdrive': case 'distortion': case 'fuzz': {
        // Two interpolated substeps plus tone filtering reduce upper harmonics.
        const drive = 1 + p.drive * (this.type === 'overdrive' ? .16 : this.type === 'distortion' ? .45 : .8);
        for (let s = 0; s < 2; s++) {
          const v = (s ? x : (this.previous + x) * .5) * drive;
          const shaped = this.type === 'overdrive' ? Math.tanh(v) : this.type === 'distortion' ? clamp(v, -1, 1) : Math.sign(v) * (1 - Math.exp(-Math.abs(v)));
          this.low += (shaped - this.low) * this.tone;
        }
        this.previous = x;
        // DC blocker is especially useful for asymmetric inputs and hot pickups.
        y = this.low - this.last + .995 * this.dc; this.last = this.low; this.dc = y;
        this.gain += (this.targetGain - this.gain) * this.smooth; y *= this.gain; break;
      }
      case 'chorus': case 'flanger': case 'vibrato': {
        const lfo = Math.sin(this.phase * Math.PI * 2), depth = p.depth / 100;
        const seconds = this.type === 'chorus' ? .018 + lfo * .008 * depth : this.type === 'flanger' ? .0025 + lfo * .0022 * depth : .008 + lfo * .003 * depth;
        const wet = this.line.read(seconds * rate);
        this.line.push(clamp(x + wet * (p.feedback || 0) / 100, -16, 16));
        y = this.type === 'vibrato' ? wet : x * (1 - p.mix / 100) + wet * p.mix / 100;
        this.phase = (this.phase + p.rate / rate) % 1; break;
      }
      case 'phaser': {
        if ((this.tick++ & 31) === 0) {
          const f = Math.min(rate * .2, 350 * 2 ** ((1 + Math.sin(this.phase * 2 * Math.PI)) * p.depth / 100 * 2.5));
          const t = Math.tan(Math.PI * f / rate); this.a = (1 - t) / (1 + t);
        }
        let wet = x;
        for (let j = 0; j < 6; j++) { const v = -this.a * wet + this.z[j]; this.z[j] = wet + this.a * v; wet = v; }
        y = x * (1 - p.mix / 100) + wet * p.mix / 100;
        this.phase = (this.phase + p.rate / rate) % 1; break;
      }
      case 'tremolo': y = x * (1 - p.depth / 200 * (1 - Math.sin(this.phase * 2 * Math.PI))); this.phase = (this.phase + p.rate / rate) % 1; break;
      case 'delay': {
        this.time += (p.time * rate / 1000 - this.time) * this.smooth;
        const wet = this.line.read(this.time); this.line.push(clamp(x + wet * p.feedback / 100, -16, 16));
        y = x * (1 - p.mix / 100) + wet * p.mix / 100; break;
      }
      case 'reverb': {
        let wet = 0;
        for (const c of this.combs) {
          const v = c.line.read(c.size); c.low += (v - c.low) * (1 - p.damping / 100);
          c.line.push(clamp(x * .25 + c.low * c.feedback, -16, 16)); wet += v * .5;
        }
        for (const d of this.diffusers) { const v = d.line.read(d.size), out = v - .5 * wet; d.line.push(wet + .5 * out); wet = out; }
        y = x * (1 - p.mix / 100) + wet * p.mix / 100; break;
      }
      case 'wah': {
        this.gain += (p.position / 100 - this.gain) * this.smooth;
        if ((this.tick++ & 31) === 0) {
          const omega = 2 * Math.PI * Math.min(rate * .2, 300 * 8 ** this.gain) / rate;
          const alpha = Math.sin(omega) / (2 * p.resonance), norm = 1 / (1 + alpha);
          this.b0 = alpha * norm; this.a1 = -2 * Math.cos(omega) * norm; this.a2 = (1 - alpha) * norm;
        }
        const wet = this.b0 * x + this.w1;
        this.w1 = -this.a1 * wet + this.w2; this.w2 = -this.b0 * x - this.a2 * wet;
        y = x * (1 - p.mix / 100) + wet * 1.6 * p.mix / 100; break;
      }
      case 'pitch': {
        const ratio = 2 ** (p.semitones / 12), window = rate * .06;
        if (p.semitones === 0) { y = x; this.line.push(x); break; }
        const a = this.phase, b = (a + .5) % 1;
        const weight = .5 - .5 * Math.cos(a * 2 * Math.PI);
        const wet = this.line.read(4 + a * window) * weight + this.line.read(4 + b * window) * (1 - weight);
        this.line.push(x); this.phase = (this.phase + (1 - ratio) / window + 1) % 1;
        y = x * (1 - p.mix / 100) + wet * p.mix / 100; break;
      }
    }
    return clamp(x + (y - x) * this.blend, -16, 16);
  }
}

export class EffectsChain {
  constructor(rate, config) { this.rate = rate; this.units = []; this.blend = 1; this.set(config); this.blend = this.config.bypass ? 0 : 1; }
  set(config) {
    this.config = effectsConfig(config);
    this.units = this.config.pedals.map(p => {
      const old = this.units.find(unit => unit.type === p.type);
      if (old) { old.set(p); return old; }
      return new Effect(this.rate, p);
    });
    this.smooth = 1 - Math.exp(-1 / (this.rate * .012));
  }
  reset() { this.units = []; this.set(this.config); this.blend = this.config.bypass ? 0 : 1; }
  process(input) {
    if (!this.units.length) return input;
    let x = input;
    for (const effect of this.units) x = effect.run(x);
    this.blend += ((this.config.bypass ? 0 : 1) - this.blend) * this.smooth;
    return input + (x - input) * this.blend;
  }
}
