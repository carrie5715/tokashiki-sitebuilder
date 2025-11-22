const Utils = {

  /**
   * Logsシートにログを追加し、最新30件だけ残す
   * @param {string} message - ログメッセージ
   * @param {string} [funcName] - 関数名（不要なら省略）
   */
  logToSheet(message, funcName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = 'Logs';
    
    // Logsシートがなければ作成（初期レイアウト設定もここで）
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['Time', 'Function', 'Message']); // ヘッダー行

      // 列幅設定（A列=140, B列=140, C列=720）
      sheet.setColumnWidths(1, 1, 140); // A
      sheet.setColumnWidths(2, 1, 140); // B
      sheet.setColumnWidths(3, 1, 720); // C

      // ヘッダー以外のA列・B列を中央寄せ（初期状態では空なので全体に設定しておく）
      sheet.getRange('A2:B').setHorizontalAlignment('center');
    }

    // ログ行を追加
    sheet.appendRow([new Date(), funcName || '', message]);

    // 行数制限（最新20件 + ヘッダー）
    const lastRow = sheet.getLastRow();
    if (lastRow > 20) {
      const extra = lastRow - 20;
      sheet.deleteRows(2, extra);
    }
  },
  
  /**
   * Parameters / Logs シートを末尾に配置しタブ色をオレンジ (#FFA500) に統一する。
   * 既に存在する場合は移動と色設定のみ。内容は変更しない。
   */
  ensureUtilitySheets() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ORANGE = '#FFA500';
    const sheetNames = ['Parameters', 'Logs'];

    sheetNames.forEach(name => {
      let sheet = ss.getSheetByName(name);
      if (!sheet) {
        sheet = ss.insertSheet(name);
      }
      // タブ色設定（失敗は無視）
      try { sheet.setTabColor(ORANGE); } catch (e) {}
      // 末尾へ移動（既に末尾なら何もしない）
      try {
        if (sheet.getIndex() !== ss.getSheets().length) {
          ss.setActiveSheet(sheet);
          ss.moveActiveSheet(ss.getSheets().length);
        }
      } catch (e) {}
    });
  },

  /**
   * 親フォルダ取得（スプレッドシートが入ってるフォルダ）
   */
  getParentFolder_() {
    const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
    const file = DriveApp.getFileById(ssId);
    const it = file.getParents();
    return it.hasNext() ? it.next() : null;
  },

  /**
   * 子フォルダ取得 or 作成（同名が複数あれば最初の1つを採用）
   */
  getOrCreateSubFolder_(parentFolder, name) {
    const it = parentFolder.getFoldersByName(name);
    if (it.hasNext()) return it.next();
    return parentFolder.createFolder(name);
  },

  /**
   * 指定シートの A列から key を探し、同じ行の B列の値を返す
   * @param {string} sheetName - シート名
   * @param {string} key - 探すキー（A列の文字列）
   * @return {string|null} 見つかれば B列の値、なければ null
   */
  getSheetValue(sheetName, key) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) throw new Error("シートが見つかりません: " + sheetName);

    var lastRow = sheet.getLastRow();
    if (lastRow < 1) return null;

    // A列とB列をまとめて取得
    var values = sheet.getRange(1, 1, lastRow, 2).getValues();

    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === key) {
        return values[i][1]; // B列
      }
    }

    return null; // 見つからなかった場合
  },

  /**
   * 指定フォルダをZIP化してDriveに保存する
   * @param {string} folderId - 圧縮対象のフォルダID
   * @param {string} zipName  - 出力するzipファイル名
   * @return {GoogleAppsScript.Drive.File} 作成されたzipファイル
   */
  zipFolder(folderId, zipName) {
    const folder = DriveApp.getFolderById(folderId);
    const blobs = [];

    // フォルダ直下のファイルを全部まとめる（サブフォルダは別処理が必要）
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      blobs.push(file.getBlob().setName(file.getName())); 
    }

    // zip化して保存
    const zip = Utilities.zip(blobs, zipName + ".zip");
    const saved = DriveApp.createFile(zip);
    return saved;
  }

  ,
  /**
   * テンプレートルートのフォルダIDを解決して返す。
   * 優先度: ScriptProperties.TEMPLATE_ROOT_ID → siteInfos.template_root_id → 基本設定!template_root_id → DRIVE_FILES.TEMPLATE_ROOT
   * 見つかった値は ScriptProperties に保存（キャッシュ）します。
   * @return {string} フォルダID
   */
  getTemplateRootId_() {
    try {
      const props = PropertiesService.getScriptProperties();
      const fromProp = props.getProperty('TEMPLATE_ROOT_ID');
      if (fromProp && String(fromProp).trim() !== '') return String(fromProp).trim();

      // グローバル siteInfos にあれば利用
      if (typeof siteInfos !== 'undefined' && siteInfos && siteInfos.template_root_id) {
        const v = String(siteInfos.template_root_id).trim();
        if (v) {
          props.setProperty('TEMPLATE_ROOT_ID', v);
          return v;
        }
      }

      // 基本設定シートの template_root_id
      try {
        const fromSheet = this.getSheetValue('基本設定', 'template_root_id');
        if (fromSheet && String(fromSheet).trim() !== '') {
          const v = String(fromSheet).trim();
          props.setProperty('TEMPLATE_ROOT_ID', v);
          return v;
        }
      } catch (e) {
        // 無視（シートが無い/キーが無い等）
      }

      // 最後に定数のフォールバック
      if (typeof DRIVE_FILES !== 'undefined' && DRIVE_FILES.TEMPLATE_ROOT) {
        return String(DRIVE_FILES.TEMPLATE_ROOT).trim();
      }
    } catch (e) {
      // noop
    }

    throw new Error('テンプレートルートIDが特定できません（ScriptProperties / 基本設定 / 定数のいずれにも存在しません）。');
  }


}