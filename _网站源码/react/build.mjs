import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.dirname(HERE);                 // _网站源码
const OUT_DIR = path.dirname(SRC);              // 2026年交办单
const OUT = path.join(OUT_DIR, '骑岸居工作工具箱.html');

const result = await build({
  entryPoints: [path.join(HERE, 'app.jsx')],
  bundle: true,
  write: false,
  format: 'iife',
  target: ['es2020'],
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
  legalComments: 'none',
  charset: 'utf8'
});
const appJs = result.outputFiles[0].text;

const css = fs.readFileSync(path.join(SRC, '_antd.css'), 'utf8');
const assets = fs.readFileSync(path.join(SRC, '_assets.js'), 'utf8');
const core = fs.readFileSync(path.join(SRC, '_core.js'), 'utf8');
const lib = fs.readFileSync(path.join(SRC, '_tools_lib.js'), 'utf8');

const bridge = `
/* 把既有生成核心暴露给 React 组件 */
window.JBD = {
  CN, IMG_BOXES, RIGHT_X,
  generatePPT, buildXlsx, buildDocx, downloadBlob, todayStr, fileToDataUrl,
  fitBox, centerLabels, setProblemText, setCoverDate, applyPics, setRels
};
`;

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>骑岸居 · 工作工具箱</title>
<style>
${css}
</style>
</head>
<body>
<div id="root"></div>
<script>
/* ==== 内嵌依赖：JSZip + PPT 模板 ==== */
${assets}
</script>
<script>
/* ==== 生成核心（交办单 / xlsx / docx） ==== */
${core}
${lib}
${bridge}
</script>
<script>
/* ==== React 应用 ==== */
${appJs}
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf8');
console.log(`已生成 ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
console.log(`React bundle ${(appJs.length / 1024).toFixed(0)} KB`);
