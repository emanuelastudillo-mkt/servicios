// Keep the native range as the only focusable/accessible control. The housing
// adds rotary visuals and vertical dragging without changing audio semantics.
const knobs = new Map();
export function quantizeKnob(value, min, max, step = 1) {
  const snapped = min + Math.round((value - min) / step) * step;
  return Math.max(min, Math.min(max, Number(snapped.toFixed(6))));
}
export function enhanceKnob(input) {
  if (knobs.has(input)) return;
  const housing = document.createElement('span'); housing.className = 'rotary';
  input.before(housing); housing.append(input);
  housing.insertAdjacentHTML('beforeend', '<span class="rotary-face" aria-hidden="true"></span><span class="rotary-pointer" aria-hidden="true"></span>');
  const initial = Number(input.defaultValue), min = Number(input.min), max = Number(input.max), step = Number(input.step) || 1;
  let drag = null;
  const update = () => {
    const unit = input.dataset.unit ?? '%', format = value => `${value}${unit === '%' ? '' : ' '}${unit}`;
    const ratio = Math.max(0, Math.min(1, (Number(input.value) - min) / (max - min)));
    housing.style.setProperty('--rotation', (-135 + 270 * ratio) + 'deg');
    housing.style.setProperty('--sweep', (270 * ratio) + 'deg');
    housing.classList.toggle('disabled', input.disabled);
    input.setAttribute('aria-valuetext', format(input.value));
    housing.title = `${input.getAttribute('aria-label')}: ${format(input.value)} · Arrastrá arriba/abajo · Flechas para ajustar · Doble clic: ${format(initial)}`;
  };
  const set = value => {
    if (input.disabled) return;
    const next = String(quantizeKnob(value, min, max, step));
    if (input.value !== next) { input.value = next; input.dispatchEvent(new Event('input', { bubbles: true })); }
    update();
  };
  input.addEventListener('input', update);
  input.addEventListener('pointerdown', event => {
    if (input.disabled || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault(); input.focus({ preventScroll: true });
    drag = { id: event.pointerId, y: event.clientY, x: event.clientX, value: Number(input.value) };
    input.setPointerCapture(event.pointerId); housing.classList.add('dragging');
  });
  input.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    event.preventDefault();
    const movement = drag.y - event.clientY + (event.clientX - drag.x) * .35;
    drag.value = Math.max(min, Math.min(max, drag.value + movement * (max - min) / 140 * (event.shiftKey ? .1 : 1)));
    drag.x = event.clientX; drag.y = event.clientY;
    set(drag.value);
  });
  const finish = event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null; housing.classList.remove('dragging');
    if (input.hasPointerCapture(event.pointerId)) input.releasePointerCapture(event.pointerId);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  input.addEventListener('pointerup', finish);
  input.addEventListener('pointercancel', finish);
  input.addEventListener('lostpointercapture', finish);
  input.addEventListener('dblclick', event => { event.preventDefault(); set(initial); });
  input.addEventListener('wheel', event => {
    if (document.activeElement !== input || input.disabled) return;
    event.preventDefault(); set(Number(input.value) - Math.sign(event.deltaY) * step);
  }, { passive: false });
  knobs.set(input, update); update();
}
export function refreshKnobs() { for (const [input, update] of knobs) { if (input.isConnected) update(); else knobs.delete(input); } }
