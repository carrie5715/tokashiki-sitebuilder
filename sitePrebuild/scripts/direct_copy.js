const fs = require('fs-extra');
const path = require('path');

(async () => {
  const ROOT = path.resolve(__dirname, '..');
  const TB_ROOT = path.resolve(ROOT, '..', 'templateBase');

  const SRC_CSS_DIR_FROM_TB = path.join(TB_ROOT, 'drive_resources', 'css');
  const DEST_CSS_DIR = path.join(TB_ROOT, 'output', 'css');

  const SRC_JS_DIR = path.join(ROOT, 'public', 'js');
  const DEST_JS_DIR = path.join(TB_ROOT, 'output', 'js');

  let cssCopied = 0;
  let cssSkipped = 0;
  let jsCopied = 0;

  try {
    // 1) CSS 指定ファイルを上書きコピー（colors.css は対象外）
    const cssFiles = ['common.css', 'common.css.map', 'styles.css', 'styles.css.map'];
    await fs.ensureDir(DEST_CSS_DIR);
    for (const name of cssFiles) {
      const src = path.join(SRC_CSS_DIR_FROM_TB, name);
      const dest = path.join(DEST_CSS_DIR, name);
      if (await fs.pathExists(src)) {
        await fs.copy(src, dest, { overwrite: true });
        cssCopied++;
        console.log(`[copy:css] ${src} -> ${dest}`);
      } else {
        cssSkipped++;
        console.log(`[skip:css] not found: ${src}`);
      }
    }

    // 2) public/js 下のJSを上書きコピー
    await fs.ensureDir(DEST_JS_DIR);
    if (await fs.pathExists(SRC_JS_DIR)) {
      const files = await fs.readdir(SRC_JS_DIR);
      for (const f of files) {
        const src = path.join(SRC_JS_DIR, f);
        const dest = path.join(DEST_JS_DIR, f);
        const stat = await fs.stat(src);
        if (stat.isFile()) {
          await fs.copy(src, dest, { overwrite: true });
          jsCopied++;
          console.log(`[copy:js] ${src} -> ${dest}`);
        }
      }
    } else {
      console.log(`[skip:js] ソースが見つかりません: ${SRC_JS_DIR}`);
    }

    const ts = new Date().toISOString();
    console.log(`✅ update completed at ${ts} (css:${cssCopied} copied, ${cssSkipped} skipped; js:${jsCopied} copied)`);
  } catch (err) {
    console.error('❌ update failed:', err?.message || err);
    process.exitCode = 1;
  }
})();
