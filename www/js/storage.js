// Dedicated app storage: everything lives under "LoopStation/" in the app's private data directory
// (Capacitor Directory.DATA). On Android this private space needs no storage permission.
// In a desktop browser (for testing) the same API is backed by IndexedDB.
import { abToB64, b64ToAb } from './audioutil.js';

export const ROOT = 'LoopStation';
export const DIRS = ['samples', 'loops', 'projects', 'recordings', 'separated'];

const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
let FS = null;
const fs = () => (FS ||= window.Capacitor.registerPlugin('Filesystem'));
const P = (p) => `${ROOT}/${p}`;

// ---- IndexedDB fallback -------------------------------------------------------------------
let dbp = null;
function db() {
  return (dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('loopstation', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files', { keyPath: 'path' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}
async function idb(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction('files', mode);
    const out = fn(tx.objectStore('files'));
    tx.oncomplete = () => res(out.result);
    tx.onerror = () => rej(tx.error);
  });
}

// ---- Permissions ----------------------------------------------------------------------------
// Requests whatever the platform asks for. Android 11+ gives no dialog for app-private storage;
// older Android versions may show a storage dialog. The microphone prompt is separate.
export async function requestStoragePermissions() {
  if (!isNative()) return 'web';
  try {
    const s = await fs().checkPermissions();
    if (s.publicStorage === 'granted') return 'granted';
    const r = await fs().requestPermissions();
    return r.publicStorage;
  } catch (e) {
    return 'not-required';
  }
}

export async function requestMicPermission() {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch (e) {
    return 'denied';
  }
}

export async function initStorage() {
  if (!isNative()) return;
  for (const d of DIRS) {
    try { await fs().mkdir({ path: P(d), directory: 'DATA', recursive: true }); } catch (e) { /* already exists */ }
  }
}

// ---- File API ---------------------------------------------------------------------------------
export async function writeBuffer(path, ab) {
  if (isNative()) {
    await fs().writeFile({ path: P(path), data: abToB64(ab), directory: 'DATA', recursive: true });
  } else {
    await idb('readwrite', (s) => s.put({ path: P(path), data: abToB64(ab) }));
  }
}

export async function readBuffer(path) {
  if (isNative()) {
    const r = await fs().readFile({ path: P(path), directory: 'DATA' });
    return b64ToAb(r.data);
  }
  const rec = await idb('readonly', (s) => s.get(P(path)));
  if (!rec) throw new Error('not found: ' + path);
  return b64ToAb(rec.data);
}

export const writeJSON = (path, obj) => writeBuffer(path, new TextEncoder().encode(JSON.stringify(obj)).buffer);
export async function readJSON(path) {
  return JSON.parse(new TextDecoder().decode(await readBuffer(path)));
}

export async function remove(path) {
  if (isNative()) {
    try {
      const st = await fs().stat({ path: P(path), directory: 'DATA' });
      if (st.type === 'directory') await fs().rmdir({ path: P(path), directory: 'DATA', recursive: true });
      else await fs().deleteFile({ path: P(path), directory: 'DATA' });
    } catch (e) { /* ignore */ }
  } else {
    const all = await idb('readonly', (s) => s.getAllKeys());
    const targets = all.filter((k) => k === P(path) || k.startsWith(P(path) + '/'));
    for (const k of targets) await idb('readwrite', (s) => s.delete(k));
  }
}

// Returns [{name, type:'file'|'directory'}] for one directory level.
export async function list(dir) {
  if (isNative()) {
    try {
      const r = await fs().readdir({ path: P(dir), directory: 'DATA' });
      return r.files.map((f) => (typeof f === 'string' ? { name: f, type: 'file' } : { name: f.name, type: f.type || 'file' }));
    } catch (e) { return []; }
  }
  const keys = await idb('readonly', (s) => s.getAllKeys());
  const prefix = P(dir) + '/';
  const seen = new Map();
  for (const k of keys) {
    if (!k.startsWith(prefix)) continue;
    const rest = k.slice(prefix.length);
    const i = rest.indexOf('/');
    if (i === -1) seen.set(rest, 'file');
    else seen.set(rest.slice(0, i), 'directory');
  }
  return [...seen].map(([name, type]) => ({ name, type }));
}
