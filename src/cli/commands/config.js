const { getConfig } = require('../../config/index.js');
const { logStatus, logError, displayTable } = require('../utils/progress.js');

/**
 * Execute the config command
 * @param {string} action - Action to perform (init, show, set, get)
 * @param {string} key - Configuration key for set/get actions
 * @param {string} value - Configuration value for set action
 * @param {Object} options - Command options
 */
async function execute(action = 'show', key, value, options) {
  try {
    const config = getConfig();
    
    switch (action) {
      case 'init':
        await initConfig(options);
        break;
        
      case 'show':
        showConfig(config);
        break;
        
      case 'set':
        if (!key || value === undefined) {
          logError('Both key and value are required for set action', null, true);
        }
        setConfigValue(config, key, value);
        break;
        
      case 'get':
        if (!key) {
          logError('Key is required for get action', null, true);
        }
        getConfigValue(config, key);
        break;
        
      default:
        logError(`Unknown action: ${action}. Valid actions: init, show, set, get`, null, true);
    }
    
  } catch (error) {
    logError(`Config command failed`, error, true);
  }
}

/**
 * Initialize configuration file
 * @param {Object} options - Command options
 */
async function initConfig(options) {
  const { Config } = require('../../config/index.js');
  
  try {
    Config.createSampleConfig('config.json');
    logStatus('success', 'Sample configuration file created: config.json');
    console.log('\n📋 Next steps:');
    console.log('   1. Edit config.json and add your Genius API token');
    console.log('   2. Customize other settings as needed');
    console.log('   3. Run "backstreet-lyrics config show" to verify settings');
  } catch (error) {
    if (error.message.includes('EEXIST') && !options.force) {
      logError('Configuration file already exists. Use --force to overwrite');
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Show current configuration
 * @param {Object} config - Configuration instance
 */
function showConfig(config) {
  logStatus('config', 'Current Configuration');
  
  const allConfig = config.getAll();
  
  // Show key configuration sections
  console.log('\n🔑 API Configuration:');
  const apiConfig = allConfig.apis || {};
  
  if (apiConfig.genius) {
    const hasToken = !!(apiConfig.genius.accessToken || process.env.GENIUS_ACCESS_TOKEN);
    displayTable({
      'Access Token': hasToken ? '✅ Configured' : '❌ Missing',
      'Rate Limit': `${apiConfig.genius.rateLimit?.maxRequests || 'Unknown'} requests per ${(apiConfig.genius.rateLimit?.windowMs || 60000) / 1000}s`,
      'Timeout': `${apiConfig.genius.timeout || 'Unknown'}ms`,
      'Retries': apiConfig.genius.retries || 'Unknown'
    }, 'Genius API');
  }
  
  if (apiConfig.musicbrainz) {
    displayTable({
      'User Agent': apiConfig.musicbrainz.userAgent || 'Default',
      'Rate Limit': `${apiConfig.musicbrainz.rateLimit?.maxRequests || 'Unknown'} requests per ${(apiConfig.musicbrainz.rateLimit?.windowMs || 1000) / 1000}s`,
      'Timeout': `${apiConfig.musicbrainz.timeout || 'Unknown'}ms`,
      'Retries': apiConfig.musicbrainz.retries || 'Unknown'
    }, 'MusicBrainz API');
  }
  
  // Show output configuration
  console.log('\n📁 Output Configuration:');
  const outputConfig = allConfig.output || {};
  displayTable({
    'Directory': outputConfig.directory || 'output',
    'Save JSON': outputConfig.formats?.saveJSON ? '✅' : '❌',
    'Save TXT': outputConfig.formats?.saveTXT ? '✅' : '❌',
    'Save Annotated': outputConfig.formats?.saveAnnotated ? '✅' : '❌',
    'Include Timestamp': outputConfig.filename?.includeTimestamp ? '✅' : '❌'
  }, 'Output Settings');
  
  // Show processing configuration
  console.log('\n⚙️ Processing Configuration:');
  const processingConfig = allConfig.processing || {};
  displayTable({
    'Song Delay': `${processingConfig.delays?.betweenSongs || 'Unknown'}ms`,
    'Request Delay': `${processingConfig.delays?.betweenRequests || 'Unknown'}ms`,
    'Skip Failed Songs': processingConfig.album?.skipFailedSongs ? '✅' : '❌',
    'Continue on Error': processingConfig.album?.continueOnError ? '✅' : '❌',
    'Parse Vocalists': processingConfig.lyrics?.parseVocalists ? '✅' : '❌'
  }, 'Processing Settings');
  
  // Show logging configuration
  console.log('\n📝 Logging Configuration:');
  const loggingConfig = allConfig.logging || {};
  displayTable({
    'Level': loggingConfig.level || 'info',
    'Console Output': loggingConfig.console ? '✅' : '❌',
    'File Output': loggingConfig.file ? '✅' : '❌',
    'Log File': loggingConfig.filename || 'None'
  }, 'Logging Settings');
  
  // Show environment variables
  console.log('\n🌍 Environment Variables:');
  displayTable({
    'GENIUS_ACCESS_TOKEN': process.env.GENIUS_ACCESS_TOKEN ? '✅ Set' : '❌ Not set',
    'OUTPUT_DIR': process.env.OUTPUT_DIR || '❌ Not set',
    'LOG_LEVEL': process.env.LOG_LEVEL || '❌ Not set'
  }, 'Environment Variables');
  
  // Show configuration validation
  console.log('\n✅ Configuration Validation:');
  const errors = config.validate();
  if (errors.length === 0) {
    console.log('   ✅ Configuration is valid');
  } else {
    console.log('   ❌ Configuration has errors:');
    errors.forEach(error => console.log(`      • ${error}`));
  }
}

/**
 * Set a configuration value
 * @param {Object} config - Configuration instance
 * @param {string} key - Configuration key
 * @param {string} value - Configuration value
 */
function setConfigValue(config, key, value) {
  try {
    // Try to parse value as JSON for objects/arrays
    let parsedValue = value;
    if (value.startsWith('{') || value.startsWith('[') || value === 'true' || value === 'false' || !isNaN(value)) {
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // Keep as string if JSON parsing fails
      }
    }
    
    config.set(key, parsedValue);
    config.saveToFile();
    
    logStatus('success', `Configuration updated: ${key} = ${JSON.stringify(parsedValue)}`);
    
    // Validate configuration after setting
    const errors = config.validate();
    if (errors.length > 0) {
      console.log('\n⚠️ Configuration warnings:');
      errors.forEach(error => console.log(`   • ${error}`));
    }
    
  } catch (error) {
    logError(`Failed to set configuration value`, error, true);
  }
}

/**
 * Get a configuration value
 * @param {Object} config - Configuration instance
 * @param {string} key - Configuration key
 */
function getConfigValue(config, key) {
  try {
    const value = config.get(key);
    
    if (value === undefined) {
      logError(`Configuration key not found: ${key}`);
      console.log('\n💡 Use "backstreet-lyrics config show" to see all available keys');
      process.exit(1);
    }
    
    console.log(`${key}: ${JSON.stringify(value, null, 2)}`);
    
  } catch (error) {
    logError(`Failed to get configuration value`, error, true);
  }
}

module.exports = {
  execute
};