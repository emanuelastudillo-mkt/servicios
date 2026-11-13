// Runs before styles load to avoid a light flash when the saved theme is dark.
(() => {
  const key = 'musicalidad-theme';
  const valid = value => ['light', 'dark', 'system'].includes(value);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let choice = 'system';
  try {
    const saved = localStorage.getItem(key);
    if (valid(saved)) choice = saved;
  } catch { /* Themes still work when browser storage is unavailable. */ }

  function apply() {
    const theme = choice === 'system' ? (media.matches ? 'dark' : 'light') : choice;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#151c19' : '#f5f2e9');
    document.querySelectorAll('[data-theme-select]').forEach(select => { select.value = choice; });
  }

  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelectorAll('[data-theme-select]').forEach(select => {
      select.addEventListener('change', () => {
        if (!valid(select.value)) return;
        choice = select.value;
        try { localStorage.setItem(key, choice); } catch { /* Session-only preference. */ }
        apply();
      });
    });
  });
  media.addEventListener('change', () => { if (choice === 'system') apply(); });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) {
      choice = valid(event.newValue) ? event.newValue : 'system';
      apply();
    }
  });
})();
