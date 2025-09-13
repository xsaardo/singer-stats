const https = require('https');
const zlib = require('zlib');
const cheerio = require('cheerio');

/**
 * Search for a song using Genius API
 * @param {string} artist - The artist name
 * @param {string} songTitle - The song title
 * @param {string} accessToken - Genius API access token
 * @param {string} albumName - Optional album name for better search accuracy
 * @returns {Promise<Array>} Array of song search results
 */
function searchSong(artist, songTitle, accessToken, albumName = '') {
  return new Promise((resolve, reject) => {
    const searchQuery = `${songTitle} by ${artist}`
    const query = encodeURIComponent(searchQuery);
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
 * @param {string} url - The URL to fetch
 * @returns {Promise<string>} The HTML content
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
 * Extract lyrics from Genius page HTML
 * @param {string} htmlContent - The HTML content from Genius page
 * @returns {Object} Extracted lyrics data
 */
function extractLyricsFromHTML(htmlContent) {
  const $ = cheerio.load(htmlContent);
  
  // Remove elements that should be excluded from selection
  $('div[class^="Lyrics__Container"] [data-exclude-from-selection="true"]').remove();
  
  // Find lyrics containers
  const lyricsContainers = $('div[class^="Lyrics__Container"]');
  
  console.log(`Found ${lyricsContainers.length} lyrics container(s)`);
  
  if (lyricsContainers.length === 0) {
    throw new Error('No lyrics containers found');
  }
  
  // Extract all containers and combine them
  let allContainers = '';
  lyricsContainers.each((index, container) => {
    allContainers += $.html(container) + '\n\n';
  });
  
  return {
    rawHTML: allContainers,
    containerCount: lyricsContainers.length
  };
}

/**
 * Removes all non-formatting HTML tags while preserving formatting tags and their content
 * @param {string} html - HTML content to clean
 * @returns {string} Cleaned HTML with only formatting tags
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
 * Clean HTML content and convert to plain text
 * @param {string} html - HTML content to clean
 * @returns {string} Cleaned plain text
 */
function cleanLyricsHTML(html) {
  const cleanedContent = removeNonFormattingTags(html);
  
  // Replace <br> tags with actual line breaks and clean up whitespace
  return cleanedContent
    .replace(/<br>/g, '\n') // Replace <br> tags with line breaks
    .trim();
}

module.exports = {
  searchSong,
  fetchPageHTML,
  extractLyricsFromHTML,
  removeNonFormattingTags,
  cleanLyricsHTML
};