// Generate reference samples with the existing JS DSP, not a second test copy.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { EFFECTS, EFFECT_ORDER, pedal, EffectsChain } from '../loop/effects.js';
const out = resolve(process.argv[2]); await mkdir(out, { recursive: true });
const tests = [], bytes = [];
for (const rate of [44100,48000]) {
  for (const type of [...EFFECT_ORDER, 'all', 'empty']) for (const edge of [false,true]) {
    const pedals = type === 'all' ? EFFECT_ORDER.map(pedal) : type === 'empty' ? [] : [pedal(type)];
    if (edge) for (const item of pedals) for (const [key, p] of Object.entries(EFFECTS[item.type].params)) item.params[key] = p.max;
    const config = { bypass: false, pedals }, frames = rate, changes = [];
    if (edge) {
      const off = structuredClone(config); off.bypass = true; changes.push({ at: Math.floor(rate * .3), config: off });
      const on = structuredClone(config); on.pedals.reverse(); for (const item of on.pedals) { item.enabled = false; } changes.push({ at: Math.floor(rate * .5), config: on });
      changes.push({ at: Math.floor(rate * .7), config });
    }
    const input = new Float32Array(frames), expected = new Float32Array(frames), chain = new EffectsChain(rate, config);
    for (let i = 0; i < frames; i++) {
      input[i] = i < rate * .8 ? .21 * Math.sin(i * 2 * Math.PI * 220 / rate) + .035 * Math.sin(i * 2 * Math.PI * 1733 / rate) + (i === 0 ? .5 : 0) : 0;
      const change = changes.find(c => c.at === i); if (change) chain.set(change.config);
      expected[i] = chain.process(input[i]);
    }
    tests.push({ name: `${rate}/${type}/${edge ? 'limits-and-changes' : 'default'}`, rate, frames, config, changes }); bytes.push(Buffer.from(input.buffer), Buffer.from(expected.buffer));
  }
}
await writeFile(join(out,'fixtures.json'),JSON.stringify(tests)); await writeFile(join(out,'samples.bin'),Buffer.concat(bytes));
console.log(`${tests.length} DSP reference cases generated`);
