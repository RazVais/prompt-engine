require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const apiKey = process.env.GEMINI_API_KEY;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.redirect('/prompt_eng.html'));

if (!apiKey) {
  console.warn('WARNING: GEMINI_API_KEY is not set. /api/generate will fail until configured.');
}

// Simple in-process fixed-window rate limiter for /api/generate.
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX, 10) || 20;
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000;
const rateBuckets = new Map();

function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip;
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    bucket = { count: 0, windowStart: now };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((bucket.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);
    res.set('Retry-After', String(Math.max(retryAfter, 1)));
    return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
  }
  next();
}

async function fetchGemini(payload) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = await response.json();
  return { response, json };
}

app.post('/api/generate', rateLimit, async (req, res) => {
  const { prompt, systemInstruction } = req.body;
  if (!prompt || !systemInstruction) {
    return res.status(400).json({ error: 'Missing prompt or systemInstruction in request body.' });
  }
  if (!apiKey) {
    return res.status(500).json({ error: 'Server missing GEMINI_API_KEY environment variable.' });
  }

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 8192,
      topP: 1.0,
      candidateCount: 1
    }
  };

  let attempt = 0;
  let delay = 1000;
  while (attempt < 5) {
    try {
      const { response, json } = await fetchGemini(payload);
      if (!response.ok) {
        const details = json?.error || json;
        throw new Error(`Gemini returned ${response.status}: ${JSON.stringify(details)}`);
      }

      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text || typeof text !== 'string') {
        throw new Error(`Invalid Gemini response format: ${JSON.stringify(json)}`);
      }

      return res.json({ text });
    } catch (error) {
      attempt += 1;
      if (attempt >= 5) {
        console.error('Gemini API failed:', error);
        return res.status(502).json({ error: 'Failed to generate content from Gemini.', details: error.message });
      }
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
