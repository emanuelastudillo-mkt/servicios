document.addEventListener('DOMContentLoaded', () => {
  const frame = document.querySelector('[data-fa-tool]');
  if (!frame) return;

  const focus = frame.dataset.focus || 'valuation';
  const params = new URLSearchParams({
    embed: '1',
    focus,
    share_url: location.href
  });

  if (frame.dataset.km) params.set('km', frame.dataset.km);
  if (frame.dataset.security) params.set('security', frame.dataset.security);
  if (frame.dataset.jurisdiction) params.set('jurisdiction', frame.dataset.jurisdiction);

  frame.src = `../index.html?${params.toString()}#calculadora`;

  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow) return;
    if (!event.data || event.data.type !== 'facilauto:embed-height') return;

    const height = Math.max(760, Math.min(5200, Number(event.data.height) || 0));
    if (height) frame.style.height = `${height}px`;
  });
});
