const Build = {
  /**
   * ディレクトリ確認（なければ作成）してIDを返す
   * ※ 親=スプレッドシートの入っているフォルダ
   */
  checkDirectories() {
    const parent = Utils.getParentFolder_();
    if (!parent) {
      SpreadsheetApp.getActive().toast('親フォルダが見つかりません。スプレッドシートをフォルダに入れてください。', 'エラー', 6);
      throw new Error('親フォルダなし');
    }

    // assets/
    const assets    = Utils.getOrCreateSubFolder_(parent, DIR_ASSETS);
    const assetsImg = Utils.getOrCreateSubFolder_(assets, ASSETS_IMG);       // assets/img/

    // output/
    const output      = Utils.getOrCreateSubFolder_(parent, DIR_OUTPUT);
  const outCss      = Utils.getOrCreateSubFolder_(output, OUT_CSS);        // output/css/
    const outJs       = Utils.getOrCreateSubFolder_(output, OUT_JS);         // output/js/
    const outImg      = Utils.getOrCreateSubFolder_(output, OUT_IMG);        // output/img/
    // const outPages = Utils.getOrCreateSubFolder_(output, OUT_PAGES_HTML);  // ← 廃止

    // 保存（必要なもののみ）
    PropertiesService.getScriptProperties().setProperties({
      [PROP_KEYS.PARENT_ID]:           parent.getId(),
      [PROP_KEYS.ASSETS_ID]:           assets.getId(),
      [PROP_KEYS.ASSETS_IMG_ID]:       assetsImg.getId(),
      [PROP_KEYS.OUTPUT_ID]:           output.getId(),
      [PROP_KEYS.OUTPUT_CSS_ID]:       outCss.getId(),
      
      [PROP_KEYS.OUTPUT_JS_ID]:        outJs.getId(),
      [PROP_KEYS.OUTPUT_IMG_ID]:       outImg.getId(),
      // [PROP_KEYS.OUTPUT_CSS_COMPS_ID]:  // ← 廃止
      // [PROP_KEYS.OUTPUT_PAGES_ID]:      // ← 廃止
    }, true);

    // 呼び出し側で使いやすいよう返却
    return {
      parentId: parent.getId(),
      assets: {
        rootId: assets.getId(),
        imgId: assetsImg.getId(),
      },
      output: {
        rootId: output.getId(),
        cssId: outCss.getId(),
        
        jsId: outJs.getId(),
        imgId: outImg.getId(),
        // cssComponentsId:  // ← 廃止
        // pagesHtmlId:      // ← 廃止
      },
    };
  },

  /**
   * TEMPLATE_ROOT/js/<name> を output/js/ にコピー（同名があれば上書き）
   * @param {string} name 例) "store.js"
   * @returns {string|null} ファイルID（作成/更新）または null（ソースなし）
   */
  copyJsFromTemplate(name) {
    if (!name) return null;
    const rootId = Utils.getTemplateRootId_();
    const root = DriveApp.getFolderById(rootId);

    // js フォルダ
    const jsFolderIt = root.getFoldersByName('js');
    if (!jsFolderIt.hasNext()) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet('TEMPLATE_ROOT/js が見つかりません', 'copyJsFromTemplate');
      return null;
    }
    const jsFolder = jsFolderIt.next();

    const files = jsFolder.getFilesByName(name);
    if (!files.hasNext()) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`テンプレ側のJSが見つかりません: ${name}`, 'copyJsFromTemplate');
      return null;
    }
    const srcFile = files.next();
    const blob = srcFile.getBlob().setName(name);

    // 出力先: output/js
    const outJsId = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.OUTPUT_JS_ID);
    if (!outJsId) throw new Error('OUTPUT_JS_ID が未設定です。Build.checkDirectories() を先に呼んでください。');
    const outJsFolder = DriveApp.getFolderById(outJsId);

    // 既存があれば中身を更新、なければ新規作成
    const outIt = outJsFolder.getFilesByName(name);
    if (outIt.hasNext()) {
      const dst = outIt.next();
      dst.setContent(blob.getDataAsString());
      return dst.getId();
    } else {
      const created = outJsFolder.createFile(blob);
      return created.getId();
    }
  },

  /**
   * TEMPLATE_ROOT/css 内の全ファイルを output/css/ にコピー（同名があれば上書き）
   * 注意: colors.css は GAS 側で生成するためスキップ
   */
  copyAllCssFromTemplate() {
    const rootId = Utils.getTemplateRootId_();
    const root = DriveApp.getFolderById(rootId);

    // css フォルダ
    const cssFolderIt = root.getFoldersByName('css');
    if (!cssFolderIt.hasNext()) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet('TEMPLATE_ROOT/css が見つかりません', 'copyAllCssFromTemplate');
      return 0;
    }
    const cssFolder = cssFolderIt.next();

    // 出力先: output/css
    const outCssId = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.OUTPUT_CSS_ID);
    if (!outCssId) throw new Error('OUTPUT_CSS_ID が未設定です。Build.checkDirectories() を先に呼んでください。');
    const outCssFolder = DriveApp.getFolderById(outCssId);

    // 既存ファイルの名前->File マップ
    const existing = {};
    const outFiles = outCssFolder.getFiles();
    while (outFiles.hasNext()) {
      const f = outFiles.next();
      existing[f.getName()] = f;
    }

    // コピー実行
    let copied = 0;
    const it = cssFolder.getFiles();
    while (it.hasNext()) {
      const src = it.next();
      const name = src.getName();
      // colors.css / variables.css は GAS 生成物。テンプレに同名があってもスキップ
      if (name === 'colors.css' || name === 'variables.css') continue;
      const blob = src.getBlob().setName(name);
      if (existing[name]) {
        existing[name].setContent(blob.getDataAsString());
      } else {
        outCssFolder.createFile(blob);
      }
      copied++;
    }

    if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`CSSコピー: ${copied}件`, 'copyAllCssFromTemplate');
    return copied;
  },

  /**
   * assets/img 配下の全ファイル・フォルダを output/img に再帰コピー（同名は上書き）
   * @returns {number} コピー（新規作成+上書き）したファイル数
   */
  copyAssetsToOutputImg() {
    const assetsImgId = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.ASSETS_IMG_ID);
    const outImgId    = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.OUTPUT_IMG_ID);
    if (!assetsImgId) throw new Error('ASSETS_IMG_ID が未設定です。Build.checkDirectories() を先に呼んでください。');
    if (!outImgId)    throw new Error('OUTPUT_IMG_ID が未設定です。Build.checkDirectories() を先に呼んでください。');

    const src = DriveApp.getFolderById(assetsImgId);
    const dst = DriveApp.getFolderById(outImgId);

    const count = this.copyFolderContents_(src, dst);
    if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`assets/img → output/img: ${count}ファイル`, 'copyAssetsToOutputImg');
    return count;
  },

  /**
   * フォルダ配下を再帰コピー（同名ファイルは上書き、サブフォルダは作成）
   * @param {GoogleAppsScript.Drive.Folder} src
   * @param {GoogleAppsScript.Drive.Folder} dst
   * @returns {number} 処理（新規+上書き）したファイル数
   */
  copyFolderContents_(src, dst) {
    let copied = 0;

    // 既存ファイルのマップ（名前→File）
    const existingFiles = {};
    const dstFiles = dst.getFiles();
    while (dstFiles.hasNext()) {
      const f = dstFiles.next();
      existingFiles[f.getName()] = f;
    }

    // ファイルのコピー/上書き（バイナリ安全: 既存は捨てて Blob で作り直す）
    const files = src.getFiles();
    while (files.hasNext()) {
      const s = files.next();
      const name = s.getName();
      const blob = s.getBlob().setName(name);
      if (existingFiles[name]) {
        try {
          // 既存はバイナリ劣化を避けるため丸ごと入れ替え
          existingFiles[name].setTrashed(true);
        } catch (e) {
          // 権限や複数親の都合で捨てられない場合は重複を許容
          if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`既存削除失敗: ${name} - ${e.message}`, 'copyFolderContents_');
        }
      }
      dst.createFile(blob);
      copied++;
    }

    // サブフォルダの再帰コピー
    const folders = src.getFolders();
    while (folders.hasNext()) {
      const sf = folders.next();
      const name = sf.getName();
      // 宛先に同名フォルダがあるか
      const it = dst.getFoldersByName(name);
      const df = it.hasNext() ? it.next() : dst.createFolder(name);
      copied += this.copyFolderContents_(sf, df);
    }

    return copied;
  },

  /**
   * スクリプトタグを構築し、必須/条件付きのJSファイルを output/js に配置
  * @param {{mvOk:boolean, missionOk:boolean, serviceOk?:boolean, companyOk?:boolean, worksOk?:boolean}} flags
   * @returns {string} HTML の <script> タグ列
   */
  buildScriptsTag(flags) {
    const list = [
      'store.js',
      'main.js',
      'header.js',
      'footer.js',
    ];
    if (flags && flags.mvOk) list.push('mv.js');
    if (flags && flags.missionOk) list.push('mission.js');
  if (flags && flags.serviceOk) list.push('service.js');
  if (flags && flags.companyOk) list.push('company.js');
  if (flags && flags.worksOk) list.push('works.js');

    const tags = [];
    list.forEach((name) => {
      try {
        const id = this.copyJsFromTemplate(name);
        if (id) tags.push(`<script src="/js/${name}"></script>`);
      } catch (e) {
        if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`JSコピー失敗: ${name} - ${e.message}`, 'buildScriptsTag');
      }
    });
    return tags.join('\n');
  },


  loadTemplates(targetLayout, order) {
    Utils.logToSheet(`テンプレート読み込み開始`, 'loadTemplates');

    let indexLayout = this.getTemplateFile('layout', targetLayout || 'default');

    // デバッグ: 読み込んだ生レイアウトを保存（DEBUG_BUILD が true のときのみ）
    if (typeof DEBUG_BUILD !== 'undefined' && DEBUG_BUILD) {
      try {
        const outRootId = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.OUTPUT_ID);
        if (outRootId) {
          this.saveHtmlToFolder(outRootId, `debug__layout_${targetLayout || 'default'}_raw.html`, indexLayout);
        }
      } catch (e) {
        // noop
      }
    }

    // セクション生成
    let sectionString = ''
    if (order && order.length > 0) {
      order.forEach((item) => {
        Utils.logToSheet(`セクションID:[${item.id}]`, 'loadTemplates');
        if (item.id === 'mv') {
          sectionString += this.getMvContents() + '\n';
        }
        if (item.id === 'mission') {
          sectionString += this.getMissionContents() + '\n';
        }
        if (item.id === 'service') {
          sectionString += this.getServiceContents() + '\n';
        }
        if (item.id === 'company') {
          sectionString += this.getCompanyContents() + '\n';
        }
        if (item.id === 'works') {
          sectionString += this.getWorksContents() + '\n';
        }
        // 他のセクションもこの分岐に追加
      });
    }

    // header/footer 読み込み（現状は静的テンプレートをそのまま埋め込み）
    const headerHtml = this.getHeaderContents();
    const footerHtml = this.getFooterContents();

    // 置換の順序: contents -> header/footer -> meta
    if (sectionString.length > 0) {
      indexLayout = this.applyTagReplacements(indexLayout, { contents: sectionString });
    }
    indexLayout = this.applyTagReplacements(indexLayout, { header: headerHtml, footer: footerHtml });

    // デバッグ: セクション・ヘッダー・フッター差し込み後も保存（DEBUG_BUILD が true のときのみ）
    if (typeof DEBUG_BUILD !== 'undefined' && DEBUG_BUILD) {
      try {
        const outRootId = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.OUTPUT_ID);
        if (outRootId) {
          this.saveHtmlToFolder(outRootId, `debug__layout_${targetLayout || 'default'}_before_meta.html`, indexLayout);
        }
      } catch (e) {
        // noop
      }
    }

    Utils.logToSheet(`${targetLayout}テンプレート読み込み完了:[${typeof indexLayout}]`, 'loadTemplates');

    // meta 情報の差し込み（MetaInfo に集約）
    let metaRepl = (typeof MetaInfo !== 'undefined' && MetaInfo.getTemplateReplacements)
      ? MetaInfo.getTemplateReplacements()
      : ((typeof MetaInfo !== 'undefined' && MetaInfo.getLayoutReplacements)
        ? MetaInfo.getLayoutReplacements()
        : { title: '', description: '', url: '', image: '' });
    // body_classes を最終差し込み
    try {
      if (typeof CommonInfo !== 'undefined' && CommonInfo.getBodyClassesString) {
        const bodyCls = CommonInfo.getBodyClassesString();
        metaRepl.body_classes = bodyCls;
      }
    } catch (e) {
      // noop
    }
    const output = this.applyTagReplacements(indexLayout, metaRepl);
    return output;
  },

  /** mv */
  getMvContents() {
    const template = this.getTemplateFile('components', 'mv');
    // まず MvInfo（グローバルmvを元に整形したマップ）を優先し、
    // なければ従来の Utils.getSheetValue にフォールバック。
    let replacements = {};
    if (typeof MvInfo !== 'undefined' && typeof MvInfo.getTemplateReplacements === 'function') {
      replacements = MvInfo.getTemplateReplacements();
    } else {
      replacements = {
        mv_catchphrase: Utils.getSheetValue('mv', 'catchphrase'),
        mv_bg_image_url_pc: Utils.getSheetValue('mv', 'bg_image_url_pc'),
        mv_bg_image_url_sp: Utils.getSheetValue('mv', 'bg_image_url_sp'),
        mv_bg_image_alt: Utils.getSheetValue('mv', 'bg_image_alt'),
      };
    }

    return this.applyTagReplacements(template, replacements);
  },

  /** services */
  getServiceContents() {
    const template = this.getTemplateFile('components', 'service');
    let replacements = {};
    if (typeof ServiceInfo !== 'undefined' && typeof ServiceInfo.getTemplateReplacements === 'function') {
      replacements = ServiceInfo.getTemplateReplacements();
    } else {
      replacements = {
        section_title: Utils.getSheetValue('service', 'section_title') || '',
        section_title_en: Utils.getSheetValue('service', 'section_title_en') || '',
        section_intro: Utils.getSheetValue('service', 'section_intro') || '',
      };
    }
    return this.applyTagReplacements(template, replacements);
  },

  /** company */
  getCompanyContents() {
    const template = this.getTemplateFile('components', 'company');
    let replacements = {};
    if (typeof CompanyInfo !== 'undefined' && typeof CompanyInfo.getTemplateReplacements === 'function') {
      replacements = CompanyInfo.getTemplateReplacements();
    } else {
      const rawTag = Utils.getSheetValue('company', 'googlemap_tag') || '';
      const wrapped = (rawTag && String(rawTag).trim()) ? `<div class="googlemap-wrap">${String(rawTag).trim()}</div>` : '';
      replacements = {
        section_title: Utils.getSheetValue('company', 'section_title') || '',
        section_title_en: Utils.getSheetValue('company', 'section_title_en') || '',
        googlemap_tag: wrapped,
      };
    }
    return this.applyTagReplacements(template, replacements);
  },

  /** works */
  getWorksContents() {
    const template = this.getTemplateFile('components', 'works');
    let replacements = {};
    if (typeof WorksInfo !== 'undefined' && typeof WorksInfo.getTemplateReplacements === 'function') {
      replacements = WorksInfo.getTemplateReplacements();
    } else {
      replacements = {
        section_title: Utils.getSheetValue('works', 'section_title') || '',
        section_intro: Utils.getSheetValue('works', 'section_intro') || '',
      };
    }
    return this.applyTagReplacements(template, replacements);
  },

  /** header */
  getHeaderContents() {
    // テンプレート取得
    const template = this.getTemplateFile('components', 'header');
    // nav シートからナビHTMLを構築
    let navHtml = '';
    try {
      const items = this.getNavItemsFromSheet_();
      navHtml = this.buildNavLis_(items);
    } catch (e) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`ヘッダーナビ生成失敗: ${e.message}`, 'getHeaderContents');
    }

    // 基本設定からロゴURL/お問い合わせURLを取得（siteInfos を優先、なければシート直読み）
    const s = (typeof siteInfos !== 'undefined') ? siteInfos : {};
    const get = (k) => {
      if (s && s[k] != null && String(s[k]).trim() !== '') return String(s[k]);
      try { return String(Utils.getSheetValue('基本設定', k) || ''); } catch (_) { return ''; }
    };
    const logoUrl = get('logo_url') || '/images/logo.png';
    const contactUrl = get('contact_url') || '';
    // contact_is_external: 真なら _blank、偽なら _self
    const extRaw = get('contact_is_external');
    const isExternal = (function(v){
      if (v == null) return false;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      const s = String(v).trim().toLowerCase();
      return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on';
    })(extRaw);
    const contactTarget = isExternal ? '_blank' : '_self';

    // プレースホルダ置換
    return this.applyTagReplacements(template, {
      header_nav: navHtml,
      logo_url: logoUrl,
      contact_url: contactUrl,
      contact_is_external: contactTarget,
    });
  },

  /** footer */
  getFooterContents() {
    const template = this.getTemplateFile('components', 'footer');
    // CommonInfo の siteInfos を優先。なければ Utils.getSheetValue でフォールバック
    const s = (typeof siteInfos !== 'undefined') ? siteInfos : {};
    const get = (k) => {
      if (s && s[k] != null && String(s[k]).trim() !== '') return String(s[k]);
      try {
        // 基本設定シートから直接取得（存在しない場合は空）
        return String(Utils.getSheetValue('基本設定', k) || '');
      } catch (e) {
        return '';
      }
    };
    // footer シートから直接取得（存在すればこちらを優先）
    const getFooter = (k) => {
      try {
        const v = Utils.getSheetValue('footer', k);
        return (v != null && String(v).trim() !== '') ? String(v) : '';
      } catch (e) {
        return '';
      }
    };

    // フッター用カラー変数を colors.css に登録（footer シートに値がある場合）
    try {
      const bg = getFooter('bg_color');
      const tx = getFooter('text_color');
      if (typeof CommonInfo !== 'undefined' && CommonInfo.addColorVar) {
        if (bg) CommonInfo.addColorVar('--pcol-footer-bg-color', String(bg));
        if (tx) CommonInfo.addColorVar('--pcol-footer-text-color', String(tx));
      }
    } catch (e) {
      // noop
    }

    // nav シートからナビHTML
    let footerNavHtml = '';
    try {
      const items = this.getNavItemsFromSheet_();
      footerNavHtml = this.buildNavLis_(items);
    } catch (e) {
      // noop
    }

    const replacements = {
      // footer シートがあればそちらを優先
      logo_url: (function(){ const v = getFooter('logo_url'); return v || get('logo_url'); })(),
      company_name: (function(){ const v = getFooter('company_name'); return v || get('company_name'); })(),
      address: (function(){ const v = getFooter('address'); return v || get('address'); })(),
      footer_nav: footerNavHtml,
      // シート側は copyrights の可能性があるためフォールバック
      copyright: (function(){
        // footer シート優先
        const fv = getFooter('copyright');
        if (fv) return fv;
        const fvs = getFooter('copyrights');
        if (fvs) return fvs;
        const v = get('copyright');
        if (v) return v;
        return get('copyrights');
      })(),
    };
    return this.applyTagReplacements(template, replacements);
  },

  /** mission */
  getMissionContents() {
    const template = this.getTemplateFile('components', 'mission');
    // MissionInfo があればそれを優先（改行→<br> を含む）
    let replacements = {};
    if (typeof MissionInfo !== 'undefined' && typeof MissionInfo.getTemplateReplacements === 'function') {
      replacements = MissionInfo.getTemplateReplacements();
      // テンプレ互換: heading_text / intro_text キーがあれば優先で埋める
      if (replacements['mission_heading_text'] && !replacements['heading_text']) {
        replacements['heading_text'] = replacements['mission_heading_text'];
      }
      if (replacements['mission_intro_text'] && !replacements['intro_text']) {
        replacements['intro_text'] = replacements['mission_intro_text'];
      }
      // セクション英タイトルが未定義ならフォールバック取得
      if (!('section_title_en' in replacements)) {
        replacements['section_title_en'] = Utils.getSheetValue('mission', 'section_title_en') || '';
      }
    } else {
      replacements = {
        mission_heading_text: Utils.getSheetValue('mission', 'heading_text'),
        mission_intro_text: Utils.getSheetValue('mission', 'intro_text'),
        section_title_en: Utils.getSheetValue('mission', 'section_title_en') || '',
      };
      // 互換キー
      replacements['heading_text'] = replacements['mission_heading_text'];
      replacements['intro_text'] = replacements['mission_intro_text'];
    }

    return this.applyTagReplacements(template, replacements);
  },



  /**
   * 指定フォルダ内に同名ファイルがあれば上書き、なければ新規作成して保存
   * @param {string} folderId - 保存先フォルダID（例: ids.output.pagesHtmlId）
   * @param {string} filename - 保存ファイル名（例: "index.html"）
   * @param {string} html     - 保存するHTML文字列（例: tmp）
   * @return {string} fileId  - 保存（更新）されたファイルID
   */
  saveHtmlToFolder(folderId, filename, html) {
    const folder = DriveApp.getFolderById(folderId);

    const files = folder.getFilesByName(filename);
    if (files.hasNext()) {
      const file = files.next();
      file.setContent(html);
      return file.getId();
    }

    // なければ新規作成
    const blob = Utilities.newBlob(html, 'text/html', filename);
    const created = folder.createFile(blob);
    return created.getId();
  },

  /**
   * シート「コンテンツ表示順」から表示順に並んだセクションID配列を返す
   * @return {Array<{order:number, id:string}>}
   */
  getContentOrder() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("コンテンツ表示順");
    if (!sheet) throw new Error("シート「コンテンツ表示順」が見つかりません");

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    // A〜D列を取得（2行目から最終行まで）
    const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();

    // 表示フラグ(D列)がオンの行だけ取り出し（true/1/"TRUE"/"yes"/"on" 等を許容）
    const items = values
      .filter(row => {
        const v = row[3];
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return v !== 0;
        if (typeof v === 'string') {
          const s = v.trim().toLowerCase();
          return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on';
        }
        return false;
      })
      .map(row => ({
        order: Number(row[0]),
        id: String(row[1]).trim(),
        name: String(row[2] || '').trim(), // ブロック名（空なら未設定）
      }));

    // 表示順でソート
    items.sort((a, b) => a.order - b.order);

    return items;
  },

  /**
   * ヘッダーナビのLI群を生成
   * @param {Array<{order:number,id:string,name?:string}>} order
   * @returns {string} <li>...</li> の連結HTML
   */
  // nav シートから配列を取得（nav_1_url, nav_1_label, nav_1_external ...）
  getNavItemsFromSheet_() {
    const out = [];
    const truthy = (v) => {
      if (v == null) return false;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      const s = String(v).trim().toLowerCase();
      return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on';
    };
    try {
      for (let i = 1; i <= 200; i++) {
        const url   = Utils.getSheetValue('nav', `nav_${i}_url`);
        const label = Utils.getSheetValue('nav', `nav_${i}_label`);
        const ext   = Utils.getSheetValue('nav', `nav_${i}_external`);
        const href = (url == null) ? '' : String(url).trim();
        const text = (label == null) ? '' : String(label).trim();
        if (!href || !text) continue;
        out.push({ order: i, url: href, label: text, external: truthy(ext) });
      }
    } catch (e) {
      // シート未作成などは空配列
    }
    out.sort((a, b) => a.order - b.order);
    return out;
  },

  // <li><a ...> のHTMLへ変換
  buildNavLis_(items) {
    if (!items || items.length === 0) return '';
    const esc = (s) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const lis = items.map(it => {
      const href = esc(it.url);
      const label = esc(it.label);
      const isAnchor = href.startsWith('#');
      const target = (it.external && !isAnchor) ? ' target="_blank"' : '';
      return `<li><a @click.prevent="onItemClick" href="${href}"${target}>${label}</a></li>`;
    });
    return lis.join('\n');
  },

  /**
   * Drive上のテンプレートを取得して文字列で返す
   * 期待パス: TEMPLATE_ROOT/<baseDir>/<targetKey>.template.html
   *   例) baseDir="layout",     targetKey="index"   -> layout/index.template.html
   *       baseDir="components", targetKey="mission" -> components/mission.template.html
   *
   * @param {("layout"|"components")} baseDir
   * @param {string} targetKey
   * @return {string} HTML文字列 (UTF-8)
   */
  getTemplateFile(baseDir, targetKey) {
    const rootId = Utils.getTemplateRootId_();
    if (!rootId) throw new Error('DRIVE_FILES.TEMPLATE_ROOT が未設定です');

    if (baseDir !== 'layout' && baseDir !== 'components') {
      throw new Error(`baseDir は "layout" か "components" を指定してください: ${baseDir}`);
    }
    if (!targetKey) throw new Error('targetKey を指定してください');

    const root = DriveApp.getFolderById(rootId);

    const baseIt = root.getFoldersByName(baseDir);
    if (!baseIt.hasNext()) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`${baseDir} フォルダが見つかりません`, 'getTemplateFile');
      throw new Error(`${baseDir} フォルダが見つかりません`);
    }
    const baseFolder = baseIt.next();

    const filename = `${targetKey}.template.html`;
    const files = baseFolder.getFilesByName(filename);
    if (!files.hasNext()) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`${filename} が見つかりません`, 'getTemplateFile');
      throw new Error(`${filename} が見つかりません`);
    }
    const file = files.next();

    const html = file.getBlob().getDataAsString('UTF-8');
    if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`OK: ${baseDir}/${filename}`, 'getTemplateFile');
    return html;
  },


  /**
   * テンプレート文字列内の <?= key ?> を replacements の値で置換する
   * @param {string} template - 置換対象のテンプレート文字列
   * @param {Object<string,string>} replacements - キーと値の対応
   * @return {string} 置換後のHTML文字列
   */
  applyTagReplacements(template, replacements) {
    // 未指定のキーは消さずに残す（後段の置換パスで埋めるため）
    return template.replace(/<\?=\s*([a-zA-Z0-9_]+)\s*\?>/g, function(match, key) {
      return (key in replacements) ? String(replacements[key]) : match;
    });
  }


}