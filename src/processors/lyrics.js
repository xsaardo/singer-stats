const fs = require('fs');

/**
 * Parse lyrics text and identify vocalists based on formatting
 * @param {string} lyricsText - The raw lyrics text
 * @returns {Object} Parsed lyrics with vocalist information and statistics
 */
function parseLyricsWithVocalists(lyricsText) {
  const lines = lyricsText.split('\n');
  const result = [];
  const vocalistStats = {};
  let currentVocalists = {};
  let openFormattingTag = null; // Track unclosed formatting tags
  let openTagVocalist = null; // Track which vocalist started the open tag
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) continue;
    
    // Check if line is a section header (e.g., [Verse 1: Brian])
    const sectionMatch = trimmedLine.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      const sectionContent = sectionMatch[1];
      
      // Reset formatting state for new section
      openFormattingTag = null;
      openTagVocalist = null;
      
      // Extract vocalists from section header
      const colonIndex = sectionContent.indexOf(':');
      if (colonIndex !== -1) {
        const vocalistsPart = sectionContent.substring(colonIndex + 1).trim();
        
        // Parse vocalists, handling HTML tags and multiple names
        currentVocalists = parseVocalists(vocalistsPart);
      }
      continue;
    }
    
    // Process lyric lines
    if (Object.keys(currentVocalists).length > 0) {
      let vocalist;
      
      // Check if we're continuing a multi-line formatting tag
      if (openFormattingTag && openTagVocalist) {
        vocalist = openTagVocalist;
        
        // Check if this line closes the open tag
        if (trimmedLine.includes(`</${openFormattingTag}>`)) {
          openFormattingTag = null;
          openTagVocalist = null;
        }
      } else {
        vocalist = determineVocalist(trimmedLine, currentVocalists);
        
        // Check if this line starts a formatting tag that doesn't close
        const openTagMatch = trimmedLine.match(/<(i|b)>/);
        const closeTagMatch = trimmedLine.match(/<\/(i|b)>/);
        
        if (openTagMatch && !closeTagMatch) {
          openFormattingTag = openTagMatch[1];
          openTagVocalist = vocalist;
        }
      }
      
      // Calculate statistics while parsing
      const cleanText = trimmedLine.replace(/<[^>]*>/g, '').trim();
      const wordCount = cleanText.split(/\s+/).filter(word => word.length > 0).length;
      
      if (!vocalistStats[vocalist]) {
        vocalistStats[vocalist] = {
          lines: 0,
          words: 0
        };
      }
      
      vocalistStats[vocalist].lines += 1;
      vocalistStats[vocalist].words += wordCount;
      
      result.push({
        vocalist: vocalist,
        line: trimmedLine
      });
    }
  }
  
  return {
    parsedLyrics: result,
    vocalistStats: vocalistStats
  };
}

/**
 * Parse vocalist information from section headers using tag-aware approach
 * @param {string} vocalistsPart - The vocalist part of a section header
 * @returns {Object} Dictionary with vocalist names as keys and formats as values
 */
function parseVocalists(vocalistsPart) {
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
    .replace(/^\|\|\||||\|\|\|$/g, ''); // Remove leading/trailing markers
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
 * Process and normalize vocalist names
 * @param {string} name - Raw vocalist name
 * @returns {string} Processed vocalist name
 */
function processVocalistName(name) {
  // Convert HTML entities
  const decoded = name.replace(/&amp;/g, '&');
  
  // For duo names (like "AJ & Brian"), keep the & to preserve the duo concept
  // Only convert & to comma for display in certain contexts
  // For now, preserve & in vocalist names to maintain duo relationships
  return decoded;
}

/**
 * Determine which vocalist should be assigned to a line based on formatting
 * @param {string} line - The lyric line
 * @param {Object} vocalists - Dictionary with vocalist names as keys and formats as values
 * @returns {string} The name of the assigned vocalist
 */
function determineVocalist(line, vocalists) {
  const vocalistEntries = Object.entries(vocalists);
  
  // Check if line starts with unformatted text (assign to primary vocalist)
  const startsWithText = /^[^<]+/.test(line);
  if (startsWithText) {
    const plainVocalist = vocalistEntries.find(([name, format]) => format === 'plain');
    return plainVocalist ? plainVocalist[0] : (vocalistEntries[0] ? vocalistEntries[0][0] : 'Unknown');
  }
  
  // Check if line starts with bold+italic formatting
  if (line.startsWith('<b><i>') || line.startsWith('<i><b>')) {
    const boldItalicVocalist = vocalistEntries.find(([name, format]) => format === 'bold-italic');
    if (boldItalicVocalist) return boldItalicVocalist[0];
  }
  
  // Check if line starts with bold formatting
  if (line.startsWith('<b>')) {
    const boldVocalist = vocalistEntries.find(([name, format]) => format === 'bold');
    if (boldVocalist) return boldVocalist[0];
  }
  
  // Check if line starts with italic formatting
  if (line.startsWith('<i>')) {
    const italicVocalist = vocalistEntries.find(([name, format]) => format === 'italic');
    if (italicVocalist) return italicVocalist[0];
  }
  
  // Default to first vocalist if no formatting match
  const plainVocalist = vocalistEntries.find(([name, format]) => format === 'plain');
  return plainVocalist ? plainVocalist[0] : (vocalistEntries[0] ? vocalistEntries[0][0] : 'Unknown');
}

/**
 * Parse lyrics from a file
 * @param {string} filePath - Path to the lyrics file
 * @returns {Object} Parsed lyrics result
 */
function parseLyricsFromFile(filePath) {
  try {
    const lyricsText = fs.readFileSync(filePath, 'utf8');
    return parseLyricsWithVocalists(lyricsText);
  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
    return { parsedLyrics: [], vocalistStats: {} };
  }
}

/**
 * Generate statistics summary for parsed lyrics
 * @param {Object} vocalistStats - Statistics object from parsing
 * @returns {Object} Summary statistics
 */
function generateStatsSummary(vocalistStats) {
  const totalLines = Object.values(vocalistStats).reduce((sum, stats) => sum + stats.lines, 0);
  const totalWords = Object.values(vocalistStats).reduce((sum, stats) => sum + stats.words, 0);
  
  const vocalistCount = Object.keys(vocalistStats).length;
  
  // Calculate percentages
  const vocalistPercentages = {};
  Object.entries(vocalistStats).forEach(([vocalist, stats]) => {
    vocalistPercentages[vocalist] = {
      linesPercentage: totalLines > 0 ? (stats.lines / totalLines * 100).toFixed(1) : 0,
      wordsPercentage: totalWords > 0 ? (stats.words / totalWords * 100).toFixed(1) : 0,
      ...stats
    };
  });
  
  return {
    totalLines,
    totalWords,
    vocalistCount,
    vocalistStats: vocalistPercentages
  };
}

module.exports = {
  parseLyricsWithVocalists,
  parseVocalists,
  processVocalistName,
  determineVocalist,
  parseLyricsFromFile,
  generateStatsSummary
};