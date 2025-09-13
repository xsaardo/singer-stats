/**
 * Progress indicator utilities for CLI
 */

/**
 * Create a simple progress bar
 * @param {number} current - Current progress
 * @param {number} total - Total items
 * @param {number} width - Width of progress bar
 * @returns {string} Progress bar string
 */
function createProgressBar(current, total, width = 40) {
  const percentage = total > 0 ? current / total : 0;
  const filled = Math.floor(percentage * width);
  const empty = width - filled;
  
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percent = Math.floor(percentage * 100);
  
  return `[${bar}] ${current}/${total} (${percent}%)`;
}

/**
 * Log with emoji status indicators
 * @param {string} status - Status type: info, success, error, warning, progress
 * @param {string} message - Message to display
 */
function logStatus(status, message) {
  if (global.CLI_QUIET) return;
  
  const emojis = {
    info: '🔍',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    progress: '⏳',
    music: '🎵',
    album: '💿',
    stats: '📊',
    files: '📁',
    config: '⚙️'
  };
  
  const emoji = emojis[status] || 'ℹ️';
  console.log(`${emoji} ${message}`);
}

/**
 * Log verbose message (only shown with --verbose flag)
 * @param {string} message - Message to display
 */
function logVerbose(message) {
  if (global.CLI_VERBOSE && !global.CLI_QUIET) {
    console.log(`   ${message}`);
  }
}

/**
 * Log error message and optionally exit
 * @param {string} message - Error message
 * @param {Error} error - Optional error object
 * @param {boolean} exit - Whether to exit process
 */
function logError(message, error = null, exit = false) {
  console.error(`❌ ${message}`);
  
  if (error && global.CLI_VERBOSE) {
    console.error(`   Details: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
  }
  
  if (exit) {
    process.exit(1);
  }
}

/**
 * Display a spinner while a promise is running
 * @param {Promise} promise - Promise to wait for
 * @param {string} message - Message to display with spinner
 * @returns {Promise} The original promise result
 */
async function withSpinner(promise, message) {
  if (global.CLI_QUIET) {
    return promise;
  }
  
  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frameIndex = 0;
  
  // Start spinner
  const spinnerInterval = setInterval(() => {
    process.stdout.write(`\r${spinnerFrames[frameIndex]} ${message}`);
    frameIndex = (frameIndex + 1) % spinnerFrames.length;
  }, 100);
  
  try {
    const result = await promise;
    clearInterval(spinnerInterval);
    process.stdout.write(`\r✅ ${message}\n`);
    return result;
  } catch (error) {
    clearInterval(spinnerInterval);
    process.stdout.write(`\r❌ ${message}\n`);
    throw error;
  }
}

/**
 * Format time duration
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Display processing step with sub-steps
 * @param {string} mainMessage - Main step message
 * @param {Array<{message: string, promise: Promise}>} steps - Array of sub-steps
 */
async function processSteps(mainMessage, steps) {
  if (!global.CLI_QUIET) {
    console.log(`\n${mainMessage}`);
  }
  
  for (const step of steps) {
    await withSpinner(step.promise, step.message);
  }
}

/**
 * Create a table-like output for statistics
 * @param {Object} data - Data object to display
 * @param {string} title - Table title
 */
function displayTable(data, title) {
  if (global.CLI_QUIET) return;
  
  console.log(`\n📊 ${title}:`);
  
  const maxKeyLength = Math.max(...Object.keys(data).map(k => k.length));
  
  Object.entries(data).forEach(([key, value]) => {
    const paddedKey = key.padEnd(maxKeyLength);
    console.log(`   ${paddedKey}: ${value}`);
  });
}

module.exports = {
  createProgressBar,
  logStatus,
  logVerbose,
  logError,
  withSpinner,
  formatDuration,
  processSteps,
  displayTable
};