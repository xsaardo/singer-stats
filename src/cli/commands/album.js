const path = require('path');
const { getAlbumData } = require('../../scrapers/musicbrainz.js');
const { searchSong, fetchPageHTML, extractLyricsFromHTML, cleanLyricsHTML } = require('../../scrapers/genius.js');
const { parseLyricsWithVocalists, generateStatsSummary } = require('../../processors/lyrics.js');
const { aggregateAlbumStats, generateAlbumInsights, createAlbumReport } = require('../../processors/album-stats.js');
const { getOutputDir, createAlbumFilePaths, writeJSONFile, writeFile } = require('../../utils/file.js');
const { createAPIRateLimiter } = require('../../utils/http.js');
const { logStatus, logVerbose, logError, createProgressBar, formatDuration, displayTable } = require('../utils/progress.js');

/**
 * Process a single song as part of album processing
 * @param {Object} song - Song object with artist, title, trackNumber
 * @param {string} accessToken - Genius API token
 * @param {Object} rateLimiter - Rate limiter instance
 * @param {string} albumName - Album name for better search accuracy
 * @returns {Object} Song processing result
 */
async function processSongForAlbum(song, accessToken, rateLimiter, albumName) {
  const startTime = Date.now();
  
  try {
    // Use the proven searchSong function (without album name for better results)
    const searchResults = await searchSong(song.artist, song.title, accessToken);
    
    if (!searchResults.length) {
      return {
        success: false,
        title: song.title,
        trackNumber: song.trackNumber,
        error: 'Song not found on Genius',
        processingTime: Date.now() - startTime
      };
    }
    
    // Use the first (most relevant) result from the proven search function
    const foundSong = searchResults[0];
    
    // Fetch and process lyrics
    const htmlContent = await fetchPageHTML(foundSong.url);
    const extracted = extractLyricsFromHTML(htmlContent);
    const cleanedContent = cleanLyricsHTML(extracted.rawHTML);
    
    // Parse vocalists
    const parseResult = parseLyricsWithVocalists(cleanedContent);
    const vocalistStats = generateStatsSummary(parseResult.vocalistStats);
    
    return {
      success: true,
      songInfo: foundSong,
      title: song.title,
      trackNumber: song.trackNumber,
      cleanedContent,
      parsedLyrics: parseResult.parsedLyrics,
      vocalistStats,
      processingTime: Date.now() - startTime
    };
    
  } catch (error) {
    return {
      success: false,
      title: song.title,
      trackNumber: song.trackNumber,
      error: error.message,
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Execute the album command
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @param {Object} options - Command options
 */
async function execute(artist, album, options) {
  const startTime = Date.now();
  
  try {
    logStatus('album', `Processing Album: "${album}" by ${artist}`);
    
    // Get API token
    const accessToken = options.token || process.env.GENIUS_ACCESS_TOKEN || global.APP_CONFIG.get('apis.genius.accessToken');
    if (!accessToken) {
      logError('Genius API token is required. Set GENIUS_ACCESS_TOKEN environment variable or use --token option', null, true);
    }
    
    // Set up output directory
    const outputDir = path.resolve(options.outputDir);
    const releaseIndex = parseInt(options.releaseIndex) || 0;
    const delayMs = parseInt(options.delay) || 1500;
    
    logVerbose(`Output directory: ${outputDir}`);
    logVerbose(`Format: ${options.format}`);
    logVerbose(`Release index: ${releaseIndex}`);
    logVerbose(`Delay between requests: ${delayMs}ms`);
    logVerbose(`Skip failed songs: ${options.skipFailed}`);
    
    // Step 1: Get album data from MusicBrainz
    logStatus('info', 'Searching MusicBrainz for album...');
    
    const albumData = await getAlbumData(artist, album, {
      selectIndex: releaseIndex
    });
    
    const { release, songs } = albumData;
    
    logStatus('success', `Found ${songs.length} tracks in album`);
    logVerbose(`Release: ${release.title} (${release.date || 'Unknown date'})`);
    logVerbose(`Release ID: ${release.id}`);
    
    if (songs.length === 0) {
      logError('No tracks found in the album', null, true);
    }
    
    // Step 2: Set up rate limiter
    const rateLimiter = createAPIRateLimiter('genius');
    
    // Step 3: Process each song
    logStatus('info', 'Processing songs...');
    
    const songResults = [];
    let processedCount = 0;
    let successCount = 0;
    
    for (const [index, song] of songs.entries()) {
      const songNum = index + 1;
      
      if (!global.CLI_QUIET) {
        const progressBar = createProgressBar(processedCount, songs.length);
        process.stdout.write(`\r${progressBar} Current: "${song.title}"`);
      }
      
      const result = await processSongForAlbum(song, accessToken, rateLimiter, album);
      songResults.push(result);
      
      processedCount++;
      if (result.success) {
        successCount++;
        if (!global.CLI_QUIET) {
          process.stdout.write(`\r  [${songNum}/${songs.length}] ✅ ${song.title} (${formatDuration(result.processingTime)})\n`);
        }
      } else {
        if (!global.CLI_QUIET) {
          process.stdout.write(`\r  [${songNum}/${songs.length}] ❌ ${song.title} (${result.error})\n`);
        }
        
        if (!options.skipFailed) {
          logError(`Failed to process "${song.title}": ${result.error}`);
          console.log('💡 Use --skip-failed to continue processing other songs');
          process.exit(1);
        }
      }
      
      // Add delay between requests (except for last song)
      if (index < songs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    if (!global.CLI_QUIET) {
      process.stdout.write('\n');
    }
    
    // Step 4: Aggregate statistics
    logStatus('info', 'Aggregating album statistics...');
    
    const albumStats = aggregateAlbumStats(songResults);
    const insights = generateAlbumInsights(albumStats);
    
    // Step 5: Create output files
    const filePaths = createAlbumFilePaths(artist, album, outputDir);
    
    const albumResult = {
      albumInfo: {
        artist,
        title: album,
        releaseId: release.id,
        releaseDate: release.date,
        totalTracks: songs.length
      },
      songs: songResults,
      albumStats,
      insights,
      processingTime: Date.now() - startTime
    };
    
    logStatus('info', 'Saving album files...');
    
    // Save JSON data
    if (options.format === 'json' || options.format === 'both') {
      writeJSONFile(filePaths.json, albumResult);
    }
    
    // Save text report
    if (options.format === 'txt' || options.format === 'both') {
      const report = createAlbumReport(albumResult.albumInfo, albumStats, insights);
      writeFile(filePaths.summary, report);
    }
    
    // Display results
    const processingTime = Date.now() - startTime;
    
    if (!global.CLI_QUIET) {
      // Show album statistics
      displayTable({
        'Total Songs': albumStats.totalSongs,
        'Processed Successfully': `${albumStats.processedSongs} (${albumStats.successRate}%)`,
        'Total Lines': albumStats.totalLines,
        'Total Words': albumStats.totalWords,
        'Average Lines/Song': albumStats.averageLinesPerSong,
        'Average Words/Song': albumStats.averageWordsPerSong
      }, 'Album Statistics');
      
      // Show vocalist distribution
      if (Object.keys(albumStats.vocalistDistribution).length > 0) {
        console.log('\n🎤 Vocalist Distribution (Album-wide):');
        
        const sortedVocalists = Object.entries(albumStats.vocalistDistribution)
          .sort(([,a], [,b]) => b.lines - a.lines);
        
        sortedVocalists.forEach(([vocalist, stats]) => {
          console.log(`   ${vocalist}: ${stats.lines} lines (${stats.linesPercentage}%), ${stats.words} words (${stats.wordsPercentage}%)`);
          console.log(`      Appeared in ${stats.songsAppeared}/${albumStats.processedSongs} songs, avg ${stats.averageLinesPerSong} lines/song`);
        });
        
        // Show insights
        console.log('\n🔍 Album Insights:');
        console.log(`   Dominant Vocalist: ${insights.dominantVocalist || 'None'}`);
        console.log(`   Vocal Balance: ${insights.vocalistBalance}`);
        
        if (insights.dominantVocalist) {
          const dominantStats = albumStats.vocalistDistribution[insights.dominantVocalist];
          console.log(`   ${insights.dominantVocalist} leads in ${dominantStats.linesPercentage}% of album content`);
        }
      }
      
      // Show saved files
      console.log('\n📁 Album files saved:');
      if (options.format === 'json' || options.format === 'both') {
        console.log(`   • ${path.basename(filePaths.json)}`);
      }
      if (options.format === 'txt' || options.format === 'both') {
        console.log(`   • ${path.basename(filePaths.summary)}`);
      }
      
      console.log(`\n⏱️ Album processing completed in ${formatDuration(processingTime)}`);
      
      // Show summary of any failures
      if (successCount < songs.length) {
        const failedCount = songs.length - successCount;
        console.log(`\n⚠️ Note: ${failedCount} song(s) failed to process. Check the report for details.`);
      }
    }
    
    return {
      success: true,
      albumResult,
      files: filePaths,
      processingTime
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logError(`Failed to process album "${album}" by ${artist}`, error);
    
    if (error.message.includes('not found')) {
      console.log('💡 Suggestions:');
      console.log('   - Check spelling of album title and artist name');
      console.log('   - Try --release-index option if multiple releases exist');
      console.log('   - Use --verbose for more detailed error information');
    } else if (error.message.includes('rate limit')) {
      console.log('💡 Rate limit reached. Try using --delay option to slow down requests');
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