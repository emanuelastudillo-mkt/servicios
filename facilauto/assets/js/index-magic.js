
(() => {
  const params = new URLSearchParams(location.search);
  const embedded = params.get('embed') === '1';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initEmbedHeight() {
    if (!embedded || window.parent === window) return;

    const sendHeight = () => {
      const height = Math.max(
        document.body?.scrollHeight || 0,
        document.documentElement?.scrollHeight || 0
      );

      window.parent.postMessage({
        type:'facilauto:embed-height',
        height
      }, '*');
    };

    sendHeight();
    window.setTimeout(sendHeight, 250);
    window.setTimeout(sendHeight, 900);

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(() => {
        requestAnimationFrame(sendHeight);
      });
      observer.observe(document.body);
    } else {
      window.addEventListener('resize', sendHeight);
    }

    const results = document.getElementById('resultados');
    if (results) {
      new MutationObserver(() => {
        requestAnimationFrame(sendHeight);
      }).observe(results, {
        subtree:true,
        childList:true,
        attributes:true,
        attributeFilter:['hidden','class','open']
      });
    }
  }

  function reveal() {
    const items = [...document.querySelectorAll('.magic-reveal')];

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(el => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {threshold:.12, rootMargin:'0px 0px -45px'});

    items.forEach((el, index) => {
      el.style.transitionDelay = `${Math.min(index % 4, 3) * 55}ms`;
      observer.observe(el);
    });
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('es-AR', {
      maximumFractionDigits:0
    }).format(value);
  }

  function animateCounter(el) {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target)) return;

    const pad = Number(el.dataset.pad || 0);

    if (reduceMotion) {
      const text = formatNumber(target);
      el.textContent = pad ? text.padStart(pad, '0') : text;
      return;
    }

    const start = performance.now();
    const duration = target > 1000 ? 1300 : 850;

    function frame(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const value = Math.round(target * eased);
      let text = formatNumber(value);

      if (pad && target < 1000) text = String(value).padStart(pad, '0');

      el.textContent = text;

      if (p < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  function counters() {
    const els = [...document.querySelectorAll('[data-count]')];

    if (!('IntersectionObserver' in window)) {
      els.forEach(animateCounter);
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      });
    }, {threshold:.6});

    els.forEach(el => observer.observe(el));
  }

  function mirrorLiveData() {
    const ratesSource = document.getElementById('hero-rates-count');
    const ratesTarget = document.getElementById('magic-rates-count');
    const statusSource = document.getElementById('data-status');
    const stateTarget = document.getElementById('magic-data-state');

    const sync = () => {
      if (ratesSource && ratesTarget) {
        const text = (ratesSource.textContent || '').trim();
        ratesTarget.textContent = text && text !== '— bancos'
          ? text.replace(/\s*bancos?/i,'').trim()
          : '—';
      }

      if (statusSource && stateTarget) {
        const raw = (statusSource.textContent || '').trim();

        if (/error|no se pudo|fall/i.test(raw)) {
          stateTarget.textContent = 'Revisar datos';
          return;
        }

        if (/cargando/i.test(raw)) {
          stateTarget.textContent = 'Sincronizando…';
          return;
        }

        stateTarget.textContent = 'Datos listos';
      }
    };

    sync();

    [ratesSource, statusSource].filter(Boolean).forEach(source => {
      new MutationObserver(sync).observe(source, {
        childList:true,
        subtree:true,
        characterData:true
      });
    });

    window.setTimeout(sync, 1000);
    window.setTimeout(sync, 2500);
  }

  function parallaxMark() {
    if (reduceMotion) return;

    const box = document.querySelector('[data-magic-parallax]');
    if (!box) return;

    box.addEventListener('pointermove', event => {
      const rect = box.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - .5) * 14;
      const y = ((event.clientY - rect.top) / rect.height - .5) * 14;

      box.style.setProperty('--px', `${x}px`);
      box.style.setProperty('--py', `${y}px`);
    });

    box.addEventListener('pointerleave', () => {
      box.style.setProperty('--px', '0px');
      box.style.setProperty('--py', '0px');
    });
  }

  function demoTilt() {
    if (reduceMotion) return;

    const card = document.querySelector('.magic-demo-card');
    if (!card) return;

    card.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - .5;
      const py = (event.clientY - rect.top) / rect.height - .5;

      card.style.setProperty('--demo-rx', `${px * 2.2}deg`);
      card.style.setProperty('--demo-ry', `${py * -2.2}deg`);
    });

    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--demo-rx', '0deg');
      card.style.setProperty('--demo-ry', '0deg');
    });
  }

  function init() {
    if (embedded) {
      initEmbedHeight();
      return;
    }

    reveal();
    counters();
    mirrorLiveData();
    parallaxMark();
    demoTilt();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init, {once:true})
    : init();
})();
