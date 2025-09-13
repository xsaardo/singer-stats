# 🎵 Backstreet Boys Lyrics Scraper

A comprehensive CLI tool for scraping and analyzing Backstreet Boys lyrics with detailed vocalist analysis and album-level statistics.

## ✨ Features

- **Single Song Processing**: Analyze individual tracks with vocalist distribution
- **Full Album Analysis**: Process entire albums with aggregated statistics
- **Vocalist Analysis**: Identify who sings which parts based on formatting
- **Album-Level Insights**: Comprehensive statistics across all tracks
- **Multiple Output Formats**: JSON data and human-readable reports
- **Rate Limiting**: Respectful API usage with automatic retry logic
- **Progress Tracking**: Real-time progress bars and detailed feedback

## 🚀 Quick Start

### Prerequisites

- Node.js 14.0.0 or higher
- Genius API token (free from [genius.com/api-clients](https://genius.com/api-clients))

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd backstreetdata
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Initialize the project**:
   ```bash
   node cli.js init
   ```

4. **Configure your API token**:
   ```bash
   # Option 1: Environment variable
   export GENIUS_ACCESS_TOKEN="your_token_here"
   
   # Option 2: Edit config.json
   # Add your token to the generated config.json file
   ```

## 📖 Usage

### Process a Single Song

```bash
# Basic usage
node cli.js song "Backstreet Boys" "I Want It That Way"

# With options
node cli.js song "Backstreet Boys" "Quit Playing Games" --format json --verbose
```

**Output includes**:
- Cleaned lyrics text
- Vocalist annotations 
- Individual vocalist statistics
- Processing metadata

### Process a Full Album

```bash
# Basic album processing
node cli.js album "Backstreet Boys" "Millennium"

# With advanced options
node cli.js album "Backstreet Boys" "DNA" --skip-failed --delay 2000 --verbose
```

**Album output includes**:
- **Song-level statistics** for each track
- **Album-wide aggregation** across all songs
- **Vocalist distribution** showing participation rates
- **Balance analysis** and insights
- **Detailed reports** in multiple formats

### Configuration Management

```bash
# Show current configuration
node cli.js config show

# Initialize sample config
node cli.js config init

# Set configuration values
node cli.js config set output.directory "my-lyrics"
node cli.js config set apis.genius.rateLimit.maxRequests 5
```

### Quick Commands

```bash
# Show help
npm run help

# Show current config
npm run config

# Quick song processing (requires arguments)
npm run song "Artist" "Song Title"

# Quick album processing (requires arguments)  
npm run album "Artist" "Album Name"

# Run test suite
npm test
```

## 📊 Sample Output

### Album Processing Example

```
💿 Processing Album: "Millennium" by Backstreet Boys
✅ Found 12 tracks in album

🔍 Processing songs...
[████████████████████████████████████████] 12/12 (100%)
  [1/12] ✅ Larger Than Life (2.1s)
  [2/12] ✅ I Want It That Way (1.8s)
  ...

📊 Album Statistics:
   Total Songs              : 12
   Processed Successfully   : 12 (100.0%)
   Total Lines             : 435
   Total Words             : 2,624

🎤 Vocalist Distribution (Album-wide):
   Brian Littrell: 89 lines (31.3%), 512 words (32.7%)
   Nick Carter: 78 lines (27.5%), 423 words (27.0%)
   AJ McLean: 65 lines (22.9%), 347 words (22.1%)
   Howie Dorough: 52 lines (18.3%), 285 words (18.2%)

🔍 Album Insights:
   Dominant Vocalist: Brian Littrell
   Vocal Balance: fairly balanced
```

## 📁 Output Structure

```
output/
├── [Artist]_[Album]_[timestamp].json          # Complete album data
├── [Artist]_[Album]_[timestamp]_summary.txt   # Human-readable report
└── individual-songs/                          # Individual song files
    ├── lyrics_cleaned_[songid].txt
    ├── lyrics_annotated_[songid].txt
    └── lyrics_data_[songid].json
```

## ⚙️ Configuration

The tool looks for configuration in these locations (in order):
1. `./config.json`
2. `./.config.json`
3. `./src/config/config.json`
4. `~/.lyrics-scraper-config.json`

### Sample Configuration

```json
{
  "apis": {
    "genius": {
      "accessToken": "your_token_here",
      "rateLimit": { "maxRequests": 10, "windowMs": 60000 }
    }
  },
  "output": {
    "directory": "output",
    "formats": { "saveJSON": true, "saveTXT": true }
  },
  "processing": {
    "delays": { "betweenSongs": 1500 },
    "album": { "skipFailedSongs": true }
  }
}
```

## 🔧 Command Reference

### Global Options

- `--verbose, -v`: Enable verbose output
- `--quiet, -q`: Minimal output
- `--config <path>`: Custom configuration file path

### Song Command

```bash
node cli.js song <artist> <title> [options]
```

**Options**:
- `--token <token>`: Genius API token
- `--output-dir <dir>`: Output directory (default: "output")
- `--format <format>`: Output format: json, txt, both (default: "both")
- `--no-parse`: Skip vocalist parsing

### Album Command

```bash
node cli.js album <artist> <album> [options]
```

**Options**:
- `--token <token>`: Genius API token
- `--output-dir <dir>`: Output directory (default: "output") 
- `--format <format>`: Output format: json, txt, both (default: "both")
- `--release-index <index>`: Which release to use if multiple found (default: 0)
- `--delay <ms>`: Delay between requests in milliseconds (default: 1500)
- `--skip-failed`: Continue if individual songs fail

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Troubleshooting

### Common Issues

**"API token is required"**
- Set `GENIUS_ACCESS_TOKEN` environment variable
- Or add token to `config.json`
- Get token from https://genius.com/api-clients

**"Song not found"**
- Check spelling of artist and song title
- Try alternative song titles
- Use `--verbose` for detailed search info

**"Rate limit reached"**
- Increase `--delay` option
- Default rate limits are conservative
- Wait a few minutes and try again

**"Album not found"**
- Check spelling of artist and album name
- Try different `--release-index` values
- Some albums may have multiple releases

### Getting Help

```bash
# General help
node cli.js --help

# Command-specific help
node cli.js song --help
node cli.js album --help
node cli.js config --help
```

## 🏗️ Architecture

```
src/
├── cli/commands/          # CLI command implementations
├── processors/           # Data processing and analysis
├── scrapers/            # API interaction modules  
├── utils/               # Utility functions
└── config/              # Configuration management
```

Built with modern Node.js, modular architecture, and comprehensive error handling for production use.