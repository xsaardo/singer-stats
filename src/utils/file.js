const fs = require('fs');
const path = require('path');

/**
 * Ensure a directory exists, creating it if necessary
 * @param {string} dirPath - Path to the directory
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Create a safe filename from artist and song/album names
 * @param {string} artist - Artist name
 * @param {string} title - Song or album title
 * @param {string} suffix - Optional suffix (e.g., timestamp)
 * @returns {string} Safe filename
 */
function createSafeFilename(artist, title, suffix = '') {
  const safeArtist = artist.replace(/[^a-zA-Z0-9]/g, '_');
  const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
  const safeSuffix = suffix ? `_${suffix}` : '';
  
  return `${safeArtist}_${safeTitle}${safeSuffix}`;
}

/**
 * Generate a timestamp string for filenames
 * @returns {string} Timestamp in ISO format suitable for filenames
 */
function generateTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

/**
 * Write content to a file with automatic directory creation
 * @param {string} filePath - Full path to the file
 * @param {string} content - Content to write
 * @param {string} encoding - File encoding (default: 'utf8')
 */
function writeFile(filePath, content, encoding = 'utf8') {
  const dir = path.dirname(filePath);
  ensureDirectoryExists(dir);
  fs.writeFileSync(filePath, content, encoding);
}

/**
 * Write JSON data to a file with pretty formatting
 * @param {string} filePath - Full path to the JSON file
 * @param {Object} data - Data to write as JSON
 */
function writeJSONFile(filePath, data) {
  const content = JSON.stringify(data, null, 2);
  writeFile(filePath, content);
}

/**
 * Read and parse a JSON file
 * @param {string} filePath - Path to the JSON file
 * @returns {Object} Parsed JSON data
 */
function readJSONFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading JSON file ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Check if a file exists
 * @param {string} filePath - Path to check
 * @returns {boolean} True if file exists
 */
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * Get file stats
 * @param {string} filePath - Path to the file
 * @returns {Object|null} File stats or null if file doesn't exist
 */
function getFileStats(filePath) {
  try {
    return fs.statSync(filePath);
  } catch (error) {
    return null;
  }
}

/**
 * Delete a file if it exists
 * @param {string} filePath - Path to the file to delete
 * @returns {boolean} True if file was deleted or didn't exist
 */
function deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Get the default output directory path
 * @param {string} baseDir - Base directory (default: current working directory)
 * @returns {string} Output directory path
 */
function getOutputDir(baseDir = process.cwd()) {
  return path.join(baseDir, 'output');
}

/**
 * Create output file paths for lyrics data
 * @param {Object} songInfo - Song information object
 * @param {string} outputDir - Output directory path
 * @returns {Object} Object with file paths for different output types
 */
function createLyricsFilePaths(songInfo, outputDir) {
  const baseFilename = `lyrics_${songInfo.id}`;
  
  return {
    cleaned: path.join(outputDir, `${baseFilename}_cleaned.txt`),
    annotated: path.join(outputDir, `${baseFilename}_annotated.txt`),
    json: path.join(outputDir, `${baseFilename}_data.json`)
  };
}

/**
 * Create output file paths for album data
 * @param {string} artistName - Artist name
 * @param {string} albumName - Album name
 * @param {string} outputDir - Output directory path
 * @returns {Object} Object with file paths for different output types
 */
function createAlbumFilePaths(artistName, albumName, outputDir) {
  const timestamp = generateTimestamp();
  const baseFilename = createSafeFilename(artistName, albumName, timestamp);
  
  return {
    json: path.join(outputDir, `${baseFilename}.json`),
    summary: path.join(outputDir, `${baseFilename}_summary.txt`)
  };
}

/**
 * Save lyrics data to files
 * @param {Object} lyricsData - Lyrics data to save
 * @param {Object} filePaths - File paths object from createLyricsFilePaths
 */
function saveLyricsData(lyricsData, filePaths) {
  const outputDir = path.dirname(filePaths.cleaned);
  ensureDirectoryExists(outputDir);
  
  // Save cleaned lyrics
  if (lyricsData.cleanedContent) {
    writeFile(filePaths.cleaned, lyricsData.cleanedContent);
  }
  
  // Save annotated lyrics
  if (lyricsData.parsedLyrics) {
    const annotatedContent = lyricsData.parsedLyrics
      .map(item => `${item.vocalist}: ${item.line}`)
      .join('\n');
    writeFile(filePaths.annotated, annotatedContent);
  }
  
  // Save JSON data
  writeJSONFile(filePaths.json, lyricsData);
}

module.exports = {
  ensureDirectoryExists,
  createSafeFilename,
  generateTimestamp,
  writeFile,
  writeJSONFile,
  readJSONFile,
  fileExists,
  getFileStats,
  deleteFile,
  getOutputDir,
  createLyricsFilePaths,
  createAlbumFilePaths,
  saveLyricsData
};