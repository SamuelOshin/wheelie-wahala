// Builds the game for start.ng: npm run build
//  - bundles src/ with three.js and Planck into one minified file (only the parts of
//    three.js the game uses), plus small chunks for things loaded later (Garage,
//    Daily/Frenzy course tools)
//  - file names carry a content hash, so browsers can keep them forever
//  - points index.html at the new build and writes the offline service worker's file list
// start.ng never runs this: the build/ folder is committed.
import * as esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { brotliCompressSync } from 'node:zlib';

rmSync('build', { recursive: true, force: true });

const result = await esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'esm',
  splitting: true,
  minify: true,
  sourcemap: false, // maps would add megabytes to the repo on every build
  target: 'es2020',
  outdir: 'build',
  entryNames: 'game-[hash]',
  chunkNames: 'chunk-[hash]',
  legalComments: 'eof',
  metafile: true,
  logLevel: 'warning',
});

const outputs = Object.keys(result.metafile.outputs).map((p) => p.replace(/\\/g, '/'));
const js = outputs.filter((p) => p.endsWith('.js'));
const entry = js.find((p) => /build\/game-/.test(p));

// Point index.html at the new entry file (between the markers).
const html = readFileSync('index.html', 'utf8');
const loader = `<!-- game:start -->
  <script type="module">
    // The built game. Add ?src to the address to run the unbundled source instead (for development).
    if (new URLSearchParams(location.search).has('src')) import('./src/main.js');
    else import('./${entry}');
  </script>
  <!-- game:end -->`;
const next = html.replace(/<!-- game:start -->[\s\S]*?<!-- game:end -->/, loader);
if (next === html && !html.includes(entry)) throw new Error('index.html is missing the <!-- game:start --> / <!-- game:end --> markers');
writeFileSync('index.html', next);

// The service worker keeps these for offline play. Its version changes with the build.
const shell = ['./', 'index.html', 'style.css', 'cover.png', 'startng.json', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png', ...js.map((p) => p)];
const version = createHash('sha256').update(js.join('|') + readFileSync('style.css', 'utf8') + next).digest('hex').slice(0, 10);
const sw = readFileSync('tools/sw.template.js', 'utf8')
  .replace('__VERSION__', version)
  .replace('__FILES__', JSON.stringify(shell, null, 2));
writeFileSync('sw.js', sw);

// Report what a player downloads (compressed like start.ng serves it).
let raw = 0, br = 0;
for (const p of js) {
  const buf = readFileSync(p);
  raw += buf.length;
  br += brotliCompressSync(buf).length;
}
// First load: the entry file plus everything it imports up front (not the lazy chunks).
const first = new Set();
const walk = (p) => {
  if (first.has(p)) return;
  first.add(p);
  for (const imp of result.metafile.outputs[p]?.imports ?? []) if (imp.kind === 'import-statement') walk(imp.path.replaceAll('\\', '/'));
};
walk(entry);
const firstBr = [...first].reduce((s, p) => s + brotliCompressSync(readFileSync(p)).length, 0);
console.log(`Built ${entry} (+${js.length - 1} chunks)`);
console.log(`JavaScript: ${(raw / 1024).toFixed(0)} KB minified, ${(br / 1024).toFixed(0)} KB brotli in all`);
console.log(`First load: ${first.size} files, ${(firstBr / 1024).toFixed(0)} KB brotli; the rest loads when needed`);
console.log(`Service worker version ${version}, ${shell.length} files cached for offline play`);
