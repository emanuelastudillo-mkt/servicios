import { LatencyProbe } from './latency.js?v=1.6.0';
class LatencyProcessor extends AudioWorkletProcessor {
  constructor() {
    super(); this.probe = null;
    this.port.onmessage = ({ data }) => { this.probe = data.type === 'start' ? new LatencyProbe(sampleRate) : null; };
  }
  process(inputs, outputs) {
    const output = outputs[0][0];
    if (!this.probe) { output.fill(0); return true; }
    if (this.probe.process(inputs[0]?.[0], output)) {
      const samples = this.probe.samples; this.probe = null;
      this.port.postMessage({ samples }, [samples.buffer]);
    }
    return true;
  }
}
registerProcessor('seis-latency-probe', LatencyProcessor);
