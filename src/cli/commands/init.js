const path = require('path');
const fs = require('fs');
const { Config } = require('../../config/index.js');
const { logStatus, logError } = require('../utils/progress.js');

/**
 * Execute the init command
 * @param {Object} options - Command options
 */
async function execute(options) {
  try {
    logStatus('config', 'Initializing Backstreet Lyrics Scraper project...');
    
    const configPath = path.join(process.cwd(), 'config.json');
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    
    // Check if config already exists
    if (fs.existsSync(configPath) && !options.force) {
      logError('Configuration file already exists. Use --force to overwrite');
      process.exit(1);
    }
    
    // Create sample configuration
    Config.createSampleConfig(configPath);
    logStatus('success', 'Sample configuration created: config.json');
    
    // Create/update .gitignore
    await updateGitignore(gitignorePath);
    
    // Create output directory
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      logStatus('success', 'Output directory created: output/');
    }
    
    // Display setup instructions
    displaySetupInstructions();
    
  } catch (error) {
    logError('Failed to initialize project', error, true);
  }
}

/**
 * Update .gitignore file with recommended entries
 * @param {string} gitignorePath - Path to .gitignore file
 */
async function updateGitignore(gitignorePath) {
  const recommendedEntries = [
    '# Backstreet Lyrics Scraper',
    'output/',
    'config.json',
    '.config.json',
    '*.log',
    '.env',
    '',
    '# Node.js',
    'node_modules/',
    'npm-debug.log*',
    'yarn-debug.log*',
    'yarn-error.log*',
    '',
    '# OS generated files',
    '.DS_Store',
    '.DS_Store?',
    'Thumbs.db'
  ];
  
  try {
    let existingContent = '';
    if (fs.existsSync(gitignorePath)) {
      existingContent = fs.readFileSync(gitignorePath, 'utf8');
    }
    
    // Check which entries are missing
    const missingEntries = recommendedEntries.filter(entry => {
      if (entry === '' || entry.startsWith('#')) return false;
      return !existingContent.includes(entry);
    });
    
    if (missingEntries.length > 0) {
      const newContent = existingContent + '\n' + recommendedEntries.join('\n') + '\n';
      fs.writeFileSync(gitignorePath, newContent);
      logStatus('success', '.gitignore updated with recommended entries');
    } else {
      logStatus('info', '.gitignore already contains recommended entries');
    }
    
  } catch (error) {
    console.warn('⚠️ Could not update .gitignore:', error.message);
  }
}

/**
 * Display setup instructions
 */
function displaySetupInstructions() {
  console.log('\n🎉 Project initialized successfully!');
  
  console.log('\n📋 Next steps:');
  console.log('   1. Get a Genius API token:');
  console.log('      → Go to https://genius.com/api-clients');
  console.log('      → Create a new API client');
  console.log('      → Copy your access token');
  
  console.log('\n   2. Configure your API token (choose one):');
  console.log('      → Edit config.json and add your token');
  console.log('      → Or set environment variable: export GENIUS_ACCESS_TOKEN="your_token"');
  
  console.log('\n   3. Verify your setup:');
  console.log('      → Run: backstreet-lyrics config show');
  
  console.log('\n   4. Test with a single song:');
  console.log('      → Run: backstreet-lyrics song "Backstreet Boys" "I Want It That Way"');
  
  console.log('\n   5. Process a full album:');
  console.log('      → Run: backstreet-lyrics album "Backstreet Boys" "Millennium"');
  
  console.log('\n📁 Project structure:');
  console.log('   ├── config.json           # Your configuration settings');
  console.log('   ├── output/               # Generated lyrics and reports');
  console.log('   └── .gitignore            # Git ignore rules');
  
  console.log('\n🆘 Need help?');
  console.log('   → Run: backstreet-lyrics --help');
  console.log('   → Run: backstreet-lyrics <command> --help');
  
  console.log('\n✨ Happy scraping!');
}

module.exports = {
  execute
};