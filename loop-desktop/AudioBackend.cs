using System.Buffers.Binary;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using NAudio.CoreAudioApi;
using NAudio.Wave;

namespace SeisDesktop;
internal sealed record AudioSource(string id, string label, string group);
internal sealed class AudioBackend : IAsyncDisposable
{
    // Capability, not an OS-version guess: some Windows 10 installations can
    // activate process loopback below the minimum build in Microsoft's sample.
    public bool? ProcessCaptureSupported { get; private set; }
    Task? capabilityProbe;
    public Task DetectCapabilitiesAsync() => capabilityProbe ??= ProbeProcessCaptureAsync();
    static async Task<WasapiRecorder> OpenProbeAsync() => await new WasapiRecorderBuilder()
        .WithProcessLoopback((uint)Environment.ProcessId, ProcessLoopbackMode.IncludeTargetProcessTree)
        .WithFormat(WaveFormat.CreateIeeeFloatWaveFormat(48000, 2)).BuildAsync();
    static async Task DisposeLateProbeAsync(Task<WasapiRecorder> pending)
    {
        try { await using var recorder = await pending; } catch { /* No capture was started. */ }
    }
    async Task ProbeProcessCaptureAsync()
    {
        try {
            var pending = OpenProbeAsync();
            if (await Task.WhenAny(pending, Task.Delay(3000)) != pending) { _ = DisposeLateProbeAsync(pending); return; }
            // Activation only, targeting SEIS itself. No recording, microphone,
            // other application's samples, tone or device settings are used.
            await using var recorder = await pending;
            ProcessCaptureSupported = true;
        } catch (Exception error) {
            if (error is PlatformNotSupportedException or NotSupportedException ||
                error.HResult == unchecked((int)0x80004001) || error.HResult == unchecked((int)0x80004002) || error.HResult == unchecked((int)0x80070032)) ProcessCaptureSupported = false;
            // A temporary device failure is unknown, not proof of incompatibility.
        }
    }
    sealed class Capture
    {
        public required WasapiRecorder Recorder; public MMDevice? Device;
        public int ProcessId; public long ProcessStart; public int Sequence; public bool Stopping; public int Channel = -1; public bool Physical;
    }
    readonly ConcurrentDictionary<string, Capture> captures = new();
    readonly Action<object> send;
    readonly SemaphoreSlim monitorGate = new(1, 1);
    NativeMonitor? monitor;
    public AudioBackend(Action<object> send) { this.send = send; }

    public AudioSource[] Sources()
    {
        using var enumerator = new MMDeviceEnumerator();
        var result = new List<AudioSource>(); var processIds = new HashSet<int>();
        foreach (var input in enumerator.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active)) {
            using (input) {
                try {
                    using var client = input.CreateAudioClient();
                    int channels = Math.Min(client.MixFormat.Channels, 8);
                    for (int channel = 0; channel < channels; channel++) result.Add(new($"in:{channel}:{input.ID}", $"{input.FriendlyName} · Canal {channel + 1}", "Instrumentos · escucha nativa"));
                } catch (COMException) { /* Disconnected endpoint. */ }
            }
        }
        var processes = ProcessCatalog.Snapshot();
        foreach (var device in enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active))
        {
            using (device) {
                result.Add(new("out:" + device.ID, "Audio de salida · " + device.FriendlyName, "Salidas para grabar (loopback)"));
                try {
                    var sessions = device.AudioSessionManager.Sessions;
                    for (int i = 0; i < sessions.Count; i++) { using var session = sessions[i]; int pid = (int)session.GetProcessID; if (pid > 0) processIds.Add(ProcessCatalog.AppRoot(pid, processes)); }
                } catch (COMException) { /* A removed endpoint must not hide other sources. */ }
            }
        }
        if (ProcessCaptureSupported == false) return result.OrderBy(source => source.label, StringComparer.CurrentCultureIgnoreCase).ToArray();
        foreach (var process in Process.GetProcesses()) using (process) {
            try { if (process.MainWindowHandle != IntPtr.Zero) processIds.Add(process.Id); } catch { /* Protected/exited process. */ }
        }
        foreach (var id in processIds.Order())
        {
            if (ProcessCatalog.IsOurTree(id, processes)) continue;
            try {
                using var process = Process.GetProcessById(id);
                string title = string.IsNullOrWhiteSpace(process.MainWindowTitle) ? "" : " · " + process.MainWindowTitle;
                string label = process.ProcessName + title;
                result.Add(new($"app:{id}:{process.StartTime.ToUniversalTime().Ticks}", label[..Math.Min(label.Length, 170)] + $" (PID {id})", "Aplicaciones de Windows"));
            } catch { /* It exited or is protected. */ }
        }
        return result.OrderBy(source => source.group).ThenBy(source => source.label, StringComparer.CurrentCultureIgnoreCase).ToArray();
    }

    public async Task<object> StartAsync(string id, string sourceId)
    {
        if (sourceId.StartsWith("app:", StringComparison.Ordinal) && ProcessCaptureSupported == false)
            throw new InvalidOperationException("Windows no admite la captura por aplicación en este entorno. Usá una entrada física, virtual o el audio completo de una salida.");
        if (!Guid.TryParse(id, out _) || captures.Count >= 6 || captures.ContainsKey(id)) throw new InvalidOperationException("Límite de entradas o identificador inválido.");
        // Re-enumerate: a saved PID is not permission to capture a different,
        // newly-created process that reused that number.
        var source = Sources().FirstOrDefault(item => item.id == sourceId) ?? throw new InvalidOperationException("La fuente ya no está disponible. Actualizá la lista y elegila de nuevo.");
        MMDevice? device = null; WasapiRecorder? recorder = null;
        try {
            var builder = new WasapiRecorderBuilder().WithBufferLength(20).WithMmcssThreadPriority();
            int processId = 0; long processStart = 0;
            int channel = -1; bool physical = sourceId.StartsWith("in:", StringComparison.Ordinal);
            if (physical) {
                int separator = sourceId.IndexOf(':', 3); channel = int.Parse(sourceId[3..separator]);
                using var enumerator = new MMDeviceEnumerator(); device = enumerator.GetDevice(sourceId[(separator + 1)..]);
                builder.WithDevice(device).WithBufferLength(10).WithLowLatency().WithRawMode(); recorder = builder.Build();
                if (channel < 0 || channel >= recorder.WaveFormat.Channels) throw new InvalidOperationException("El canal de entrada ya no está disponible.");
            } else if (sourceId.StartsWith("out:", StringComparison.Ordinal)) {
                using var enumerator = new MMDeviceEnumerator(); device = enumerator.GetDevice(sourceId[4..]);
                builder.WithDevice(device).WithLoopbackCapture();
                recorder = builder.Build();
            } else if (sourceId.StartsWith("app:", StringComparison.Ordinal)) {
                var parts = sourceId.Split(':'); processId = int.Parse(parts[1]); processStart = long.Parse(parts[2]);
                builder.WithProcessLoopback((uint)processId, ProcessLoopbackMode.IncludeTargetProcessTree).WithFormat(WaveFormat.CreateIeeeFloatWaveFormat(48000, 2));
                recorder = await builder.BuildAsync();
            } else throw new InvalidOperationException("Fuente de audio inválida.");
            var capture = new Capture { Recorder = recorder, Device = device, ProcessId = processId, ProcessStart = processStart, Channel = channel, Physical = physical };
            if (!captures.TryAdd(id, capture)) throw new InvalidOperationException("La entrada ya está conectada.");
            recorder.DataAvailable += (buffer, flags, position, time) => {
                if (capture.Stopping) return;
                var samples = ToMono(buffer, capture.Recorder.WaveFormat, capture.Channel);
                var live = Volatile.Read(ref monitor); if (live?.CaptureId == id) live.Push(samples);
                send(new { type = "pcm", captureId = id, rate = capture.Recorder.WaveFormat.SampleRate, sequence = Interlocked.Increment(ref capture.Sequence), samples = Convert.ToBase64String(MemoryMarshal.AsBytes(samples.AsSpan())) });
            };
            recorder.RecordingStopped += (_, args) => { if (!capture.Stopping) _ = StopAsync(id, args.Exception?.Message ?? "La entrada se detuvo."); };
            recorder.StartRecording();
            return new { label = source.label, rate = recorder.WaveFormat.SampleRate, physical, inputPeriodMs = recorder.LatencyMilliseconds, lowLatency = recorder.LowLatencyActive };
        } catch (Exception error) {
            captures.TryRemove(id, out _);
            if (recorder != null) await recorder.DisposeAsync(); device?.Dispose();
            if (sourceId.StartsWith("app:")) throw new InvalidOperationException("Windows no pudo iniciar la captura de esa aplicación. La captura por proceso requiere una versión compatible de Windows; probá una salida loopback. ASIO y el modo exclusivo pueden no ser capturables. Detalle: " + error.Message, error);
            throw new InvalidOperationException("No se pudo abrir esa salida para grabar. Revisá el dispositivo o su uso en modo exclusivo. " + error.Message, error);
        }
    }

    internal static float[] ToMono(ReadOnlySpan<byte> bytes, WaveFormat format, int selectedChannel = -1)
    {
        bool floating = format.Encoding == WaveFormatEncoding.IeeeFloat || format is WaveFormatExtensible extended && extended.SubFormat == new Guid("00000003-0000-0010-8000-00aa00389b71");
        return PcmSamples.Mono(bytes, format.Channels, format.BitsPerSample, format.BlockAlign, floating, selectedChannel);
    }

    public async Task StopAsync(string id, string? reason = null)
    {
        if (!captures.TryRemove(id, out var capture)) return;
        capture.Stopping = true;
        await StopMonitorAsync(id);
        try { await capture.Recorder.DisposeAsync(); } catch (Exception error) { reason ??= error.Message; } finally { capture.Device?.Dispose(); }
        send(new { type = "ended", captureId = id, reason });
    }
    public async Task CheckProcessesAsync()
    {
        var live = Volatile.Read(ref monitor); if (live != null) send(new { type = "monitor.status", status = live.Status() });
        foreach (var pair in captures) if (pair.Value.ProcessId != 0) {
            bool ended;
            try { using var process = Process.GetProcessById(pair.Value.ProcessId); ended = process.HasExited || process.StartTime.ToUniversalTime().Ticks != pair.Value.ProcessStart; } catch { ended = true; }
            if (ended) await StopAsync(pair.Key, "La aplicación se cerró.");
        }
    }
    public object[] Outputs()
    {
        using var enumerator = new MMDeviceEnumerator(); var result = new List<object>();
        foreach (var device in enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active)) using (device) result.Add(new { id = device.ID, label = device.FriendlyName });
        return result.ToArray();
    }
    public async Task<object> ConfigureMonitorAsync(JsonElement args)
    {
        await monitorGate.WaitAsync();
        try {
            if (!args.GetProperty("active").GetBoolean()) { await DisposeMonitorAsync(); return new { active = false }; }
            string id = args.GetProperty("captureId").GetString()!, output = args.GetProperty("outputId").GetString()!;
            if (!captures.TryGetValue(id, out var capture) || !capture.Physical || capture.Stopping) throw new ArgumentException("La escucha rápida necesita una entrada de Instrumentos · escucha nativa conectada.");
            if (output.Length > 2048) throw new ArgumentException("Salida inválida.");
            double gain = args.GetProperty("gain").GetDouble(), master = args.GetProperty("master").GetDouble();
            if (!double.IsFinite(gain) || gain < 0 || gain > 2 || !double.IsFinite(master) || master < 0 || master > 1.5) throw new ArgumentException("Nivel de escucha inválido.");
            bool muted = args.GetProperty("muted").GetBoolean(); var fx = MonitorFx.Parse(args.GetProperty("effects"));
            int reset = args.GetProperty("reset").GetInt32();
            if (monitor?.CaptureId == id && monitor.OutputId == output) monitor.Configure(fx, gain, master, muted, reset);
            else {
                await DisposeMonitorAsync();
                var next = new NativeMonitor(id, output, capture.Recorder.WaveFormat.SampleRate, capture.Recorder.LatencyMilliseconds, capture.Recorder.LowLatencyActive, fx, gain, master, muted,
                    error => send(new { type = "monitor.error", captureId = id, error }));
                next.Configure(fx, gain, master, muted, reset);
                Volatile.Write(ref monitor, next);
                try { next.Start(); } catch { await DisposeMonitorAsync(); throw; }
            }
            return monitor!.Status();
        } catch { await DisposeMonitorAsync(); throw; }
        finally { monitorGate.Release(); }
    }
    async Task DisposeMonitorAsync() { var old = Interlocked.Exchange(ref monitor, null); if (old != null) await old.DisposeAsync(); }
    async Task StopMonitorAsync(string id)
    {
        await monitorGate.WaitAsync();
        try { if (monitor?.CaptureId == id) await DisposeMonitorAsync(); }
        finally { monitorGate.Release(); }
    }
    public async ValueTask DisposeAsync() { foreach (var id in captures.Keys) await StopAsync(id); await monitorGate.WaitAsync(); try { await DisposeMonitorAsync(); } finally { monitorGate.Release(); } }

    public static async Task<object> SelfTestAsync()
    {
        using var enumerator = new MMDeviceEnumerator();
        await using var backend = new AudioBackend(_ => {});
        await backend.DetectCapabilitiesAsync();
        var sources = backend.Sources();
        bool processActivation = false; string? processError = null; int capturedFrames = 0; float peak = 0;
        try {
            await using var recorder = await new WasapiRecorderBuilder().WithProcessLoopback((uint)Environment.ProcessId, ProcessLoopbackMode.IncludeTargetProcessTree).WithFormat(WaveFormat.CreateIeeeFloatWaveFormat(48000, 2)).BuildAsync();
            recorder.DataAvailable += (buffer, flags, position, time) => {
                var samples = ToMono(buffer, recorder.WaveFormat); Interlocked.Add(ref capturedFrames, samples.Length);
                foreach (float sample in samples) peak = Math.Max(peak, Math.Abs(sample));
            };
            recorder.StartRecording(); processActivation = true;
            // -80 dBFS diagnostic tone, confined to this process. No microphone or
            // other application's samples are stored by the self-test.
            using var player = new WasapiPlayerBuilder().WithLatency(40).Build(); player.Init(new ProbeTone());
            player.Play(); await Task.Delay(750); player.Stop(); await Task.Delay(100); recorder.StopRecording();
        } catch (Exception error) { processError = error.ToString(); }
        var bytes = new byte[16]; float[] stereo = [.2f, .6f, -.4f, -.8f]; MemoryMarshal.AsBytes(stereo.AsSpan()).CopyTo(bytes);
        var mono = ToMono(bytes, WaveFormat.CreateIeeeFloatWaveFormat(48000, 2));
        bool conversion = Math.Abs(mono[0] - .4f) < .0001 && Math.Abs(mono[1] + .6f) < .0001;
        if (!conversion) throw new Exception("La conversión PCM falló.");
        return new { version = Program.Version, windows = Environment.OSVersion.Version.ToString(), processCapability = backend.ProcessCaptureSupported, sources, processActivation, processError, capturedFrames, peak, processSignal = peak > .000001f, conversion };
    }
    sealed class ProbeTone : IWaveProvider
    {
        long frame;
        public WaveFormat WaveFormat { get; } = WaveFormat.CreateIeeeFloatWaveFormat(48000, 2);
        public int Read(Span<byte> buffer)
        {
            int bytes = buffer.Length / 8 * 8;
            for (int i = 0; i < bytes; i += 8) {
                float sample = .0001f * (float)Math.Sin(2 * Math.PI * 997 * frame++ / 48000);
                BinaryPrimitives.WriteSingleLittleEndian(buffer.Slice(i, 4), sample);
                BinaryPrimitives.WriteSingleLittleEndian(buffer.Slice(i + 4, 4), sample);
            }
            return bytes;
        }
    }
}
