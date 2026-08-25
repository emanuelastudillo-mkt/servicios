/**
 * FACIL AUTO · Pulso de mercado animado v1.5.27
 */
(() => {
  const selector = '[data-market-count]';

  function formatNumber(value) {
    return new Intl.NumberFormat('es-AR').format(Math.round(value));
  }

  function animateCounter(el) {
    if (!el || el.dataset.marketAnimated === '1') return;

    const target = Number(el.dataset.marketCount || 0);
    if (!Number.isFinite(target) || target <= 0) return;

    el.dataset.marketAnimated = '1';

    const stat = el.closest('.hero-market-stat');
    if (stat) stat.classList.add('is-live');

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      el.textContent = formatNumber(target);
      return;
    }

    const duration = target > 1000000 ? 1800 : 1400;
    const started = performance.now();

    function frame(now) {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      el.textContent = formatNumber(current);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = formatNumber(target);
      }
    }

    requestAnimationFrame(frame);
  }

  function init() {
    const items = Array.from(document.querySelectorAll(selector));
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach(animateCounter);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.35 });

    items.forEach(item => observer.observe(item));
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init, { once:true })
    : init();
})();
