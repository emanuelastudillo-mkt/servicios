import { dispatch } from "./engine.js";
self.onmessage = ({ data }) => {
  try {
    dispatch(data.state, data.command);
    self.postMessage({ ok: true, state: data.state });
  } catch (error) {
    self.postMessage({ ok: false, error: error.message });
  }
};
