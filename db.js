// db.js
// Simple wrapper around IndexedDB for persisting projects and transcripts.
// Each project contains an array of pages (image data URL, transcript text, status).
// Schema: DB name 'tmj_db', version 1, object store 'projects' { keyPath: 'id', autoIncrement: true }

const DB_NAME = 'tmj_db';
const DB_VERSION = 1;
const STORE = 'projects';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function toStorable(project) {
  const pages = project.pages.map((p) => ({
    imageSrc: p.image ? p.image.src : p.imageSrc || '',
    transcript: p.transcript,
    status: p.status,
  }));
  const { image, ...rest } = project; // not expected but just in case
  return { ...rest, pages };
}

export async function saveProject(project) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const storable = toStorable(project);
    store.put(storable);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getAllProjects() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      db.close();
      resolve(req.result);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function getProject(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.get(id);
    req.onsuccess = () => {
      db.close();
      resolve(req.result);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}
