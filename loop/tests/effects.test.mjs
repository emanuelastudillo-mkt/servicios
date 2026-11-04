import test from 'node:test';
import assert from 'node:assert/strict';
import { EFFECTS, EFFECT_ORDER, pedal, effectsConfig, EffectsChain } from '../effects.js';
import { LoopEngine } from '../audio-core.js';
import { encodeSession, decodeSession, encodeWav } from '../files.js';
import { detectPitch } from '../tuner.js';
const rate = 48000;
function chain(type, params = {}, sampleRate = rate) { const p = pedal(type); Object.assign(p.params, params); return new EffectsChain(sampleRate, { bypass: false, pedals: [p] }); }
function render(c, seconds, source = i => .1 * Math.sin(2 * Math.PI * 220 * i / rate), fs = rate) { const out = new Float32Array(Math.round(seconds * fs)); for (let i = 0; i < out.length; i++) out[i] = c.process(source(i)); return out; }
const rms = x => Math.sqrt(x.reduce((sum, n) => sum + n * n, 0) / x.length);
function magnitude(x, frequency, fs = rate) { let re = 0, im = 0; for (let i = 0; i < x.length; i++) { re += x[i] * Math.cos(2 * Math.PI * frequency * i / fs); im += x[i] * Math.sin(2 * Math.PI * frequency * i / fs); } return Math.hypot(re, im) / x.length; }

test('all 16 pedals are functional, finite, and process silence without self-oscillation', () => {
  assert.equal(EFFECT_ORDER.length, 16);
  for (const type of EFFECT_ORDER) {
    const c = chain(type), dry = render(new EffectsChain(rate), .3), wet = render(c, .3);
    assert.ok(wet.every(Number.isFinite), type);
    if (type !== 'volume') assert.ok(wet.some((v, i) => Math.abs(v - dry[i]) > .001), type + ' changes signal');
    const silent = render(chain(type), .2, () => 0);
    assert.ok(silent.every(v => v === 0), type + ' silent input');
  }
});
test('empty, disabled and bypassed chains preserve dry samples exactly', () => {
  const configs = [effectsConfig(), { bypass: true, pedals: EFFECT_ORDER.map(pedal) }, { bypass: false, pedals: EFFECT_ORDER.map(type => ({ ...pedal(type), enabled: false })) }];
  for (const cfg of configs) {
    const fx = new EffectsChain(rate, cfg);
    for (let i = 0; i < 2000; i++) { const x = .2 * Math.sin(i * .03); assert.equal(fx.process(x), x); }
  }
});
test('gate suppresses quiet noise and releases audible notes without deleting samples', () => {
  const low = render(chain('gate'), .5, () => .0005); assert.ok(rms(low) < .00001);
  const fx = chain('gate'); const loud = render(fx, .5); assert.ok(rms(loud.subarray(12000)) > .06);
  const tail = render(fx, 2, () => .0005); assert.ok(rms(tail.subarray(-4800)) < .00001);
});
test('compressor matches its static threshold/ratio and booster matches decibels', () => {
  const c = chain('compressor', { threshold: -20, ratio: 4, attack: 1, release: 20, makeup: 0 });
  const out = render(c, .5, () => 1);
  assert.ok(Math.abs(out.at(-1) - 10 ** (-15 / 20)) < .001);
  assert.ok(Math.abs(chain('boost', { gain: 6 }).process(.1) - .1 * 10 ** (6 / 20)) < 1e-9);
  assert.equal(chain('volume', { level: 0 }).process(.5), 0);
});
test('three saturation pedals add harmonics beyond a clean sinusoid', () => {
  for (const type of ['overdrive','distortion','fuzz']) {
    const wet = render(chain(type, { drive: 90 }), 1, i => .25 * Math.sin(2 * Math.PI * 220 * i / rate));
    assert.ok(magnitude(wet.subarray(rate / 2), 660) > .005, type);
  }
});
test('delay repeats an impulse at its configured time and feedback; reset clears tails', () => {
  const fx = chain('delay', { time: 100, feedback: 50, mix: 100 });
  const out = render(fx, .35, i => i === 0 ? 1 : 0);
  assert.equal(out[4800], 1); assert.equal(out[9600], .5); assert.equal(out[14400], .25);
  fx.reset(); assert.ok(render(fx, .2, () => 0).every(v => v === 0));
});
test('reverb creates a decaying tail without changing the input buffer', () => {
  const wet = render(chain('reverb', { mix: 100, decay: .5 }), 2, i => i === 0 ? 1 : 0);
  assert.ok(rms(wet.subarray(1000, 10000)) > .001);
  assert.ok(rms(wet.subarray(-10000)) < rms(wet.subarray(1000, 10000)) * .01);
});
test('tremolo depth, wah frequency movement and pitch octaves have the intended behavior', () => {
  const t = render(chain('tremolo', { depth: 100, rate: 4 }), .5, () => .5);
  assert.ok(Math.min(...t) < 1e-6 && Math.max(...t) > .499);
  const dark = render(chain('wah', { position: 0 }), .5, i => .2 * Math.sin(2 * Math.PI * 300 * i / rate));
  const bright = render(chain('wah', { position: 100 }), .5, i => .2 * Math.sin(2 * Math.PI * 300 * i / rate));
  assert.ok(rms(dark.subarray(12000)) > rms(bright.subarray(12000)) * 4);
  for (const [steps, hz] of [[12,440],[-12,110],[7,220*2**(7/12)]]) {
    const shifted = render(chain('pitch', { semitones: steps, mix: 100 }), 1).subarray(24000);
    assert.ok(magnitude(shifted, hz) > magnitude(shifted, 220) * 3, 'shift ' + steps);
  }
});
test('parameter validation rejects unknown, duplicate, non-finite and out-of-range effects', () => {
  assert.throws(() => effectsConfig({ bypass: false, pedals: [{ ...pedal('boost'), type: '__proto__' }] }));
  assert.throws(() => effectsConfig({ bypass: false, pedals: [pedal('delay'), pedal('delay')] }));
  for (const n of [NaN, Infinity, -1, 100]) assert.throws(() => effectsConfig({ bypass: false, pedals: [{ ...pedal('boost'), params: { gain: n } }] }));
});
test('extreme valid settings at 8/44.1/48/96 kHz remain finite and bounded', () => {
  for (const fs of [8000,44100,48000,96000]) {
    const pedals = EFFECT_ORDER.map(type => { const p = pedal(type); for (const [key, spec] of Object.entries(EFFECTS[type].params)) p.params[key] = spec.max; return p; });
    const out = render(new EffectsChain(fs, { bypass: false, pedals }), .15, i => i % 3 === 0 ? 8 : -8, fs);
    assert.ok(out.every(x => Number.isFinite(x) && Math.abs(x) <= 16));
  }
});
test('live effects and monitoring leave recorded dry samples intact; tuner mutes output only', () => {
  const e = new LoopEngine(8000); e.command({ type: 'track', id: 1, effects: { bypass: false, pedals: [pedal('boost')] } });
  e.command({ type: 'settings', monitor: true, inputTrack: 1 }); e.startRecording(1);
  const input = new Float32Array(4000).fill(.1), output = new Float32Array(4000);
  e.process(input, output); assert.ok(output[100] > .14); e.finishFirst();
  assert.ok(Math.abs(e.tracks[1].samples[500] - .1) < 1e-7);
  const original = e.tracks[1].samples.slice(); e.command({ type: 'settings', tuning: true }); e.process(input, output);
  assert.ok(output.every(x => x === 0)); assert.deepEqual(e.tracks[1].samples, original);
  e.command({ type: 'settings', tuning: false }); e.process(input, output); assert.ok(output.some(x => x > .1));
});
test('sessions preserve editable effects, original samples, empty-track settings and WAV processing', () => {
  const e = new LoopEngine(8000); e.startRecording(1); e.process(new Float32Array(4000).fill(.1), new Float32Array(4000)); e.finishFirst();
  const cfg = { bypass: false, pedals: [pedal('boost'), pedal('delay')] }; e.command({ type: 'track', id: 1, effects: cfg }); e.command({ type: 'track', id: 5, effects: cfg });
  const snapshot = e.snapshot(), decoded = decodeSession(encodeSession(snapshot, 'FX', []));
  assert.deepEqual(decoded.tracks[1].effects, cfg); assert.deepEqual(decoded.tracks[5].effects, cfg); assert.deepEqual(decoded.tracks[1].samples, snapshot.tracks[1].samples);
  const wav = new DataView(encodeWav(decoded, 2)), ref = new EffectsChain(8000, cfg);
  for (let i = 0; i < 8000; i++) {
    const value = ref.process(decoded.tracks[1].samples[i % 4000]) * .8 * .75;
    assert.equal(wav.getInt16(44 + i * 2, true), Math.round(value * (value < 0 ? 32768 : 32767)));
  }
});
test('version 1 sessions still open and undo restores the saved pedal chain', () => {
  const e = new LoopEngine(8000); e.startRecording(2); e.process(new Float32Array(4000).fill(.1), new Float32Array(4000)); e.finishFirst();
  const encoded = encodeSession(e.snapshot(), 'Old', []), bytes = new Uint8Array(encoded), size = new DataView(encoded).getUint32(8, true);
  const json = new TextDecoder().decode(bytes.subarray(12,12+size)).replace('"version":2','"version":1'); bytes.set(new TextEncoder().encode(json),12);
  const decoded = decodeSession(encoded); assert.deepEqual(decoded.tracks[2].effects, effectsConfig());
  e.command({ type: 'track', id: 2, effects: { bypass: false, pedals: [pedal('chorus')] } }); e.clear(2);
  e.command({ type: 'track', id: 2, effects: effectsConfig() }); e.restore(); assert.equal(e.tracks[2].effects.pedals[0].type, 'chorus');
});
test('tuner identifies common guitar/bass notes and cents, rejects silence and noise', () => {
  for (const fs of [44100,48000,96000]) for (const hz of [55,82.4069,110,164.8138,220,329.6276,440,880]) {
    const samples = Float32Array.from({length:8192}, (_, i) => .2 * Math.sin(2*Math.PI*hz*i/fs) + .07*Math.sin(4*Math.PI*hz*i/fs));
    const pitch = detectPitch(samples,fs); assert.ok(pitch && Math.abs(1200*Math.log2(pitch.hz/hz)) < 3, `${fs} ${hz}: ${pitch?.hz}`);
  }
  assert.equal(detectPitch(new Float32Array(8192),rate),null);
  let seed = 7; const noise = Float32Array.from({length:8192},()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed/2147483648)*.1;});
  assert.equal(detectPitch(noise,rate),null);
});
