// グローバル保持
var meta = meta || {};

var MetaInfo = (function () {
  const META_SHEET_NAME       = 'meta';
  const PARAMETERS_SHEET_NAME = 'Parameters';
  const LOGS_SHEET_NAME       = 'Logs';

  // meta シートを読み込み、meta を更新し、Parameters へ投げる行データを返す
  function readMeta_() {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(META_SHEET_NAME);
    if (!sh) throw new Error('「meta」シートが見つかりません。');

    const values = sh.getDataRange().getValues();
    if (!values || values.length === 0) return [];

    // 先頭行がヘッダーかどうか判定（A1=key かつ B1=value ならヘッダーとみなす）
    const a1 = (values[0][0] != null ? String(values[0][0]).trim().toLowerCase() : '');
    const b1 = (values[0][1] != null ? String(values[0][1]).trim().toLowerCase() : '');
    const hasHeader = (a1 === 'key' && (b1 === 'value' || b1 === 'val' || b1 === '値'));

    // 1行目はヘッダー想定: A=key, B=value, C=note
    const rows = [];
    const startRow = hasHeader ? 1 : 0;
    for (let r = startRow; r < values.length; r++) {
      const key  = values[r][0] ? String(values[r][0]).trim() : '';
      const val  = values[r][1] != null ? values[r][1] : '';
      const note = values[r][2] != null ? String(values[r][2]) : '';
      if (!key) continue;

      // グローバルに保存
      meta[key] = val;

      // Parameters へ渡す行（カテゴリは "meta" 固定）
      rows.push({ category: 'meta', key, value: val, note });
    }
    return rows;
  }

  // Parameters シート確保（CommonInfo があれば共用。なければフォールバックで作成）
  function ensureParametersSheet_() {
    if (typeof CommonInfo !== 'undefined' && CommonInfo.ensureParametersSheet_) {
      return CommonInfo.ensureParametersSheet_();
    }
    const ss = SpreadsheetApp.getActive();
    let sheet = ss.getSheetByName(PARAMETERS_SHEET_NAME);
    if (sheet) return sheet;

    const sheets = ss.getSheets();
    let logsIndex = -1;
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getName() === LOGS_SHEET_NAME) { logsIndex = i; break; }
    }
    sheet = (logsIndex >= 0)
      ? ss.insertSheet(PARAMETERS_SHEET_NAME, logsIndex)
      : ss.insertSheet(PARAMETERS_SHEET_NAME);

    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, 4).setValues([[ 'カテゴリ', 'キー', 'バリュー', 'ノート' ]]);
      sheet.setFrozenRows(1);
    }
    return sheet;
  }

  // Parameters へ追記
  function appendToParameters_(rows) {
    if (!rows || rows.length === 0) return;

    // CommonInfo が持つ append を使えるならそれを使う（列揃えの一貫性）
    if (typeof CommonInfo !== 'undefined' && CommonInfo.appendToParameters_) {
      return CommonInfo.appendToParameters_(rows);
    }

    const sh = ensureParametersSheet_();
    const start = Math.max(sh.getLastRow(), 1) + 1;
    const values = rows.map(r => [r.category, r.key, r.value, r.note || '']);
    sh.getRange(start, 1, values.length, 4).setValues(values);
  }

  // 公開API: 読み込み + Parameters 追記 + 概要返却
  function readAndRecordMeta() {
    const rows = readMeta_();
    appendToParameters_(rows);

    if (typeof Utils !== 'undefined' && Utils.logToSheet) {
      Utils.logToSheet(`meta: ${Object.keys(meta).length}件`, 'MetaInfo');
    }
    return { meta: JSON.parse(JSON.stringify(meta)), rows };
  }

  // レイアウト置換用の代表メタ値を返す
  // 例: title, description, og:url, og:image
  function getLayoutReplacements() {
    const sv = (v) => (v == null ? '' : String(v));
    const title = meta['title'] || meta['og:title'];
    const description = meta['description'] || meta['og:description'];
    const url = meta['url'] || meta['canonical'] || meta['og:url'];
    const image = meta['image'] || meta['og:image'];

    return {
      title: sv(title),
      description: sv(description),
      url: sv(url),
      image: sv(image),
    };
  }

  // テンプレ置換でよく使う同義キーもまとめて返す
  // 例) og_title, meta_title, meta_description, canonical など
  function getTemplateReplacements() {
    const sv = (v) => (v == null ? '' : String(v));
    const m = meta || {};

    const title = m['title'] || m['og:title'] || m['site_title'] || m['meta_title'];
    const description = m['description'] || m['og:description'] || m['meta_description'];
    const url = m['url'] || m['canonical'] || m['og:url'];
    const image = m['image'] || m['og:image'];

    const og_title = m['og:title'] || title;
    const og_description = m['og:description'] || description;
    const og_url = m['og:url'] || url;
    const og_image = m['og:image'] || image;

    const twitter_title = m['twitter:title'] || og_title || title;
    const twitter_description = m['twitter:description'] || og_description || description;
    const twitter_image = m['twitter:image'] || og_image || image;

    return {
      // 基本
      title: sv(title),
      description: sv(description),
      url: sv(url),
      image: sv(image),

      // 同義語
      meta_title: sv(title),
      meta_description: sv(description),
      canonical: sv(url),

      // OG/Twitter（コロンはテンプレ側のキーに使えないため underscore 版を提供）
      og_title: sv(og_title),
      og_description: sv(og_description),
      og_url: sv(og_url),
      og_image: sv(og_image),

      twitter_title: sv(twitter_title),
      twitter_description: sv(twitter_description),
      twitter_image: sv(twitter_image),
    };
  }

  // 全メタを浅いコピーで取得（参照渡しを避ける）
  function getAll() {
    return JSON.parse(JSON.stringify(meta));
  }

  return {
    readAndRecordMeta,
    // エクスポート（必要に応じて）
    readMeta_: readMeta_,
    ensureParametersSheet_: ensureParametersSheet_,
    appendToParameters_: appendToParameters_,
    get: function(key) { return meta[key]; },
    getLayoutReplacements,
    getTemplateReplacements,
    getAll,
  };
})();
