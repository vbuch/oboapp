const fs = require('fs');
const path = require('path');

const srcFile = 'C:\\code\\oboapp\\ingest\\bg.sofia.geojson';
const destDir = 'C:\\code\\oboapp\\ingest\\localities';
const destFile = path.join(destDir, 'bg.sofia.geojson');

try {
  // Create the directory
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
    console.log('✓ Directory created:', destDir);
  } else {
    console.log('✓ Directory already exists:', destDir);
  }

  // Read the source file
  const fileContent = fs.readFileSync(srcFile, 'utf8');
  console.log('✓ File read from:', srcFile);

  // Write to destination
  fs.writeFileSync(destFile, fileContent, 'utf8');
  console.log('✓ File written to:', destFile);

  // Delete the source file
  fs.unlinkSync(srcFile);
  console.log('✓ Source file deleted:', srcFile);

  // Verify the file exists at the new location
  if (fs.existsSync(destFile)) {
    console.log('✓ Verification: File successfully moved to:', destFile);
    process.exit(0);
  } else {
    console.log('✗ Verification failed: File not found at destination');
    process.exit(1);
  }
} catch (error) {
  console.error('✗ Error:', error.message);
  process.exit(1);
}
