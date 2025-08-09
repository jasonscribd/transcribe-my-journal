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
const batchTranscribeBtn = document.getElementById('batchTranscribeBtn');
const toggleAutoTranscribeBtn = document.getElementById('toggleAutoTranscribeBtn');
const improveTextBtn = document.getElementById('improveTextBtn');

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
  autoTranscribeDisabled: false,
  batchTranscribing: false,
  isTextOnly: false, // true when working with uploaded text files
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
  
  if (state.isTextOnly) {
    // Text-only mode: hide image, show transcript directly
    pageCanvas.classList.add('hidden');
    emptyState.classList.add('hidden');
    viewToggle.classList.add('hidden');
    transcriptPane.classList.remove('hidden');
    imagePane.classList.add('hidden');
    state.currentView = 'transcript';
  } else {
    // Image mode: show image and toggle
    drawImageOnCanvas(page.image);
    pageCanvas.classList.remove('hidden');
    emptyState.classList.add('hidden');
    viewToggle.classList.remove('hidden');
    
    // Auto-transcribe if no transcript exists and user hasn't disabled auto-transcribe
    if (!page.transcript && page.status === 'pending' && !state.autoTranscribeDisabled) {
      transcribeCurrentPage();
    }
  }
  
  // Update transcript area
  transcriptArea.value = page.transcript || '';
  
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
  state.isTextOnly = false;
  
  try {
    if (file.type === 'text/plain') {
      // Handle text files
      const text = await file.text();
      const pages = splitTextIntoPages(text);
      pagesData = pages.map((pageText, index) => ({ 
        image: null, 
        transcript: pageText, 
        status: 'done',
        originalText: pageText // Keep original for improvement
      }));
      state.isTextOnly = true;
      
    } else if (file.type === 'application/pdf') {
      try {
        const images = await loadPdfAsImages(file);
        pagesData = images.map((img) => ({ image: img, transcript: '', status: 'pending' }));
      } catch (pdfError) {
        hideStatus();
        console.error('PDF loading error:', pdfError);
        alert('Error loading PDF. Please try uploading an image or text file instead.');
        return;
      }
    } else if (file.type.startsWith('image/')) {
      const imgUrl = URL.createObjectURL(file);
      const img = await loadImage(imgUrl);
      pagesData = [{ image: img, transcript: '', status: 'pending' }];
    } else {
      hideStatus();
      alert('Unsupported file type. Please upload a PDF, image (JPG, PNG), or text file (.txt).');
      return;
    }

    state.project = {
      title: file.name,
      createdAt: Date.now(),
      pages: pagesData,
    };
    
    // Convert to storable format for saving
    const storableProject = {
      ...state.project,
      pages: state.project.pages.map(p => ({
        imageSrc: p.image ? p.image.src : null,
        transcript: p.transcript,
        status: p.status,
        originalText: p.originalText || null
      }))
    };
    await saveProject(storableProject);

    hideStatus();
    updateUIForFileType();
    showPage(0);
    exportBtn.disabled = false;
  } catch (error) {
    hideStatus();
    console.error('Error loading file:', error);
    alert('Error loading file. Please try again or use a different file format.');
  }
}

function splitTextIntoPages(text, wordsPerPage = 500) {
  const words = text.split(/\s+/);
  const pages = [];
  
  for (let i = 0; i < words.length; i += wordsPerPage) {
    const pageWords = words.slice(i, i + wordsPerPage);
    pages.push(pageWords.join(' '));
  }
  
  return pages.length > 0 ? pages : [text]; // Fallback to single page if splitting fails
}

function updateUIForFileType() {
  if (state.isTextOnly) {
    // Hide image-related controls, show text improvement controls
    batchTranscribeBtn.classList.add('hidden');
    toggleAutoTranscribeBtn.classList.add('hidden');
    improveTextBtn.classList.remove('hidden');
    
    // Update page indicator text
    if (state.project.pages.length > 1) {
      pageIndicator.textContent = `Section ${state.currentPageIndex + 1} of ${state.project.pages.length}`;
    }
  } else {
    // Show image-related controls, hide text improvement
    batchTranscribeBtn.classList.remove('hidden');
    toggleAutoTranscribeBtn.classList.remove('hidden');
    improveTextBtn.classList.add('hidden');
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

// Batch transcription
batchTranscribeBtn.addEventListener('click', async () => {
  if (!state.project || state.batchTranscribing) return;
  
  const { apiKey, model, prompt } = await getConfig();
  if (!apiKey) {
    alert('Please set your OpenAI API key in Settings first.');
    return;
  }
  
  const pendingPages = state.project.pages.filter(p => !p.transcript || p.status === 'pending');
  if (pendingPages.length === 0) {
    alert('All pages are already transcribed!');
    return;
  }
  
  const confirmed = confirm(`This will transcribe ${pendingPages.length} pages. This may take several minutes and will use ${pendingPages.length} API calls. Continue?`);
  if (!confirmed) return;
  
  state.batchTranscribing = true;
  batchTranscribeBtn.disabled = true;
  batchTranscribeBtn.textContent = 'Transcribing...';
  
  let completed = 0;
  for (let i = 0; i < state.project.pages.length; i++) {
    const page = state.project.pages[i];
    if (page.transcript && page.status === 'done') continue;
    
    showStatus(`Transcribing page ${i + 1} of ${state.project.pages.length}... (${completed + 1}/${pendingPages.length})`);
    
    try {
      // Switch to this page to show progress
      showPage(i);
      
      // Generate data URL for this page
      const dataUrl = pageCanvas.toDataURL('image/png');
      const text = await transcribeImage(dataUrl, apiKey, model, prompt);
      
      page.transcript = text;
      page.status = 'done';
      completed++;
      
      // Update transcript area if this is the current page
      if (state.currentPageIndex === i) {
        transcriptArea.value = text;
      }
      
      // Save progress periodically
      if (completed % 5 === 0) {
        const storableProject = {
          ...state.project,
          pages: state.project.pages.map(p => ({
            imageSrc: p.image.src,
            transcript: p.transcript,
            status: p.status
          }))
        };
        await saveProject(storableProject);
      }
      
      // Small delay to prevent API rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (err) {
      console.error(`Error transcribing page ${i + 1}:`, err);
      page.status = 'error';
      // Continue with other pages
    }
  }
  
  // Final save
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
  state.batchTranscribing = false;
  batchTranscribeBtn.disabled = false;
  batchTranscribeBtn.textContent = 'Transcribe All Pages';
  
  alert(`Batch transcription complete! Successfully transcribed ${completed} pages.`);
});

// Toggle auto-transcribe
toggleAutoTranscribeBtn.addEventListener('click', () => {
  state.autoTranscribeDisabled = !state.autoTranscribeDisabled;
  toggleAutoTranscribeBtn.textContent = `Auto-transcribe: ${state.autoTranscribeDisabled ? 'OFF' : 'ON'}`;
  
  if (state.autoTranscribeDisabled) {
    toggleAutoTranscribeBtn.classList.add('btn-warning');
    toggleAutoTranscribeBtn.classList.remove('btn-secondary');
  } else {
    toggleAutoTranscribeBtn.classList.remove('btn-warning');
    toggleAutoTranscribeBtn.classList.add('btn-secondary');
  }
});

// Text improvement for badly transcribed text
improveTextBtn.addEventListener('click', async () => {
  if (!state.project || !state.isTextOnly) return;
  
  const { apiKey, model } = await getConfig();
  if (!apiKey) {
    alert('Please set your OpenAI API key in Settings first.');
    return;
  }
  
  const currentPage = state.project.pages[state.currentPageIndex];
  if (!currentPage.transcript) {
    alert('No text to improve on this section.');
    return;
  }
  
  const confirmed = confirm('This will use AI to improve the text quality, grammar, and readability. Continue?');
  if (!confirmed) return;
  
  improveTextBtn.disabled = true;
  improveTextBtn.textContent = 'Improving...';
  showStatus('Improving text quality...');
  
  try {
    const improvedText = await improveText(currentPage.transcript, apiKey, model);
    currentPage.transcript = improvedText;
    transcriptArea.value = improvedText;
    
    // Save updated project
    const storableProject = {
      ...state.project,
      pages: state.project.pages.map(p => ({
        imageSrc: p.image ? p.image.src : null,
        transcript: p.transcript,
        status: p.status,
        originalText: p.originalText || null
      }))
    };
    await saveProject(storableProject);
    
    hideStatus();
    alert('Text improvement complete!');
  } catch (err) {
    console.error('Text improvement error:', err);
    alert('Failed to improve text. Please check your API key and try again.');
    hideStatus();
  }
  
  improveTextBtn.disabled = false;
  improveTextBtn.textContent = 'Improve Text Quality';
});

async function improveText(text, apiKey, model = 'gpt-4o-mini') {
  const prompt = `Please improve this text by:
1. Fixing spelling errors and typos
2. Correcting grammar and punctuation
3. Improving readability while preserving the original meaning
4. Maintaining the author's voice and style
5. Preserving paragraph breaks and structure

Please return only the improved text, nothing else.

Text to improve:
${text}`;

  const payload = {
    model,
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant that improves text quality while preserving the original meaning and style.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  
  if (!res.ok) {
    let detail = '';
    try {
      const errJson = await res.json();
      detail = errJson.error?.message || JSON.stringify(errJson);
    } catch {
      detail = await res.text();
    }
    throw new Error(`OpenAI API error: ${res.status} ${res.statusText}: ${detail}`);
  }
  
  const json = await res.json();
  const improvedText = json.choices?.[0]?.message?.content?.trim() || text;
  return improvedText;
}

// Remove readonly from transcript area
transcriptArea.removeAttribute('readonly');