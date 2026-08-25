/**
 * FACIL AUTO — Estimador dinámico de seguro v1.5.21
 *
 * Modelo orientativo, no cotización.
 * Variables:
 * - valor estimado del vehículo
 * - cobertura
 * - riesgo de zona
 * - antigüedad
 *
 * RC tiene baja sensibilidad al valor del propio vehículo.
 * Terceros Completo y Todo Riesgo tienen mayor sensibilidad porque
 * incorporan coberturas ligadas al bien / suma asegurada.
 */
(() => {
  const COVERAGES = {
    'Responsabilidad Civil': {
      fixed: 40000,
      valueRate: 0.00070,
      lowFactor: 0.78,
      highFactor: 1.28
    },
    'Terceros completo': {
      fixed: 45000,
      valueRate: 0.00450,
      lowFactor: 0.78,
      highFactor: 1.28
    },
    'Todo Riesgo': {
      fixed: 55000,
      valueRate: 0.00650,
      lowFactor: 0.78,
      highFactor: 1.28
    }
  };

  const ZONE = {
    'very-unsafe': {factor:1.25, label:'muy insegura'},
    'unsafe': {factor:1.12, label:'insegura'},
    'normal': {factor:1.00, label:'normal'},
    'safe': {factor:0.92, label:'segura'},
    'very-safe': {factor:0.86, label:'muy segura'}
  };

  function parseARS(text) {
    const digits = String(text || '').replace(/[^\d]/g, '');
    const value = Number(digits);
    return Number.isFinite(value) && value > 0 ? value : NaN;
  }

  function fmtARS(value) {
    return new Intl.NumberFormat('es-AR', {
      style:'currency',
      currency:'ARS',
      maximumFractionDigits:0
    }).format(Math.round(value / 1000) * 1000);
  }

  function compactARS(value) {
    const rounded = Math.round(value / 1000) * 1000;
    return fmtARS(rounded);
  }

  function ageFactor() {
    const yearValue = document.getElementById('year')?.value || '';

    if (yearValue === '0km') return {factor:1.08, age:0};

    const year = Number(yearValue);
    if (!Number.isFinite(year)) return {factor:1, age:null};

    const age = Math.max(0, new Date().getFullYear() - year);

    if (age <= 2) return {factor:1.06, age};
    if (age <= 5) return {factor:1.03, age};
    if (age <= 10) return {factor:1.00, age};
    if (age <= 15) return {factor:0.98, age};
    return {factor:0.95, age};
  }

  function vehicleValue() {
    // Fuente principal: valuación ya calculada por app.js.
    const market = parseARS(document.getElementById('market-value')?.textContent);
    if (Number.isFinite(market)) return market;

    // Fallback: precio ingresado por el usuario.
    const operation = Number(document.getElementById('operation-price')?.value || 0);
    return Number.isFinite(operation) && operation > 0 ? operation : NaN;
  }

  function estimateCoverage(name, value, zoneKey) {
    const model = COVERAGES[name];
    if (!model || !Number.isFinite(value)) return null;

    const zone = ZONE[zoneKey] || ZONE.normal;
    const age = ageFactor();

    const central =
      (model.fixed + value * model.valueRate) *
      zone.factor *
      age.factor;

    return {
      name,
      central,
      low:central * model.lowFactor,
      high:central * model.highFactor,
      zone,
      age
    };
  }

  function rangeText(estimate) {
    if (!estimate) return '—';
    return `${compactARS(estimate.low)}–${compactARS(estimate.high)}`;
  }

  function optionFor(name) {
    return [...document.querySelectorAll('input[name="insurance"]')]
      .find(input => input.value === name);
  }

  function renderOption(estimate) {
    if (!estimate) return;

    const input = optionFor(estimate.name);
    if (!input) return;

    const small = input.closest('.insurance-option')?.querySelector('small');
    const range = rangeText(estimate);

    input.dataset.range = range;

    if (small) {
      small.textContent = `${range} / mes · estimado`;
    }
  }

  function selectedName() {
    return document.querySelector('input[name="insurance"]:checked')?.value ||
      'Terceros completo';
  }

  function availabilityNote(name, age) {
    if (name !== 'Todo Riesgo' || age === null || age <= 10) return '';

    return ' · Su disponibilidad puede estar limitada por antigüedad y política de suscripción.';
  }

  function renderPrimary(estimates, value, zoneKey) {
    const name = selectedName();
    const estimate = estimates[name];
    if (!estimate) return;

    const primaryName = document.getElementById('insurance-primary-name');
    const primaryValue = document.getElementById('insurance-primary-value');
    const intro = document.querySelector('.insurance-intro');

    if (primaryName) primaryName.textContent = name;
    if (primaryValue) primaryValue.textContent = rangeText(estimate);

    if (intro) {
      const zone = ZONE[zoneKey] || ZONE.normal;
      const ageNote = availabilityNote(name, estimate.age.age);

      intro.textContent =
        `Estimación mensual sobre un valor vehicular de ${fmtARS(value)}, ` +
        `ajustada para una zona ${zone.label}. El valor real depende de compañía, ` +
        `modelo, radicación, perfil del asegurado, franquicia y condiciones de suscripción` +
        `${ageNote}`;
    }
  }

  function recalculate() {
    const result = document.getElementById('resultados');
    if (!result || result.hidden) return;

    const value = vehicleValue();
    if (!Number.isFinite(value)) return;

    const zoneKey = document.getElementById('security-zone')?.value || 'normal';

    const estimates = Object.fromEntries(
      Object.keys(COVERAGES).map(name => [
        name,
        estimateCoverage(name, value, zoneKey)
      ])
    );

    Object.values(estimates).forEach(renderOption);
    renderPrimary(estimates, value, zoneKey);

    const strip = document.querySelector('.insurance-strip');
    if (strip) {
      strip.dataset.vehicleValue = String(Math.round(value));
      strip.dataset.zone = zoneKey;
      strip.dataset.dynamicInsurance = '1';
    }
  }

  function markInitialState() {
    const primaryValue = document.getElementById('insurance-primary-value');
    const intro = document.querySelector('.insurance-intro');

    if (primaryValue && document.getElementById('resultados')?.hidden) {
      primaryValue.textContent = '—';
    }

    document.querySelectorAll('input[name="insurance"]').forEach(input => {
      const small = input.closest('.insurance-option')?.querySelector('small');
      if (small && document.getElementById('resultados')?.hidden) {
        small.textContent = 'Se estima al calcular el vehículo';
      }
    });

    if (intro && document.getElementById('resultados')?.hidden) {
      intro.textContent =
        'La estimación se calcula con el valor del vehículo, la cobertura elegida, ' +
        'la antigüedad y el nivel de seguridad de tu zona.';
    }
  }

  function install() {
    markInitialState();

    const form = document.getElementById('vehicle-form');

    // app.js registró su submit antes que este script.
    // Cuando este listener corre, la valuación ya está escrita en #market-value.
    form?.addEventListener('submit', () => {
      window.setTimeout(recalculate, 0);
    });

    document.querySelectorAll('input[name="insurance"]').forEach(input => {
      input.addEventListener('change', recalculate);
    });

    document.getElementById('security-zone')?.addEventListener('change', recalculate);
    document.getElementById('year')?.addEventListener('change', () => {
      if (!document.getElementById('resultados')?.hidden) recalculate();
    });

    const marketValue = document.getElementById('market-value');
    if (marketValue) {
      new MutationObserver(() => {
        if (!document.getElementById('resultados')?.hidden) {
          queueMicrotask(recalculate);
        }
      }).observe(marketValue, {
        childList:true,
        subtree:true,
        characterData:true
      });
    }

    window.FACIL_AUTO_INSURANCE = Object.freeze({
      recalculate,
      version:'1.5.21'
    });
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', install, {once:true})
    : install();
})();
