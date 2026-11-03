import { MAX_SECONDS, TRACKS, targetGains, mixSample } from './audio-core.js';
import { inputConfig } from './inputs.js?v=1.2.0';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAGIC = 'SEISLP01';
const validName = (s, fallback) => typeof s === 'string' ? s.slice(0, 80) : fallback;

export function encodeSession(data, title, names, inputs) {
  const meta = {
    version: 1, rate: data.rate, length: data.length, master: data.master,
    title: validName(title, 'Mi sesión'),
    tracks: data.tracks.map((t, i) => ({ name: validName(names[i], `Loop ${i + 1}`),
      volume: t.volume, muted: t.muted, solo: t.solo, frames: t.samples?.length || 0, input: inputConfig(inputs?.[i] ?? t.input) }))
  };
  const json = encoder.encode(JSON.stringify(meta));
  if (json.length > 16_384) throw Error('Las etiquetas de las entradas son demasiado largas para guardar esta sesión.');
  const audioBytes = meta.tracks.reduce((n, t) => n + t.frames * 4, 0);
  const buffer = new ArrayBuffer(12 + json.length + audioBytes);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  bytes.set(encoder.encode(MAGIC));
  view.setUint32(8, json.length, true);
  bytes.set(json, 12);
  let offset = 12 + json.length;
  for (const t of data.tracks) if (t.samples) for (const sample of t.samples) { view.setFloat32(offset, sample, true); offset += 4; }
  return buffer;
}

export function decodeSession(buffer) {
  const bad = () => { throw Error('El archivo no es una sesión SEIS válida o está incompleto.'); };
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 12 || buffer.byteLength > 560_000_000) bad();
  const view = new DataView(buffer);
  if (decoder.decode(new Uint8Array(buffer, 0, 8)) !== MAGIC) bad();
  const size = view.getUint32(8, true);
  if (size > 16_384 || size < 2 || 12 + size > buffer.byteLength) bad();
  let meta;
  try { meta = JSON.parse(decoder.decode(new Uint8Array(buffer, 12, size))); } catch { bad(); }
  if (!meta || meta.version !== 1 || !Number.isInteger(meta.rate) || meta.rate < 8000 || meta.rate > 192000 ||
      !Number.isInteger(meta.length) || meta.length < 0 || meta.length > meta.rate * MAX_SECONDS ||
      !Number.isFinite(meta.master) || meta.master < 0 || meta.master > 1 || !Array.isArray(meta.tracks) || meta.tracks.length !== TRACKS) bad();
  let bytes = 12 + size;
  for (const t of meta.tracks) {
    if (!t || !Number.isInteger(t.frames) || (t.frames !== 0 && t.frames !== meta.length) ||
        !Number.isFinite(t.volume) || t.volume < 0 || t.volume > 1.5 || typeof t.muted !== 'boolean' || typeof t.solo !== 'boolean') bad();
    bytes += t.frames * 4;
  }
  if (bytes !== buffer.byteLength || (!!meta.length !== meta.tracks.some(t => t.frames > 0))) bad();
  let offset = 12 + size;
  const tracks = meta.tracks.map((t, i) => {
    const samples = t.frames ? new Float32Array(t.frames) : null;
    if (samples) for (let j = 0; j < samples.length; j++) {
      const n = view.getFloat32(offset, true); offset += 4;
      if (!Number.isFinite(n) || Math.abs(n) > 16) bad();
      samples[j] = n;
    }
    return { samples, volume: t.volume, muted: t.muted, solo: t.solo, name: validName(t.name, `Loop ${i + 1}`), input: inputConfig(t.input) };
  });
  return { rate: meta.rate, length: meta.length, master: meta.master, title: validName(meta.title, 'Mi sesión'), tracks };
}

export function resampleSession(data, rate) {
  if (data.rate === rate || !data.length) return { ...data, rate };
  const length = Math.round(data.length * rate / data.rate);
  const tracks = data.tracks.map(t => {
    if (!t.samples) return { ...t };
    const samples = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const at = i * data.length / length;
      const a = Math.floor(at);
      const f = at - a;
      samples[i] = t.samples[a] * (1 - f) + t.samples[(a + 1) % data.length] * f;
    }
    return { ...t, samples };
  });
  return { ...data, rate, length, tracks };
}

export function encodeWav(data, cycles = 1) {
  if (!data.length || !data.tracks.some(t => t.samples)) throw Error('Todavía no hay loops para exportar.');
  if (!Number.isInteger(cycles) || cycles < 1 || cycles > 8) throw Error('Cantidad de vueltas inválida.');
  const frames = data.length * cycles;
  if (frames > data.rate * 600) throw Error('La exportación supera 10 minutos. Elegí menos vueltas.');
  const buffer = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(buffer);
  const write = (offset, s) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
  write(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); write(8, 'WAVE');
  write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, data.rate, true); view.setUint32(28, data.rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, frames * 2, true);
  const gains = targetGains(data.tracks);
  for (let i = 0; i < frames; i++) {
    const value = mixSample(data.tracks, gains, i % data.length, data.master);
    view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return buffer;
}
