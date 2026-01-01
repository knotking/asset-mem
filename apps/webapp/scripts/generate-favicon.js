/**
 * Script to generate favicon files from SVG
 * 
 * This script requires sharp to be installed:
 * npm install --save-dev sharp
 * 
 * Run with: node scripts/generate-favicon.js
 */

const fs = require('fs');
const path = require('path');

async function generateFavicons() {
  try {
    // Try to require sharp
    const sharp = require('sharp');
    
    const svgPath = path.join(__dirname, '../src/app/icon.svg');
    const appDir = path.join(__dirname, '../src/app');
    
    // Read SVG
    const svgBuffer = fs.readFileSync(svgPath);
    
    // Generate icon.png (512x512 for Next.js)
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile(path.join(appDir, 'icon.png'));
    console.log('✓ Generated icon.png');
    
    // Generate apple-icon.png (180x180 for Apple devices)
    await sharp(svgBuffer)
      .resize(180, 180)
      .png()
      .toFile(path.join(appDir, 'apple-icon.png'));
    console.log('✓ Generated apple-icon.png');
    
    // Generate favicon.ico (32x32)
    await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toFile(path.join(appDir, 'favicon.ico'));
    console.log('✓ Generated favicon.ico');
    
    console.log('\n✅ All favicon files generated successfully!');
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error('❌ Error: sharp is not installed.');
      console.error('Please run: npm install --save-dev sharp');
      console.error('Then run this script again.');
    } else {
      console.error('❌ Error generating favicons:', error.message);
    }
    process.exit(1);
  }
}

generateFavicons();

