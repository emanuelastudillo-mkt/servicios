/**
 * FACIL AUTO — Contextual consultation profiles v1.5.6
 *
 * Las landings SEO usan la misma calculadora, pero solicitan y muestran
 * solamente los datos/resultados necesarios para la intención de esa URL.
 */
(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('embed') !== '1') return;

  const shareUrl = params.get('share_url') || '';
  let slug = '';

  try {
    slug = new URL(shareUrl, location.href)
      .pathname
      .split('/')
      .filter(Boolean)
      .pop() || '';
  } catch (_) {}

  const groups = {
    valuation: new Set([
      'cuanto-vale-mi-auto',
      'valor-de-mi-auto',
      'tasar-mi-auto',
      'tasacion-auto-usado',
      'precio-auto-usado',
      'cuanto-pedir-por-mi-auto',
      'quiero-vender-mi-auto',
      'valor-auto-por-kilometraje',
      'cuanto-baja-un-auto-por-kilometraje',
      'depreciacion-auto-usado',
      'valor-auto-con-100000-km',
      'valor-auto-con-200000-km',
      'valor-auto-con-300000-km'
    ]),

    compare: new Set([
      'quiero-comprar-un-auto',
      'este-auto-esta-caro',
      'precio-justo-auto-usado',
      'cuanto-ofrecer-por-un-auto'
    ]),

    transfer: new Set([
      'calcular-transferencia-auto',
      'cuanto-cuesta-transferir-un-auto',
      'costo-transferencia-auto',
      'gastos-transferencia-auto',
      'transferencia-auto-usado',
      'sellado-transferencia-auto'
    ]),

    close: new Set([
      'cuanto-necesito-para-comprar-un-auto',
      'gastos-comprar-auto-usado',
      'costo-real-de-un-auto-usado',
      'precio-auto-mas-transferencia',
      'cuanto-necesito-para-transferir-y-comprar'
    ]),

    full: new Set([
      'calculadora-auto-usado',
      'calculadora-vehicular',
      'calculadora-autos-argentina'
    ]),

    finance: new Set([
      'bancos-para-comprar-auto',
      'financiacion-auto-bancos',
      'prestamos-para-comprar-auto'
    ])
  };

  const PROFILES = {
    valuation: {
      showKm: true,
      fields: [],
      results: ['valuation'],
      opportunity: false,
      vehicleHelp: 'Seleccioná el vehículo y su kilometraje. Con eso alcanza para estimar su valor.',
      operationTitle: '',
      operationHelp: ''
    },

    compare: {
      showKm: true,
      fields: ['operation-price'],
      requiredOperationPrice: true,
      results: ['valuation'],
      opportunity: true,
      vehicleHelp: 'Identificá el vehículo y sus kilómetros para construir una referencia comparable.',
      operationTitle: 'Precio a comparar',
      operationHelp: 'Ingresá cuánto te piden por el auto para compararlo con la referencia estimada.'
    },

    buySell: {
      showKm: true,
      fields: ['operation-price'],
      requiredOperationPrice: false,
      results: ['valuation'],
      opportunity: true,
      vehicleHelp: 'Identificá el vehículo. Si estás comprando, podés sumar el precio publicado para compararlo.',
      operationTitle: 'Precio de la operación',
      operationHelp: 'Opcional si querés solamente valuar. Ingresalo para analizar una compra.'
    },

    transfer: {
      showKm: false,
      fields: ['operation-price', 'buyer-type', 'jurisdiction'],
      requiredOperationPrice: true,
      results: ['transfer'],
      opportunity: false,
      vehicleHelp: 'Para estimar la transferencia necesitamos identificar vehículo y año. El kilometraje no interviene en este cálculo.',
      operationTitle: 'Datos de transferencia',
      operationHelp: 'Precio de la operación, tipo de comprador y jurisdicción.'
    },

    transferPba: {
      showKm: false,
      fields: ['operation-price', 'buyer-type'],
      requiredOperationPrice: true,
      presetJurisdiction: 'pba',
      results: ['transfer'],
      opportunity: false,
      vehicleHelp: 'La jurisdicción ya está definida como Provincia de Buenos Aires. Solo identificá el vehículo.',
      operationTitle: 'Transferencia en PBA',
      operationHelp: 'Ingresá precio y tipo de comprador. Provincia de Buenos Aires ya está seleccionada.'
    },

    transferCaba: {
      showKm: false,
      fields: ['operation-price', 'buyer-type'],
      requiredOperationPrice: true,
      presetJurisdiction: 'other',
      results: ['transfer'],
      opportunity: false,
      vehicleHelp: 'Identificá el vehículo. La página usa los conceptos disponibles actualmente para operaciones fuera de PBA.',
      operationTitle: 'Transferencia en CABA',
      operationHelp: 'Ingresá precio y tipo de comprador. Los conceptos no parametrizados específicamente se informan como tales.'
    },

    registry: {
      showKm: false,
      fields: ['operation-price', 'buyer-type'],
      requiredOperationPrice: true,
      results: ['transfer'],
      opportunity: false,
      vehicleHelp: 'Para el gasto registral necesitamos identificar el vehículo y el año.',
      operationTitle: 'Datos registrales',
      operationHelp: 'Ingresá precio y tipo de comprador.'
    },

    close: {
      showKm: false,
      fields: ['operation-price', 'buyer-type', 'jurisdiction'],
      requiredOperationPrice: true,
      results: ['close', 'transfer'],
      opportunity: false,
      vehicleHelp: 'Identificá el vehículo para calcular los gastos asociados a la compra.',
      operationTitle: 'Precio de compra',
      operationHelp: 'Con precio, comprador y jurisdicción calculamos el cierre de la operación.'
    },

    finance: {
      showKm: false,
      fields: ['operation-price', 'down-payment', 'term'],
      requiredOperationPrice: true,
      results: ['finance'],
      opportunity: false,
      vehicleHelp: 'Seleccioná el vehículo. El kilometraje no es necesario para comparar financiación.',
      operationTitle: 'Financiación',
      operationHelp: 'Ingresá precio, anticipo y plazo para comparar las alternativas bancarias.'
    },

    zone: {
      showKm: false,
      fields: ['security-zone'],
      results: ['insurance'],
      opportunity: false,
      vehicleHelp: 'Identificá el vehículo. Para esta consulta no necesitamos precio, financiación ni transferencia.',
      operationTitle: 'Seguridad de la zona',
      operationHelp: 'Seleccioná el nivel de seguridad que mejor representa tu zona.'
    },

    zoneUnsafe: {
      showKm: false,
      fields: [],
      presetSecurity: 'unsafe',
      results: ['insurance'],
      opportunity: false,
      vehicleHelp: 'La zona ya está precargada como insegura. Solo identificá el vehículo.',
      operationTitle: '',
      operationHelp: ''
    },

    zoneSafe: {
      showKm: false,
      fields: [],
      presetSecurity: 'safe',
      results: ['insurance'],
      opportunity: false,
      vehicleHelp: 'La zona ya está precargada como segura. Solo identificá el vehículo.',
      operationTitle: '',
      operationHelp: ''
    },

    valuationTransfer: {
      showKm: true,
      fields: ['operation-price', 'buyer-type', 'jurisdiction'],
      requiredOperationPrice: true,
      results: ['valuation', 'transfer'],
      opportunity: false,
      vehicleHelp: 'El kilometraje se usa para la valuación; vehículo y año también permiten calcular la transferencia.',
      operationTitle: 'Datos de transferencia',
      operationHelp: 'Ingresá precio, comprador y jurisdicción para completar ambos cálculos.'
    },

    full: {
      showKm: true,
      fields: [
        'operation-price',
        'down-payment',
        'term',
        'buyer-type',
        'security-zone',
        'jurisdiction',
        'fx-rate'
      ],
      requiredOperationPrice: false,
      results: ['valuation', 'transfer', 'close', 'finance', 'insurance'],
      opportunity: true,
      vehicleHelp: 'Completá los datos del vehículo y luego configurá la operación.',
      operationTitle: 'Operación',
      operationHelp: 'Precio, financiación, comprador, zona y supuestos disponibles.'
    }
  };

  function profileForSlug(value) {
    if (groups.valuation.has(value)) return PROFILES.valuation;
    if (groups.compare.has(value)) return PROFILES.compare;
    if (groups.transfer.has(value)) return PROFILES.transfer;
    if (groups.close.has(value)) return PROFILES.close;
    if (groups.finance.has(value)) return PROFILES.finance;
    if (groups.full.has(value)) return PROFILES.full;

    if (value === 'transferencia-auto-provincia-buenos-aires') return PROFILES.transferPba;
    if (value === 'transferencia-auto-caba') return PROFILES.transferCaba;
    if (value === 'registro-transferencia-auto') return PROFILES.registry;
    if (value === 'valuacion-y-transferencia-auto') return PROFILES.valuationTransfer;
    if (value === 'comprar-o-vender-auto-usado') return PROFILES.buySell;
    if (value === 'valor-auto-segun-zona') return PROFILES.zone;
    if (value === 'valor-auto-zona-insegura') return PROFILES.zoneUnsafe;
    if (value === 'valor-auto-zona-segura') return PROFILES.zoneSafe;

    return PROFILES.full;
  }

  const profile = profileForSlug(slug);
  window.FACIL_AUTO_CONTEXT = {slug, profile};

  const style = document.createElement('style');
  style.id = 'fa-context-style';
  style.textContent = `
    .fa-context-hidden{display:none!important}
    body.fa-contextual-form .operation-fields{
      grid-template-columns:repeat(auto-fit,minmax(180px,1fr))!important;
    }
    body.fa-contextual-form .fa-context-required>span:first-child::after{
      content:" · obligatorio";
      color:var(--accent,#e94f32);
      font-size:8px;
      letter-spacing:.04em;
    }
    body.fa-contextual-form .fa-context-profile{
      margin:10px 0 0;
      font-size:10px;
      color:#9e9d96;
      line-height:1.5;
    }
    body.fa-contextual-form .result-strips:has(> .result-strip:not(.fa-context-hidden):only-child){
      max-width:100%;
    }
  `;
  document.head.appendChild(style);
  document.body.classList.add('fa-contextual-form');

  function labelFor(id) {
    return document.getElementById(id)?.closest('label') || null;
  }

  function setFieldVisible(id, visible) {
    const label = labelFor(id);
    if (!label) return;

    label.classList.toggle('fa-context-hidden', !visible);

    const input = document.getElementById(id);
    if (!visible && input) input.required = false;
  }

  function applyFields() {
    const all = [
      'operation-price',
      'down-payment',
      'term',
      'buyer-type',
      'security-zone',
      'jurisdiction',
      'fx-rate'
    ];

    const visible = new Set(profile.fields || []);
    all.forEach(id => setFieldVisible(id, visible.has(id)));

    const kmLabel = labelFor('km');
    if (kmLabel) kmLabel.classList.toggle('fa-context-hidden', !profile.showKm);

    const op = document.getElementById('operation-price');
    if (op) {
      op.required = Boolean(profile.requiredOperationPrice);
      op.closest('label')?.classList.toggle(
        'fa-context-required',
        Boolean(profile.requiredOperationPrice)
      );
    }

    const settings = document.querySelector('.settings');
    if (settings) {
      const hasSettings =
        visible.has('jurisdiction') ||
        visible.has('fx-rate');

      settings.classList.toggle('fa-context-hidden', !hasSettings);

      if (hasSettings) settings.open = true;
    }

    const operationBlock = document.querySelector('.operation-block');
    const hasOperation = (profile.fields || []).length > 0;

    if (operationBlock) {
      operationBlock.classList.toggle('fa-context-hidden', !hasOperation);

      if (hasOperation) {
        const title = operationBlock.querySelector('.block-head span');
        const help = operationBlock.querySelector('.block-head small');

        if (title && profile.operationTitle) {
          title.textContent = profile.operationTitle;
        }
        if (help && profile.operationHelp) {
          help.textContent = profile.operationHelp;
        }
      }
    }

    const vehicleHelp = document.querySelector(
      '.calc-block:not(.operation-block) .block-head small'
    );

    if (vehicleHelp && profile.vehicleHelp) {
      vehicleHelp.textContent = profile.vehicleHelp;
    }

    if (profile.presetJurisdiction) {
      const el = document.getElementById('jurisdiction');
      if (el) el.value = profile.presetJurisdiction;
    }

    if (profile.presetSecurity) {
      const el = document.getElementById('security-zone');
      if (el) el.value = profile.presetSecurity;
    }
  }

  function applyResults() {
    const selectorMap = {
      valuation: '.valuation-strip',
      transfer: '.transfer-strip',
      close: '.close-strip',
      finance: '.finance-strip',
      insurance: '.insurance-strip'
    };

    const visible = new Set(profile.results || []);

    Object.entries(selectorMap).forEach(([key, selector]) => {
      const el = document.querySelector(selector);
      if (!el) return;

      const show = visible.has(key);
      el.classList.toggle('fa-context-hidden', !show);

      if (show && visible.size === 1) {
        el.open = true;
      }
    });

    const opportunity = document.getElementById('opportunity-panel');
    if (opportunity) {
      opportunity.classList.toggle(
        'fa-context-hidden',
        !profile.opportunity
      );
    }
  }

  applyFields();
  applyResults();

  // app.js y las capas visuales pueden volver a escribir clases/textos al calcular.
  // Reafirmamos el perfil sin modificar los valores calculados.
  const results = document.getElementById('resultados');
  if (results) {
    new MutationObserver(() => {
      queueMicrotask(applyResults);
    }).observe(results, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['hidden', 'class']
    });
  }
})();
