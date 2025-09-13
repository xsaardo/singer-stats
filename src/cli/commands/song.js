const path = require('path');
const { searchSong, fetchPageHTML, extractLyricsFromHTML, cleanLyricsHTML } = require('../../scrapers/genius.js');
const { parseLyricsWithVocalists, generateStatsSummary } = require('../../processors/lyrics.js');
const { getOutputDir, createLyricsFilePaths, saveLyricsData, writeJSONFile } = require('../../utils/file.js');
const { logStatus, logVerbose, logError, withSpinner, formatDuration, displayTable } = require('../utils/progress.js');

/**
 * Execute the song command
 * @param {string} artist - Artist name
 * @param {string} title - Song title
 * @param {Object} options - Command options
 */
async function execute(artist, title, options) {
  const startTime = Date.now();
  
  try {
    logStatus('music', `Processing: "${title}" by ${artist}`);
    
    // Get API token
    const accessToken = options.token || process.env.GENIUS_ACCESS_TOKEN || global.APP_CONFIG.get('apis.genius.accessToken');
    if (!accessToken) {
      logError('Genius API token is required. Set GENIUS_ACCESS_TOKEN environment variable or use --token option', null, true);
    }
    
    // Set up output directory
    const outputDir = path.resolve(options.outputDir);
    
    logVerbose(`Output directory: ${outputDir}`);
    logVerbose(`Format: ${options.format}`);
    logVerbose(`Parse vocalists: ${options.parse}`);
    
    // Step 1: Search for song
    const searchResults = await withSpinner(
      searchSong(artist, title, accessToken),
      'Searching on Genius...'
    );
    
    if (!searchResults.length) {
      logError(`Song "${title}" by ${artist} not found on Genius`);
      console.log('💡 Suggestions:');
      console.log('   - Check spelling of song title');
      console.log('   - Try alternative title or artist name');
      console.log('   - Use --verbose to see search results');
      process.exit(1);
    }
    
    const song = searchResults[0];
    logStatus('success', `Found: ${song.title} by ${song.primary_artist.name}`);
    logVerbose(`Song ID: ${song.id}`);
    logVerbose(`URL: ${song.url}`);
    
    // Step 2: Fetch lyrics page
    const htmlContent = await withSpinner(
      fetchPageHTML(song.url),
      'Fetching lyrics page...'
    );
    
    // Step 3: Extract and clean lyrics
    const lyricsData = await withSpinner(
      (async () => {
        const extracted = extractLyricsFromHTML(htmlContent);
        const cleanedContent = cleanLyricsHTML(extracted.rawHTML);
        return {
          ...extracted,
          cleanedContent
        };
      })(),
      'Cleaning HTML content...'
    );
    
    logVerbose(`Found ${lyricsData.containerCount} lyrics container(s)`);
    logVerbose(`Cleaned content length: ${lyricsData.cleanedContent.length} characters`);
    
    // Step 4: Parse vocalists (if enabled)
    let parseResult = null;
    let vocalistStats = null;
    
    if (options.parse) {
      parseResult = await withSpinner(
        parseLyricsWithVocalists(lyricsData.cleanedContent),
        'Analyzing vocalists...'
      );
      
      vocalistStats = generateStatsSummary(parseResult.vocalistStats);
      logVerbose(`Parsed ${parseResult.parsedLyrics.length} lines`);
      logVerbose(`Found ${vocalistStats.vocalistCount} vocalists`);
    }
    
    // Step 5: Prepare file paths
    const filePaths = createLyricsFilePaths(song, outputDir);
    
    // Step 6: Save files
    await withSpinner(
      (async () => {
        const dataToSave = {
          songInfo: song,
          cleanedContent: lyricsData.cleanedContent,
          parsedLyrics: parseResult?.parsedLyrics || null,
          vocalistStats: parseResult?.vocalistStats || null,
          containerCount: lyricsData.containerCount,
          processingTime: Date.now() - startTime
        };
        
        // Save based on format option
        if (options.format === 'txt' || options.format === 'both') {
          saveLyricsData(dataToSave, filePaths);
        }
        
        if (options.format === 'json' || options.format === 'both') {
          writeJSONFile(filePaths.json, dataToSave);
        }
        
        return filePaths;
      })(),
      'Saving files...'
    );
    
    // Display results
    const processingTime = Date.now() - startTime;
    
    if (!global.CLI_QUIET) {
      // Show vocalist statistics if parsed
      if (vocalistStats) {
        displayTable({
          'Total Lines': vocalistStats.totalLines,
          'Total Words': vocalistStats.totalWords,
          'Vocalists': vocalistStats.vocalistCount
        }, 'Song Statistics');
        
        console.log('\n🎤 Vocalist Distribution:');
        Object.entries(vocalistStats.vocalistStats).forEach(([vocalist, stats]) => {
          console.log(`   ${vocalist}: ${stats.lines} lines (${stats.linesPercentage}%), ${stats.words} words (${stats.wordsPercentage}%)`);
        });
      }
      
      // Show saved files
      console.log('\n📁 Files saved:');
      if (options.format === 'txt' || options.format === 'both') {
        console.log(`   • ${path.basename(filePaths.cleaned)}`);
        if (options.parse) {
          console.log(`   • ${path.basename(filePaths.annotated)}`);
        }
      }
      if (options.format === 'json' || options.format === 'both') {
        console.log(`   • ${path.basename(filePaths.json)}`);
      }
      
      console.log(`\n⏱️ Processing completed in ${formatDuration(processingTime)}`);
    }
    
    // Return result for programmatic use
    return {
      success: true,
      songInfo: song,
      vocalistStats,
      files: filePaths,
      processingTime
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logError(`Failed to process song "${title}" by ${artist}`, error);
    
    if (error.message.includes('not found')) {
      console.log('💡 Suggestions:');
      console.log('   - Check spelling of song title and artist name');
      console.log('   - Try searching with slightly different terms');
      console.log('   - Use --verbose for more detailed error information');
    } else if (error.message.includes('rate limit')) {
      console.log('💡 Rate limit reached. Try again in a few minutes or use --delay option');
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      console.log('💡 Network issue. Check your internet connection and try again');
    }
    
    console.log(`\n⏱️ Failed after ${formatDuration(processingTime)}`);
    
    return {
      success: false,
      error: error.message,
      processingTime
    };
  }
}

module.exports = {
  execute
};