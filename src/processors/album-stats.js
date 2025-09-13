/**
 * Album-level statistics aggregation
 */

/**
 * Aggregate vocalist statistics across multiple songs
 * @param {Array} songResults - Array of song processing results
 * @returns {Object} Aggregated album statistics
 */
function aggregateAlbumStats(songResults) {
  const successfulSongs = songResults.filter(result => result.success && result.vocalistStats);
  
  if (successfulSongs.length === 0) {
    return {
      totalSongs: songResults.length,
      processedSongs: 0,
      successRate: 0,
      totalLines: 0,
      totalWords: 0,
      vocalistDistribution: {},
      topVocalist: null,
      songBreakdown: []
    };
  }
  
  // Initialize aggregated stats
  const aggregatedVocalists = {};
  let totalLines = 0;
  let totalWords = 0;
  
  // Aggregate stats from all successful songs
  successfulSongs.forEach(song => {
    const songStats = song.vocalistStats.vocalistStats;
    
    Object.entries(songStats).forEach(([vocalist, stats]) => {
      if (!aggregatedVocalists[vocalist]) {
        aggregatedVocalists[vocalist] = {
          lines: 0,
          words: 0,
          songsAppeared: 0,
          songDetails: []
        };
      }
      
      aggregatedVocalists[vocalist].lines += stats.lines;
      aggregatedVocalists[vocalist].words += stats.words;
      aggregatedVocalists[vocalist].songsAppeared += 1;
      aggregatedVocalists[vocalist].songDetails.push({
        songTitle: song.songInfo.title,
        lines: stats.lines,
        words: stats.words,
        linesPercentage: parseFloat(stats.linesPercentage),
        wordsPercentage: parseFloat(stats.wordsPercentage)
      });
    });
    
    totalLines += song.vocalistStats.totalLines;
    totalWords += song.vocalistStats.totalWords;
  });
  
  // Calculate percentages and find top vocalist
  let topVocalist = null;
  let maxLines = 0;
  
  Object.entries(aggregatedVocalists).forEach(([vocalist, stats]) => {
    stats.linesPercentage = totalLines > 0 ? (stats.lines / totalLines * 100).toFixed(1) : 0;
    stats.wordsPercentage = totalWords > 0 ? (stats.words / totalWords * 100).toFixed(1) : 0;
    stats.averageLinesPerSong = (stats.lines / stats.songsAppeared).toFixed(1);
    stats.averageWordsPerSong = (stats.words / stats.songsAppeared).toFixed(1);
    
    if (stats.lines > maxLines) {
      maxLines = stats.lines;
      topVocalist = vocalist;
    }
  });
  
  // Create song breakdown for detailed analysis
  const songBreakdown = successfulSongs.map(song => ({
    title: song.songInfo.title,
    trackNumber: song.trackNumber || null,
    status: 'success',
    lines: song.vocalistStats.totalLines,
    words: song.vocalistStats.totalWords,
    vocalists: Object.keys(song.vocalistStats.vocalistStats),
    processingTime: song.processingTime,
    topVocalist: findTopVocalistInSong(song.vocalistStats.vocalistStats)
  }));
  
  // Add failed songs to breakdown
  const failedSongs = songResults.filter(result => !result.success);
  failedSongs.forEach(song => {
    songBreakdown.push({
      title: song.title || 'Unknown',
      trackNumber: song.trackNumber || null,
      status: 'failed',
      error: song.error,
      processingTime: song.processingTime || 0
    });
  });
  
  // Sort breakdown by track number if available
  songBreakdown.sort((a, b) => {
    if (a.trackNumber && b.trackNumber) {
      return parseInt(a.trackNumber) - parseInt(b.trackNumber);
    }
    return 0;
  });
  
  return {
    totalSongs: songResults.length,
    processedSongs: successfulSongs.length,
    successRate: ((successfulSongs.length / songResults.length) * 100).toFixed(1),
    totalLines,
    totalWords,
    vocalistDistribution: aggregatedVocalists,
    topVocalist,
    songBreakdown,
    averageLinesPerSong: successfulSongs.length > 0 ? (totalLines / successfulSongs.length).toFixed(1) : 0,
    averageWordsPerSong: successfulSongs.length > 0 ? (totalWords / successfulSongs.length).toFixed(1) : 0
  };
}

/**
 * Find the top vocalist in a single song
 * @param {Object} vocalistStats - Vocalist statistics for a song
 * @returns {string|null} Name of top vocalist
 */
function findTopVocalistInSong(vocalistStats) {
  let topVocalist = null;
  let maxLines = 0;
  
  Object.entries(vocalistStats).forEach(([vocalist, stats]) => {
    if (stats.lines > maxLines) {
      maxLines = stats.lines;
      topVocalist = vocalist;
    }
  });
  
  return topVocalist;
}

/**
 * Generate insights from album statistics
 * @param {Object} albumStats - Aggregated album statistics
 * @returns {Object} Album insights
 */
function generateAlbumInsights(albumStats) {
  const insights = {
    dominantVocalist: albumStats.topVocalist,
    vocalistBalance: 'unknown',
    consistency: 'unknown',
    participation: {}
  };
  
  if (Object.keys(albumStats.vocalistDistribution).length === 0) {
    return insights;
  }
  
  const vocalists = Object.entries(albumStats.vocalistDistribution);
  const totalSongs = albumStats.processedSongs;
  
  // Analyze vocalist balance
  const percentages = vocalists.map(([, stats]) => parseFloat(stats.linesPercentage));
  const maxPercentage = Math.max(...percentages);
  const minPercentage = Math.min(...percentages);
  const difference = maxPercentage - minPercentage;
  
  if (difference < 15) {
    insights.vocalistBalance = 'very balanced';
  } else if (difference < 30) {
    insights.vocalistBalance = 'fairly balanced';
  } else if (difference < 50) {
    insights.vocalistBalance = 'somewhat unbalanced';
  } else {
    insights.vocalistBalance = 'heavily unbalanced';
  }
  
  // Analyze participation
  vocalists.forEach(([vocalist, stats]) => {
    const participationRate = (stats.songsAppeared / totalSongs) * 100;
    insights.participation[vocalist] = {
      songsAppeared: stats.songsAppeared,
      participationRate: participationRate.toFixed(1),
      averageContribution: stats.linesPercentage
    };
  });
  
  // Analyze consistency (how consistent each vocalist's contribution is across songs)
  vocalists.forEach(([vocalist, stats]) => {
    const songPercentages = stats.songDetails.map(song => song.linesPercentage);
    const avgPercentage = songPercentages.reduce((sum, p) => sum + p, 0) / songPercentages.length;
    const variance = songPercentages.reduce((sum, p) => sum + Math.pow(p - avgPercentage, 2), 0) / songPercentages.length;
    const standardDeviation = Math.sqrt(variance);
    
    insights.participation[vocalist].consistency = standardDeviation < 5 ? 'very consistent' :
                                                 standardDeviation < 10 ? 'consistent' :
                                                 standardDeviation < 20 ? 'somewhat variable' : 'highly variable';
  });
  
  return insights;
}

/**
 * Create a detailed album report
 * @param {Object} albumInfo - Album information
 * @param {Object} albumStats - Aggregated statistics
 * @param {Object} insights - Album insights
 * @returns {string} Formatted album report
 */
function createAlbumReport(albumInfo, albumStats, insights) {
  const lines = [];
  
  lines.push(`ALBUM ANALYSIS REPORT`);
  lines.push(`${'='.repeat(50)}`);
  lines.push(`Album: ${albumInfo.title}`);
  lines.push(`Artist: ${albumInfo.artist}`);
  lines.push(`Release ID: ${albumInfo.releaseId || 'Unknown'}`);
  lines.push(`Generated: ${new Date().toISOString().split('T')[0]}`);
  lines.push('');
  
  lines.push(`PROCESSING SUMMARY`);
  lines.push(`${'-'.repeat(30)}`);
  lines.push(`Total Songs: ${albumStats.totalSongs}`);
  lines.push(`Successfully Processed: ${albumStats.processedSongs}`);
  lines.push(`Success Rate: ${albumStats.successRate}%`);
  lines.push(`Total Lines Analyzed: ${albumStats.totalLines}`);
  lines.push(`Total Words Analyzed: ${albumStats.totalWords}`);
  lines.push('');
  
  if (Object.keys(albumStats.vocalistDistribution).length > 0) {
    lines.push(`VOCALIST DISTRIBUTION`);
    lines.push(`${'-'.repeat(30)}`);
    
    const sortedVocalists = Object.entries(albumStats.vocalistDistribution)
      .sort(([,a], [,b]) => b.lines - a.lines);
    
    sortedVocalists.forEach(([vocalist, stats]) => {
      lines.push(`${vocalist}:`);
      lines.push(`  Lines: ${stats.lines} (${stats.linesPercentage}%)`);
      lines.push(`  Words: ${stats.words} (${stats.wordsPercentage}%)`);
      lines.push(`  Songs Appeared: ${stats.songsAppeared}/${albumStats.processedSongs}`);
      lines.push(`  Avg Lines/Song: ${stats.averageLinesPerSong}`);
      lines.push(`  Consistency: ${insights.participation[vocalist]?.consistency || 'Unknown'}`);
      lines.push('');
    });
    
    lines.push(`INSIGHTS`);
    lines.push(`${'-'.repeat(30)}`);
    lines.push(`Dominant Vocalist: ${insights.dominantVocalist || 'None'}`);
    lines.push(`Vocal Balance: ${insights.vocalistBalance}`);
    lines.push('');
  }
  
  lines.push(`SONG BREAKDOWN`);
  lines.push(`${'-'.repeat(30)}`);
  
  albumStats.songBreakdown.forEach((song, index) => {
    const trackNum = song.trackNumber ? `${song.trackNumber}.` : `${index + 1}.`;
    lines.push(`${trackNum} ${song.title}`);
    
    if (song.status === 'success') {
      lines.push(`   Status: ✅ Success`);
      lines.push(`   Lines: ${song.lines}, Words: ${song.words}`);
      lines.push(`   Vocalists: ${song.vocalists.join(', ')}`);
      lines.push(`   Top Vocalist: ${song.topVocalist || 'Unknown'}`);
    } else {
      lines.push(`   Status: ❌ Failed`);
      lines.push(`   Error: ${song.error || 'Unknown error'}`);
    }
    lines.push('');
  });
  
  return lines.join('\n');
}

module.exports = {
  aggregateAlbumStats,
  findTopVocalistInSong,
  generateAlbumInsights,
  createAlbumReport
};