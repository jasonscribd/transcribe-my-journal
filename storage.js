// storage.js
// Simple utilities for persisting user configuration using localStorage (could be swapped to IndexedDB later)

const CONFIG_KEY = 'tmj_config';

export async function getConfig() {
  const json = localStorage.getItem(CONFIG_KEY);
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export async function saveConfig({ apiKey, model, prompt }) {
  const current = await getConfig();
  const newCfg = { ...current, apiKey, model, prompt };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(newCfg));
}

export function clearApiKey() {
  const cfg = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
  delete cfg.apiKey;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}
