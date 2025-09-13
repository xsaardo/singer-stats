#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const { initConfig } = require('./src/config/index.js');

// Import command modules
const songCommand = require('./src/cli/commands/song.js');
const albumCommand = require('./src/cli/commands/album.js');
const configCommand = require('./src/cli/commands/config.js');
const initCommand = require('./src/cli/commands/init.js');

const program = new Command();

// Set up the main program
program
  .name('backstreet-lyrics')
  .description('Backstreet Boys lyrics scraper with vocalist analysis')
  .version('1.0.0')
  .option('-v, --verbose', 'enable verbose output')
  .option('-q, --quiet', 'minimal output')
  .option('--config <path>', 'path to configuration file');

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled promise rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Initialize configuration before running commands
async function initializeApp() {
  try {
    const options = program.opts();
    const config = initConfig(options.config);
    
    // Set global verbosity
    global.CLI_VERBOSE = options.verbose;
    global.CLI_QUIET = options.quiet;
    global.APP_CONFIG = config;
    
    return config;
  } catch (error) {
    console.error('❌ Configuration error:', error.message);
    console.log('💡 Run "backstreet-lyrics init" to create a sample configuration file');
    process.exit(1);
  }
}

// Add commands
program
  .command('song')
  .description('Process a single song and get lyrics with vocalist analysis')
  .argument('<artist>', 'Artist name')
  .argument('<title>', 'Song title')
  .option('--token <token>', 'Genius API token (or use GENIUS_ACCESS_TOKEN env var)')
  .option('--output-dir <dir>', 'Output directory', 'output')
  .option('--format <format>', 'Output format: json, txt, both', 'both')
  .option('--no-parse', 'Skip vocalist parsing, just get raw lyrics')
  .action(async (artist, title, options) => {
    await initializeApp();
    await songCommand.execute(artist, title, options);
  });

program
  .command('album')
  .description('Process an entire album with song-level and album-level statistics')
  .argument('<artist>', 'Artist name')
  .argument('<album>', 'Album name')
  .option('--token <token>', 'Genius API token (or use GENIUS_ACCESS_TOKEN env var)')
  .option('--output-dir <dir>', 'Output directory', 'output')
  .option('--format <format>', 'Output format: json, txt, both', 'both')
  .option('--release-index <index>', 'Which release to use if multiple found', '0')
  .option('--delay <ms>', 'Delay between song requests in milliseconds', '1500')
  .option('--skip-failed', 'Continue processing if individual songs fail')
  .action(async (artist, album, options) => {
    await initializeApp();
    await albumCommand.execute(artist, album, options);
  });

program
  .command('config')
  .description('Manage configuration settings')
  .argument('[action]', 'Action: init, show, set, get')
  .argument('[key]', 'Configuration key for set/get actions')
  .argument('[value]', 'Configuration value for set action')
  .option('--force', 'Force overwrite existing files')
  .action(async (action, key, value, options) => {
    if (action !== 'init') {
      await initializeApp();
    }
    await configCommand.execute(action, key, value, options);
  });

program
  .command('init')
  .description('Initialize project with sample configuration')
  .option('--force', 'Overwrite existing config file')
  .action(async (options) => {
    await initCommand.execute(options);
  });

// Add help examples
program.addHelpText('after', `
Examples:
  $ backstreet-lyrics song "Backstreet Boys" "I Want It That Way"
  $ backstreet-lyrics album "Backstreet Boys" "Millennium" --verbose
  $ backstreet-lyrics config init
  $ backstreet-lyrics config show
  $ backstreet-lyrics init --force

Environment Variables:
  GENIUS_ACCESS_TOKEN    Your Genius API access token
  OUTPUT_DIR            Default output directory
  LOG_LEVEL             Logging level (debug, info, warn, error)

Configuration:
  The tool looks for configuration files in these locations:
  • ./config.json
  • ./.config.json  
  • ./src/config/config.json
  • ~/.lyrics-scraper-config.json
`);

// Parse command line arguments
program.parse();

// If no command was provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}