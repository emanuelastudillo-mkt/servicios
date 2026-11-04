import { encodeWav } from './files.js?v=1.8.0';
self.onmessage = ({ data }) => {
  try { const buffer = encodeWav(data.session, data.cycles, progress => self.postMessage({ progress })); self.postMessage({ buffer }, [buffer]); }
  catch (error) { self.postMessage({ error: error.message }); }
};
