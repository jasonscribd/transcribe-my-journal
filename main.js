import { loadPdfAsImages } from './pdf_renderer.js';
import { getConfig, saveConfig, clearApiKey } from './storage.js';
import { transcribeImage } from './openai.js';
import { saveProject, getAllProjects } from './db.js';
import { exportTxt } from './exporter.js';

const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const dropOverlay = document.getElementById('dropOverlay');
const pageList = document.getElementById('pageList');
const pageCanvas = document.getElementById('pageCanvas');
const transcriptArea = document.getElementById('transcriptArea');
const exportBtn = document.getElementById('exportBtn');

// Status overlay elements
const statusOverlay = document.getElementById('statusOverlay');
const statusText = document.getElementById('statusText');
function showStatus(message = 'Processing…') {
  statusText.textContent = message;
  statusOverlay.classList.remove('hidden');
}
function hideStatus() {
  statusOverlay.classList.add('hidden');
}


// Settings dialog elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsDialog = document.getElementById('settingsDialog');
const apiKeyInput = document.getElementById('apiKeyInput');
const modelInput = document.getElementById('modelInput');
const promptInput = document.getElementById('promptInput');
const resetKeyBtn = document.getElementById('resetKeyBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');

let state = {
  project: null, // { id, title, createdAt, pages: [...] }
  currentPageIndex: 0,
};

function renderPageList() {
  pageList.innerHTML = '';
  state.project.pages.forEach((p, idx) => {
    const li = document.createElement('li');
    li.textContent = `Page ${idx + 1} ${p.status === 'done' ? '✅' : ''}`;
    if (idx === state.currentPageIndex) li.classList.add('active');
    li.addEventListener('click', () => selectPage(idx));
    pageList.appendChild(li);
  });
}

function selectPage(idx) {
  state.currentPageIndex = idx;
  const page = state.project.pages[idx];
  drawImageOnCanvas(page.image);
  transcriptArea.value = page.transcript || '';
  renderPageList();
}

function drawImageOnCanvas(img) {
  const ctx = pageCanvas.getContext('2d');
  pageCanvas.width = img.width;
  pageCanvas.height = img.height;
  ctx.drawImage(img, 0, 0);
}

async function handleFiles(files) {
  exportBtn.disabled = true;
  const file = files[0];
  if (!file) return;

  let pagesData = [];
  if (file.type === 'application/pdf') {
    const images = await loadPdfAsImages(file);
    pagesData = images.map((img) => ({ image: img, transcript: '', status: 'pending' }));
  } else if (file.type.startsWith('image/')) {
    const imgUrl = URL.createObjectURL(file);
    const img = await loadImage(imgUrl);
    pagesData = [{ image: img, transcript: '', status: 'pending' }];
  } else {
    alert('Unsupported file type. Please drop a PDF or image.');
    return;
  }

  state.project = {
    title: file.name,
    createdAt: Date.now(),
    pages: pagesData,
  };
  await saveProject(state.project);

  renderPageList();
  selectPage(0);
  exportBtn.disabled = false;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function transcribeCurrentPage() {
  const { apiKey, model, prompt } = await getConfig();
  if (!apiKey) {
    alert('Please set your OpenAI API key in Settings.');
    return;
  }
  const page = state.project.pages[state.currentPageIndex];
  page.status = 'working';
  renderPageList();
  showStatus(`Transcribing page ${state.currentPageIndex + 1}…`);

  const dataUrl = pageCanvas.toDataURL('image/png');
  try {
    const text = await transcribeImage(dataUrl, apiKey, model, prompt);
    page.transcript = text;
    page.status = 'done';
    transcriptArea.value = text;
    hideStatus();
    await saveProject(state.project);
    renderPageList();
  } catch (err) {
    console.error(err);
    alert('Failed to transcribe page. See console.');
    hideStatus();
    page.status = 'pending';
    renderPageList();
  }
}

// Settings
settingsBtn.addEventListener('click', async () => {
  const { apiKey, model, prompt } = await getConfig();
  apiKeyInput.value = apiKey || '';
  modelInput.value = model || 'gpt-4o-mini';
  promptInput.value = prompt || promptInput.value;
  settingsDialog.showModal();
});

settingsDialog.addEventListener('submit', (e) => {
  e.preventDefault();
  saveConfig({
    apiKey: apiKeyInput.value.trim(),
    model: modelInput.value.trim(),
    prompt: promptInput.value.trim(),
  });
  settingsDialog.close();
});

resetKeyBtn.addEventListener('click', () => {
  clearApiKey();
  apiKeyInput.value = '';
  alert('API key cleared from browser storage.');
});

closeSettingsBtn.addEventListener('click', () => settingsDialog.close());

// Upload & drag-drop
uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

document.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropOverlay.classList.remove('hidden');
});

document.addEventListener('dragleave', (e) => {
  if (e.target === document) dropOverlay.classList.add('hidden');
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  dropOverlay.classList.add('hidden');
  handleFiles(e.dataTransfer.files);
});

// Transcript area change updates state and auto-save
transcriptArea.addEventListener('input', async () => {
  const page = state.project.pages[state.currentPageIndex];
  page.transcript = transcriptArea.value;
  await saveProject(state.project);
});

// Double-click canvas to transcribe
pageCanvas.addEventListener('dblclick', transcribeCurrentPage);

// Export TXT
exportBtn.addEventListener('click', () => {
  if (!state.project) return;
  exportTxt(state.project.pages);
});

// Load existing projects on startup (simple console list for now)
(async () => {
  const projects = await getAllProjects();
  if (projects.length) {
    console.log('Existing projects in DB:', projects.map((p) => p.title));
  }
})();
