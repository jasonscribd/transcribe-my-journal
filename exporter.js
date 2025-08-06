// exporter.js
// Utilities to export transcript data to various formats.

export function exportTxt(pages) {
  const text = pages
    .map((p, idx) => `Page ${idx + 1}\n\n${p.transcript || ''}\n`)
    .join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  triggerDownload(blob, 'transcript.txt');
}

export async function exportDocx(pages) {
  if (!window.docx) {
    alert('docx library not loaded');
    return;
  }
  const { Document, Packer, Paragraph } = window.docx;
  const doc = new Document();
  pages.forEach((p, idx) => {
    doc.addSection({
      properties: {},
      children: [
        new Paragraph({ text: `Page ${idx + 1}`, heading: 'Heading1' }),
        ...p.transcript
          .split(/\n+/)
          .map((line) => new Paragraph({ text: line })),
      ],
    });
  });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, 'transcript.docx');
}

export async function exportGoogleDocs(pages) {
  // Ensure token client initialized
  if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
    alert('Google Identity Services not loaded');
    return;
  }

  const SCOPES = 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file';
  const clientId = prompt(
    'Enter your Google OAuth Client ID (for Drive API). This is stored only for this session:'
  );
  if (!clientId) return;

  const tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (tokenResponse) => {
      if (tokenResponse.error) {
        console.error(tokenResponse);
        alert('Google auth failed');
        return;
      }
      const accessToken = tokenResponse.access_token;
      createGoogleDoc(pages, accessToken);
    },
  });

  tokenClient.requestAccessToken();
}

async function createGoogleDoc(pages, accessToken) {
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Handwritten Transcript' }),
  });
  const docMeta = await createRes.json();
  const docId = docMeta.documentId;

  // Build requests to insert text
  const content = pages
    .map((p, idx) => `Page ${idx + 1}\n\n${p.transcript || ''}\n\n`)
    .join('\n');

  await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{ insertText: { location: { index: 1 }, text: content } }],
    }),
  });

  window.open(`https://docs.google.com/document/d/${docId}`, '_blank');
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
