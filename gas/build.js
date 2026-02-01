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

    const assets    = Utils.getOrCreateSubFolder_(parent, DIR_ASSETS);
    const assetsImg = Utils.getOrCreateSubFolder_(assets, ASSETS_IMG);

    const output = Utils.getOrCreateSubFolder_(parent, DIR_OUTPUT);
    const outCss       = Utils.getOrCreateSubFolder_(output, OUT_CSS);
    const outExtendCss = Utils.getOrCreateSubFolder_(output, OUT_EXTEND_CSS);
    const outJs        = Utils.getOrCreateSubFolder_(output, OUT_JS);
    const outImg       = Utils.getOrCreateSubFolder_(output, OUT_IMG);
    // ルート直下 info フォルダとその配下
    const infoRoot      = Utils.getOrCreateSubFolder_(parent, DIR_INFO);
    const infoSnapshot  = Utils.getOrCreateSubFolder_(infoRoot, INFO_SNAPSHOT);
    const infoLogs      = Utils.getOrCreateSubFolder_(infoRoot, INFO_LOGS);

    PropertiesService.getScriptProperties().setProperties({
      [PROP_KEYS.PARENT_ID]: parent.getId(),
      [PROP_KEYS.ASSETS_ID]: assets.getId(),
      [PROP_KEYS.ASSETS_IMG_ID]: assetsImg.getId(),
      [PROP_KEYS.OUTPUT_ID]: output.getId(),
      [PROP_KEYS.OUTPUT_CSS_ID]: outCss.getId(),
      [PROP_KEYS.OUTPUT_EXTEND_CSS_ID]: outExtendCss.getId(),
      [PROP_KEYS.OUTPUT_JS_ID]: outJs.getId(),
      [PROP_KEYS.OUTPUT_IMG_ID]: outImg.getId(),
      [PROP_KEYS.INFO_ID]: infoRoot.getId(),
      [PROP_KEYS.INFO_SNAPSHOT_ID]: infoSnapshot.getId(),
      [PROP_KEYS.INFO_LOGS_ID]: infoLogs.getId(),
    }, true);

    return {
      parentId: parent.getId(),
      assets: { rootId: assets.getId(), imgId: assetsImg.getId() },
      output: { rootId: output.getId(), cssId: outCss.getId(), extendCssId: outExtendCss.getId(), jsId: outJs.getId(), imgId: outImg.getId() },
      info: { rootId: infoRoot.getId(), snapshotId: infoSnapshot.getId(), logsId: infoLogs.getId() },
    };
  },

  /**
   * TEMPLATE_ROOT/js/<name> を output/js/ にコピー（同名があれば上書き）
   * @param {string} name 例) "store.js" / "stores/nav-utils.js"
   * @returns {string|null} ファイルID（作成/更新）または null（ソースなし）
   */
  copyJsFromTemplate(name) {
    if (!name) return null;
    const rootId = Utils.getTemplateRootId_();
    const root = DriveApp.getFolderById(rootId);

    const jsFolderIt = root.getFoldersByName('js');
    if (!jsFolderIt.hasNext()) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet('TEMPLATE_ROOT/js が見つかりません', 'copyJsFromTemplate');
      return null;
    }
    let curSrcFolder = jsFolderIt.next();
    const parts = String(name).split('/').filter(Boolean);
    const fileName = parts.pop();
    for (const p of parts) {
      const it = curSrcFolder.getFoldersByName(p);
      if (!it.hasNext()) {
        if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`テンプレ側サブフォルダなし: js/${parts.join('/')}`, 'copyJsFromTemplate');
        return null;
      }
      curSrcFolder = it.next();
    }

    const files = curSrcFolder.getFilesByName(fileName);
    if (!files.hasNext()) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`テンプレJSなし: ${name}`, 'copyJsFromTemplate');
      return null;
    }
    const srcFile = files.next();
    const blob = srcFile.getBlob().setName(fileName);

    const outJsId = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.OUTPUT_JS_ID);
    if (!outJsId) throw new Error('OUTPUT_JS_ID 未設定。先に Build.checkDirectories() を呼んでください。');
    let curDstFolder = DriveApp.getFolderById(outJsId);
    for (const p of parts) {
      const it = curDstFolder.getFoldersByName(p);
      curDstFolder = it.hasNext() ? it.next() : curDstFolder.createFolder(p);
    }

    const outIt = curDstFolder.getFilesByName(fileName);
    if (outIt.hasNext()) {
      const dst = outIt.next();
      dst.setContent(blob.getDataAsString());
      return dst.getId();
    } else {
      const newFile = curDstFolder.createFile(blob);
      return newFile.getId();
    }
  },

  /**
   * TEMPLATE_ROOT/css 配下の全CSSファイルを output/css にコピー（同名は内容上書き）
   * @returns {number} コピー（新規+上書き）したファイル数
   */
  copyAllCssFromTemplate() {
    const rootId = Utils.getTemplateRootId_();
    if (!rootId) throw new Error('テンプレートルートID未設定です。先に設定してください。');
    const root = DriveApp.getFolderById(rootId);
    const cssFolderIt = root.getFoldersByName('css');
    if (!cssFolderIt.hasNext()) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet('TEMPLATE_ROOT/css が見つかりません', 'copyAllCssFromTemplate');
      return 0;
    }
    const srcCssFolder = cssFolderIt.next();
    const outCssId = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.OUTPUT_CSS_ID);
    if (!outCssId) throw new Error('OUTPUT_CSS_ID 未設定。Build.checkDirectories() を先に呼んでください。');
    const dstFolder = DriveApp.getFolderById(outCssId);
    let count = 0;
    // 直下ファイルのみ（現在テンプレ構造にサブフォルダなし）
    const files = srcCssFolder.getFiles();
    while (files.hasNext()) {
      const f = files.next();
      const name = f.getName();
      const blob = f.getBlob().setName(name);
      const it = dstFolder.getFilesByName(name);
      if (it.hasNext()) {
        try {
          const ex = it.next();
          ex.setContent(blob.getDataAsString());
        } catch (e) {
          if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`CSS上書き失敗: ${name} - ${e.message}`, 'copyAllCssFromTemplate');
        }
      } else {
        dstFolder.createFile(blob);
      }
      count++;
    }
    return count;
  },

  /**
   * TEMPLATE_ROOT/extend-css 配下を output/extend-css に再帰コピー（同名は上書き）
   * デザイン用の追加CSS群をそのまま出力側に反映するための処理
   * @returns {number} コピー（新規作成+上書き）したファイル数
   */
  copyExtendCssFromTemplate() {
    const rootId = Utils.getTemplateRootId_();
    if (!rootId) throw new Error('テンプレートルートID未設定です。先に設定してください。');
    const root = DriveApp.getFolderById(rootId);
    const extendFolderIt = root.getFoldersByName('extend-css');
    if (!extendFolderIt.hasNext()) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet('TEMPLATE_ROOT/extend-css が見つかりません', 'copyExtendCssFromTemplate');
      return 0;
    }
    const srcExtendFolder = extendFolderIt.next();

    const outExtendCssId = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.OUTPUT_EXTEND_CSS_ID);
    if (!outExtendCssId) throw new Error('OUTPUT_EXTEND_CSS_ID 未設定。Build.checkDirectories() を先に呼んでください。');
    const dstFolder = DriveApp.getFolderById(outExtendCssId);

    const count = this.copyFolderContents_(srcExtendFolder, dstFolder);
    return count;
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
    // if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`assets/img → output/img: ${count}ファイル`, 'copyAssetsToOutputImg');
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
   * /info/snapshot から最新の snapshot_*.json を読み込む
   * @returns {Object|null} snapshotオブジェクト or null
   */
  loadLatestSnapshot() {
    try {
      const snapFolderId = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.INFO_SNAPSHOT_ID);
      if (!snapFolderId) return null;
      const folder = DriveApp.getFolderById(snapFolderId);
      const files = folder.getFiles();
      let latestFile = null;
      while (files.hasNext()) {
        const f = files.next();
        const name = f.getName();
        if (!/^snapshot_.*\.json$/i.test(name)) continue;
        if (!latestFile || f.getDateCreated().getTime() > latestFile.getDateCreated().getTime()) {
          latestFile = f;
        }
      }
      if (!latestFile) return null;
      const content = latestFile.getBlob().getDataAsString('UTF-8');
      return JSON.parse(content);
    } catch (e) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`snapshot読込失敗: ${e.message}`, 'loadLatestSnapshot');
      return null;
    }
  },

  /**
  * スクリプトタグを構築し、必須/条件付きのJSファイルを output/js に配置
* @param {{mvOk:boolean, messageOk:boolean, serviceOk?:boolean, companyOk?:boolean, worksOk?:boolean}} flags
   * @returns {string} HTML の <script> タグ列
   */
  buildScriptsTag(flags) {
    const list = [
      'store.js',
      'main.js',
      'stores/nav-utils.js',
      'header.js',
      'footer.js',
      'contact.js',
    ];
    if (flags && flags.mvOk) list.push('mv.js');
    if (flags && flags.messageOk) list.push('message.js');
    if (flags && flags.serviceOk) list.push('service.js');
    if (flags && flags.faqOk) list.push('faq.js');
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
    // Utils.logToSheet(`テンプレート読み込み開始`, 'loadTemplates');

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
        // Utils.logToSheet(`セクションID:[${item.id}]`, 'loadTemplates');
        if (item.id === 'mv') {
          try {
            sectionString += MvInfo.getContents() + '\n';
          } catch (e) {
            if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`mv セクション生成失敗: ${e.message}`, 'loadTemplates');
          }
        }
        if (item.id === 'message') {
          sectionString += this.getMessageContents() + '\n';
        }
        if (item.id === 'service') {
          sectionString += this.getServiceContents() + '\n';
        }
        if (item.id === 'faq') {
          sectionString += this.getFaqContents() + '\n';
        }
        if (item.id === 'company') {
          sectionString += this.getCompanyContents() + '\n';
        }
        if (item.id === 'works') {
          sectionString += this.getWorksContents() + '\n';
        }
        if (item.id === 'contact') {
          sectionString += this.getContactContents() + '\n';
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

    // Utils.logToSheet(`${targetLayout}テンプレート読み込み完了:[${typeof indexLayout}]`, 'loadTemplates');

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

  // getMvContents は MvInfo.getContents へ完全移行済（削除）

  /** contact */
  getContactContents() {
    const template = this.getTemplateFile('components', 'contact');
    // ContactInfo があればそちらを利用
    if (typeof ContactInfo !== 'undefined' && typeof ContactInfo.getTemplateReplacements === 'function') {
      const repl = ContactInfo.getTemplateReplacements();
      return this.applyTagReplacements(template, repl);
    }
    // フォールバック（従来処理）
    const title = Utils.getSheetValue('contact', 'title') || '';
    const message = Utils.getSheetValue('contact', 'message') || '';
    const description = Utils.getSheetValue('contact', 'description') || '';
    try {
      if (typeof CommonInfo !== 'undefined' && CommonInfo.addColorVar) {
        const colorKeys = [ 'background', 'card_bg_color', 'card_text_color' ];
        colorKeys.forEach(k => {
          const v = Utils.getSheetValue('contact', k);
          if (v != null && String(v).trim() !== '') {
            const cssName = '--pcol-contact-' + k.replace(/_/g, '-');
            CommonInfo.addColorVar(cssName, String(v));
          }
        });
      }
    } catch (e) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`contact 色変数登録失敗: ${e.message}`, 'getContactContents');
    }
    let itemsHtml = '';
    try {
      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('contact');
      if (sh) {
        const values = sh.getDataRange().getValues();
        if (values && values.length > 0) {
          const a1 = (values[0][0] != null ? String(values[0][0]).trim().toLowerCase() : '');
          const b1 = (values[0][1] != null ? String(values[0][1]).trim().toLowerCase() : '');
          const hasHeader = (a1 === 'key' && (b1 === 'value' || b1 === 'val' || b1 === '値'));
          const startRow = hasHeader ? 1 : 0;
          const chunks = [];
          for (let r = startRow; r < values.length; r++) {
            const key = values[r][0] != null ? String(values[r][0]).trim() : '';
            if (!/^item\d+$/i.test(key)) continue;
            const rawVal = values[r][1] != null ? String(values[r][1]).trim() : '';
            const meta = values[r][2] != null ? String(values[r][2]).trim() : '';
            if (!rawVal && !meta) continue;
            let ident = '';
            let label = '';
            if (meta && meta.includes(':')) {
              const idx = meta.indexOf(':');
              ident = meta.slice(0, idx).trim().toLowerCase();
              label = meta.slice(idx + 1).trim();
            } else {
              ident = (meta || '').trim().toLowerCase();
              label = '';
            }
            const typeClass = ident ? ` type-${ident}` : '';
            let href = rawVal;
            if (ident === 'tel') href = `tel:${rawVal}`;
            else if (ident === 'mail') href = `mailto:${rawVal}`;
            const openInNew = (ident === 'line' || ident === 'form' || ident === 'link');
            const targetAttr = openInNew ? ' target="_blank" rel="noopener noreferrer"' : '';
            const body = label || rawVal || '';
            const indexInList = chunks.length;
            const clickAttr = ` @click="onCtaClick($event, '${ident}', ${indexInList})"`;
            const html =
              `<div class="item${typeClass}">\n` +
              `  <a href="${href}"${targetAttr}${clickAttr}>\n` +
              `    <span class="item-body">${body}</span>\n` +
              `  </a>\n` +
              `</div>`;
            chunks.push(html);
          }
          itemsHtml = chunks.join('\n');
        }
      }
    } catch (e) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`contact items 構築失敗: ${e.message}`, 'getContactContents');
    }
    const titleHtml = title ? `<h2>${title}</h2>` : '';
    const messageHtml = message ? `<p class="message">${message}</p>` : '';
    const descriptionHtml = description ? `<p class="description">${description}</p>` : '';
    const replacements = { title: titleHtml, message: messageHtml, description: descriptionHtml, items: itemsHtml };
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

  /** faq */
  getFaqContents() {
    const template = this.getTemplateFile('components', 'faq');
    let replacements = {};
    if (typeof FaqInfo !== 'undefined' && typeof FaqInfo.getTemplateReplacements === 'function') {
      replacements = FaqInfo.getTemplateReplacements();
    } else {
      // フォールバック（最小限）
      const typeVal = String(Utils.getSheetValue('faq', 'type') || '').trim();
      const classes = typeVal ? `type-${typeVal}` : '';
      const desc = String(Utils.getSheetValue('faq', 'description') || '').trim();
      const descHtml = desc ? `<p class="description">${desc}</p>` : '';
      replacements = {
        section_title: Utils.getSheetValue('faq', 'section_title') || '',
        section_title_en: Utils.getSheetValue('faq', 'section_title_en') || '',
        description: descHtml,
        faq_classes: classes,
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
    const template = this.getTemplateFile('components', 'header');
    // 分離済み HeaderInfo を優先
    if (typeof HeaderInfo !== 'undefined' && typeof HeaderInfo.getTemplateReplacements === 'function') {
      return this.applyTagReplacements(template, HeaderInfo.getTemplateReplacements());
    }
    // フォールバック: 旧処理
    let navHtml = '';
    try { const items = this.getNavItemsFromSheet_(); navHtml = this.buildNavLis_(items); } catch (e) { if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`ヘッダーナビ生成失敗: ${e.message}`, 'getHeaderContents'); }
    const s = (typeof siteInfos !== 'undefined') ? siteInfos : {};
    const get = (k) => { if (s && s[k] != null && String(s[k]).trim() !== '') return String(s[k]); try { return String(Utils.getSheetValue('基本設定', k) || ''); } catch (_) { return ''; } };
    const logoUrl = get('logo_url') || '/images/logo.png';
    const contactUrl = get('contact_url') || '';
    const extRaw = get('contact_is_external');
    const isExternal = (function(v){ if (v == null) return false; if (typeof v === 'boolean') return v; if (typeof v === 'number') return v !== 0; const s2 = String(v).trim().toLowerCase(); return ['true','1','yes','y','on'].includes(s2); })(extRaw);
    const contactTarget = isExternal ? '_blank' : '_self';
    let headerContactHtml = '';
    try { const contactItems = this.getHeaderContactItemsFromContactSheet_(); headerContactHtml = this.buildHeaderContactLis_(contactItems); } catch (e) { if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`ヘッダー用contact生成失敗: ${e.message}`, 'getHeaderContents'); }
    return this.applyTagReplacements(template, { header_nav: navHtml, header_contact: headerContactHtml, logo_url: logoUrl, contact_url: contactUrl, contact_is_external: contactTarget });
  },

  /** footer */
  getFooterContents() {
    const template = this.getTemplateFile('components', 'footer');
    // 新: FooterInfo があれば優先利用
    if (typeof FooterInfo !== 'undefined' && typeof FooterInfo.getTemplateReplacements === 'function') {
      const baseRepl = FooterInfo.getTemplateReplacements();
      // ナビ生成（従来 Build 内ロジック再利用）
      let footerNavItems = [];
      let footerNavHtml = '';
      try { footerNavItems = this.getNavItemsFromSheet_(); footerNavHtml = this.buildNavLis_(footerNavItems); } catch (_) {}
      let footerSubNavItems = [];
      let footerSubNavHtml = '';
      try { footerSubNavItems = this.getFooterSubNavItems_(); footerSubNavHtml = this.buildNavLis_(footerSubNavItems); } catch (_) {}
      const truthy = (v) => {
        if (v == null) return false;
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return v !== 0;
        const s = String(v).trim().toLowerCase();
        return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on';
      };
      const mainShow = truthy(baseRepl.main_nav_show);
      const subShow  = truthy(baseRepl.sub_nav_show);
      baseRepl.footer_nav = footerNavHtml;
      baseRepl.footer_sub_nav = footerSubNavHtml;
      baseRepl.footer_nav_class = (!mainShow || footerNavItems.length === 0 ? 'hidden' : '');
      baseRepl.footer_sub_nav_class = (!subShow || footerSubNavItems.length === 0 ? 'hidden' : '');
      return this.applyTagReplacements(template, baseRepl);
    }
    // 旧: FooterInfo 無い場合のフォールバック
    const s = (typeof siteInfos !== 'undefined') ? siteInfos : {};
    const get = (k) => {
      if (s && s[k] != null && String(s[k]).trim() !== '') return String(s[k]);
      try { return String(Utils.getSheetValue('基本設定', k) || ''); } catch (_) { return ''; }
    };
    const getFooter = (k) => {
      try { const v = Utils.getSheetValue('footer', k); return (v != null && String(v).trim() !== '') ? String(v) : ''; } catch (_) { return ''; }
    };
    try {
      const bg = getFooter('bg_color');
      const tx = getFooter('text_color');
      if (typeof CommonInfo !== 'undefined' && CommonInfo.addColorVar) {
        if (bg) CommonInfo.addColorVar('--pcol-footer-bg-color', String(bg));
        if (tx) CommonInfo.addColorVar('--pcol-footer-text-color', String(tx));
      }
    } catch (_) {}
    let footerNavItems = [];
    let footerNavHtml = '';
    try { footerNavItems = this.getNavItemsFromSheet_(); footerNavHtml = this.buildNavLis_(footerNavItems); } catch (_) {}
    let footerSubNavItems = [];
    let footerSubNavHtml = '';
    try { footerSubNavItems = this.getFooterSubNavItems_(); footerSubNavHtml = this.buildNavLis_(footerSubNavItems); } catch (_) {}
    const truthy = (v) => {
      if (v == null) return false;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      const s2 = String(v).trim().toLowerCase();
      return s2 === 'true' || s2 === '1' || s2 === 'yes' || s2 === 'y' || s2 === 'on';
    };
    const mainNavShowRaw = getFooter('main_nav_show');
    const subNavShowRaw  = getFooter('sub_nav_show');
    const mainNavShow = truthy(mainNavShowRaw);
    const subNavShow  = truthy(subNavShowRaw);
    const replacements = {
      logo_url: (function(){ const v = getFooter('logo_url'); return v || get('logo_url'); })(),
      company_name: (function(){ const v = getFooter('company_name'); return v || get('company_name'); })(),
      address: (function(){ const v = getFooter('address'); return v || get('address'); })(),
      footer_nav: footerNavHtml,
      footer_sub_nav: footerSubNavHtml,
      footer_nav_class: (!mainNavShow || footerNavItems.length === 0 ? 'hidden' : ''),
      footer_sub_nav_class: (!subNavShow || footerSubNavItems.length === 0 ? 'hidden' : ''),
      copyright: (function(){
        const fv = getFooter('copyright'); if (fv) return fv;
        const fvs = getFooter('copyrights'); if (fvs) return fvs;
        const v = get('copyright'); if (v) return v;
        return get('copyrights');
      })(),
    };
    return this.applyTagReplacements(template, replacements);
  },

  /** message (旧 mission) */
  getMessageContents() {
    const template = this.getTemplateFile('components', 'message');
    let replacements = {};
    if (typeof MessageInfo !== 'undefined' && typeof MessageInfo.getTemplateReplacements === 'function') {
      replacements = MessageInfo.getTemplateReplacements();
      if (replacements['message_heading_text'] && !replacements['heading_text']) {
        replacements['heading_text'] = replacements['message_heading_text'];
      }
      if (replacements['message_intro_text'] && !replacements['intro_text']) {
        replacements['intro_text'] = replacements['message_intro_text'];
      }
      if (!('section_title_en' in replacements)) {
        replacements['section_title_en'] = Utils.getSheetValue('message', 'section_title_en') || '';
      }
    } else {
      replacements = {
        message_heading_text: Utils.getSheetValue('message', 'heading_text'),
        message_intro_text: Utils.getSheetValue('message', 'intro_text'),
        section_title_en: Utils.getSheetValue('message', 'section_title_en') || '',
      };
      replacements['heading_text'] = replacements['message_heading_text'];
      replacements['intro_text'] = replacements['message_intro_text'];
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

  // contact シートからヘッダー用のコンタクトリンク配列を取得
  // 形式: { order:number, ident:string, url:string, label:string, external:boolean }
  getHeaderContactItemsFromContactSheet_() {
    const items = [];
    try {
      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('contact');
      if (!sh) return items;
      const values = sh.getDataRange().getValues();
      if (!values || values.length === 0) return items;

      const a1 = (values[0][0] != null ? String(values[0][0]).trim().toLowerCase() : '');
      const b1 = (values[0][1] != null ? String(values[0][1]).trim().toLowerCase() : '');
      const hasHeader = (a1 === 'key' && (b1 === 'value' || b1 === 'val' || b1 === '値'));
      const startRow = hasHeader ? 1 : 0;
      for (let r = startRow; r < values.length; r++) {
        const key = values[r][0] != null ? String(values[r][0]).trim() : '';
        if (!/^item\d+$/i.test(key)) continue;
        const rawVal = values[r][1] != null ? String(values[r][1]).trim() : '';
        const meta = values[r][2] != null ? String(values[r][2]).trim() : '';
        if (!rawVal && !meta) continue;

        let ident = '';
        let label = '';
        if (meta && meta.includes(':')) {
          const idx = meta.indexOf(':');
          ident = meta.slice(0, idx).trim().toLowerCase();
          label = meta.slice(idx + 1).trim();
        } else {
          ident = (meta || '').trim().toLowerCase();
          label = '';
        }

        // href の決定
        let href = rawVal;
        if (ident === 'tel') href = `tel:${rawVal}`;
        else if (ident === 'mail') href = `mailto:${rawVal}`;

        // target 判定（contactコンポーネントと同仕様: line/form/link は新規タブ）
        const openInNew = (ident === 'line' || ident === 'form' || ident === 'link');

        const text = label || rawVal || '';
        items.push({ order: items.length + 1, ident, url: href, label: text, external: openInNew });
      }
    } catch (_) { /* noop */ }
    return items;
  },

  // ヘッダー用 contact 配列を <li>..</li> 群へ変換
  buildHeaderContactLis_(items) {
    if (!items || items.length === 0) return '';
    const esc = (s) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const lis = items.map(it => {
      const cls = esc(it.ident || '');
      const href = esc(it.url || '');
      const label = esc(it.label || '');
      const target = it.external ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<li class="type-${cls}"><a @click.prevent="onContactItemClick" href="${href}"${target}>${label}</a></li>`;
    });
    return lis.join('\n');
  },

  // footer シートからサブナビ (ftsub_nav_{n}_{url|label|external}) を取得
  getFooterSubNavItems_() {
    const out = [];
    const truthy = (v) => {
      if (v == null) return false;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      const s = String(v).trim().toLowerCase();
      return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on';
    };
    for (let i = 1; i <= 200; i++) {
      let url, label, ext;
      try { url = Utils.getSheetValue('footer', `ftsub_nav_${i}_url`); } catch (_) { url = ''; }
      try { label = Utils.getSheetValue('footer', `ftsub_nav_${i}_label`); } catch (_) { label = ''; }
      try { ext = Utils.getSheetValue('footer', `ftsub_nav_${i}_external`); } catch (_) { ext = ''; }
      const href = (url == null) ? '' : String(url).trim();
      const text = (label == null) ? '' : String(label).trim();
      if (!href || !text) continue;
      out.push({ order: i, url: href, label: text, external: truthy(ext) });
    }
    out.sort((a, b) => a.order - b.order);
    return out;
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
    // if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`OK: ${baseDir}/${filename}`, 'getTemplateFile');
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
  },

  /**
   * HTMLコメントを削除（ただし先頭が "SectionTitle:" のコメントは残す）
   * @param {string} html
   * @returns {string}
   */
  stripHtmlCommentsExceptSectionTitle_(html) {
    if (!html) return html;
    return String(html).replace(/<!--([\s\S]*?)-->/g, (m, body) => {
      const text = String(body).trim();
      if (/^SectionTitle:\s*/.test(text)) return m; // 残す
      return '';
    });
  }


}