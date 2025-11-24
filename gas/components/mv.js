// グローバル保持
var mv = mv || {};

var MvInfo = (function () {
	const SHEET_NAME            = 'mv';
	const PARAMETERS_SHEET_NAME = 'Parameters';
	const LOGS_SHEET_NAME       = 'Logs';

	// 直近 read() の行データ保持（record() で利用）
	let lastRows = [];

	// 純粋読み込み: シート→mv 更新 + 行配列返却
	function read() {
		// スナップショット経由のオーバーライド rows があればそれを利用
		const overrideRows = (typeof globalThis !== 'undefined' && globalThis.__snapshotOverrides && globalThis.__snapshotOverrides[SHEET_NAME]);
		let values;
		if (overrideRows) {
			values = overrideRows;
		} else {
			const ss = SpreadsheetApp.getActive();
			const sh = ss.getSheetByName(SHEET_NAME);
			if (!sh) throw new Error('「mv」シートが見つかりません。');
			values = sh.getDataRange().getValues();
		}
		if (!values || values.length === 0) return [];

		// 先頭行がヘッダーかどうか判定（A1=key, B1=value 系をヘッダーとみなす）
		const a1 = (values[0][0] != null ? String(values[0][0]).trim().toLowerCase() : '');
		const b1 = (values[0][1] != null ? String(values[0][1]).trim().toLowerCase() : '');
		const hasHeader = (a1 === 'key' && (b1 === 'value' || b1 === 'val' || b1 === '値'));

		const rows = [];
		const startRow = hasHeader ? 1 : 0;
		for (let r = startRow; r < values.length; r++) {
			const key  = values[r][0] ? String(values[r][0]).trim() : '';
			const val  = values[r][1] != null ? values[r][1] : '';
			const note = values[r][2] != null ? String(values[r][2]) : '';
			if (!key) continue;

			// グローバルに保存
			mv[key] = val;

			// Parameters へ渡す行（カテゴリは "mv" 固定）
			rows.push({ category: 'mv', key, value: val, note });
		}
		lastRows = rows.slice();
		return rows;
	}

	// Parameters 関連機能は廃止済み

	// 副作用部（現在は行データ結果整形のみ）
	function record() {
		// スナップショットオーバーライドがあり、まだ lastRows が空ならここでパース
		if ((!lastRows || lastRows.length === 0) && typeof globalThis !== 'undefined' && globalThis.__snapshotOverrides && globalThis.__snapshotOverrides[SHEET_NAME]) {
			try {
				const values = globalThis.__snapshotOverrides[SHEET_NAME];
				if (values && values.length) {
					const a1 = (values[0][0] != null ? String(values[0][0]).trim().toLowerCase() : '');
					const b1 = (values[0][1] != null ? String(values[0][1]).trim().toLowerCase() : '');
					const hasHeader = (a1 === 'key' && (b1 === 'value' || b1 === 'val' || b1 === '値'));
					const startRow = hasHeader ? 1 : 0;
					const rows = [];
					for (let r = startRow; r < values.length; r++) {
						const key  = values[r][0] ? String(values[r][0]).trim() : '';
						const val  = values[r][1] != null ? values[r][1] : '';
						const note = values[r][2] != null ? String(values[r][2]) : '';
						if (!key) continue;
						mv[key] = val;
						rows.push({ category: 'mv', key, value: val, note });
					}
					lastRows = rows.slice();
				}
			} catch (e) {
				if (typeof Utils?.logToSheet === 'function') Utils.logToSheet('mv snapshot再構築失敗: ' + e.message, 'MvInfo.record');
			}
		}
		const ok = Object.keys(mv || {}).length > 0;
		return { mv: JSON.parse(JSON.stringify(mv)), rows: lastRows.slice(), ok };
	}

	// テンプレ置換用: mv_<key> 形式のキーに変換して返却
	function getTemplateReplacements() {
		const out = {};
		Object.keys(mv).forEach(k => {
			out[`mv_${k}`] = mv[k];
		});
		return out;
	}

	function getAll() { return JSON.parse(JSON.stringify(mv)); }

	function getContents() {
		if (!Object.keys(mv).length) { try { read(); } catch (_) {} }
		let template;
		try {
			if (typeof Build !== 'undefined' && Build.getTemplateFile) {
				template = Build.getTemplateFile('components', 'mv');
			} else {
				template = getTemplateFileDirect_();
			}
		} catch (e) {
			if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`mv テンプレ取得失敗: ${e.message}`, 'MvInfo');
			return '';
		}
		const replacements = getTemplateReplacements();
		try {
			if (typeof Build !== 'undefined' && Build.applyTagReplacements) {
				return Build.applyTagReplacements(template, replacements);
			}
		} catch (_) {}
		return template.replace(/<\?=\s*([a-zA-Z0-9_]+)\s*\?>/g, function(m, k){ return (k in replacements) ? String(replacements[k]) : m; });
	}

	function getTemplateFileDirect_() {
		const rootId = Utils.getTemplateRootId_ && Utils.getTemplateRootId_();
		if (!rootId) throw new Error('テンプレートルートID未設定');
		const root = DriveApp.getFolderById(rootId);
		const compIt = root.getFoldersByName('components');
		if (!compIt.hasNext()) throw new Error('components フォルダが見つかりません');
		const comp = compIt.next();
		const files = comp.getFilesByName('mv.template.html');
		if (!files.hasNext()) throw new Error('mv.template.html が見つかりません');
		return files.next().getBlob().getDataAsString('UTF-8');
	}

	return {
		read,
		record,
		getTemplateReplacements,
		getAll,
		getContents,
	};
})();
