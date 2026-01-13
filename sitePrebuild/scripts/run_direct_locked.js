const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

(async () => {
  const lockPath = path.resolve(__dirname, '.run_direct.lock');
  try {
    const fd = fs.openSync(lockPath, 'wx'); // create exclusively
    fs.closeSync(fd);
  } catch (e) {
    console.log('[style:dev] another run is in progress. skipped.');
    process.exit(0);
  }

  const cleanup = () => {
    try { fs.unlinkSync(lockPath); } catch {}
  };

  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'direct'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code) => {
    cleanup();
    if (code !== 0) {
      console.error(`[style:dev] direct exited with code ${code}`);
      process.exit(code);
    }
  });

  child.on('error', (err) => {
    cleanup();
    console.error('[style:dev] failed to start direct:', err.message || err);
    process.exit(1);
  });
})();
