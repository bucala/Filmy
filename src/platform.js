import { S } from './state.js';

let appBridge = null;
const pending = new Map();

S.hasNativeAppBridge = function hasNativeAppBridge() {
  return !!window.FilmyApp && typeof window.FilmyApp.postMessage === 'function';
};

S.nativeAppRequest = function nativeAppRequest(action, payload = {}) {
  if (!S.hasNativeAppBridge()) return Promise.reject(new Error('Táto funkcia vyžaduje nový Android APK.'));
  const bridge = window.FilmyApp;
  if (appBridge !== bridge) {
    appBridge = bridge;
    bridge.onmessage = event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (!message || typeof message !== 'object' || Array.isArray(message) || typeof message.id !== 'string') return;
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      const result = message.result;
      if (!result || typeof result !== 'object' || Array.isArray(result) ||
          typeof result.ok !== 'boolean' || (result.cancelled !== undefined && typeof result.cancelled !== 'boolean') ||
          (result.ok && result.cancelled)) {
        request.reject(new Error('Android poslal neplatnú odpoveď.'));
      } else if (!result.ok && !result.cancelled) {
        request.reject(new Error(typeof result.error === 'string' ? result.error : 'Android operáciu nedokončil.'));
      } else request.resolve(result);
    };
  }
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    // A user-controlled document picker has no arbitrary timeout.
    const timer = action === 'youtube' ? setTimeout(() => {
      pending.delete(id);
      reject(new Error('YouTube sa nepodarilo otvoriť.'));
    }, 15000) : null;
    pending.set(id, { resolve, reject, timer });
    try { bridge.postMessage(JSON.stringify({ ...payload, id, action })); }
    catch {
      pending.delete(id); clearTimeout(timer);
      reject(new Error('Požiadavku sa nepodarilo odoslať do Androidu.'));
    }
  });
};
