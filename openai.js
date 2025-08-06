// openai.js
// Lightweight wrapper for calling the OpenAI vision model via fetch

export async function transcribeImage(dataUrl, apiKey, model = 'gpt-4o-mini', prompt = '') {
  // Convert dataURL to base64 without prefix
  const base64 = dataUrl.split(',')[1];
  const payload = {
    model,
    messages: [
      {
        role: 'system',
        content: prompt || 'You are a helpful assistant that transcribes handwritten text.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              mime_type: 'image/png',
              data: base64,
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
    throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content?.trim() || '';
  return text;
}
