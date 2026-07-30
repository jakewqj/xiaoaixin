// make-test-page.mjs - generate a browser test page for sprite sheets.
// CSS steps() animation + optional red anchor dots toggle.
// 用法:
//   node make-test-page.mjs --out public/test_x.html --title "标题" --dir assets/pet/pixel \
//     --frame 192x64 --scale 2 --sheets idle:4:8,swim:6:8,sleeping:2:4 \
//     [--anchors eye:144:24,tailTip:19:32] [--bg "#2ab7ca"]
import fs from 'node:fs'

const args = process.argv.slice(2)
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : def
}
const out = opt('out')
const dir = opt('dir')
const frame = opt('frame')
const sheetsArg = opt('sheets')
if (!out || !dir || !frame || !sheetsArg) {
  console.error('usage: node make-test-page.mjs --out <html> --dir <imgDir> --frame WxH --sheets name:frames:fps,... [--title t] [--scale 2] [--anchors n:x:y,...] [--bg color]')
  process.exit(2)
}
const [FW, FH] = frame.split('x').map(Number)
const S = Number(opt('scale', 2))
const TITLE = opt('title', 'Sprite Test')
const BG = opt('bg', '#2ab7ca')
const sheets = sheetsArg.split(',').map((s) => {
  const [name, frames, fps] = s.split(':')
  return { name, frames: Number(frames), fps: Number(fps) }
})
const anchors = opt('anchors')
  ? Object.fromEntries(
      opt('anchors').split(',').map((a) => {
        const [name, x, y] = a.split(':')
        return [name, [Number(x), Number(y)]]
      }),
    )
  : null

const bw = FW * S
const bh = FH * S
const cls = (n) => `anim-${n.replace(/[^a-z0-9]/gi, '-')}`
const cssRules = sheets
  .map(({ name, frames, fps }) => {
    const bgW = FW * frames * S
    const dur = (frames / fps).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
    return (
      `  .${cls(name)} { background-image: url('${dir}/${name}.png'); background-size: ${bgW}px ${bh}px; animation: a-${name.replace(/[^a-z0-9]/gi, '-')} ${dur}s steps(${frames}) infinite; }\n` +
      `  @keyframes a-${name.replace(/[^a-z0-9]/gi, '-')} { 100% { background-position: -${bgW}px 0; } }`
    )
  })
  .join('\n')
const cells = sheets
  .map(
    ({ name, frames, fps }) =>
      `  <div class="cell"><h2>${name} (${frames}f, ${fps}fps)</h2><div class="sprite-box ${cls(name)}"${anchors ? ' data-anchors' : ''}></div></div>`,
  )
  .join('\n')

const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<title>${TITLE}</title>
<style>
  body { background-color: ${BG}; padding: 40px; font-family: sans-serif; color: white; }
  h1 { font-size: 20px; }
  h2 { font-size: 14px; font-weight: normal; opacity: 0.9; }
  .row { display: flex; flex-wrap: wrap; gap: 24px; }
  .sprite-box {
    position: relative;
    width: ${bw}px; height: ${bh}px; /* ${FW}x${FH} @${S}x */
    background-color: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.6);
    image-rendering: pixelated;
    background-repeat: no-repeat;
  }
${cssRules}
  .dot { position: absolute; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: red; display: none; }
  .show-anchors .dot { display: block; }
  button { font-size: 14px; padding: 4px 12px; margin-bottom: 16px; cursor: pointer; }
</style>
</head>
<body>
<h1>${TITLE} (frame ${FW}x${FH}, shown at ${S}x)</h1>
${anchors ? '<button onclick="document.body.classList.toggle(\'show-anchors\')">toggle anchors</button>' : ''}
<div class="row">
${cells}
</div>
${
  anchors
    ? `<script>
  const anchors = ${JSON.stringify(anchors)}
  document.querySelectorAll('[data-anchors]').forEach((box) => {
    for (const [name, [x, y]] of Object.entries(anchors)) {
      const d = document.createElement('div')
      d.className = 'dot'
      d.title = name
      d.style.left = x * ${S} + 'px'
      d.style.top = y * ${S} + 'px'
      box.appendChild(d)
    }
  })
</` + `script>`
    : ''
}
</body>
</html>
`

fs.writeFileSync(out, html)
console.log(`wrote ${out} (${sheets.length} sheets, frame ${FW}x${FH} @${S}x)`)
