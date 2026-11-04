using System.Text.Json;
using System.Diagnostics;
using SeisDesktop;

// Pure math tests only: no Windows audio API, device capture, UI, or app launch.
using var cases = JsonDocument.Parse(File.ReadAllText(Path.Combine(args[0], "fixtures.json")));
using var samples = new BinaryReader(File.OpenRead(Path.Combine(args[0], "samples.bin")));
int count = 0; double maxError = 0; var clock = Stopwatch.StartNew();
void Check(bool pass, string name) { if (!pass) throw new Exception(name); count++; }
foreach (var item in cases.RootElement.EnumerateArray()) {
    int rate = item.GetProperty("rate").GetInt32(), frames = item.GetProperty("frames").GetInt32();
    var input = new float[frames]; var expected = new float[frames];
    for (int i = 0; i < frames; i++) input[i] = samples.ReadSingle();
    for (int i = 0; i < frames; i++) expected[i] = samples.ReadSingle();
    var fx = new MonitorEffects(rate, MonitorFx.Parse(item.GetProperty("config")));
    var changes = item.GetProperty("changes").EnumerateArray().ToDictionary(c => c.GetProperty("at").GetInt32(), c => MonitorFx.Parse(c.GetProperty("config")));
    double error = 0;
    for (int i = 0; i < frames; i++) {
        if (changes.TryGetValue(i, out var change)) fx.Set(change);
        double actual = fx.Process(input[i]); if (!double.IsFinite(actual)) throw new Exception("Non-finite output");
        error = Math.Max(error, Math.Abs(actual - expected[i]));
    }
    maxError = Math.Max(maxError, error); Check(error < .00002, $"DSP mismatch {item.GetProperty("name")}: {error}");
}
var queue = new MonitorQueue(48000, 48000, 3); var block = new float[128];
queue.Read(block); Check(block.All(n => n == 0), "empty queue must be silent");
queue.Push(Enumerable.Repeat(.25f, 480).ToArray()); queue.Read(block); Check(block.All(n => Math.Abs(n - .25f) < .00001), "initial native packet");
for (int i = 0; i < 20; i++) queue.Read(block);
Check(queue.Underruns > 0 && block.All(n => n == 0), "underflow must silence instead of replaying audio");
for (int i = 0; i < 100; i++) queue.Push(Enumerable.Repeat(.75f, 480).ToArray());
Check(queue.QueuedMs < 51 && queue.Discarded > 0, "bursts must not create growing monitor latency");
queue.Read(block); Check(block.All(n => Math.Abs(n - .75f) < .00001), "backlog must resume recent sound");
var resampled = new MonitorQueue(44100, 48000, 3); resampled.Push(Enumerable.Repeat(.3f, 4410).ToArray()); resampled.Read(block);
Check(block.All(n => Math.Abs(n - .3f) < .00001), "different device rates");
var invalid = new MonitorQueue(48000,48000,3); invalid.Push(Enumerable.Repeat(float.NaN,480).ToArray()); invalid.Read(block); Check(block.All(n => n == 0), "nonfinite samples");
foreach (string json in new[] { "{\"bypass\":false,\"pedals\":[{\"type\":\"unknown\"}]}", "{\"bypass\":false,\"pedals\":[{\"type\":\"boost\",\"enabled\":true,\"params\":{\"gain\":99}}]}" }) {
    bool rejected = false; try { using var value = JsonDocument.Parse(json); MonitorFx.Parse(value.RootElement); } catch { rejected = true; } Check(rejected, "invalid effect config");
}
var stereo = System.Runtime.InteropServices.MemoryMarshal.AsBytes(new float[] { .8f, -.4f, .3f, .9f }.AsSpan()).ToArray();
Check(PcmSamples.Mono(stereo,2,32,8,true,0).SequenceEqual(new[] { .8f,.3f }), "channel 1 must not be halved or include channel 2");
Check(PcmSamples.Mono(stereo,2,32,8,true,1).SequenceEqual(new[] { -.4f,.9f }), "channel 2 isolation");
Check(Math.Abs(PcmSamples.Mono(stereo,2,32,8,true)[0]-.2) < .00001, "application stereo still mixes to mono");
Check(PcmSamples.Mono(new byte[]{0,0,128,255,255,127},1,24,3,false).SequenceEqual(new[]{-1f,8388607f/8388608}), "24 bit signed PCM");
Console.WriteLine(JsonSerializer.Serialize(new { passed = count, maxDspError = maxError, elapsedSeconds = clock.Elapsed.TotalSeconds, physicalAudioTested = false }));
