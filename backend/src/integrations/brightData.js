const { exec } = require('child_process');
const util = require('util');
const logger = require('../utils/logger');

const execPromise = util.promisify(exec);

/**
 * Bright Data MCP Integration
 * Wraps the Claude CLI to call Bright Data MCP tools
 */

/**
 * Scrape a URL and return content as markdown
 * Uses Bright Data's scrape_as_markdown tool via Claude CLI
 *
 * @param {string} url - The URL to scrape
 * @returns {Promise<string>} - Scraped content in markdown format
 */
async function scrapeAsMarkdown(url) {
  try {
    logger.info(`[Bright Data] Scraping URL: ${url}`);

    const escapedUrl = url.replace(/"/g, '\\"');
    const prompt = `Scrape the webpage at ${escapedUrl} using the scrape_as_markdown tool and return only the markdown content, no additional commentary.`;

    // Use full path to claude command to avoid PATH issues
    const claudePath = 'C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd';
    const cmd = `echo. | "${claudePath}" --allowedTools "mcp__bright-data__scrape_as_markdown" --dangerously-skip-permissions --print -- "${prompt}"`;

    const { stdout, stderr } = await execPromise(cmd, {
      timeout: 60000, // 60 second timeout
      maxBuffer: 1024 * 1024 * 5, // 5MB buffer
      shell: true, // Use shell to execute .cmd file
      windowsHide: true // Hide console window on Windows
    });

    if (stderr) {
      logger.warn(`[Bright Data] stderr: ${stderr}`);
    }

    // Parse the markdown from Claude's response
    const markdown = extractMarkdownFromResponse(stdout);

    logger.info(`[Bright Data] Successfully scraped ${url} (${markdown.length} chars)`);
    return markdown;

  } catch (error) {
    logger.error(`[Bright Data] Failed to scrape ${url}:`, {
      message: error.message,
      stdout: error.stdout?.substring(0, 200),
      stderr: error.stderr?.substring(0, 200),
      killed: error.killed,
      signal: error.signal
    });
    throw new Error(`Scraping failed: ${error.message}`);
  }
}

/**
 * Search Google for a query and return results
 * Uses Bright Data's search_engine tool via Claude CLI
 *
 * @param {string} query - Search query
 * @param {string} engine - Search engine ('google', 'bing', 'yandex')
 * @returns {Promise<Array>} - Array of search results
 */
async function searchEngine(query, engine = 'google') {
  try {
    logger.info(`[Bright Data] Searching ${engine} for: ${query}`);

    const escapedQuery = query.replace(/"/g, '\\"');
    const prompt = `Search ${engine} for "${escapedQuery}" using the search_engine tool and return the top 5 results in a structured format.`;

    // Use full path to claude command to avoid PATH issues
    const claudePath = 'C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd';
    const cmd = `echo. | "${claudePath}" --allowedTools "mcp__bright-data__search_engine" --dangerously-skip-permissions --print -- "${prompt}"`;

    const { stdout, stderr } = await execPromise(cmd, {
      timeout: 60000, // 60 second timeout
      maxBuffer: 1024 * 1024 * 5,
      shell: true, // Use shell to execute .cmd file
      windowsHide: true // Hide console window on Windows
    });

    if (stderr) {
      logger.warn(`[Bright Data] stderr: ${stderr}`);
    }

    // Parse search results from response
    const results = extractSearchResultsFromResponse(stdout);

    logger.info(`[Bright Data] Found ${results.length} results for "${query}"`);
    return results;

  } catch (error) {
    logger.error(`[Bright Data] Search failed for "${query}":`, error.message);
    throw new Error(`Search failed: ${error.message}`);
  }
}

/**
 * Extract markdown content from Claude's response
 * Removes Claude's commentary and extracts just the markdown
 */
function extractMarkdownFromResponse(response) {
  // If response contains markdown code blocks, extract them
  const markdownBlockMatch = response.match(/```markdown\n([\s\S]*?)\n```/);
  if (markdownBlockMatch) {
    return markdownBlockMatch[1].trim();
  }

  // If no code block, return the whole response (Claude might return it directly)
  // Remove common Claude response patterns
  let cleaned = response
    .replace(/^(Here's|Here is|I'll|I've scraped).*?:/gim, '')
    .replace(/^The (content|markdown|page).*?:/gim, '')
    .trim();

  return cleaned;
}

/**
 * Extract search results from Claude's response
 */
function extractSearchResultsFromResponse(response) {
  // Try to parse JSON if present
  const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (e) {
      logger.warn('[Bright Data] Failed to parse JSON from response');
    }
  }

  // Fallback: parse markdown-formatted results
  const results = [];
  const lines = response.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Look for numbered list items with links: "1. **[Title](url)**"
    const match = line.match(/^\d+\.\s+\*?\*?\[(.+?)\]\((.+?)\)\*?\*?/);
    if (match) {
      results.push({
        title: match[1],
        url: match[2],
        description: lines[i + 1]?.trim() || ''
      });
    }
  }

  return results;
}

module.exports = {
  scrapeAsMarkdown,
  searchEngine
};
