using System.Reflection;
using System.Text.Json;

namespace SeisDesktop;
internal static class Program
{
    public static string Version => Assembly.GetExecutingAssembly().GetName().Version!.ToString(3);
    [STAThread]
    static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        if (args.Length == 2 && args[0] == "--self-test")
        {
            try { File.WriteAllText(args[1], JsonSerializer.Serialize(AudioBackend.SelfTestAsync().GetAwaiter().GetResult(), new JsonSerializerOptions { WriteIndented = true })); }
            catch (Exception error) { File.WriteAllText(args[1], JsonSerializer.Serialize(new { error = error.ToString() })); Environment.ExitCode = 1; }
            return;
        }
        Application.Run(new StudioWindow(args.Length == 2 && args[0] == "--smoke-test" ? args[1] : null));
    }
}
