const logger = require('../utils/logger');

class BrightDataSseClient {
  constructor(options = {}) {
    this.sseUrl = options.sseUrl || process.env.BRIGHT_DATA_MCP_SSE_URL || '';
    this.endpointBase = options.endpointBase || deriveEndpointBase(this.sseUrl);
    this.requestTimeoutMs = options.requestTimeoutMs || 30000;
    this.pending = new Map();
    this.nextId = 1;
    this.endpointPath = null;
    this.reader = null;
    this.stream = null;
    this.connected = false;
    this.initialized = false;
    this.aborted = false;
    this.controller = null;
  }

  async connect() {
    if (this.connected) return;
    if (!this.sseUrl) {
      throw new Error('BRIGHT_DATA_MCP_SSE_URL not set');
    }

    this.controller = new AbortController();
    const response = await fetchWithTimeout(this.sseUrl, {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
      signal: this.controller.signal,
    }, this.requestTimeoutMs);

    if (!response.ok || !response.body) {
      throw new Error(`Bright Data SSE connection failed: HTTP ${response.status}`);
    }

    this.reader = response.body.getReader();
    this.stream = response;
    this.connected = true;
    this.aborted = false;
    this.readLoopPromise = this.readLoop().catch((error) => {
      if (!this.aborted) {
        logger.warn(`[BrightDataSse] Read loop ended: ${error.message}`);
      }
    });

    this.endpointPath = await this.waitForEndpoint();
    await this.initialize();
    logger.info(`[BrightDataSse] Connected (${this.endpointPath})`);
  }

  async close() {
    this.aborted = true;
    if (this.controller) {
      this.controller.abort();
    }

    const pending = Array.from(this.pending.values());
    this.pending.clear();
    for (const entry of pending) {
      entry.reject(new Error('Bright Data SSE client closed'));
    }

    try {
      await this.readLoopPromise;
    } catch (_) {
      // Ignore errors during shutdown.
    }

    this.connected = false;
    this.initialized = false;
    this.endpointPath = null;
    this.reader = null;
    this.stream = null;
    this.readLoopPromise = null;
  }

  async searchEngine(query, options = {}) {
    return this.callTool('search_engine', {
      query,
      engine: options.engine || 'google',
      geo_location: options.geoLocation || undefined,
    });
  }

  async scrapeAsMarkdown(url) {
    return this.callTool('scrape_as_markdown', { url });
  }

  async scrapeAsHtml(url) {
    return this.callTool('scrape_as_html', { url });
  }

  async callTool(name, args) {
    await this.connect();
    const id = this.allocateId();
    const payload = {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name,
        arguments: pruneUndefined(args),
      },
    };

    const resultPromise = this.createPendingRequest(id, `tools/call:${name}`);

    await this.postMessage(payload);
    const result = await resultPromise;
    return extractToolText(result);
  }

  async initialize() {
    if (this.initialized) return;

    const initId = this.allocateId();
    const initResult = this.createPendingRequest(initId, 'initialize');

    await this.postMessage({
      jsonrpc: '2.0',
      id: initId,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'surf-report-spot-metadata',
          version: '1.0.0',
        },
      },
    });

    await initResult;

    await this.postMessage({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {},
    });

    this.initialized = true;
  }

  allocateId() {
    return this.nextId++;
  }

  createPendingRequest(id, label) {
    const promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`Bright Data request timed out: ${label}`));
      }, this.requestTimeoutMs);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
    promise.catch(() => {});
    return promise;
  }

  async postMessage(payload) {
    const endpoint = this.getEndpointUrl();
    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }, this.requestTimeoutMs);

    if (!response.ok && response.status !== 202) {
      const text = await response.text().catch(() => '');
      throw new Error(`Bright Data message POST failed: HTTP ${response.status} ${text.slice(0, 200)}`);
    }
  }

  getEndpointUrl() {
    if (!this.endpointPath) {
      throw new Error('Bright Data endpoint path not ready');
    }
    return new URL(this.endpointPath, this.endpointBase).toString();
  }

  async waitForEndpoint(timeoutMs = 15000) {
    const started = Date.now();
    while (!this.endpointPath) {
      if (Date.now() - started > timeoutMs) {
        throw new Error('Timed out waiting for Bright Data SSE endpoint');
      }
      await sleep(100);
    }
    return this.endpointPath;
  }

  async readLoop() {
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = null;

    while (this.reader) {
      let chunk;
      try {
        chunk = await this.reader.read();
      } catch (error) {
        if (this.aborted) return;
        this.rejectAll(error);
        throw error;
      }

      if (chunk.done) {
        if (!this.aborted) {
          this.rejectAll(new Error('Bright Data SSE stream ended unexpectedly'));
        }
        return;
      }

      buffer += decoder.decode(chunk.value, { stream: true });
      let boundary = buffer.indexOf('\n');
      while (boundary !== -1) {
        const rawLine = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 1);
        const line = rawLine.replace(/\r$/, '');

        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          this.handleEvent(currentEvent, data);
        } else if (line === '') {
          currentEvent = null;
        }

        boundary = buffer.indexOf('\n');
      }
    }
  }

  handleEvent(eventName, data) {
    if (eventName === 'endpoint') {
      this.endpointPath = data;
      return;
    }

    if (eventName !== 'message') {
      return;
    }

    let payload;
    try {
      payload = JSON.parse(data);
    } catch (error) {
      logger.warn(`[BrightDataSse] Failed to parse message: ${error.message}`);
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(payload, 'id')) {
      return;
    }

    const pending = this.pending.get(payload.id);
    if (!pending) {
      return;
    }

    this.pending.delete(payload.id);
    if (payload.error) {
      pending.reject(new Error(payload.error.message || JSON.stringify(payload.error)));
      return;
    }
    pending.resolve(payload.result);
  }

  rejectAll(error) {
    const pending = Array.from(this.pending.values());
    this.pending.clear();
    for (const entry of pending) {
      entry.reject(error);
    }
  }
}

function deriveEndpointBase(sseUrl) {
  if (!sseUrl) return 'https://mcp.brightdata.com';
  const url = new URL(sseUrl);
  return `${url.protocol}//${url.host}`;
}

function extractToolText(result) {
  const content = result?.content;
  if (!Array.isArray(content)) {
    return '';
  }
  return content.map((item) => item?.text || '').join('\n');
}

function pruneUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(pruneUndefined);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, pruneUndefined(item)])
    );
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);

  if (options?.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeout);
      controller.abort(options.signal.reason);
    } else {
      options.signal.addEventListener('abort', () => controller.abort(options.signal.reason), { once: true });
    }
  }

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { BrightDataSseClient, extractToolText };
