using System.Diagnostics;
using System.Reflection;
using System.Text;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace SeisDesktop;
internal sealed class StudioWindow : Form
{
    const string Origin = "https://seis.desktop.invalid";
    readonly WebView2 view = new() { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(17, 21, 20) };
    readonly AudioBackend audio;
    readonly System.Windows.Forms.Timer timer = new() { Interval = 1000 };
    readonly Dictionary<string, byte[]> resources = new(StringComparer.Ordinal);
    readonly string? smokeReport;
    bool ready, closing, closingAllowed, checking; int queued;
    public StudioWindow(string? smokeReport = null)
    {
        this.smokeReport = smokeReport;
        Text = $"SEIS {Program.Version} · Loop Studio"; Width = 1440; Height = 1000; MinimumSize = new Size(780, 640);
        StartPosition = FormStartPosition.CenterScreen; WindowState = FormWindowState.Maximized; BackColor = Color.FromArgb(17, 21, 20);
        Icon = Icon.ExtractAssociatedIcon(Environment.ProcessPath!);
        Controls.Add(view); audio = new AudioBackend(Send);
        foreach (var name in Assembly.GetExecutingAssembly().GetManifestResourceNames().Where(name => name.StartsWith("web/"))) {
            using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name)!;
            using var buffer = new MemoryStream(); stream.CopyTo(buffer); resources[name[4..]] = buffer.ToArray();
        }
        Shown += async (_, _) => await InitializeAsync();
        timer.Tick += async (_, _) => { if (checking) return; checking = true; try { await audio.CheckProcessesAsync(); } finally { checking = false; } };
        FormClosing += OnClosing;
    }
    async Task InitializeAsync()
    {
        try {
            string dataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SEIS", "WebView2");
            var environment = await CoreWebView2Environment.CreateAsync(null, dataPath);
            await view.EnsureCoreWebView2Async(environment);
            var core = view.CoreWebView2;
            core.Settings.AreDevToolsEnabled = false; core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsPasswordAutosaveEnabled = false; core.Settings.IsGeneralAutofillEnabled = false;
            core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            core.WebResourceRequested += (_, e) => {
                var uri = new Uri(e.Request.Uri);
                string key = uri.AbsolutePath.StartsWith("/loop/") ? Uri.UnescapeDataString(uri.AbsolutePath[6..]) : "";
                if (key == "") key = "index.html";
                if (uri.GetLeftPart(UriPartial.Authority) != Origin || !resources.TryGetValue(key, out var bytes)) {
                    e.Response = core.Environment.CreateWebResourceResponse(new MemoryStream(), 404, "Not found", "Content-Type: text/plain"); return;
                }
                string mime = Path.GetExtension(key) switch { ".html" => "text/html", ".js" => "application/javascript", ".css" => "text/css", ".svg" => "image/svg+xml", ".json" => "application/json", _ => "application/octet-stream" };
                string headers = $"Content-Type: {mime}; charset=utf-8\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nContent-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'; frame-src 'none'; base-uri 'self'; form-action 'none'";
                e.Response = core.Environment.CreateWebResourceResponse(new MemoryStream(bytes, false), 200, "OK", headers);
            };
            core.NavigationStarting += (_, e) => {
                if (e.Uri.StartsWith(Origin + "/loop/", StringComparison.Ordinal)) return;
                e.Cancel = true; OpenWebsite(e.Uri);
            };
            core.NewWindowRequested += (_, e) => { e.Handled = true; OpenWebsite(e.Uri); };
            core.PermissionRequested += (_, e) => {
                e.State = e.Uri.StartsWith(Origin + "/", StringComparison.Ordinal) && e.PermissionKind == CoreWebView2PermissionKind.Microphone ? CoreWebView2PermissionState.Allow : CoreWebView2PermissionState.Deny;
                e.Handled = true;
            };
            // Only the embedded, network-isolated studio gets device permission.
            // This reveals device names; no capture starts until Connect is clicked.
            await core.Profile.SetPermissionStateAsync(CoreWebView2PermissionKind.Microphone, Origin, CoreWebView2PermissionState.Allow);
            await core.AddScriptToExecuteOnDocumentCreatedAsync("if(location.origin === '" + Origin + "') Object.defineProperty(window,'seisDesktop',{value:Object.freeze({version:'" + Program.Version + "',platform:'Windows x64'}),writable:false});");
            core.WebMessageReceived += async (_, e) => {
                if (!e.Source.StartsWith(Origin + "/loop/", StringComparison.Ordinal)) return;
                int id = 0;
                try {
                    if (e.WebMessageAsJson.Length > 8192) throw new InvalidOperationException("Mensaje demasiado grande.");
                    using var message = JsonDocument.Parse(e.WebMessageAsJson); var root = message.RootElement;
                    id = root.GetProperty("id").GetInt32(); string? action = root.GetProperty("action").GetString(); var args = root.GetProperty("args");
                    object? result = action switch {
                        "sources.list" => await ListSourcesAsync(),
                        "capture.start" => await audio.StartAsync(args.GetProperty("captureId").GetString()!, args.GetProperty("sourceId").GetString()!),
                        "capture.stop" => await StopAsync(args.GetProperty("captureId").GetString()!),
                        "monitor.configure" => await audio.ConfigureMonitorAsync(args),
                        "about.show" => ShowAbout(),
                        _ => throw new InvalidOperationException("Acción no permitida.")
                    };
                    Send(new { type = "reply", id, result });
                } catch (Exception error) { Send(new { type = "reply", id, error = error.Message }); }
            };
            core.DownloadStarting += (_, e) => {
                using var dialog = new SaveFileDialog { FileName = Path.GetFileName(e.ResultFilePath), Filter = "Archivos de SEIS y audio|*.seisloop;*.wav|Todos los archivos|*.*", OverwritePrompt = true };
                e.Handled = true;
                if (dialog.ShowDialog(this) == DialogResult.OK) e.ResultFilePath = dialog.FileName; else e.Cancel = true;
            };
            core.NavigationCompleted += async (_, _) => { view.Focus(); if (smokeReport != null) await SmokeTestAsync(); };
            ready = true; core.Navigate(Origin + "/loop/"); timer.Start();
        } catch (Exception error) {
            if (smokeReport != null) { File.WriteAllText(smokeReport, JsonSerializer.Serialize(new { error = error.ToString() })); closingAllowed = true; Close(); return; }
            bool missingRuntime = error is WebView2RuntimeNotFoundException;
            var recovery = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, Padding = new Padding(32), AutoScroll = true, ForeColor = Color.White };
            recovery.Controls.Add(new Label { AutoSize = true, MaximumSize = new Size(680, 0), Font = new Font("Segoe UI", 14), Text = missingRuntime ? "Falta Microsoft Edge WebView2 Runtime para abrir SEIS." : "No se pudo iniciar SEIS. Podés usar la versión web mientras revisás el problema." });
            recovery.Controls.Add(new Label { AutoSize = true, MaximumSize = new Size(680, 0), Text = missingRuntime ? "Abrí la descarga oficial de Microsoft, instalá WebView2 y volvé a abrir SEIS. No hace falta instalar .NET. Tus archivos guardados se conservan." : error.Message });
            if (missingRuntime) {
                var runtimeButton = new Button { AutoSize = true, Text = "Abrir descarga oficial de WebView2", Padding = new Padding(8), BackColor = Color.FromArgb(45, 57, 44), ForeColor = Color.White, UseVisualStyleBackColor = false };
                runtimeButton.Click += (_, _) => OpenWebsite("https://developer.microsoft.com/microsoft-edge/webview2/"); recovery.Controls.Add(runtimeButton);
            }
            var webButton = new Button { AutoSize = true, Text = "Usar SEIS en el navegador", Padding = new Padding(8), BackColor = Color.FromArgb(45, 57, 44), ForeColor = Color.White, UseVisualStyleBackColor = false };
            webButton.Click += (_, _) => OpenWebsite("https://emanuelmkt.com.ar/loop/"); recovery.Controls.Add(webButton);
            Controls.Add(recovery); recovery.BringToFront();
        }
    }
    async Task SmokeTestAsync()
    {
        try {
            for (int i = 0; i < 60; i++) {
                string value = await view.CoreWebView2.ExecuteScriptAsync("JSON.stringify({openPanels:document.querySelectorAll('.track:not(.is-collapsed)').length,knobs:document.querySelectorAll('.rotary').length,modeControls:document.querySelectorAll('.mode-switch button').length,diagnosticReady:!!document.querySelector('#audio-test-input'),mode:document.body.dataset.mode,version:window.seisDesktop?.version,tracks:document.querySelectorAll('.track').length,nativeOptions:document.querySelectorAll('#source-0 option[value^=\"native:\"]').length,outputOptions:document.querySelectorAll('#output-device option').length,applyButtons:document.querySelectorAll('.input-apply').length,latencyButtons:document.querySelectorAll('.latency-button').length,deskVisible:[...document.querySelectorAll('.track,.transport')].every(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&e.scrollHeight<=e.clientHeight+1}),offline:location.origin==='https://seis.desktop.invalid',downloadHidden:document.querySelector('#desktop-download')?.hidden})");
                string json = JsonSerializer.Deserialize<string>(value) ?? "{}";
                using var report = JsonDocument.Parse(json);
                if (report.RootElement.GetProperty("tracks").GetInt32() == 6 && report.RootElement.GetProperty("nativeOptions").GetInt32() > 0) {
                    if (report.RootElement.GetProperty("openPanels").GetInt32() != 1 || report.RootElement.GetProperty("knobs").GetInt32() != 13 || !report.RootElement.GetProperty("deskVisible").GetBoolean() || report.RootElement.GetProperty("latencyButtons").GetInt32() != 6 || report.RootElement.GetProperty("modeControls").GetInt32() != 2 || !report.RootElement.GetProperty("diagnosticReady").GetBoolean()) throw new Exception("La vista compacta no muestra todos los controles.");
                    // No recording or playback: only load the embedded audio
                    // modules, which must work without any network connection.
                    string worklet = await view.CoreWebView2.ExecuteScriptAsync("(async()=>{try{const c=new AudioContext();await c.audioWorklet.addModule('./processor.js?v=1.8.0');await c.audioWorklet.addModule('./native-processor.js?v=1.8.0');await c.audioWorklet.addModule('./latency-processor.js?v=1.8.0');await c.close();document.documentElement.dataset.workletTest='ok'}catch(e){document.documentElement.dataset.workletTest=e.message}})();'started'");
                    for (int attempt = 0; attempt < 40; attempt++) {
                        string state = await view.CoreWebView2.ExecuteScriptAsync("document.documentElement.dataset.workletTest || ''");
                        if (state == "\"ok\"") { File.WriteAllText(smokeReport!, json); return; }
                        if (state != "\"\"") throw new Exception("Worklet: " + state);
                        await Task.Delay(100);
                    }
                    throw new Exception("El AudioWorklet no terminó de cargar.");
                }
                await Task.Delay(250);
            }
            throw new Exception("La interfaz o las fuentes nativas no terminaron de cargar.");
        } catch (Exception error) { File.WriteAllText(smokeReport!, JsonSerializer.Serialize(new { error = error.ToString() })); }
        finally { timer.Stop(); closingAllowed = true; Close(); }
    }
    async Task<object> ListSourcesAsync()
    {
        await audio.DetectCapabilitiesAsync();
        return new { sources = audio.Sources(), outputs = audio.Outputs(), version = Program.Version, capabilities = new { nativeMonitor = true, processCapture = audio.ProcessCaptureSupported, windowsBuild = Environment.OSVersion.Version.Build } };
    }
    async Task<object> StopAsync(string id) { await audio.StopAsync(id); return new { stopped = true }; }
    object ShowAbout()
    {
        var text = new StringBuilder($"SEIS {Program.Version} · Windows x64\r\nAudio y sesiones procesados localmente.\r\n\r\nCOMPONENTES Y LICENCIAS\r\n");
        foreach (string name in Assembly.GetExecutingAssembly().GetManifestResourceNames().Where(name => name.StartsWith("notices/"))) {
            using var reader = new StreamReader(Assembly.GetExecutingAssembly().GetManifestResourceStream(name)!);
            text.AppendLine("\r\n" + name[8..] + "\r\n").AppendLine(reader.ReadToEnd());
        }
        var dialog = new Form { Text = $"SEIS {Program.Version} · Versión y licencias", Width = 820, Height = 650, StartPosition = FormStartPosition.CenterParent, MinimizeBox = false, MaximizeBox = false };
        dialog.Controls.Add(new TextBox { Text = text.ToString(), Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Dock = DockStyle.Fill, BackColor = Color.FromArgb(25, 31, 26), ForeColor = Color.White, Font = new Font("Segoe UI", 10) });
        dialog.Show(this); return new { version = Program.Version };
    }
    static void OpenWebsite(string url)
    {
        if (Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == "https" &&
            ((uri.Host == "emanuelmkt.com.ar" && uri.AbsolutePath.StartsWith("/loop")) ||
             (uri.Host == "developer.microsoft.com" && uri.AbsolutePath == "/microsoft-edge/webview2/")))
            Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
    }
    void Send(object data)
    {
        if (!ready || IsDisposed || closingAllowed) return;
        string json = JsonSerializer.Serialize(data);
        if (Interlocked.Increment(ref queued) > 64 && json.StartsWith("{\"type\":\"pcm\"", StringComparison.Ordinal)) { Interlocked.Decrement(ref queued); return; }
        try {
            BeginInvoke(() => {
                try { if (!IsDisposed && !closingAllowed) view.CoreWebView2.PostWebMessageAsJson(json); }
                finally { Interlocked.Decrement(ref queued); }
            });
        } catch (InvalidOperationException) { Interlocked.Decrement(ref queued); }
    }
    async void OnClosing(object? sender, FormClosingEventArgs e)
    {
        if (closingAllowed) return;
        e.Cancel = true; if (closing) return; closing = true;
        try {
            bool unsaved = ready;
            try { unsaved = ready && await view.CoreWebView2.ExecuteScriptAsync("Boolean(window.seisHasUnsavedChanges?.())") == "true"; } catch { /* Ask before closing if the renderer stopped responding. */ }
            if (unsaved && MessageBox.Show(this, "Hay cambios sin guardar. ¿Cerrar SEIS y descartar solo lo que está abierto? Los archivos guardados se conservan.", "SEIS · Sesión sin guardar", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
            timer.Stop(); await audio.DisposeAsync(); closingAllowed = true; Close();
        } finally { closing = false; }
    }
}
