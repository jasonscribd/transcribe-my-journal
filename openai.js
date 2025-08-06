// openai.js
// Lightweight wrapper for calling the OpenAI vision model via fetch

export async function transcribeImage(dataUrl, apiKey, model = 'gpt-4o-mini', prompt = '') {
  const payload = {
    model,
    messages: [
      {
        role: 'system',
        content:
          prompt ||
          'You are a helpful assistant that accurately transcribes any handwritten text you are shown into clear, well-punctuated plain text.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Please transcribe the handwritten text in this image.',
          },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl, // pass full data URL (base64)
            },
          },
        ],
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
  const text = json.choices?.[0]?.message?.content?.trim() || '';
  return text;
}
