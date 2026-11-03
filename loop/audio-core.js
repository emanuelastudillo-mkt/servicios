export const TRACKS = 6;
export const MAX_SECONDS = 120;
export const COUNT_IN_SECONDS = 3;
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function sealLoop(samples, rate) {
  const fade = Math.min(Math.round(rate * .003), Math.floor(samples.length / 8));
  for (let i = 0; i < fade; i++) {
    const gain = i / fade;
    samples[i] *= gain;
    samples[samples.length - 1 - i] *= gain;
  }
  return samples;
}

export function peaks(samples, count = 160) {
  if (!samples) return [];
  return Array.from({ length: count }, (_, i) => {
    const start = Math.floor(i * samples.length / count);
    const end = Math.max(start + 1, Math.floor((i + 1) * samples.length / count));
    let peak = 0;
    for (let j = start; j < end; j++) peak = Math.max(peak, Math.abs(samples[j] || 0));
    return peak;
  });
}

export function targetGains(tracks) {
  const solo = tracks.some(t => t.samples && t.solo);
  return tracks.map(t => t.samples && !t.muted && (!solo || t.solo) ? t.volume : 0);
}

export function mixSample(tracks, gains, pos, master) {
  let mixed = 0;
  for (let t = 0; t < tracks.length; t++) if (tracks[t].samples && gains[t]) mixed += tracks[t].samples[pos] * gains[t];
  return clamp(mixed * master, -1, 1);
}

export class LoopEngine {
  constructor(rate, emit = () => {}) {
    this.rate = rate;
    this.emit = emit;
    this.tracks = Array.from({ length: TRACKS }, () => ({ samples: null, volume: .8, muted: false, solo: false }));
    this.length = 0;
    this.pos = 0;
    this.playing = false;
    this.recording = null;
    this.master = .75;
    this.inputGain = 1;
    this.monitor = false;
    this.compensation = 0;
    this.gains = Array(TRACKS).fill(0);
    this.targets = Array(TRACKS).fill(0);
    this.smoothing = 1 - Math.exp(-1 / (rate * .005));
    this.inputPeak = 0;
    this.outputPeak = 0;
    this.undo = null;
  }
  updateGains() { this.targets = targetGains(this.tracks); }
  changed(kind = 'changed', extra = {}) { this.updateGains(); this.emit({ type: kind, ...extra }); }
  state() {
    return {
      rate: this.rate, length: this.length, position: this.pos, playing: this.playing,
      recording: this.recording ? { id: this.recording.id, first: this.recording.first, armed: this.recording.armed, written: this.recording.written, countdownFrames: this.recording.countdownFrames, ending: this.recording.endAt != null } : null,
      tracks: this.tracks.map(t => ({ hasAudio: !!t.samples, volume: t.volume, muted: t.muted, solo: t.solo })),
      master: this.master, inputGain: this.inputGain, monitor: this.monitor,
      inputPeak: this.inputPeak, outputPeak: this.outputPeak, canUndo: !!this.undo
    };
  }
  startRecording(id, compensation = this.compensation) {
    if (!Number.isInteger(id) || id < 0 || id >= TRACKS) throw Error('Pista inválida.');
    if (this.recording) throw Error('Terminá o cancelá la grabación actual.');
    if (this.tracks[id].samples) throw Error('La pista ya tiene audio. Borrala antes de volver a grabar.');
    const first = !this.length;
    const latencyFrames = first ? 0 : Math.round(clamp(Number.isFinite(compensation) ? compensation : 0, 0, 750) * this.rate / 1000);
    this.recording = { id, first, armed: !first, written: 0, latencyFrames, endAt: null,
      countdownFrames: id === 0 ? Math.round(this.rate * COUNT_IN_SECONDS) : 0,
      delayFrames: latencyFrames,
      samples: new Float32Array(first ? Math.floor(this.rate * MAX_SECONDS) : this.length) };
    if (!first && !this.playing) { this.pos = 0; this.playing = true; }
    this.emit({ type: 'state' });
  }
  finishFirst() {
    const r = this.recording;
    if (!r || !r.first) return;
    if (r.countdownFrames > 0) throw Error('Esperá a que termine la cuenta regresiva o cancelá la preparación.');
    if (r.written < Math.ceil(this.rate * .25)) throw Error('Grabá al menos un cuarto de segundo.');
    this.length = r.written;
    this.pos = 0;
    this.playing = true;
    this.completeRecording();
  }
  finishRecording(immediate = false) {
    const r = this.recording;
    // Preparation is never canceled by a request to finish.
    if (!r || r.countdownFrames > 0 || r.armed) return;
    if (r.first) { this.finishFirst(); return; }
    if (!immediate && r.latencyFrames > 0) {
      // Space refers to the performed time, whose final input samples are still
      // in flight. Freeze that endpoint on the first finish request.
      const target = Math.min(this.length, r.written + r.latencyFrames - r.delayFrames);
      if (!target) return;
      r.endAt ??= target;
      if (r.written < r.endAt) { this.emit({ type: 'state' }); return; }
    }
    if (!r.written) return;
    // Keep the recorded portion and the shared cycle; the remainder stays silent.
    const fade = Math.min(Math.round(this.rate * .003), r.written);
    for (let i = 0; i < fade; i++) {
      const pos = r.written - 1 - i;
      r.samples[pos] *= i / fade;
    }
    this.completeRecording();
  }
  completeRecording() {
    const r = this.recording;
    const samples = sealLoop(r.samples.subarray(0, this.length), this.rate);
    this.tracks[r.id].samples = samples;
    this.tracks[r.id].muted = false;
    this.recording = null;
    this.undo = null;
    this.changed('recorded', { id: r.id, peaks: peaks(samples) });
  }
  cancelRecording() { this.recording = null; this.emit({ type: 'state' }); }
  stop() { this.recording = null; this.playing = false; this.pos = 0; this.gains.fill(0); this.emit({ type: 'state' }); }
  play() { if (this.length) { this.playing = true; this.pos = 0; this.emit({ type: 'state' }); } }
  clear(id) {
    if (this.recording) throw Error('Terminá o cancelá la grabación antes de borrar.');
    const t = this.tracks[id];
    if (!t?.samples) return;
    this.undo = { id, track: { ...t }, length: this.length };
    t.samples = null; t.solo = false; t.muted = false;
    if (!this.tracks.some(t => t.samples)) { this.length = 0; this.stop(); }
    this.changed('cleared', { id });
  }
  restore() {
    if (!this.undo || this.recording) return;
    const { id, track, length } = this.undo;
    this.tracks[id] = track;
    this.length = length;
    this.undo = null;
    this.changed('restored', { id, peaks: peaks(track.samples) });
  }
  load(data) {
    this.stop();
    this.tracks = data.tracks;
    this.length = data.length;
    this.master = data.master;
    this.undo = null;
    this.changed('loaded', { peaks: this.tracks.map(t => peaks(t.samples)) });
  }
  snapshot() {
    if (this.recording) throw Error('Terminá o cancelá la grabación antes de guardar o exportar.');
    return { rate: this.rate, length: this.length, master: this.master,
      tracks: this.tracks.map(t => ({ ...t, samples: t.samples ? t.samples.slice() : null })) };
  }
  command(m) {
    switch (m.type) {
      case 'record': this.startRecording(m.id, m.compensation); break;
      case 'finish': this.finishRecording(); break;
      case 'cancel': this.cancelRecording(); break;
      case 'inputLost': {
        const r = this.recording;
        if (r?.id !== m.id) break;
        if (!r.armed && !r.countdownFrames && r.written >= (r.first ? Math.ceil(this.rate * .25) : 1)) this.finishRecording(true);
        else this.cancelRecording();
        this.emit({ type: 'inputLost', id: m.id, kept: !!this.tracks[m.id].samples });
        break;
      }
      case 'stop': this.stop(); break;
      case 'play': this.play(); break;
      case 'clear': this.clear(m.id); break;
      case 'undo': this.restore(); break;
      case 'load': this.load(m.data); break;
      case 'track': {
        const t = this.tracks[m.id];
        if (!t) break;
        if (Number.isFinite(m.volume)) t.volume = clamp(m.volume, 0, 1.5);
        if (typeof m.muted === 'boolean') t.muted = m.muted;
        if (typeof m.solo === 'boolean') t.solo = m.solo;
        this.changed(); break;
      }
      case 'settings':
        if (Number.isFinite(m.master)) this.master = clamp(m.master, 0, 1);
        if (Number.isFinite(m.inputGain)) this.inputGain = clamp(m.inputGain, 0, 2);
        if (Number.isFinite(m.compensation)) this.compensation = clamp(m.compensation, 0, 750);
        if (typeof m.monitor === 'boolean') this.monitor = m.monitor;
        this.emit({ type: 'state' }); break;
    }
  }
  process(input, output) {
    for (let i = 0; i < output.length; i++) {
      const mic = (Number.isFinite(input?.[i]) ? input[i] : 0) * this.inputGain;
      this.inputPeak = Math.max(this.inputPeak, Math.abs(mic));
      let mixed = 0;
      let complete = false;
      const r = this.recording;
      const counting = r && r.countdownFrames > 0;
      if (counting) {
        r.countdownFrames--;
        if (r.countdownFrames === 0) this.emit({ type: 'state' });
      }
      if (r?.first) {
        if (!counting) {
          r.samples[r.written++] = mic;
          if (r.written === r.samples.length) this.finishFirst();
        }
      } else if (this.playing && this.length) {
        if (r?.armed && !counting && this.pos === 0) { r.armed = false; this.emit({ type: 'state' }); }
        if (r && !r.armed) {
          // Wait for the performed downbeat to reach this input, then capture
          // a full cycle including its delayed tail. Rotating an earlier
          // one-cycle window would substitute pre-roll for that final tail.
          if (r.delayFrames > 0) r.delayFrames--;
          else { r.samples[r.written++] = mic; complete = r.written === (r.endAt ?? this.length); }
        }
        for (let t = 0; t < TRACKS; t++) {
          this.gains[t] += (this.targets[t] - this.gains[t]) * this.smoothing;
          if (this.tracks[t].samples) mixed += this.tracks[t].samples[this.pos] * this.gains[t];
        }
        this.pos = (this.pos + 1) % this.length;
        if (complete) { if (r.endAt != null && r.endAt < this.length) this.finishRecording(true); else this.completeRecording(); }
      }
      if (this.monitor) mixed += mic;
      mixed *= this.master;
      this.outputPeak = Math.max(this.outputPeak, Math.abs(mixed));
      output[i] = clamp(mixed, -1, 1);
    }
  }
}
