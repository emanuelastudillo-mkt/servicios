import { encodeSession, decodeSession, resampleSession, encodeWav } from './files.js?v=1.5.0';
import { sealLoop } from './audio-core.js';
import { spaceAction } from './controls.js?v=1.5.0';

import { InputManager, inputConfig } from './inputs.js?v=1.5.0';
import { desktop, desktopRequest, captureNative } from './desktop.js?v=1.5.0';
import { latencyConfig, routeKey, resolveLatency, MAX_LATENCY_MS } from './latency.js?v=1.5.0';
import { calibrate } from './calibration.js?v=1.5.0';
import { readMode, writeMode, audioError, capabilities, signalResult } from './experience.js?v=1.5.0';
import { enhanceKnob, refreshKnobs } from './knobs.js?v=1.5.0';

const $ = selector => document.querySelector(selector);
const colors = ['#c7f69b', '#d8b5f8', '#93d8e9', '#efbd8c', '#f0a7ba', '#a6bafa'];
const names = Array.from({ length: 6 }, (_, i) => `Loop ${i + 1}`);
let waves = Array.from({ length: 6 }, () => []);
let ctx, node, initPromise, ioBusy = false, monitorId = -1;
let devices = [], nativeSources = [];
let latencyId = -1, measurementDraft = null, measurementAbort = null;
let nativeCapabilities = desktop, diagnosticCancel = null, diagnosticBusy = false;
let preferenceStorage;
try { preferenceStorage = window.localStorage; } catch { /* Blocked storage must not prevent recording. */ }
document.body.dataset.mode = readMode(preferenceStorage);
let dirty = false, revision = 0, requestId = 0, notificationTimer, drawAt = 0;
let state = { length: 0, position: 0, rate: 48000, playing: false, recording: null, canUndo: false,
  tracks: Array.from({ length: 6 }, () => ({ hasAudio: false, volume: .8, muted: false, solo: false })) };
const pending = new Map();
const cards = [];
const inputs = new InputManager({
  getGraph: async () => { await ensureAudio(); return { ctx, node }; },
  nativeCapture: desktop ? config => captureNative(config, async () => { await ensureAudio(); return { ctx, node }; }) : undefined,
  onChange: () => render(),
  onEnded: id => {
    if (id === latencyId) measurementAbort?.abort();
    if (monitorId === id) setMonitor(-1);
    send({ type: 'inputLost', id });
    notify('Se desconectó la entrada del Loop ' + (id + 1) + '. Volvé a conectarla para seguir grabando.', true);
  }
});

for (let i = 0; i < 6; i++) {
  const card = document.createElement('article');
  card.className = 'track';
  card.style.setProperty('--color', colors[i]);
  card.setAttribute('aria-label', `Pista ${i + 1}`);
  card.innerHTML = `<div class="track-head"><span class="track-number">0${i + 1}</span><input class="track-name" value="Loop ${i + 1}" maxlength="80" aria-label="Nombre de pista ${i + 1}"><span class="track-status">VACÍA</span></div><div class="wave-area"><canvas aria-label="Forma de onda de pista ${i + 1}"></canvas><span class="wave-placeholder"><kbd>${i + 1}</kbd> Tu próximo sonido</span><div class="playhead"></div></div><div class="track-actions"><button class="record-button" aria-label="Grabar pista ${i + 1}"><span class="record-dot" aria-hidden="true"></span><span class="record-label">Grabar</span></button><button class="toggle-button mute" aria-label="Silenciar pista ${i + 1}" aria-pressed="false" disabled>Silenciar</button><button class="toggle-button solo" aria-label="Solo pista ${i + 1}" aria-pressed="false" disabled>Solo</button><button class="clear-button" title="Borrar pista ${i + 1}" aria-label="Borrar pista ${i + 1}" disabled>×</button></div><div class="track-bottom"><span>VOL</span><input class="volume" type="range" min="0" max="150" value="80" aria-label="Volumen de pista ${i + 1}"><output>80%</output></div>`;
  card.insertAdjacentHTML('beforeend', `<div class="track-input">
    <div class="input-heading"><label for="source-${i}">ENTRADA DE GRABACIÓN</label><span class="input-led"></span></div>
    <select class="source-select" id="source-${i}" aria-label="Fuente de pista ${i + 1}"></select>
    <div class="input-connection"><button class="input-connect" aria-label="Conectar entrada de pista ${i + 1}">Conectar</button><button class="input-disconnect" aria-label="Desconectar entrada de pista ${i + 1}" title="Desconectar entrada" disabled>×</button><span class="input-status">Sin conectar</span></div>
    <div class="input-level"><button class="input-mute" aria-label="Silenciar entrada de pista ${i + 1}" aria-pressed="false" title="Silenciar la entrada antes de grabar">Entrada</button><input class="input-gain" type="range" min="0" max="200" value="100" aria-label="Nivel de entrada de pista ${i + 1}"><output class="input-value">100%</output><div class="meter" role="meter" aria-label="Señal de entrada de pista ${i + 1}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i class="input-meter"></i></div></div>
    <div class="input-listen-row"><label class="input-listen"><input type="checkbox" aria-label="Escuchar entrada de pista ${i + 1}"> Escuchar</label><button class="latency-button" aria-label="Sincronizar latencia de pista ${i + 1}">Sincronizar</button><button class="input-apply" aria-label="Aplicar entrada de pista ${i + 1} a todas" title="Copia fuente, nivel, silencio y compensación de entrada. Conserva el audio grabado.">Aplicar a todas</button></div>
  </div>`);
  $('#tracks').append(card);
  const dialBank = card.querySelector('.track-bottom');
  const volumeDial = document.createElement('div'); volumeDial.className = 'dial-control volume-dial';
  const volumeCaption = document.createElement('div'); volumeCaption.className = 'dial-caption';
  const volumeInput = dialBank.querySelector('input');
  volumeCaption.append(dialBank.querySelector('span'), dialBank.querySelector('output'));
  volumeDial.append(volumeInput, volumeCaption); dialBank.append(volumeDial);
  const inputDial = document.createElement('div'); inputDial.className = 'dial-control input-dial';
  const inputCaption = document.createElement('div'); inputCaption.className = 'dial-caption';
  const inputLabel = document.createElement('span'); inputLabel.textContent = 'IN';
  inputCaption.append(inputLabel, card.querySelector('.input-value'));
  inputDial.append(card.querySelector('.input-gain'), inputCaption); dialBank.append(inputDial);
  enhanceKnob(volumeInput); enhanceKnob(card.querySelector('.input-gain'));
  card.querySelector('.input-level').insertAdjacentHTML('beforeend', '<span class="simple-state"></span>');
  card.querySelector('.input-listen-row').insertAdjacentHTML('afterbegin', `<button class="input-advanced" aria-label="Ajustes avanzados de pista ${i + 1}">Ajustes</button>`);
  card.querySelector('.input-advanced').addEventListener('click', () => { setMode('advanced'); card.querySelector('.latency-button').focus(); });
  card.querySelector('.wave-area').insertAdjacentHTML('beforeend', '<div class="countdown" role="status" aria-live="polite" aria-atomic="true" hidden><strong></strong><span>PREPARATE</span></div>');
  const q = s => card.querySelector(s);
  cards.push({ card, canvas: q('canvas'), name: q('.track-name'), status: q('.track-status'), placeholder: q('.wave-placeholder'),
    head: q('.playhead'), counter: q('.countdown'), counterNumber: q('.countdown strong'), record: q('.record-button'), recordLabel: q('.record-label'), mute: q('.mute'), solo: q('.solo'), clear: q('.clear-button'), volume: q('.volume'), value: q('output'), source: q('.source-select'), connect: q('.input-connect'), disconnect: q('.input-disconnect'), inputStatus: q('.input-status'), inputGain: q('.input-gain'), inputValue: q('.input-value'), inputMute: q('.input-mute'), listen: q('.input-listen input'), inputMeter: q('.input-meter') });
  q('.source-select').addEventListener('change', e => {
    const value = e.target.value, kind = value.startsWith('device:') ? 'device' : value.startsWith('native:') ? 'native' : value;
    if (monitorId === i) setMonitor(-1);
    inputs.setConfig(i, { ...inputs.configs[i], kind, deviceId: ['device', 'native'].includes(kind) ? value.slice(7) : '', label: e.target.selectedOptions[0].textContent.slice(0, 200) }); changed();
  });
  q('.input-connect').addEventListener('click', () => connectInput(i));
  q('.latency-button').addEventListener('click', () => openLatency(i));
  q('.input-apply').addEventListener('click', async () => {
    if (state.recording || ioBusy || inputs.pending >= 0) return;
    try {
      setMonitor(-1); const connected = await inputs.applyToAll(i); refreshOptions(); changed(); render();
      notify(connected ? 'Entrada, nivel, silencio y compensación aplicados a las seis pistas. Los loops grabados se conservan.' : 'Fuente y ajustes aplicados a las seis pistas. Conectá una y volvé a aplicar para compartir la conexión.');
    } catch (error) { notify(error.message, true); }
  });
  q('.input-disconnect').addEventListener('click', () => { if (monitorId === i) setMonitor(-1); inputs.disconnect(i); });
  q('.input-gain').addEventListener('input', e => { inputs.setConfig(i, { ...inputs.configs[i], gain: e.target.value / 100 }); changed(); });
  q('.input-mute').addEventListener('click', () => { inputs.setConfig(i, { ...inputs.configs[i], muted: !inputs.configs[i].muted }); changed(); });
  q('.input-listen input').addEventListener('change', e => setMonitor(e.target.checked ? i : -1));
  q('.record-button').addEventListener('click', () => actTrack(i));
  q('.mute').addEventListener('click', () => send({ type: 'track', id: i, muted: !state.tracks[i].muted }));
  q('.solo').addEventListener('click', () => send({ type: 'track', id: i, solo: !state.tracks[i].solo }));
  q('.clear-button').addEventListener('click', () => send({ type: 'clear', id: i }));
  q('.volume').addEventListener('input', e => { q('output').textContent = `${e.target.value}%`; send({ type: 'track', id: i, volume: e.target.value / 100 }); });
  q('.track-name').addEventListener('input', e => { names[i] = e.target.value; changed(); });
}

enhanceKnob($('#master'));
function setMode(mode, persist = true) {
  const advanced = mode === 'advanced';
  document.body.dataset.mode = advanced ? 'advanced' : 'simple';
  $('#mode-simple').setAttribute('aria-pressed', String(!advanced));
  $('#mode-advanced').setAttribute('aria-pressed', String(advanced));
  if (persist && !writeMode(preferenceStorage, mode)) notify('Modo cambiado. Este entorno no permite recordar la preferencia al cerrar.');
  requestAnimationFrame(drawWaves);
}
$('#mode-simple').addEventListener('click', () => setMode('simple'));
$('#mode-advanced').addEventListener('click', () => setMode('advanced'));
setMode(document.body.dataset.mode, false);

function diagnosticResult(text, ok = true) {
  $('#audio-result').textContent = text; $('#audio-result').dataset.ok = String(ok);
}
function updateDiagnostics() {
  if (!$('#audio-dialog').open) return;
  const busy = diagnosticBusy || ioBusy || inputs.pending >= 0 || !!state.recording;
  const id = Number($('#audio-track').value);
  $('#audio-test-input').disabled = busy || !inputs.slots[id];
  $('#audio-test-output').disabled = busy || state.playing || monitorId >= 0;
  $('#audio-track').disabled = busy;
  $('#audio-refresh').disabled = busy;
  $('#audio-advanced').disabled = busy;
  const suspended = ctx && ctx.state !== 'running' && ctx.state !== 'closed';
  $('#audio-recovery').hidden = !suspended; $('#audio-resume').hidden = !suspended;
  $('#audio-resume').disabled = busy;
  $('#audio-runtime').textContent = `${desktop ? 'SEIS ' + desktop.version + ' · Windows' + (nativeCapabilities?.windowsBuild ? ' · build ' + nativeCapabilities.windowsBuild : '') : 'SEIS · Navegador'} · ${ctx ? Math.round(ctx.sampleRate) + ' Hz · ' + (ctx.state === 'running' ? 'motor activo' : 'motor ' + ctx.state) : 'El motor se activa al conectar o probar.'}`;
  $('#audio-test-output').title = state.playing ? 'Detené los loops para probar la salida.' : monitorId >= 0 ? 'Desactivá Escuchar en Avanzado antes de emitir el tono.' : 'Emite un tono suave en la salida elegida, respetando el volumen general.';
}
function refreshDiagnosticChecks() {
  const list = $('#audio-checks'); list.replaceChildren();
  for (const check of capabilities(window, nativeCapabilities)) {
    const item = document.createElement('li'), title = document.createElement('strong');
    title.textContent = `${check.ok ? '✓' : '○'} ${check.title}`;
    item.classList.toggle('limited', !check.ok); item.append(title, document.createTextNode(check.detail)); list.append(item);
  }
  const select = $('#audio-track'), previous = select.value;
  select.replaceChildren(...names.map((name, id) => new Option(`${name || 'Loop ' + (id + 1)} · ${inputs.slots[id] ? 'conectada' : 'sin conectar'}`, String(id))));
  const connected = inputs.slots.findIndex(Boolean);
  select.value = inputs.slots[Number(previous)] ? previous : String(Math.max(0, connected));
  updateDiagnostics();
}
$('#audio-review').addEventListener('click', () => {
  if (state.recording || ioBusy || inputs.pending >= 0) return;
  diagnosticResult('Probá una entrada ya conectada mientras tocás o reproducís la app. La prueba de salida emite un tono suave: usá auriculares y volumen bajo.');
  $('#audio-dialog').showModal(); refreshDiagnosticChecks();
});
$('#audio-close').addEventListener('click', () => { diagnosticCancel?.(); $('#audio-dialog').close(); });
$('#audio-dialog').addEventListener('close', () => { if (!$('#audio-dialog').open) diagnosticCancel?.(); });
$('#audio-dialog').addEventListener('cancel', () => diagnosticCancel?.());
$('#audio-track').addEventListener('change', () => { updateDiagnostics(); diagnosticResult('Tocá, hablá o reproducí la aplicación y pulsá Comprobar señal.'); });
$('#audio-advanced').addEventListener('click', () => { $('#audio-dialog').close(); setMode('advanced'); $('#mode-advanced').focus(); });
$('#audio-refresh').addEventListener('click', async () => {
  await withBusy(async () => { await listDevices(); refreshDiagnosticChecks(); diagnosticResult('Lista actualizada. Conectá una entrada desde su loop si aún no lo hiciste.'); });
});
$('#audio-resume').addEventListener('click', () => withBusy(async () => { await ensureAudio(); diagnosticResult('Motor reactivado. Las tomas y los ajustes se conservaron.'); }));
// Diagnostic cancellation works even while resume() is awaiting a user gesture.
async function runDiagnostic(action) {
  if (diagnosticBusy || ioBusy || state.recording || inputs.pending >= 0) return;
  diagnosticBusy = true;
  const controller = new AbortController();
  diagnosticCancel = () => controller.abort(); render();
  try { await action(controller.signal); }
  catch (error) { if (!controller.signal.aborted) diagnosticResult(audioError(error), false); }
  finally { if (controller.signal.aborted) diagnosticResult('Prueba cancelada. Las grabaciones se conservaron.'); diagnosticCancel = null; diagnosticBusy = false; render(); }
}
$('#audio-test-input').addEventListener('click', () => runDiagnostic(async signal => {
  const id = Number($('#audio-track').value), slot = inputs.slots[id];
  if (!slot) { diagnosticResult('Conectá la entrada en su loop antes de probar.', false); return; }
  await ensureAudio(); if (signal.aborted) return;
  diagnosticResult('Comprobando 3 segundos… Tocá, hablá o reproducí audio en la aplicación.');
  let peak = 0;
  await new Promise(resolve => {
    const start = performance.now();
    const finish = () => { clearInterval(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setInterval(() => { peak = Math.max(peak, inputs.peak(id)); if (performance.now() - start >= 3000 || inputs.slots[id] !== slot) finish(); }, 25);
    signal.addEventListener('abort', finish, { once: true });
  });
  if (signal.aborted) return;
  const result = signalResult({ ...inputs.configs[id], connected: inputs.slots[id] === slot, peak });
  diagnosticResult(result.text, result.ok);
}));
$('#audio-test-output').addEventListener('click', () => runDiagnostic(async signal => {
  if (state.playing || monitorId >= 0) { diagnosticResult('Detené los loops y desactivá Escuchar antes de probar la salida.', false); return; }
  const master = Number($('#master').value) / 100;
  if (!master) { diagnosticResult('El volumen general está en cero. Subilo para probar la salida.', false); return; }
  await ensureAudio(); if (signal.aborted) return;
  const oscillator = ctx.createOscillator(), gain = ctx.createGain(), start = ctx.currentTime;
  oscillator.frequency.value = 440; gain.gain.value = 0;
  oscillator.connect(gain); gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.035 * master, start + .04);
  gain.gain.setValueAtTime(.035 * master, start + .9); gain.gain.linearRampToValueAtTime(0, start + 1);
  diagnosticResult('Emitiendo un tono suave durante un segundo…');
  await new Promise(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); try { oscillator.stop(); } catch {} oscillator.disconnect(); gain.disconnect(); resolve(); };
    const timer = setTimeout(finish, 1200);
    signal.addEventListener('abort', finish, { once: true });
    oscillator.start(start); oscillator.stop(start + 1.05);
  });
  if (!signal.aborted) diagnosticResult('Tono enviado a la salida elegida. Si no lo escuchaste, revisá auriculares, salida y volumen del sistema. SEIS no puede confirmar si lo oíste.');
}));

function notify(text, error = false) {
  clearTimeout(notificationTimer);
  const el = $('#notification');
  el.textContent = text; el.classList.toggle('error', error); el.hidden = false;
  notificationTimer = setTimeout(() => { el.hidden = true; }, error ? 11000 : 5500);
}
function changed() { dirty = true; revision++; $('#dirty').hidden = false; if (!ctx) render(); }
function markSaved() { dirty = false; $('#dirty').hidden = true; }
function send(message) { if (node) node.port.postMessage(message); }
function time(frames) {
  const sec = frames / state.rate;
  return { main: `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`, decimal: `.${String(Math.floor(sec * 100) % 100).padStart(2, '0')}` };
}

async function ensureAudio(rate) {
  if (initPromise) await initPromise;
  if (!ctx) {
    initPromise = (async () => {
      if (!window.AudioContext || !window.AudioWorkletNode) throw Error('Abrí SEIS en una versión actual de Chrome o Edge.');
      const nextCtx = new AudioContext({ latencyHint: 'interactive', ...(rate ? { sampleRate: rate } : {}) });
      try {
        await nextCtx.audioWorklet.addModule(new URL('./processor.js?v=1.5.0', import.meta.url));
        const nextNode = new AudioWorkletNode(nextCtx, 'seis-looper', { numberOfInputs: 6, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit' });
        nextNode.port.onmessage = onMessage;
        nextNode.onprocessorerror = () => { notify('El motor de audio se interrumpió. Recargá la página y abrí tu última sesión guardada.', true); };
        nextNode.connect(nextCtx.destination);
        ctx = nextCtx; node = nextNode;
        ctx.onstatechange = () => { if (ctx.state === 'suspended' || ctx.state === 'interrupted') notify('Audio suspendido. Abrí Revisar audio → Reactivar audio para continuar.'); render(); };
        // Apply pre-initialization slider choices.
        send({ type: 'settings', master: $('#master').value / 100, inputGain: 1 });
        cards.forEach((c, id) => send({ type: 'track', id, volume: c.volume.value / 100 }));
      } catch (e) { await nextCtx.close(); throw e; }
    })();
    try { await initPromise; } finally { initPromise = null; }
  }
  await ctx.resume();
}

function onMessage({ data: message }) {
  if (message.type === 'status') {
    const previous = state.recording;
    state = message.data;
    if (previous && !state.recording && !state.tracks[previous.id].hasAudio) { waves[previous.id] = []; drawWave(previous.id); }
    if (!previous && state.recording) { waves[state.recording.id] = []; drawWave(state.recording.id); }
    render(); return;
  }
  if (message.type === 'snapshot') {
    const waiter = pending.get(message.requestId);
    if (waiter) { clearTimeout(waiter.timeout); pending.delete(message.requestId); waiter.resolve(message.data); }
    return;
  }
  if (message.type === 'error') {
    const waiter = pending.get(message.requestId);
    if (waiter) { clearTimeout(waiter.timeout); pending.delete(message.requestId); waiter.reject(Error(message.message)); }
    else notify(message.message, true);
    return;
  }
  if (message.type === 'recorded' || message.type === 'restored') { waves[message.id] = message.peaks; drawWaves(); changed(); }
  if (message.type === 'inputLost') notify(message.kept ? 'La entrada se desconectó. Se conservó el audio grabado hasta ese momento.' : 'La entrada se desconectó antes de completar una toma válida. Las otras pistas se conservan.', true);
  if (message.type === 'recorded') notify(`Pista ${message.id + 1} lista. Ya está sonando en loop.`);
  if (message.type === 'cleared') { waves[message.id] = []; drawWaves(); changed(); notify('Pista borrada de esta sesión. Podés deshacer el borrado.'); }
  if (message.type === 'loaded') { waves = message.peaks; drawWaves(); }
  if (message.type === 'changed' && !ioBusy) changed();
}

function snapshot() {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    const timeout = setTimeout(() => { pending.delete(id); reject(Error('El audio no respondió. Volvé a activar la pestaña e intentá otra vez.')); }, 12000);
    pending.set(id, { resolve, reject, timeout });
    send({ type: 'snapshot', requestId: id });
  });
}

function setMonitor(id) {
  monitorId = id;
  send({ type: 'settings', monitor: id >= 0, inputTrack: Math.max(0, id) });
  render();
}

function trackLatency(id) {
  const config = inputs.configs[id], slot = inputs.slots[id];
  if (!config) return { ms: 0, ready: false, route: '', detail: 'Conectá una entrada.' };
  const settings = slot?.entry.stream.getAudioTracks()[0]?.getSettings?.() || {};
  const sink = typeof ctx?.sinkId === 'string' ? ctx.sinkId : $('#output-device').value;
  const output = devices.find(d => d.kind === 'audiooutput' && d.deviceId === (sink || 'default'));
  const outputKey = JSON.stringify([sink || 'default', output?.groupId || output?.label || '']);
  const route = slot && ctx ? routeKey(config, settings, outputKey, ctx.sampleRate) : '';
  return { ...resolveLatency(config, settings, ctx || {}, route), route };
}
function openLatency(id) {
  if (ioBusy || state.recording || inputs.pending >= 0) return;
  latencyId = id; measurementDraft = null;
  const config = inputs.configs[id], info = trackLatency(id);
  $('#latency-title').textContent = `Sincronizar · ${names[id] || 'Loop ' + (id + 1)}`;
  $('#latency-source').textContent = config.label || cards[id].source.selectedOptions[0]?.textContent || 'Entrada de grabación';
  $('#latency-mode').value = config.latency.mode;
  $('#latency-mode option[value="measured"]').disabled = config.latency.mode !== 'measured';
  $('#compensation').value = (info.ready ? info.ms : config.latency.ms).toFixed(1);
  $('#calibration-ready').checked = false;
  $('#latency-status').textContent = !inputs.slots[id] ? 'Conectá esta entrada antes de medir o aplicar el ajuste.' : (state.playing ? 'Detené la reproducción para medir. ' : '') + info.detail;
  $('#latency-dialog').showModal(); render();
}
$('#latency-close').addEventListener('click', () => { measurementAbort?.abort(); $('#latency-dialog').close(); });
$('#latency-dialog').addEventListener('cancel', () => measurementAbort?.abort());
$('#latency-cancel').addEventListener('click', () => measurementAbort?.abort());
$('#calibration-ready').addEventListener('change', render);
$('#latency-mode').addEventListener('change', () => {
  const mode = $('#latency-mode').value;
  if (mode === 'auto') {
    const info = trackLatency(latencyId), config = { ...inputs.configs[latencyId], latency: latencyConfig() };
    const settings = inputs.slots[latencyId]?.entry.stream.getAudioTracks()[0]?.getSettings?.() || {};
    const estimate = resolveLatency(config, settings, ctx || {}, info.route);
    $('#compensation').value = estimate.ms.toFixed(1); $('#latency-status').textContent = estimate.detail;
  } else if (mode === 'measured') {
    const measured = measurementDraft || inputs.configs[latencyId].latency;
    $('#compensation').value = measured.ms.toFixed(1);
    $('#latency-status').textContent = `Retorno medido: ${measured.ms.toFixed(1)} ms. Repetí la prueba si cambiaste el búfer o los efectos.`;
  } else if (mode === 'off') { $('#compensation').value = '0'; $('#latency-status').textContent = 'No se adelantará el audio de las tomas nuevas.'; }
  else if (mode === 'manual') $('#latency-status').textContent = 'Ingresá el retardo total del recorrido, en milisegundos. No se suma otra compensación encima.';
  render();
});
$('#latency-apply').addEventListener('click', () => {
  if (ioBusy || state.recording || !inputs.slots[latencyId]) return;
  const mode = $('#latency-mode').value, current = trackLatency(latencyId);
  const ms = Number($('#compensation').value);
  if (!Number.isFinite(ms) || ms < 0 || ms > MAX_LATENCY_MS) { $('#latency-status').textContent = `Ingresá un valor entre 0 y ${MAX_LATENCY_MS} ms.`; return; }
  const measured = measurementDraft || inputs.configs[latencyId].latency;
  if (mode === 'measured' && measured.route !== current.route) { $('#latency-status').textContent = 'La ruta cambió después de medir. Repetí la medición.'; return; }
  const latency = latencyConfig({ mode, ms: mode === 'measured' ? measured.ms : mode === 'manual' ? ms : 0, route: ['manual', 'measured'].includes(mode) ? current.route : '' });
  inputs.setConfig(latencyId, { ...inputs.configs[latencyId], latency });
  changed(); render(); $('#latency-dialog').close();
  notify(`Compensación aplicada al Loop ${latencyId + 1}. Usá Aplicar a todas si comparten la misma ruta. Solo afecta tomas nuevas.`);
});
$('#latency-measure').addEventListener('click', async () => {
  if (ioBusy || state.recording || state.playing || !$('#calibration-ready').checked || !inputs.slots[latencyId]) return;
  const id = latencyId, slot = inputs.slots[id], originalRoute = trackLatency(id).route;
  if (inputs.configs[id].muted || inputs.configs[id].gain === 0) { $('#latency-status').textContent = 'Activá la entrada y subí su nivel antes de medir.'; return; }
  measurementAbort = new AbortController(); const controller = measurementAbort;
  await withBusy(async () => {
    setMonitor(-1); $('#latency-cancel').hidden = false;
    $('#latency-status').textContent = 'Midiendo tres señales… Mantené esta ventana visible y no toques durante la prueba.';
    try {
      await ensureAudio(); const result = await calibrate(ctx, slot.analyser, controller.signal);
      if (controller.signal.aborted || inputs.slots[id] !== slot || trackLatency(id).route !== originalRoute) throw Error('La entrada o salida cambió durante la medición. Repetí la prueba.');
      measurementDraft = { ...result, route: originalRoute };
      $('#latency-mode option[value="measured"]').disabled = false;
      $('#latency-mode').value = 'measured'; $('#compensation').value = result.ms.toFixed(1);
      $('#latency-status').textContent = `Retorno medido: ${result.ms.toFixed(1)} ms · variación ${result.spreadMs.toFixed(1)} ms. Pulsá Aplicar a esta entrada para usarlo.`;
    } catch (error) { $('#latency-status').textContent = error.message; }
    finally { measurementAbort = null; $('#latency-cancel').hidden = true; }
  });
});
function refreshOptions() {
  cards.forEach((c, id) => {
    const config = inputs.configs[id];
    const value = ['device', 'native'].includes(config.kind) ? config.kind + ':' + config.deviceId : config.kind;
    c.source.replaceChildren(new Option('Micrófono / entrada predeterminada', 'device:'));
    const hardware = document.createElement('optgroup'); hardware.label = 'Dispositivos de entrada';
    devices.filter(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default').forEach((d, i) => hardware.append(new Option(d.label || 'Entrada ' + (i + 1), 'device:' + d.deviceId)));
    c.source.append(hardware);
    if (desktop) {
      for (const group of [...new Set(nativeSources.map(source => source.group))]) {
        const options = document.createElement('optgroup'); options.label = group;
        nativeSources.filter(source => source.group === group).forEach(source => options.append(new Option(source.label, 'native:' + source.id)));
        c.source.append(options);
      }
    }
    const apps = document.createElement('optgroup'); apps.label = 'Audio compartido por el navegador';
    [['window', 'Aplicación / ventana…'], ['tab', 'Pestaña del navegador…'], ['system', 'Todo el audio del sistema…']].forEach(([v, label]) => {
      const option = new Option(label, v); option.disabled = !navigator.mediaDevices?.getDisplayMedia; apps.append(option);
    });
    if (!desktop) c.source.append(apps);
    if (![...c.source.options].some(o => o.value === value)) c.source.add(new Option((config.label || 'Entrada guardada') + ' · no disponible', value));
    c.source.value = value;
  });
  const output = $('#output-device'), selected = output.value;
  output.replaceChildren(new Option('Salida predeterminada del sistema', ''));
  devices.filter(d => d.kind === 'audiooutput' && d.deviceId && d.deviceId !== 'default').forEach((d, i) => output.add(new Option(d.label || 'Salida ' + (i + 1), d.deviceId)));
  if (selected && ![...output.options].some(o => o.value === selected)) output.add(new Option('Salida anterior · no disponible', selected));
  output.value = selected;
}
async function listDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const results = await Promise.allSettled([navigator.mediaDevices.enumerateDevices(), desktop ? desktopRequest('sources.list') : Promise.resolve(null)]);
  if (results[0].status === 'fulfilled') devices = results[0].value;
  if (results[1].status === 'fulfilled' && results[1].value) {
    nativeSources = results[1].value.sources;
    nativeCapabilities = { ...desktop, ...results[1].value.capabilities };
  }
  refreshOptions();
  const failure = results.find(result => result.status === 'rejected'); if (failure) throw failure.reason;
}
async function connectInput(id) {
  if (ioBusy || state.recording || inputs.pending >= 0) return;
  if (desktop && ['window', 'tab', 'system'].includes(inputs.configs[id].kind)) { notify('En escritorio, elegí una aplicación de Windows o una salida loopback de la lista.', true); return; }
  try {
    // Keep the call synchronous up to the browser's capture request.
    const connecting = inputs.connect(id);
    if (!await connecting) return;
    changed();
    await listDevices().catch(() => {});
    const kind = inputs.configs[id].kind;
    notify(kind === 'system' || (kind === 'native' && inputs.configs[id].deviceId.startsWith('out:')) ? 'Salida loopback conectada: incluye todo lo que suene por esa salida, también SEIS. Para aislar una app, elegí su entrada de aplicación.' : 'Entrada del Loop ' + (id + 1) + ' lista. Revisá el medidor antes de grabar.');
  } catch (e) {
    notify(audioError(e), true);
  } finally { render(); }
}

async function actTrack(id) {
  if (ioBusy || diagnosticBusy || inputs.pending >= 0) return;
  const r = state.recording;
  if (r?.id === id) { send({ type: !r.armed && !r.countdownFrames ? 'finish' : 'cancel' }); return; }
  if (r) { notify('Terminá o cancelá la grabación actual antes de grabar otra pista.'); return; }
  if (state.tracks[id].hasAudio) { send({ type: 'track', id, muted: !state.tracks[id].muted }); return; }
  if (!inputs.slots[id]) { notify('Elegí una fuente y pulsá Conectar en el Loop ' + (id + 1) + '.'); cards[id].connect.focus(); return; }
  if (inputs.configs[id].muted || inputs.configs[id].gain === 0) { notify('La entrada está en silencio. Abrí Ajustes o Avanzado, activá Entrada y subí su nivel antes de grabar.', true); return; }
  if (monitorId !== id) setMonitor(-1);
  try {
    await ensureAudio(); const latency = trackLatency(id);
    send({ type: 'record', id, compensation: latency.ms });
    if (state.length && !latency.ready) notify('Loop ' + (id + 1) + ' sin compensar: usá Sincronizar para medir o ajustar esta ruta.');
  } catch (e) { notify(e.message, true); }
}
async function togglePlay() {
  if (ioBusy) return;
  if (state.playing || state.recording) { send({ type: 'stop' }); return; }
  if (!state.length) return;
  try { await ensureAudio(); send({ type: 'play' }); } catch (e) { notify(e.message, true); }
}
async function handleSpace() {
  const action = spaceAction(state);
  if (action.type === 'wait') {
    notify(state.recording.ending ? 'Cerrando la toma: esperando su final retrasado para conservarlo.' : state.recording.countdownFrames ? 'Preparación en curso. La grabación empieza al terminar la cuenta.' : 'La pista está preparada: empieza al inicio de la próxima vuelta.');
  } else if (action.type === 'record') await actTrack(action.id);
  else if (action.type === 'finish') send(action);
  else await togglePlay();
}

function render() {
  const r = state.recording;
  $('#audio-review').disabled = ioBusy || inputs.pending >= 0 || !!r;
  updateDiagnostics();
  const counting = !!r?.countdownFrames;
  const secondsLeft = counting ? Math.ceil(r.countdownFrames / state.rate) : 0;
  const busy = ioBusy || diagnosticBusy || inputs.pending >= 0;
  const hasAudio = state.tracks.some(t => t.hasAudio);
  const anySolo = state.tracks.some(t => t.hasAudio && t.solo);
  const connected = inputs.slots.filter(Boolean).length;
  $('#inputs-status').textContent = inputs.pending >= 0 ? 'Esperando permiso para Loop ' + (inputs.pending + 1) + '…' : connected + ' / 6 entradas conectadas';
  $('#refresh-devices').disabled = busy || !!r;
  $('#disconnect-inputs').disabled = !connected || busy || !!r;
  $('#output-device').disabled = busy || !!r || !window.AudioContext?.prototype.setSinkId;
  $('#play').textContent = state.playing ? 'Ⅱ Detener' : '▶ Reproducir';
  $('#play').classList.toggle('is-on', state.playing);
  $('#play').disabled = !hasAudio || !!r || busy;
  $('#stop').disabled = (!state.playing && !r) || busy;
  $('#save').disabled = (!hasAudio && !dirty) || !!r || busy;
  $('#export').disabled = !hasAudio || !!r || busy;
  $('#open').disabled = !!r || busy;
  $('#new').disabled = !!r || busy;
  $('#demo').disabled = !!r || busy;
  $('#undo').disabled = !state.canUndo || !!r || busy;
  $('#session-title').disabled = busy;
  $('#master').disabled = busy;
  $('#compensation').disabled = !!r || busy || $('#latency-mode').value !== 'manual';
  $('#latency-mode').disabled = !!r || busy;
  $('#latency-apply').disabled = !!r || busy || !inputs.slots[latencyId];
  $('#latency-measure').disabled = !!r || busy || state.playing || !inputs.slots[latencyId] || !$('#calibration-ready').checked;
  $('#calibration-ready').disabled = busy;
  $('#cycles').disabled = busy;
  const t = time(r?.first ? r.written : state.length);
  $('#duration').textContent = t.main; $('#decimals').textContent = t.decimal;
  $('#loop-count').textContent = `${state.tracks.filter(t => t.hasAudio).length} / 6 PISTAS`;
  $('#cycle-length').textContent = state.length ? `${(state.rate / 1000).toFixed(1)} kHz · MONO` : 'MÁX. 2 MIN';
  $('#cycle-position').textContent = counting ? 'Preparación · Todavía no se está grabando' : r ? r.first ? 'Grabando el primer loop…' : r.armed ? 'Esperando el inicio de la vuelta…' : 'Grabando una vuelta completa…' : state.playing ? 'Todas las pistas comparten el mismo ciclo' : state.length ? 'Detenido · Listo para reproducir' : 'El primer loop define el ciclo';
  $('#instruction').textContent = counting ? r.first ? 'Prepará tu instrumento: la grabación empieza al terminar la cuenta.' : 'Después de la cuenta, entrás al inicio de la próxima vuelta.' : r ? r.first ? 'Volvé a pulsar la pista para cerrar el loop.' : r.armed ? 'Entrá a tocar cuando comience la próxima vuelta.' : 'La grabación termina sola al completar la vuelta.' : state.length ? 'Sumá otra capa o jugá con la mezcla.' : 'Conectá una entrada en el Loop 1 y empezá a grabar.';
  $('#transport-status').textContent = counting ? `EMPEZAMOS EN ${secondsLeft}` : r ? r.armed ? 'PISTA PREPARADA' : 'GRABANDO' : state.playing ? 'EN LOOP' : hasAudio ? 'SESIÓN EN PAUSA' : 'LISTO PARA CREAR';
  $('#transport-led').className = `led ${r && !r.armed && !counting ? 'recording' : state.playing || counting ? 'active' : ''}`;
  const progress = state.length ? state.position / state.length : r ? r.written / (state.rate * 120) : 0;
  $('#cycle-progress').style.width = `${progress * 100}%`;
  const live = state.inputPeak || 0;
  setMeter('output', state.outputPeak || 0);
  for (let i = 0; i < 6; i++) {
    const track = state.tracks[i], c = cards[i], recording = r?.id === i;
    const config = inputs.configs[i], connected = !!inputs.slots[i];
    c.source.disabled = busy || !!r;
    c.connect.disabled = busy || !!r;
    c.connect.textContent = inputs.pending === i ? 'Permiso…' : connected ? 'Cambiar' : 'Conectar';
    c.disconnect.disabled = !connected || busy || !!r;
    c.inputStatus.textContent = connected ? config.label || 'Conectada' : 'Sin conectar';
    c.inputStatus.title = c.inputStatus.textContent;
    c.card.classList.toggle('input-connected', connected);
    c.inputGain.disabled = busy; c.inputMute.disabled = busy;
    c.inputGain.value = Math.round(config.gain * 100); c.inputValue.textContent = Math.round(config.gain * 100) + '%';
    c.inputMute.setAttribute('aria-pressed', String(config.muted));
    c.inputMute.textContent = config.muted ? 'Sin señal' : 'Entrada';
    c.listen.checked = monitorId === i;
    c.listen.disabled = !connected || busy || (!!r && !recording) || config.kind === 'system' || (config.kind === 'native' && config.deviceId.startsWith('out:'));
    c.card.querySelector('.input-apply').disabled = busy || !!r;
    const latency = trackLatency(i), syncButton = c.card.querySelector('.latency-button');
    const simpleInfo = [!connected ? 'Sin conectar' : config.muted || config.gain === 0 ? 'Entrada silenciada' : 'Entrada conectada'];
    if (monitorId === i) simpleInfo.push('Escucha activa');
    if (config.gain !== 1 && config.gain > 0) simpleInfo.push(`Nivel ${Math.round(config.gain * 100)}%`);
    if (track.solo) simpleInfo.push('Solo activo');
    if (connected && latency.ready && latency.ms > 0) simpleInfo.push(`${latency.ms.toFixed(1)} ms`);
    else if (connected && latency.label === 'Revisar ruta') simpleInfo.push('Recalibrar');
    const simpleState = c.card.querySelector('.simple-state');
    simpleState.textContent = simpleInfo.join(' · '); simpleState.title = simpleState.textContent;
    syncButton.disabled = busy || !!r;
    syncButton.textContent = connected && latency.ready && latency.ms > 0 ? `${latency.ms.toFixed(1)} ms` : connected && latency.label === 'Revisar ruta' ? 'Recalibrar' : 'Sincronizar';
    syncButton.title = connected ? `${latency.label}: ${latency.detail}` : 'Conectá una entrada para medir o ajustar su latencia.';
    const peak = inputs.peak(i), amount = Math.min(100, Math.sqrt(peak) * 100);
    c.inputMeter.style.height = amount + '%'; c.inputMeter.classList.toggle('hot', peak >= .98);
    c.inputMeter.parentElement.setAttribute('aria-valuenow', String(Math.round(amount)));
    c.inputMeter.parentElement.title = peak >= .98 ? 'Nivel alto: bajá la entrada para evitar saturación.' : 'Nivel de la fuente antes de grabar';
    const inaudible = track.muted || (anySolo && !track.solo);
    c.card.classList.toggle('has-audio', track.hasAudio);
    c.card.classList.toggle('is-playing', state.playing);
    c.card.classList.toggle('is-recording', recording && !r.armed && !counting);
    c.card.classList.toggle('is-armed', recording && (r.armed || counting));
    c.card.classList.toggle('is-muted', track.hasAudio && inaudible);
    c.status.textContent = recording ? r.ending ? 'CERRANDO' : counting ? 'PREPARATE' : r.armed ? 'EN ESPERA' : 'GRABANDO' : track.hasAudio ? inaudible ? 'SILENCIADA' : state.playing ? 'EN LOOP' : 'LISTA' : 'VACÍA';
    c.recordLabel.textContent = recording ? r.ending ? 'Cerrando…' : !r.armed && !counting ? 'Cerrar loop' : 'Cancelar' : track.hasAudio ? track.muted ? 'Activar' : 'Silenciar' : i === 0 ? 'Grabar · 3 s' : 'Grabar';
    c.record.setAttribute('aria-label', `${c.recordLabel.textContent} pista ${i + 1}`);
    c.record.disabled = busy || (!!r && !recording);
    c.mute.disabled = !track.hasAudio || busy;
    c.solo.disabled = !track.hasAudio || busy;
    c.clear.disabled = !track.hasAudio || !!r || busy;
    c.name.disabled = busy; c.volume.disabled = busy;
    c.mute.setAttribute('aria-pressed', String(track.muted));
    c.solo.setAttribute('aria-pressed', String(track.solo));
    c.placeholder.hidden = track.hasAudio;
    c.counter.hidden = !(recording && counting);
    if (recording && counting && c.counterNumber.textContent !== String(secondsLeft)) c.counterNumber.textContent = String(secondsLeft);
    if (track.hasAudio || (recording && counting)) c.placeholder.style.display = 'none';
    else { c.placeholder.style.display = ''; c.placeholder.textContent = recording ? r.armed ? 'Entrás en la próxima vuelta' : '● Grabando tu sonido' : `${i + 1}  ·  Tu próximo sonido`; }
    c.head.style.left = `${(recording && !r.first && !r.armed ? r.written / state.length : progress) * 100}%`;
  }
  if (performance.now() - drawAt > 100 && r && !r.armed && !counting) { drawAt = performance.now(); drawLive(r.id, live); }
  refreshKnobs();
}
function setMeter(kind, peak) {
  const el = $(`#${kind}-meter`);
  const amount = Math.min(100, Math.sqrt(peak) * 100);
  el.style.height = `${amount}%`; el.classList.toggle('hot', peak >= .98);
  el.parentElement.setAttribute('aria-valuenow', String(Math.round(amount)));
  el.parentElement.title = peak >= 1 ? 'Nivel alto: bajá el volumen para evitar saturación.' : `${Math.round(peak * 100)}%`;
}
function drawWave(id) {
  const c = cards[id].canvas;
  const dpr = window.devicePixelRatio || 1;
  const width = c.clientWidth, height = c.clientHeight;
  c.width = Math.round(width * dpr); c.height = Math.round(height * dpr);
  const g = c.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, width, height);
  g.strokeStyle = '#9db79d22'; g.beginPath(); g.moveTo(0, height / 2); g.lineTo(width, height / 2); g.stroke();
  g.fillStyle = colors[id];
  const wave = waves[id];
  if (!wave.length) return;
  const step = width / wave.length;
  for (let i = 0; i < wave.length; i++) { const h = Math.max(2, Math.min(1, wave[i]) * (height - 8)); g.fillRect(i * step, (height - h) / 2, Math.max(1, step - 1), h); }
}
function drawWaves() { cards.forEach((_, i) => drawWave(i)); }
function drawLive(id, peak) { waves[id].push(Math.min(1, peak)); if (waves[id].length > 160) waves[id].shift(); drawWave(id); }
new ResizeObserver(drawWaves).observe($('#tracks'));

function confirmAction(title, text) {
  const dialog = $('#confirm');
  $('#confirm-title').textContent = title; $('#confirm-text').textContent = text;
  dialog.returnValue = 'cancel';
  return new Promise(resolve => { dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true }); dialog.showModal(); });
}
async function mayReplace() { return !dirty || await confirmAction('¿Cambiar de sesión?', 'Hay cambios sin guardar. Descargá la sesión si querés conservarlos. Continuar reemplaza solo lo que está abierto; no borra archivos de tu PC.'); }
function download(buffer, filename, type) {
  const url = URL.createObjectURL(new Blob([buffer], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function filename() { return ($('#session-title').value.trim() || 'Mi sesión').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 80); }
async function withBusy(fn) {
  if (ioBusy) return;
  ioBusy = true; document.body.classList.add('busy'); render();
  try { await fn(); } catch (e) { notify(e.message, true); }
  finally { ioBusy = false; document.body.classList.remove('busy'); render(); }
}
function applyMetadata(data) {
  setMonitor(-1); inputs.disconnectAll();
  inputs.configs = data.tracks.map(t => inputConfig(t.input)); refreshOptions(); render();
  $('#session-title').value = data.title || 'Mi sesión';
  data.tracks.forEach((t, i) => { names[i] = t.name || `Loop ${i + 1}`; cards[i].name.value = names[i]; cards[i].volume.value = Math.round(t.volume * 100); cards[i].value.textContent = `${Math.round(t.volume * 100)}%`; });
  $('#master').value = Math.round(data.master * 100); $('#master-value').textContent = `${Math.round(data.master * 100)}%`;
  refreshKnobs();
}

$('#refresh-devices').addEventListener('click', () => listDevices().then(() => notify('Lista actualizada. Si faltan nombres, conectá una entrada para dar permiso al navegador.')).catch(e => notify(e.message, true)));
$('#disconnect-inputs').addEventListener('click', () => { setMonitor(-1); inputs.disconnectAll(); });
$('#output-device').addEventListener('change', () => withBusy(async () => {
  const selected = $('#output-device').value;
  try { await ensureAudio(); await ctx.setSinkId(selected); notify('Salida de reproducción actualizada.'); }
  catch (e) { $('#output-device').value = typeof ctx?.sinkId === 'string' ? ctx.sinkId : ''; throw Error(audioError(e, true)); }
}));
$('#play').addEventListener('click', togglePlay);
$('#stop').addEventListener('click', () => send({ type: 'stop' }));
$('#undo').addEventListener('click', () => send({ type: 'undo' }));
$('#master').addEventListener('input', e => { $('#master-value').textContent = `${e.target.value}%`; send({ type: 'settings', master: e.target.value / 100 }); changed(); });
$('#session-title').addEventListener('input', changed);
$('#save').addEventListener('click', () => withBusy(async () => {
  await ensureAudio(); const rev = revision; const data = await snapshot();
  download(encodeSession(data, $('#session-title').value, names, inputs.configs), `${filename()}.seisloop`, 'application/octet-stream');
  if (revision === rev) markSaved();
  notify('Sesión preparada para descargar. El archivo .seisloop conserva todas las pistas.');
}));
$('#export').addEventListener('click', () => withBusy(async () => {
  await ensureAudio(); const data = await snapshot();
  if (data.master === 0 || !data.tracks.some(t => t.samples && t.volume > 0 && !t.muted && (!data.tracks.some(t => t.samples && t.solo) || t.solo))) throw Error('La mezcla está en silencio. Activá una pista y subí la salida antes de exportar.');
  const cycles = Number($('#cycles').value);
  download(encodeWav(data, cycles), `${filename()}-${cycles}v.wav`, 'audio/wav');
  notify(`WAV preparado: ${(data.length * cycles / data.rate).toFixed(1)} segundos · mono · 16 bits.`);
}));
$('#open').addEventListener('click', () => { $('#file').value = ''; $('#file').click(); });
$('#file').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  await withBusy(async () => {
    if (file.size > 560_000_000) throw Error('El archivo es demasiado grande para una sesión SEIS.');
    const original = decodeSession(await file.arrayBuffer());
    if (!await mayReplace()) return;
    await ensureAudio(original.rate);
    const data = resampleSession(original, ctx.sampleRate);
    send({ type: 'load', data }); applyMetadata(data); markSaved();
    notify('Sesión abierta. Podés reproducirla; reconectá las entradas si querés grabar más.');
  });
});
$('#new').addEventListener('click', async () => {
  if (!await mayReplace()) return;
  const data = { title: 'Nueva sesión', rate: ctx?.sampleRate || 48000, length: 0, master: .75,
    tracks: Array.from({ length: 6 }, () => ({ samples: null, volume: .8, muted: false, solo: false })) };
  send({ type: 'load', data }); applyMetadata(data); waves = Array.from({ length: 6 }, () => []); drawWaves(); markSaved();
});

function makeDemo(rate) {
  const length = rate * 4;
  const demoNames = ['Pulso', 'Palmas', 'Hi-hat', 'Bajo', 'Acorde', 'Melodía'];
  let seed = 24601;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 2147483648 - 1; };
  const tracks = Array.from({ length: 6 }, (_, id) => {
    const samples = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const t = i / rate, beat = t % .5;
      if (id === 0) samples[i] = .5 * Math.sin(2 * Math.PI * (52 * beat + 12 * (1 - Math.exp(-35 * beat)))) * Math.exp(-18 * beat);
      if (id === 1 && Math.floor(t / .5) % 2) samples[i] = noise() * .23 * Math.exp(-35 * beat);
      if (id === 2) samples[i] = noise() * .08 * Math.exp(-100 * (t % .25));
      if (id === 3) { const f = [110, 110, 130.81, 98][Math.floor(t)]; samples[i] = .25 * Math.sin(2 * Math.PI * f * t) * Math.min(1, beat * 100) * Math.exp(-4 * beat); }
      if (id === 4) samples[i] = [220, 261.63, 329.63].reduce((n, f) => n + .045 * Math.sin(2 * Math.PI * f * t), 0) * Math.sin(Math.PI * t / 4) ** 2;
      if (id === 5) { const f = [440, 523.25, 659.25, 587.33, 523.25, 440, 392, 329.63][Math.floor(t / .5)]; samples[i] = .13 * Math.sin(2 * Math.PI * f * beat) * Math.min(1, beat * 150) * Math.exp(-8 * beat); }
    }
    return { samples: sealLoop(samples, rate), volume: .8, muted: false, solo: false, name: demoNames[id] };
  });
  return { title: 'Una vuelta · Demo', rate, length, master: .75, tracks };
}
$('#demo').addEventListener('click', async () => {
  if (!await mayReplace()) return;
  await withBusy(async () => { await ensureAudio(); const data = makeDemo(ctx.sampleRate); send({ type: 'load', data }); send({ type: 'play' }); applyMetadata(data); changed(); notify('Demo de 6 pistas. Probá silenciar, Solo y los volúmenes. Nueva inicia una sesión vacía.'); });
});

document.addEventListener('keydown', e => {
  if (document.activeElement?.closest('dialog[open]')) return;
  if (e.ctrlKey || e.altKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
  // Suppress native activation even when a Delete/Cancel button has keyboard focus.
  if (e.code === 'Space') e.preventDefault();
  if (e.repeat || ioBusy || $('dialog[open]')) return;
  if (e.code === 'Space') handleSpace();
  if (/^[1-6]$/.test(e.key)) { e.preventDefault(); actTrack(Number(e.key) - 1); }
  if (e.code === 'Escape' && state.recording) { send({ type: 'cancel' }); }
});
document.addEventListener('keyup', e => {
  if ($('dialog[open]')) return;
  if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) e.preventDefault();
});
window.addEventListener('beforeunload', e => { if (dirty || state.recording) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('pagehide', () => { diagnosticCancel?.(); measurementAbort?.abort(); inputs.disconnectAll(); ctx?.close(); });
navigator.mediaDevices?.addEventListener('devicechange', () => listDevices().catch(() => {}));
refreshOptions(); if (!desktop) listDevices().catch(() => {});
window.seisHasUnsavedChanges = () => dirty || !!state.recording;
if (desktop) {
  document.body.classList.add('desktop'); document.title = `SEIS ${desktop.version} · Escritorio`;
  $('#desktop-title').textContent = `SEIS ${desktop.version} · Escritorio para Windows`;
  $('#desktop-description').textContent = 'Aplicaciones y salidas nativas · Audio local · Usá auriculares';
  $('#desktop-download').hidden = true; $('#desktop-updates').hidden = false;
  const about = document.createElement('button'); about.className = 'text-button'; about.textContent = 'Versión y licencias';
  about.addEventListener('click', () => desktopRequest('about.show').catch(error => notify(error.message, true))); $('footer').append(about);
  $('.local-note div>span').textContent = 'Audio en tu PC · Sin cuentas ni subidas';
  $('#refresh-devices').textContent = 'Actualizar dispositivos y apps';
  $('.source-guide').textContent = 'Elegí una entrada de tu placa, una aplicación abierta o el audio de una salida de Windows. Para usar la misma fuente en seis pistas: Conectar → Aplicar a todas. Si una app usa ASIO o modo exclusivo, puede requerir loopback de la placa. La captura por proceso depende de la versión de Windows.';
  listDevices().catch(error => notify('No se pudo actualizar la lista: ' + error.message, true));
}
if (!window.AudioContext?.prototype.setSinkId) $('#output-hint').textContent = 'Este navegador usa la salida predeterminada del sistema.';
render();
if (!window.isSecureContext) notify('Para habilitar el micrófono, abrí https://emanuelmkt.com.ar/loop/ mediante HTTPS.', true);
