'use strict';
/* ---------- Mehrsprachigkeit ----------
   Deutsch ist die Quellsprache. Alle Texte im DOM werden automatisch übersetzt
   (auch später eingefügte); Canvas-Texte laufen über I18N.t(). */
const I18N = (() => {
  const LANGS = {
    de: { name: 'Deutsch', locale: 'de-DE', dec: ',' },
    en: { name: 'English', locale: 'en-US', dec: '.' },
    es: { name: 'Español', locale: 'es-ES', dec: ',' },
    fr: { name: 'Français', locale: 'fr-FR', dec: ',' },
    tr: { name: 'Türkçe', locale: 'tr-TR', dec: ',' },
  };
  const ORDER = ['de', 'en', 'es', 'fr', 'tr'];
  const tables = {};
  const LETTER = /[A-Za-zÀ-ÿĞğİıŞş]/;
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Wörterbücher aufbauen: exakte Treffer + Muster mit Platzhaltern
  ORDER.slice(1).forEach((code, i) => {
    const exact = new Map(), patterns = [];
    for (const row of I18N_ROWS) {
      const src = row[0], dst = row[i + 1];
      if (dst == null) continue;
      if (/\{\d\}/.test(src)) {
        const re = new RegExp('^' + esc(src).replace(/\\\{(\d)\\\}/g, '(.+?)') + '$');
        const order = [...src.matchAll(/\{(\d)\}/g)].map(m => +m[1]);
        patterns.push({ re, dst, order, weight: src.replace(/\{\d\}/g, '').length });
      } else exact.set(src, dst);
    }
    patterns.sort((a, b) => b.weight - a.weight);
    tables[code] = { exact, patterns };
  });

  function detect() {
    const n = (navigator.language || 'de').slice(0, 2).toLowerCase();
    return LANGS[n] ? n : 'de';
  }
  let lang = (Store.s.lang && LANGS[Store.s.lang]) ? Store.s.lang : detect();
  const listeners = [];

  function translate(core) {
    if (lang === 'de') return core;
    const T = tables[lang];
    const hit = T.exact.get(core);
    if (hit != null) return hit;
    for (const p of T.patterns) {
      const m = core.match(p.re);
      if (m) {
        const args = {};
        p.order.forEach((n, k) => { const a = m[k + 1]; args[n] = T.exact.get(a) ?? a; });
        return p.dst.replace(/\{(\d)\}/g, (_, n) => args[n] ?? '');
      }
    }
    return core;
  }
  function trRaw(raw) {
    if (!raw || !LETTER.test(raw)) return raw;
    const m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const out = translate(m[2]);
    return out === m[2] ? raw : m[1] + out + m[3];
  }

  // Text in Code: Quelle mit Platzhaltern übersetzen und füllen
  function t(src, ...args) {
    let s = src;
    if (lang !== 'de') { const T = tables[lang]; const hit = T.exact.get(src); if (hit != null) s = hit; }
    return args.length ? s.replace(/\{(\d)\}/g, (_, n) => args[n] ?? '') : s;
  }

  /* ---------- DOM ---------- */
  const ATTRS = ['aria-label', 'placeholder', 'title'];
  function doText(node) {
    const v = node.nodeValue;
    if (v === node.__i18nOut) return;
    node.__i18nSrc = v;
    const out = trRaw(v);
    node.__i18nOut = out;
    if (out !== v) node.nodeValue = out;
  }
  function doAttrs(el) {
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const v = el.getAttribute(a);
      const store = el.__i18nAttr || (el.__i18nAttr = {});
      if (store[a] && store[a].out === v) continue;
      const out = trRaw(v);
      store[a] = { src: v, out };
      if (out !== v) el.setAttribute(a, out);
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 || root.tagName === 'SCRIPT' || root.tagName === 'STYLE') return;
    doAttrs(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: n => (n.nodeType === 1 && (n.tagName === 'SCRIPT' || n.tagName === 'STYLE')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    let n;
    while ((n = tw.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  // Bei Sprachwechsel alles aus den gemerkten Quelltexten neu übersetzen
  function reapply(root) {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) {
        if (n.__i18nSrc != null && n.nodeValue === n.__i18nOut) { const out = trRaw(n.__i18nSrc); n.__i18nOut = out; n.nodeValue = out; }
        else doText(n);
      } else if (n.__i18nAttr) {
        for (const [a, rec] of Object.entries(n.__i18nAttr)) {
          if (n.getAttribute(a) === rec.out) { const out = trRaw(rec.src); rec.out = out; n.setAttribute(a, out); }
        }
      } else doAttrs(n);
    }
  }

  const mo = new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') doAttrs(m.target);
      else m.addedNodes.forEach(walk);
    }
  });

  function start() {
    document.documentElement.lang = lang;
    walk(document.body);
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  function set(code) {
    if (!LANGS[code] || code === lang) return;
    lang = code; Store.s.lang = code; Store.save();
    document.documentElement.lang = code;
    reapply(document.body);
    listeners.forEach(f => f(code));
  }

  return {
    t, set, start, LANGS, ORDER,
    get lang() { return lang; },
    get locale() { return LANGS[lang].locale; },
    get dec() { return LANGS[lang].dec; },
    onChange(fn) { listeners.push(fn); },
  };
})();
