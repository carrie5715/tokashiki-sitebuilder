// デバッグ出力のON/OFF（debug__*.html の出力制御などに使用）
var DEBUG_BUILD = false; // 納品用にデバッグ出力を無効化

function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi && SpreadsheetApp.getUi();
    if (!ui) return;
    ui.createMenu('サイト生成')
      .addItem('Step① シート読み取り', 'sheetReadAll')
      .addItem('Step② スタイル変数出力', 'exportStyleVariablesMenu')
      .addItem('Step③ ファイル出力準備', 'prepareOutputResourcesMenu')
      .addItem('Step④ ファイル出力', 'buildAll')
      .addItem('出力をZIP作成（ダウンロード用）', 'zipOutput')
      .addItem('出力ZIPの共有リンク生成', 'zipOutputWithLink')
      .addSeparator()
      .addItem('テンプレートID設定', 'setTemplateRootIdPrompt')
      .addItem('テンプレートIDクリア', 'clearTemplateRootId')
      .addToUi();
  } catch (e) {
    if (typeof Utils?.logToSheet === 'function') Utils.logToSheet('onOpen UIメニュー生成スキップ: ' + e.message, 'onOpen');
  }
}

function sheetReadAll() {
  const stTime = new Date().getTime();
    Utils.logToSheet('🟢 >>>>> Step① シート読み取り開始 >>>>>', 'sheetReadAll');
  // 出力用フォルダID取得（info/snapshot）
  let ids;
  try {
    ids = Build.checkDirectories();
  } catch (e) {
    Utils.logToSheet('❌ フォルダ確認失敗: ' + e.message, 'sheetReadAll');
    throw e;
  }
  const snapshotFolderId = ids && ids.info && ids.info.snapshotId;
  if (!snapshotFolderId) {
    Utils.logToSheet('❌ snapshot保存先(info/snapshot)取得失敗', 'sheetReadAll');
    throw new Error('snapshotフォルダなし');
  }

  // 対象シート名（必要に応じて拡張）
  const sheetNames = [
    'mv', 'message', 'service', 'contact', 'faq', 'company', 'works', 'flow', 'footer', 'header', 'meta', 'nav'
  ];

  const ss = SpreadsheetApp.getActive();
  const components = {};
  sheetNames.forEach(name => {
    try {
      const sh = ss.getSheetByName(name);
      if (!sh) return;
      const values = sh.getDataRange().getValues();
      components[name] = {
        sheetName: name,
        rows: values,
        rowCount: values.length,
        colCount: values.length ? values[0].length : 0
      };
    } catch (e) {
      Utils.logToSheet(`❌ シート取得失敗: ${name} - ${e.message}`, 'sheetReadAll');
    }
  });

  // ===== 前倒しパース (processed) 生成 =====
  // rows ハッシュ + ok 判定のみ（軽量）。後続最適化で拡張予定。
  const computeHash = function(name, rows) {
    try {
      const flat = JSON.stringify(rows || []);
      const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, flat);
      return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
    } catch(e) { return 'hash_error_'+name; }
  };
  // 依存順序: contact -> header （header は nav/contact に依存）
  const ORDER_FOR_PROCESSED = ['mv','message','service','faq','company','works','flow','contact','header','footer','meta','nav'];
  globalThis.__snapshotOverrides = {};
  Object.keys(components).forEach(k => { globalThis.__snapshotOverrides[k] = components[k].rows; });
  // CommonInfo の基本設定読込（header 等が参照）
  try { if (typeof CommonInfo !== 'undefined' && CommonInfo.readAndRecordBasicSettings) { CommonInfo.readAndRecordBasicSettings(); } } catch(_){ }
  const processed = {};
  ORDER_FOR_PROCESSED.forEach(name => {
    if (!components[name]) return;
    let ok = false;
    // 各 Info.read() があれば呼び出し（シートアクセスは snapshotOverrides により回避される想定）
    try {
      const infoName = name.charAt(0).toUpperCase() + name.slice(1) + 'Info';
      const infoObj = globalThis[infoName];
      if (infoObj && typeof infoObj.read === 'function') {
        const res = infoObj.read();
        if (res && res.ok) ok = !!res.ok;
        // 前倒し詳細パース: message -> slides, service -> items
        if (name === 'message' && infoObj && typeof infoObj.buildSlides_ === 'function') {
          try {
            const slides = infoObj.buildSlides_();
            processed[name] = processed[name] || {};
            processed[name].data = { slides: slides, slidesCount: slides.length };
            processed[name].json = JSON.stringify(slides);
          } catch (e2) {
            Utils.logToSheet('❌ processed message slides生成失敗: ' + e2.message, 'sheetReadAll');
          }
        }
        if (name === 'service' && infoObj && typeof infoObj.parseItems_ === 'function') {
          try {
            const items = infoObj.parseItems_();
            processed[name] = processed[name] || {};
            processed[name].data = { items: items, itemsCount: items.length };
            processed[name].json = JSON.stringify(items);
          } catch (e3) {
            Utils.logToSheet('❌ processed service items生成失敗: ' + e3.message, 'sheetReadAll');
          }
        }
        if (name === 'faq' && infoObj && typeof infoObj.parseFaqItems_ === 'function') {
          try {
            const items = infoObj.parseFaqItems_();
            processed[name] = processed[name] || {};
            processed[name].data = { items: items, itemsCount: items.length };
            processed[name].json = JSON.stringify(items);
          } catch (e4) {
            Utils.logToSheet('❌ processed faq items生成失敗: ' + e4.message, 'sheetReadAll');
          }
        }
        if (name === 'works' && infoObj && typeof infoObj.parseWorksItems_ === 'function') {
          try {
            const items = infoObj.parseWorksItems_();
            processed[name] = processed[name] || {};
            processed[name].data = { items: items, itemsCount: items.length };
            processed[name].json = JSON.stringify(items);
          } catch (e5) {
            Utils.logToSheet('❌ processed works items生成失敗: ' + e5.message, 'sheetReadAll');
          }
        }
        if (name === 'flow' && infoObj && typeof infoObj.parseFlowItems_ === 'function') {
          try {
            const items = infoObj.parseFlowItems_();
            processed[name] = processed[name] || {};
            processed[name].data = { items: items, itemsCount: items.length };
            processed[name].json = JSON.stringify(items);
          } catch (e6) {
            Utils.logToSheet('❌ processed flow items生成失敗: ' + e6.message, 'sheetReadAll');
          }
        }
      } else {
        // read が無い場合は rows 有無で簡易判定
        ok = (components[name].rowCount > 0);
      }
    } catch(e) {
      Utils.logToSheet('❌ processed read失敗: '+name+' - '+e.message, 'sheetReadAll');
    }
    processed[name] = {
      hash: computeHash(name, components[name].rows),
      ok: ok,
      rows: { count: components[name].rowCount, cols: components[name].colCount }
    };
    // 既に data/json を上書きしている場合は維持（上記で設定済みなら統合）
    if (processed[name].data) {
      processed[name].dataHash = (function(){
        try { return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(processed[name].data))
          .map(b => ('0'+(b & 0xFF).toString(16)).slice(-2)).join(''); } catch(_){ return 'data_hash_error'; }
      })();
    }
  });
  try { delete globalThis.__snapshotOverrides; } catch(_){ }

  // スナップショット構造（version=2 へ）
  const now = new Date();
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const timestamp = now.getTime();
  const snapshot = {
    version: 2,
    generatedAt: now.toISOString(),
    dateKey: dateStr,
    timestamp: timestamp,
    spreadsheetId: ss.getId(),
    components: components,
    processed: processed
  };

  // ファイル名提案: prefix = 'snapshot_' → snapshot_YYYYMMDD-HHmmss-<timestamp>.json
  const fileName = `snapshot_${dateStr}-${timestamp}.json`;
  try {
    const folder = DriveApp.getFolderById(snapshotFolderId);
    const blob = Utilities.newBlob(JSON.stringify(snapshot, null, 2), 'application/json', fileName);
    folder.createFile(blob);
    Utils.logToSheet(`snapshot保存: info/snapshot/${fileName}`, 'sheetReadAll');
  } catch (e) {
    Utils.logToSheet('❌ snapshot保存失敗: ' + e.message, 'sheetReadAll');
    throw e;
  }

  const edTime = new Date().getTime();
  const elapSec = ((edTime - stTime) / 1000).toFixed(2);
    Utils.logToSheet(`🌟 xxxxx シート読み取り全て完了 処理時間: ${elapSec} 秒 xxxxx`, 'sheetReadAll');
}

// 出力フォルダ確認と CSS / extend-css / 画像コピーをまとめた共通処理
function prepareOutputResources_(sourceLabel) {
  const label = sourceLabel || 'prepareOutputResources';
  const ids = Build.checkDirectories();
  SpreadsheetApp.getActive().toast('出力準備OK（フォルダ確認済み）', label, 3);
  Utils.logToSheet('出力準備OK（フォルダ確認・作成完了）', label);

  let hadError = false;
  try { Build.copyAllCssFromTemplate(); } catch (e) { hadError = true; Utils.logToSheet(`❌ テンプレCSSコピー失敗: ${e.message}`, label); }
  try { Build.copyExtendCssFromTemplate(); } catch (e) { hadError = true; Utils.logToSheet(`❌ extend-css コピー失敗: ${e.message}`, label); }
  try { Build.copyAssetsToOutputImg(); } catch (e) { hadError = true; Utils.logToSheet(`❌ assets→output/img コピー失敗: ${e.message}`, label); }
  try { if (Build.copyAssetsAppImgToOutputAppImg) { Build.copyAssetsAppImgToOutputAppImg(); } } catch (e) { hadError = true; Utils.logToSheet(`❌ assets→output/app-img コピー失敗: ${e.message}`, label); }
  try { if (Build.copyAssetsToOutputCustomStyles) { Build.copyAssetsToOutputCustomStyles(); } } catch (e) { hadError = true; Utils.logToSheet(`❌ assets→output/custom-styles コピー失敗: ${e.message}`, label); }

  // コピーが全て成功した場合のみ「準備完了」フラグを立てる
  try {
    if (typeof PropertiesService !== 'undefined') {
      const props = PropertiesService.getScriptProperties();
      if (!hadError) {
        props.setProperty('OUTPUT_PREPARED_AT', new Date().toISOString());
        if (typeof Utils !== 'undefined' && Utils.logToSheet) {
          Utils.logToSheet('OUTPUT_PREPARED_AT フラグ設定: 出力準備完了', label);
        }
      } else {
        // エラーがあった場合はフラグをクリア
        props.deleteProperty('OUTPUT_PREPARED_AT');
        if (typeof Utils !== 'undefined' && Utils.logToSheet) {
          Utils.logToSheet('❌ OUTPUT_PREPARED_AT フラグクリア: 出力準備中にエラーあり', label);
        }
      }
    }
  } catch (e) {
    if (typeof Utils !== 'undefined' && Utils.logToSheet) {
      Utils.logToSheet('❌ OUTPUT_PREPARED_AT フラグ更新失敗: ' + e.message, label);
    }
  }

  // どこかでコピーエラーが発生していれば、呼び出し側に失敗として伝える
  if (hadError) {
    throw new Error('出力準備中に一部コピーエラーが発生しました。ログを確認してください。');
  }

  return ids;
}


function buildAll() {
  const stTime = new Date().getTime();
  Utils.logToSheet('🟢 >>>>> Step④ ファイル出力開始 >>>>>', 'buildAll');

  try { if (typeof Utils !== 'undefined' && Utils.ensureUtilitySheets) { Utils.ensureUtilitySheets(); } } catch (e) {}

  // 出力フォルダ確認（コピー処理は Step③ に委譲）
  const ids = Build.checkDirectories();

  // Step③ が正常完了しているかの軽量チェック（フラグ確認のみ）
  try {
    const props = PropertiesService.getScriptProperties();
    const preparedAt = props.getProperty('OUTPUT_PREPARED_AT');
    if (!preparedAt) {
      if (typeof Utils !== 'undefined' && Utils.logToSheet) {
        Utils.logToSheet('❌ ファイル出力準備(Step③)が完了していないため処理を中止します。', 'buildAll');
      }
      SpreadsheetApp.getActive().toast('先に「Step③ ファイル出力準備」を実行してください。', 'buildAll', 6);
      return;
    }
  } catch (e) {
    if (typeof Utils !== 'undefined' && Utils.logToSheet) {
      Utils.logToSheet('❌ 出力準備フラグ確認中にエラー: ' + e.message, 'buildAll');
    }
    SpreadsheetApp.getActive().toast('出力準備フラグ確認中にエラーが発生しました。ログを確認してください。', 'buildAll', 6);
    return;
  }

  const common = CommonInfo.readAndRecordBasicSettings();

  // 最新snapshot適用（存在すれば read() はシートアクセスせず rows を利用）
  let snapshot = null;
  const ssSt = new Date().getTime();
  try { snapshot = Build.loadLatestSnapshot(); } catch(_) {}
  if (snapshot && snapshot.components) {
    globalThis.__snapshotOverrides = {};
    Object.keys(snapshot.components).forEach(name => {
      const comp = snapshot.components[name];
      if (comp && comp.rows) {
        globalThis.__snapshotOverrides[name] = comp.rows;
      }
    });
    const ssEd = new Date().getTime();
    Utils.logToSheet(`snapshot適用: ${Object.keys(snapshot.components).length}コンポ / ${snapshot.dateKey} 処理時間: ${((ssEd - ssSt) / 1000).toFixed(2)} 秒`, 'buildAll');
  } else {
    Utils.logToSheet('snapshotなし: 通常readでシート参照', 'buildAll');
  }

  // スナップショット必須化: 無ければ中止
  if (!snapshot) {
    Utils.logToSheet('❌ snapshot未検出のため処理中止。先に「シート読み取り」を実行してください。', 'buildAll');
    SpreadsheetApp.getActive().toast('snapshotが存在しません。sheetReadAll を先に実行してください。', 'buildAll', 6);
    return;
  }

  // ===== processed 情報による差分スキップ =====
  const props = PropertiesService.getScriptProperties();
  const processed = (snapshot && snapshot.version >= 2 && snapshot.processed) ? snapshot.processed : null;
  if (processed) { globalThis.__processedSnapshot = processed; }
  const DEPENDS = { header: ['nav','contact'] };
  const recordOrder = ['meta','mv','message','service','faq','company','works','flow','contact','header','footer'];
  const results = {};
  recordOrder.forEach(name => {
    const infoName = name.charAt(0).toUpperCase() + name.slice(1) + 'Info';
    const infoObj = globalThis[infoName];
    const hasRecord = infoObj && typeof infoObj.record === 'function';
    let doRecord = true;
    if (processed && processed[name]) {
      // 依存コンポのハッシュ差分考慮
      const selfHash = processed[name].hash;
      const prevHash = props.getProperty('COMP_HASH_'+name);
      let depsChanged = false;
      if (DEPENDS[name]) {
        depsChanged = DEPENDS[name].some(dep => {
          const depHash = processed[dep] ? processed[dep].hash : 'missing';
          const prevDepHash = props.getProperty('COMP_HASH_'+dep);
          return depHash !== prevDepHash;
        });
      }
      if (prevHash && selfHash === prevHash && !depsChanged) {
        doRecord = false; // 差分なし＆依存差分なし → スキップ
      }
    }
    // const stCmp = new Date().getTime();
    if (hasRecord && doRecord) {
      try {
        results[name] = infoObj.record();
        // ハッシュ更新
        if (processed && processed[name]) {
          props.setProperty('COMP_HASH_'+name, processed[name].hash);
        }
        // const edCmp = new Date().getTime();
        // Utils.logToSheet(`record完了: ${name} (${((edCmp-stCmp)/1000).toFixed(2)}s)`, 'buildAll');
      } catch(e) {
        Utils.logToSheet(`❌ record失敗: ${name} - ${e.message}`, 'buildAll');
        results[name] = { ok:false };
      }
    } else if (processed && processed[name]) {
      // スキップ: ok フラグのみ利用
      results[name] = { ok: processed[name].ok, skipped: true };
      // 何を根拠にスキップしたかをログに残す（原因の見える化）
      const selfHash = processed[name].hash;
      const prevHash = props.getProperty('COMP_HASH_'+name) || '(none)';
      let depsInfo = '';
      if (DEPENDS[name]) {
        const depSummary = DEPENDS[name].map(dep => {
          const depHash = processed[dep] ? processed[dep].hash : 'missing';
          const prevDepHash = props.getProperty('COMP_HASH_'+dep) || '(none)';
          return `${dep}: ${prevDepHash} -> ${depHash}`;
        }).join(', ');
        depsInfo = ` / deps[${depSummary}]`;
      }
      Utils.logToSheet(`  -- record skip: ${name} (hash ${prevHash} -> ${selfHash}${depsInfo})`, 'buildAll');
    } else if (hasRecord) {
      // processed無し → 互換モードで実行
      try {
        results[name] = infoObj.record();
        Utils.logToSheet(`互換record: ${name}`, 'buildAll');
      } catch(e) {
        Utils.logToSheet(`❌ 互換record失敗: ${name} - ${e.message}`, 'buildAll');
        results[name] = { ok:false };
      }
    }
  });

  // processed スナップショットのグローバル参照をクリア
  if (globalThis.__processedSnapshot) { try { delete globalThis.__processedSnapshot; } catch(_){} }

  var mvRes      = results['mv']      || null;
  var messageRes = results['message'] || null;
  var serviceRes = results['service'] || null;
  var faqRes     = results['faq']     || null;
  var companyRes = results['company'] || null;
  var worksRes   = results['works']   || null;
  var flowRes    = results['flow']    || null;

  // snapshot overrides 終了処理（後続の別関数影響を避けるためクリア）
  if (globalThis.__snapshotOverrides) {
    try { delete globalThis.__snapshotOverrides; } catch(_) {}
  }

  const order = Build.getContentOrder();

  // works / worksN 用のシート存在チェックと JSON 出力
  try {
    if (typeof Build.prepareWorksSections === 'function') {
      Build.prepareWorksSections(order);
    }
  } catch (e) {
    Utils.logToSheet(`❌ works系セクション準備中にエラー: ${e.message}`, 'buildAll');
    SpreadsheetApp.getActive().toast('works セクションの準備中にエラーが発生しました。ログを確認してください。', 'buildAll', 6);
    throw e;
  }

  const mainHtml = Build.loadTemplates('top', order);

  var mvOk = !!(mvRes && mvRes.ok);
  var messageOk = !!(messageRes && messageRes.ok);
  var serviceOk = !!(serviceRes && serviceRes.ok);
  var companyOk = !!(companyRes && companyRes.ok);
  var faqOk = !!(faqRes && faqRes.ok);
  // works セクションが1つでもあれば works.js を必ず読み込む
  var hasWorksSection = Array.isArray(order) && order.some(function(it){ return it && typeof it.id === 'string' && /^works(\d+)?$/.test(it.id); });
  var worksOk = hasWorksSection;
  var flowOk = !!(flowRes && flowRes.ok);
  const scriptsTag = Build.buildScriptsTag({ mvOk, messageOk, serviceOk, faqOk, companyOk, worksOk, flowOk });
  const mainWithScripts = Build.applyTagReplacements(mainHtml, { scripts: scriptsTag });

  const finalHtml = (typeof Build.stripHtmlCommentsExceptSectionTitle_ === 'function')
    ? Build.stripHtmlCommentsExceptSectionTitle_(mainWithScripts)
    : mainWithScripts;
  Build.saveHtmlToFolder(ids.output.rootId, 'index.html', finalHtml);
  Utils.logToSheet(`HTML出力完了: output/index.html`, 'buildAll');

  if (typeof CommonInfo !== 'undefined' && CommonInfo.writeColorsCss) {
    try { CommonInfo.writeColorsCss(ids.output.cssId); } catch (e) { Utils.logToSheet(`❌ colors.css 出力失敗: ${e.message}`, 'buildAll'); }
  }
  // variables.css 出力は StyleVariables へ委譲（CommonInfo側でも委譲済みのため、どちらでも可）
  // variables.css の出力は新メニュー「スタイル変数出力」で実行する運用へ変更

  const edTime = new Date().getTime();
  const elapSec = ((edTime - stTime) / 1000).toFixed(2);
  Utils.logToSheet(`🌟 xxxxx 書き出し処理全て完了 処理時間: ${elapSec} 秒 xxxxx`, 'buildAll');
}

function zipOutput() {
  try {
    const ids = Build.checkDirectories();
    const outId = ids.output.rootId;
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const zipName = `output_${stamp}`;
    const zipFile = Utils.zipFolder(outId, zipName);
    SpreadsheetApp.getActive().toast(`ZIP作成: ${zipFile.getName()}（マイドライブ直下）`, 'zipOutput', 5);
  } catch (e) {
    SpreadsheetApp.getActive().toast('ZIP作成に失敗しました。ログを確認してください。', 'zipOutput', 5);
    Utils.logToSheet(`❌ ZIP作成エラー: ${e.message}`, 'zipOutput');
    throw e;
  }
}

function zipOutputWithLink() {
  try {
    const ids = Build.checkDirectories();
    const outId = ids.output.rootId;
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const zipName = `output_${stamp}`;
    const zipFile = Utils.zipFolder(outId, zipName);
    zipFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const url = zipFile.getUrl();
    SpreadsheetApp.getActive().toast(`共有リンク作成: ${zipFile.getName()}`, 'zipOutputWithLink', 5);
    Utils.logToSheet(`ZIP共有リンク: ${url}`, 'zipOutputWithLink');
  } catch (e) {
    SpreadsheetApp.getActive().toast('共有リンク作成に失敗しました。ログを確認してください。', 'zipOutputWithLink', 5);
    Utils.logToSheet(`❌ ZIP共有リンクエラー: ${e.message}`, 'zipOutputWithLink');
    throw e;
  }
}

function setTemplateRootIdPrompt() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('テンプレートルートIDを入力', 'Google DriveフォルダID（layout/components/js/cssが入ったルート）', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) {
    SpreadsheetApp.getActive().toast('キャンセルしました', 'setTemplateRootIdPrompt', 3);
    return;
  }
  const value = (res.getResponseText() || '').trim();
  if (!value) {
    SpreadsheetApp.getActive().toast('IDが空です', 'setTemplateRootIdPrompt', 4);
    return;
  }
  PropertiesService.getScriptProperties().setProperty('TEMPLATE_ROOT_ID', value);
  SpreadsheetApp.getActive().toast('テンプレートIDを設定しました', 'setTemplateRootIdPrompt', 3);
}

function clearTemplateRootId() {
  PropertiesService.getScriptProperties().deleteProperty('TEMPLATE_ROOT_ID');
  Utils.logToSheet('TEMPLATE_ROOT_ID をクリア', 'clearTemplateRootId');
  SpreadsheetApp.getActive().toast('テンプレートIDをクリアしました', 'clearTemplateRootId', 3);
}

// 新メニュー: 出力フォルダ準備 + テンプレCSS/画像コピー
function prepareOutputResourcesMenu() {
  try {
    const stTime = new Date().getTime();
    if (typeof Utils !== 'undefined' && Utils.logToSheet) {
      Utils.logToSheet('🟢 >>>>> Step③ ファイル出力準備開始 >>>>>', 'prepareOutputResources');
    }
    prepareOutputResources_('prepareOutputResources');
    const edTime = new Date().getTime();
    const elapSec = ((edTime - stTime) / 1000).toFixed(2);
    if (typeof Utils !== 'undefined' && Utils.logToSheet) {
      Utils.logToSheet(`🌟 xxxxx ファイル出力準備完了 処理時間: ${elapSec} 秒 xxxxx`, 'prepareOutputResources');
    }
  } catch (e) {
    if (typeof Utils !== 'undefined' && Utils.logToSheet) {
      Utils.logToSheet('❌ ファイル出力準備エラー: ' + e.message, 'prepareOutputResources');
    }
    SpreadsheetApp.getActive().toast('ファイル出力準備に失敗しました。ログを確認してください。', 'prepareOutputResources', 4);
    throw e;
  }
}

// 新メニュー: スタイル変数出力（base + theme_styles）
function exportStyleVariablesMenu() {
  try {
    const stTime = new Date().getTime();
    if (typeof Utils !== 'undefined' && Utils.logToSheet) {
      Utils.logToSheet('🟢 >>>>> Step② スタイル変数出力開始 >>>>>', 'exportStyleVariablesMenu');
    }
    const ids = Build.checkDirectories();
    const cssFolderId = ids && ids.output && ids.output.cssId;
    if (!cssFolderId) throw new Error('CSS 出力フォルダIDが不明です');
    // 基本設定を読込（cssVars を初期化）
    try { if (typeof CommonInfo !== 'undefined' && CommonInfo.readAndRecordBasicSettings) { CommonInfo.readAndRecordBasicSettings(); } } catch (_e) {}
    // 1) base（CommonInfo/既存の cssVars）を variables.css へ出力
    if (typeof StyleVariables !== 'undefined' && StyleVariables.writeVariablesCss) {
      StyleVariables.writeVariablesCss(cssFolderId);
    } else if (typeof CommonInfo !== 'undefined' && CommonInfo.writeVariablesCss) {
      CommonInfo.writeVariablesCss(cssFolderId);
    }
    // 2) theme_styles シート由来の変数を追加出力
    if (typeof StyleVariables !== 'undefined' && StyleVariables.exportThemeStylesVariables) {
      StyleVariables.exportThemeStylesVariables(cssFolderId);
    }
    // 3) works / worksN セクション用のカラーCSSを works-variants.css として出力
    if (typeof StyleVariables !== 'undefined' && typeof StyleVariables.exportWorksVariantsCss === 'function') {
      StyleVariables.exportWorksVariantsCss(cssFolderId);
    }
    SpreadsheetApp.getActive().toast('スタイル変数を出力しました', 'exportStyleVariablesMenu', 3);
    const edTime = new Date().getTime();
    const elapSec = ((edTime - stTime) / 1000).toFixed(2);
    if (typeof Utils !== 'undefined' && Utils.logToSheet) {
      Utils.logToSheet(`🌟 xxxxx スタイル変数出力処理全て完了 処理時間: ${elapSec} 秒 xxxxx`, 'exportStyleVariablesMenu');
    }
  } catch (e) {
	Utils.logToSheet('❌ スタイル変数出力エラー: ' + e.message, 'exportStyleVariablesMenu');
    SpreadsheetApp.getActive().toast('スタイル変数出力に失敗しました', 'exportStyleVariablesMenu', 4);
    throw e;
  }
}
