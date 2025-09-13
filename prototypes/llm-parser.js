/**
 * LLM-Based Vocalist Parser Prototype
 * 
 * This prototype uses Claude API to naturally parse vocalist information
 * Falls back to rule-based parsing if LLM is unavailable
 */

/**
 * Main parsing function - LLM approach only
 * @param {string} vocalistsPart - The vocalist part of a section header
 * @param {Object} options - Options including API key
 * @returns {Promise<Object>} Dictionary with vocalist names as keys and formats as values
 */
async function parseVocalistsLLM(vocalistsPart, options = {}) {
  // Use LLM parsing only - no fallback
  return await parseWithClaude(vocalistsPart, options.apiKey);
}

/**
 * Async version for real Claude API calls
 * @param {string} vocalistsPart - The vocalist part of a section header
 * @param {string} apiKey - Claude API key (required)
 * @returns {Promise<Object>} Dictionary with vocalist names as keys and formats as values
 */
async function parseVocalistsLLMAsync(vocalistsPart, apiKey) {
  if (!apiKey) {
    throw new Error('Claude API key required for LLM parsing');
  }
  
  return await parseWithClaude(vocalistsPart, apiKey);
}

/**
 * Parse using Claude API
 * @param {string} vocalistsPart - Input string
 * @param {string} apiKey - Claude API key
 * @returns {Promise<Array>} Parsed result
 */
async function parseWithClaude(vocalistsPart, apiKey) {
  if (!apiKey) {
    throw new Error('Claude API key not provided');
  }

  const prompt = `Parse this vocalist information from song lyrics into a structured JSON format.
Extract each individual vocalist and their text formatting.

Input: "${vocalistsPart}"

Rules:
- Return a JSON object where keys are vocalist names and values are their formats
- Format can be: "plain", "bold", "italic", or "bold-italic"
- HTML tags indicate formatting: <b> = bold, <i> = italic, <b><i> = bold-italic
- Delimiters: commas, &amp;, "with" separate different vocalists
- Content within the same HTML tag belongs to one vocalist (even if it contains &)
- Remove parentheses from names
- Preserve & in duo names like "AJ & Brian"

Examples:
"<b>Nick Carter</b> &amp; Brian Littrell" → 
{"Nick Carter": "bold", "Brian Littrell": "plain"}

"AJ, <i>AJ &amp; Brian</i>" →
{"AJ": "plain", "AJ & Brian": "italic"}

Return only a valid JSON object, no other text:`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.content[0].text.trim();
  
  try {
    // Parse the JSON response
    const result = JSON.parse(content);
    
    // Validate the result structure
    if (typeof result === 'object' && !Array.isArray(result) && 
        Object.values(result).every(format => typeof format === 'string')) {
      return result;
    } else {
      throw new Error('Invalid response format from Claude');
    }
  } catch (parseError) {
    throw new Error(`Failed to parse Claude response as JSON: ${parseError.message}`);
  }
}

module.exports = {
  parseVocalistsLLM,
  parseVocalistsLLMAsync,
  parseWithClaude
};