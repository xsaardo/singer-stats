const https = require('https');

/**
 * Default HTTP request options
 */
const DEFAULT_OPTIONS = {
  timeout: 10000, // 10 seconds
  retries: 3,
  retryDelay: 1000, // 1 second
  userAgent: 'Lyrics Scraper/1.0'
};

/**
 * Make an HTTP GET request with retry logic
 * @param {string} url - URL to request
 * @param {Object} options - Request options
 * @returns {Promise<string>} Response data
 */
function httpGet(url, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    function attemptRequest() {
      attempts++;
      
      const urlObj = new URL(url);
      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': opts.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          ...opts.headers
        },
        timeout: opts.timeout
      };
      
      const protocol = urlObj.protocol === 'https:' ? https : require('http');
      
      const req = protocol.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else if (res.statusCode >= 400 && res.statusCode < 500) {
            // Client errors - don't retry
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          } else if (attempts < opts.retries) {
            // Server errors - retry
            console.log(`Request failed with ${res.statusCode}, retrying in ${opts.retryDelay}ms... (attempt ${attempts}/${opts.retries})`);
            setTimeout(attemptRequest, opts.retryDelay);
          } else {
            reject(new Error(`HTTP ${res.statusCode} after ${opts.retries} retries`));
          }
        });
      });
      
      req.on('error', (error) => {
        if (attempts < opts.retries) {
          console.log(`Request failed: ${error.message}, retrying in ${opts.retryDelay}ms... (attempt ${attempts}/${opts.retries})`);
          setTimeout(attemptRequest, opts.retryDelay);
        } else {
          reject(error);
        }
      });
      
      req.on('timeout', () => {
        req.destroy();
        if (attempts < opts.retries) {
          console.log(`Request timed out, retrying in ${opts.retryDelay}ms... (attempt ${attempts}/${opts.retries})`);
          setTimeout(attemptRequest, opts.retryDelay);
        } else {
          reject(new Error(`Request timed out after ${opts.retries} retries`));
        }
      });
      
      req.end();
    }
    
    attemptRequest();
  });
}

/**
 * Make an HTTP GET request expecting JSON response
 * @param {string} url - URL to request
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Parsed JSON response
 */
async function httpGetJSON(url, options = {}) {
  const data = await httpGet(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      ...options.headers
    }
  });
  
  try {
    return JSON.parse(data);
  } catch (error) {
    throw new Error(`Invalid JSON response: ${error.message}`);
  }
}

/**
 * Add delay between requests to be respectful to APIs
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Rate limiter class to control request frequency
 */
class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) { // 10 requests per minute by default
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }
  
  /**
   * Wait if necessary to respect rate limits
   * @returns {Promise<void>}
   */
  async waitForSlot() {
    const now = Date.now();
    
    // Remove expired requests from the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      // Wait until the oldest request expires
      const oldestRequest = Math.min(...this.requests);
      const waitTime = oldestRequest + this.windowMs - now;
      
      if (waitTime > 0) {
        console.log(`Rate limit reached, waiting ${waitTime}ms...`);
        await delay(waitTime);
        return this.waitForSlot(); // Recursive call to check again
      }
    }
    
    // Record this request
    this.requests.push(now);
  }
  
  /**
   * Make a rate-limited HTTP request
   * @param {string} url - URL to request
   * @param {Object} options - Request options
   * @returns {Promise<string>} Response data
   */
  async request(url, options = {}) {
    await this.waitForSlot();
    return httpGet(url, options);
  }
  
  /**
   * Make a rate-limited HTTP JSON request
   * @param {string} url - URL to request
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Parsed JSON response
   */
  async requestJSON(url, options = {}) {
    await this.waitForSlot();
    return httpGetJSON(url, options);
  }
}

/**
 * Create a rate limiter with predefined settings for common APIs
 * @param {string} apiName - Name of the API ('genius', 'musicbrainz', etc.)
 * @returns {RateLimiter} Configured rate limiter
 */
function createAPIRateLimiter(apiName) {
  switch (apiName.toLowerCase()) {
    case 'genius':
      // Genius allows 1000 requests per day, be conservative
      return new RateLimiter(10, 60000); // 10 per minute
    
    case 'musicbrainz':
      // MusicBrainz recommends 1 request per second
      return new RateLimiter(1, 1000); // 1 per second
    
    default:
      // Default conservative rate limiting
      return new RateLimiter(5, 60000); // 5 per minute
  }
}

/**
 * Calculate exponential backoff delay
 * @param {number} attempt - Attempt number (starting from 0)
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @returns {number} Delay in milliseconds
 */
function exponentialBackoff(attempt, baseDelay = 1000, maxDelay = 30000) {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter to avoid thundering herd
  return delay + Math.random() * 1000;
}

module.exports = {
  httpGet,
  httpGetJSON,
  delay,
  RateLimiter,
  createAPIRateLimiter,
  exponentialBackoff,
  DEFAULT_OPTIONS
};