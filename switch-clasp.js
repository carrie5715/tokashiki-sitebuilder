#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// このスクリプトはプロジェクトルートに置く想定
// gas/.clasp.json と clasp-projects.json を読む
const projectsPath = path.join(__dirname, 'clasp-projects.json');
const claspPath = path.join(__dirname, 'gas', '.clasp.json');

function loadJson(p) {
  try {
    const txt = fs.readFileSync(p, 'utf8');
    return JSON.parse(txt);
  } catch (e) {
    console.error(`JSON 読み込みに失敗しました: ${p}`);
    console.error(e.message);
    process.exit(1);
  }
}

function saveJson(p, obj) {
  try {
    fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  } catch (e) {
    console.error(`JSON 書き込みに失敗しました: ${p}`);
    console.error(e.message);
    process.exit(1);
  }
}

function main() {
  if (!fs.existsSync(projectsPath)) {
    console.error('プロジェクト設定ファイルが見つかりません: ' + projectsPath);
    process.exit(1);
  }
  if (!fs.existsSync(claspPath)) {
    console.error('.clasp.json が見つかりません: ' + claspPath);
    process.exit(1);
  }

  const projects = loadJson(projectsPath);
  const clasp = loadJson(claspPath);

  console.log('=== clasp scriptId スイッチャー ===');
  if (clasp.scriptId) {
    const current = projects.find(p => p.scriptId === clasp.scriptId);
    if (current) {
      console.log(`現在: ${current.name} (${current.key})`);
    } else {
      console.log(`現在: 未登録の scriptId (${clasp.scriptId})`);
    }
  } else {
    console.log('現在: scriptId 未設定');
  }
  console.log('');

  projects.forEach((p, idx) => {
    console.log(`${idx + 1}: ${p.name} (${p.key})`);
  });
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('切り替えたい番号を入力してください: ', answer => {
    rl.close();
    const n = parseInt(answer, 10);
    if (!Number.isInteger(n) || n < 1 || n > projects.length) {
      console.error('1〜' + projects.length + ' の数字を入力してください。');
      process.exit(1);
    }

    const selected = projects[n - 1];
    clasp.scriptId = selected.scriptId;
    saveJson(claspPath, clasp);

    console.log('---');
    console.log(`scriptId を切り替えました: ${selected.name} (${selected.key})`);
    console.log(`scriptId: ${selected.scriptId}`);
  });
}

main();
