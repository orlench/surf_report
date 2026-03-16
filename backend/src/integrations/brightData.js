const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Bright Data Remote MCP Integration
 *
 * Calls Bright Data's hosted MCP server over HTTP — no child processes,
 * no semaphore, all scrapers run fully in parallel.
 *
 * Required env var: BRIGHT_DATA_API_KEY
 */

const MCP_ENDPOINT = 'https://mcp.brightdata.com/mcp';

async function post(url, body, headers = {}, timeoutMs = 10000) {
  try {
    return await axios.post(url, body, {
      timeout: timeoutMs,
      responseType: 'text',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        ...headers
      }
    });
  } catch (err) {
    if (err.response) {
      throw new Error(`MCP HTTP ${err.response.status}: ${String(err.response.data).substring(0, 300)}`);
    }
    throw err;
  }
}

function extractResult(msg) {
  if (!msg) throw new Error('No MCP response message');
  if (msg.error) throw new Error(`MCP error: ${msg.error.message || JSON.stringify(msg.error)}`);
  const content = msg.result?.content;
  return Array.isArray(content) ? content.map(c => c.text || '').join('\n') : '';
}

function parseResponse(response, targetId) {
  const ct = response.headers['content-type'] || '';

  const findById = (parsed) => {
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr.find(m => m.id === targetId) || (arr.length === 1 ? arr[0] : null);
  };

  if (ct.includes('text/event-stream')) {
    for (const line of response.data.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        const found = findById(JSON.parse(raw));
        if (found) return extractResult(found);
      } catch (_) {}
    }
    throw new Error(`MCP: id:${targetId} not found in SSE stream`);
  }

  try {
    const parsed = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    const found = findById(parsed);
    return extractResult(found);
  } catch (e) {
    if (e.message.startsWith('MCP')) throw e;
    throw new Error(`MCP parse error: ${String(response.data).substring(0, 300)}`);
  }
}

async function callRemoteMcp(toolName, toolArgs, timeoutMs = 25000) {
  const apiKey = process.env.BRIGHT_DATA_API_KEY;
  if (!apiKey) throw new Error('BRIGHT_DATA_API_KEY not set');

  const authHeaders = { 'Authorization': `Bearer ${apiKey}` };

  // Step 1: Initialize (required by MCP protocol before tools/call)
  const initResp = await post(MCP_ENDPOINT, {
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'surf-report', version: '1.0.0' }
    }
  }, authHeaders, 10000);

  const sessionId = initResp.headers['mcp-session-id'];
  const sessionHeaders = { ...authHeaders, ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}) };

  // Step 2: Notify initialized
  await post(MCP_ENDPOINT, { jsonrpc: '2.0', method: 'notifications/initialized', params: {} }, sessionHeaders, 5000).catch(() => {});

  // Step 3: Call the tool
  const toolResp = await post(MCP_ENDPOINT, {
    jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: { name: toolName, arguments: toolArgs }
  }, sessionHeaders, timeoutMs);

  return parseResponse(toolResp, 2);
}

/**
 * Scrape a URL and return content as markdown.
 */
async function scrapeAsMarkdown(url) {
  logger.info(`[Bright Data] Scraping: ${url}`);
  const result = await callRemoteMcp('scrape_as_markdown', { url });
  if (!result || result.includes('execution failed') || result.includes('status code 401') || result.includes('status code 403')) {
    throw new Error(`Web Unlocker failed for ${url}: ${result ? result.substring(0, 200) : 'empty'}`);
  }
  logger.info(`[Bright Data] Scraped ${url} (${result.length} chars)`);
  return result;
}

/**
 * Search the web and return results.
 */
async function searchEngine(query, engine = 'google') {
  logger.info(`[Bright Data] Searching ${engine} for: ${query}`);
  const result = await callRemoteMcp('search_engine', { query, engine }, 20000);
  logger.info(`[Bright Data] Search complete (${result.length} chars)`);
  return result;
}

module.exports = { scrapeAsMarkdown, searchEngine };
