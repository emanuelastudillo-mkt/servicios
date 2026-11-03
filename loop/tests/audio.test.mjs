import test from 'node:test';
import assert from 'node:assert/strict';
import { LoopEngine, targetGains, mixSample, MAX_SECONDS } from '../audio-core.js';
import { encodeSession, decodeSession, encodeWav, resampleSession } from '../files.js';

const RATE = 8000;
function render(engine, frames, input = .2, block = 128) {
  const result = new Float32Array(frames);
  for (let at = 0; at < frames; at += block) {
    const n = Math.min(block, frames - at);
    const values = new Float32Array(n);
    for (let i = 0; i < n; i++) values[i] = typeof input === 'function' ? input(at + i) : input;
    engine.process(values, result.subarray(at, at + n));
  }
  return result;
}
function first(frames = 4001) { const engine = new LoopEngine(RATE); engine.startRecording(0); render(engine, frames); engine.finishFirst(); return engine; }
function six() {
  const engine = first();
  for (let id = 1; id < 6; id++) { engine.startRecording(id); render(engine, engine.length, .1 * (id + 1)); }
  return engine;
}

test('first loop captures the exact frame count and begins at zero', () => {
  const e = first(4001);
  assert.equal(e.length, 4001); assert.equal(e.pos, 0); assert.equal(e.playing, true);
  assert.equal(e.tracks[0].samples.length, 4001);
  assert.equal(e.tracks[0].samples[0], 0);
  assert.equal(e.tracks[0].samples.at(-1), 0);
  assert.ok(Math.abs(e.tracks[0].samples[100] - .2) < 1e-7);
});
test('new layer waits for boundary, records exactly one cycle and starts next cycle', () => {
  const e = first(); render(e, 643);
  e.startRecording(1);
  render(e, e.length - 643, .7);
  assert.equal(e.recording.armed, true); assert.equal(e.pos, 0);
  render(e, e.length - 1, .3);
  assert.equal(e.tracks[1].samples, null); assert.equal(e.recording.written, e.length - 1);
  render(e, 1, .3);
  assert.equal(e.recording, null); assert.equal(e.pos, 0);
  assert.equal(e.tracks[1].samples.length, e.length);
  assert.ok(Math.abs(e.tracks[1].samples[700] - .3) < 1e-7);
});
test('six tracks stay in phase over 1000 non-block-aligned cycles', () => {
  const e = six();
  render(e, e.length * 1000, 0, 256);
  assert.equal(e.pos, 0);
  assert.ok(e.tracks.every(t => t.samples.length === 4001));
  render(e, 123, 0); assert.equal(e.pos, 123);
});
test('mute, solo and gain settle to the expected sum and never exceed output limits', () => {
  const e = six(); e.master = .5;
  e.command({ type: 'track', id: 3, solo: true, volume: .7 });
  render(e, 600);
  let result = render(e, 100);
  assert.ok(Math.abs(result[50] - .4 * .7 * .5) < 1e-5);
  e.command({ type: 'track', id: 3, muted: true }); render(e, 1000);
  assert.ok(Math.abs(render(e, 100)[50]) < 1e-9);
  e.tracks.forEach(t => { t.solo = false; t.muted = false; t.volume = 1.5; }); e.master = 1; e.updateGains();
  result = render(e, 4001);
  assert.ok(result.every(x => x >= -1 && x <= 1)); assert.ok(result.some(x => x === 1));
});
test('cancel and stop discard unfinished recordings without touching completed tracks', () => {
  const e = first(); const samples = e.tracks[0].samples.slice();
  e.startRecording(1); render(e, 512); e.cancelRecording();
  assert.equal(e.tracks[1].samples, null); assert.deepEqual(e.tracks[0].samples, samples);
  e.startRecording(2); render(e, 100); e.stop();
  assert.equal(e.recording, null); assert.equal(e.playing, false); assert.equal(e.pos, 0);
  assert.ok(render(e, 128).every(x => x === 0));
  e.play(); assert.equal(e.pos, 0); assert.equal(e.playing, true);
});
test('clearing last loop resets length; undo restores exact audio and cycle', () => {
  const e = first(); const audio = e.tracks[0].samples.slice();
  e.clear(0); assert.equal(e.length, 0); assert.equal(e.playing, false);
  e.restore(); assert.equal(e.length, 4001); assert.deepEqual(e.tracks[0].samples, audio);
});
test('short first recordings stay active and max length closes automatically', () => {
  const e = new LoopEngine(RATE); e.startRecording(4); render(e, 100);
  assert.throws(() => e.finishFirst(), /cuarto/); assert.ok(e.recording);
  render(e, RATE * MAX_SECONDS - 100);
  assert.equal(e.length, RATE * MAX_SECONDS); assert.equal(e.recording, null); assert.equal(e.pos, 0);
});
test('rejects double recording, occupied tracks, and snapshots during capture', () => {
  const e = first(); assert.throws(() => e.startRecording(0), /ya tiene/);
  e.startRecording(1); assert.throws(() => e.startRecording(2), /actual/);
  assert.throws(() => e.snapshot(), /grabación/); assert.throws(() => e.clear(0), /grabación/);
});
test('latency correction advances the new layer circularly without changing duration', () => {
  const e = first(8000); e.compensation = 50; e.startRecording(1);
  render(e, 8000, i => i === 1000 ? 1 : 0);
  assert.equal(e.tracks[1].samples[600], 1); assert.equal(e.tracks[1].samples[1000], 0); assert.equal(e.length, 8000);
});
test('silence and invalid input cannot inject NaN into output', () => {
  const e = new LoopEngine(RATE); e.monitor = true;
  const out = new Float32Array(4); e.process(new Float32Array([NaN, Infinity, -Infinity, .3]), out);
  assert.deepEqual([...out].slice(0, 3), [0, 0, 0]);
});
test('session save/reopen preserves every sample, gain, mute, solo and Unicode name', () => {
  const e = six(); e.command({ type: 'track', id: 1, muted: true }); e.command({ type: 'track', id: 5, solo: true, volume: 1.2 });
  const data = e.snapshot(); const names = ['Guitarra 🎸', 'Voz', 'Percusión', 'Bajo', 'Coro', 'Última'];
  const loaded = decodeSession(encodeSession(data, 'Canción ñ', names));
  assert.equal(loaded.title, 'Canción ñ'); assert.equal(loaded.length, data.length);
  loaded.tracks.forEach((t, i) => { assert.equal(t.name, names[i]); assert.deepEqual(t.samples, data.tracks[i].samples); assert.equal(t.volume, data.tracks[i].volume); assert.equal(t.muted, data.tracks[i].muted); assert.equal(t.solo, data.tracks[i].solo); });
  const newEngine = new LoopEngine(RATE); newEngine.load(loaded); newEngine.play();
  const before = render(e, 8002); const after = render(newEngine, 8002);
  assert.deepEqual(before.subarray(4001), after.subarray(4001));
});
test('session decoding rejects corrupted headers, truncation, NaN and extra bytes', () => {
  const data = first().snapshot(), file = encodeSession(data, 'Test', []);
  assert.throws(() => decodeSession(file.slice(0, 10)));
  assert.throws(() => decodeSession(file.slice(0, -4)));
  const header = file.slice(0); new Uint8Array(header)[0] = 0; assert.throws(() => decodeSession(header));
  const nan = file.slice(0); const v = new DataView(nan); v.setFloat32(12 + v.getUint32(8, true) + 100, NaN, true); assert.throws(() => decodeSession(nan));
  const extra = new Uint8Array(file.byteLength + 4); extra.set(new Uint8Array(file)); assert.throws(() => decodeSession(extra.buffer));
});
test('resampling maintains shared duration and preserves silence in empty tracks', () => {
  const original = first(4000).snapshot(); const resampled = resampleSession(original, 48000);
  assert.equal(resampled.length, 24000); assert.equal(resampled.rate, 48000);
  assert.equal(resampled.tracks[1].samples, null); assert.ok(Math.abs(resampled.tracks[0].samples[2000] - .2) < 1e-7);
});
test('WAV header and PCM exactly match the audible mix, muted/solo and master included', () => {
  const e = six(); e.command({ type: 'track', id: 0, muted: true }); e.command({ type: 'track', id: 4, solo: true });
  const data = e.snapshot(), wav = encodeWav(data, 4), view = new DataView(wav), gains = targetGains(data.tracks);
  assert.equal(new TextDecoder().decode(new Uint8Array(wav, 0, 4)), 'RIFF');
  assert.equal(view.getUint16(22, true), 1); assert.equal(view.getUint32(24, true), RATE);
  assert.equal(view.getUint32(40, true), data.length * 4 * 2);
  for (const i of [0, 200, 4000, 4001, 10000]) {
    const x = mixSample(data.tracks, gains, i % data.length, data.master);
    assert.equal(view.getInt16(44 + i * 2, true), Math.round(x * (x < 0 ? 32768 : 32767)));
  }
  assert.throws(() => encodeWav(data, 0));
});
