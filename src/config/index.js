const fs = require('fs');
const path = require('path');

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  // API Configuration
  apis: {
    genius: {
      rateLimit: {
        maxRequests: 10,
        windowMs: 60000 // 1 minute
      },
      timeout: 10000,
      retries: 3,
      retryDelay: 1000
    },
    musicbrainz: {
      userAgent: 'BackstreetLyricsScraper/1.0 (https://github.com/user/repo)',
      rateLimit: {
        maxRequests: 1,
        windowMs: 1000 // 1 second
      },
      timeout: 10000,
      retries: 3,
      retryDelay: 1500
    }
  },
  
  // Output Configuration
  output: {
    directory: 'output',
    formats: {
      saveJSON: true,
      saveTXT: true,
      saveAnnotated: true,
      saveSummary: true
    },
    filename: {
      includeTimestamp: true,
      safeCharactersOnly: true
    }
  },
  
  // Processing Configuration
  processing: {
    delays: {
      betweenSongs: 1500, // ms
      betweenRequests: 1000 // ms
    },
    album: {
      selectReleaseIndex: 0, // Which release to pick from search results
      skipFailedSongs: true,
      continueOnError: true
    },
    lyrics: {
      cleanHTML: true,
      parseVocalists: true,
      generateStats: true
    }
  },
  
  // Logging Configuration
  logging: {
    level: 'info', // 'debug', 'info', 'warn', 'error'
    console: true,
    file: false,
    filename: 'scraper.log'
  }
};

/**
 * Configuration class to manage settings
 */
class Config {
  constructor(configPath = null) {
    this.config = { ...DEFAULT_CONFIG };
    this.configPath = configPath || this.findConfigFile();
    
    // Load config from file if it exists
    if (this.configPath && fs.existsSync(this.configPath)) {
      this.loadFromFile(this.configPath);
    }
    
    // Override with environment variables
    this.loadFromEnvironment();
  }
  
  /**
   * Find configuration file in common locations
   * @returns {string|null} Path to config file or null if not found
   */
  findConfigFile() {
    const possiblePaths = [
      path.join(process.cwd(), 'config.json'),
      path.join(process.cwd(), '.config.json'),
      path.join(process.cwd(), 'src', 'config', 'config.json'),
      path.join(process.env.HOME || process.env.USERPROFILE || '', '.lyrics-scraper-config.json')
    ];
    
    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }
    
    return null;
  }
  
  /**
   * Load configuration from file
   * @param {string} filePath - Path to configuration file
   */
  loadFromFile(filePath) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const fileConfig = JSON.parse(fileContent);
      
      // Deep merge with existing config
      this.config = this.deepMerge(this.config, fileConfig);
      
      console.log(`Configuration loaded from: ${filePath}`);
    } catch (error) {
      console.warn(`Warning: Could not load config from ${filePath}: ${error.message}`);
    }
  }
  
  /**
   * Load configuration from environment variables
   */
  loadFromEnvironment() {
    // API Keys
    if (process.env.GENIUS_ACCESS_TOKEN) {
      this.config.apis.genius.accessToken = process.env.GENIUS_ACCESS_TOKEN;
    }
    
    // Output directory
    if (process.env.OUTPUT_DIR) {
      this.config.output.directory = process.env.OUTPUT_DIR;
    }
    
    // Logging level
    if (process.env.LOG_LEVEL) {
      this.config.logging.level = process.env.LOG_LEVEL.toLowerCase();
    }
    
    // Rate limiting
    if (process.env.GENIUS_RATE_LIMIT) {
      this.config.apis.genius.rateLimit.maxRequests = parseInt(process.env.GENIUS_RATE_LIMIT);
    }
    
    if (process.env.MUSICBRAINZ_DELAY) {
      this.config.apis.musicbrainz.rateLimit.windowMs = parseInt(process.env.MUSICBRAINZ_DELAY);
    }
  }
  
  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }
  
  /**
   * Get a configuration value by path
   * @param {string} path - Dot-separated path to the config value
   * @param {*} defaultValue - Default value if path doesn't exist
   * @returns {*} Configuration value
   */
  get(path, defaultValue = undefined) {
    const keys = path.split('.');
    let current = this.config;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }
    
    return current;
  }
  
  /**
   * Set a configuration value by path
   * @param {string} path - Dot-separated path to the config value
   * @param {*} value - Value to set
   */
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = this.config;
    
    for (const key of keys) {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
  }
  
  /**
   * Get the full configuration object
   * @returns {Object} Configuration object
   */
  getAll() {
    return { ...this.config };
  }
  
  /**
   * Save current configuration to file
   * @param {string} filePath - Path to save configuration (optional)
   */
  saveToFile(filePath = null) {
    const targetPath = filePath || this.configPath || path.join(process.cwd(), 'config.json');
    
    try {
      fs.writeFileSync(targetPath, JSON.stringify(this.config, null, 2), 'utf8');
      console.log(`Configuration saved to: ${targetPath}`);
      
      if (!this.configPath) {
        this.configPath = targetPath;
      }
    } catch (error) {
      console.error(`Error saving config to ${targetPath}: ${error.message}`);
    }
  }
  
  /**
   * Validate configuration
   * @returns {Array} Array of validation errors
   */
  validate() {
    const errors = [];
    
    // Check required API token
    if (!this.get('apis.genius.accessToken')) {
      errors.push('Missing Genius API access token (set GENIUS_ACCESS_TOKEN environment variable or add to config)');
    }
    
    // Validate rate limits
    if (this.get('apis.genius.rateLimit.maxRequests') <= 0) {
      errors.push('Genius rate limit maxRequests must be greater than 0');
    }
    
    if (this.get('apis.musicbrainz.rateLimit.windowMs') <= 0) {
      errors.push('MusicBrainz rate limit windowMs must be greater than 0');
    }
    
    // Validate output directory
    const outputDir = this.get('output.directory');
    if (!outputDir) {
      errors.push('Output directory is required');
    }
    
    // Validate logging level
    const validLogLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLogLevels.includes(this.get('logging.level'))) {
      errors.push(`Invalid logging level. Must be one of: ${validLogLevels.join(', ')}`);
    }
    
    return errors;
  }
  
  /**
   * Create a sample configuration file
   * @param {string} filePath - Path where to create the sample config
   */
  static createSampleConfig(filePath = 'config.json') {
    const sampleConfig = {
      ...DEFAULT_CONFIG,
      apis: {
        ...DEFAULT_CONFIG.apis,
        genius: {
          ...DEFAULT_CONFIG.apis.genius,
          accessToken: 'YOUR_GENIUS_API_TOKEN_HERE'
        }
      }
    };
    
    try {
      fs.writeFileSync(filePath, JSON.stringify(sampleConfig, null, 2), 'utf8');
      console.log(`Sample configuration created at: ${filePath}`);
      console.log('Please edit the file and add your Genius API token.');
    } catch (error) {
      console.error(`Error creating sample config: ${error.message}`);
    }
  }
}

// Global config instance
let globalConfig = null;

/**
 * Get the global configuration instance
 * @param {string} configPath - Optional path to config file
 * @returns {Config} Configuration instance
 */
function getConfig(configPath = null) {
  if (!globalConfig || configPath) {
    globalConfig = new Config(configPath);
  }
  return globalConfig;
}

/**
 * Initialize configuration with validation
 * @param {string} configPath - Optional path to config file
 * @returns {Config} Configuration instance
 * @throws {Error} If configuration is invalid
 */
function initConfig(configPath = null) {
  const config = getConfig(configPath);
  const errors = config.validate();
  
  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    throw new Error('Invalid configuration. Please fix the errors above.');
  }
  
  return config;
}

module.exports = {
  Config,
  getConfig,
  initConfig,
  DEFAULT_CONFIG
};