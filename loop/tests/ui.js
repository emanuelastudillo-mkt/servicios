// Dedicated test page only. Production app.js never imports this fixture.
document.querySelector('#prepare').onclick = async () => {
  const html = await (await fetch('../index.html')).text();
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.body.replaceChildren(...parsed.body.childNodes);
  const base = document.createElement('base'); base.href = '/loop/'; document.head.prepend(base);
  const note = document.createElement('div');
  note.textContent = 'PRUEBA CON SEÑAL SINTÉTICA · No se usa el micrófono · Salida en cero';
  note.style.cssText = 'padding:10px;text-align:center;background:#34422c;color:#d7f5c3;font-size:12px';
  document.body.prepend(note);
  document.querySelector('#master').value = 0;
  document.querySelector('#master-value').textContent = '0%';
  localStorage.setItem('seis.interface-mode', 'simple');
  let testContext, noAudio = false, lastCapture, denyNext = false, captureRequests = 0, captureGate;
  let appContext;
  const NativeAudioContext = window.AudioContext;
  window.AudioContext = class extends NativeAudioContext {
    constructor(options) { super(options); if (options?.latencyHint === 'interactive') appContext = this; }
  };
  const createSignal = async (level = .15) => {
    testContext ||= new AudioContext(); await testContext.resume();
    const oscillator = testContext.createConstantSource(); oscillator.offset.value = level;
    const destination = testContext.createMediaStreamDestination();
    oscillator.connect(destination); oscillator.start();
    return destination.stream;
  };
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async options => {
    captureRequests++;
    if (denyNext) { denyNext = false; throw new DOMException('Permiso de prueba denegado', 'NotAllowedError'); }
    if (captureGate) await captureGate;
    const stream = await createSignal(options.audio.deviceId?.exact === 'qa-focusrite' ? .35 : .15);
    const track = stream.getAudioTracks()[0], settings = track.getSettings();
    // A real hardware device keeps its ID across connections; the synthetic
    // MediaStreamDestination would otherwise invent a new WebAudio UUID.
    track.getSettings = () => ({ ...settings, deviceId: options.audio.deviceId?.exact || 'qa-microphone', latency: .01 });
    return stream;
  } });
  Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', { configurable: true, value: async () => {
    lastCapture = noAudio ? new MediaStream() : await createSignal(.55); return lastCapture;
  }});
  Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { configurable: true, value: async () => [
    { kind: 'audioinput', deviceId: 'qa-microphone', label: 'Micrófono · señal de prueba' },
    { kind: 'audioinput', deviceId: 'qa-focusrite', label: 'Focusrite · señal de prueba' }
  ] });
  window.addEventListener('pagehide', () => testContext?.close());
  await import('../app.js?v=1.6.0');
  const run = document.createElement('button'); run.textContent = 'Verificar fuentes y teclas'; note.append(document.createElement('br'), run);
  const results = document.createElement('pre'); results.id = 'ui-results'; results.style.whiteSpace = 'pre-wrap'; note.append(results);
  run.onclick = async () => {
    run.disabled = true; results.textContent = '';
    const $ = s => document.querySelector(s), track = i => document.querySelectorAll('.track')[i];
    let checks = 0;
    const assert = (condition, text) => { if (!condition) throw Error(text); checks++; results.textContent += 'OK · ' + text + '\n'; };
    const wait = (condition, timeout = 6000) => new Promise((resolve, reject) => {
      const start = performance.now(), timer = setInterval(() => {
        if (condition()) { clearInterval(timer); resolve(); }
        else if (performance.now() - start > timeout) { clearInterval(timer); reject(Error('Tiempo agotado: ' + condition)); }
      }, 30);
    });
    const change = (element, value, event = 'change') => { element.value = value; element.dispatchEvent(new Event(event, { bubbles: true })); };
    const space = () => { document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true })); document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true, cancelable: true })); };
    try {
      assert(document.body.dataset.mode === 'simple' && $('#mode-simple').getAttribute('aria-pressed') === 'true', 'Primer inicio en modo Simple');
      assert($('#tracks').dataset.openCount === '1' && !track(0).classList.contains('is-collapsed') && captureRequests === 0, 'Inicio progresivo: solo Loop 1 abierto, sin pedir micrófono');
      track(1).querySelector('.panel-expand').click();
      assert($('#tracks').dataset.openCount === '2', 'Un bloque vacío se puede abrir sin iniciar audio');
      $('#panels-open').click();
      assert($('#tracks').dataset.openCount === '6' && captureRequests === 0, 'Abrir los 6 permite configurar sin capturar');
      $('#panels-step').click();
      assert($('#tracks').dataset.openCount === '1' && document.querySelectorAll('.compact-stop:not([hidden])').length === 0, 'Paso a paso compacta las pistas vacías sin botones de borrado ni reproducción');
      $('#audio-review').click();
      assert($('#audio-dialog').open && $('#audio-test-input').disabled, 'Diagnóstico no captura entradas sin conectar');
      $('#audio-close').focus(); space();
      assert(!track(0).classList.contains('is-recording') && track(0).querySelector('.countdown').hidden, 'Espacio dentro de Revisar audio no graba ni borra');
      $('#audio-test-output').click(); await wait(() => $('#audio-result').textContent.includes('en cero'));
      assert($('#audio-result').dataset.ok === 'false', 'La prueba de salida respeta el volumen general en cero');
      // One percent master keeps the diagnostic tone below -69 dBFS.
      change($('#master'), '1', 'input'); $('#audio-test-output').click();
      await wait(() => $('#audio-result').textContent.startsWith('Tono enviado'));
      assert($('#audio-result').dataset.ok === 'true', 'Prueba de salida completa su tono con el motor real y libera los controles');
      $('#audio-test-output').click(); $('#audio-close').click();
      await wait(() => $('#audio-result').textContent.startsWith('Prueba cancelada'));
      assert(!$('#audio-dialog').open, 'Cerrar interrumpe la prueba de salida');
      change($('#master'), '0', 'input');
      $('#audio-close').click();
      $('#mode-advanced').click();
      assert(document.body.dataset.mode === 'advanced' && localStorage.getItem('seis.interface-mode') === 'advanced', 'Avanzado queda recordado sin iniciar captura');
      assert(getComputedStyle(track(0).querySelector('.latency-button')).display !== 'none', 'Avanzado muestra los controles de sincronización');
      denyNext = true; track(0).querySelector('.record-button').click();
      await wait(() => $('#notification').textContent.includes('permiso'));
      assert(!track(0).classList.contains('input-connected') && track(0).querySelector('.countdown').hidden && $('#tracks').dataset.openCount === '1', 'Permiso rechazado conserva el panel y no inicia ni avanza la grabación');
      change(track(2).querySelector('.source-select'), 'device:qa-focusrite');
      let allowCapture; captureGate = new Promise(resolve => { allowCapture = resolve; });
      track(2).querySelector('.record-button').click(); $('#panels-step').click();
      assert(!track(2).classList.contains('is-collapsed') && track(2).querySelector('.panel-collapse').disabled, 'Paso a paso conserva visible la pista que espera permiso');
      allowCapture(); captureGate = null; await wait(() => track(2).classList.contains('is-recording'));
      assert(!track(2).classList.contains('is-collapsed'), 'La toma que empieza después del permiso mantiene su panel abierto');
      $('#stop').click(); await wait(() => !track(2).classList.contains('is-recording')); $('#panels-step').click();
      track(0).querySelector('.record-button').click(); await wait(() => !track(0).querySelector('.countdown').hidden);
      assert(track(0).classList.contains('input-connected') && track(0).querySelector('.panel-collapse').disabled, 'Un solo Grabar conecta y empieza la cuenta; la toma activa sigue visible');
      $('#stop').click(); await wait(() => track(0).querySelector('.countdown').hidden);
      assert($('#tracks').dataset.openCount === '1' && !track(0).classList.contains('has-audio'), 'Cancelar la cuenta no avanza al siguiente panel');
      $('#audio-review').click(); $('#audio-test-input').click();
      await wait(() => $('#audio-result').textContent.startsWith('Señal recibida'));
      assert($('#audio-result').dataset.ok === 'true', 'Diagnóstico recibe señal real del grafo durante tres segundos');
      $('#audio-test-input').click(); $('#audio-close').click();
      await wait(() => $('#audio-result').textContent.startsWith('Prueba cancelada'));
      assert(track(0).classList.contains('input-connected'), 'Cancelar diagnóstico libera la prueba y conserva la entrada');
      $('#panels-open').click();
      change(track(1).querySelector('.source-select'), 'device:qa-focusrite'); track(1).querySelector('.input-connect').click();
      await wait(() => track(1).classList.contains('input-connected'));
      change(track(2).querySelector('.source-select'), 'window'); track(2).querySelector('.input-connect').click();
      await wait(() => track(2).classList.contains('input-connected'));
      assert($('#inputs-status').textContent.startsWith('3 / 6'), 'Tres fuentes conectadas en pistas diferentes');
      change(track(1).querySelector('.input-gain'), '50', 'input');
      assert(track(1).querySelector('.input-value').textContent === '50%', 'Ganancia de entrada independiente');
      track(1).querySelector('.latency-button').click();
      assert($('#latency-dialog').open && $('#latency-measure').disabled, 'Sincronizar abre el ajuste y no emite señales sin preparar el retorno');
      $('#latency-close').focus(); space();
      assert(!track(0).classList.contains('is-recording') && track(0).querySelector('.countdown').hidden, 'Espacio dentro del ajuste no inicia una grabación');
      change($('#latency-mode'), 'manual'); change($('#compensation'), '50'); $('#latency-apply').click();
      assert(!$('#latency-dialog').open && track(1).querySelector('.latency-button').textContent === '50.0 ms', 'Aplica 50 ms solo a la entrada elegida');
      track(0).querySelector('.input-listen input').click(); track(1).querySelector('.input-listen input').click();
      assert(!track(0).querySelector('.input-listen input').checked && track(1).querySelector('.input-listen input').checked, 'Solo una fuente en escucha directa');
      $('#panels-step').click();
      track(0).querySelector('.input-connect').focus(); space();
      await wait(() => !track(0).querySelector('.countdown').hidden);
      assert(track(0).querySelector('.countdown strong').textContent === '3', 'Espacio inicia Loop 1 con tres segundos');
      space(); assert(!track(0).querySelector('.countdown').hidden, 'Espacio conserva la preparación');
      await wait(() => track(0).classList.contains('is-recording'));
      await wait(() => Number($('#decimals').textContent) >= .5);
      space(); await wait(() => track(0).classList.contains('has-audio'));
      assert(track(0).classList.contains('is-collapsed') && !track(1).classList.contains('is-collapsed') && $('#tracks').dataset.openCount === '1', 'Terminar Loop 1 lo compacta y abre Loop 2 sin iniciar otra toma');
      track(0).querySelector('.compact-stop').click();
      await wait(() => track(0).classList.contains('is-muted'));
      assert(track(0).classList.contains('has-audio') && track(0).querySelector('.compact-stop').textContent === '▶', 'Detener el bloque conserva su audio y ofrece Reanudar');
      track(0).querySelector('.compact-stop').click();
      await wait(() => !track(0).classList.contains('is-muted'));
      assert(track(0).querySelector('.compact-stop').textContent === '■', 'Reanudar devuelve el loop al mismo ciclo');
      assert(!track(1).querySelector('.input-listen input').checked, 'Grabar otra fuente desactiva la escucha anterior');
      track(0).querySelector('.panel-expand').click();
      track(0).querySelector('.clear-button').focus(); space();
      await wait(() => track(1).classList.contains('is-recording'));
      await new Promise(resolve => setTimeout(resolve, 350));
      // On a busy renderer the short cycle can finish before this timer fires.
      // Space would then start Loop 3, whose explicit click below cancels it.
      if (track(1).classList.contains('is-recording')) space();
      await wait(() => track(1).classList.contains('has-audio'));
      assert(track(0).classList.contains('has-audio'), 'Espacio con foco en Borrar conserva Loop 1 y graba Loop 2');
      $('#panels-open').click();
      track(2).querySelector('.record-button').click(); await wait(() => track(2).classList.contains('has-audio'));
      assert($('#tracks').dataset.openCount === '6', 'Abrir los 6 conserva todos los paneles al finalizar una toma');
      $('#panels-step').click();
      assert($('#tracks').dataset.openCount === '1' && !track(3).classList.contains('is-collapsed'), 'Paso a paso retoma la primera pista vacía');
      $('#stop').click();
      // Capture the real app's downloaded session without writing a fixture file.
      const originalCreate = URL.createObjectURL, originalClick = HTMLAnchorElement.prototype.click;
      let savedBlob;
      URL.createObjectURL = blob => { savedBlob = blob; return originalCreate(blob); };
      HTMLAnchorElement.prototype.click = function () {};
      try { $('#save').click(); await wait(() => savedBlob); } finally { URL.createObjectURL = originalCreate; HTMLAnchorElement.prototype.click = originalClick; }
      const { decodeSession, encodeSession } = await import('../files.js?v=1.6.0');
      const binary = await savedBlob.arrayBuffer(), saved = decodeSession(binary);
      const expected = [.15, .175, .55];
      assert(saved.tracks.slice(0, 3).every((t, i) => Math.abs(t.samples[Math.floor(t.samples.length / 2)] - expected[i]) < .002), 'La sesión descargada contiene micrófono, placa al 50% y aplicación sin mezclarlos');
      assert(saved.tracks[1].input.deviceId === 'qa-focusrite' && saved.tracks[1].input.gain === .5 && saved.tracks[2].input.kind === 'window', 'Guardar conserva fuentes y niveles');
      assert(saved.tracks[1].input.latency.mode === 'manual' && saved.tracks[1].input.latency.ms === 50 && saved.tracks[1].input.latency.route, 'La sesión conserva la compensación y la ruta de audio');
      lastCapture.getAudioTracks()[0].stop(); lastCapture.getAudioTracks()[0].dispatchEvent(new Event('ended'));
      await wait(() => !track(2).classList.contains('input-connected'));
      assert(track(2).classList.contains('has-audio'), 'Terminar una captura conserva el loop grabado');
      noAudio = true; track(3).querySelector('.source-select').value = 'tab'; track(3).querySelector('.source-select').dispatchEvent(new Event('change'));
      track(3).querySelector('.input-connect').click(); await wait(() => $('#notification').textContent.includes('no comparte audio'));
      assert(!track(3).classList.contains('input-connected'), 'Rechaza una captura sin audio con un mensaje útil');
      // Restore a synthetic measured profile to exercise its edit/review UI.
      saved.tracks[1].input.latency.mode = 'measured';
      const restoredBinary = encodeSession(saved, saved.title, saved.tracks.map(t => t.name));
      const file = new File([restoredBinary], 'prueba.seisloop'), transfer = new DataTransfer(); transfer.items.add(file);
      $('#file').files = transfer.files; $('#file').dispatchEvent(new Event('change'));
      await wait(() => $('#confirm').open); $('#confirm button[value=ok]').click();
      await wait(() => $('#notification').textContent.startsWith('Sesión abierta'));
      assert($('#inputs-status').textContent.startsWith('0 / 6') && track(1).querySelector('.source-select').value === 'device:qa-focusrite' && track(1).querySelector('.input-gain').value === '50', 'Abrir restaura asignaciones y ganancia, sin capturar sin permiso');
      assert(document.querySelectorAll('.has-audio').length === 3, 'Abrir conserva las tres tomas');
      assert($('#tracks').dataset.openCount === '1' && !track(3).classList.contains('is-collapsed'), 'Sesión reabierta compacta las tomas y prepara la próxima vacía');
      track(1).querySelector('.panel-expand').click();
      track(1).querySelector('.input-connect').click(); await wait(() => track(1).classList.contains('input-connected'));
      track(1).querySelector('.latency-button').click();
      change($('#latency-mode'), 'manual'); change($('#compensation'), '91'); change($('#latency-mode'), 'measured');
      assert(Number($('#compensation').value) === 50, 'Volver al modo medido muestra el valor que realmente se aplicará');
      $('#latency-close').click();
      track(1).querySelector('.input-mute').click(); track(1).querySelector('.input-apply').click();
      await wait(() => $('#inputs-status').textContent.startsWith('6 / 6'));
      assert([...document.querySelectorAll('.source-select')].every(select => select.value === 'device:qa-focusrite'), 'Aplicar a todas asigna la misma fuente y comparte una conexión');
      assert([...document.querySelectorAll('.input-gain')].every(gain => gain.value === '50') && [...document.querySelectorAll('.input-mute')].every(button => button.getAttribute('aria-pressed') === 'true'), 'Aplicar a todas copia ganancia y silencio de entrada');
      assert(document.querySelectorAll('.has-audio').length === 3 && [...document.querySelectorAll('.volume')].every(gain => gain.value === '80'), 'Aplicar a todas conserva tomas y volúmenes de reproducción');
      assert([...document.querySelectorAll('.latency-button')].every(button => button.textContent === '50.0 ms'), 'Aplicar a todas comparte también la compensación de la misma ruta');
      track(1).querySelector('.solo').click();
      await wait(() => track(1).querySelector('.solo').getAttribute('aria-pressed') === 'true');
      $('#mode-simple').click();
      assert(document.querySelectorAll('.has-audio').length === 3 && [...document.querySelectorAll('.input-gain')].every(gain => gain.value === '50'), 'Volver a Simple conserva tomas y ganancias avanzadas');
      assert(getComputedStyle(track(1).querySelector('.input-gain')).display === 'none' && getComputedStyle(track(1).querySelector('.source-select')).display !== 'none', 'Simple oculta ajustes técnicos y conserva la selección de fuente');
      assert(track(1).querySelector('.simple-state').textContent.includes('Entrada silenciada') && track(1).querySelector('.simple-state').textContent.includes('Solo activo'), 'Simple hace visibles los ajustes activos que afectan la señal');
      track(1).querySelector('.input-advanced').click();
      assert(document.body.dataset.mode === 'advanced' && track(1).querySelector('.latency-button').textContent === '50.0 ms', 'Ajustes lleva a Avanzado conservando la compensación');
      await appContext.suspend(); $('#audio-review').click();
      await wait(() => !$('#audio-resume').hidden); $('#audio-resume').click();
      await wait(() => appContext.state === 'running' && $('#audio-result').textContent.startsWith('Motor reactivado'));
      assert(document.querySelectorAll('.has-audio').length === 3 && $('#inputs-status').textContent.startsWith('6 / 6'), 'Reactivar el motor suspendido conserva las tomas y conexiones');
      $('#audio-close').click();
      $('#panels-step').click();
      for (let id = 3; id < 6; id++) {
        track(id).querySelector('.input-mute').click();
        track(id).querySelector('.record-button').click();
        await wait(() => track(id).classList.contains('has-audio'));
      }
      assert($('#tracks').dataset.openCount === '0' && document.querySelectorAll('.has-audio').length === 6 && document.querySelectorAll('.compact-stop:not([hidden])').length === 6, 'Completar seis loops deja seis bloques compactos con su control de detener');
      $('#stop').click(); await wait(() => !track(0).classList.contains('is-playing'));
      $('#new').click(); await wait(() => $('#confirm').open); $('#confirm button[value=ok]').click();
      await wait(() => document.querySelectorAll('.has-audio').length === 0);
      assert($('#tracks').dataset.openCount === '1' && !track(0).classList.contains('is-collapsed'), 'Nueva sesión vuelve al primer panel sin conexiones');
      $('#disconnect-inputs').click();
      results.textContent += '\nRESULTADO: ' + checks + ' comprobaciones correctas.';
    } catch (e) { results.textContent += 'ERROR: ' + (e.stack || e.message); }
    finally { run.disabled = false; }
  };
};
