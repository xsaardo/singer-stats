#!/usr/bin/env node

/**
 * Test Runner for Vocalist Parser Prototypes
 * 
 * Tests both tag-aware and LLM-based parsing approaches
 * against the existing test cases
 */

const { parseVocalistsTagAware } = require('./tag-aware-parser.js');
const { parseVocalistsLLMAsync } = require('./llm-parser.js');

// Test cases extracted from the existing test suite
const testCases = [
  {
    name: 'single plain text vocalist',
    input: 'Nick Carter',
    expected: { 'Nick Carter': 'plain' }
  },
  {
    name: 'single bold vocalist',
    input: '<b>Brian Littrell</b>',
    expected: { 'Brian Littrell': 'bold' }
  },
  {
    name: 'single italic vocalist',
    input: '<i>AJ McLean</i>',
    expected: { 'AJ McLean': 'italic' }
  },
  {
    name: 'bold-italic vocalist',
    input: '<b><i>Howie Dorough</i></b>',
    expected: { 'Howie Dorough': 'bold-italic' }
  },
  {
    name: 'italic-bold vocalist',
    input: '<i><b>Howie Dorough</b></i>',
    expected: { 'Howie Dorough': 'bold-italic' }
  },
  {
    name: 'multiple vocalists separated by comma',
    input: '<i>AJ McLean</i>, Howie Dorough',
    expected: {
      'AJ McLean': 'italic',
      'Howie Dorough': 'plain'
    }
  },
  {
    name: 'multiple vocalists separated by multiple commas',
    input: 'AJ, <i>All</i>, <b>Brian</b>',
    expected: {
      'AJ': 'plain',
      'All': 'italic',
      'Brian': 'bold'
    }
  },
  {
    name: 'multiple vocalists separated by &amp;',
    input: '<b>Nick Carter</b> &amp; Brian Littrell',
    expected: {
      'Nick Carter': 'bold',
      'Brian Littrell': 'plain'
    }
  },
  {
    name: 'multiple vocalists (single and duo) separated by comma',
    input: 'AJ, <i>AJ &amp; Brian</i>',
    expected: {
      'AJ': 'plain',
      'AJ & Brian': 'italic'
    }
  },
  {
    name: 'multiple vocalists separated by comma and &amp;',
    input: 'All, <i>Brian</i> &amp; <b>Nick</b>',
    expected: {
      'All': 'plain',
      'Brian': 'italic',
      'Nick': 'bold'
    }
  },
  {
    name: 'multiple vocalists separated by WITH',
    input: 'Nick <i>with Brian</i>',
    expected: {
      'Nick': 'plain',
      'Brian': 'italic'
    }
  },
  {
    name: 'multiple vocalists separated by WITH and commas',
    input: 'Brian <i>with Kevin</i>, <b>Nick</b>',
    expected: {
      'Brian': 'plain',
      'Kevin': 'italic',
      'Nick': 'bold'
    }
  },
  {
    name: 'vocalists surrounded by parentheses',
    input: '(Brian)',
    expected: { 'Brian': 'plain' }
  },
  {
    name: 'All as vocalist',
    input: 'All',
    expected: { 'All': 'plain' }
  }
];

/**
 * Run a single test case against a parser
 * @param {Function} parser - Parser function to test
 * @param {Object} testCase - Test case object
 * @param {boolean} isAsync - Whether the parser is async
 * @returns {Promise<Object>} Test result
 */
async function runTestCase(parser, testCase, isAsync = false) {
  try {
    const result = isAsync ? await parser(testCase.input) : parser(testCase.input);
    const passed = compareResults(result, testCase.expected);
    
    return {
      passed,
      result,
      expected: testCase.expected,
      error: null
    };
  } catch (error) {
    return {
      passed: false,
      result: null,
      expected: testCase.expected,
      error: error.message
    };
  }
}

/**
 * Compare actual results with expected results
 * @param {Object} actual - Actual parser output (dictionary)
 * @param {Object} expected - Expected output (dictionary)
 * @returns {boolean} Whether results match
 */
function compareResults(actual, expected) {
  if (typeof actual !== 'object' || typeof expected !== 'object' || actual === null || expected === null) {
    return false;
  }
  
  const actualEntries = Object.entries(actual);
  const expectedEntries = Object.entries(expected);
  
  return actualEntries.length === expectedEntries.length && 
         actualEntries.every(([key, value]) => expected[key] === value);
}

/**
 * Run all test cases against both parsers
 */
async function runAllTests(apiKey = null) {
  console.log('🧪 Testing Vocalist Parser Prototypes');
  console.log('=' .repeat(60));
  
  const parsers = [
    { name: 'Tag-Aware Parser', func: parseVocalistsTagAware, async: false }
  ];
  
  // Only add LLM parser if API key is provided
  if (apiKey) {
    parsers.push({ 
      name: 'LLM Parser (Claude API)', 
      func: (input) => parseVocalistsLLMAsync(input, apiKey), 
      async: true 
    });
  } else {
    console.log('⚠️  No Claude API key provided - testing Tag-Aware parser only');
    console.log('   Set CLAUDE_API_KEY environment variable to test LLM parser');
  }
  
  const results = {};
  
  for (const parser of parsers) {
    console.log(`\n📋 Testing ${parser.name}`);
    console.log('-'.repeat(40));
    
    const parserResults = {
      passed: 0,
      failed: 0,
      total: testCases.length,
      details: []
    };
    
    for (const testCase of testCases) {
      const result = await runTestCase(parser.func, testCase, parser.async);
      
      if (result.passed) {
        console.log(`  ✓ ${testCase.name}`);
        parserResults.passed++;
      } else {
        console.log(`  ✗ ${testCase.name}`);
        if (result.error) {
          console.log(`    Error: ${result.error}`);
        } else {
          console.log(`    Expected: ${JSON.stringify(result.expected)}`);
          console.log(`    Got:      ${JSON.stringify(result.result)}`);
        }
        parserResults.failed++;
      }
      
      parserResults.details.push({
        testCase: testCase.name,
        ...result
      });
    }
    
    results[parser.name] = parserResults;
    
    console.log(`\n  Summary: ${parserResults.passed}/${parserResults.total} tests passed`);
  }
  
  // Overall comparison
  console.log('\n📊 OVERALL COMPARISON');
  console.log('=' .repeat(60));
  
  for (const [name, result] of Object.entries(results)) {
    const percentage = ((result.passed / result.total) * 100).toFixed(1);
    console.log(`${name}: ${result.passed}/${result.total} (${percentage}%)`);
  }
  
  // Detailed comparison for failed tests
  console.log('\n🔍 DETAILED FAILURE ANALYSIS');
  console.log('=' .repeat(60));
  
  const failedTests = testCases.filter((_, index) => {
    return Object.values(results).some(result => !result.details[index].passed);
  });
  
  if (failedTests.length === 0) {
    console.log('🎉 All tests passed for all parsers!');
  } else {
    for (const testCase of failedTests) {
      const index = testCases.indexOf(testCase);
      console.log(`\n❌ ${testCase.name}`);
      console.log(`   Input: "${testCase.input}"`);
      console.log(`   Expected: ${JSON.stringify(testCase.expected)}`);
      
      for (const [name, result] of Object.entries(results)) {
        const detail = result.details[index];
        const status = detail.passed ? '✓' : '✗';
        console.log(`   ${name}: ${status} ${JSON.stringify(detail.result)}`);
      }
    }
  }
  
  return results;
}

// Run tests if called directly
if (require.main === module) {
  (async () => {
    const apiKey = process.env.CLAUDE_API_KEY;
    const results = await runAllTests(apiKey);
    
    console.log('\n✅ Testing complete!');
    
    // Exit with error code if any tests failed
    const totalFailed = Object.values(results).reduce((sum, r) => sum + r.failed, 0);
    process.exit(totalFailed > 0 ? 1 : 0);
  })();
}

module.exports = {
  runAllTests,
  runTestCase,
  compareResults,
  testCases
};