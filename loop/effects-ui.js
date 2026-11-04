import { EFFECTS, EFFECT_ORDER, pedal, effectsConfig } from './effects.js?v=1.8.1';
import { enhanceKnob, refreshKnobs } from './knobs.js?v=1.8.1';
import { detectPitch } from './tuner.js?v=1.8.1';

export function createEffectsUI(hooks) {
  let id = 0, config = effectsConfig(), tunerTimer, tunerNode, tunerSlot;
  const dialog = document.createElement('dialog'); dialog.id = 'effects-dialog'; dialog.setAttribute('aria-labelledby', 'fx-title');
  dialog.innerHTML = `<div class="dialog-heading"><h2 id="fx-title">Pedalera</h2><button id="fx-close" aria-label="Cerrar pedalera">×</button></div>
    <p class="fx-description">Efectos editables · El audio original se conserva · Señal de izquierda a derecha</p>
    <div class="fx-live"><button id="fx-record">Grabar</button><button id="fx-play">Reproducir</button><button id="fx-connect">Conectar entrada</button><label><input id="fx-listen" type="checkbox"> Escuchar con efectos</label><button id="fx-tuner">Afinador</button><span id="fx-source"></span></div>
    <p class="fx-listen-note">Usá auriculares. La escucha tiene la latencia de tu entrada y de los efectos; activar Direct Monitor en la placa también deja oír la señal seca.</p>
    <div id="fx-native" hidden><label for="native-monitor-output">Salida de escucha nativa</label> <select id="native-monitor-output" aria-label="Salida de escucha nativa"></select><p id="native-monitor-status"></p><p>Para oír solo los efectos, apagá Direct Monitor en la placa. Elegí la misma placa en la salida de reproducción superior para escuchar también los loops. Pitch, vibrato y otros efectos pueden agregar su propio retardo.</p></div>
    <div class="fx-toolbar"><label for="fx-add-select">Agregar pedal</label><select id="fx-add-select"></select><button id="fx-add">＋ Agregar</button><button id="fx-bypass" aria-pressed="false">Bypass de la cadena</button></div>
    <div id="fx-pedals" class="fx-pedals"></div><p id="fx-empty">Elegí tu primer pedal. Podés combinarlos, ordenarlos y apagarlos sin cambiar la toma.</p>
    <p class="fx-footnote">Volumen y wah: enfocá su perilla y usá ← →, Home y End. Doble clic restaura el valor inicial. Los ecos siguen entre vueltas; Detener todo corta las colas.</p>`;
  const tuner = document.createElement('dialog'); tuner.id = 'tuner-dialog'; tuner.setAttribute('aria-labelledby', 'tuner-title');
  tuner.innerHTML = `<div class="dialog-heading"><h2 id="tuner-title">Afinador · La 440 Hz</h2><button id="tuner-close" aria-label="Cerrar afinador">×</button></div><p>Salida de SEIS silenciada mientras afinás. Tocá una sola cuerda y dejala sonar.</p><div class="tuner-screen"><strong id="tuner-note">—</strong><output id="tuner-reading">Esperando señal…</output><div class="tuner-scale"><span>♭</span><i id="tuner-needle"></i><b>│</b><span>♯</span></div></div><p id="tuner-status" role="status"></p>`;
  document.body.append(dialog, tuner);
  const $ = s => dialog.querySelector(s), tq = s => tuner.querySelector(s);
  const commit = () => { config = effectsConfig(config); hooks.change(id, config); };
  function draw() {
    $('#fx-title').textContent = `Pedalera · ${hooks.name(id)}`;
    $('#fx-bypass').setAttribute('aria-pressed', String(config.bypass));
    $('#fx-bypass').textContent = config.bypass ? 'Bypass activo · sonido original' : 'Bypass de la cadena';
    const select = $('#fx-add-select'); select.replaceChildren();
    const groups = new Map();
    for (const type of EFFECT_ORDER) {
      if (config.pedals.some(p => p.type === type)) continue;
      const def = EFFECTS[type];
      if (!groups.has(def.group)) { const group = document.createElement('optgroup'); group.label = def.group; groups.set(def.group, group); select.append(group); }
      groups.get(def.group).append(new Option(def.name, type));
    }
    $('#fx-add').disabled = !select.options.length; select.disabled = !select.options.length;
    const board = $('#fx-pedals'); board.replaceChildren(); $('#fx-empty').hidden = config.pedals.length > 0;
    for (const [index, item] of config.pedals.entries()) {
      const def = EFFECTS[item.type], box = document.createElement('section'); box.className = 'fx-pedal'; box.dataset.effect = item.type;
      box.setAttribute('aria-label', def.name); box.classList.toggle('is-on', item.enabled && !config.bypass);
      const title = document.createElement('h3'); title.textContent = `${index + 1}. ${def.name}`;
      const description = document.createElement('p'); description.textContent = def.info;
      const knobs = document.createElement('div'); knobs.className = 'fx-knobs';
      for (const [key, spec] of Object.entries(def.params)) {
        const label = document.createElement('label'); label.className = 'fx-knob';
        const text = document.createElement('span'); text.textContent = spec.label;
        const input = document.createElement('input'); input.type = 'range'; input.min = spec.min; input.max = spec.max; input.step = spec.step; input.defaultValue = spec.value; input.value = item.params[key]; input.dataset.unit = spec.unit;
        input.setAttribute('aria-label', `${def.name} · ${spec.label}`);
        const output = document.createElement('output'); const update = () => { output.textContent = `${input.value} ${spec.unit}`; };
        input.addEventListener('input', () => { config.pedals[index].params[key] = Number(input.value); update(); commit(); });
        update(); label.append(text, input, output); knobs.append(label);
      }
      const actions = document.createElement('div'); actions.className = 'fx-pedal-actions';
      const toggle = document.createElement('button'); toggle.className = 'fx-switch'; toggle.textContent = item.enabled ? '● Encendido' : '○ Apagado'; toggle.setAttribute('aria-label', `${item.enabled ? 'Apagar' : 'Encender'} ${def.name}`); toggle.setAttribute('aria-pressed', String(item.enabled));
      toggle.onclick = () => { config.pedals[index].enabled = !config.pedals[index].enabled; commit(); draw(); $('#fx-pedals').querySelectorAll('.fx-switch')[index].focus(); };
      actions.append(toggle);
      for (const [direction, name] of [[-1,'Antes'],[1,'Después']]) {
        const button = document.createElement('button'); button.textContent = direction < 0 ? '←' : '→'; button.setAttribute('aria-label', `${name}: ${def.name}`);
        button.disabled = index + direction < 0 || index + direction >= config.pedals.length;
        button.onclick = () => { const next = index + direction; [config.pedals[index], config.pedals[next]] = [config.pedals[next], config.pedals[index]]; commit(); draw(); $('#fx-pedals').querySelectorAll('.fx-switch')[next].focus(); };
        actions.append(button);
      }
      const remove = document.createElement('button'); remove.textContent = 'Quitar'; remove.setAttribute('aria-label', `Quitar ${def.name}`); remove.onclick = () => { config.pedals.splice(index, 1); commit(); draw(); $('#fx-add-select').focus(); };
      actions.append(remove); box.append(title, description, knobs, actions); board.append(box);
      box.querySelectorAll('input[type=range]').forEach(enhanceKnob);
    }
    refreshKnobs(); sync();
  }
  function sync() {
    if (!dialog.open) return;
    const state = hooks.status(id);
    $('#fx-record').textContent = state.recordLabel; $('#fx-record').disabled = state.recordDisabled;
    $('#fx-play').textContent = state.playLabel; $('#fx-play').disabled = state.playDisabled;
    $('#fx-connect').disabled = state.connectDisabled; $('#fx-connect').textContent = state.connected ? 'Entrada conectada' : 'Conectar entrada';
    $('#fx-source').textContent = state.source;
    $('#fx-listen').checked = state.listening; $('#fx-listen').disabled = state.listenDisabled;
    $('#fx-tuner').disabled = !state.connected || state.tunerDisabled;
    const native = hooks.native?.(); $('#fx-native').hidden = !native?.available;
    if (native?.available) {
      const output = $('#native-monitor-output'), key = JSON.stringify(native.outputs);
      if (output.dataset.options !== key) { output.replaceChildren(new Option('Salida predeterminada de Windows', '')); for (const device of native.outputs) output.append(new Option(device.label, device.id)); output.dataset.options = key; }
      output.value = native.outputId; output.disabled = state.tunerDisabled;
      $('#native-monitor-status').textContent = native.description;
    }
  }
  $('#fx-close').onclick = () => dialog.close();
  $('#fx-add').onclick = () => { const type = $('#fx-add-select').value; if (!type) return; config.pedals.push(pedal(type)); commit(); draw(); $('#fx-pedals').querySelectorAll('.fx-switch')[config.pedals.length - 1].focus(); };
  $('#fx-bypass').onclick = () => { config.bypass = !config.bypass; commit(); draw(); };
  $('#fx-record').onclick = () => hooks.record(id);
  $('#fx-play').onclick = () => hooks.play();
  $('#fx-connect').onclick = () => hooks.connect(id);
  $('#fx-listen').onchange = e => hooks.listen(e.target.checked ? id : -1);
  $('#native-monitor-output').onchange = e => hooks.nativeOutput(e.target.value);
  dialog.addEventListener('keydown', e => {
    if (e.code !== 'Space' || e.ctrlKey || e.altKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || tuner.open) return;
    e.preventDefault(); e.stopPropagation();
    if (!e.repeat) hooks.space(id);
  });
  dialog.addEventListener('keyup', e => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) e.preventDefault(); });
  $('#fx-tuner').onclick = () => {
    const slot = hooks.slot(id); if (!slot || hooks.status(id).tunerDisabled) return;
    tunerSlot = slot; tunerNode = slot.ctx.createAnalyser(); tunerNode.fftSize = 8192;
    slot.gain.connect(tunerNode); const samples = new Float32Array(tunerNode.fftSize);
    hooks.tuning(true); tuner.showModal();
    const tick = () => {
      if (hooks.slot(id) !== tunerSlot) { tq('#tuner-note').textContent = '—'; tq('#tuner-reading').textContent = 'Sin entrada'; tq('#tuner-status').textContent = 'Se desconectó la entrada. Cerrá el afinador y volvé a conectarla.'; return; }
      if (slot.ctx.state !== 'running') { tq('#tuner-note').textContent = '—'; tq('#tuner-reading').textContent = 'Audio pausado'; tq('#tuner-status').textContent = 'Cerrá el afinador y usá Revisar audio → Reactivar audio.'; tuner.classList.remove('in-tune'); return; }
      tunerNode.getFloatTimeDomainData(samples); const pitch = detectPitch(samples, slot.ctx.sampleRate);
      tq('#tuner-note').textContent = pitch?.name || '—';
      tq('#tuner-reading').textContent = pitch ? `${pitch.hz.toFixed(1)} Hz · ${pitch.cents >= 0 ? '+' : ''}${pitch.cents.toFixed(1)} cents` : 'Esperando una nota estable…';
      tq('#tuner-needle').style.left = `${50 + Math.max(-50, Math.min(50, pitch?.cents || 0))}%`;
      tuner.classList.toggle('in-tune', !!pitch && Math.abs(pitch.cents) < 5);
      tq('#tuner-status').textContent = pitch ? Math.abs(pitch.cents) < 5 ? 'Afinada' : pitch.cents < 0 ? 'Subí un poco la afinación' : 'Bajá un poco la afinación' : 'Una cuerda por vez · Rango aproximado: 45–1200 Hz';
    };
    tick(); tunerTimer = setInterval(tick, 120);
  };
  function closeTuner() {
    clearInterval(tunerTimer); tunerTimer = null;
    if (tunerNode) { try { tunerSlot.gain.disconnect(tunerNode); } catch {} tunerNode.disconnect(); }
    tunerNode = tunerSlot = null; hooks.tuning(false);
  }
  tq('#tuner-close').onclick = () => tuner.close(); tuner.addEventListener('close', closeTuner);
  window.addEventListener('pagehide', () => { if (tunerNode) closeTuner(); });
  return { sync, open(trackId) { id = trackId; config = effectsConfig(hooks.config(id)); dialog.showModal(); draw(); } };
}
