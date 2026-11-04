import { LoopEngine } from './audio-core.js?v=1.8.0';

class SeisProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.elapsed = 0;
    this.inputTrack = 0;
    this.engine = new LoopEngine(sampleRate, message => {
      this.port.postMessage(message);
      this.port.postMessage({ type: 'status', data: this.engine.state() });
    });
    this.port.onmessage = ({ data }) => {
      try {
        if (data.type === 'settings' && Number.isInteger(data.inputTrack) && data.inputTrack >= 0 && data.inputTrack < 6) this.inputTrack = data.inputTrack;
        if (data.type === 'snapshot') {
          const snapshot = this.engine.snapshot();
          this.port.postMessage({ type: 'snapshot', requestId: data.requestId, data: snapshot },
            snapshot.tracks.filter(t => t.samples).map(t => t.samples.buffer));
        } else this.engine.command(data);
      } catch (error) { this.port.postMessage({ type: 'error', requestId: data.requestId, message: error.message }); }
    };
    this.port.postMessage({ type: 'status', data: this.engine.state() });
  }
  process(inputs, outputs) {
    const output = outputs[0][0];
    this.engine.process(inputs[this.engine.recording?.id ?? this.inputTrack]?.[0], output);
    this.elapsed += output.length;
    if (this.elapsed >= sampleRate / 24) {
      this.elapsed = 0;
      this.port.postMessage({ type: 'status', data: this.engine.state() });
      this.engine.inputPeak = 0;
      this.engine.outputPeak = 0;
    }
    return true;
  }
}
registerProcessor('seis-looper', SeisProcessor);
