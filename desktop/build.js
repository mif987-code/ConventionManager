const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== Convention Manager Desktop Build ===\n');

const rootDir = path.join(__dirname, '..');
const desktopDir = __dirname;
const backendDir = path.join(rootDir, 'backend');
const adminPanelDir = path.join(rootDir, 'admin-panel');

try {
  // Step 1: Build admin panel
  console.log('1. Building admin panel...');
  process.chdir(adminPanelDir);
  execSync('npm run build', { stdio: 'inherit' });
  console.log('   ✓ Admin panel built\n');

  // Step 2: Build backend
  console.log('2. Building backend...');
  process.chdir(backendDir);
  execSync('npm run build', { stdio: 'inherit' });
  console.log('   ✓ Backend built\n');

  // Step 3: Copy backend dist to desktop
  console.log('3. Setting up desktop package...');
  process.chdir(desktopDir);
  
  // Install desktop dependencies
  execSync('npm install', { stdio: 'inherit' });
  
  // Compile desktop server
  execSync('npx tsc', { stdio: 'inherit' });
  console.log('   ✓ Desktop server compiled\n');

  // Step 4: Package with pkg
  console.log('4. Packaging with pkg...');
  execSync('npx pkg . --compress GZip', { stdio: 'inherit' });
  console.log('   ✓ Executable created\n');

  console.log('=== Build Complete ===');
  console.log('Executable: dist-exe/convention-manager.exe');
  
} catch (error) {
  console.error('\n✗ Build failed:', error.message);
  process.exit(1);
}
