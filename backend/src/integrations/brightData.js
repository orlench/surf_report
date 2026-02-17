const { spawn } = require('child_process');
const logger = require('../utils/logger');

/**
 * Bright Data MCP Integration - Direct MCP client
 *
 * Communicates with the @brightdata/mcp server directly via JSON-RPC over stdio.
 * Uses two products:
 *   - Web Unlocker (scrape_as_markdown) for simple sites
 *   - Scraping Browser (navigate + snapshot) for sites that block Web Unlocker
 *
 * Required env var: BRIGHT_DATA_API_KEY
 */

function sendMessage(stdin, obj) {
  stdin.write(JSON.stringify(obj) + '\n');
}

/**
 * Spawn an MCP server and run a single tool call.
 */
function callMcpTool(toolName, toolArgs, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.BRIGHT_DATA_API_KEY;
    if (!apiKey) return reject(new Error('BRIGHT_DATA_API_KEY not set'));

    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'npx.cmd' : 'npx';
    const mcpServer = spawn(cmd, ['@brightdata/mcp'], {
      env: { ...process.env, API_TOKEN: apiKey, PRO_MODE: 'true' },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdoutBuffer = '';
    let initDone = false;
    let settled = false;

    const finish = (err, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { mcpServer.kill('SIGTERM'); } catch (_) {}
      if (err) reject(err);
      else resolve(result);
    };

    const timer = setTimeout(() => {
      finish(new Error(`MCP tool call timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    mcpServer.on('error', (err) => finish(new Error(`Spawn failed: ${err.message}`)));
    mcpServer.on('close', (code) => {
      if (!settled) finish(new Error(`MCP server exited with code ${code}`));
    });

    mcpServer.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let msg;
        try { msg = JSON.parse(trimmed); } catch (_) { continue; }

        if (msg.id === 1 && msg.result && !initDone) {
          initDone = true;
          sendMessage(mcpServer.stdin, { jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
          sendMessage(mcpServer.stdin, {
            jsonrpc: '2.0', id: 2, method: 'tools/call',
            params: { name: toolName, arguments: toolArgs }
          });
        } else if (msg.id === 2) {
          if (msg.error) {
            finish(new Error(`MCP tool error: ${msg.error.message || JSON.stringify(msg.error)}`));
          } else {
            const content = msg.result?.content;
            const text = Array.isArray(content) ? content.map(c => c.text || '').join('\n') : '';
            finish(null, text);
          }
        } else if (msg.error) {
          finish(new Error(`MCP error: ${msg.error.message || JSON.stringify(msg.error)}`));
        }
      }
    });

    mcpServer.stderr.on('data', (chunk) => {
      const text = chunk.toString().trim();
      if (text) logger.debug(`[Bright Data MCP stderr] ${text}`);
    });

    sendMessage(mcpServer.stdin, {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'surf-report', version: '1.0.0' } }
    });
  });
}

/**
 * Spawn an MCP server and run multiple tool calls sequentially in one session.
 * Needed for Scraping Browser: navigate → snapshot.
 */
function callMcpToolsInSession(toolCalls, extraEnv = {}, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.BRIGHT_DATA_API_KEY;
    if (!apiKey) return reject(new Error('BRIGHT_DATA_API_KEY not set'));

    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'npx.cmd' : 'npx';
    const mcpServer = spawn(cmd, ['@brightdata/mcp'], {
      env: { ...process.env, API_TOKEN: apiKey, PRO_MODE: 'true', ...extraEnv },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdoutBuffer = '';
    let initDone = false;
    let settled = false;
    let currentIdx = 0;
    const results = [];

    const finish = (err, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { mcpServer.kill('SIGTERM'); } catch (_) {}
      if (err) reject(err);
      else resolve(result);
    };

    const timer = setTimeout(() => {
      finish(new Error(`MCP session timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    mcpServer.on('error', (err) => finish(new Error(`Spawn failed: ${err.message}`)));
    mcpServer.on('close', (code) => {
      if (!settled) finish(new Error(`MCP server exited with code ${code}`));
    });

    function sendNextToolCall() {
      sendMessage(mcpServer.stdin, {
        jsonrpc: '2.0',
        id: 10 + currentIdx,
        method: 'tools/call',
        params: {
          name: toolCalls[currentIdx].name,
          arguments: toolCalls[currentIdx].arguments || {}
        }
      });
    }

    mcpServer.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let msg;
        try { msg = JSON.parse(trimmed); } catch (_) { continue; }

        // Initialize response
        if (msg.id === 1 && msg.result && !initDone) {
          initDone = true;
          sendMessage(mcpServer.stdin, { jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
          sendNextToolCall();
        }
        // Tool call response
        else if (msg.id >= 10 && msg.id < 10 + toolCalls.length) {
          if (msg.error) {
            finish(new Error(`Tool '${toolCalls[msg.id - 10].name}' error: ${msg.error.message || JSON.stringify(msg.error)}`));
            return;
          }
          const content = msg.result?.content;
          const text = Array.isArray(content) ? content.map(c => c.text || '').join('\n') : '';
          results.push(text);

          currentIdx++;
          if (currentIdx < toolCalls.length) {
            sendNextToolCall();
          } else {
            finish(null, results);
          }
        }
        else if (msg.error) {
          finish(new Error(`MCP error: ${msg.error.message || JSON.stringify(msg.error)}`));
        }
      }
    });

    mcpServer.stderr.on('data', (chunk) => {
      const text = chunk.toString().trim();
      if (text) logger.debug(`[Bright Data MCP stderr] ${text}`);
    });

    sendMessage(mcpServer.stdin, {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'surf-report', version: '1.0.0' } }
    });
  });
}

/**
 * Scrape a URL using the Scraping Browser (navigate + snapshot).
 * Used for sites that block Web Unlocker.
 */
async function scrapeWithBrowser(url) {
  logger.info(`[Bright Data] Browser scraping: ${url}`);
  const results = await callMcpToolsInSession([
    { name: 'scraping_browser_navigate', arguments: { url } },
    { name: 'scraping_browser_snapshot', arguments: {} }
  ], {}, 120000);

  const content = results[1]; // snapshot is the second call

  // Check if the result is actually an error message from the MCP tool
  if (content && (content.includes('execution failed') || content.includes('status code 401') || content.includes('status code 403'))) {
    logger.error(`[Bright Data] Browser scrape returned error for ${url}: ${content.substring(0, 200)}`);
    throw new Error(`Browser scrape failed for ${url}: ${content.substring(0, 200)}`);
  }

  logger.info(`[Bright Data] Browser scraped ${url} (${content.length} chars)`);
  return content;
}

/**
 * Scrape a URL and return content as markdown.
 * Tries Web Unlocker first (fast), falls back to Scraping Browser for blocked sites.
 */
async function scrapeAsMarkdown(url) {
  logger.info(`[Bright Data] Scraping: ${url}`);

  // Try Web Unlocker first (scrape_as_markdown)
  try {
    const result = await callMcpTool('scrape_as_markdown', { url }, 90000);
    if (result && !result.includes('execution failed') && !result.includes('status code 401') && !result.includes('status code 403')) {
      logger.info(`[Bright Data] Scraped ${url} via Web Unlocker (${result.length} chars)`);
      return result;
    }
    logger.warn(`[Bright Data] Web Unlocker returned error for ${url}: ${result ? result.substring(0, 200) : 'empty'}`);
  } catch (err) {
    logger.warn(`[Bright Data] Web Unlocker error for ${url}: ${err.message}, trying Scraping Browser`);
  }

  // Fallback to Scraping Browser (navigate + snapshot)
  return scrapeWithBrowser(url);
}

/**
 * Search the web and return results
 */
async function searchEngine(query, engine = 'google') {
  logger.info(`[Bright Data] Searching ${engine} for: ${query}`);
  const result = await callMcpTool('search_engine', { query, engine }, 60000);
  logger.info(`[Bright Data] Search complete (${result.length} chars)`);
  return result;
}

module.exports = { scrapeAsMarkdown, scrapeWithBrowser, searchEngine };
