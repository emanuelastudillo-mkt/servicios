// Cumulative normalized difference (YIN family), with parabolic refinement.
// Single notes only; silence, weak periodicity and out-of-range tones yield null.
export function detectPitch(input, rate) {
  const stride = Math.max(1, Math.floor(rate / 12000)), fs = rate / stride;
  const n = Math.min(2048, Math.floor(input.length / stride)), half = Math.floor(n / 2);
  if (half < fs / 45 + 2) return null;
  const samples = new Float64Array(n); let mean = 0, power = 0;
  for (let i = 0; i < n; i++) { samples[i] = input[i * stride]; mean += samples[i]; }
  mean /= n;
  for (let i = 0; i < n; i++) { samples[i] -= mean; power += samples[i] ** 2; }
  if (Math.sqrt(power / n) < .005) return null;
  const min = Math.floor(fs / 1200), max = Math.min(half - 1, Math.ceil(fs / 45)), diff = new Float64Array(max + 1);
  let total = 0;
  for (let lag = 1; lag <= max; lag++) {
    let sum = 0;
    for (let i = 0; i < half; i++) { const d = samples[i] - samples[i + lag]; sum += d * d; }
    total += sum; diff[lag] = total ? sum * lag / total : 1;
  }
  for (let lag = min; lag < max - 1; lag++) {
    if (diff[lag] > .12) continue;
    while (lag < max - 1 && diff[lag + 1] < diff[lag]) lag++;
    const a = diff[lag - 1], b = diff[lag], c = diff[lag + 1], denominator = 2 * (2 * b - c - a);
    const refined = lag + (denominator ? (c - a) / denominator : 0), hz = fs / refined;
    if (!Number.isFinite(hz) || hz < 45 || hz > 1200) return null;
    const note = Math.round(69 + 12 * Math.log2(hz / 440)), cents = 1200 * Math.log2(hz / (440 * 2 ** ((note - 69) / 12)));
    return { hz, note, cents, name: ['Do','Do♯','Re','Re♯','Mi','Fa','Fa♯','Sol','Sol♯','La','La♯','Si'][note % 12] + (Math.floor(note / 12) - 1), confidence: 1 - b };
  }
  return null;
}
