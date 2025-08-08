import { loadPdfAsImages } from './pdf_renderer.js';
import { getConfig, saveConfig, clearApiKey } from './storage.js';
import { transcribeImage } from './openai.js';
import { saveProject, getAllProjects } from './db.js';
import { exportTxt } from './exporter.js';

const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const dropOverlay = document.getElementById('dropOverlay');
const pageCanvas = document.getElementById('pageCanvas');
const transcriptArea = document.getElementById('transcriptArea');
const exportBtn = document.getElementById('exportBtn');

// New simplified UI elements
const emptyState = document.getElementById('emptyState');
const imagePane = document.getElementById('imagePane');
const transcriptPane = document.getElementById('transcriptPane');
const viewToggle = document.getElementById('viewToggle');
const showImageBtn = document.getElementById('showImageBtn');
const showTranscriptBtn = document.getElementById('showTranscriptBtn');
const pageNavigation = document.getElementById('pageNavigation');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageIndicator = document.getElementById('pageIndicator');

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
const exportAllBtn = document.getElementById('exportAllBtn');

let state = {
  project: null, // { id, title, createdAt, pages: [...] }
  currentPageIndex: 0,
  currentView: 'image', // 'image' or 'transcript'
};

function updatePageNavigation() {
  if (!state.project || state.project.pages.length <= 1) {
    pageNavigation.classList.add('hidden');
    return;
  }
  
  pageNavigation.classList.remove('hidden');
  pageIndicator.textContent = `Page ${state.currentPageIndex + 1} of ${state.project.pages.length}`;
  prevPageBtn.disabled = state.currentPageIndex === 0;
  nextPageBtn.disabled = state.currentPageIndex === state.project.pages.length - 1;
}

function showPage(pageIndex) {
  if (!state.project || pageIndex < 0 || pageIndex >= state.project.pages.length) return;
  
  state.currentPageIndex = pageIndex;
  const page = state.project.pages[pageIndex];
  
  // Always show the image
  drawImageOnCanvas(page.image);
  pageCanvas.classList.remove('hidden');
  emptyState.classList.add('hidden');
  
  // Update transcript area
  transcriptArea.value = page.transcript || '';
  
  // Show view toggle
  viewToggle.classList.remove('hidden');
  
  // Auto-transcribe if no transcript exists
  if (!page.transcript && page.status === 'pending') {
    transcribeCurrentPage();
  }
  
  updatePageNavigation();
  updateView();
}

function updateView() {
  if (state.currentView === 'image') {
    imagePane.classList.remove('hidden');
    transcriptPane.classList.add('hidden');
    showImageBtn.classList.add('active');
    showTranscriptBtn.classList.remove('active');
  } else {
    imagePane.classList.add('hidden');
    transcriptPane.classList.remove('hidden');
    showImageBtn.classList.remove('active');
    showTranscriptBtn.classList.add('active');
  }
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

  showStatus('Loading file...');

  let pagesData = [];
  try {
    if (file.type === 'application/pdf') {
      const images = await loadPdfAsImages(file);
      pagesData = images.map((img) => ({ image: img, transcript: '', status: 'pending' }));
    } else if (file.type.startsWith('image/')) {
      const imgUrl = URL.createObjectURL(file);
      const img = await loadImage(imgUrl);
      pagesData = [{ image: img, transcript: '', status: 'pending' }];
    } else {
      hideStatus();
      alert('Unsupported file type. Please drop a PDF or image.');
      return;
    }

    state.project = {
      title: file.name,
      createdAt: Date.now(),
      pages: pagesData,
    };
    
    // Convert images to storable format for saving
    const storableProject = {
      ...state.project,
      pages: state.project.pages.map(p => ({
        imageSrc: p.image.src,
        transcript: p.transcript,
        status: p.status
      }))
    };
    await saveProject(storableProject);

    hideStatus();
    showPage(0);
    exportBtn.disabled = false;
  } catch (error) {
    hideStatus();
    console.error('Error loading file:', error);
    alert('Error loading file. Please try again.');
  }
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
    alert('Please set your OpenAI API key in Settings first.');
    return;
  }
  
  const page = state.project.pages[state.currentPageIndex];
  page.status = 'working';
  showStatus(`Transcribing page ${state.currentPageIndex + 1}…`);

  const dataUrl = pageCanvas.toDataURL('image/png');
  try {
    const text = await transcribeImage(dataUrl, apiKey, model, prompt);
    page.transcript = text;
    page.status = 'done';
    transcriptArea.value = text;
    
    // Save updated project
    const storableProject = {
      ...state.project,
      pages: state.project.pages.map(p => ({
        imageSrc: p.image.src,
        transcript: p.transcript,
        status: p.status
      }))
    };
    await saveProject(storableProject);
    
    hideStatus();
    
    // Switch to transcript view to show result
    state.currentView = 'transcript';
    updateView();
  } catch (err) {
    console.error(err);
    alert('Failed to transcribe page. Please check your API key and try again.');
    hideStatus();
    page.status = 'pending';
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

// Export all transcripts functionality
exportAllBtn.addEventListener('click', async () => {
  const projects = await getAllProjects();
  if (projects.length === 0) {
    alert('No transcripts found to export.');
    return;
  }
  
  let allText = '';
  projects.forEach((project, projectIndex) => {
    allText += `=== ${project.title || `Project ${projectIndex + 1}`} ===\n`;
    allText += `Created: ${new Date(project.createdAt).toLocaleDateString()}\n\n`;
    
    project.pages.forEach((page, pageIndex) => {
      if (page.transcript && page.transcript.trim()) {
        allText += `--- Page ${pageIndex + 1} ---\n`;
        allText += `${page.transcript.trim()}\n\n`;
      }
    });
    allText += '\n';
  });
  
  if (allText.trim() === '') {
    alert('No transcripts found to export.');
    return;
  }
  
  const blob = new Blob([allText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `journal-transcripts-${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  
  alert(`Exported ${projects.length} project(s) to journal-transcripts-${new Date().toISOString().split('T')[0]}.txt`);
});

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

// Page navigation
prevPageBtn.addEventListener('click', () => {
  if (state.currentPageIndex > 0) {
    showPage(state.currentPageIndex - 1);
  }
});

nextPageBtn.addEventListener('click', () => {
  if (state.currentPageIndex < state.project.pages.length - 1) {
    showPage(state.currentPageIndex + 1);
  }
});

// View toggle
showImageBtn.addEventListener('click', () => {
  state.currentView = 'image';
  updateView();
});

showTranscriptBtn.addEventListener('click', () => {
  state.currentView = 'transcript';
  updateView();
});

// Export current project
exportBtn.addEventListener('click', () => {
  if (!state.project) return;
  exportTxt(state.project.pages);
});

// Transcript area updates (make it editable)
transcriptArea.addEventListener('input', async () => {
  if (!state.project) return;
  const page = state.project.pages[state.currentPageIndex];
  page.transcript = transcriptArea.value;
  
  // Save updated project
  const storableProject = {
    ...state.project,
    pages: state.project.pages.map(p => ({
      imageSrc: p.image.src,
      transcript: p.transcript,
      status: p.status
    }))
  };
  await saveProject(storableProject);
});

// Remove readonly from transcript area
transcriptArea.removeAttribute('readonly');