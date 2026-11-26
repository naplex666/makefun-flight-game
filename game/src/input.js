// Keyboard + mouse input: one clear job — turn keys into flight intents.

const keys = new Set();

export function initInput() {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
}

export function readInput() {
  const down = (...ks) => ks.some((k) => keys.has(k));
  return {
    pitch: (down('w', 'arrowup') ? 1 : 0) + (down('s', 'arrowdown') ? -1 : 0),
    roll: (down('d', 'arrowright') ? 1 : 0) + (down('a', 'arrowleft') ? -1 : 0),
    throttleUp: down('shift'),
    throttleDown: down('control'),
  };
}

export function wasPressed(key) {
  const k = key.toLowerCase();
  if (keys.has(k)) { keys.delete(k); return true; }
  return false;
}

export function consumeKey(key) { keys.delete(key.toLowerCase()); }
