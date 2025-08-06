// pdf_renderer.js
// Utilities to load a PDF file (File object) and render each page to an Image object

const CDN_TRIES = [
  // Older stable ES5 build
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/build',
  // jsDelivr equivalent
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build',
];
let pdfjsReady;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  if (pdfjsReady) return pdfjsReady;

  pdfjsReady = (async () => {
    let lastErr;
    for (const base of CDN_TRIES) {
      try {
        await loadScript(`${base}/pdf.min.js`);
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.min.js`;
          return window.pdfjsLib;
        }
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Unable to load pdf.js from any CDN');
  })();

  return pdfjsReady;
}

export async function loadPdfAsImages(file) {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const renderContext = {
      canvasContext: ctx,
      viewport,
    };
    await page.render(renderContext).promise;
    const img = await canvasToImage(canvas);
    images.push(img);
  }
  return images;
}

function canvasToImage(canvas) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = canvas.toDataURL('image/png');
  });
}
