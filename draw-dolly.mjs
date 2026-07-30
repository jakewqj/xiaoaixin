import fs from 'node:fs';
import zlib from 'node:zlib';

const FW = 64, FH = 40;

// Dolly颜色 (深描边，三层灰度体色，白色腹部，眼睛)
const C = {
  clear: [0, 0, 0, 0],
  ink: [36, 54, 66, 255],     // 描边 #243642
  back: [80, 100, 110, 255],  // 底/背部深灰
  side: [140, 160, 170, 255], // 体侧中灰
  belly: [220, 230, 235, 255], // 腹部近白
  eye: [0, 0, 0, 255],
  white: [255, 255, 255, 255]
};

// 基础帧数据：建立一个基础精灵 (坐标偏移中心约在 32, 20)
// 海豚朝右
function createDolphinMask() {
  const mask = new Map(); // "x,y" => color
  
  // 身体各处的范围线 (y: [x0, x1, 控制色]), 以中灰(side)主导
  const bodySpans = {
    15: [[32, 33, C.back]],
    16: [[29, 36, C.back]],
    17: [[27, 39, C.back]],
    18: [[23, 44, C.back]],
    19: [[21, 46, C.back], [52, 59, C.side]], // 吻部起始
    20: [[19, 47, C.back], [48, 62, C.side]], // 吻部尖端
    21: [[17, 47, C.side], [48, 62, C.side]],
    22: [[15, 30, C.side], [31, 46, C.belly]], // 侧面及腹部开始
    23: [[13, 27, C.side], [28, 44, C.belly]],
    24: [[12, 23, C.side], [24, 40, C.belly]],
    25: [[12, 19, C.side], [20, 35, C.belly]],
    26: [[13, 17, C.side], [23, 27, C.belly]]
  };
  
  for(let y in bodySpans) {
    for(let span of bodySpans[y]) {
      let [x0, x1, col] = span;
      for(let x=x0; x<=x1; x++) mask.set(`${x},${y}`, col);
    }
  }

  // 尾柄及燕尾形尾鳍
  const tail = {
    18: [[6, 8, C.back]],
    19: [[7, 10, C.back]],
    20: [[8, 12, C.side]],
    21: [[9, 14, C.side]],
    22: [[10, 14, C.side]],
    
    // 尾鳍
    15: [[2, 4, C.back]],
    16: [[3, 6, C.back]],
    17: [[4, 8, C.back]],
    23: [[6, 11, C.side]],
    24: [[5, 9, C.side]],
    25: [[3, 6, C.side]]
  };
  for(let y in tail) {
    for(let span of tail[y]) {
      let [x0, x1, col] = span;
      for(let x=x0; x<=x1; x++) mask.set(`${x},${y}`, col);
    }
  }

  // 高直背鳍
  const dorsal = {
    9:  [[29, 31, C.back]],
    10: [[29, 32, C.back]],
    11: [[28, 33, C.back]],
    12: [[28, 34, C.back]],
    13: [[27, 34, C.back]],
    14: [[26, 35, C.back]]
  };
  for(let y in dorsal) {
    for(let span of dorsal[y]) {
        let [x0, x1, col] = span;
        for(let x=x0; x<=x1; x++) mask.set(`${x},${y}`, col);
    }
  }

  // 胸鳍
  const pectoral = {
    24: [[30, 34, C.side]],
    25: [[28, 33, C.side]],
    26: [[26, 31, C.side]],
    27: [[25, 29, C.side]]
  };
  for(let y in pectoral) {
    for(let span of pectoral[y]) {
        let [x0, x1, col] = span;
        for(let x=x0; x<=x1; x++) mask.set(`${x},${y}`, col); // 会覆盖belly
    }
  }

  // 眼睛: 相对中等靠前
  mask.set(`45,19`, C.eye);
  mask.set(`46,19`, C.eye);
  mask.set(`45,20`, C.eye);
  mask.set(`46,20`, C.eye);
  mask.set(`45,19`, C.white); // 高光

  return mask;
}

const baseDolphin = createDolphinMask();

// 将mask图渲染到缓冲
function renderToGrid(grid, mask, offsetX, offsetY, rotation = 0) {
  // 由于要求描边，先收集需要渲染的确切体素
  const pxs = new Map();
  
  if (rotation === 0) {
    for(let [k, col] of mask.entries()) {
      let [x,y] = k.split(',').map(Number);
      pxs.set(`${x+offsetX},${y+offsetY}`, col);
    }
  } else {
    // 旋转海豚（绕身体中心点 30, 20） - 用近邻避免抗锯齿
    const cx = 30, cy = 20;
    const rad = rotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    // 反向映射避免漏点
    for(let dy=-30; dy<=30; dy++) {
      for(let dx=-30; dx<=30; dx++) {
        const tx = Math.round(dx * cos + dy * sin) + cx;
        const ty = Math.round(-dx * sin + dy * cos) + cy;
        if (mask.has(`${tx},${ty}`)) {
            pxs.set(`${cx + dx + offsetX},${cy + dy + offsetY}`, mask.get(`${tx},${ty}`));
        }
      }
    }
  }

  // 画本体
  for(let [k, col] of pxs.entries()) {
    let [x,y] = k.split(',').map(Number);
    if(y>=0 && y<grid.length && x>=0 && x<grid[0].length) {
       grid[y][x] = col;
    }
  }

  // 画描边
  for(let [k, col] of pxs.entries()) {
    let [x,y] = k.split(',').map(Number);
    for(let dy=-1; dy<=1; dy++) {
       for(let dx=-1; dx<=1; dx++) {
          let nx = x+dx, ny = y+dy;
          if (!pxs.has(`${nx},${ny}`)) {
             if(ny>=0 && ny<grid.length && nx>=0 && nx<grid[0].length) {
                 if (grid[ny][nx] === C.clear) { // 不要覆盖已有
                     grid[ny][nx] = C.ink;
                 }
             }
          }
       }
    }
  }
}

function writePng(path, framesFn, numFrames) {
  const W = FW * numFrames;
  const H = FH;
  const grid = Array.from({ length: H }, () => new Array(W).fill(C.clear));
  
  for(let i=0; i<numFrames; i++) {
     framesFn(grid, i, i * FW);
  }

  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    for(let x=0; x<W; x++) {
       let [r,g,b,a] = grid[y][x];
       let idx = y*(W*4+1) + 1 + x*4;
       raw[idx] = r; raw[idx+1] = g; raw[idx+2] = b; raw[idx+3] = a;
    }
  }
  
  const crcTable = Array.from({length:256}, (_,n) => {
    let c = n;
    for(let k=0;k<8;k++) c = c&1 ? 0xedb88320^(c>>>1) : c>>>1;
    return c>>>0;
  });
  const crc32 = b => ~b.reduce((c,x) => crcTable[(c^x)&0xff]^(c>>>8), -1)>>>0;
  function chunk(ty, d) {
    const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
    const body = Buffer.concat([Buffer.from(ty), d]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([l, body, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
  fs.writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]));
}

if (!fs.existsSync('public/assets/npc/dolly')) {
  fs.mkdirSync('public/assets/npc/dolly', { recursive: true });
}

// 1. idle: 4 frames
writePng('public/assets/npc/dolly/idle.png', (g, i, ox) => {
  const yOff = [0, -1, 0, 1][i];
  renderToGrid(g, baseDolphin, ox, yOff, 0);
}, 4);

// 2. happy: 6 frames of spinning jump
writePng('public/assets/npc/dolly/happy.png', (g, i, ox) => {
  // rotation speeds: 0, 60, 120, 180, 240, 300
  // y jump arc: 0, -8, -12, -12, -8, 0
  const yOff = [0, -6, -10, -10, -6, 0][i]; 
  const rot = [0, -60, -120, -180, -240, -300][i];
  renderToGrid(g, baseDolphin, ox, yOff, rot);
}, 6);

// 3. talk: 4 frames
// Just head / body slight nods (rotate a bit: 0, -5, -10, -5)
writePng('public/assets/npc/dolly/talk.png', (g, i, ox) => {
  const rot = [0, -5, -10, -5][i];
  renderToGrid(g, baseDolphin, ox, 0, rot);
}, 4);

console.log("Dolly sprites generated in public/assets/npc/dolly/");
