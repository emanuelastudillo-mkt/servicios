import { NativeBuffer } from './native-buffer.js?v=1.8.0';
class NativeInput extends AudioWorkletProcessor {
  constructor() {
    super(); this.buffer = new NativeBuffer(sampleRate);
    this.port.onmessage = ({ data }) => {
      if (data.type === 'stop') this.buffer.reset();
      else if (data.samples instanceof Float32Array) this.buffer.push(data.samples, data.rate, data.sequence);
    };
  }
  process(inputs, outputs) { this.buffer.render(outputs[0][0]); return true; }
}
registerProcessor('seis-native-input', NativeInput);
