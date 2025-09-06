const https = require('https');
const fs = require('fs');
const zlib = require('zlib');
const cheerio = require('cheerio');
const { parseLyricsWithVocalists } = require('./parse_lyrics');

/**
 * Search for a song using Genius API
 */
function searchSong(artist, songTitle, accessToken) {
  return new Promise((resolve, reject) => {
    const query = encodeURIComponent(`${artist} ${songTitle}`);
    const options = {
      hostname: 'api.genius.com',
      path: `/search?q=${query}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'Lyrics Fetcher and Cleaner'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.response && response.response.hits) {
            const songs = response.response.hits.map(hit => hit.result);
            resolve(songs);
          } else {
            resolve([]);
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

/**
 * Fetch HTML content from Genius page with proper decompression
 */
function fetchPageHTML(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Lyrics Fetcher and Cleaner)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    };
    
    const req = https.request(options, (res) => {
      let stream = res;
      
      // Handle different compression types
      const encoding = res.headers['content-encoding'];
      if (encoding === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      } else if (encoding === 'br') {
        stream = res.pipe(zlib.createBrotliDecompress());
      }
      
      let data = '';
      
      stream.on('data', (chunk) => {
        data += chunk.toString('utf8');
      });
      
      stream.on('end', () => {
        resolve(data);
      });
      
      stream.on('error', reject);
    });
    
    req.on('error', reject);
    req.end();
  });
}

/**
 * Removes all non-formatting HTML tags while preserving formatting tags and their content
 */
function removeNonFormattingTags(html) {
  
  // List of formatting tags to preserve
  const formattingTags = [
    'b', 'strong', 'i', 'em', 'u', 'ins', 'del', 's', 'strike', 
    'sup', 'sub', 'mark', 'small', 'big', 'code', 'kbd', 'samp', 
    'var', 'abbr', 'acronym', 'cite', 'dfn', 'q', 'blockquote', 
    'pre', 'tt', 'br', 'hr', 'wbr'
  ];
  
  // Remove all tags except formatting ones, but keep the content
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g, (match, tagName) => {
    if (formattingTags.includes(tagName.toLowerCase())) {
      return match; // Keep formatting tags
    }
    return ''; // Remove non-formatting tags but content remains
  });
}

/**
 * Fetch HTML, extract lyrics containers, and clean them
 */
async function fetchAndCleanLyrics(artist, songTitle, accessToken) {
  try {
    console.log('Searching for song...');
    const searchResults = await searchSong(artist, songTitle, accessToken);
    
    if (!searchResults.length) {
      throw new Error('Song not found');
    }
    
    const song = searchResults[0];
    console.log(`Found: ${song.title} by ${song.primary_artist.name}`);
    console.log(`URL: ${song.url}`);
    
    console.log('Fetching HTML...');
    const htmlContent = await fetchPageHTML(song.url);
    
    console.log('Extracting lyrics containers...');
    const $ = cheerio.load(htmlContent);
    $('div[class^="Lyrics__Container"] [data-exclude-from-selection="true"]').remove();
    lyricsContainers = $('div[class^="Lyrics__Container"]');
    
    console.log($.html(lyricsContainers));
    // Excludes song information blurb 

    console.log(`Found ${lyricsContainers.length} lyrics container(s)`);
    
    if (lyricsContainers.length === 0) {
      throw new Error('No lyrics containers found');
    }
    
    // Extract all containers and combine them
    let allContainers = '';
    lyricsContainers.each((index, container) => {
      allContainers += $.html(container) + '\n\n';
    });
    
    console.log('Cleaning HTML tags...');
    const cleanedContent = removeNonFormattingTags(allContainers);
    
    // Replace <br> tags with actual line breaks and clean up whitespace
    const finalContent = cleanedContent
      .replace(/<br>/g, '\n') // Replace <br> tags with line breaks
      .trim();
    
    // Save cleaned content to file
    const filename = `lyrics_cleaned_${song.id}.txt`;
    const filepath = `/Users/cuongluong/Desktop/backstreetdata/${filename}`;
    
    fs.writeFileSync(filepath, finalContent, 'utf8');
    
    console.log(`Cleaned lyrics saved to: ${filepath}`);
    
    // Parse lyrics with vocalists (statistics calculated during parsing)
    console.log('Parsing lyrics with vocalists...');
    const parseResult = parseLyricsWithVocalists(finalContent);
    
    // Save annotated version
    const annotatedFilename = `lyrics_annotated_${song.id}.txt`;
    const annotatedFilepath = `/Users/cuongluong/Desktop/backstreetdata/${annotatedFilename}`;
    
    const annotatedContent = parseResult.parsedLyrics
      .map(item => `${item.vocalist}: ${item.line}`)
      .join('\n');
    
    fs.writeFileSync(annotatedFilepath, annotatedContent, 'utf8');
    
    console.log(`Annotated lyrics saved to: ${annotatedFilepath}`);
    console.log(`Total containers: ${lyricsContainers.length}`);
    console.log(`Original HTML length: ${allContainers.length} characters`);
    console.log(`Cleaned length: ${finalContent.length} characters`);
    
    return {
      songInfo: song,
      cleanedFile: filepath,
      annotatedFile: annotatedFilepath,
      parsedLyrics: parseResult.parsedLyrics,
      vocalistStats: parseResult.vocalistStats,
      containerCount: lyricsContainers.length,
      originalLength: allContainers.length,
      cleanedLength: finalContent.length,
      parsedLinesCount: parseResult.parsedLyrics.length
    };
    
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

// Command line usage
if (require.main === module) {
  const [,, artist, songTitle, accessToken] = process.argv;
  
  if (!artist || !songTitle || !accessToken) {
    console.log('Usage: node fetch_and_clean_lyrics.js "Artist Name" "Song Title" "access_token"');
    console.log('Example: node fetch_and_clean_lyrics.js "Backstreet Boys" "I Want It That Way" "your_token_here"');
    process.exit(1);
  }
  
  fetchAndCleanLyrics(artist, songTitle, accessToken)
    .then(result => {
      console.log('\n=== SUMMARY ===');
      console.log(`Title: ${result.songInfo.title}`);
      console.log(`Artist: ${result.songInfo.primary_artist.name}`);
      console.log(`Cleaned file: ${result.cleanedFile}`);
      console.log(`Annotated file: ${result.annotatedFile}`);
      console.log(`Total containers: ${result.containerCount}`);
      console.log(`Parsed lines: ${result.parsedLinesCount}`);
      console.log(`Size reduction: ${((result.originalLength - result.cleanedLength) / result.originalLength * 100).toFixed(1)}%`);
    })
    .catch(error => {
      console.error('Failed:', error.message);
      process.exit(1);
    });
}

module.exports = { fetchAndCleanLyrics, searchSong, fetchPageHTML, removeNonFormattingTags };