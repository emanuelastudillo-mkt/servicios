import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EFFECTS } from '../effects.js';
import { NativeMonitorControl, nativeMonitorDescription, matchingOutput } from '../native-monitor.js';

const defer = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
test('native parameter validation matches the web pedal definitions', async () => {
  const actual = JSON.parse(await readFile(new URL('../../loop-desktop/monitor-effects.json', import.meta.url), 'utf8'));
  const expected = Object.fromEntries(Object.entries(EFFECTS).map(([type, effect]) => [type,Object.fromEntries(Object.entries(effect.params).map(([key,p])=>[key,[p.min,p.max]]))]));
  assert.deepEqual(actual,expected);
});
test('output routing matches only a unique named device, never guesses between duplicates', () => {
  const devices = [{id:'a',label:'Scarlett'}, {id:'b',label:'Speakers'}];
  assert.equal(matchingOutput(devices,'Scarlett').id,'a'); assert.equal(matchingOutput(devices,'Unknown'),null);
  assert.equal(matchingOutput([...devices,{id:'c',label:'Scarlett'}],'Scarlett'),null); assert.equal(matchingOutput(devices,''),null);
});
test('stopping during native startup cannot leave the monitor running', async () => {
  const first = defer(), calls = [], states = [];
  const control = new NativeMonitorControl((action, value) => { calls.push(value); return calls.length === 1 ? first.promise : Promise.resolve({ active: false }); }, s => states.push(s), e => { throw e; });
  const pending = control.set({ active: true, captureId: 'a' });
  control.set({ active: false }); first.resolve({ active: true }); await pending;
  assert.deepEqual(calls.map(v => v.active), [true, false]); assert.deepEqual(states, [{ active: false }]);
});
test('rapid pedal and tuning changes are serialized and retain the latest settings', async () => {
  const first = defer(), calls = [];
  const control = new NativeMonitorControl((action, value) => { calls.push(value); return calls.length === 1 ? first.promise : Promise.resolve(value); }, () => {}, e => { throw e; });
  const pending = control.set({ active: true, gain: 1 });
  control.set({ active: true, gain: 1.5 }); control.set({ active: true, gain: .7, muted: true, effects: { bypass: true, pedals: [] } });
  first.resolve({ active: true }); await pending;
  assert.equal(calls.length, 2); assert.equal(calls[1].gain, .7); assert.equal(calls[1].muted, true); assert.equal(calls[1].effects.bypass, true);
});
test('a failed native start sends stop without automatically enabling browser monitoring', async () => {
  const calls = [], errors = [];
  const control = new NativeMonitorControl(async (action, value) => { calls.push(value); if (value.active) throw Error('device lost'); return { active: false }; }, () => {}, e => errors.push(e.message));
  await control.set({ active: true }); assert.deepEqual(calls, [{ active: true }, { active: false }]); assert.deepEqual(errors, ['device lost']);
});
test('a stale failure does not cancel the newly selected input', async () => {
  const first = defer(), calls = [], errors = [];
  const control = new NativeMonitorControl((action, value) => { calls.push(value); return calls.length === 1 ? first.promise : Promise.resolve(value); }, () => {}, e => errors.push(e));
  const pending = control.set({ active: true, captureId: 'a' }); control.set({ active: true, captureId: 'b' }); first.reject(Error('a disconnected')); await pending;
  assert.equal(calls[1].captureId, 'b'); assert.equal(errors.length, 0);
});
test('native diagnostics distinguish buffer figures from a measured round trip', () => {
  const text = nativeMonitorDescription({ active: true, output: 'Scarlett', lowLatency: false, inputPeriodMs: 3, outputPeriodMs: 10, queueMs: 4, underruns: 2 });
  assert.match(text, /modo compatible/); assert.match(text, /no miden el retardo total/); assert.match(text, /Cortes: 2/);
});
