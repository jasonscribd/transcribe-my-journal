// openai.js
// Lightweight wrapper for calling the OpenAI vision model via fetch

export async function transcribeImage(dataUrl, apiKey, model = 'gpt-4o-mini', prompt = '', maxTokens = 1000) {
  const payload = {
    model,
    max_tokens: parseInt(maxTokens),
    messages: [
      {
        role: 'system',
        content:
          prompt ||
          'You are an expert editor who turns handwritten journal entries into clean, well-punctuated plain text. Fix spelling errors, add punctuation, make educated guesses about wrongly transcribed words based on context, and add frequent paragraph breaks to make the text more readable. Preserve the author\'s original words and their order.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Please transcribe the handwritten text in this image, adding appropriate paragraph breaks and improving readability while preserving the original meaning.',
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
