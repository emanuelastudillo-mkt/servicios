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
  let testContext, noAudio = false, lastCapture;
  const createSignal = async (level = .15) => {
    testContext ||= new AudioContext(); await testContext.resume();
    const oscillator = testContext.createConstantSource(); oscillator.offset.value = level;
    const destination = testContext.createMediaStreamDestination();
    oscillator.connect(destination); oscillator.start();
    return destination.stream;
  };
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async options => createSignal(options.audio.deviceId?.exact === 'qa-focusrite' ? .35 : .15) });
  Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', { configurable: true, value: async () => {
    lastCapture = noAudio ? new MediaStream() : await createSignal(.55); return lastCapture;
  }});
  Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { configurable: true, value: async () => [
    { kind: 'audioinput', deviceId: 'qa-microphone', label: 'Micrófono · señal de prueba' },
    { kind: 'audioinput', deviceId: 'qa-focusrite', label: 'Focusrite · señal de prueba' }
  ] });
  window.addEventListener('pagehide', () => testContext?.close());
  await import('../app.js?v=1.2.0');
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
      track(0).querySelector('.input-connect').click(); await wait(() => track(0).classList.contains('input-connected'));
      change(track(1).querySelector('.source-select'), 'device:qa-focusrite'); track(1).querySelector('.input-connect').click();
      await wait(() => track(1).classList.contains('input-connected'));
      change(track(2).querySelector('.source-select'), 'window'); track(2).querySelector('.input-connect').click();
      await wait(() => track(2).classList.contains('input-connected'));
      assert($('#inputs-status').textContent.startsWith('3 / 6'), 'Tres fuentes conectadas en pistas diferentes');
      change(track(1).querySelector('.input-gain'), '50', 'input');
      assert(track(1).querySelector('.input-value').textContent === '50%', 'Ganancia de entrada independiente');
      track(0).querySelector('.input-listen input').click(); track(1).querySelector('.input-listen input').click();
      assert(!track(0).querySelector('.input-listen input').checked && track(1).querySelector('.input-listen input').checked, 'Solo una fuente en escucha directa');
      track(0).querySelector('.input-connect').focus(); space();
      await wait(() => !track(0).querySelector('.countdown').hidden);
      assert(track(0).querySelector('.countdown strong').textContent === '3', 'Espacio inicia Loop 1 con tres segundos');
      space(); assert(!track(0).querySelector('.countdown').hidden, 'Espacio conserva la preparación');
      await wait(() => track(0).classList.contains('is-recording'));
      await wait(() => Number($('#decimals').textContent) >= .5);
      space(); await wait(() => track(0).classList.contains('has-audio'));
      assert(!track(1).querySelector('.input-listen input').checked, 'Grabar otra fuente desactiva la escucha anterior');
      track(0).querySelector('.clear-button').focus(); space();
      await wait(() => track(1).classList.contains('has-audio'));
      assert(track(0).classList.contains('has-audio'), 'Espacio con foco en Borrar conserva Loop 1 y graba Loop 2');
      track(2).querySelector('.record-button').click(); await wait(() => track(2).classList.contains('has-audio'));
      $('#stop').click();
      // Capture the real app's downloaded session without writing a fixture file.
      const originalCreate = URL.createObjectURL, originalClick = HTMLAnchorElement.prototype.click;
      let savedBlob;
      URL.createObjectURL = blob => { savedBlob = blob; return originalCreate(blob); };
      HTMLAnchorElement.prototype.click = function () {};
      try { $('#save').click(); await wait(() => savedBlob); } finally { URL.createObjectURL = originalCreate; HTMLAnchorElement.prototype.click = originalClick; }
      const { decodeSession } = await import('../files.js?v=1.2.0');
      const binary = await savedBlob.arrayBuffer(), saved = decodeSession(binary);
      const expected = [.15, .175, .55];
      assert(saved.tracks.slice(0, 3).every((t, i) => Math.abs(t.samples[Math.floor(t.samples.length / 2)] - expected[i]) < .002), 'La sesión descargada contiene micrófono, placa al 50% y aplicación sin mezclarlos');
      assert(saved.tracks[1].input.deviceId === 'qa-focusrite' && saved.tracks[1].input.gain === .5 && saved.tracks[2].input.kind === 'window', 'Guardar conserva fuentes y niveles');
      lastCapture.getAudioTracks()[0].stop(); lastCapture.getAudioTracks()[0].dispatchEvent(new Event('ended'));
      await wait(() => !track(2).classList.contains('input-connected'));
      assert(track(2).classList.contains('has-audio'), 'Terminar una captura conserva el loop grabado');
      noAudio = true; track(3).querySelector('.source-select').value = 'tab'; track(3).querySelector('.source-select').dispatchEvent(new Event('change'));
      track(3).querySelector('.input-connect').click(); await wait(() => $('#notification').textContent.includes('no comparte audio'));
      assert(!track(3).classList.contains('input-connected'), 'Rechaza una captura sin audio con un mensaje útil');
      const file = new File([binary], 'prueba.seisloop'), transfer = new DataTransfer(); transfer.items.add(file);
      $('#file').files = transfer.files; $('#file').dispatchEvent(new Event('change'));
      await wait(() => $('#confirm').open); $('#confirm button[value=ok]').click();
      await wait(() => $('#notification').textContent.startsWith('Sesión abierta'));
      assert($('#inputs-status').textContent.startsWith('0 / 6') && track(1).querySelector('.source-select').value === 'device:qa-focusrite' && track(1).querySelector('.input-gain').value === '50', 'Abrir restaura asignaciones y ganancia, sin capturar sin permiso');
      assert(document.querySelectorAll('.has-audio').length === 3, 'Abrir conserva las tres tomas');
      track(1).querySelector('.input-connect').click(); await wait(() => track(1).classList.contains('input-connected'));
      track(1).querySelector('.input-mute').click(); track(1).querySelector('.input-apply').click();
      await wait(() => $('#inputs-status').textContent.startsWith('6 / 6'));
      assert([...document.querySelectorAll('.source-select')].every(select => select.value === 'device:qa-focusrite'), 'Aplicar a todas asigna la misma fuente y comparte una conexión');
      assert([...document.querySelectorAll('.input-gain')].every(gain => gain.value === '50') && [...document.querySelectorAll('.input-mute')].every(button => button.getAttribute('aria-pressed') === 'true'), 'Aplicar a todas copia ganancia y silencio de entrada');
      assert(document.querySelectorAll('.has-audio').length === 3 && [...document.querySelectorAll('.volume')].every(gain => gain.value === '80'), 'Aplicar a todas conserva tomas y volúmenes de reproducción');
      $('#disconnect-inputs').click();
      results.textContent += '\nRESULTADO: ' + checks + ' comprobaciones correctas.';
    } catch (e) { results.textContent += 'ERROR: ' + (e.stack || e.message); }
    finally { run.disabled = false; }
  };
};
