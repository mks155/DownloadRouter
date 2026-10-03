// ==UserScript==
// @name         下载路由 | Download Router
// @namespace    https://github.com/mks155
// @homepageURL  https://github.com/mks155/DownloadRouter
// @icon         https://mks155.github.io/assets/svg/downloadrouter.svg
// @version      1.0.2
// @description  接管浏览器任意下载链接，快速调起分发给迅雷 / 比特彗星等客户端。识别漏网就按住 Alt+右键。 | Take over any download link in the browser, quickly launch and distribute it to clients such as Thunderbolt / BitComet. To identify any missed links, hold down Alt and right-click.
// @author       mks155
// @license      MIT
// @match        *://*/*
// @run-at       document-idle
// @sandbox      raw
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_info
// @noframes
// @updateURL    https://openuserjs.org/meta/mks155/%E4%B8%8B%E8%BD%BD%E8%B7%AF%E7%94%B1_Download_Router.meta.js
// @downloadURL  https://openuserjs.org/install/mks155/%E4%B8%8B%E8%BD%BD%E8%B7%AF%E7%94%B1_Download_Router.user.js
// ==/UserScript==

(() => {
  'use strict';

  const LS_KEY = 'download_router_config';

  const META = (typeof GM_info !== 'undefined' && GM_info.script) || {};

  const DEFAULT_CONFIG = {
    launchMethod: 'href', // href | anchor
    forceOnAlt: true,
    theme: 'auto', // auto | light | dark
  };
  const LAUNCH_METHODS = { href: '地址栏', anchor: '链接触发' };
  const THEMES = {
    auto: { name: '跟随系统', desc: '按浏览器的深浅色设置自动切换' },
    light: { name: '浅色', desc: '始终用浅色菜单' },
    dark: { name: '深色', desc: '始终用深色菜单' },
  };

  const CONFIG = { ...DEFAULT_CONFIG, ...loadConfig() };
  if (!LAUNCH_METHODS[CONFIG.launchMethod]) CONFIG.launchMethod = 'href';
  if (!THEMES[CONFIG.theme]) CONFIG.theme = 'auto';

  function loadConfig() {
    try {
      return GM_getValue(LS_KEY, {}) || {};
    } catch {
      return {};
    }
  }

  function saveConfig() {
    try {
      GM_setValue(LS_KEY, CONFIG);
      return true;
    } catch {
      return false;
    }
  }

  // ── Base64 ────────────────────────────────────────────

  /** UTF-8 而非 btoa 直吃：URL 常含中文文件名 */
  function utf8ToBase64(str) {
    let bin = '';
    for (const b of new TextEncoder().encode(str)) bin += String.fromCharCode(b);
    return btoa(bin);
  }

  function base64ToUtf8(b64) {
    let s = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = s.length % 4;
    if (pad === 2) s += '==';
    else if (pad === 3) s += '=';
    else if (pad === 1) throw new Error('非法 base64');
    return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
  }

  // ── 下载器 ────────────────────────────────────────────

  const COMMON = /^(https?|ftp):/i;
  const NATIVE = /^(magnet|ed2k|thunder|thunderbolt|flashget|qqdl|ftp):/i;

  const HANDLERS = {
    thunder: {
      name: '迅雷',
      icon: 'data:image/png;base64,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',
      scheme: 'thunder://',
      passthrough: NATIVE,
      accept: COMMON,
      build: (url) => 'thunder://' + utf8ToBase64(`AA${url}ZZ`),
      parse: (link) => unwrap(base64ToUtf8(link.replace(/^thunder:\/\//i, '')), 'AA', 'ZZ'),
      hint: '安装迅雷 PC 客户端后自动可用',
    },
    bitcomet: {
      name: '比特彗星',
      icon: 'data:image/png;base64,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',
      scheme: 'bc://',
      passthrough: /^magnet:/i,
      accept: COMMON,
      /** &exec= 不能省，缺了客户端会弹「无法解析」 */
      build(url, filename) {
        const n = sanitizeName(filename);
        return (
          'bc://http/' +
          utf8ToBase64(
            `AA/${encodeURIComponent(n)}/?url=${encodeURIComponent(url)}&exec=${encodeURIComponent(n)}ZZ`
          )
        );
      },
      parse(link) {
        const m = link.match(/^bc:\/\/(?:http|bt)\/(.+)$/i);
        if (!m) return null;
        const text = base64ToUtf8(m[1]);
        const i = text.indexOf('/?url=');
        if (i === -1) return unwrap(text, 'AA', 'ZZ');
        const raw = text.slice(i + 6).replace(/&exec=[\s\S]*$/, '').replace(/ZZ$/, '');
        try {
          return decodeURIComponent(raw);
        } catch {
          return raw;
        }
      },
      hint: '安装比特彗星客户端后自动可用',
    },
  };

  const HANDLER_IDS = Object.keys(HANDLERS);

  function unwrap(text, head, tail) {
    if (text.startsWith(head) && text.endsWith(tail)) text = text.slice(head.length, -tail.length);
    text = text.trim();
    if (NATIVE.test(text)) return text;
    if (COMMON.test(text)) {
      try {
        new URL(text);
        return text;
      } catch {
        return null;
      }
    }
    return null;
  }

  const sanitizeName = (s) => String(s || '').replace(/[!?&|`"'*\/:<>\\]/g, '_');

  function buildLink(id, rawUrl, name = '') {
    const h = HANDLERS[id];
    const url = String(rawUrl).trim();
    if (!h || !url) return null;
    if (h.passthrough.test(url)) return url;
    if (!h.accept.test(url)) return null;
    return h.build(url, name || guessName(url));
  }

  function parseLink(id, link) {
    const h = HANDLERS[id];
    if (!h) return null;
    try {
      return h.parse(String(link));
    } catch {
      return null;
    }
  }

  /** 只判协议，不做编码，用于快速筛选 */
  function anyHandlerAccepts(url) {
    return HANDLER_IDS.some((id) => {
      const h = HANDLERS[id];
      return h.passthrough.test(url) || h.accept.test(url);
    });
  }

  // ── 链接识别 ──────────────────────────────────────────

  const RE_ARCHIVE = /\.(?:zip|rar|7z|tar|gz|tgz|bz2|xz|zst|apk|ipa|exe|msi|msix|msu|appx|dmg|pkg|deb|rpm|iso|img|bin|vhd|vhdx|ova|ovf|cab|jar|war|torrent|magnet|ed2k)(?:$|[?#])/i;
  const RE_DOC = /\.(?:pdf|epub|mobi|djvu|docx?|xlsx?|pptx?|csv|txt|rtf|chm)(?:$|[?#])/i;
  const RE_HINT = /[?&](?:download|dl|file|attachment|attach|filename)=|\/(?:download|downloads|down|dl|attachment|attachments|release[s]?\/download|files?)(?:[/?#]|$)/i;
  const RE_SCHEME = /^(?:https?|ftp|magnet|ed2k|thunder):/i;

  /** force=true 时跳过启发式判断，只看有没有下载器收得了 */
  function isDownloadLink(rawUrl, force = false) {
    if (!rawUrl) return false;
    const url = rawUrl.trim();
    if (!RE_SCHEME.test(url)) return false;
    if (force) return anyHandlerAccepts(url);
    if (/^(magnet|ed2k|thunder):/i.test(url)) return true;
    return RE_ARCHIVE.test(url) || RE_DOC.test(url) || RE_HINT.test(url);
  }

  function guessName(rawUrl) {
    try {
      const u = new URL(rawUrl, location.href);
      const seg = u.pathname.split('/').filter(Boolean).pop() || '';
      let name;
      try {
        name = decodeURIComponent(seg);
      } catch {
        name = seg;
      }
      if (name && /\.[a-z0-9]{1,8}$/i.test(name)) return name;
      for (const k of ['filename', 'file', 'name', 'title', 'fn']) {
        const v = u.searchParams.get(k);
        if (v) return v;
      }
      return (u.hostname + u.pathname).replace(/\/$/, '') || String(rawUrl);
    } catch {
      return String(rawUrl);
    }
  }

  // ── 唤起 ──────────────────────────────────────────────

  /** 唤起须在 click 同步栈内完成，否则 Chrome 判定为非用户手势而不放行 */
  function launch(rawUrl, id, name = '') {
    const link = buildLink(id, rawUrl, name);
    if (!link) return false;
    if (CONFIG.launchMethod === 'anchor') {
      const a = document.createElement('a');
      a.href = link;
      a.style.display = 'none';
      a.click();
      a.remove();
    } else {
      location.href = link;
    }
    return true;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      notify('已复制链接地址');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      notify(ok ? '已复制链接地址' : '复制失败，请手动复制', ok ? '' : 'err');
    }
  }

  // ── 配色（菜单与弹窗共用） ──────────────────────────────

  const THEME_VARS = `
:host {
  --bg:#fff; --fg:#1f2328; --border:#c8ced8; --sep:#e6e9ee; --tag:#7b8492;
  --dim:#9aa1ad; --dim-bg:#eef0f3; --dim-fg:#6b7280;
  --accent:#2f6fed; --btn-bg:#f7f8fa; --btn-fg:#1f2328;
  --shadow:0 8px 28px rgba(15,23,42,.18);
}
@media (prefers-color-scheme: dark) {
  :host:not([data-theme="light"]) {
    --bg:#1c1f26; --fg:#e6e9ef; --border:#454b5a; --sep:#333845; --tag:#98a0af;
    --dim:#6b7385; --dim-bg:#3a3f4d; --dim-fg:#a8b0c0;
    --accent:#4d8bff; --btn-bg:#272b35; --btn-fg:#e6e9ef;
    --shadow:0 8px 28px rgba(0,0,0,.5);
  }
}
:host([data-theme="dark"]) {
  --bg:#1c1f26; --fg:#e6e9ef; --border:#454b5a; --sep:#333845; --tag:#98a0af;
  --dim:#6b7385; --dim-bg:#3a3f4d; --dim-fg:#a8b0c0;
  --accent:#4d8bff; --btn-bg:#272b35; --btn-fg:#e6e9ef;
  --shadow:0 8px 28px rgba(0,0,0,.5);
}
:host([data-theme="light"]) {
  --bg:#fff; --fg:#1f2328; --border:#c8ced8; --sep:#e6e9ee; --tag:#7b8492;
  --dim:#9aa1ad; --dim-bg:#eef0f3; --dim-fg:#6b7280;
  --accent:#2f6fed; --btn-bg:#f7f8fa; --btn-fg:#1f2328;
  --shadow:0 8px 28px rgba(15,23,42,.18);
}
`;

  // ── 页面内轻提示 ──────────────────────────────────────

  const TOAST_CSS = `
:host { all: initial }
* { box-sizing:border-box; font-family:-apple-system, "Segoe UI", "Microsoft YaHei", sans-serif }
${THEME_VARS}
.box {
  position:fixed; right:16px; bottom:16px; z-index:2147483647;
  display:flex; flex-direction:column; align-items:flex-end; gap:8px;
  pointer-events:none; max-width:min(340px, calc(100vw - 32px));
}
.t {
  display:flex; align-items:flex-start; gap:8px;
  padding:9px 13px; border-radius:9px; border:1px solid var(--border);
  background:var(--bg); box-shadow:var(--shadow); color:var(--fg);
  font-size:12.5px; line-height:1.5; word-break:break-word;
  animation:tin .16s ease-out;
}
.t .dot { flex:none; width:7px; height:7px; margin-top:5px; border-radius:50%; background:var(--accent) }
.t.ok  { border-color:#2f9e68 } .t.ok .dot  { background:#2f9e68 }
.t.err { border-color:#d3453b } .t.err .dot { background:#d3453b }
.t.out { animation:tout .16s ease-in forwards }
@keyframes tin  { from { opacity:0; transform:translateY(6px) } }
@keyframes tout { to   { opacity:0; transform:translateY(4px) } }
@media (prefers-reduced-motion: reduce) { .t, .t.out { animation:none } }
`;

  let toastHost = null;
  let toastBox = null;

  function notify(text, kind = '') {
    console.info(`[下载路由] ${text}`);
    if (!document.body) return;
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.style.cssText = 'all:initial;position:fixed;z-index:2147483647;';
      const shadow = toastHost.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = TOAST_CSS;
      toastBox = document.createElement('div');
      toastBox.className = 'box';
      shadow.append(style, toastBox);
      document.body.appendChild(toastHost);
    }
    if (CONFIG.theme !== 'auto') toastHost.setAttribute('data-theme', CONFIG.theme);

    const el = document.createElement('div');
    el.className = kind ? 't ' + kind : 't';
    const dot = document.createElement('span');
    dot.className = 'dot';
    const tx = document.createElement('span');
    tx.textContent = text;
    el.append(dot, tx);
    toastBox.appendChild(el);
    while (toastBox.childElementCount > 3) toastBox.firstElementChild.remove();

    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, kind === 'err' ? 5000 : 2600);
  }

  // ── 右键菜单 ──────────────────────────────────────────

  const CTX_CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; }
${THEME_VARS}
.ctx {
  position:fixed; display:none; z-index:2147483647;
  min-width:184px; padding:4px;
  background:var(--bg); border:1px solid var(--border); border-radius:8px;
  box-shadow:var(--shadow); color-scheme:light dark;
}
.ctx.show { display:block }
.ctx .mi {
  display:flex; align-items:center; gap:7px;
  padding:7px 10px; font-size:12px; color:var(--fg);
  cursor:pointer; border-radius:5px; white-space:nowrap;
}
.ctx .mi .ic { flex:none; width:15px; height:15px; border-radius:2px; object-fit:contain }
.ctx .mi.dim .ic { opacity:.42; filter:grayscale(1) }
.ctx .mi:hover { background:var(--accent); color:#fff }
.ctx .mi.dim { color:var(--dim) }
.ctx .mi.dim:hover { background:var(--dim-bg); color:var(--dim-fg) }
.ctx .sep { height:1px; background:var(--sep); margin:4px 2px }
.ctx .tag {
  padding:6px 10px 4px; font-size:10px; color:var(--tag);
  letter-spacing:.06em; text-transform:uppercase; user-select:none;
}
`;

  let ctxHost = null;
  let ctxUrl = '';
  let ctxName = '';

  function buildCtxItems(url, name, force) {
    const isBt = /^(magnet|ed2k|thunder):/i.test(url);
    const rows = [];
    let usable = false;

    for (const id of HANDLER_IDS) {
      const h = HANDLERS[id];
      const ok = buildLink(id, url, name) !== null;
      if (ok) usable = true;
      if (!ok && !force) continue;
      const title = ok
        ? isBt
          ? '透传原始协议，由系统默认的 BT/磁力处理器接手'
          : `${h.scheme} · ${h.hint}`
        : `${h.name}不收这个协议，点了会提示失败`;
      rows.push(
        `<div class="mi${ok ? '' : ' dim'}" data-h="${id}" title="${esc(title)}">` +
          `<img class="ic" src="${h.icon}" alt="">${h.name}下载</div>`
      );
    }
    if (!usable) return null;

    return `<div class="ctx">
  <div class="tag">${force ? '强制交给下载器（Alt）' : '交给下载器'}</div>
  ${rows.join('\n  ')}
  <div class="sep"></div>
  <div class="mi" data-mi="link">复制链接地址</div>
  <div class="mi" data-mi="settings">设置</div>
</div>`;
  }

  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function mountCtx(x, y, url, name, force) {
    const html = buildCtxItems(url, name, force);
    if (!html) return;
    unmountCtx();

    ctxHost = document.createElement('div');
    ctxHost.style.cssText = 'all:initial;position:fixed;z-index:2147483647;';
    if (CONFIG.theme !== 'auto') ctxHost.setAttribute('data-theme', CONFIG.theme);
    const shadow = ctxHost.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CTX_CSS;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    shadow.append(style, wrap);
    ctxHost.addEventListener('click', onCtxClick);
    (document.body || document.documentElement).appendChild(ctxHost);

    ctxUrl = url;
    ctxName = name;
    const el = shadow.querySelector('.ctx');
    el.classList.add('show');
    // 先入 DOM 再量，否则尺寸为 0
    el.style.left = `${Math.min(Math.max(4, x), innerWidth - el.offsetWidth - 8)}px`;
    el.style.top = `${Math.min(Math.max(4, y), innerHeight - el.offsetHeight - 8)}px`;
  }

  function unmountCtx() {
    ctxHost?.remove();
    ctxHost = null;
    ctxUrl = '';
  }

  function onCtxClick(e) {
    /** 事件穿出 Shadow DOM 后 e.target 被 retarget 成 host，只能走 composedPath */
    const item = e.composedPath().find((el) => el && el.dataset && (el.dataset.h || el.dataset.mi));
    if (!item || !ctxUrl) return unmountCtx();
    const url = ctxUrl;
    if (item.dataset.h) {
      const id = item.dataset.h;
      const ok = launch(url, id, ctxName);
      unmountCtx();
      if (!ok) notify(`${HANDLERS[id].name}不收这个协议，换一个下载器试试`, 'err');
      return;
    }
    unmountCtx();
    if (item.dataset.mi === 'settings') openSettings();
    else copyText(url);
  }

  function safeHref(el) {
    try {
      return el.href;
    } catch {
      return '';
    }
  }

  document.addEventListener(
    'contextmenu',
    (e) => {
      const a = e.target.closest && e.target.closest('a[href], area[href]');
      const url = a ? safeHref(a) : '';
      const force = CONFIG.forceOnAlt && e.altKey;
      if (!url || !isDownloadLink(url, force)) return unmountCtx();
      e.preventDefault();
      e.stopPropagation();
      mountCtx(e.clientX, e.clientY, url, guessName(url), force);
    },
    true
  );

  document.addEventListener(
    'mousedown',
    (e) => {
      if (ctxHost && !e.composedPath().includes(ctxHost)) unmountCtx();
    },
    true
  );
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') unmountCtx();
  });
  addEventListener('scroll', unmountCtx, { passive: true, capture: true });
  addEventListener('resize', unmountCtx, { passive: true });

  // ── 设置弹窗 ──────────────────────────────────────────

  const PANEL_CSS = `
:host { all: initial }
* { box-sizing:border-box; font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif }
${THEME_VARS}
.backdrop {
  position:fixed; inset:0; z-index:2147483645;
  background:rgba(15,23,42,.35); display:flex;
  align-items:center; justify-content:center;
}
.panel {
  width:340px; max-width:calc(100vw - 32px); max-height:calc(100vh - 64px);
  overflow-y:auto;
  background:var(--bg); color:var(--fg);
  border:1px solid var(--border); border-radius:12px;
  box-shadow:var(--shadow); padding:16px 18px 14px;
  color-scheme:light dark;
}
.hd { display:flex; align-items:center; gap:9px; margin-bottom:14px }
.hd .logo { width:26px; height:26px; flex:none; display:block }
.hd b { flex:1; font-size:15px; font-weight:600 }
.hd .v { font-size:11px; color:var(--tag) }
.field { margin-bottom:14px }
.field > label { display:block; font-size:12px; color:var(--tag); margin-bottom:5px }
.field select {
  display:block; width:100%; padding:9px 11px;
  font-size:13px; font-family:inherit;
  color:var(--fg); background:var(--btn-bg);
  border:1px solid var(--border); border-radius:7px; outline:none;
  -webkit-appearance:none; appearance:none;
  background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),
                   linear-gradient(135deg,currentColor 50%,transparent 50%);
  background-position:calc(100% - 17px) 50%, calc(100% - 12px) 50%;
  background-size:5px 5px, 5px 5px;
  background-repeat:no-repeat; cursor:pointer;
}
.field select:hover { border-color:var(--accent) }
.field select:focus { border-color:var(--accent); box-shadow:0 0 0 3px rgba(47,111,237,.18) }
.field .tip { margin-top:5px; font-size:11px; color:var(--tag); line-height:1.5 }
.row {
  display:flex; align-items:flex-start; gap:9px;
  padding:10px; margin:0 -10px;
  border-top:1px solid var(--sep); border-radius:6px;
  font-size:13px; cursor:pointer;
}
.row:hover { background:var(--btn-bg) }
.row input { flex:none; margin-top:1px; width:15px; height:15px; accent-color:var(--accent); cursor:pointer }
.row .txt b { display:block; font-weight:500 }
.row .txt span { display:block; font-size:11px; color:var(--tag); margin-top:2px; line-height:1.5 }
.keys {
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  border-top:1px solid var(--sep); padding-top:10px; margin-top:4px;
  font-size:11px; color:var(--tag);
}
.keys .kb { display:inline-flex; align-items:center; gap:5px }
.keys .ic { width:14px; height:14px; border-radius:2px; object-fit:contain }
.actions { display:flex; gap:8px; margin-top:14px }
.actions button {
  flex:1; padding:9px 0; font-size:13px; font-family:inherit;
  border-radius:6px; border:1px solid var(--border);
  background:var(--btn-bg); color:var(--btn-fg); cursor:pointer;
}
.actions button.primary { border-color:var(--accent); background:var(--accent); color:#fff; font-weight:600 }
.actions button.primary:hover { filter:brightness(1.1) }
.actions button:not(.primary):hover { border-color:var(--accent); color:var(--accent) }
.foot {
  margin-top:14px; padding-top:10px; border-top:1px solid var(--sep);
  text-align:center; font-size:11px; color:var(--tag); line-height:1.7;
}
.foot a { color:var(--accent); text-decoration:underline; text-underline-offset:2px; font-weight:500 }
.foot a:hover { text-decoration-thickness:2px }
.foot .star {
  display:inline-flex; align-items:center; gap:5px;
  margin-bottom:7px; padding:3px 10px; border-radius:999px;
  border:1px solid var(--border); color:var(--fg);
  font-size:11px; font-weight:500; text-decoration:none;
  transition:border-color .15s, color .15s;
}
.foot .star:hover { border-color:var(--accent); color:var(--accent) }
.foot .star svg { color:#e0a92e }
`;

  let panelHost = null;

  function openSettings() {
    unmountCtx();
    if (panelHost) return unmountSettings();

    panelHost = document.createElement('div');
    panelHost.style.cssText = 'all:initial;position:fixed;z-index:2147483645;';
    if (CONFIG.theme !== 'auto') panelHost.setAttribute('data-theme', CONFIG.theme);
    const shadow = panelHost.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = PANEL_CSS;
    const wrap = document.createElement('div');
    wrap.innerHTML = settingsHtml();
    shadow.append(style, wrap);
    (document.body || document.documentElement).appendChild(panelHost);

    const backdrop = shadow.querySelector('.backdrop');
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) unmountSettings();
    });
    shadow.querySelector('#dr-close').addEventListener('click', unmountSettings);
    shadow.querySelector('#dr-star').addEventListener('click', () => notify('已在新标签打开仓库，感谢 Star'));
    shadow.querySelector('#dr-save').addEventListener('click', () => {
      CONFIG.launchMethod = shadow.querySelector('#dr-method').value;
      CONFIG.theme = shadow.querySelector('#dr-theme').value;
      CONFIG.forceOnAlt = shadow.querySelector('#dr-alt').checked;
      const ok = saveConfig();
      unmountSettings();
      registerMenus();
      notify(ok ? '设置已保存' : '保存失败，请检查脚本存储权限', ok ? 'ok' : 'err');
    });
    return undefined;
  }

  function unmountSettings() {
    panelHost?.remove();
    panelHost = null;
  }

  function settingsHtml() {
    const opt = (map, cur) =>
      Object.entries(map)
        .map(
          ([v, m]) =>
            `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(typeof m === 'string' ? m : m.name)}</option>`
        )
        .join('');

    const themeTip = {
      auto: '跟随操作系统的深浅色设置',
      light: '强制浅色，适合深色网页',
      dark: '强制深色，适合浅色网页',
    }[CONFIG.theme];

    return `<div class="backdrop">
  <div class="panel">
    <div class="hd">
      <img class="logo" src="${esc(META.icon || '')}" alt="">
      <b>下载路由</b><span class="v">v${esc(META.version || '')}</span>
    </div>

    <div class="field">
      <label for="dr-method">唤起方式</label>
      <select id="dr-method">${opt(LAUNCH_METHODS, CONFIG.launchMethod)}</select>
      <div class="tip">当前方式失效时，切换另外一个方式再试。</div>
    </div>

    <div class="field">
      <label for="dr-theme">菜单配色</label>
      <select id="dr-theme">${opt(THEMES, CONFIG.theme)}</select>
      <div class="tip">${esc(themeTip)}</div>
    </div>

    <label class="row">
      <input type="checkbox" id="dr-alt"${CONFIG.forceOnAlt ? ' checked' : ''}>
      <span class="txt"><b>Alt + 右键强制唤起</b><span>识别漏网时，按住 Alt 右键任意链接都能唤起下载器</span></span>
    </label>

    <div class="keys">
      支持：${HANDLER_IDS.map((id) => `<span class="kb"><img class="ic" src="${HANDLERS[id].icon}" alt="">${esc(HANDLERS[id].name)}</span>`).join('')}
    </div>

    <div class="actions">
      <button type="button" id="dr-close">取消</button>
      <button type="button" id="dr-save" class="primary">保存</button>
    </div>

    <div class="foot">
      <a class="star" id="dr-star" href="https://github.com/mks155/DownloadRouter" target="_blank" rel="noopener"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M8 .3l2.06 4.18 4.61.67-3.33 3.25.78 4.6L8 10.79 3.88 12.99l.79-4.6L1.33 5.15l4.61-.67z"/></svg>欢迎 Star</a>
      <div>Powered by <a href="https://mks155.github.io/" target="_blank" rel="noopener">mks155</a></div>
    </div>
  </div>
</div>`;
  }

  // ── 油猴菜单 ──────────────────────────────────────────

  const menuIds = [];

  function registerMenus() {
    for (const id of menuIds) {
      try {
        GM_unregisterMenuCommand(id);
      } catch {
        /* ignore */
      }
    }
    menuIds.length = 0;
    try {
      menuIds.push(
        GM_registerMenuCommand(
          `设置：${LAUNCH_METHODS[CONFIG.launchMethod]} · ${THEMES[CONFIG.theme].name}`,
          openSettings
        )
      );
    } catch {
      /* ignore */
    }
  }

  /** 协议编码自检，按需调用，不在每次页面加载时执行 */
  function selftest() {
    const cases = [
      { id: 'thunder', raw: 'http://d3.7-zip.org/a/7z-2107-x64.exe',
        expect: 'thunder://QUFodHRwOi8vZDMuNy16aXAub3JnL2EvN3otMjEwNy14NjQuZXhlWlo=' },
      { id: 'thunder', raw: 'magnet:?xt=urn:btih:abcdef', expect: 'magnet:?xt=urn:btih:abcdef' },
      { id: 'thunder', raw: 'ed2k://|file|a.zip|100|H|/', expect: 'ed2k://|file|a.zip|100|H|/' },
      { id: 'thunder', raw: 'javascript:alert(1)', expect: null },
      { id: 'thunder', raw: 'file:///C:/Windows/System32/cmd.exe', expect: null },
      { id: 'bitcomet', raw: 'magnet:?xt=urn:btih:abcdef', expect: 'magnet:?xt=urn:btih:abcdef' },
      { id: 'bitcomet', raw: 'http://download.bitcomet.com/bitcomet/bitcomet_plugin_setup.exe',
        payload: 'AA/bitcomet_plugin_setup.exe/?url=http%3A%2F%2Fdownload.bitcomet.com%2F' +
                 'bitcomet%2Fbitcomet_plugin_setup.exe&exec=bitcomet_plugin_setup.exeZZ' },
      { id: 'bitcomet', raw: 'ed2k://|file|a.zip|100|H|/', expect: null },
    ];
    const bad = [];
    for (const c of cases) {
      const got = buildLink(c.id, c.raw);
      if ('expect' in c && got !== c.expect) bad.push({ raw: c.raw, got });
      if (c.payload) {
        const payload = base64ToUtf8(got.slice(got.indexOf('/', got.indexOf('//') + 2) + 1));
        if (payload !== c.payload) bad.push({ raw: c.raw, want: c.payload, got: payload });
      }
      if (got && /^(thunder|bc):\/\//.test(got) && parseLink(c.id, got) !== c.raw) {
        bad.push({ raw: c.raw, roundTrip: parseLink(c.id, got) });
      }
    }
    if (bad.length) console.warn('[下载路由] 编码自检未通过：', bad);
    else console.info('[下载路由] 编码自检通过');
    return bad;
  }

  // ── 启动 ──────────────────────────────────────────────

  registerMenus();

  window.__downloadRouter = {
    HANDLERS, CONFIG, META, buildLink, parseLink, launch,
    isDownloadLink, guessName, openSettings, selftest,
  };
})();