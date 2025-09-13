#!/usr/bin/env node

/**
 * Debug script to intercept and log vocalist parsing patterns
 * Shows the raw vocalist strings extracted from section headers
 */

const fs = require('fs');
const path = require('path');

// Store original parseVocalists function
const lyricsProcessor = require('./src/processors/lyrics.js');
const originalParseVocalists = lyricsProcessor.parseVocalists;

// Track all vocalist patterns we see
const vocalistPatterns = [];

// Override parseVocalists to log input
lyricsProcessor.parseVocalists = function(vocalistsPart) {
  // Log the raw input
  console.log(`📝 Vocalist Pattern: "${vocalistsPart}"`);
  
  // Store for summary
  vocalistPatterns.push(vocalistsPart);
  
  // Call original function
  const result = originalParseVocalists(vocalistsPart);
  
  // Show parsed result
  console.log(`   → Parsed as: ${result.map(v => `${v.name} (${v.format})`).join(', ')}`);
  console.log('');
  
  return result;
};

// Now process a file with the modified function
function analyzeFile(filePath) {
  console.log(`🎤 Analyzing vocalist patterns in: ${path.basename(filePath)}`);
  console.log('='.repeat(60));
  console.log('');
  
  try {
    // This will trigger our intercepted parseVocalists function
    const result = lyricsProcessor.parseLyricsFromFile(filePath);
    
    console.log('📊 SUMMARY');
    console.log('='.repeat(30));
    console.log(`Total vocalist patterns found: ${vocalistPatterns.length}`);
    console.log(`Unique patterns: ${new Set(vocalistPatterns).size}`);
    
    console.log('\n🔍 UNIQUE PATTERNS:');
    [...new Set(vocalistPatterns)].forEach((pattern, index) => {
      console.log(`${index + 1}. "${pattern}"`);
    });
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

// Main execution
if (process.argv.length < 3) {
  console.log('Usage: node debug-vocalists.js <path-to-lyrics-file>');
  console.log('');
  console.log('Examples:');
  console.log('  node debug-vocalists.js output/individual-songs/lyrics_data_123.json');
  console.log('  node debug-vocalists.js test/fixtures/sample-lyrics.txt');
  process.exit(1);
}

const filePath = process.argv[2];

if (!fs.existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  process.exit(1);
}

analyzeFile(filePath);