import test from 'node:test';
import assert from 'node:assert/strict';
import { NativeBuffer } from '../native-buffer.js';
test('native packets play continuously across chunks and resample 44.1 kHz to 48 kHz', () => {
  const buffer = new NativeBuffer(48000);
  const signal = Float32Array.from({ length: 4410 }, (_, i) => i / 4410);
  buffer.push(signal.slice(0, 2205), 44100, 1); buffer.push(signal.slice(2205), 44100, 2);
  const output = new Float32Array(4700); buffer.render(output);
  for (let i = 0; i < output.length; i++) assert.ok(Math.abs(output[i] - i / 4800) < .000001);
});
test('native silence, dropped packets, bad samples and overflows do not replay stale audio', () => {
  const buffer = new NativeBuffer(48000, 4096), output = new Float32Array(128);
  buffer.render(output); assert.ok(output.every(v => v === 0));
  buffer.push(new Float32Array(1000).fill(.5), 48000, 1); buffer.render(output); assert.equal(output[64], .5);
  buffer.push(new Float32Array(1000).fill(.1), 48000, 4); buffer.render(output); assert.ok(Math.abs(output[64] - .1) < .000001);
  buffer.push(new Float32Array(1000).fill(NaN), 48000, 8); buffer.render(output); assert.ok(output.every(v => v === 0));
  for (let i = 9; i < 30; i++) buffer.push(new Float32Array(1000).fill(.2), 48000, i);
  assert.ok(buffer.write - buffer.read < 4096); buffer.reset(); buffer.render(output); assert.ok(output.every(v => v === 0));
});
