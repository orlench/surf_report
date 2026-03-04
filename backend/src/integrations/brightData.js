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

async function callRemoteMcp(toolName, toolArgs, timeoutMs = 25000) {
  const apiKey = process.env.BRIGHT_DATA_API_KEY;
  if (!apiKey) throw new Error('BRIGHT_DATA_API_KEY not set');

  let response;
  try {
    response = await axios.post(
      `${MCP_ENDPOINT}?token=${apiKey}&pro=1`,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: toolName, arguments: toolArgs }
      },
      {
        timeout: timeoutMs,
        responseType: 'text',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        }
      }
    );
  } catch (err) {
    if (err.response) {
      throw new Error(`Remote MCP HTTP ${err.response.status}: ${String(err.response.data).substring(0, 200)}`);
    }
    throw err;
  }

  return parseResponse(response);
}

function parseResponse(response) {
  const contentType = response.headers['content-type'] || '';
  let msg;

  if (contentType.includes('text/event-stream')) {
    // SSE format: find "data: {...}" line with a result or error
    for (const line of response.data.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed.result !== undefined || parsed.error) { msg = parsed; break; }
      } catch (_) {}
    }
  } else {
    try {
      msg = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    } catch (_) {
      throw new Error(`Failed to parse MCP response: ${String(response.data).substring(0, 200)}`);
    }
  }

  if (!msg) throw new Error('Empty response from remote MCP');
  if (msg.error) throw new Error(`MCP tool error: ${msg.error.message || JSON.stringify(msg.error)}`);

  const content = msg.result?.content;
  return Array.isArray(content) ? content.map(c => c.text || '').join('\n') : '';
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
