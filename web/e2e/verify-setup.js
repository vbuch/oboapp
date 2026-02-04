#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Helper script to verify E2E test environment setup
 * Checks that all required dependencies and configurations are in place
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying E2E Test Environment Setup\n');

let allChecksPass = true;

// Check 1: Playwright installation
console.log('1. Checking Playwright installation...');
try {
  const playwrightVersion = execSync('npx playwright --version', { encoding: 'utf-8' }).trim();
  console.log(`   ✅ Playwright installed: ${playwrightVersion}`);
} catch {
  console.log('   ❌ Playwright not found. Run: npm install');
  allChecksPass = false;
}

// Check 2: Playwright browsers
console.log('\n2. Checking Playwright browsers...');
try {
  const browsersPath = path.join(require('os').homedir(), '.cache', 'ms-playwright');
  if (fs.existsSync(browsersPath)) {
    console.log('   ✅ Playwright browsers installed');
  } else {
    console.log('   ⚠️  Browsers not found. Run: npx playwright install chromium');
  }
} catch {
  console.log('   ⚠️  Could not verify browsers');
}

// Check 3: Environment file
console.log('\n3. Checking environment configuration...');
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  console.log('   ✅ .env.local found');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  if (envContent.includes('NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true')) {
    console.log('   ✅ Emulator mode enabled');
  } else {
    console.log('   ⚠️  Emulator mode not configured');
  }
} else {
  console.log('   ⚠️  .env.local not found. Copy from .env.example.emulator');
}

// Check 4: Test files
console.log('\n4. Checking test files...');
const testDir = path.join(__dirname);
const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.spec.ts'));
if (testFiles.length > 0) {
  console.log(`   ✅ Found ${testFiles.length} test file(s):`);
  testFiles.forEach(f => console.log(`      - ${f}`));
} else {
  console.log('   ❌ No test files found');
  allChecksPass = false;
}

// Check 5: Config file
console.log('\n5. Checking Playwright configuration...');
const configPath = path.join(__dirname, '..', 'playwright.config.ts');
if (fs.existsSync(configPath)) {
  console.log('   ✅ playwright.config.ts found');
} else {
  console.log('   ❌ playwright.config.ts not found');
  allChecksPass = false;
}

// Summary
console.log('\n' + '='.repeat(50));
if (allChecksPass) {
  console.log('✅ All required components are in place!');
  console.log('\nTo run tests:');
  console.log('  1. Start Firebase emulators: cd ../ingest && npm run emulators');
  console.log('  2. Run tests: npm run test:e2e');
} else {
  console.log('❌ Some components are missing. Please fix the issues above.');
  process.exit(1);
}
console.log('='.repeat(50) + '\n');
