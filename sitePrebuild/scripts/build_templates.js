const fs = require('fs-extra');
const path = require('path');

(async () => {
  const ROOT = path.resolve(__dirname, '..');
  const TB_ROOT = path.resolve(ROOT, '..', 'templateBase', 'drive_resources');

  const targets = [
    { label: 'css',        src: path.join(ROOT, 'public', 'css'),        dest: path.join(TB_ROOT, 'css') },
    { label: 'extend-css', src: path.join(ROOT, 'public', 'extend-css'), dest: path.join(TB_ROOT, 'extend-css') },
    { label: 'img',        src: path.join(ROOT, 'public', 'img'),        dest: path.join(TB_ROOT, 'img') },
    { label: 'js',         src: path.join(ROOT, 'public', 'js'),         dest: path.join(TB_ROOT, 'js') },
    { label: 'comp',       src: path.join(ROOT, 'src', 'components'),    dest: path.join(TB_ROOT, 'components') },
    { label: 'lay',        src: path.join(ROOT, 'src', 'layout'),        dest: path.join(TB_ROOT, 'layout') },
    { label: 'page',       src: path.join(ROOT, 'src', 'pages'),         dest: path.join(TB_ROOT, 'pages') },
  ];

  for (const t of targets) {
    await fs.ensureDir(t.dest);
    // 常にクリーン
    await fs.emptyDir(t.dest);
    if (await fs.pathExists(t.src)) {
      await fs.copy(t.src, t.dest, { overwrite: true });
      console.log(`[copy:${t.label}] ${t.src} -> ${t.dest}`);
    } else {
      console.log(`[skip:${t.label}] ソースが見つかりません: ${t.src}`);
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
