import { readFile, writeFile } from 'node:fs/promises';
import { minify } from 'html-minifier-terser';

const outputPath = new URL('../dist/index.html', import.meta.url);
const html = await readFile(outputPath, 'utf8');
const minified = await minify(html, {
  collapseWhitespace: true,
  minifyCSS: true,
  minifyJS: true,
  removeComments: true,
  removeRedundantAttributes: true,
  useShortDoctype: true,
});
const singleLine = minified.replace(/[\r\n]+/g, '');

await writeFile(outputPath, `${singleLine}\n`);

console.log(
  `AppLovin HTML: ${Buffer.byteLength(singleLine)} bytes, 1 line`,
);
