/**
 * FACIL AUTO — Public source privacy mask v1.5.4
 * Nunca muestra proveedor, página, unidad interna ni vigencia exacta.
 */
(() => {
  const FIXED = {
    'market-pdf-unit': 'Según datos oficiales y relevamientos.',
    'market-source': 'Datos oficiales + relevamientos del mercado automotor.',
    'dnrpa-source': 'Datos oficiales vigentes.',
    'source-market-date': 'Actualizado',
    'source-dnrpa-date': 'Vigente',
    'source-rates-date': 'Actualizable',
    'hero-market-date': 'Actualizado',
    'hero-dnrpa-date': 'Vigentes'
  };

  const SENSITIVE = [
    /NuestrosAutos/gi,
    /ComparaTasas/gi,
    /\bDNRPA\b/gi,
    /Fuente en miles de (?:pesos|US\$)[^·\n]*?(?:·\s*)?[\d.,]+\s*×\s*1\.000/gi,
    /Fuente en miles de (?:pesos|US\$)/gi,
    /\bp[aá]g(?:ina)?\.?\s*\d+(?:\s*[-–,]\s*\d+)*/gi,
    /\bvigencia\s+\d{1,2}\/\d{1,2}\/\d{4}/gi
  ];

  function safeText(value = '') {
    let text = String(value);

    text = text
      .replace(/NuestrosAutos[^·\n]*/gi, 'Datos de mercado')
      .replace(/ComparaTasas/gi, 'Datos financieros')
      .replace(/\bDNRPA\b/gi, 'datos oficiales')
      .replace(/Fuente en miles de (?:pesos|US\$)\s*·?\s*[\d.,]+\s*×\s*1\.000/gi, 'Según datos oficiales y relevamientos')
      .replace(/\bp[aá]g(?:ina)?\.?\s*\d+(?:\s*[-–,]\s*\d+)*/gi, '')
      .replace(/\bvigencia\s+\d{1,2}\/\d{1,2}\/\d{4}/gi, 'vigencia actual')
      .replace(/\s*·\s*·\s*/g, ' · ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return text;
  }

  function lockElement(id, fixedValue) {
    const el = document.getElementById(id);
    if (!el) return;

    const proto = Node.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'textContent');

    if (!descriptor?.get || !descriptor?.set) {
      el.textContent = fixedValue;
      return;
    }

    try {
      Object.defineProperty(el, 'textContent', {
        configurable: true,
        enumerable: false,
        get() {
          return descriptor.get.call(this);
        },
        set(_) {
          descriptor.set.call(this, fixedValue);
        }
      });
      descriptor.set.call(el, fixedValue);
    } catch (_) {
      el.textContent = fixedValue;
    }
  }

  function sanitizeNode(root) {
    if (!root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      const current = root.nodeValue || '';
      if (SENSITIVE.some(rx => {
        rx.lastIndex = 0;
        return rx.test(current);
      })) {
        root.nodeValue = safeText(current);
      }
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      const current = node.nodeValue || '';
      if (!current) return;

      const isSensitive = SENSITIVE.some(rx => {
        rx.lastIndex = 0;
        return rx.test(current);
      });

      if (isSensitive) node.nodeValue = safeText(current);
    });
  }

  function init() {
    Object.entries(FIXED).forEach(([id, value]) => lockElement(id, value));
    sanitizeNode(document.body);

    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') {
          sanitizeNode(record.target);
          continue;
        }

        record.addedNodes.forEach(sanitizeNode);
      }

      // Reafirmar textos fijos después de cualquier render dinámico.
      Object.entries(FIXED).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el && el.textContent !== value) el.textContent = value;
      });
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else {
    init();
  }
})();
