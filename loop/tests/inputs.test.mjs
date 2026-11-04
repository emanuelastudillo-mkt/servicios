import test from 'node:test';
import assert from 'node:assert/strict';
import { InputManager, inputConfig, captureOptions } from '../inputs.js';
import { encodeSession, decodeSession, resampleSession } from '../files.js';
import { LoopEngine } from '../audio-core.js';

function track(kind, surface) {
  const events = new Map();
  return { kind, label: kind + ' test', readyState: 'live', stops: 0,
    getSettings: () => ({ displaySurface: surface }),
    addEventListener: (name, fn) => events.set(name, fn),
    end() { this.readyState = 'ended'; events.get('ended')?.(); },
    stop() { this.readyState = 'ended'; this.stops++; } };
}
function stream(surface, audio = true) {
  const tracks = [...(audio ? [track('audio')] : []), ...(surface ? [track('video', surface)] : [])];
  return { getTracks: () => tracks, getAudioTracks: () => tracks.filter(t => t.kind === 'audio'), getVideoTracks: () => tracks.filter(t => t.kind === 'video') };
}
function graph() {
  const nodes = [];
  const make = () => {
    const node = { connections: [], gain: { value: 1, setTargetAtTime(value) { this.value = value; } },
      connect(...args) { this.connections.push(args); return args[0]; },
      disconnect(target) { this.connections = target ? this.connections.filter(c => c[0] !== target) : []; },
      getFloatTimeDomainData(values) { values.fill(.125); } };
    nodes.push(node); return node;
  };
  return { ctx: { currentTime: 1, createGain: make, createAnalyser: make, createMediaStreamSource: make }, node: make(), nodes };
}
function setup(extra = {}) {
  const g = graph(), requests = [], streams = [];
  const media = {
    getUserMedia: async options => { requests.push(options); const value = stream(); streams.push(value); return value; },
    getDisplayMedia: async options => { requests.push(options); const value = stream(options.video.displaySurface); streams.push(value); return value; }
  };
  const manager = new InputManager({ getGraph: async () => g, media, makeStream: () => ({}), ...extra });
  return { manager, g, requests, streams, media };
}
const config = (kind = 'device', deviceId = '') => ({ ...inputConfig(), kind, deviceId });

test('native inputs use their worklet directly and keep a single shared capture', async () => {
  const g = graph(), value = stream(), native = g.ctx.createGain(); let captures = 0, releases = 0;
  value.nativeSource = native; value.release = () => releases++;
  g.ctx.createMediaStreamSource = () => { throw Error('Native source must not make a MediaStream round trip'); };
  const { manager: m } = setup({ getGraph: async () => g, nativeCapture: async () => { captures++; return value; } });
  m.setConfig(0, config('native', 'in:0:scarlett')); await m.connect(0); await m.applyToAll(0);
  assert.equal(captures, 1); assert.ok(m.slots.every(s => s.entry.source === native));
  m.disconnect(0); assert.equal(releases, 0); m.disconnectAll(); assert.equal(releases, 1);
});

test('six assigned sources route to distinct Worklet inputs with independent pre-record gain', async () => {
  const { manager: m, requests, g } = setup();
  for (let i = 0; i < 6; i++) { m.setConfig(i, config('device', 'device-' + i)); await m.connect(i); }
  assert.equal(requests.length, 6);
  assert.deepEqual(m.slots.map(s => s.analyser.connections[0]), Array.from({ length: 6 }, (_, i) => [g.node, 0, i]));
  m.setConfig(1, { ...m.configs[1], gain: 1.7 });
  m.setConfig(2, { ...m.configs[2], muted: true });
  assert.deepEqual(m.slots.map(s => s.gain.gain.value), [1, 1.7, 0, 1, 1, 1]);
  assert.equal(m.peak(0), .125);
  m.disconnectAll(); assert.equal(m.slots.filter(Boolean).length, 0);
});
test('same device is shared and released only after the last loop disconnects', async () => {
  const { manager: m, requests, streams } = setup();
  await m.connect(0); await m.connect(1); await m.connect(0);
  assert.equal(requests.length, 1); assert.equal(m.slots[0].entry.refs.size, 2);
  m.disconnect(0); assert.equal(streams[0].getAudioTracks()[0].stops, 0);
  m.disconnect(1); assert.equal(streams[0].getAudioTracks()[0].stops, 1);
  assert.equal(m.pool.size, 0);
});
test('display chooser is requested before asynchronous audio initialization, with explicit scope', async () => {
  const order = [], g = graph();
  const { manager: m, media } = setup({ getGraph: async () => { order.push('graph'); return g; } });
  media.getDisplayMedia = options => { order.push('capture'); assert.equal(options.windowAudio, 'window'); return Promise.resolve(stream('window')); };
  m.setConfig(0, config('window')); await m.connect(0);
  assert.equal(order[0], 'capture'); assert.equal(m.slots[0].entry.stream.getVideoTracks().length, 1);
  assert.equal(captureOptions('system').systemAudio, 'include');
  assert.equal(captureOptions('tab').systemAudio, 'exclude');
  m.disconnectAll();
});
test('no-audio and wrong-surface captures fail and stop all tracks', async () => {
  for (const value of [stream('window', false), stream('monitor')]) {
    const { manager: m, media } = setup(); media.getDisplayMedia = async () => value;
    m.setConfig(0, config('window'));
    await assert.rejects(m.connect(0), /audio|tipo de fuente/);
    assert.ok(value.getTracks().every(t => t.stops === 1));
    assert.equal(m.slots[0], null); assert.equal(m.pending, -1);
  }
});
test('canceling a replacement chooser retains the old live capture', async () => {
  const { manager: m, media } = setup(); m.setConfig(0, config('tab')); await m.connect(0);
  const old = m.slots[0]; media.getDisplayMedia = async () => { throw Object.assign(Error('cancel'), { name: 'NotAllowedError' }); };
  await assert.rejects(m.connect(0), /cancel/);
  assert.equal(m.slots[0], old); assert.equal(old.entry.stream.getAudioTracks()[0].readyState, 'live');
  m.disconnectAll();
});
test('pending capture is exclusive and a late grant after disposal is cleaned up', async () => {
  let grant;
  const { manager: m, media } = setup();
  media.getUserMedia = () => new Promise(resolve => { grant = resolve; });
  const pending = m.connect(0); assert.equal(m.pending, 0);
  assert.equal(await m.connect(1), false);
  m.disconnectAll(); const value = stream(); grant(value);
  assert.equal(await pending, false); assert.equal(m.slots[0], null);
  assert.equal(value.getAudioTracks()[0].stops, 1);
});
test('graph failure releases granted media; source end releases all shared routes', async () => {
  const failed = setup({ getGraph: async () => { throw Error('graph unavailable'); } });
  await assert.rejects(failed.manager.connect(0), /graph unavailable/);
  assert.equal(failed.streams[0].getAudioTracks()[0].stops, 1);
  const ended = [], { manager: m, streams } = setup({ onEnded: id => ended.push(id) });
  await m.connect(0); await m.connect(3); streams[0].getAudioTracks()[0].end();
  assert.deepEqual(ended, [0, 3]); assert.equal(m.slots.filter(Boolean).length, 0);
});
test('capture video ending also releases audio; exact hardware IDs never fall back silently', async () => {
  const { manager: m, streams, requests } = setup();
  m.setConfig(2, config('device', 'focusrite-exact')); await m.connect(2);
  assert.deepEqual(requests[0].audio.deviceId, { exact: 'focusrite-exact' });
  m.setConfig(0, config('window')); await m.connect(0); streams[1].getVideoTracks()[0].end();
  assert.equal(m.slots[0], null); assert.equal(streams[1].getAudioTracks()[0].readyState, 'ended');
  assert.ok(m.slots[2]); m.disconnectAll();
});

test('apply to all copies assignments and pre-record levels while sharing one active capture', async () => {
  const { manager: m, streams, requests } = setup();
  m.setConfig(0, config('device', 'old-device')); await m.connect(0);
  m.setConfig(2, { ...config('window'), gain: .65, muted: true }); await m.connect(2);
  const original = m.slots[2].entry;
  assert.equal(await m.applyToAll(2), true);
  assert.equal(requests.length, 2); assert.equal(streams[0].getAudioTracks()[0].stops, 1);
  assert.ok(m.slots.every(s => s.entry === original && s.gain.gain.value === 0));
  assert.ok(m.configs.every(c => c.kind === 'window' && c.gain === .65 && c.muted));
  assert.equal(original.refs.size, 6);
  m.disconnect(2); assert.equal(original.stream.getAudioTracks()[0].stops, 0);
  m.disconnectAll(); assert.ok(original.stream.getTracks().every(t => t.stops === 1));
});
test('apply disconnected settings closes old sources without requesting capture; native resources release once', async () => {
  let releases = 0;
  const native = stream(); native.release = () => releases++;
  const { manager: m, requests } = setup({ nativeCapture: async () => native });
  m.setConfig(0, config('native', 'app:123:456')); await m.connect(0); await m.applyToAll(0);
  assert.equal(requests.length, 0);
  m.disconnect(5); assert.equal(releases, 0);
  m.setConfig(5, { ...config('device', 'new-device'), gain: .4 });
  assert.equal(await m.applyToAll(5), false);
  assert.equal(releases, 1); assert.ok(m.slots.every(s => s === null));
  assert.ok(m.configs.every(c => c.deviceId === 'new-device' && c.gain === .4));
});
test('browser rejects desktop-only sources instead of recording a different source', async () => {
  const { manager: m, requests } = setup(); m.setConfig(0, config('native', 'out:device'));
  await assert.rejects(m.connect(0), /escritorio/); assert.equal(requests.length, 0);
});

function session() {
  return { rate: 8000, length: 4000, master: .75, tracks: Array.from({ length: 6 }, (_, i) => ({ samples: i ? null : new Float32Array(4000).fill(.2), volume: .8, muted: false, solo: false })) };
}
function editMetadata(buffer, edit) {
  const bytes = new Uint8Array(buffer), oldSize = new DataView(buffer).getUint32(8, true);
  const meta = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + oldSize))); edit(meta);
  const json = new TextEncoder().encode(JSON.stringify(meta)), next = new Uint8Array(12 + json.length + bytes.length - 12 - oldSize);
  next.set(bytes.subarray(0, 8)); new DataView(next.buffer).setUint32(8, json.length, true);
  next.set(json, 12); next.set(bytes.subarray(12 + oldSize), 12 + json.length); return next.buffer;
}
test('sessions persist input assignments, gain and mute; old files get safe disconnected defaults', () => {
  const configs = Array.from({ length: 6 }, (_, i) => ({ ...config(i % 2 ? 'tab' : 'device', 'dev-' + i), label: 'Fuente ' + i, gain: i / 3, muted: i === 2 }));
  const binary = encodeSession(session(), 'Entradas', [], configs), decoded = decodeSession(binary);
  assert.deepEqual(decoded.tracks.map(t => t.input), configs.map(inputConfig));
  assert.deepEqual(resampleSession(decoded, 48000).tracks.map(t => t.input), configs.map(inputConfig));
  const old = decodeSession(editMetadata(binary, meta => meta.tracks.forEach(t => delete t.input)));
  assert.ok(old.tracks.every(t => t.input.kind === 'device' && t.input.gain === 1 && !t.input.muted));
  for (const bad of [{ kind: 'invented' }, { gain: 100 }, { deviceId: {} }, { muted: 'yes' }]) {
    assert.throws(() => decodeSession(editMetadata(binary, meta => Object.assign(meta.tracks[0].input, bad))), /entrada inválida/);
  }
});
test('lost input preserves a valid partial take, never affects another track, and releases preparation', () => {
  const e = new LoopEngine(8000); e.startRecording(1);
  e.process(new Float32Array(3000).fill(.2), new Float32Array(3000));
  e.command({ type: 'inputLost', id: 2 }); assert.ok(e.recording);
  e.command({ type: 'inputLost', id: 1 }); assert.equal(e.length, 3000); assert.ok(e.tracks[1].samples);
  e.startRecording(2); e.process(new Float32Array(1000).fill(.4), new Float32Array(1000));
  e.command({ type: 'inputLost', id: 2 }); assert.equal(e.length, 3000);
  assert.ok(e.tracks[2].samples.slice(1000).every(x => x === 0));
  e.startRecording(0); e.command({ type: 'inputLost', id: 0 }); assert.equal(e.recording, null);
  assert.ok(e.tracks[1].samples); assert.ok(e.tracks[2].samples);
  const short = new LoopEngine(8000); short.startRecording(1);
  short.process(new Float32Array(100), new Float32Array(100)); short.command({ type: 'inputLost', id: 1 });
  assert.equal(short.recording, null); assert.equal(short.length, 0);
});
