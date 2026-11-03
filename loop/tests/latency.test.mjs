import test from 'node:test';
import assert from 'node:assert/strict';
import { latencyConfig, routeKey, resolveLatency, probeDefinition, probeSample, LatencyProbe, measureLatency } from '../latency.js';
import { LoopEngine } from '../audio-core.js';
import { spaceAction } from '../controls.js';
import { inputConfig, InputManager } from '../inputs.js';
import { encodeSession, decodeSession } from '../files.js';

const config = { ...inputConfig(), deviceId: 'scarlett' };
function returnedSignal(rate, delays, gain = .4, noise = .0001) {
  const { starts, frames, pulseFrames } = probeDefinition(rate), result = new Float32Array(frames);
  let seed = 8731;
  for (let i = 0; i < frames; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; result[i] = .003 + noise * ((seed >>> 0) / 2147483648 - 1); }
  starts.forEach((start, index) => {
    const delay = Array.isArray(delays) ? delays[index] : delays;
    for (let i = 0; i < pulseFrames; i++) result[start + delay + i] += gain * probeSample(i, rate);
  });
  return result;
}
test('latency estimates input plus both output stages, while native/DAW unknowns stay uncalibrated', () => {
  const context = { baseLatency: .005, outputLatency: .025 };
  assert.equal(resolveLatency(config, { latency: .01 }, context).ms, 40);
  assert.equal(resolveLatency({ ...config, kind: 'native' }, { latency: 0 }, context).ready, false);
  assert.equal(resolveLatency(config, {}, context).ready, false);
  assert.equal(resolveLatency(config, { latency: .01 }, { baseLatency: .005 }).ready, false);
  assert.equal(resolveLatency({ ...config, latency: { mode: 'off', ms: 0, route: '' } }).ready, true);
});
test('measured/manual totals never double count estimates and cannot follow an unrelated route', () => {
  const route = routeKey(config, { deviceId: 'actual' }, 'scarlett-output', 48000);
  const measured = { ...config, latency: { mode: 'measured', ms: 83.7, route } };
  assert.equal(resolveLatency(measured, { latency: .02 }, { baseLatency: .01, outputLatency: .05 }, route).ms, 83.7);
  for (const other of [routeKey(config, {}, 'scarlett-output', 48000), routeKey(config, { deviceId: 'actual' }, 'headphones', 48000), routeKey(config, { deviceId: 'actual' }, 'scarlett-output', 44100), '']) {
    assert.equal(resolveLatency(measured, {}, {}, other).ready, false);
    assert.equal(resolveLatency(measured, {}, {}, other).ms, 0);
  }
  assert.throws(() => latencyConfig({ mode: 'manual', ms: NaN, route }));
  assert.throws(() => latencyConfig({ mode: 'manual', ms: 751, route }));
  const native = { ...config, kind: 'native', deviceId: 'app:123:456' };
  assert.equal(routeKey(native, { deviceId: 'WebAudio-one' }, 'out', 48000), routeKey(native, { deviceId: 'WebAudio-two' }, 'out', 48000));
});
test('three returned probes measure known delays at 44.1, 48, 96 and 192 kHz with gain, noise and inverted polarity', () => {
  for (const rate of [44100, 48000, 96000, 192000]) {
    const frames = Math.round(.1373 * rate);
    const measured = measureLatency(returnedSignal(rate, frames, rate === 96000 ? -.7 : .4), rate);
    assert.equal(measured.frames, frames); assert.ok(measured.confidence > .98); assert.equal(measured.spreadMs, 0);
  }
});
test('calibration rejects missing audio, unrelated audio, clipped probes and unstable routing', () => {
  const rate = 48000, { frames } = probeDefinition(rate);
  assert.throws(() => measureLatency(new Float32Array(frames), rate), /retorno claro/);
  const random = returnedSignal(rate, 2400, 0, .02);
  assert.throws(() => measureLatency(random, rate), /retorno claro/);
  assert.throws(() => measureLatency(returnedSignal(rate, [2400, 3100, 4700]), rate), /varió/);
  assert.throws(() => measureLatency(returnedSignal(rate, 2400, 120), rate), /retorno claro/);
  assert.throws(() => measureLatency(new Float32Array(10), rate), /incompleta/);
});
test('probe uses a single sample clock for emission and capture, bounded duration and quiet level', () => {
  const probe = new LatencyProbe(8000), output = new Float32Array(128), input = new Float32Array(128).fill(.4);
  let peak = 0, done = false;
  while (!done) { done = probe.process(input, output); for (const n of output) peak = Math.max(peak, Math.abs(n)); }
  assert.ok(peak > .02 && peak <= .025); assert.equal(probe.samples.length, 32000);
  assert.ok(probe.samples.every(n => Math.abs(n - .4) < 1e-6));
  probe.process(input, output); assert.ok(output.every(n => n === 0));
});
function feed(engine, count, value = () => 0) { const out = new Float32Array(1), input = new Float32Array(1); for (let i = 0; i < count; i++) { input[0] = value(i); engine.process(input, out); } }
test('compensation records a complete delayed performance including its tail and excludes pre-roll', () => {
  const rate = 8000, length = 4000, delay = 600;
  const engine = new LoopEngine(rate); engine.startRecording(1); feed(engine, length); engine.finishFirst();
  const original = engine.tracks[1].samples.slice(); engine.startRecording(2, delay * 1000 / rate);
  feed(engine, delay, () => .9); assert.equal(engine.recording.written, 0);
  feed(engine, length - 1, i => i === 100 ? .6 : i === length - 101 ? .8 : 0);
  assert.ok(engine.recording); feed(engine, 1);
  assert.equal(engine.recording, null); assert.equal(engine.length, length);
  assert.equal(engine.tracks[2].samples.length, length); assert.ok(Math.abs(engine.tracks[2].samples[100] - .6) < 1e-6);
  assert.ok(Math.abs(engine.tracks[2].samples[length - 101] - .8) < 1e-6);
  assert.ok(engine.tracks[2].samples.every(n => n < .81)); assert.deepEqual(engine.tracks[1].samples, original);
});
test('partial finish and disconnected input preserve only captured aligned samples', () => {
  const e = new LoopEngine(8000); e.startRecording(1); feed(e, 4000); e.finishFirst();
  e.startRecording(2, 100); feed(e, 800, () => 1); e.finishRecording(); assert.ok(e.recording);
  feed(e, 1000, () => .3); e.command({ type: 'inputLost', id: 2 });
  assert.equal(e.recording, null); assert.ok(e.tracks[2].samples.slice(1000).every(n => n === 0));
  assert.ok(e.tracks[2].samples[500] > .29); assert.equal(e.length, 4000);
  e.startRecording(3, 100); feed(e, 10); e.command({ type: 'inputLost', id: 3 }); assert.equal(e.tracks[3].samples, null);
});
test('sessions and apply-to-all retain independent latency settings and old sessions remain valid', async () => {
  const m = new InputManager({ getGraph: async () => { throw Error('No capture expected'); } });
  const original = { ...config, latency: { mode: 'manual', ms: 72.4, route: 'test-route' } };
  m.setConfig(2, original); await m.applyToAll(2);
  assert.ok(m.configs.every(c => c.latency.ms === 72.4 && c.latency.route === 'test-route'));
  const data = { rate: 48000, length: 0, master: .75, tracks: Array.from({ length: 6 }, () => ({ samples: null, volume: .8, muted: false, solo: false })) };
  const loaded = decodeSession(encodeSession(data, 'Latencia', [], m.configs));
  assert.deepEqual(loaded.tracks[0].input.latency, original.latency);
  assert.deepEqual(inputConfig({ kind: 'device', deviceId: '', label: '', gain: 1, muted: false }).latency, latencyConfig());
});

test('Space closes at the performed endpoint after receiving the delayed tail, without extending on repeats', () => {
  const e = new LoopEngine(8000); e.startRecording(1); feed(e, 4000); e.finishFirst();
  e.startRecording(2, 100); feed(e, 800); feed(e, 1200, () => .3);
  e.command(spaceAction(e.state())); assert.equal(e.recording.endAt, 2000); assert.equal(e.state().recording.ending, true);
  assert.equal(spaceAction(e.state()).type, 'wait'); e.finishRecording(); assert.equal(e.recording.endAt, 2000);
  feed(e, 800, i => i === 600 ? .7 : .3);
  assert.equal(e.recording, null); assert.ok(e.tracks[2].samples[1800] > .69);
  assert.ok(e.tracks[2].samples.slice(2000).every(n => n === 0)); assert.equal(e.length, 4000);
});
test('a finish during the latency wait still captures the short performance when it arrives', () => {
  const e = new LoopEngine(8000); e.startRecording(1); feed(e, 4000); e.finishFirst();
  e.startRecording(2, 100); feed(e, 400); e.finishRecording(); assert.equal(e.recording.endAt, 400);
  feed(e, 400); feed(e, 400, () => .4);
  assert.equal(e.recording, null); assert.ok(e.tracks[2].samples[200] > .39); assert.ok(e.tracks[2].samples.slice(400).every(n => n === 0));
});
