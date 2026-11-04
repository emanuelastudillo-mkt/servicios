using System.Buffers.Binary;
using NAudio.CoreAudioApi;
using NAudio.Wave;

namespace SeisDesktop;

internal sealed class NativeMonitor : IAsyncDisposable
{
    readonly MMDevice device; readonly WasapiPlayer player; readonly Provider provider;
    readonly string outputName; readonly double outputPeriod; readonly bool lowLatency;
    public string CaptureId { get; }
    public string OutputId { get; }
    public double CapturePeriodMs { get; }
    public bool CaptureLowLatency { get; }
    public NativeMonitor(string captureId, string outputId, int rate, double capturePeriod, bool captureLowLatency, MonitorFx effects, double gain, double master, bool muted, Action<string> failed)
    {
        CaptureId = captureId; OutputId = outputId; CapturePeriodMs = capturePeriod; CaptureLowLatency = captureLowLatency;
        using var enumerator = new MMDeviceEnumerator();
        device = outputId.Length == 0 ? enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia) : enumerator.GetDevice(outputId);
        if (device.DataFlow != DataFlow.Render || device.State != DeviceState.Active) { device.Dispose(); throw new ArgumentException("La salida de escucha no está disponible."); }
        WasapiPlayer? created = null;
        try {
            using var client = device.CreateAudioClient(); var mix = client.MixFormat;
            created = new WasapiPlayerBuilder().WithDevice(device).WithLatency(10).WithLowLatency().WithRawMode().WithMmcssThreadPriority().Build();
            // Match the render device's sample rate to preserve IAudioClient3 mode.
            provider = new Provider(rate, mix.SampleRate, mix.Channels, Math.Max(2, capturePeriod), effects, gain, master, muted);
            created.Init(provider); player = created;
            provider.SetTarget(Math.Max(capturePeriod, player.LatencyMilliseconds) + 1);
            outputName = device.FriendlyName; outputPeriod = player.LatencyMilliseconds; lowLatency = captureLowLatency && player.LowLatencyActive;
            player.PlaybackStopped += (_, e) => { if (e.Exception != null) failed("Se detuvo la escucha nativa: " + e.Exception.Message); };
        } catch { created?.Dispose(); device.Dispose(); throw; }
    }
    public void Start() => player.Play();
    public void Push(ReadOnlySpan<float> samples) => provider.Push(samples);
    public void Configure(MonitorFx effects, double gain, double master, bool muted, int reset) => provider.Configure(effects, gain, master, muted, reset);
    public object Status() => new {
        active = true, captureId = CaptureId, output = outputName, inputPeriodMs = CapturePeriodMs,
        outputPeriodMs = outputPeriod, lowLatency,
        queueMs = provider.Queue.QueuedMs, underruns = provider.Queue.Underruns, discarded = provider.Queue.Discarded,
        note = "Períodos y cola del motor; no es una medición del retardo total de la placa ni de los efectos."
    };
    public async ValueTask DisposeAsync() { provider.Silence(); try { await player.DisposeAsync(); } finally { device.Dispose(); } }

    sealed class Provider : IWaveProvider
    {
        public WaveFormat WaveFormat { get; }
        public MonitorQueue Queue { get; private set; }
        MonitorEffects effects; readonly object dspGate = new(); readonly float[] block = new float[2048]; readonly double smoothing;
        int reset;
        double gain, master, level; bool muted, stopped;
        public Provider(int inputRate, int outputRate, int channels, double targetMs, MonitorFx config, double gain, double master, bool muted)
        {
            WaveFormat = WaveFormat.CreateIeeeFloatWaveFormat(outputRate, channels); Queue = new(inputRate, outputRate, targetMs);
            effects = new(outputRate, config); this.gain = gain; this.master = master; this.muted = muted;
            smoothing = 1 - Math.Exp(-1 / (outputRate * .005));
        }
        public void Push(ReadOnlySpan<float> samples) => Queue.Push(samples);
        public void SetTarget(double ms) => Queue = new(Queue.InputRate, WaveFormat.SampleRate, ms);
        public void Configure(MonitorFx config, double gain, double master, bool muted, int reset) { lock (dspGate) { if (reset != this.reset) { effects = new(WaveFormat.SampleRate, config); this.reset = reset; } else effects.Set(config); this.gain = gain; this.master = master; this.muted = muted; } }
        public void Silence() { lock (dspGate) { stopped = true; level = 0; } }
        public int Read(byte[] buffer, int offset, int count) => Read(buffer.AsSpan(offset, count));
        public int Read(Span<byte> bytes)
        {
            int frameSize = WaveFormat.BlockAlign, total = bytes.Length / frameSize; bytes.Clear();
            for (int at = 0; at < total; at += block.Length) {
                int count = Math.Min(block.Length, total - at); Queue.Read(block.AsSpan(0, count));
                lock (dspGate) {
                    if (stopped) continue;
                    for (int i = 0; i < count; i++) {
                        // Ramp monitor gain changes; never let tuning leave a tail audible.
                        level += (master - level) * smoothing;
                        double processed = effects.Process(block[i] * gain);
                        float sample = muted ? 0 : (float)Math.Clamp(processed * level, -1, 1);
                        if (!float.IsFinite(sample)) sample = 0;
                        for (int channel = 0; channel < WaveFormat.Channels; channel++) BinaryPrimitives.WriteSingleLittleEndian(bytes.Slice((at + i) * frameSize + channel * 4, 4), sample);
                    }
                }
            }
            return total * frameSize;
        }
    }
}
