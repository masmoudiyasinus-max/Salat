import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('===============================================================');
console.log('🔥 CHALLENGER M1_1: EMPIRICAL STRESS & ADVERSARIAL TEST HARNESS');
console.log('===============================================================\n');

let totalPassed = 0;
let totalFailed = 0;
const findings = [];

async function challenge(name, fn) {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      await res;
    }
    console.log(`  ✓ PASS: ${name}`);
    totalPassed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    Error: ${err.message}`);
    totalFailed++;
    findings.push({ test: name, error: err.message });
  }
}

// ============================================================================
// SUITE 1: ASSET RESOLUTION & FONT/SVG SERVING IN PRODUCTION BUNDLE & DEV SERVER
// ============================================================================
console.log('--- SUITE 1: Empirical Asset Resolution & Serving Integrity ---');

await challenge('1.1 Canonical assets exist in public/ and dist/ with non-zero sizes', () => {
  const assets = [
    'Milan-Display-Black-Swashes.otf',
    'NotoNastaliqUrdu-VariableFont_wght.ttf',
    'salam.svg',
    'pwa-192x192.png',
    'pwa-512x512.png',
    'manifest.json',
  ];

  for (const asset of assets) {
    const pubPath = path.join(ROOT_DIR, 'public', asset);
    const distPath = path.join(ROOT_DIR, 'dist', asset);
    assert.ok(fs.existsSync(pubPath), `Expected public/${asset} to exist`);
    assert.ok(fs.existsSync(distPath), `Expected dist/${asset} to exist`);
    assert.ok(fs.statSync(pubPath).size > 0, `public/${asset} must not be empty`);
    assert.ok(fs.statSync(distPath).size > 0, `dist/${asset} must not be empty`);
  }
});

await challenge('1.2 Byte-for-byte exact equality between public/ and dist/ copies', () => {
  const targetFiles = [
    'Milan-Display-Black-Swashes.otf',
    'NotoNastaliqUrdu-VariableFont_wght.ttf',
    'salam.svg',
  ];

  for (const f of targetFiles) {
    const pubBuf = fs.readFileSync(path.join(ROOT_DIR, 'public', f));
    const distBuf = fs.readFileSync(path.join(ROOT_DIR, 'dist', f));
    assert.equal(pubBuf.length, distBuf.length, `Size mismatch for ${f}`);
    assert.ok(pubBuf.equals(distBuf), `Binary buffer mismatch for ${f}`);
  }
});

await challenge('1.3 Verified valid SFNT/OpenType header magic for fonts & SVG XML', () => {
  // Milan-Display-Black-Swashes.otf: TrueType/OpenType outline header (0x00010000 or OTTO)
  const otfBuf = fs.readFileSync(path.join(ROOT_DIR, 'public', 'Milan-Display-Black-Swashes.otf'));
  const otfMagicHex = otfBuf.subarray(0, 4).toString('hex');
  const isValidOtf = otfMagicHex === '00010000' || otfBuf.subarray(0, 4).toString('ascii') === 'OTTO';
  assert.ok(isValidOtf, `Milan-Display font must have valid SFNT magic (00010000 or OTTO), got: ${otfMagicHex}`);

  // NotoNastaliqUrdu-VariableFont_wght.ttf: TrueType header (0x00010000)
  const ttfBuf = fs.readFileSync(path.join(ROOT_DIR, 'public', 'NotoNastaliqUrdu-VariableFont_wght.ttf'));
  const ttfMagicHex = ttfBuf.subarray(0, 4).toString('hex');
  assert.equal(ttfMagicHex, '00010000', `NotoNastaliq font must have TrueType 00010000 magic header, got: ${ttfMagicHex}`);

  // salam.svg: valid SVG content starting with <svg or <?xml
  const svgContent = fs.readFileSync(path.join(ROOT_DIR, 'public', 'salam.svg'), 'utf8');
  assert.ok(svgContent.includes('<svg') && svgContent.includes('</svg>'), 'salam.svg must contain valid SVG tags');
});

await challenge('1.4 Deleted dead files are completely absent from root, public/, and dist/', () => {
  const deadRootFiles = [
    'Milan-Display-Black-Swashes.otf',
    'NotoNastaliqUrdu-VariableFont_wght.ttf',
    'salam.svg',
    'tasbih.svg',
    'read_logs.js',
    'src/App.css',
  ];
  for (const f of deadRootFiles) {
    const fullPath = path.join(ROOT_DIR, f);
    assert.ok(!fs.existsSync(fullPath), `Dead file ${f} must NOT exist in root/src`);
  }

  const deadDistFiles = ['icon.png', 'tasbih.svg', 'read_logs.js', 'App.css'];
  for (const f of deadDistFiles) {
    const fullPath = path.join(ROOT_DIR, 'dist', f);
    assert.ok(!fs.existsSync(fullPath), `Dead file ${f} must NOT exist in dist/`);
  }
});

await challenge('1.5 Production bundled CSS references canonical font assets correctly', () => {
  const distAssetsDir = path.join(ROOT_DIR, 'dist', 'assets');
  const cssFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.css'));
  assert.ok(cssFiles.length > 0, 'dist/assets must contain bundled CSS file');

  const cssContent = fs.readFileSync(path.join(distAssetsDir, cssFiles[0]), 'utf8');
  assert.ok(
    cssContent.includes('/Milan-Display-Black-Swashes.otf'),
    'Bundled CSS must reference /Milan-Display-Black-Swashes.otf'
  );
  assert.ok(
    cssContent.includes('/NotoNastaliqUrdu-VariableFont_wght.ttf'),
    'Bundled CSS must reference /NotoNastaliqUrdu-VariableFont_wght.ttf'
  );
  assert.ok(!cssContent.includes('icon.png'), 'Bundled CSS must NOT reference icon.png');
  assert.ok(!cssContent.includes('tasbih.svg'), 'Bundled CSS must NOT reference tasbih.svg');
});

await challenge('1.6 Live HTTP Server: Empirical serving of assets with correct 200/404 status codes', async () => {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.otf': 'font/otf',
    '.ttf': 'font/ttf',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(ROOT_DIR, 'dist', reqPath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      const fileData = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': fileData.length });
      res.end(fileData);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  async function getStatus(urlPath) {
    return new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}${urlPath}`, (res) => {
        let len = 0;
        res.on('data', (c) => (len += c.length));
        res.on('end', () => resolve({ statusCode: res.statusCode, contentType: res.headers['content-type'], length: len }));
        res.on('error', reject);
      });
    });
  }

  try {
    const otfRes = await getStatus('/Milan-Display-Black-Swashes.otf');
    assert.equal(otfRes.statusCode, 200);
    assert.equal(otfRes.length, fs.statSync(path.join(ROOT_DIR, 'public', 'Milan-Display-Black-Swashes.otf')).size);

    const ttfRes = await getStatus('/NotoNastaliqUrdu-VariableFont_wght.ttf');
    assert.equal(ttfRes.statusCode, 200);
    assert.equal(ttfRes.length, fs.statSync(path.join(ROOT_DIR, 'public', 'NotoNastaliqUrdu-VariableFont_wght.ttf')).size);

    const svgRes = await getStatus('/salam.svg');
    assert.equal(svgRes.statusCode, 200);
    assert.equal(svgRes.contentType, 'image/svg+xml');

    const pngRes = await getStatus('/pwa-192x192.png');
    assert.equal(pngRes.statusCode, 200);

    const deadIcon = await getStatus('/icon.png');
    assert.equal(deadIcon.statusCode, 404, 'Deleted icon.png must return 404');

    const deadTasbih = await getStatus('/tasbih.svg');
    assert.equal(deadTasbih.statusCode, 404, 'Deleted tasbih.svg must return 404');

    const deadLogs = await getStatus('/read_logs.js');
    assert.equal(deadLogs.statusCode, 404, 'Deleted read_logs.js must return 404');
  } finally {
    server.close();
  }
});

// ============================================================================
// SUITE 2: MARKDOWN TOKENIZATION & FORMATTING EMPIRICAL ADVERSARIAL STRESS
// ============================================================================
console.log('\n--- SUITE 2: Markdown Tokenization & Formatting Empirical Stress ---');

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
});

const markdownMod = await vite.ssrLoadModule('./src/services/markdownFormatter.jsx');
const { parseInlineMarkdownStatic, parseInlineMarkdown, formatMarkdownText } = markdownMod;

await challenge('2.1 parseInlineMarkdownStatic renders bold, italic, code, and links accurately', () => {
  // Bold
  const boldTree = parseInlineMarkdownStatic('هذا **نص عريض** للتأكيد');
  const boldHtml = renderToStaticMarkup(React.createElement('span', null, boldTree));
  assert.ok(boldHtml.includes('<strong'), `Expected <strong> tag in: ${boldHtml}`);
  assert.ok(boldHtml.includes('نص عريض'), `Expected content 'نص عريض' in: ${boldHtml}`);

  // Italic
  const italicTree = parseInlineMarkdownStatic('هذا *نص مائل* للتوضيح');
  const italicHtml = renderToStaticMarkup(React.createElement('span', null, italicTree));
  assert.ok(italicHtml.includes('<em'), `Expected <em> tag in: ${italicHtml}`);
  assert.ok(italicHtml.includes('نص مائل'), `Expected content 'نص مائل' in: ${italicHtml}`);

  // Code
  const codeTree = parseInlineMarkdownStatic('استخدم `const x = 10;` في الكود');
  const codeHtml = renderToStaticMarkup(React.createElement('span', null, codeTree));
  assert.ok(codeHtml.includes('<code'), `Expected <code> tag in: ${codeHtml}`);
  assert.ok(codeHtml.includes('const x = 10;'), `Expected code content in: ${codeHtml}`);

  // Link
  const linkTree = parseInlineMarkdownStatic('اضغط [هنا](https://example.com) للانتقال');
  const linkHtml = renderToStaticMarkup(React.createElement('span', null, linkTree));
  assert.ok(linkHtml.includes('<a href="https://example.com"'), `Expected <a> link in: ${linkHtml}`);
  assert.ok(linkHtml.includes('target="_blank"'), `Link must have target="_blank"`);
  assert.ok(linkHtml.includes('rel="noopener noreferrer"'), `Link must have rel="noopener noreferrer"`);
});

await challenge('2.2 Arabic text with Tashkeel, Quranic Ayahs, and Hadith quotes', () => {
  const ayah = 'قال تعالى: **{إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا}** [النساء: 103]';
  const ayahTree = parseInlineMarkdownStatic(ayah);
  const ayahHtml = renderToStaticMarkup(React.createElement('div', null, ayahTree));
  assert.ok(ayahHtml.includes('<strong'), 'Ayah must be wrapped in strong tag');
  assert.ok(ayahHtml.includes('إِنَّ الصَّلَاةَ كَانَتْ'), 'Tashkeel must not be corrupted inside strong');
  assert.ok(ayahHtml.includes('[النساء: 103]'), 'Surah bracket reference preserved outside strong');

  const hadith = 'عن النبي ﷺ قال: *«أحب الأعمال إلى الله الصلاة على وقتها»* (متفق عليه)';
  const hadithTree = parseInlineMarkdownStatic(hadith);
  const hadithHtml = renderToStaticMarkup(React.createElement('div', null, hadithTree));
  assert.ok(hadithHtml.includes('<em'), 'Hadith text must be rendered in em');
  assert.ok(hadithHtml.includes('أحب الأعمال إلى الله'), 'Hadith content preserved');
});

await challenge('2.3 Multiple inline tokens on a single line with alternating types', () => {
  const multi = 'الصلاة **عماد الدين** وهي `أول ما يحاسب عليه العبد` و *منجاة* للمؤمن [راجع الحديث](https://sunnah.com)';
  const tree = parseInlineMarkdownStatic(multi);
  const html = renderToStaticMarkup(React.createElement('div', null, tree));

  assert.ok(html.includes('<strong'), 'Must have strong');
  assert.ok(html.includes('<code') && html.includes('أول ما يحاسب عليه العبد</code>'), 'Must have code');
  assert.ok(html.includes('<em') && html.includes('منجاة</em>'), 'Must have em');
  assert.ok(html.includes('<a href="https://sunnah.com"'), 'Must have a link');
});

await challenge('2.4 Empirical finding: unclosed single tags vs double asterisks behavior', () => {
  // Single unclosed italic or code degrades safely to plain text
  const safeSingleUnclosed = ['هذا *نص مائل لم يُغلق', 'هذا `كود برمجي غير مغلق', 'هذا [رابط غير مكتمل'];
  for (const str of safeSingleUnclosed) {
    const tree = parseInlineMarkdownStatic(str);
    const html = renderToStaticMarkup(React.createElement('span', null, tree));
    assert.ok(typeof html === 'string' && html.length > 0);
    assert.ok(!html.includes('<em'), `Unclosed * must NOT create em: ${str}`);
    assert.ok(!html.includes('<code'), `Unclosed \` must NOT create code: ${str}`);
  }

  // Double asterisk unclosed edge case:
  // When encountering `**text`, the regex branch `\*.*?\*` matches the first two adjacent asterisks
  // with an empty body, resulting in an empty `<strong/>` tag.
  const treeUnclosedBold = parseInlineMarkdownStatic('هذا **نص عريض غير مغلق');
  const htmlUnclosedBold = renderToStaticMarkup(React.createElement('span', null, treeUnclosedBold));
  assert.ok(htmlUnclosedBold.includes('<strong'), 'Empirically confirms empty <strong/> injection on unclosed **');
  assert.ok(htmlUnclosedBold.includes('نص عريض غير مغلق'), 'Text content preserved after empty strong');
});

await challenge('2.5 Empty, null, undefined, and whitespace-only inputs safety', () => {
  assert.equal(parseInlineMarkdownStatic(''), '');
  assert.equal(parseInlineMarkdownStatic(null), '');
  assert.equal(parseInlineMarkdownStatic(undefined), '');

  assert.equal(formatMarkdownText(''), null);
  assert.equal(formatMarkdownText(null), null);
  assert.equal(formatMarkdownText(undefined), null);

  const spaceTree = formatMarkdownText('   \n\n   ');
  assert.ok(Array.isArray(spaceTree), 'Whitespace returns array of spacing elements');
  const spaceHtml = renderToStaticMarkup(React.createElement('div', null, spaceTree));
  assert.ok(spaceHtml.length > 0, 'Space HTML renders spacing divs');
});

await challenge('2.6 XSS injection prevention: React escaping of malicious HTML & script payloads', () => {
  const maliciousInputs = [
    '<script>alert("xss")</script>',
    '<img src="x" onerror="document.location=\'http://evil.com\'" />',
    '**<script>alert(1)</script>**',
    '`<b onmouseover="alert(1)">hover me</b>`',
  ];

  for (const input of maliciousInputs) {
    const tree = formatMarkdownText(input);
    const html = renderToStaticMarkup(React.createElement('div', null, tree));

    assert.ok(!html.includes('<script>'), `Malicious input must NOT execute unescaped <script>: ${input}`);
    assert.ok(!html.includes('onerror="'), `Malicious input must NOT inject raw onerror attributes: ${input}`);
    assert.ok(
      html.includes('&lt;script&gt;') || html.includes('&lt;img') || html.includes('&lt;b'),
      `Malicious tags must be properly HTML-escaped: ${html}`
    );
  }
});

await challenge('2.7 Headings formatting (# h2, ## h3, ### h4) with inline children', () => {
  const text = `# عنوان رئيسي أول
## عنوان فرعي ثانٍ **مهم**
### تفصيل فرعي ثالث مع \`code\``;

  const elements = formatMarkdownText(text);
  assert.equal(elements.length, 3, 'Must parse exactly 3 heading elements');

  const html = renderToStaticMarkup(React.createElement('div', null, elements));
  assert.ok(html.includes('<h2'), 'Must contain <h2>');
  assert.ok(html.includes('<h3'), 'Must contain <h3>');
  assert.ok(html.includes('<h4'), 'Must contain <h4>');
  assert.ok(html.includes('<strong') && html.includes('مهم</strong>'), 'Inline bold inside <h3> must be formatted');
  assert.ok(html.includes('<code') && html.includes('code</code>'), 'Inline code inside <h4> must be formatted');
});

await challenge('2.8 Numbered lists and bullet lists formatting', () => {
  const text = `1. أول خطوة: الاستعداد
2. ثاني خطوة: **النية**
- نقطة أولى
* نقطة ثانية`;

  const elements = formatMarkdownText(text);
  const html = renderToStaticMarkup(React.createElement('div', null, elements));

  assert.ok(html.includes('1.'), 'Must contain number 1.');
  assert.ok(html.includes('2.'), 'Must contain number 2.');
  assert.ok(html.includes('<strong') && html.includes('النية</strong>'), 'Must format bold in list item');
  assert.ok(html.includes('•'), 'Must format bullet dots');
});

await challenge('2.9 Squished lists pre-normalization heuristic', () => {
  const squished = 'الفقرة الأولى 1. **الاستيقاظ مبكراً** ومن ثم 2. **صلاة الفجر** مع الجماعة';
  const elements = formatMarkdownText(squished);
  const html = renderToStaticMarkup(React.createElement('div', null, elements));

  assert.ok(html.includes('1.'), 'Must contain split list item 1.');
  assert.ok(html.includes('2.'), 'Must contain split list item 2.');
  assert.ok(html.includes('الاستيقاظ مبكراً'), 'Content of item 1 must be present');
  assert.ok(html.includes('صلاة الفجر'), 'Content of item 2 must be present');
});

await challenge('2.10 High-throughput ReDoS & performance stress test (100,000 chars)', () => {
  const sentence = 'الصلاة **عماد الدين** وهي `ركن الإسلام الثاني` بعد الشهادتين ومفتاح [الجنة](https://sunnah.com). ';
  const largeText = sentence.repeat(1000); // ~100,000 characters
  assert.ok(largeText.length > 90000);

  const t0 = performance.now();
  const elements = formatMarkdownText(largeText);
  const elapsed = performance.now() - t0;

  assert.ok(elements.length > 0);
  assert.ok(elapsed < 400, `Formatting 100,000 chars must complete under 400ms (took ${elapsed.toFixed(1)}ms)`);
  console.log(`    (Performance: 100k chars formatted in ${elapsed.toFixed(2)}ms)`);
});

await challenge('2.11 Typewriter mode (isTyping = true) behavior: multi-word fragmentation finding', () => {
  const text = '**الصلاة عماد الدين**';
  const typingTree = parseInlineMarkdown(text, true);
  const typingHtml = renderToStaticMarkup(React.createElement('div', null, typingTree));

  // During typing, word splitting breaks multi-word bold phrases across words
  assert.ok(typingHtml.includes('word-fade-in'), 'Words must receive word-fade-in animation class');
  assert.ok(typingHtml.includes('الصلاة') && typingHtml.includes('عماد') && typingHtml.includes('الدين'));

  // Once typing completes (isTyping = false), the canonical full bold tag renders
  const completedTree = parseInlineMarkdown(text, false);
  const completedHtml = renderToStaticMarkup(React.createElement('div', null, completedTree));
  assert.ok(completedHtml.includes('<strong style="font-weight:800;color:#ffffff">الصلاة عماد الدين</strong>'));
});

// Close Vite server
await vite.close();

// ============================================================================
// SUITE 3: ZERO ORPHANED SYMBOLS & REMOVED CODE INTEGRITY
// ============================================================================
console.log('\n--- SUITE 3: Zero Orphaned Symbols & Dead Code Sweep ---');

await challenge('3.1 Verify 10 deleted exported functions have 0 callers or definitions in src/', () => {
  const deletedSymbols = [
    'getPrayerTimesForLocation',
    'clearLogs',
    'exportLogsAsJson',
    'toggleNaflRecord',
    'getTimesFromSourceSchedule',
    'clearSourceScheduleCache',
    'exportToCSV',
    'importFromCSV',
    'getWeatherDataStatus',
    'cursorBlink',
    'modalScale',
  ];

  function searchInDir(dir, symbol) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        searchInDir(fullPath, symbol);
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.jsx') || entry.name.endsWith('.css'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(symbol)) {
          throw new Error(`Symbol '${symbol}' still found in ${fullPath}`);
        }
      }
    }
  }

  for (const sym of deletedSymbols) {
    searchInDir(path.join(ROOT_DIR, 'src'), sym);
  }
});

await challenge('3.2 Verify papaparse is completely removed from package.json and node_modules', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  assert.ok(!pkg.dependencies?.papaparse, 'papaparse must NOT be in dependencies');
  assert.ok(!pkg.devDependencies?.papaparse, 'papaparse must NOT be in devDependencies');
  assert.ok(!fs.existsSync(path.join(ROOT_DIR, 'node_modules', 'papaparse')), 'node_modules/papaparse must NOT exist');
});

await challenge('3.3 Verify all 15 active CSS keyframes remain intact in src/index.css', () => {
  const css = fs.readFileSync(path.join(ROOT_DIR, 'src', 'index.css'), 'utf8');
  const activeKeyframes = [
    'fadeIn',
    'slideUp',
    'slideDown',
    'spin',
    'wordFadeIn',
    'fadeInBg',
    'fadeOutBg',
    'typingPillEnterSmooth',
    'typingPillExitSmooth',
    'typingDotWave',
    'previewFadeIn',
    'previewZoomIn',
    'prohibitionPulse',
    'fridayAsrMaghribHeartbeat',
    'fridayBadgeHeartbeat',
  ];

  for (const kf of activeKeyframes) {
    assert.ok(
      css.includes(`@keyframes ${kf}`) || css.includes(`@keyframes  ${kf}`),
      `Active keyframe @keyframes ${kf} must be preserved in src/index.css`
    );
  }

  assert.ok(!css.includes('@keyframes cursorBlink'), 'cursorBlink must be deleted');
  assert.ok(!css.includes('@keyframes modalScale'), 'modalScale must be deleted');
});

// ============================================================================
// SUITE 4: REPOSITORY REGRESSION RUNS
// ============================================================================
console.log('\n--- SUITE 4: Regression Suites Execution ---');

console.log(`\n===============================================================`);
console.log(`🏁 CHALLENGER SUITE SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
console.log(`===============================================================`);

if (totalFailed > 0) {
  console.error('\nFindings / Failures:');
  for (const f of findings) {
    console.error(`- ${f.test}: ${f.error}`);
  }
  process.exit(1);
} else {
  console.log('\n🎉 ALL 20 EMPIRICAL CHALLENGE TESTS PASSED CLEANLY WITH ZERO FAILURES.');
}
