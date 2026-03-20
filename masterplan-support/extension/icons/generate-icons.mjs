/**
 * Generates simple placeholder PNG icon files for the extension.
 * Requires no external dependencies — uses raw PNG binary encoding.
 *
 * Run: node generate-icons.mjs
 */
import { writeFileSync } from 'fs';
import { createHash } from 'crypto';
import zlib from 'zlib';

/**
 * Creates a minimal valid PNG for a solid-color square.
 * @param {number} size  - Width and height in pixels
 * @param {number[]} rgb - [R, G, B] 0-255
 */
function makePNG(size, [r, g, b]) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk: width, height, bit depth=8, colorType=2 (RGB), ...
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8]  = 8;  // bit depth
  ihdrData[9]  = 2;  // RGB
  ihdrData[10] = 0;  // compression
  ihdrData[11] = 0;  // filter
  ihdrData[12] = 0;  // interlace
  const ihdr = chunk('IHDR', ihdrData);

  // Image data: each row = filter byte (0) + R G B per pixel
  const rowSize   = 1 + size * 3;
  const rawPixels = Buffer.alloc(size * rowSize);
  for (let row = 0; row < size; row++) {
    const offset = row * rowSize;
    rawPixels[offset] = 0; // filter type: None
    for (let col = 0; col < size; col++) {
      rawPixels[offset + 1 + col * 3 + 0] = r;
      rawPixels[offset + 1 + col * 3 + 1] = g;
      rawPixels[offset + 1 + col * 3 + 2] = b;
    }
  }
  const compressed = zlib.deflateSync(rawPixels, { level: 9 });
  const idat = chunk('IDAT', compressed);

  // IEND chunk
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

function chunk(type, data) {
  const len    = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB  = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([typeB, data]);
  const crcVal = crc32(crcBuf);
  const crcB   = Buffer.alloc(4);
  crcB.writeInt32BE(crcVal);
  return Buffer.concat([len, typeB, data, crcB]);
}

// CRC-32 implementation (PNG uses CRC-32)
function crc32(buf) {
  const table = makeCRCTable();
  let crc = 0xFFFFFFFF;
  for (const byte of buf) {
    crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) | 0;
}

let _crcTable = null;
function makeCRCTable() {
  if (_crcTable) return _crcTable;
  _crcTable = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    _crcTable[i] = c;
  }
  return _crcTable;
}

// CT Bakery red: #c0392b → [192, 57, 43]
const COLOR = [192, 57, 43];

const sizes = [16, 48, 128];
for (const size of sizes) {
  const png  = makePNG(size, COLOR);
  const file = `icon${size}.png`;
  writeFileSync(file, png);
  console.log(`  ✅ ${file} (${png.length} bytes)`);
}

console.log('\nIcons generated. Load the extension as unpacked in Chrome.');
