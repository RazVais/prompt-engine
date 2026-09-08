require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.redirect('/prompt_eng.html'));

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

const DEFAULT_PROVIDER = 'gemini';
const PROVIDER_IDS = ['gemini', 'anthropic', 'openai', 'grok'];

const PROVIDER_ENV = {
  gemini: 'GEMINI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  grok: 'XAI_API_KEY'
};

const MODEL_NAME_RE = /^[A-Za-z0-9._:\-]{1,100}$/;

function keyFor(id) {
  return process.env[PROVIDER_ENV[id]] || '';
}

function isConfigured(id) {
  return Boolean(keyFor(id));
}

// An OpenAI-compatible chat-completions provider (OpenAI itself and xAI Grok).
function openAiCompatible({ id, label, url, models, defaultModel, maxTokens }) {
  return {
    label,
    envKey: PROVIDER_ENV[id],
    models,
    defaultModel,
    temperature: { min: 0, max: 2, default: 0, step: 0.1 },
    maxTokens,
    buildRequest({ model, system, prompt, temperature, maxTokens: max }) {
      const body = {
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ],
        max_tokens: max
      };
      if (typeof temperature === 'number') {
        body.temperature = temperature;
      }
      return {
        url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keyFor(id)}`
        },
        body
      };
    },
    extractText(json) {
      return json && json.choices && json.choices[0] && json.choices[0].message
        ? json.choices[0].message.content
        : undefined;
    }
  };
}

const PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    envKey: PROVIDER_ENV.gemini,
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    get defaultModel() {
      return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    },
    temperature: { min: 0, max: 2, default: 0, step: 0.1 },
    maxTokens: { min: 256, max: 8192, default: 8192 },
    buildRequest({ model, system, prompt, temperature, maxTokens }) {
      const generationConfig = {
        maxOutputTokens: maxTokens,
        topP: 1.0,
        candidateCount: 1
      };
      if (typeof temperature === 'number') {
        generationConfig.temperature = temperature;
      }
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyFor('gemini')}`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: system }] },
          generationConfig
        }
      };
    },
    extractText(json) {
      return json &&
        json.candidates &&
        json.candidates[0] &&
        json.candidates[0].content &&
        json.candidates[0].content.parts &&
        json.candidates[0].content.parts[0]
        ? json.candidates[0].content.parts[0].text
        : undefined;
    }
  },

  anthropic: {
    label: 'Anthropic Claude',
    envKey: PROVIDER_ENV.anthropic,
    models: ['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5', 'claude-fable-5-1'],
    defaultModel: 'claude-sonnet-5',
    // Current Claude models reject a `temperature` param, so this provider
    // never accepts one. Always advertised as null in /api/providers.
    temperature: null,
    maxTokens: { min: 256, max: 64000, default: 8192 },
    buildRequest({ model, system, prompt, maxTokens }) {
      return {
        url: 'https://api.anthropic.com/v1/messages',
        headers: {
          'content-type': 'application/json',
          'x-api-key': keyFor('anthropic'),
          'anthropic-version': '2023-06-01'
        },
        body: {
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: prompt }]
        }
      };
    },
    extractText(json) {
      return (json && Array.isArray(json.content) ? json.content : [])
        .filter((b) => b && b.type === 'text')
        .map((b) => b.text)
        .join('');
    }
  },

  openai: openAiCompatible({
    id: 'openai',
    label: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'],
    defaultModel: 'gpt-4.1',
    maxTokens: { min: 256, max: 16384, default: 8192 }
  }),

  grok: openAiCompatible({
    id: 'grok',
    label: 'xAI Grok',
    url: 'https://api.x.ai/v1/chat/completions',
    models: ['grok-4', 'grok-3', 'grok-3-mini'],
    defaultModel: 'grok-4',
    maxTokens: { min: 256, max: 16384, default: 8192 }
  })
};

// ---------------------------------------------------------------------------
// Startup configuration warnings
// ---------------------------------------------------------------------------

const configuredProviders = PROVIDER_IDS.filter(isConfigured);
const unconfiguredProviders = PROVIDER_IDS.filter((id) => !isConfigured(id));

if (unconfiguredProviders.length > 0) {
  const list = unconfiguredProviders
    .map((id) => `${PROVIDERS[id].label} (${PROVIDER_ENV[id]})`)
    .join(', ');
  console.warn(`WARNING: These providers are not configured and are disabled: ${list}.`);
}
if (configuredProviders.length === 0) {
  console.warn(
    'WARNING: No provider API keys are set. POST /api/generate will fail for every provider until at least one key is configured.'
  );
}

// ---------------------------------------------------------------------------
// Rate limiter (simple in-process fixed-window, per IP, /api/generate only)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Resolve the temperature to send upstream. Returns undefined when the provider
// does not accept a temperature param (in which case it must be omitted).
function resolveTemperature(provider, raw) {
  if (!provider.temperature) return undefined;
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : provider.temperature.default;
  return clamp(n, provider.temperature.min, provider.temperature.max);
}

// Resolve max tokens: clamp integers into range, fall back to default otherwise.
function resolveMaxTokens(provider, raw) {
  if (!Number.isInteger(raw)) return provider.maxTokens.default;
  return clamp(raw, provider.maxTokens.min, provider.maxTokens.max);
}

// Single generic upstream call. Never logs or embeds the request URL or API key
// (Gemini's key travels in the URL) in any thrown error.
async function callProvider(id, opts) {
  const provider = PROVIDERS[id];
  const { url, headers, body } = provider.buildRequest(opts);

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  let json = null;
  try {
    json = await response.json();
  } catch (_) {
    json = null;
  }

  if (!response.ok) {
    const detail = json && json.error !== undefined ? json.error : json;
    throw new Error(
      `${provider.label} returned ${response.status}: ${JSON.stringify(detail).slice(0, 500)}`
    );
  }

  const text = provider.extractText(json);
  if (!text || typeof text !== 'string') {
    throw new Error(`${provider.label} returned an invalid response format.`);
  }
  return text;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/api/providers', (req, res) => {
  res.json({
    defaultProvider: DEFAULT_PROVIDER,
    providers: PROVIDER_IDS.map((id) => {
      const p = PROVIDERS[id];
      return {
        id,
        label: p.label,
        available: isConfigured(id),
        models: p.models,
        defaultModel: p.defaultModel,
        temperature: p.temperature,
        maxTokens: p.maxTokens
      };
    })
  });
});

app.post('/api/generate', rateLimit, async (req, res) => {
  const { prompt, systemInstruction } = req.body || {};

  if (
    typeof prompt !== 'string' ||
    !prompt.trim() ||
    typeof systemInstruction !== 'string' ||
    !systemInstruction.trim()
  ) {
    return res.status(400).json({ error: 'Missing prompt or systemInstruction in request body.' });
  }

  const providerId = req.body.provider || DEFAULT_PROVIDER;
  const provider = PROVIDERS[providerId];
  if (!provider) {
    return res.status(400).json({ error: `Unknown provider: ${providerId}` });
  }
  if (!isConfigured(providerId)) {
    return res
      .status(400)
      .json({ error: `Provider ${providerId} is not configured (missing API key).` });
  }

  const model = req.body.model || provider.defaultModel;
  if (!MODEL_NAME_RE.test(model)) {
    return res.status(400).json({ error: 'Invalid model name.' });
  }

  const temperature = resolveTemperature(provider, req.body.temperature);
  const maxTokens = resolveMaxTokens(provider, req.body.maxTokens);

  const opts = { model, system: systemInstruction, prompt, temperature, maxTokens };

  let attempt = 0;
  let delay = 1000;
  while (attempt < 5) {
    try {
      const text = await callProvider(providerId, opts);
      return res.json({ text });
    } catch (error) {
      attempt += 1;
      if (attempt >= 5) {
        console.error(`${provider.label} generation failed after ${attempt} attempts:`, error.message);
        return res
          .status(502)
          .json({ error: `Failed to generate content from ${provider.label}.`, details: error.message });
      }
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

module.exports = {
  app,
  PROVIDERS,
  PROVIDER_IDS,
  DEFAULT_PROVIDER,
  MODEL_NAME_RE,
  isConfigured,
  resolveTemperature,
  resolveMaxTokens,
  callProvider
};
