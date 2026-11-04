namespace SeisDesktop;

// A bounded queue for live monitoring only. Dry recording never uses this queue.
// After scheduling stalls prefer recent sound over an ever-growing live delay.
internal sealed class MonitorQueue
{
    readonly object gate = new(); readonly float[] data; readonly double step;
    readonly int target, ceiling; double read; long write; bool running;
    public long Underruns { get; private set; }
    public long Discarded { get; private set; }
    public double QueuedMs { get { lock (gate) return (write - read) * 1000 / InputRate; } }
    public int InputRate { get; }
    public MonitorQueue(int inputRate, int outputRate, double targetMs)
    {
        InputRate = inputRate; step = (double)inputRate / outputRate;
        target = Math.Max(2, (int)Math.Ceiling(inputRate * targetMs / 1000));
        ceiling = Math.Max(target * 3, inputRate / 20); data = new float[Math.Max(inputRate / 2, ceiling * 2)];
    }
    public void Push(ReadOnlySpan<float> samples)
    {
        lock (gate) {
            if (samples.Length >= data.Length) { Discarded += samples.Length - target; samples = samples[^target..]; read = write; running = false; }
            if (write - read + samples.Length > ceiling) {
                long next = Math.Max((long)Math.Ceiling(read), write - target);
                Discarded += next - (long)Math.Ceiling(read); read = next;
            }
            foreach (float n in samples) data[write++ % data.Length] = float.IsFinite(n) ? n : 0;
        }
    }
    public void Read(Span<float> output)
    {
        lock (gate) {
            output.Clear();
            if (!running) { if (write - read < target) return; running = true; }
            // Compensate the small clock drift of separate capture/render devices.
            double correctedStep = step * (1 + Math.Clamp((write - read - target) / InputRate * .01, -.001, .001));
            for (int i = 0; i < output.Length; i++) {
                if (read + 1 >= write) { running = false; Underruns++; break; }
                long at = (long)Math.Floor(read); double f = read - at;
                output[i] = (float)(data[at % data.Length] * (1 - f) + data[(at + 1) % data.Length] * f); read += correctedStep;
            }
            if (read > data.Length * 8L) { long offset = (long)(read / data.Length) * data.Length; read -= offset; write -= offset; }
        }
    }
}
