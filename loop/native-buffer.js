// Bounded streaming resampler. Captured WASAPI packets and Web Audio may use
// different rates; never grow a queue indefinitely if the UI is interrupted.
export class NativeBuffer {
  constructor(outputRate, capacity = 32768) {
    this.outputRate = outputRate; this.data = new Float32Array(capacity);
    this.read = 0; this.write = 0; this.rate = outputRate; this.running = false;
  }
  reset() { this.read = 0; this.write = 0; this.running = false; }
  push(samples, rate, sequence) {
    if (!Number.isFinite(rate) || rate < 8000 || rate > 192000) return;
    if (rate !== this.rate || (this.sequence !== undefined && sequence !== this.sequence + 1)) this.reset();
    this.sequence = sequence; this.rate = rate;
    if (samples.length > this.data.length / 2) { this.reset(); return; }
    if (this.write - this.read + samples.length >= this.data.length) this.reset();
    for (const value of samples) this.data[this.write++ % this.data.length] = Number.isFinite(value) ? value : 0;
  }
  render(output) {
    output.fill(0);
    if (!this.running && this.write - this.read >= this.rate * .02) this.running = true;
    if (!this.running) return;
    const step = this.rate / this.outputRate;
    for (let i = 0; i < output.length; i++) {
      if (this.read + 1 >= this.write) { this.running = false; break; }
      const floor = Math.floor(this.read), fraction = this.read - floor;
      output[i] = this.data[floor % this.data.length] * (1 - fraction) + this.data[(floor + 1) % this.data.length] * fraction;
      this.read += step;
    }
    // Keep counters numerically stable during long sessions.
    if (this.read > this.data.length * 8) {
      const offset = Math.floor(this.read / this.data.length) * this.data.length;
      this.read -= offset; this.write -= offset;
    }
  }
}
