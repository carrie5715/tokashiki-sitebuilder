const fs = require('fs-extra');
const path = require('path');

(async () => {
  const ROOT = path.resolve(__dirname, '..');
  const SRC  = path.join(ROOT, 'public', 'css');
  const DEST = path.resolve(ROOT, '..', 'templateBase', 'drive_resources', 'css');
  const CLEAN = process.argv.includes('--clean');

  if (!(await fs.pathExists(SRC))) {
    console.log(`[skip] CSS 出力が見つかりません: ${SRC}`);
    process.exit(0);
  }

  await fs.ensureDir(DEST);
  if (CLEAN) {
    await fs.emptyDir(DEST);
    console.log(`[clean] ${DEST}`);
  }
  await fs.copy(SRC, DEST, { overwrite: true });
  console.log(`[copy] ${SRC} -> ${DEST}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
