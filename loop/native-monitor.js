// Serialize control changes, never PCM. Coalesce rapid knob moves and ensure an
// in-flight start is followed by stop when the user disconnects or switches.
export class NativeMonitorControl {
  constructor(request, onStatus, onError) {
    Object.assign(this, { request, onStatus, onError });
    this.desired = '{"active":false}'; this.sent = this.desired; this.running = false;
  }
  set(value) { this.desired = JSON.stringify(value); return this.flush(); }
  async flush() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.sent !== this.desired) {
        const next = this.desired; this.sent = next;
        try {
          const status = await this.request('monitor.configure', JSON.parse(next));
          if (next === this.desired) this.onStatus(status);
        } catch (error) {
          if (next === this.desired) { this.desired = '{"active":false}'; this.onError(error); }
        }
      }
    } finally { this.running = false; }
  }
}

export function nativeMonitorDescription(status) {
  if (!status?.active) return 'Elegí una entrada de «Instrumentos · escucha nativa», su canal y la salida de la placa. Luego activá Escuchar con efectos.';
  const ms = value => Number.isFinite(value) ? value.toFixed(1) : '?';
  return `Escucha nativa ${status.lowLatency ? '· período mínimo' : '· modo compatible'} · ${status.output}. Búfer entrada ${ms(status.inputPeriodMs)} ms / salida ${ms(status.outputPeriodMs)} ms · cola ${ms(status.queueMs)} ms. Estos valores no miden el retardo total. Cortes: ${status.underruns || 0}.`;
}

export function matchingOutput(devices, label) {
  if (!label?.trim()) return null;
  const matches = devices.filter(d => d.label?.trim() === label.trim());
  return matches.length === 1 ? matches[0] : null;
}
