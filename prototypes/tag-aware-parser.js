/**
 * Tag-Aware Vocalist Parser Prototype
 * 
 * This prototype implements a two-phase parsing approach:
 * 1. Extract tagged vocalists first (preserving tag boundaries)
 * 2. Parse remaining untagged text with delimiter splitting
 */

/**
 * Main parsing function - tag-aware approach
 * @param {string} vocalistsPart - The vocalist part of a section header
 * @returns {Object} Dictionary with vocalist names as keys and formats as values
 */
function parseVocalistsTagAware(vocalistsPart) {
  const vocalists = {};
  let remainingText = vocalistsPart;
  
  // Step 1: Extract all tagged vocalists first (preserve tag boundaries)
  const taggedResult = extractTaggedVocalists(remainingText);
  for (const vocalist of taggedResult.vocalists) {
    vocalists[vocalist.name] = vocalist.format;
  }
  remainingText = taggedResult.remainingText;
  
  // Step 2: Process remaining untagged text with delimiter splitting
  const untaggedVocalists = parseUntaggedText(remainingText);
  for (const vocalist of untaggedVocalists) {
    vocalists[vocalist.name] = vocalist.format;
  }
  
  return vocalists;
}

/**
 * Extract all HTML tagged sections first
 * @param {string} text - Input text
 * @returns {Object} { vocalists: Array, remainingText: string }
 */
function extractTaggedVocalists(text) {
  const vocalists = [];
  let workingText = text;
  
  // Process in order of specificity to avoid double-matching
  const patterns = [
    // Bold-italic patterns (most specific first)
    { regex: /<b><i>([^<]+)<\/i><\/b>/g, format: 'bold-italic' },
    { regex: /<i><b>([^<]+)<\/b><\/i>/g, format: 'bold-italic' },
    // Individual formatting
    { regex: /<b>([^<]+)<\/b>/g, format: 'bold' },
    { regex: /<i>([^<]+)<\/i>/g, format: 'italic' }
  ];
  
  // Extract matches with their positions first
  const allMatches = [];
  
  for (const { regex, format } of patterns) {
    regex.lastIndex = 0; // Reset regex state
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      allMatches.push({
        fullMatch: match[0],
        content: match[1].trim(),
        format: format,
        start: match.index,
        end: match.index + match[0].length
      });
    }
  }
  
  // Sort by position to maintain order
  allMatches.sort((a, b) => a.start - b.start);
  
  // Remove overlapping matches (keep the first/most specific one)
  const filteredMatches = [];
  for (const match of allMatches) {
    const overlaps = filteredMatches.some(existing => 
      (match.start >= existing.start && match.start < existing.end) ||
      (match.end > existing.start && match.end <= existing.end)
    );
    
    if (!overlaps) {
      filteredMatches.push(match);
    }
  }
  
  // Process filtered matches
  for (const match of filteredMatches) {
    let content = match.content;
    
    // Handle "with" pattern - extract just the name after "with"
    if (content.toLowerCase().startsWith('with ')) {
      content = content.substring(5).trim(); // Remove "with " prefix
    }
    
    if (content) {
      vocalists.push({
        name: processVocalistName(content),
        format: match.format
      });
      
      // Remove this tag from working text
      workingText = workingText.replace(match.fullMatch, '|||REMOVED|||');
    }
  }
  
  // Clean up remaining text
  const remainingText = workingText
    .replace(/\|\|\|REMOVED\|\|\|/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s*&amp;\s*/g, '') // Remove leading &amp; entities FIRST, before & cleanup
    .replace(/^[,&\s]+|[,&\s]+$/g, '') // Remove leading/trailing delimiters
    .trim();
  
  return { vocalists, remainingText };
}

/**
 * Parse untagged text with delimiter splitting
 * @param {string} text - Untagged text
 * @returns {Array} Array of plain text vocalists
 */
function parseUntaggedText(text) {
  if (!text) return [];
  
  // Normalize delimiters to a common format
  const normalized = normalizeDelimiters(text);
  
  // Split into segments
  const segments = splitIntoSegments(normalized);
  
  // Process each segment
  return segments
    .map(segment => {
      const cleaned = cleanSegment(segment);
      return cleaned ? { name: processVocalistName(cleaned), format: 'plain' } : null;
    })
    .filter(Boolean);
}

/**
 * Normalize all delimiters to a common format
 * @param {string} text - Input text
 * @returns {string} Normalized text
 */
function normalizeDelimiters(text) {
  return text
    .replace(/\s*&amp;\s*/g, '|||')   // Convert &amp; to marker
    .replace(/\s*&\s*/g, '|||')       // Convert & to marker  
    .replace(/\s+with\s+/gi, '|||')   // Convert "with" to marker (case insensitive)
    .replace(/\s*,\s*/g, '|||')       // Convert commas to marker
    .replace(/\|\|\|+/g, '|||')       // Normalize multiple markers
    .replace(/^\|\|\|||\|\|\|$/g, ''); // Remove leading/trailing markers
}

/**
 * Split text into segments using normalized delimiters
 * @param {string} text - Normalized text
 * @returns {Array} Array of text segments
 */
function splitIntoSegments(text) {
  return text.split('|||')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Clean a segment (remove parentheses, extra whitespace)
 * @param {string} segment - Text segment
 * @returns {string} Cleaned segment
 */
function cleanSegment(segment) {
  return segment
    .replace(/^\(|\)$/g, '')  // Remove surrounding parentheses
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();
}

/**
 * Process and normalize vocalist names (same as original)
 * @param {string} name - Raw vocalist name
 * @returns {string} Processed vocalist name
 */
function processVocalistName(name) {
  // Convert HTML entities
  const decoded = name.replace(/&amp;/g, '&');
  
  // For duo names (like "AJ & Brian"), keep the & to preserve the duo concept
  return decoded;
}

module.exports = {
  parseVocalistsTagAware,
  extractTaggedVocalists,
  parseUntaggedText,
  normalizeDelimiters,
  splitIntoSegments,
  cleanSegment,
  processVocalistName
};