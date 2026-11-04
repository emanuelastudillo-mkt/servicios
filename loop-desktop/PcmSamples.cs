using System.Buffers.Binary;

namespace SeisDesktop;
internal static class PcmSamples
{
    public static float[] Mono(ReadOnlySpan<byte> bytes, int channels, int bits, int blockAlign, bool floating, int selectedChannel = -1)
    {
        int size = bits / 8;
        if (channels < 1 || size < 1 || blockAlign < channels * size || selectedChannel < -1 || selectedChannel >= channels) throw new ArgumentException("Formato o canal de entrada inválido.");
        var output = new float[bytes.Length / blockAlign];
        for (int frame = 0; frame < output.Length; frame++) {
            double sum = 0;
            for (int channel = 0; channel < channels; channel++) {
                if (selectedChannel >= 0 && channel != selectedChannel) continue;
                var sample = bytes.Slice(frame * blockAlign + channel * size, size);
                double value = floating && size == 4 ? BinaryPrimitives.ReadSingleLittleEndian(sample) :
                    floating && size == 8 ? BinaryPrimitives.ReadDoubleLittleEndian(sample) :
                    size == 2 ? BinaryPrimitives.ReadInt16LittleEndian(sample) / 32768.0 :
                    size == 3 ? ((sample[0] | sample[1] << 8 | sample[2] << 16) << 8 >> 8) / 8388608.0 :
                    size == 4 ? BinaryPrimitives.ReadInt32LittleEndian(sample) / 2147483648.0 :
                    size == 1 ? (sample[0] - 128) / 128.0 : 0;
                if (double.IsFinite(value)) sum += value;
            }
            output[frame] = (float)Math.Clamp(sum / (selectedChannel < 0 ? channels : 1), -16, 16);
        }
        return output;
    }
}
