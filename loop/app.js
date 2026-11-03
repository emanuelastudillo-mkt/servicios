import { encodeSession, decodeSession, resampleSession, encodeWav } from './files.js';
import { sealLoop } from './audio-core.js';
import { spaceAction } from './controls.js?v=1.0.1';

const $ = selector => document.querySelector(selector);
const colors = ['#c7f69b', '#d8b5f8', '#93d8e9', '#efbd8c', '#f0a7ba', '#a6bafa'];
const names = Array.from({ length: 6 }, (_, i) => `Loop ${i + 1}`);
let waves = Array.from({ length: 6 }, () => []);
let ctx, node, source, stream, initPromise, micPending = false, ioBusy = false;
let dirty = false, revision = 0, requestId = 0, notificationTimer, drawAt = 0;
let state = { length: 0, position: 0, rate: 48000, playing: false, recording: null, canUndo: false,
  tracks: Array.from({ length: 6 }, () => ({ hasAudio: false, volume: .8, muted: false, solo: false })) };
const pending = new Map();
const cards = [];

for (let i = 0; i < 6; i++) {
  const card = document.createElement('article');
  card.className = 'track';
  card.style.setProperty('--color', colors[i]);
  card.setAttribute('aria-label', `Pista ${i + 1}`);
  card.innerHTML = `<div class="track-head"><span class="track-number">0${i + 1}</span><input class="track-name" value="Loop ${i + 1}" maxlength="80" aria-label="Nombre de pista ${i + 1}"><span class="track-status">VACÍA</span></div><div class="wave-area"><canvas aria-label="Forma de onda de pista ${i + 1}"></canvas><span class="wave-placeholder"><kbd>${i + 1}</kbd> Tu próximo sonido</span><div class="playhead"></div></div><div class="track-actions"><button class="record-button" aria-label="Grabar pista ${i + 1}"><span class="record-dot" aria-hidden="true"></span><span class="record-label">Grabar</span></button><button class="toggle-button mute" aria-label="Silenciar pista ${i + 1}" aria-pressed="false" disabled>Silenciar</button><button class="toggle-button solo" aria-label="Solo pista ${i + 1}" aria-pressed="false" disabled>Solo</button><button class="clear-button" title="Borrar pista ${i + 1}" aria-label="Borrar pista ${i + 1}" disabled>×</button></div><div class="track-bottom"><span>VOL</span><input class="volume" type="range" min="0" max="150" value="80" aria-label="Volumen de pista ${i + 1}"><output>80%</output></div>`;
  $('#tracks').append(card);
  card.querySelector('.wave-area').insertAdjacentHTML('beforeend', '<div class="countdown" role="status" aria-live="polite" aria-atomic="true" hidden><strong></strong><span>PREPARATE</span></div>');
  const q = s => card.querySelector(s);
  cards.push({ card, canvas: q('canvas'), name: q('.track-name'), status: q('.track-status'), placeholder: q('.wave-placeholder'),
    head: q('.playhead'), counter: q('.countdown'), counterNumber: q('.countdown strong'), record: q('.record-button'), recordLabel: q('.record-label'), mute: q('.mute'), solo: q('.solo'), clear: q('.clear-button'), volume: q('.volume'), value: q('output') });
  q('.record-button').addEventListener('click', () => actTrack(i));
  q('.mute').addEventListener('click', () => send({ type: 'track', id: i, muted: !state.tracks[i].muted }));
  q('.solo').addEventListener('click', () => send({ type: 'track', id: i, solo: !state.tracks[i].solo }));
  q('.clear-button').addEventListener('click', () => send({ type: 'clear', id: i }));
  q('.volume').addEventListener('input', e => { q('output').textContent = `${e.target.value}%`; send({ type: 'track', id: i, volume: e.target.value / 100 }); });
  q('.track-name').addEventListener('input', e => { names[i] = e.target.value; changed(); });
}

function notify(text, error = false) {
  clearTimeout(notificationTimer);
  const el = $('#notification');
  el.textContent = text; el.classList.toggle('error', error); el.hidden = false;
  notificationTimer = setTimeout(() => { el.hidden = true; }, error ? 11000 : 5500);
}
function changed() { dirty = true; revision++; $('#dirty').hidden = false; }
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
        await nextCtx.audioWorklet.addModule(new URL('./processor.js?v=1.0.1', import.meta.url));
        const nextNode = new AudioWorkletNode(nextCtx, 'seis-looper', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit' });
        nextNode.port.onmessage = onMessage;
        nextNode.onprocessorerror = () => { notify('El motor de audio se interrumpió. Recargá la página y abrí tu última sesión guardada.', true); };
        nextNode.connect(nextCtx.destination);
        ctx = nextCtx; node = nextNode;
        ctx.onstatechange = () => { if (ctx.state === 'suspended') notify('Audio suspendido. Pulsá Reproducir para reactivarlo.'); };
        // Apply pre-initialization slider choices.
        send({ type: 'settings', master: $('#master').value / 100, inputGain: $('#input-gain').value / 100, compensation: Number($('#compensation').value) });
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

async function listMics() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const selected = stream?.getAudioTracks()[0]?.getSettings().deviceId || $('#device').value;
  const select = $('#device');
  select.replaceChildren(new Option('Micrófono predeterminado', ''));
  devices.filter(d => d.kind === 'audioinput').forEach((d, i) => select.add(new Option(d.label || `Micrófono ${i + 1}`, d.deviceId)));
  if ([...select.options].some(o => o.value === selected)) select.value = selected;
}

async function connectMic(device = $('#device').value) {
  if (micPending) return;
  micPending = true; render();
  let next;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Error('El micrófono necesita una conexión segura. Abrí https://emanuelmkt.com.ar/loop/ en Chrome o Edge.');
    await ensureAudio();
    next = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: device ? { exact: device } : undefined, channelCount: 1,
      echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    const nextSource = ctx.createMediaStreamSource(next);
    nextSource.connect(node);
    const old = stream;
    source?.disconnect(); source = nextSource; stream = next;
    old?.getTracks().forEach(t => t.stop());
    stream.getAudioTracks()[0].addEventListener('ended', () => {
      if (stream === next) { disconnectMic(); notify('El micrófono se desconectó. Revisá el dispositivo y volvé a activarlo.', true); }
    });
    await listMics();
    notify('Micrófono listo. Usá auriculares para evitar que se vuelvan a grabar los loops.');
  } catch (e) {
    if (next && next !== stream) next.getTracks().forEach(t => t.stop());
    const text = e.name === 'NotAllowedError' ? 'El micrófono está bloqueado. Habilitalo en los permisos de este sitio y volvé a intentar.' :
      e.name === 'NotFoundError' ? 'No se encontró un micrófono conectado.' :
      e.name === 'NotReadableError' ? 'No se pudo abrir el micrófono. Revisá si otra aplicación lo está usando.' : e.message;
    notify(text, true);
    if (stream) await listMics().catch(() => {});
  } finally { micPending = false; render(); }
}
function disconnectMic() {
  const old = stream; stream = null;
  old?.getTracks().forEach(t => t.stop()); source?.disconnect(); source = null;
  send({ type: 'settings', monitor: false });
  if (state.recording) send({ type: 'cancel' });
  $('#monitor').checked = false;
  render();
}

async function actTrack(id) {
  if (ioBusy || micPending) return;
  const r = state.recording;
  if (r?.id === id) { send({ type: !r.armed && !r.countdownFrames ? 'finish' : 'cancel' }); return; }
  if (r) { notify('Terminá o cancelá la grabación actual antes de grabar otra pista.'); return; }
  if (state.tracks[id].hasAudio) { send({ type: 'track', id, muted: !state.tracks[id].muted }); return; }
  if (!stream) { notify('Primero activá el micrófono con el botón de arriba.'); $('#mic').focus(); return; }
  try { await ensureAudio(); send({ type: 'record', id }); } catch (e) { notify(e.message, true); }
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
    notify(state.recording.countdownFrames ? 'Preparación en curso. La grabación empieza al terminar la cuenta.' : 'La pista está preparada: empieza al inicio de la próxima vuelta.');
  } else if (action.type === 'record') await actTrack(action.id);
  else if (action.type === 'finish') send(action);
  else await togglePlay();
}

function render() {
  const r = state.recording;
  const counting = !!r?.countdownFrames;
  const secondsLeft = counting ? Math.ceil(r.countdownFrames / state.rate) : 0;
  const busy = ioBusy;
  const hasAudio = state.tracks.some(t => t.hasAudio);
  const anySolo = state.tracks.some(t => t.hasAudio && t.solo);
  $('#mic').textContent = micPending ? 'Conectando…' : stream ? 'Desactivar micrófono' : 'Activar micrófono';
  $('#mic').disabled = micPending || busy;
  $('#device').disabled = !stream || !!r || micPending || busy;
  $('#mic-status').textContent = stream ? 'Conectado · Entrada mono' : 'Desconectado';
  $('#monitor').disabled = !stream || busy;
  $('#play').textContent = state.playing ? 'Ⅱ Detener' : '▶ Reproducir';
  $('#play').disabled = !hasAudio || !!r || busy;
  $('#stop').disabled = (!state.playing && !r) || busy;
  $('#save').disabled = !hasAudio || !!r || busy;
  $('#export').disabled = !hasAudio || !!r || busy;
  $('#open').disabled = !!r || busy;
  $('#new').disabled = !!r || busy;
  $('#demo').disabled = !!r || busy;
  $('#undo').disabled = !state.canUndo || !!r || busy;
  $('#session-title').disabled = busy;
  $('#master').disabled = busy;
  $('#input-gain').disabled = busy;
  $('#compensation').disabled = !!r || busy;
  $('#cycles').disabled = busy;
  const t = time(r?.first ? r.written : state.length);
  $('#duration').textContent = t.main; $('#decimals').textContent = t.decimal;
  $('#loop-count').textContent = `${state.tracks.filter(t => t.hasAudio).length} / 6 PISTAS`;
  $('#cycle-length').textContent = state.length ? `${(state.rate / 1000).toFixed(1)} kHz · MONO` : 'MÁX. 2 MIN';
  $('#cycle-position').textContent = counting ? 'Preparación · Todavía no se está grabando' : r ? r.first ? 'Grabando el primer loop…' : r.armed ? 'Esperando el inicio de la vuelta…' : 'Grabando una vuelta completa…' : state.playing ? 'Todas las pistas comparten el mismo ciclo' : state.length ? 'Detenido · Listo para reproducir' : 'El primer loop define el ciclo';
  $('#instruction').textContent = counting ? r.first ? 'Prepará tu instrumento: la grabación empieza al terminar la cuenta.' : 'Después de la cuenta, entrás al inicio de la próxima vuelta.' : r ? r.first ? 'Volvé a pulsar la pista para cerrar el loop.' : r.armed ? 'Entrá a tocar cuando comience la próxima vuelta.' : 'La grabación termina sola al completar la vuelta.' : state.length ? 'Sumá otra capa o jugá con la mezcla.' : 'Activá el micrófono y grabá tu primer loop.';
  $('#transport-status').textContent = counting ? `EMPEZAMOS EN ${secondsLeft}` : r ? r.armed ? 'PISTA PREPARADA' : 'GRABANDO' : state.playing ? 'EN LOOP' : hasAudio ? 'SESIÓN EN PAUSA' : 'LISTO PARA CREAR';
  $('#transport-led').className = `led ${r && !r.armed && !counting ? 'recording' : state.playing || counting ? 'active' : ''}`;
  const progress = state.length ? state.position / state.length : r ? r.written / (state.rate * 120) : 0;
  $('#cycle-progress').style.width = `${progress * 100}%`;
  const live = stream ? state.inputPeak || 0 : 0;
  setMeter('input', live); setMeter('output', state.outputPeak || 0);
  for (let i = 0; i < 6; i++) {
    const track = state.tracks[i], c = cards[i], recording = r?.id === i;
    const inaudible = track.muted || (anySolo && !track.solo);
    c.card.classList.toggle('has-audio', track.hasAudio);
    c.card.classList.toggle('is-playing', state.playing);
    c.card.classList.toggle('is-recording', recording && !r.armed && !counting);
    c.card.classList.toggle('is-armed', recording && (r.armed || counting));
    c.card.classList.toggle('is-muted', track.hasAudio && inaudible);
    c.status.textContent = recording ? counting ? 'PREPARATE' : r.armed ? 'EN ESPERA' : 'GRABANDO' : track.hasAudio ? inaudible ? 'SILENCIADA' : state.playing ? 'EN LOOP' : 'LISTA' : 'VACÍA';
    c.recordLabel.textContent = recording ? !r.armed && !counting ? 'Cerrar loop' : 'Cancelar' : track.hasAudio ? track.muted ? 'Activar' : 'Silenciar' : i === 0 ? 'Grabar · 3 s' : 'Grabar';
    c.record.setAttribute('aria-label', `${c.recordLabel.textContent} pista ${i + 1}`);
    c.record.disabled = busy || micPending || (!!r && !recording);
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
  $('#session-title').value = data.title || 'Mi sesión';
  data.tracks.forEach((t, i) => { names[i] = t.name || `Loop ${i + 1}`; cards[i].name.value = names[i]; cards[i].volume.value = Math.round(t.volume * 100); cards[i].value.textContent = `${Math.round(t.volume * 100)}%`; });
  $('#master').value = Math.round(data.master * 100); $('#master-value').textContent = `${Math.round(data.master * 100)}%`;
}

$('#mic').addEventListener('click', () => stream ? disconnectMic() : connectMic());
$('#device').addEventListener('change', e => connectMic(e.target.value));
$('#monitor').addEventListener('change', e => send({ type: 'settings', monitor: e.target.checked }));
$('#play').addEventListener('click', togglePlay);
$('#stop').addEventListener('click', () => send({ type: 'stop' }));
$('#undo').addEventListener('click', () => send({ type: 'undo' }));
$('#input-gain').addEventListener('input', e => { $('#input-value').textContent = `${e.target.value}%`; send({ type: 'settings', inputGain: e.target.value / 100 }); });
$('#master').addEventListener('input', e => { $('#master-value').textContent = `${e.target.value}%`; send({ type: 'settings', master: e.target.value / 100 }); changed(); });
$('#compensation').addEventListener('change', e => { e.target.value = Math.max(0, Math.min(500, Number(e.target.value) || 0)); send({ type: 'settings', compensation: Number(e.target.value) }); });
$('#session-title').addEventListener('input', changed);
$('#save').addEventListener('click', () => withBusy(async () => {
  await ensureAudio(); const rev = revision; const data = await snapshot();
  download(encodeSession(data, $('#session-title').value, names), `${filename()}.seisloop`, 'application/octet-stream');
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
    notify('Sesión abierta. Pulsá Reproducir cuando quieras escucharla.');
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
  if (e.ctrlKey || e.altKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
  // Suppress native activation even when a Delete/Cancel button has keyboard focus.
  if (e.code === 'Space') e.preventDefault();
  if (e.repeat || ioBusy || $('#confirm').open) return;
  if (e.code === 'Space') handleSpace();
  if (/^[1-6]$/.test(e.key)) { e.preventDefault(); actTrack(Number(e.key) - 1); }
  if (e.code === 'Escape' && state.recording) { send({ type: 'cancel' }); }
});
document.addEventListener('keyup', e => {
  if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) e.preventDefault();
});
window.addEventListener('beforeunload', e => { if (dirty || state.recording) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('pagehide', () => { stream?.getTracks().forEach(t => t.stop()); ctx?.close(); });
navigator.mediaDevices?.addEventListener('devicechange', () => { if (stream) listMics().catch(() => {}); });
render();
if (!window.isSecureContext) notify('Para habilitar el micrófono, abrí https://emanuelmkt.com.ar/loop/ mediante HTTPS.', true);
