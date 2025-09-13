const assert = require('assert');
const path = require('path');
const {
  parseLyricsWithVocalists,
  parseVocalists,
  processVocalistName,
  determineVocalist,
  generateStatsSummary,
  parseLyricsFromFile
} = require('../../src/processors/lyrics.js');

describe('Lyrics Processing Tests', () => {
  
  describe('parseVocalists', () => {
    
    it('should parse single plain text vocalist', () => {
      const result = parseVocalists('Nick Carter');
      assert.deepStrictEqual(result, { 'Nick Carter': 'plain' });
    });
    
    it('should parse single bold vocalist', () => {
      const result = parseVocalists('<b>Brian Littrell</b>');
      assert.deepStrictEqual(result, { 'Brian Littrell': 'bold' });
    });
    
    it('should parse single italic vocalist', () => {
      const result = parseVocalists('<i>AJ McLean</i>');
      assert.deepStrictEqual(result, { 'AJ McLean': 'italic' });
    });
    
    it('should parse bold-italic vocalist', () => {
      const result = parseVocalists('<b><i>Howie Dorough</i></b>');
      assert.deepStrictEqual(result, { 'Howie Dorough': 'bold-italic' });
    });
    
    it('should parse italic-bold vocalist', () => {
      const result = parseVocalists('<i><b>Howie Dorough</b></i>');
      assert.deepStrictEqual(result, { 'Howie Dorough': 'bold-italic' });
    });
    
    it('should parse multiple vocalists separated by comma', () => {
      const result = parseVocalists('<i>AJ McLean</i>, Howie Dorough');
      assert.deepStrictEqual(result, {
        'AJ McLean': 'italic',
        'Howie Dorough': 'plain'
      });
    });
    
    it('should parse multiple vocalists separated by multiple commas', () => {
      const result = parseVocalists('AJ, <i>All</i>, <b>Brian</b>');
      assert.deepStrictEqual(result, {
        'AJ': 'plain',
        'All': 'italic',
        'Brian': 'bold'
      });
    });

    it('should parse multiple vocalists separated by &amp;', () => {
      const result = parseVocalists('<b>Nick Carter</b> &amp; Brian Littrell');
      assert.deepStrictEqual(result, {
        'Nick Carter': 'bold',
        'Brian Littrell': 'plain'
      });
    });

    it('should parse multiple vocalists (single and duo) separated by comma', () => {
      const result = parseVocalists('AJ, <i>AJ &amp; Brian</i>');
      assert.deepStrictEqual(result, {
        'AJ': 'plain',
        'AJ & Brian': 'italic'
      });
    });

    it('should parse multiple vocalists separated by comma and &amp;', () => {
      const result = parseVocalists('All, <i>Brian</i> &amp; <b>Nick</b>');
      assert.deepStrictEqual(result, {
        'All': 'plain',
        'Brian': 'italic',
        'Nick': 'bold'
      });
    });

    it('should parse multiple vocalists separated by WITH', () => {
      const result = parseVocalists('Nick <i>with Brian</i>');
      assert.deepStrictEqual(result, {
        'Nick': 'plain',
        'Brian': 'italic'
      });
    });

    it('should parse multiple vocalists separated by WITH and commas', () => {
      const result = parseVocalists('Brian <i>with Kevin</i>, <b>Nick</b>');
      assert.deepStrictEqual(result, {
        'Brian': 'plain',
        'Kevin': 'italic',
        'Nick': 'bold'
      });
    });
    
    it('should handle "All" as vocalist', () => {
      const result = parseVocalists('All');
      assert.deepStrictEqual(result, { 'All': 'plain' });
    });
    
  });
  
  describe('processVocalistName', () => {
    
    it('should decode HTML entities', () => {
      const result = processVocalistName('Nick &amp; Brian');
      assert.strictEqual(result, 'Nick & Brian');
    });
    
    it('should handle names without entities', () => {
      const result = processVocalistName('AJ McLean');
      assert.strictEqual(result, 'AJ McLean');
    });
    
    it('should preserve & in duo names', () => {
      const result = processVocalistName('Nick & Brian');
      assert.strictEqual(result, 'Nick & Brian');
    });
    
  });
  
  describe('determineVocalist', () => {
    
    const mockVocalists = {
      'Nick Carter': 'plain',
      'Brian Littrell': 'bold',
      'AJ McLean': 'italic',
      'Howie Dorough': 'bold-italic'
    };
    
    it('should assign plain text to plain vocalist', () => {
      const result = determineVocalist('You are my fire', mockVocalists);
      assert.strictEqual(result, 'Nick Carter');
    });
    
    it('should assign bold text to bold vocalist', () => {
      const result = determineVocalist('<b>Now I can see</b>', mockVocalists);
      assert.strictEqual(result, 'Brian Littrell');
    });
    
    it('should assign italic text to italic vocalist', () => {
      const result = determineVocalist('<i>Don\'t wanna hear you</i>', mockVocalists);
      assert.strictEqual(result, 'AJ McLean');
    });
    
    it('should assign bold-italic text to bold-italic vocalist', () => {
      const result = determineVocalist('<b><i>You are my fire</i></b>', mockVocalists);
      assert.strictEqual(result, 'Howie Dorough');
    });
    
    it('should handle mixed formatting within line', () => {
      const result = determineVocalist('<b>Now I can see</b> that we\'ve fallen apart', mockVocalists);
      assert.strictEqual(result, 'Brian Littrell');
    });
    
    it('should default to first vocalist when no match', () => {
      const limitedVocalists = { 'Test Singer': 'unknown' };
      const result = determineVocalist('Some lyrics', limitedVocalists);
      assert.strictEqual(result, 'Test Singer');
    });
    
  });
  
  describe('generateStatsSummary', () => {
    
    it('should calculate correct totals and percentages', () => {
      const mockStats = {
        'Nick Carter': { lines: 4, words: 16 },
        'Brian Littrell': { lines: 2, words: 12 },
        'AJ McLean': { lines: 2, words: 8 }
      };
      
      const result = generateStatsSummary(mockStats);
      
      assert.strictEqual(result.totalLines, 8);
      assert.strictEqual(result.totalWords, 36);
      assert.strictEqual(result.vocalistCount, 3);
      
      assert.strictEqual(result.vocalistStats['Nick Carter'].linesPercentage, '50.0');
      assert.strictEqual(result.vocalistStats['Nick Carter'].wordsPercentage, '44.4');
      assert.strictEqual(result.vocalistStats['Brian Littrell'].linesPercentage, '25.0');
      assert.strictEqual(result.vocalistStats['AJ McLean'].wordsPercentage, '22.2');
    });
    
    it('should handle empty stats', () => {
      const result = generateStatsSummary({});
      assert.strictEqual(result.totalLines, 0);
      assert.strictEqual(result.totalWords, 0);
      assert.strictEqual(result.vocalistCount, 0);
    });
    
    it('should handle single vocalist', () => {
      const mockStats = {
        'Solo Artist': { lines: 5, words: 20 }
      };
      
      const result = generateStatsSummary(mockStats);
      assert.strictEqual(result.vocalistStats['Solo Artist'].linesPercentage, '100.0');
      assert.strictEqual(result.vocalistStats['Solo Artist'].wordsPercentage, '100.0');
    });
    
  });
  
  describe('parseLyricsWithVocalists', () => {
    
    it('should parse basic song structure', () => {
      const sampleLyrics = `[Verse 1: Nick Carter]
You are my fire
The one desire

[Chorus: All]
Tell me why
Ain't nothing but a heartache`;
      
      const result = parseLyricsWithVocalists(sampleLyrics);
      
      assert.strictEqual(result.parsedLyrics.length, 4);
      assert.strictEqual(result.parsedLyrics[0].vocalist, 'Nick Carter');
      assert.strictEqual(result.parsedLyrics[0].line, 'You are my fire');
      assert.strictEqual(result.parsedLyrics[2].vocalist, 'All');
      
      assert(result.vocalistStats['Nick Carter']);
      assert.strictEqual(result.vocalistStats['Nick Carter'].lines, 2);
      assert(result.vocalistStats['All']);
      assert.strictEqual(result.vocalistStats['All'].lines, 2);
    });
    
    it('should handle formatted vocalists', () => {
      const sampleLyrics = `[Verse 1: <b>Brian Littrell</b>]
<b>Now I can see</b>
<b>From the way that it used to be</b>

[Bridge: <i>AJ McLean</i>]
<i>Don't wanna hear you say</i>`;
      
      const result = parseLyricsWithVocalists(sampleLyrics);
      
      assert.strictEqual(result.parsedLyrics[0].vocalist, 'Brian Littrell');
      assert.strictEqual(result.parsedLyrics[2].vocalist, 'AJ McLean');
      assert.strictEqual(result.vocalistStats['Brian Littrell'].lines, 2);
      assert.strictEqual(result.vocalistStats['AJ McLean'].lines, 1);
    });
    
    it('should handle mixed vocalist formatting within section', () => {
      const sampleLyrics = `[Bridge: <i>AJ McLean</i>, Howie Dorough]
<i>Don't wanna hear you say</i>
Ain't nothing but a heartache`;
      
      const result = parseLyricsWithVocalists(sampleLyrics);
      
      assert.strictEqual(result.parsedLyrics[0].vocalist, 'AJ McLean');
      assert.strictEqual(result.parsedLyrics[1].vocalist, 'Howie Dorough');
    });
    
    it('should count words correctly', () => {
      const sampleLyrics = `[Verse 1: Test Singer]
This is a five word line
Short line`;
      
      const result = parseLyricsWithVocalists(sampleLyrics);
      
      assert.strictEqual(result.vocalistStats['Test Singer'].words, 8); // 6 + 2
      assert.strictEqual(result.vocalistStats['Test Singer'].lines, 2);
    });
    
    it('should strip HTML tags when counting words', () => {
      const sampleLyrics = `[Verse 1: <b>Test Singer</b>]
<b>This is five words</b>`;
      
      const result = parseLyricsWithVocalists(sampleLyrics);
      
      assert.strictEqual(result.vocalistStats['Test Singer'].words, 4); // "This is five words"
    });
    
    it('should handle multi-line formatting tags', () => {
      const sampleLyrics = `[Verse 1: <b>Test Singer</b>]
<b>Start of formatted section
This continues the formatting
End of section</b>`;
      
      const result = parseLyricsWithVocalists(sampleLyrics);
      
      // All three lines should be attributed to the same vocalist
      assert.strictEqual(result.parsedLyrics.length, 3);
      result.parsedLyrics.forEach(line => {
        assert.strictEqual(line.vocalist, 'Test Singer');
      });
    });
    
  });
  
  describe('parseLyricsFromFile', () => {
    
    it('should parse lyrics from sample file', () => {
      const fixturePath = path.join(__dirname, '../fixtures/sample-lyrics.txt');
      const result = parseLyricsFromFile(fixturePath);
      
      assert(result.parsedLyrics.length > 0);
      assert(Object.keys(result.vocalistStats).length > 0);
      
      // Should have detected multiple vocalists
      const vocalists = Object.keys(result.vocalistStats);
      assert(vocalists.includes('Nick Carter'));
      assert(vocalists.includes('All'));
      assert(vocalists.includes('Brian Littrell'));
    });
    
    it('should handle non-existent file gracefully', () => {
      const result = parseLyricsFromFile('/non/existent/file.txt');
      assert.deepStrictEqual(result.parsedLyrics, []);
      assert.deepStrictEqual(result.vocalistStats, {});
    });
    
  });
  
});