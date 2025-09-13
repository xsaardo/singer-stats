#!/usr/bin/env node

/**
 * Simple test runner for Node.js without external dependencies
 * Runs tests using the built-in assert module
 */

const fs = require('fs');
const path = require('path');

class TestRunner {
  constructor() {
    this.stats = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      totalSuites: 0,
      passedSuites: 0,
      failedSuites: 0
    };
    this.currentSuite = null;
    this.currentTest = null;
    this.suiteResults = [];
  }

  describe(name, fn) {
    this.currentSuite = {
      name,
      tests: [],
      passed: 0,
      failed: 0
    };
    
    console.log(`\n📋 ${name}`);
    
    try {
      fn();
      this.stats.totalSuites++;
      
      if (this.currentSuite.failed === 0) {
        this.stats.passedSuites++;
        console.log(`   ✅ All ${this.currentSuite.passed} tests passed`);
      } else {
        this.stats.failedSuites++;
        console.log(`   ❌ ${this.currentSuite.failed} test(s) failed, ${this.currentSuite.passed} passed`);
      }
      
      this.suiteResults.push(this.currentSuite);
    } catch (error) {
      console.log(`   💥 Suite failed: ${error.message}`);
      this.stats.failedSuites++;
      this.stats.totalSuites++;
    }
  }

  it(name, fn) {
    this.currentTest = name;
    this.stats.totalTests++;
    
    try {
      fn();
      console.log(`     ✓ ${name}`);
      this.currentSuite.passed++;
      this.stats.passedTests++;
    } catch (error) {
      console.log(`     ✗ ${name}`);
      console.log(`       ${error.message}`);
      this.currentSuite.failed++;
      this.stats.failedTests++;
    }
  }

  async runTestFile(filePath) {
    console.log(`\n🧪 Running ${path.basename(filePath)}`);
    console.log('='.repeat(50));
    
    // Set up global functions for the test file
    global.describe = this.describe.bind(this);
    global.it = this.it.bind(this);
    
    try {
      // Clear require cache to ensure fresh load
      delete require.cache[require.resolve(filePath)];
      require(filePath);
    } catch (error) {
      console.log(`💥 Failed to load test file: ${error.message}`);
      console.log(error.stack);
    }
    
    // Clean up globals
    delete global.describe;
    delete global.it;
  }

  async runAllTests() {
    const testDir = path.join(__dirname, 'unit');
    
    console.log('🚀 Starting Test Suite');
    console.log('='.repeat(50));
    
    try {
      const testFiles = fs.readdirSync(testDir)
        .filter(file => file.endsWith('.test.js'))
        .map(file => path.join(testDir, file));
      
      if (testFiles.length === 0) {
        console.log('No test files found');
        return;
      }
      
      for (const testFile of testFiles) {
        await this.runTestFile(testFile);
      }
      
      this.printSummary();
      
    } catch (error) {
      console.error(`Error running tests: ${error.message}`);
      process.exit(1);
    }
  }

  printSummary() {
    console.log('\n📊 Test Summary');
    console.log('='.repeat(50));
    console.log(`Test Suites: ${this.stats.passedSuites} passed, ${this.stats.failedSuites} failed, ${this.stats.totalSuites} total`);
    console.log(`Tests:       ${this.stats.passedTests} passed, ${this.stats.failedTests} failed, ${this.stats.totalTests} total`);
    
    if (this.stats.failedTests > 0) {
      console.log('\n❌ Some tests failed');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

module.exports = { TestRunner };