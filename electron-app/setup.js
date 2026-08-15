const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== Convention Manager Setup ===\n');

const rootDir = path.join(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const adminPanelDir = path.join(rootDir, 'admin-panel');
const electronDir = __dirname;

try {
  // Step 1: Build admin panel
  console.log('1. Building admin panel...');
  process.chdir(adminPanelDir);
  if (!fs.existsSync(path.join(adminPanelDir, 'node_modules'))) {
    console.log('   Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });
  }
  execSync('npm run build', { stdio: 'inherit' });
  console.log('   ✓ Admin panel built\n');

  // Step 2: Build backend
  console.log('2. Building backend...');
  process.chdir(backendDir);
  if (!fs.existsSync(path.join(backendDir, 'node_modules'))) {
    console.log('   Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });
  }
  execSync('npm run build', { stdio: 'inherit' });
  console.log('   ✓ Backend built\n');

  // Step 3: Install electron dependencies
  console.log('3. Installing Electron app dependencies...');
  process.chdir(electronDir);
  execSync('npm install', { stdio: 'inherit' });
  console.log('   ✓ Dependencies installed\n');

  console.log('=== Setup Complete ===');
  console.log('\nNext steps:');
  console.log('  npm run start    - Run in development mode');
  console.log('  npm run build:win - Build Windows installer');
  
} catch (error) {
  console.error('\n✗ Setup failed:', error.message);
  process.exit(1);
}
