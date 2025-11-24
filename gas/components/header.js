// header セクション用ロジック分離
// グローバル保持（他コンポーネントと同様のパターン）
var header = header || {};
// 互換エイリアス（旧 headerInfo 参照があっても壊さない）
var headerInfo = header;

var HeaderInfo = (function () {
    let lastRows = [];
  // 依存: siteInfos (CommonInfo.readAndRecordBasicSettings 実行後)、nav シート、contact シート

  // nav シートからヘッダーナビ項目取得 (nav_{n}_url / nav_{n}_label / nav_{n}_external)
  function readNavItems_() {
    const out = [];
    const truthy = (v) => {
      if (v == null) return false;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      const s = String(v).trim().toLowerCase();
      return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on';
    };
    try {
      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('nav');
      if (!sh) return out;
      const values = sh.getDataRange().getValues();
      if (!values || values.length === 0) return out;
      for (let i = 1; i <= 200; i++) {
        const url = getNavValue_(values, `nav_${i}_url`);
        const label = getNavValue_(values, `nav_${i}_label`);
        const ext = getNavValue_(values, `nav_${i}_external`);
        const href = (url == null) ? '' : String(url).trim();
        const text = (label == null) ? '' : String(label).trim();
        if (!href || !text) continue;
        out.push({ order: i, url: href, label: text, external: truthy(ext) });
      }
      out.sort((a, b) => a.order - b.order);
    } catch (e) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`header nav取得失敗: ${e.message}`, 'HeaderInfo');
    }
    return out;
  }

  function getNavValue_(values, key) {
    // シート構造: A=key, B=value, C=note （ヘッダーが key/value かどうかは柔軟に対応）
    for (let r = 0; r < values.length; r++) {
      const k = values[r][0] != null ? String(values[r][0]).trim() : '';
      if (k === key) return values[r][1];
    }
    return null;
  }

  // contact シートからヘッダー用コンタクトリンク群を取得
  function readHeaderContactItems_() {
    const items = [];
    const truthy = (v) => {
      if (v == null) return false;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      const s = String(v).trim().toLowerCase();
      return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on';
    };
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
        let href = rawVal;
        if (ident === 'tel') href = `tel:${rawVal}`;
        else if (ident === 'mail') href = `mailto:${rawVal}`;
        const external = truthy(values[r][3]) || ['line','form','link'].includes(ident);
        items.push({ order: items.length + 1, ident, url: href, label: (label || rawVal), external });
      }
    } catch (e) {
      if (typeof Utils?.logToSheet === 'function') Utils.logToSheet(`header contact取得失敗: ${e.message}`, 'HeaderInfo');
    }
    return items;
  }

  function buildNavLis_(items) {
    if (!items || items.length === 0) return '';
    const esc = (s) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    return items.map(it => {
      const href = esc(it.url);
      const label = esc(it.label);
      const isAnchor = href.startsWith('#');
      const target = (it.external && !isAnchor) ? ' target="_blank"' : '';
      return `<li><a @click.prevent="onItemClick" href="${href}"${target}>${label}</a></li>`;
    }).join('\n');
  }

  function buildHeaderContactLis_(items) {
    if (!items || items.length === 0) return '';
    const esc = (s) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    return items.map(it => {
      const cls = esc(it.ident || '');
      const href = esc(it.url || '');
      const label = esc(it.label || '');
      const target = it.external ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<li class="type-${cls}"><a @click.prevent="onContactItemClick" href="${href}"${target}>${label}</a></li>`;
    }).join('\n');
  }

  // 純粋な読み込み処理（グローバル header へ保存）
  function read() {
    const s = (typeof siteInfos !== 'undefined') ? siteInfos : {};
    const get = (k) => (s && s[k] != null && String(s[k]).trim() !== '') ? String(s[k]).trim() : '';
    header.logo_url = get('logo_url') || '/images/logo.png';
    header.contact_url = get('contact_url') || '';
    const extRaw = get('contact_is_external');
    header.contact_is_external = (function(v){
      if (v == null) return false;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      const s2 = String(v).trim().toLowerCase();
      return ['true','1','yes','y','on'].includes(s2);
    })(extRaw) ? '_blank' : '_self';
    header.navItems = readNavItems_();
    header.contactItems = readHeaderContactItems_();
    // rows/ok を他コンポーネント形式に合わせた形で返却
    const ok = (header.navItems && header.navItems.length > 0) || (header.contactItems && header.contactItems.length > 0) || !!header.logo_url;
    lastRows = [];
    return { header: JSON.parse(JSON.stringify(header)), rows: [], ok };
  }

  function record() {
    const ok = (header.navItems && header.navItems.length > 0) || (header.contactItems && header.contactItems.length > 0) || !!header.logo_url;
    return { header: JSON.parse(JSON.stringify(header)), rows: lastRows.slice(), ok };
  }

  function getTemplateReplacements() {
    // 必要なら事前読込
    if (!header.navItems || !header.contactItems || !header.logo_url) {
      read();
    }
    return {
      header_nav: buildNavLis_(header.navItems),
      header_contact: buildHeaderContactLis_(header.contactItems),
      logo_url: header.logo_url,
      contact_url: header.contact_url,
      contact_is_external: header.contact_is_external,
    };
  }

  function getAll() {
    return JSON.parse(JSON.stringify(header));
  }

  return {
    read,
    record,
    getTemplateReplacements,
    getAll,
    readNavItems_: readNavItems_,
    readHeaderContactItems_: readHeaderContactItems_,
    buildNavLis_: buildNavLis_,
    buildHeaderContactLis_: buildHeaderContactLis_,
  };
})();
