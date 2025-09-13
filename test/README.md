# Test Suite

This directory contains comprehensive unit tests for the Backstreet Boys lyrics scraper.

## Test Structure

```
test/
├── fixtures/           # Test data files
│   └── sample-lyrics.txt
├── unit/               # Unit tests
│   ├── lyrics.test.js
│   └── album-stats.test.js
├── test-runner.js      # Custom test runner
└── README.md          # This file
```

## Running Tests

```bash
# Run all tests
npm test

# Or run directly
npm run test:unit

# Or run the test runner directly
node test/test-runner.js
```

## Test Coverage

### Lyrics Processing (`lyrics.test.js`)
- **parseVocalists**: Tests vocalist parsing from section headers with various formatting (plain, bold, italic, combinations)
- **processVocalistName**: Tests name processing including HTML entity decoding and duo handling
- **determineVocalist**: Tests vocalist assignment to lyric lines based on formatting
- **generateStatsSummary**: Tests statistics calculation and percentage generation
- **parseLyricsWithVocalists**: Tests complete lyrics parsing workflow
- **parseLyricsFromFile**: Tests file reading and error handling

### Album Statistics (`album-stats.test.js`)
- **findTopVocalistInSong**: Tests finding dominant vocalist in individual songs
- **aggregateAlbumStats**: Tests album-level statistics aggregation across multiple songs
- **generateAlbumInsights**: Tests insight generation including balance analysis and participation rates
- **createAlbumReport**: Tests formatted report generation

## Test Features

- **Zero Dependencies**: Uses only Node.js built-in `assert` module
- **Custom Test Runner**: Simple test runner with colored output and progress tracking
- **Realistic Test Data**: Sample lyrics that mirror actual data structure without copyright content
- **Edge Case Coverage**: Tests empty inputs, failed songs, missing files, and error conditions
- **Performance Tracking**: Test execution timing and summary statistics

## Test Data

The test fixtures use sample lyrics that follow the same structure as real Genius.com data:
- Section headers with vocalist formatting
- HTML formatting tags for different vocalists
- Multi-line formatting tags
- Mixed vocalist sections

## Notes

- Tests validate current implementation behavior, including some quirks (e.g., bold-italic parsing order)
- File reading tests expect certain files to not exist for error handling validation
- All tests pass with 100% success rate

Total: **49 tests** across **12 test suites**