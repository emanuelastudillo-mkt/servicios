using System.Text.Json;

namespace SeisDesktop;

// The live native monitor follows effects.js. Recording and export keep the dry
// signal and the original Web Audio chain. Cross-engine fixtures guard parity.
internal sealed record MonitorPedal(string Type, bool Enabled, Dictionary<string, double> Params);
internal sealed record MonitorFx(bool Bypass, MonitorPedal[] Pedals)
{
    static readonly Dictionary<string, Dictionary<string, double[]>> Limits = LoadLimits();
    static Dictionary<string, Dictionary<string, double[]>> LoadLimits()
    {
        using var stream = typeof(MonitorFx).Assembly.GetManifestResourceStream("monitor-effects.json")!;
        return JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, double[]>>>(stream)!;
    }
    public static MonitorFx Parse(JsonElement value)
    {
        bool bypass = value.GetProperty("bypass").GetBoolean();
        var list = new List<MonitorPedal>(); var seen = new HashSet<string>();
        foreach (var pedal in value.GetProperty("pedals").EnumerateArray()) {
            string type = pedal.GetProperty("type").GetString()!;
            if (!Limits.TryGetValue(type, out var limits) || !seen.Add(type)) throw new ArgumentException("Pedal inválido o repetido.");
            var values = new Dictionary<string, double>(); var parameters = pedal.GetProperty("params");
            foreach (var (key, range) in limits) {
                double n = parameters.GetProperty(key).GetDouble();
                if (!double.IsFinite(n) || n < range[0] || n > range[1]) throw new ArgumentException("Parámetro fuera de rango.");
                values[key] = n;
            }
            list.Add(new(type, pedal.GetProperty("enabled").GetBoolean(), values));
        }
        return new(bypass, list.ToArray());
    }
}

internal sealed class MonitorEffects
{
    readonly double rate, smooth; Unit[] units = []; bool bypass; double blend;
    public MonitorEffects(int rate, MonitorFx config) { this.rate = rate; smooth = 1 - Math.Exp(-1 / (rate * .012)); Set(config); blend = bypass ? 0 : 1; }
    public void Set(MonitorFx config)
    {
        var next = new Unit[config.Pedals.Length];
        for (int i = 0; i < next.Length; i++) {
            var p = config.Pedals[i]; var old = Array.Find(units, u => u.Type == p.Type);
            if (old != null) { old.Set(p); next[i] = old; } else next[i] = new Unit(rate, p);
        }
        units = next; bypass = config.Bypass;
    }
    public double Process(double input)
    {
        if (units.Length == 0) return input;
        double x = input; foreach (var unit in units) x = unit.Run(x);
        blend += ((bypass ? 0 : 1) - blend) * smooth;
        return input + (x - input) * blend;
    }
    static double Db(double x) => Math.Pow(10, x / 20);
    sealed class Line(double size)
    {
        readonly float[] data = new float[(int)Math.Ceiling(size) + 4]; int at;
        public double Read(double delay) {
            double pos = at - Math.Clamp(delay, 1, data.Length - 2); if (pos < 0) pos += data.Length;
            int a = (int)Math.Floor(pos); double f = pos - a;
            return data[a] * (1 - f) + data[(a + 1) % data.Length] * f;
        }
        public void Push(double x) { data[at] = (float)x; if (++at == data.Length) at = 0; }
    }
    sealed class Comb(int size) { public readonly int Size = size; public readonly Line Line = new(size); public double Low, Feedback; }
    sealed class Unit
    {
        public readonly string Type; readonly double rate, smooth;
        Dictionary<string, double> p = []; bool enabled;
        double blend, phase, envelope, gate, low, last, dc, previous, gain = 1, time, w1, w2, a;
        double attack, release, threshold, makeup, targetGain, tone, b0, a1, a2;
        int tick; readonly double[] z = new double[6]; readonly Line? line; readonly Comb[]? combs, diffusers;
        double P(string key, double fallback = 0) => p.GetValueOrDefault(key, fallback);
        double Or(string key, double fallback) { double n = P(key); return n == 0 ? fallback : n; }
        public Unit(double rate, MonitorPedal config) {
            this.rate = rate; Type = config.Type; blend = config.Enabled ? 1 : 0; smooth = 1 - Math.Exp(-1 / (.012 * rate));
            if (Type is "chorus" or "flanger" or "vibrato" or "delay" or "pitch") line = new(rate * (Type == "delay" ? 1.51 : .15));
            if (Type == "reverb") {
                combs = new[] { .0297, .0371, .0411, .0437 }.Select(s => new Comb((int)Math.Floor(rate * s + .5))).ToArray();
                diffusers = new[] { .005, .0017 }.Select(s => new Comb((int)Math.Floor(rate * s + .5))).ToArray();
            }
            Set(config); gain = targetGain; time = Or("time", 20) * rate / 1000;
        }
        public void Set(MonitorPedal config) {
            enabled = config.Enabled; p = config.Params;
            attack = 1 - Math.Exp(-1 / (rate * Or("attack", 2) / 1000));
            release = 1 - Math.Exp(-1 / (rate * Or("release", 120) / 1000));
            threshold = Db(Or("threshold", -48)); makeup = Db(P("makeup"));
            targetGain = Type == "boost" ? Db(P("gain")) : p.ContainsKey("level") ? P("level") / 100 : 1;
            tone = 1 - Math.Exp(-2 * Math.PI * Math.Min(rate * .2, 600 + P("tone") * 65) / (rate * 2));
            if (combs != null) foreach (var c in combs) c.Feedback = Math.Pow(10, -3 * c.Size / (rate * P("decay")));
        }
        public double Run(double x) {
            blend += ((enabled ? 1 : 0) - blend) * smooth;
            if (!enabled && blend < 1e-7) return x;
            double y = x;
            switch (Type) {
                case "gate": {
                    double abs = Math.Abs(x); envelope += (abs - envelope) * (abs > envelope ? attack : release);
                    double target = envelope > threshold * (gate > .5 ? .65 : 1) ? 1 : 0;
                    gate += (target - gate) * (target > gate ? attack : release); y = x * gate; break;
                }
                case "compressor": {
                    double abs = Math.Abs(x); envelope += (abs - envelope) * (abs > envelope ? attack : release);
                    double over = Math.Max(0, 20 * Math.Log10(Math.Max(1e-9, envelope)) - P("threshold"));
                    double target = Db(-over * (1 - 1 / P("ratio"))); gain += (target - gain) * (target < gain ? attack : release);
                    y = x * gain * makeup; break;
                }
                case "boost": case "volume": gain += (targetGain - gain) * smooth; y = x * gain; break;
                case "overdrive": case "distortion": case "fuzz": {
                    double drive = 1 + P("drive") * (Type == "overdrive" ? .16 : Type == "distortion" ? .45 : .8);
                    for (int s = 0; s < 2; s++) {
                        double v = (s == 1 ? x : (previous + x) * .5) * drive;
                        double shaped = Type == "overdrive" ? Math.Tanh(v) : Type == "distortion" ? Math.Clamp(v, -1, 1) : Math.Sign(v) * (1 - Math.Exp(-Math.Abs(v)));
                        low += (shaped - low) * tone;
                    }
                    previous = x; y = low - last + .995 * dc; last = low; dc = y;
                    gain += (targetGain - gain) * smooth; y *= gain; break;
                }
                case "chorus": case "flanger": case "vibrato": {
                    double lfo = Math.Sin(phase * Math.PI * 2), depth = P("depth") / 100;
                    double seconds = Type == "chorus" ? .018 + lfo * .008 * depth : Type == "flanger" ? .0025 + lfo * .0022 * depth : .008 + lfo * .003 * depth;
                    double wet = line!.Read(seconds * rate); line.Push(Math.Clamp(x + wet * P("feedback") / 100, -16, 16));
                    y = Type == "vibrato" ? wet : x * (1 - P("mix") / 100) + wet * P("mix") / 100;
                    phase = (phase + P("rate") / rate) % 1; break;
                }
                case "phaser": {
                    if ((tick++ & 31) == 0) { double f = Math.Min(rate * .2, 350 * Math.Pow(2, (1 + Math.Sin(phase * 2 * Math.PI)) * P("depth") / 100 * 2.5)); double t = Math.Tan(Math.PI * f / rate); a = (1 - t) / (1 + t); }
                    double wet = x; for (int j = 0; j < 6; j++) { double v = -a * wet + z[j]; z[j] = wet + a * v; wet = v; }
                    y = x * (1 - P("mix") / 100) + wet * P("mix") / 100; phase = (phase + P("rate") / rate) % 1; break;
                }
                case "tremolo": y = x * (1 - P("depth") / 200 * (1 - Math.Sin(phase * 2 * Math.PI))); phase = (phase + P("rate") / rate) % 1; break;
                case "delay": {
                    time += (P("time") * rate / 1000 - time) * smooth; double wet = line!.Read(time);
                    line.Push(Math.Clamp(x + wet * P("feedback") / 100, -16, 16)); y = x * (1 - P("mix") / 100) + wet * P("mix") / 100; break;
                }
                case "reverb": {
                    double wet = 0;
                    foreach (var c in combs!) { double v = c.Line.Read(c.Size); c.Low += (v - c.Low) * (1 - P("damping") / 100); c.Line.Push(Math.Clamp(x * .25 + c.Low * c.Feedback, -16, 16)); wet += v * .5; }
                    foreach (var d in diffusers!) { double v = d.Line.Read(d.Size), result = v - .5 * wet; d.Line.Push(wet + .5 * result); wet = result; }
                    y = x * (1 - P("mix") / 100) + wet * P("mix") / 100; break;
                }
                case "wah": {
                    gain += (P("position") / 100 - gain) * smooth;
                    if ((tick++ & 31) == 0) { double omega = 2 * Math.PI * Math.Min(rate * .2, 300 * Math.Pow(8, gain)) / rate; double alpha = Math.Sin(omega) / (2 * P("resonance")), norm = 1 / (1 + alpha); b0 = alpha * norm; a1 = -2 * Math.Cos(omega) * norm; a2 = (1 - alpha) * norm; }
                    double wet = b0 * x + w1; w1 = -a1 * wet + w2; w2 = -b0 * x - a2 * wet;
                    y = x * (1 - P("mix") / 100) + wet * 1.6 * P("mix") / 100; break;
                }
                case "pitch": {
                    double semitones = P("semitones"), ratio = Math.Pow(2, semitones / 12), window = rate * .06;
                    if (semitones == 0) { line!.Push(x); break; }
                    double pa = phase, pb = (pa + .5) % 1, weight = .5 - .5 * Math.Cos(pa * 2 * Math.PI);
                    double wet = line!.Read(4 + pa * window) * weight + line.Read(4 + pb * window) * (1 - weight);
                    line.Push(x); phase = (phase + (1 - ratio) / window + 1) % 1; y = x * (1 - P("mix") / 100) + wet * P("mix") / 100; break;
                }
            }
            return Math.Clamp(x + (y - x) * blend, -16, 16);
        }
    }
}
