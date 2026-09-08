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
    },
    // Non-stream response JSON -> {inputTokens, outputTokens} (or null).
    extractUsage(json) {
      const u = json && json.usage;
      if (!u) return null;
      const out = {};
      if (typeof u.prompt_tokens === 'number') out.inputTokens = u.prompt_tokens;
      if (typeof u.completion_tokens === 'number') out.outputTokens = u.completion_tokens;
      return Object.keys(out).length ? out : null;
    },
    buildStreamRequest(opts) {
      const base = this.buildRequest(opts);
      return {
        url: base.url,
        headers: base.headers,
        body: { ...base.body, stream: true, stream_options: { include_usage: true } }
      };
    },
    // One parsed SSE `data:` object -> text delta (or null).
    extractStreamDelta(json) {
      return json &&
        json.choices &&
        json.choices[0] &&
        json.choices[0].delta &&
        typeof json.choices[0].delta.content === 'string'
        ? json.choices[0].delta.content
        : null;
    },
    // Final usage-only chunk -> {inputTokens, outputTokens} (or null).
    extractStreamUsage(json) {
      const u = json && json.usage;
      if (!u) return null;
      const out = {};
      if (typeof u.prompt_tokens === 'number') out.inputTokens = u.prompt_tokens;
      if (typeof u.completion_tokens === 'number') out.outputTokens = u.completion_tokens;
      return Object.keys(out).length ? out : null;
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
    },
    extractUsage(json) {
      const u = json && json.usageMetadata;
      if (!u) return null;
      const out = {};
      if (typeof u.promptTokenCount === 'number') out.inputTokens = u.promptTokenCount;
      if (typeof u.candidatesTokenCount === 'number') out.outputTokens = u.candidatesTokenCount;
      return Object.keys(out).length ? out : null;
    },
    buildStreamRequest(opts) {
      const base = this.buildRequest(opts);
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:streamGenerateContent?alt=sse&key=${keyFor('gemini')}`,
        headers: base.headers,
        body: base.body
      };
    },
    extractStreamDelta(json) {
      const part =
        json &&
        json.candidates &&
        json.candidates[0] &&
        json.candidates[0].content &&
        json.candidates[0].content.parts &&
        json.candidates[0].content.parts[0];
      return part && typeof part.text === 'string' ? part.text : null;
    },
    extractStreamUsage(json) {
      const u = json && json.usageMetadata;
      if (!u) return null;
      const out = {};
      if (typeof u.promptTokenCount === 'number') out.inputTokens = u.promptTokenCount;
      if (typeof u.candidatesTokenCount === 'number') out.outputTokens = u.candidatesTokenCount;
      return Object.keys(out).length ? out : null;
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
    },
    extractUsage(json) {
      const u = json && json.usage;
      if (!u) return null;
      const out = {};
      if (typeof u.input_tokens === 'number') out.inputTokens = u.input_tokens;
      if (typeof u.output_tokens === 'number') out.outputTokens = u.output_tokens;
      return Object.keys(out).length ? out : null;
    },
    buildStreamRequest(opts) {
      const base = this.buildRequest(opts);
      return {
        url: base.url,
        headers: base.headers,
        body: { ...base.body, stream: true }
      };
    },
    extractStreamDelta(json) {
      return json &&
        json.type === 'content_block_delta' &&
        json.delta &&
        json.delta.type === 'text_delta' &&
        typeof json.delta.text === 'string'
        ? json.delta.text
        : null;
    },
    // Anthropic reports usage in two pieces: input_tokens on `message_start`
    // and the running output_tokens on `message_delta`. Return whichever piece
    // this chunk carries; streamProvider() accumulates them.
    extractStreamUsage(json) {
      if (
        json &&
        json.type === 'message_start' &&
        json.message &&
        json.message.usage
      ) {
        const u = json.message.usage;
        const out = {};
        if (typeof u.input_tokens === 'number') out.inputTokens = u.input_tokens;
        if (typeof u.output_tokens === 'number') out.outputTokens = u.output_tokens;
        return Object.keys(out).length ? out : null;
      }
      if (
        json &&
        json.type === 'message_delta' &&
        json.usage &&
        typeof json.usage.output_tokens === 'number'
      ) {
        return { outputTokens: json.usage.output_tokens };
      }
      return null;
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
// Pricing (APPROXIMATE — update from each provider's pricing page)
// ---------------------------------------------------------------------------
// USD per 1,000,000 tokens, { input, output }. Keyed by exact model id.
// Resolution (see priceFor) falls back to the longest PRICING key that is a
// prefix of the requested model, so dated snapshots such as
// "gpt-4.1-mini-2025-04-14" or "claude-sonnet-5-20991231" still resolve.
// These numbers drift — treat every estimate as a rough figure, not a bill.
const PRICING = {
  'gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'gemini-2.5-pro': { input: 1.25, output: 10.00 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-fable-5-1': { input: 10, output: 50 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'gpt-4o': { input: 2.50, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'grok-4': { input: 3, output: 15 },
  'grok-3': { input: 3, output: 15 },
  'grok-3-mini': { input: 0.30, output: 0.50 }
};

// Resolve a model id to its { input, output } price: exact match first, then the
// longest PRICING key that is a prefix of the id. Returns null when nothing matches.
function priceFor(model) {
  if (typeof model !== 'string' || !model) return null;
  if (PRICING[model]) return PRICING[model];
  let best = null;
  let bestLen = -1;
  for (const key of Object.keys(PRICING)) {
    if (model.startsWith(key) && key.length > bestLen) {
      best = PRICING[key];
      bestLen = key.length;
    }
  }
  return best;
}

// Estimated USD cost for a generation, rounded to 6 decimals. Returns null when
// the model is not priced (unknown — never guessed).
function estimateCostUsd(model, inputTokens, outputTokens) {
  const price = priceFor(model);
  if (!price) return null;
  const cost =
    ((Number(inputTokens) || 0) / 1e6) * price.input +
    ((Number(outputTokens) || 0) / 1e6) * price.output;
  return Math.round(cost * 1e6) / 1e6;
}

// Normalize a raw provider usage object ({inputTokens?, outputTokens?} or null)
// into the wire shape { inputTokens, outputTokens, estCostUsd } (missing counts
// -> 0, estCostUsd may be null). Returns null when the provider reported no
// token counts at all, so callers can omit `usage` entirely.
function buildUsagePayload(model, rawUsage) {
  if (
    !rawUsage ||
    (typeof rawUsage.inputTokens !== 'number' && typeof rawUsage.outputTokens !== 'number')
  ) {
    return null;
  }
  const inputTokens = Number(rawUsage.inputTokens) || 0;
  const outputTokens = Number(rawUsage.outputTokens) || 0;
  return {
    inputTokens,
    outputTokens,
    estCostUsd: estimateCostUsd(model, inputTokens, outputTokens)
  };
}

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

// Single generic upstream call. Resolves to { text, usage } where usage is a
// raw {inputTokens, outputTokens} object or null when the provider reported no
// token counts. Never logs or embeds the request URL or API key (Gemini's key
// travels in the URL) in any thrown error.
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

  const rawUsage =
    typeof provider.extractUsage === 'function' ? provider.extractUsage(json) : null;
  const usage =
    rawUsage &&
    (typeof rawUsage.inputTokens === 'number' || typeof rawUsage.outputTokens === 'number')
      ? rawUsage
      : null;

  return { text, usage };
}

// Streaming counterpart of callProvider. Opens a raw streaming request to the
// provider, parses the SSE body, and invokes onDelta(textChunk) for each chunk.
// Resolves to { usage } where usage is {inputTokens, outputTokens} or null when
// the provider reported none. Like callProvider, never logs or embeds the
// request URL or API key (Gemini's key travels in the URL) in a thrown error.
async function streamProvider(id, opts, onDelta) {
  const provider = PROVIDERS[id];
  const { url, headers, body } = provider.buildStreamRequest(opts);

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    let json = null;
    try {
      json = await response.json();
    } catch (_) {
      json = null;
    }
    const detail = json && json.error !== undefined ? json.error : json;
    throw new Error(
      `${provider.label} returned ${response.status}: ${JSON.stringify(detail).slice(0, 500)}`
    );
  }
  if (!response.body) {
    throw new Error(`${provider.label} returned an empty response stream.`);
  }

  let usage = null;
  const mergeUsage = (partial) => {
    if (!partial) return;
    usage = usage || {};
    if (typeof partial.inputTokens === 'number') usage.inputTokens = partial.inputTokens;
    if (typeof partial.outputTokens === 'number') usage.outputTokens = partial.outputTokens;
  };

  const handleLine = (rawLine) => {
    const line = rawLine.replace(/\r$/, '');
    if (!line || line.startsWith(':') || line.startsWith('event:')) return;
    if (!line.startsWith('data:')) return;
    const payload = line.slice(5).replace(/^ /, '');
    if (!payload || payload === '[DONE]') return;

    let json;
    try {
      json = JSON.parse(payload);
    } catch (_) {
      return;
    }

    // Surface a provider error object embedded in the stream.
    if (json && json.error) {
      const detail = typeof json.error === 'string' ? json.error : JSON.stringify(json.error).slice(0, 500);
      throw new Error(`${provider.label} stream error: ${detail}`);
    }

    const delta = provider.extractStreamDelta(json);
    if (typeof delta === 'string' && delta.length > 0) {
      onDelta(delta);
    }
    mergeUsage(provider.extractStreamUsage(json));
  };

  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const rawLine = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      handleLine(rawLine);
    }
  }
  buffer += decoder.decode();
  if (buffer) handleLine(buffer);

  const hasUsage =
    usage && (typeof usage.inputTokens === 'number' || typeof usage.outputTokens === 'number');
  return { usage: hasUsage ? usage : null };
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
      const { text, usage } = await callProvider(providerId, opts);
      const payload = { text };
      const usagePayload = buildUsagePayload(opts.model, usage);
      if (usagePayload) payload.usage = usagePayload;
      return res.json(payload);
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

// Parse + validate + clamp a /api/generate-shaped body. Returns
// { error, status } on failure or { providerId, provider, opts } on success.
function prepareGenerateRequest(reqBody) {
  const body = reqBody || {};
  const { prompt, systemInstruction } = body;

  if (
    typeof prompt !== 'string' ||
    !prompt.trim() ||
    typeof systemInstruction !== 'string' ||
    !systemInstruction.trim()
  ) {
    return { error: 'Missing prompt or systemInstruction in request body.', status: 400 };
  }

  const providerId = body.provider || DEFAULT_PROVIDER;
  const provider = PROVIDERS[providerId];
  if (!provider) {
    return { error: `Unknown provider: ${providerId}`, status: 400 };
  }
  if (!isConfigured(providerId)) {
    return { error: `Provider ${providerId} is not configured (missing API key).`, status: 400 };
  }

  const model = body.model || provider.defaultModel;
  if (!MODEL_NAME_RE.test(model)) {
    return { error: 'Invalid model name.', status: 400 };
  }

  const temperature = resolveTemperature(provider, body.temperature);
  const maxTokens = resolveMaxTokens(provider, body.maxTokens);

  return {
    providerId,
    provider,
    opts: { model, system: systemInstruction, prompt, temperature, maxTokens }
  };
}

// Streaming variant of /api/generate. Same body, validation and clamping;
// responds with Server-Sent Events:
//   data: {"delta":"<text>"}\n\n            per chunk
//   data: {"done":true,"usage":{...}}\n\n   terminal (usage omitted if unknown)
//   data: {"error":"<msg>","status":502}\n\n on failure
app.post('/api/generate/stream', rateLimit, async (req, res) => {
  const prepared = prepareGenerateRequest(req.body);
  if (prepared.error) {
    return res.status(prepared.status).json({ error: prepared.error });
  }
  const { providerId, provider, opts } = prepared;

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  let delivered = false;
  const onDelta = (text) => {
    delivered = true;
    send({ delta: text });
  };

  let attempt = 0;
  let delay = 1000;
  while (attempt < 5) {
    try {
      const { usage } = await streamProvider(providerId, opts, onDelta);
      const terminal = { done: true };
      const usagePayload = buildUsagePayload(opts.model, usage);
      if (usagePayload) terminal.usage = usagePayload;
      send(terminal);
      return res.end();
    } catch (error) {
      // Once any bytes have been streamed we cannot retry — the client has
      // already rendered a partial response.
      if (delivered) {
        console.error(`${provider.label} streaming failed mid-stream:`, error.message);
        send({ error: error.message, status: 502 });
        return res.end();
      }
      attempt += 1;
      if (attempt >= 5) {
        console.error(
          `${provider.label} streaming failed after ${attempt} attempts:`,
          error.message
        );
        send({ error: `Failed to generate content from ${provider.label}.`, status: 502 });
        return res.end();
      }
      console.warn(`Stream attempt ${attempt} failed, retrying in ${delay}ms...`);
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
  PRICING,
  priceFor,
  estimateCostUsd,
  buildUsagePayload,
  isConfigured,
  resolveTemperature,
  resolveMaxTokens,
  callProvider,
  streamProvider,
  prepareGenerateRequest
};
