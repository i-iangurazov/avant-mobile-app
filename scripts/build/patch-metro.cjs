// Expo SDK 54 pins Metro 0.83, whose path-based call predates image-size 2.
// Use the patched image-size parser with a Buffer. Fail closed on upstream changes.
const fs = require('node:fs');
const path = require('node:path');
const assetFile = path.join(path.dirname(require.resolve('metro/package.json')), 'src/Assets.js');
const original = 'const dimensions = isImage ? (0, _imageSize.default)(isImageInput) : null;';
const patched = 'const dimensions = isImage ? (0, _imageSize.default)(typeof isImageInput === "string" ? _fs.default.readFileSync(isImageInput) : isImageInput) : null;';
const source = fs.readFileSync(assetFile, 'utf8');
if (source.includes(patched)) process.exit(0);
if (!source.includes(original)) throw new Error('Metro image-size compatibility patch requires review after dependency update.');
fs.writeFileSync(assetFile, source.replace(original, patched));
console.log('Applied reviewed Metro/image-size Buffer compatibility patch.');
