function parseLyricsWithVocalists(lyricsText) {
  const lines = lyricsText.split('\n');
  const result = [];
  const vocalistStats = {};
  let currentVocalists = [];
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
    if (currentVocalists.length > 0) {
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

function parseVocalists(vocalistsPart) {
  const vocalists = [];
  
  // Split by commas first, but also handle &amp; as a delimiter
  let parts;
  if (vocalistsPart.includes(',')) {
    // Primary delimiter is comma
    parts = vocalistsPart.split(',').map(p => p.trim());
  } else if (vocalistsPart.includes('&amp;')) {
    // Use &amp; as delimiter
    parts = vocalistsPart.split('&amp;').map(p => p.trim());
  } else {
    // Single vocalist
    parts = [vocalistsPart.trim()];
  }
  
  for (const part of parts) {
    // Check for bold formatting
    const boldMatch = part.match(/<b>([^<]+)<\/b>/);
    if (boldMatch) {
      const name = processVocalistName(boldMatch[1].trim());
      vocalists.push({ name: name, format: 'bold' });
      continue;
    }
    
    // Check for italic formatting
    const italicMatch = part.match(/<i>([^<]+)<\/i>/);
    if (italicMatch) {
      const name = processVocalistName(italicMatch[1].trim());
      vocalists.push({ name: name, format: 'italic' });
      continue;
    }
    
    // Check for bold+italic formatting
    const boldItalicMatch = part.match(/<b><i>([^<]+)<\/i><\/b>/) || part.match(/<i><b>([^<]+)<\/b><\/i>/);
    if (boldItalicMatch) {
      const name = processVocalistName(boldItalicMatch[1].trim());
      vocalists.push({ name: name, format: 'bold-italic' });
      continue;
    }
    
    // Plain text (no formatting)
    const plainText = part.replace(/<[^>]*>/g, '').trim();
    if (plainText) {
      const name = processVocalistName(plainText);
      vocalists.push({ name: name, format: 'plain' });
    }
  }
  
  return vocalists;
}

function processVocalistName(name) {
  // Convert HTML entities
  const decoded = name.replace(/&amp;/g, '&');
  
  // Check if it's a duo (contains &)
  if (decoded.includes(' & ')) {
    return decoded.replace(' & ', ', ');
  }
  
  return decoded;
}

function determineVocalist(line, vocalists) {
  // Check if line starts with unformatted text (assign to primary vocalist)
  const startsWithText = /^[^<]+/.test(line);
  if (startsWithText) {
    const primaryVocalist = vocalists.find(v => v.format === 'plain') || vocalists[0];
    return primaryVocalist ? primaryVocalist.name : 'Unknown';
  }
  
  // Check if line starts with bold+italic formatting
  if (line.startsWith('<b><i>') || line.startsWith('<i><b>')) {
    const boldItalicVocalist = vocalists.find(v => v.format === 'bold-italic');
    if (boldItalicVocalist) return boldItalicVocalist.name;
  }
  
  // Check if line starts with bold formatting
  if (line.startsWith('<b>')) {
    const boldVocalist = vocalists.find(v => v.format === 'bold');
    if (boldVocalist) return boldVocalist.name;
  }
  
  // Check if line starts with italic formatting
  if (line.startsWith('<i>')) {
    const italicVocalist = vocalists.find(v => v.format === 'italic');
    if (italicVocalist) return italicVocalist.name;
  }
  
  // Default to first vocalist if no formatting match
  const defaultVocalist = vocalists.find(v => v.format === 'plain') || vocalists[0];
  return defaultVocalist ? defaultVocalist.name : 'Unknown';
}

const fs = require('fs');
const path = require('path');

function parseLyricsFromFile(filePath) {
  try {
    const lyricsText = fs.readFileSync(filePath, 'utf8');
    return parseLyricsWithVocalists(lyricsText);
  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
    return { parsedLyrics: [], vocalistStats: {} };
  }
}

// Command line usage
if (require.main === module) {
  const filePath = process.argv[2];
  
  if (!filePath) {
    console.log('Usage: node parse_lyrics.js <path-to-lyrics-file>');
    process.exit(1);
  }
  
  const result = parseLyricsFromFile(filePath);
  
  if (result.parsedLyrics.length > 0) {
    console.log('Parsed lyrics with vocalists:');
    result.parsedLyrics.forEach(item => {
      console.log(`${item.vocalist}: ${item.line}`);
    });
    
    console.log('\nVocalist Statistics:');
    Object.entries(result.vocalistStats).forEach(([vocalist, stats]) => {
      console.log(`${vocalist}: ${stats.lines} lines, ${stats.words} words`);
    });
  } else {
    console.log('No lyrics found or error parsing file.');
  }
}

module.exports = { parseLyricsWithVocalists, parseVocalists, determineVocalist, parseLyricsFromFile };