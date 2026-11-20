const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  let c = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
  return (c ^ (-1)) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generateNokiaIcon(size) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = 1 + size * 4;
  const rawData = Buffer.alloc(size * rowSize);

  // Colors
  const BG_CASE = [26, 35, 50, 255];      // #1a2332
  const BORDER_CASE = [15, 23, 34, 255];  // #0f1722
  const LCD_BEZEL = [127, 143, 101, 255]; // #7f8f65
  const LCD_GREEN = [151, 168, 120, 255]; // #97a878
  const PIXEL_BLACK = [20, 32, 18, 255];  // #142012
  const WHITE = [240, 245, 235, 255];

  // Grid for icon (e.g. 16x16 grid inside LCD area)
  const pad = Math.floor(size * 0.12);
  const lcdLeft = pad;
  const lcdTop = pad;
  const lcdRight = size - pad;
  const lcdBottom = size - pad;
  const innerW = lcdRight - lcdLeft;
  const innerH = lcdBottom - lcdTop;

  // 16x16 pixel art pattern for snake & bug
  // 1 = snake body, 2 = snake head/eyes, 3 = bug
  const art = [
    "................",
    "....11111.......",
    "...1.....1......",
    "...1..22..1.....",
    "...1..22..1.....",
    "...1......1.....",
    "....11111.1.....",
    "........1.1.....",
    "........1.1.....",
    "....11111.1.....",
    "...1......1.....",
    "...1.33...1.....",
    "...1.33...1.....",
    "...1......1.....",
    "....111111......",
    "................"
  ];

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter none

    for (let x = 0; x < size; x++) {
      const px = rowOffset + 1 + x * 4;

      // Default: phone case
      let col = BG_CASE;

      // Rounded outer corners
      const cornerR = size * 0.22;
      const dx = Math.min(x, size - 1 - x);
      const dy = Math.min(y, size - 1 - y);
      if (dx < cornerR && dy < cornerR) {
        const dist = Math.hypot(cornerR - dx, cornerR - dy);
        if (dist > cornerR) {
          col = [0, 0, 0, 0]; // Transparent outer
        } else if (dist > cornerR - 2) {
          col = BORDER_CASE;
        }
      }

      // LCD Screen area
      if (col[3] !== 0 && x >= lcdLeft && x <= lcdRight && y >= lcdTop && y <= lcdBottom) {
        if (x === lcdLeft || x === lcdRight || y === lcdTop || y === lcdBottom) {
          col = LCD_BEZEL;
        } else {
          col = LCD_GREEN;

          // Map to 16x16 art grid
          const gx = Math.floor(((x - lcdLeft) / innerW) * 16);
          const gy = Math.floor(((y - lcdTop) / innerH) * 16);

          if (gx >= 0 && gx < 16 && gy >= 0 && gy < 16) {
            const ch = art[gy][gx];
            if (ch === '1') {
              col = PIXEL_BLACK;
            } else if (ch === '2') {
              // Snake head / eye
              col = PIXEL_BLACK;
              if ((gx === 7 && gy === 3) || (gx === 7 && gy === 4)) {
                col = WHITE;
              }
            } else if (ch === '3') {
              // Food Bug
              col = PIXEL_BLACK;
            }
          }
        }
      }

      rawData[px] = col[0];
      rawData[px + 1] = col[1];
      rawData[px + 2] = col[2];
      rawData[px + 3] = col[3];
    }
  }

  const idat = zlib.deflateSync(rawData);
  return Buffer.concat([
    header,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const dir = path.join('d:', 'Projects', 'SimpleGame');
fs.writeFileSync(path.join(dir, 'icon-192.png'), generateNokiaIcon(192));
fs.writeFileSync(path.join(dir, 'icon-512.png'), generateNokiaIcon(512));
console.log('Icons generated successfully!');
