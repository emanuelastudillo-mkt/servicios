import test from 'node:test';
import assert from 'node:assert/strict';
import { readMode, writeMode, capabilities, signalResult, audioError } from '../experience.js';

test('first visit and blocked storage keep a usable simple interface', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.equal(readMode(blocked), 'simple'); assert.equal(writeMode(blocked, 'advanced'), false);
  assert.equal(readMode(null), 'simple');
  assert.equal(writeMode(null, 'advanced'), false);
});
test('mode persists without treating unexpected saved values as advanced', () => {
  let saved; const store = { setItem(k, v) { saved = v; }, getItem() { return saved; } };
  assert.equal(writeMode(store, 'advanced'), true); assert.equal(readMode(store), 'advanced');
  writeMode(store, 'invalid'); assert.equal(readMode(store), 'simple');
});
test('missing output selection or screen capture does not imply microphone recording is unavailable', () => {
  const env = { isSecureContext: true, AudioContext: function () {}, AudioWorkletNode: function () {}, navigator: { mediaDevices: { getUserMedia() {} } } };
  const checks = capabilities(env);
  assert.deepEqual(checks.map(c => c.ok), [true, true, false, false]);
  assert.match(checks[3].detail, /podés seguir grabando/);
  assert.equal(capabilities({ ...env, isSecureContext: false })[0].ok, false);
});
test('native process support uses the reported Windows capability, not a browser screen-capture flag', () => {
  const oldWindows = capabilities({}, { processCapture: false });
  assert.equal(oldWindows[2].ok, false); assert.match(oldWindows[2].detail, /audio completo de una salida/);
  assert.equal(capabilities({}, { processCapture: true })[2].ok, true);
});
test('input diagnostics distinguish silence, muted input, lost device, clipping and real signal', () => {
  const good = { connected: true, gain: 1, muted: false, kind: 'device', peak: .2 };
  assert.equal(signalResult(good).ok, true); assert.match(signalResult(good).text, /-14 dBFS/);
  for (const patch of [{ connected: false }, { gain: 0 }, { muted: true }, { peak: 0 }, { peak: 1 }]) assert.equal(signalResult({ ...good, ...patch }).ok, false);
  assert.match(signalResult({ ...good, kind: 'native', peak: 0 }).text, /ASIO/);
});
test('permissions, disconnected and exclusive devices get actionable messages without silent fallback', () => {
  assert.match(audioError({ name: 'NotAllowedError' }), /permisos/);
  assert.match(audioError({ name: 'NotAllowedError' }, true), /salida/);
  assert.match(audioError({ name: 'OverconstrainedError' }), /Actualiz/);
  assert.match(audioError({ name: 'NotReadableError' }), /exclusivo/);
  assert.equal(audioError({ message: 'Error específico' }), 'Error específico');
});
