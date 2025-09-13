const https = require('https');

/**
 * Make a request to MusicBrainz API
 * @param {string} path - API endpoint path
 * @param {string} userAgent - User agent string for API requests
 * @returns {Promise<Object>} API response data
 */
function musicbrainzRequest(path, userAgent = 'AlbumProcessor/1.0 (example@email.com)') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'musicbrainz.org',
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json'
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
          resolve(response);
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
 * Search for an album by artist and release name
 * @param {string} artistName - Name of the artist
 * @param {string} albumName - Name of the album
 * @returns {Promise<Object>} Search results from MusicBrainz
 */
async function searchAlbum(artistName, albumName) {
  console.log(`\nSearching for album: "${albumName}" by "${artistName}"`);
  
  const query = encodeURIComponent(`artist:"${artistName}" AND release:"${albumName}"`);
  const path = `/ws/2/release/?query=${query}&inc=recordings&fmt=json&limit=10`;
  
  console.log(`API URL: https://musicbrainz.org${path}`);
  
  try {
    const response = await musicbrainzRequest(path);
    return response;
  } catch (error) {
    console.error('Error searching album:', error.message);
    throw error;
  }
}

/**
 * Get detailed tracklist for a specific release
 * @param {string} releaseId - MusicBrainz release ID
 * @returns {Promise<Object>} Release data with tracks
 */
async function getAlbumTracklist(releaseId) {
  console.log(`\nGetting tracklist for release ID: ${releaseId}`);
  
  const path = `/ws/2/release/${releaseId}?inc=recordings&fmt=json`;
  
  console.log(`API URL: https://musicbrainz.org${path}`);
  
  try {
    const response = await musicbrainzRequest(path);
    return response;
  } catch (error) {
    console.error('Error getting tracklist:', error.message);
    throw error;
  }
}

/**
 * Extract song list from a release for use with Genius API
 * @param {Object} release - MusicBrainz release object
 * @param {string} artistName - Name of the artist
 * @returns {Array} Array of song objects
 */
function extractSongList(release, artistName) {
  const songs = [];
  
  if (release.media && release.media.length > 0) {
    release.media.forEach(disc => {
      if (disc.tracks) {
        disc.tracks.forEach(track => {
          songs.push({
            artist: artistName,
            title: track.title,
            trackNumber: track.position,
            duration: track.length ? Math.round(track.length / 1000) : null // Convert to seconds
          });
        });
      }
    });
  }
  
  return songs;
}

/**
 * Get the best release from search results
 * @param {Array} releases - Array of release objects
 * @param {Object} options - Selection criteria
 * @returns {Object|null} Best matching release
 */
function selectBestRelease(releases, options = {}) {
  if (!releases || releases.length === 0) {
    return null;
  }
  
  // Default selection index
  const { selectIndex = 0 } = options;
  
  // For now, just return the specified index (default first)
  // TODO: Add more sophisticated selection logic based on:
  // - Country preference
  // - Release status (Official > Promotion > etc.)
  // - Packaging type
  // - Date (earliest original release)
  
  return releases[selectIndex] || releases[0];
}

/**
 * Search for album and return the best release with tracklist
 * @param {string} artistName - Name of the artist
 * @param {string} albumName - Name of the album
 * @param {Object} options - Search and selection options
 * @returns {Promise<Object>} Release with tracklist and song list
 */
async function getAlbumData(artistName, albumName, options = {}) {
  try {
    // Search for the album
    const searchResult = await searchAlbum(artistName, albumName);
    
    if (!searchResult.releases || searchResult.releases.length === 0) {
      throw new Error(`No releases found for "${albumName}" by "${artistName}"`);
    }
    
    // Select the best release
    const selectedRelease = selectBestRelease(searchResult.releases, options);
    
    if (!selectedRelease) {
      throw new Error('No suitable release found');
    }
    
    // Get detailed tracklist
    const releaseWithTracks = await getAlbumTracklist(selectedRelease.id);
    
    // Extract song list
    const songs = extractSongList(releaseWithTracks, artistName);
    
    return {
      release: releaseWithTracks,
      songs: songs,
      searchResultCount: searchResult.releases.length
    };
  } catch (error) {
    console.error('Error getting album data:', error.message);
    throw error;
  }
}

module.exports = {
  musicbrainzRequest,
  searchAlbum,
  getAlbumTracklist,
  extractSongList,
  selectBestRelease,
  getAlbumData
};