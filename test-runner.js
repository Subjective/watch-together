#!/usr/bin/env node

/**
 * Test runner script to validate the comprehensive testing setup
 * This script runs all test categories and reports the results
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: __dirname,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

async function runTestSuite() {
  log('\n🧪 Watch Together Testing Framework Validation', 'blue');
  log('='.repeat(50), 'blue');

  const testSuites = [
    {
      name: 'Unit Tests',
      command: 'pnpm',
      args: ['run', 'test:unit'],
      description: 'Running unit tests across all packages'
    },
    {
      name: 'Integration Tests', 
      command: 'pnpm',
      args: ['run', 'test:integration'],
      description: 'Running integration tests for cross-package communication'
    },
    {
      name: 'TypeScript Compilation',
      command: 'pnpm',
      args: ['run', 'typecheck'],
      description: 'Validating TypeScript compilation across all packages'
    },
    {
      name: 'Linting',
      command: 'pnpm',
      args: ['run', 'lint'],
      description: 'Running ESLint across all packages'
    }
  ];

  const results = [];

  for (const suite of testSuites) {
    log(`\n📋 ${suite.name}`, 'yellow');
    log(`${suite.description}`, 'reset');
    log('-'.repeat(30), 'yellow');

    try {
      const startTime = Date.now();
      await runCommand(suite.command, suite.args);
      const duration = Date.now() - startTime;
      
      log(`✅ ${suite.name} passed (${duration}ms)`, 'green');
      results.push({ name: suite.name, status: 'PASSED', duration });
    } catch (error) {
      log(`❌ ${suite.name} failed`, 'red');
      results.push({ name: suite.name, status: 'FAILED', error: error.message });
    }
  }

  // Summary
  log('\n📊 Test Results Summary', 'blue');
  log('='.repeat(50), 'blue');

  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;

  results.forEach(result => {
    const icon = result.status === 'PASSED' ? '✅' : '❌';
    const color = result.status === 'PASSED' ? 'green' : 'red';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    log(`${icon} ${result.name}: ${result.status}${duration}`, color);
  });

  log(`\n📈 Summary: ${passed} passed, ${failed} failed`, failed > 0 ? 'red' : 'green');

  if (failed === 0) {
    log('\n🎉 All tests passed! Testing framework is properly configured.', 'green');
    log('\n📚 Available test commands:', 'blue');
    log('  pnpm run test          - Run all tests', 'reset');
    log('  pnpm run test:unit     - Run unit tests only', 'reset');
    log('  pnpm run test:integration - Run integration tests only', 'reset');
    log('  pnpm run test:e2e      - Run E2E tests with Playwright', 'reset');
    log('  pnpm run test:watch    - Run tests in watch mode', 'reset');
    log('  pnpm run test:coverage - Run tests with coverage report', 'reset');
    log('  pnpm run test:ui       - Run tests with Vitest UI', 'reset');
  } else {
    log('\n🔧 Some tests failed. Please check the output above for details.', 'red');
    process.exit(1);
  }
}

// Run the test suite
runTestSuite().catch(error => {
  log(`\n💥 Test runner failed: ${error.message}`, 'red');
  process.exit(1);
});