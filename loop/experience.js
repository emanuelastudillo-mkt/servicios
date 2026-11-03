// Presentation preferences never modify the session or start a capture.
export const MODE_KEY = 'seis.interface-mode';
export function readMode(storage) {
  try { return storage?.getItem(MODE_KEY) === 'advanced' ? 'advanced' : 'simple'; }
  catch { return 'simple'; }
}
export function writeMode(storage, mode) {
  if (!storage?.setItem) return false;
  try { storage?.setItem(MODE_KEY, mode === 'advanced' ? 'advanced' : 'simple'); return true; }
  catch { return false; }
}
export function audioError(error, output = false) {
  const name = error?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return output
    ? 'No se autorizó esa salida. Permití el acceso a los dispositivos o elegí la salida predeterminada del sistema.'
    : 'No se autorizó la entrada o se canceló la selección. Permití el micrófono en los permisos del sitio y en Privacidad de Windows; después volvé a Conectar.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'El dispositivo elegido no está disponible. Reconectalo, pulsá Actualizar dispositivos y elegilo de nuevo. Las tomas se conservan.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'No se pudo abrir el dispositivo. Revisá si otra aplicación lo usa en modo exclusivo, sus permisos y el controlador. Probá una entrada de Windows o una ruta virtual configurada.';
  return error?.message || 'El audio no respondió. Abrí Revisar audio para comprobar la entrada y la salida.';
}
export function capabilities(env = globalThis, native = null) {
  const audio = !!(env.AudioContext && env.AudioWorkletNode);
  return [
    { title: 'Motor de audio', ok: audio && !!env.isSecureContext, detail: !env.isSecureContext ? 'Abrí SEIS mediante HTTPS o el ejecutable. Esta dirección no permite grabar.' : audio ? 'Motor disponible. La señal real se comprueba conectando una entrada.' : 'Actualizá el navegador o usá SEIS de escritorio. Falta soporte de audio necesario.' },
    { title: 'Micrófonos y placas', ok: !!env.navigator?.mediaDevices?.getUserMedia, detail: env.navigator?.mediaDevices?.getUserMedia ? 'Conectá la fuente en un loop para autorizar el acceso y ver sus nombres.' : 'No hay acceso a entradas en este entorno. Usá HTTPS y un navegador actualizado.' },
    { title: 'Captura de aplicaciones', ok: native ? native.processCapture === true : !!env.navigator?.mediaDevices?.getDisplayMedia, detail: native ? native.processCapture === false ? 'Windows no admite captura por aplicación en este entorno. Usá una entrada física, virtual o el audio completo de una salida.' : native.processCapture === true ? 'Captura nativa disponible. Las apps con ASIO pueden necesitar un retorno de audio.' : 'Capacidad sin confirmar. Actualizá la lista o intentá conectar una aplicación y comprobá su señal.' : env.navigator?.mediaDevices?.getDisplayMedia ? 'El selector del navegador debe ofrecer Compartir audio. La disponibilidad depende de la fuente y del sistema.' : 'Este navegador no ofrece captura de pantalla con audio. Podés usar una entrada de micrófono o placa.' },
    { title: 'Salida de reproducción', ok: !!env.AudioContext?.prototype.setSinkId, detail: env.AudioContext?.prototype.setSinkId ? 'Podés elegir la salida en la barra superior. Probala con el botón de abajo.' : 'Se usa la salida predeterminada. Cambiala desde los ajustes de sonido del sistema; podés seguir grabando y reproduciendo.' }
  ];
}
export function signalResult({ connected, muted, gain, peak, kind }) {
  if (!connected) return { ok: false, text: 'La entrada se desconectó durante la prueba. Reconectala y repetí.' };
  if (muted || gain === 0) return { ok: false, text: 'Entrada silenciada o con nivel en cero. Abrí Avanzado y activá la entrada o subí su nivel.' };
  if (peak >= .98) return { ok: false, text: 'Se recibió señal demasiado alta. Bajá la ganancia de la placa o de la entrada y repetí la prueba.' };
  if (peak < .001) return { ok: false, text: ['native', 'window', 'system', 'tab'].includes(kind)
    ? 'No se detectó señal durante 3 segundos. Reproducí audio en la app y revisá su salida. Pro Tools con ASIO puede necesitar un retorno físico o virtual.'
    : 'No se detectó señal durante 3 segundos. Tocá o hablá mientras probás; revisá cable, entrada y ganancia de la placa.' };
  return { ok: true, text: `Señal recibida · pico ${Math.round(20 * Math.log10(peak))} dBFS. La entrada llega a SEIS. Esta prueba no mide latencia.` };
}
