const { fetchAndCleanLyrics } = require('./fetch_and_clean_lyrics');
const { searchAlbum, getAlbumTracklist, extractSongList } = require('./musicbrainz_demo');
const fs = require('fs');
const path = require('path');

/**
 * Process an entire album by artist and album name
 */
async function processAlbumByName(artistName, albumName, accessToken, options = {}) {
  const {
    delay = 1500,
    selectRelease = 0 // Which release to use if multiple found
  } = options;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`PROCESSING ALBUM: "${albumName}" by ${artistName}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    // Step 1: Get album tracklist from MusicBrainz
    console.log('🎵 Step 1: Getting album tracklist from MusicBrainz...');
    const searchResult = await searchAlbum(artistName, albumName);
    
    if (!searchResult.releases || searchResult.releases.length === 0) {
      throw new Error(`No releases found for "${albumName}" by ${artistName}"`);
    }
    
    console.log(`Found ${searchResult.releases.length} release(s)`);
    
    // Show available releases and let user know which one we're using
    if (searchResult.releases.length > 1) {
      console.log('\nAvailable releases:');
      searchResult.releases.slice(0, 5).forEach((release, index) => {
        console.log(`  ${index}: ${release.title} (${release.date || 'Unknown'}, ${release.country || 'Unknown'})`);
      });
      console.log(`\nUsing release ${selectRelease}: ${searchResult.releases[selectRelease].title}\n`);
    }
    
    const selectedRelease = searchResult.releases[selectRelease];
    
    // Wait to be nice to MusicBrainz API
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('📜 Getting detailed tracklist...');
    const tracklist = await getAlbumTracklist(selectedRelease.id);
    const songs = extractSongList(tracklist, artistName);
    
    console.log(`Found ${songs.length} songs in the album\n`);
    
    // Step 2: Process each song with Genius API
    console.log('🎤 Step 2: Processing lyrics for each song...\n');
    
    const albumStats = {};
    const songResults = [];
    
    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      console.log(`[${i + 1}/${songs.length}] Processing: "${song.title}"`);
      
      try {
        // Fetch and parse lyrics (statistics calculated during parsing)
        const lyricsResult = await fetchAndCleanLyrics(song.artist, song.title, accessToken);
        
        // Update album-wide statistics using the pre-calculated stats
        updateAlbumStats(albumStats, lyricsResult.vocalistStats);
        
        // Save individual song results
        songResults.push({
          trackNumber: song.trackNumber,
          title: song.title,
          duration: song.duration,
          songInfo: lyricsResult.songInfo,
          vocalistStats: lyricsResult.vocalistStats,
          cleanedFile: lyricsResult.cleanedFile,
          annotatedFile: lyricsResult.annotatedFile,
          lyricsLineCount: lyricsResult.parsedLinesCount
        });
        
        console.log(`  ✓ ${lyricsResult.parsedLinesCount} lines processed`);
        
        // Add delay between Genius API requests
        if (i < songs.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        console.log(`  ✗ Failed: ${error.message}`);
        songResults.push({
          trackNumber: song.trackNumber,
          title: song.title,
          duration: song.duration,
          error: error.message,
          vocalistStats: {}
        });
      }
    }
    
    // Step 3: Generate final statistics and rankings
    console.log('\n📊 Step 3: Generating album statistics...\n');
    const summary = generateAlbumSummary(albumStats, songResults);
    
    const albumResult = {
      albumInfo: {
        artist: artistName,
        title: albumName,
        releaseDate: selectedRelease.date,
        releaseId: selectedRelease.id,
        totalTracks: songs.length
      },
      albumStats,
      songResults,
      summary
    };
    
    // Step 4: Save results
    console.log('💾 Step 4: Saving results...\n');
    const files = saveAlbumResults(albumResult, artistName, albumName);
    
    return {
      ...albumResult,
      savedFiles: files
    };
    
  } catch (error) {
    console.error('Album processing failed:', error.message);
    throw error;
  }
}

/**
 * Update album-wide statistics with song statistics
 */
function updateAlbumStats(albumStats, songVocalistStats) {
  for (const [vocalist, stats] of Object.entries(songVocalistStats)) {
    if (!albumStats[vocalist]) {
      albumStats[vocalist] = {
        lines: 0,
        words: 0,
        songsAppeared: 0
      };
    }
    
    albumStats[vocalist].lines += stats.lines;
    albumStats[vocalist].words += stats.words;
    albumStats[vocalist].songsAppeared += 1;
  }
}

/**
 * Generate album summary with rankings
 */
function generateAlbumSummary(albumStats, songResults) {
  const processedSongs = songResults.filter(s => !s.error);
  const totalLines = Object.values(albumStats).reduce((sum, stats) => sum + stats.lines, 0);
  const totalWords = Object.values(albumStats).reduce((sum, stats) => sum + stats.words, 0);
  
  // Create rankings
  const vocalists = Object.keys(albumStats);
  
  const lineRanking = vocalists
    .map(vocalist => ({
      vocalist,
      lines: albumStats[vocalist].lines,
      percentage: totalLines > 0 ? ((albumStats[vocalist].lines / totalLines) * 100).toFixed(1) : '0.0',
      songsAppeared: albumStats[vocalist].songsAppeared
    }))
    .sort((a, b) => b.lines - a.lines);
  
  const wordRanking = vocalists
    .map(vocalist => ({
      vocalist,
      words: albumStats[vocalist].words,
      percentage: totalWords > 0 ? ((albumStats[vocalist].words / totalWords) * 100).toFixed(1) : '0.0',
      songsAppeared: albumStats[vocalist].songsAppeared
    }))
    .sort((a, b) => b.words - a.words);
  
  return {
    totalSongs: processedSongs.length,
    failedSongs: songResults.length - processedSongs.length,
    totalLines,
    totalWords,
    uniqueVocalists: vocalists.length,
    lineRanking,
    wordRanking,
    detailedStats: albumStats
  };
}

/**
 * Save album results to files
 */
function saveAlbumResults(albumResult, artistName, albumName) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const safeArtist = artistName.replace(/[^a-zA-Z0-9]/g, '_');
  const safeAlbum = albumName.replace(/[^a-zA-Z0-9]/g, '_');
  const baseFilename = `${safeArtist}_${safeAlbum}_${timestamp}`;
  
  // Ensure output directory exists
  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Save detailed JSON results
  const jsonFile = path.join(outputDir, `${baseFilename}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(albumResult, null, 2), 'utf8');
  
  // Save human-readable summary
  const summaryFile = path.join(outputDir, `${baseFilename}_summary.txt`);
  const summaryContent = formatAlbumSummary(albumResult);
  fs.writeFileSync(summaryFile, summaryContent, 'utf8');
  
  return { jsonFile, summaryFile };
}

/**
 * Format album summary for human reading
 */
function formatAlbumSummary(albumResult) {
  const { albumInfo, summary, songResults } = albumResult;
  
  let content = `ALBUM ANALYSIS: ${albumInfo.title} by ${albumInfo.artist}\n`;
  content += `${'='.repeat(60)}\n\n`;
  
  content += `ALBUM INFO:\n`;
  content += `- Artist: ${albumInfo.artist}\n`;
  content += `- Album: ${albumInfo.title}\n`;
  content += `- Release Date: ${albumInfo.releaseDate || 'Unknown'}\n`;
  content += `- Total Tracks: ${albumInfo.totalTracks}\n`;
  content += `- MusicBrainz ID: ${albumInfo.releaseId}\n\n`;
  
  content += `PROCESSING SUMMARY:\n`;
  content += `- Songs Successfully Processed: ${summary.totalSongs}\n`;
  content += `- Songs Failed: ${summary.failedSongs}\n`;
  content += `- Total Vocal Lines: ${summary.totalLines}\n`;
  content += `- Total Words: ${summary.totalWords}\n`;
  content += `- Unique Vocalists: ${summary.uniqueVocalists}\n\n`;
  
  content += `RANKING BY LINES:\n`;
  summary.lineRanking.forEach((rank, index) => {
    content += `${index + 1}. ${rank.vocalist}: ${rank.lines} lines (${rank.percentage}%) - appeared in ${rank.songsAppeared} songs\n`;
  });
  
  content += `\nRANKING BY WORDS:\n`;
  summary.wordRanking.forEach((rank, index) => {
    content += `${index + 1}. ${rank.vocalist}: ${rank.words} words (${rank.percentage}%) - appeared in ${rank.songsAppeared} songs\n`;
  });
  
  content += `\nDETAILED VOCALIST STATISTICS:\n`;
  Object.entries(summary.detailedStats).forEach(([vocalist, stats]) => {
    content += `\n${vocalist}:\n`;
    content += `  - Total Lines: ${stats.lines}\n`;
    content += `  - Total Words: ${stats.words}\n`;
    content += `  - Songs Appeared: ${stats.songsAppeared}\n`;
    content += `  - Avg Lines per Song: ${(stats.lines / stats.songsAppeared).toFixed(1)}\n`;
    content += `  - Avg Words per Song: ${(stats.words / stats.songsAppeared).toFixed(1)}\n`;
    content += `  - Avg Words per Line: ${(stats.words / stats.lines).toFixed(1)}\n`;
  });
  
  content += `\nSONG-BY-SONG BREAKDOWN:\n`;
  songResults.forEach(song => {
    if (song.error) {
      content += `\n${song.trackNumber}. ${song.title} - ❌ FAILED: ${song.error}\n`;
    } else {
      content += `\n${song.trackNumber}. ${song.title} - ✅ ${song.lyricsLineCount} lines processed\n`;
      Object.entries(song.vocalistStats).forEach(([vocalist, stats]) => {
        content += `   ${vocalist}: ${stats.lines} lines, ${stats.words} words\n`;
      });
    }
  });
  
  return content;
}

// Command line usage
if (require.main === module) {
  const [,, artistName, albumName, accessToken, selectRelease] = process.argv;
  
  if (!artistName || !albumName || !accessToken) {
    console.log('Usage: node process_album.js "Artist Name" "Album Name" "access_token" [release_index]');
    console.log('');
    console.log('Examples:');
    console.log('  node process_album.js "Backstreet Boys" "Millennium" "your_token_here"');
    console.log('  node process_album.js "Backstreet Boys" "Millennium" "your_token_here" 1');
    console.log('');
    console.log('release_index: If multiple releases found, specify which one to use (default: 0)');
    process.exit(1);
  }
  
  const options = {
    selectRelease: selectRelease ? parseInt(selectRelease) : 0
  };
  
  processAlbumByName(artistName, albumName, accessToken, options)
    .then(result => {
      console.log(`\n${'='.repeat(60)}`);
      console.log('🎉 ALBUM PROCESSING COMPLETE!');
      console.log(`${'='.repeat(60)}`);
      console.log(`📁 Results saved to:`);
      console.log(`   JSON: ${result.savedFiles.jsonFile}`);
      console.log(`   Summary: ${result.savedFiles.summaryFile}`);
      
      console.log(`\n📊 QUICK STATS:`);
      console.log(`   Songs processed: ${result.summary.totalSongs}/${result.albumInfo.totalTracks}`);
      console.log(`   Total lines: ${result.summary.totalLines}`);
      console.log(`   Total words: ${result.summary.totalWords}`);
      console.log(`   Vocalists found: ${result.summary.uniqueVocalists}`);
      
      if (result.summary.lineRanking.length > 0) {
        console.log(`\n🏆 TOP VOCALIST (by lines): ${result.summary.lineRanking[0].vocalist} (${result.summary.lineRanking[0].lines} lines, ${result.summary.lineRanking[0].percentage}%)`);
      }
      
      console.log(`\n📄 Full summary saved to: ${result.savedFiles.summaryFile}`);
    })
    .catch(error => {
      console.error('❌ Album processing failed:', error.message);
      process.exit(1);
    });
}

module.exports = { processAlbumByName };