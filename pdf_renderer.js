// pdf_renderer.js
// Utilities to load a PDF file (File object) and render each page to an Image object

const PDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.269';
let pdfjsReady;

function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsReady) return pdfjsReady;

  pdfjsReady = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${PDF_CDN}/pdf.min.js`;
    script.onload = () => {
      const lib = window.pdfjsLib;
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc = `${PDF_CDN}/pdf.worker.min.js`;
        resolve(lib);
      } else {
        reject(new Error('pdfjsLib not found after script load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load pdf.js'));
    document.head.appendChild(script);
  });

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
