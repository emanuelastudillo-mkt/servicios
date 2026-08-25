/**
 * FACIL AUTO — Borrador persistente de consulta v1.5.20
 *
 * Conserva los datos del formulario durante el login con Google y los
 * reconstruye al regresar, incluyendo selects dependientes.
 */
(() => {
  const STORAGE_KEY = 'facilauto_consultation_draft_v1';
  const MAX_AGE_MS = 24 * 60 * 60 * 1000;

  const FIELD_IDS = [
    'brand','model','variant','year','km','operation-price',
    'down-payment','term','buyer-type','security-zone',
    'jurisdiction','fx-rate'
  ];

  const DIRECT_FIELDS = [
    'km','operation-price','down-payment','term','buyer-type',
    'security-zone','jurisdiction','fx-rate'
  ];

  let restoreRunning = false;
  let pendingCalculation = false;
  let saveTimer = 0;

  function form() {
    return document.getElementById('vehicle-form');
  }

  function meaningful(values) {
    return Boolean(
      values.brand ||
      values.model ||
      values.variant ||
      values.year ||
      values.km ||
      values['operation-price'] ||
      values['down-payment']
    );
  }

  function currentContext() {
    try {
      const params = new URLSearchParams(location.search);
      const shareUrl = params.get('share_url');

      if (params.get('embed') === '1' && shareUrl) {
        return new URL(shareUrl, location.href).pathname;
      }
    } catch (_) {}

    return location.pathname;
  }

  function snapshot() {
    const vehicleForm = form();
    if (!vehicleForm) return;

    const values = {};

    FIELD_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      values[id] = String(el.value ?? '');
    });

    if (!meaningful(values)) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version:1,
        updated_at:Date.now(),
        context:currentContext(),
        values
      }));
    } catch (_) {}
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(snapshot, 100);
  }

  function readDraft() {
    let draft;

    try {
      draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (_) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    if (!draft || !draft.values || !draft.updated_at) return null;

    if ((Date.now() - Number(draft.updated_at)) > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return meaningful(draft.values) ? draft : null;
  }

  function clearDraft() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  function optionExists(el, value) {
    if (!el || value === undefined || value === null || value === '') return false;
    return [...el.options].some(option => option.value === String(value));
  }

  function waitFor(test, timeout = 12000, interval = 60) {
    return new Promise(resolve => {
      const started = Date.now();

      const tick = () => {
        let ok = false;
        try { ok = Boolean(test()); } catch (_) {}

        if (ok) return resolve(true);
        if ((Date.now() - started) >= timeout) return resolve(false);

        window.setTimeout(tick, interval);
      };

      tick();
    });
  }

  function dispatchChange(el) {
    if (el) el.dispatchEvent(new Event('change', {bubbles:true}));
  }

  function fieldIsAllowed(el) {
    if (!el) return false;
    const label = el.closest('label');
    if (label?.classList.contains('fa-context-hidden')) return false;
    if (el.closest('.fa-context-hidden')) return false;
    return true;
  }

  function showRestoredNotice() {
    document.querySelector('.fa-draft-restored')?.remove();

    const notice = document.createElement('div');
    notice.className = 'fa-draft-restored';
    notice.setAttribute('role', 'status');
    notice.textContent = 'Recuperamos los datos de tu consulta.';

    Object.assign(notice.style, {
      position:'fixed',
      left:'50%',
      bottom:'84px',
      transform:'translateX(-50%)',
      zIndex:'10050',
      maxWidth:'calc(100vw - 28px)',
      padding:'10px 13px',
      background:'#121212',
      color:'#fff',
      border:'1px solid rgba(255,255,255,.18)',
      boxShadow:'0 8px 24px rgba(0,0,0,.16)',
      font:'700 9px/1.35 Arial,sans-serif',
      letterSpacing:'.055em',
      textTransform:'uppercase',
      textAlign:'center',
      pointerEvents:'none'
    });

    document.body.appendChild(notice);

    window.setTimeout(() => {
      notice.style.opacity = '0';
      notice.style.transition = 'opacity .22s ease';
      window.setTimeout(() => notice.remove(), 240);
    }, 2400);
  }

  async function restoreDraft() {
    if (restoreRunning || !form()) return;
    restoreRunning = true;

    try {
      const draft = readDraft();
      if (!draft) return;

      const values = draft.values || {};
      let restoredSomething = false;

      // Reconstrucción ordenada: marca > modelo > versión > año.
      const brand = document.getElementById('brand');

      if (values.brand) {
        const ready = await waitFor(
          () => !brand?.disabled && optionExists(brand, values.brand)
        );

        if (ready) {
          brand.value = values.brand;
          dispatchChange(brand);
          restoredSomething = true;
        }
      }

      const model = document.getElementById('model');

      if (values.model && brand?.value === values.brand) {
        const ready = await waitFor(
          () => !model?.disabled && optionExists(model, values.model),
          5000
        );

        if (ready) {
          model.value = values.model;
          dispatchChange(model);
          restoredSomething = true;
        }
      }

      const variant = document.getElementById('variant');

      if (values.variant && model?.value === values.model) {
        const ready = await waitFor(
          () => !variant?.disabled && optionExists(variant, values.variant),
          5000
        );

        if (ready) {
          variant.value = values.variant;
          dispatchChange(variant);
          restoredSomething = true;
        }
      }

      const year = document.getElementById('year');

      if (values.year && variant?.value === values.variant) {
        const ready = await waitFor(
          () => !year?.disabled && optionExists(year, values.year),
          5000
        );

        if (ready) {
          year.value = values.year;
          dispatchChange(year);
          restoredSomething = true;
        }
      }

      DIRECT_FIELDS.forEach(id => {
        const el = document.getElementById(id);
        const saved = values[id];

        if (!fieldIsAllowed(el) || saved === undefined || saved === null || saved === '') {
          return;
        }

        if (el.tagName === 'SELECT' && !optionExists(el, saved)) return;

        el.value = saved;
        dispatchChange(el);
        restoredSomething = true;
      });

      if (restoredSomething) {
        snapshot();
        showRestoredNotice();
      }
    } finally {
      restoreRunning = false;
    }
  }

  function installAutosave() {
    const vehicleForm = form();
    if (!vehicleForm) return;

    vehicleForm.addEventListener('input', scheduleSave, true);
    vehicleForm.addEventListener('change', scheduleSave, true);

    // Solo llega hasta acá un submit autorizado por el gate.
    vehicleForm.addEventListener('submit', () => {
      pendingCalculation = true;
      snapshot();
    });

    // También cubre "Ingresar" desde el header.
    window.addEventListener('pagehide', snapshot);
    window.addEventListener('beforeunload', snapshot);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') snapshot();
    });

    const results = document.getElementById('resultados');

    if (results) {
      const maybeClear = () => {
        if (pendingCalculation && !results.hidden) {
          pendingCalculation = false;
          clearDraft();
        }
      };

      new MutationObserver(maybeClear).observe(results, {
        attributes:true,
        attributeFilter:['hidden'],
        childList:true,
        subtree:true
      });

      maybeClear();
    }
  }

  function init() {
    if (!form()) return;

    installAutosave();
    window.setTimeout(restoreDraft, 0);

    window.FACIL_AUTO_DRAFT = Object.freeze({
      save:snapshot,
      restore:restoreDraft,
      clear:clearDraft
    });
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init, {once:true})
    : init();
})();
