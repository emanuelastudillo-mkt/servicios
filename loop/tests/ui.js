// Dedicated test page only. Production app.js never imports this fixture.
document.querySelector('#prepare').onclick = async () => {
  const html = await (await fetch('../index.html')).text();
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.body.replaceChildren(...parsed.body.childNodes);
  const base = document.createElement('base'); base.href = '/loop/'; document.head.prepend(base);
  const note = document.createElement('div');
  note.textContent = 'PRUEBA CON SEÑAL SINTÉTICA · No se usa el micrófono · Salida en cero';
  note.style.cssText = 'padding:10px;text-align:center;background:#34422c;color:#d7f5c3;font-size:12px';
  document.body.prepend(note);
  document.querySelector('#master').value = 0;
  document.querySelector('#master-value').textContent = '0%';
  let testContext;
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
    testContext ||= new AudioContext(); await testContext.resume();
    const oscillator = testContext.createOscillator(); oscillator.frequency.value = 220;
    const gain = testContext.createGain(); gain.gain.value = .15;
    const destination = testContext.createMediaStreamDestination();
    oscillator.connect(gain).connect(destination); oscillator.start();
    return destination.stream;
  }});
  Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { configurable: true, value: async () => [] });
  window.addEventListener('pagehide', () => testContext?.close());
  await import('../app.js?v=1.0.1');
};
