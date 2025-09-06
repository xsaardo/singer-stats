const https = require('https');

/**
 * Make a request to MusicBrainz API
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
 * Demo function to show the complete workflow
 */
async function demoMusicBrainzAPI() {
  try {
    // Example 1: Search for a Backstreet Boys album
    console.log('=== DEMO 1: Searching for "Millennium" by "Backstreet Boys" ===');
    
    const searchResult = await searchAlbum('Backstreet Boys', 'Millennium');
    
    console.log(`\nSearch Results: Found ${searchResult.releases.length} releases`);
    
    if (searchResult.releases.length > 0) {
      const release = searchResult.releases[0];
      console.log(`\nFirst Result:`);
      console.log(`- Title: ${release.title}`);
      console.log(`- Release ID: ${release.id}`);
      console.log(`- Date: ${release.date || 'Unknown'}`);
      console.log(`- Country: ${release.country || 'Unknown'}`);
      console.log(`- Status: ${release.status || 'Unknown'}`);
      console.log(`- Packaging: ${release.packaging || 'Unknown'}`);
      
      // Get detailed tracklist
      const tracklist = await getAlbumTracklist(release.id);
      
      if (tracklist.media && tracklist.media.length > 0) {
        console.log(`\nTracklist (${tracklist.media.length} disc(s)):`);
        
        tracklist.media.forEach((disc, discIndex) => {
          console.log(`\nDisc ${discIndex + 1}:`);
          if (disc.tracks) {
            disc.tracks.forEach((track, index) => {
              const duration = track.length ? `${Math.floor(track.length / 60000)}:${String(Math.floor((track.length % 60000) / 1000)).padStart(2, '0')}` : 'Unknown';
              console.log(`  ${track.position}. ${track.title} (${duration})`);
            });
          }
        });
        
        // Show track data structure for reference
        console.log(`\n--- Sample Track Data Structure ---`);
        console.log(JSON.stringify(tracklist.media[0].tracks[0], null, 2));
      }
    }
    
    // Wait before next request (be nice to the API)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Example 2: Show what happens with a more generic search
    console.log('\n\n=== DEMO 2: Generic search for "DNA" (multiple results) ===');
    
    const genericSearch = await searchAlbum('Backstreet Boys', 'DNA');
    
    console.log(`\nGeneric Search Results: Found ${genericSearch.releases.length} releases`);
    
    genericSearch.releases.slice(0, 3).forEach((release, index) => {
      console.log(`\n${index + 1}. ${release.title}`);
      console.log(`   - ID: ${release.id}`);
      console.log(`   - Date: ${release.date || 'Unknown'}`);
      console.log(`   - Country: ${release.country || 'Unknown'}`);
      console.log(`   - Status: ${release.status || 'Unknown'}`);
      console.log(`   - Barcode: ${release.barcode || 'Unknown'}`);
    });
    
  } catch (error) {
    console.error('Demo failed:', error.message);
  }
}

/**
 * Extract song list from a release for use with Genius API
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

// Command line usage
if (require.main === module) {
  const [,, artistName, albumName] = process.argv;
  
  if (!artistName || !albumName) {
    console.log('Usage: node musicbrainz_demo.js "Artist Name" "Album Name"');
    console.log('Example: node musicbrainz_demo.js "Backstreet Boys" "Millennium"');
    console.log('\nOr run without arguments to see the full demo:');
    console.log('node musicbrainz_demo.js');
    
    // Run full demo if no arguments
    demoMusicBrainzAPI();
  } else {
    // Search for specific album
    searchAlbum(artistName, albumName)
      .then(result => {
        if (result.releases.length > 0) {
          const release = result.releases[0];
          console.log(`\nFound: "${release.title}" (${release.date || 'Unknown date'})`);
          
          return getAlbumTracklist(release.id)
            .then(tracklist => {
              const songs = extractSongList(tracklist, artistName);
              
              console.log(`\nSongs for Genius API processing:`);
              songs.forEach((song, index) => {
                console.log(`${index + 1}. ${song.artist} - ${song.title}`);
              });
              
              console.log(`\n--- JSON format for album processing ---`);
              console.log(JSON.stringify(songs, null, 2));
            });
        } else {
          console.log('No releases found for this artist/album combination.');
          console.log('Try adjusting the search terms or check the spelling.');
        }
      })
      .catch(error => {
        console.error('Search failed:', error.message);
      });
  }
}

module.exports = { searchAlbum, getAlbumTracklist, extractSongList };