/* ══════════════════════════════════════════════════════════════════
   M2 無限答題練習 · 智能批改引擎 (grader.js)
   「語意與內容大致正確」的模糊判定：
     · 數值題：支援 3/4、0.75、√57、2√3、200π、2^0.5 等各種寫法
     · 列表題：x=2, y=3 / (2, 3) / 2 3 等各種寫法
     · 代數題：忽略空白、大小寫、乘號、上標，並容許同項不同次序
   同時偵測典型失分（例如不定積分漏寫 + C）並給出針對性提示。
   ══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var SUP = { '⁰': '^0', '¹': '^1', '²': '^2', '³': '^3', '⁴': '^4', '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9' };

  /* 常見分數符號（學生常直接打 ½、¾ 等） */
  var VULGAR = {
    '½': '(1/2)', '⅓': '(1/3)', '⅔': '(2/3)', '¼': '(1/4)', '¾': '(3/4)',
    '⅕': '(1/5)', '⅖': '(2/5)', '⅗': '(3/5)', '⅘': '(4/5)', '⅙': '(1/6)', '⅚': '(5/6)',
    '⅛': '(1/8)', '⅜': '(3/8)', '⅝': '(5/8)', '⅞': '(7/8)'
  };

  function toHalfWidth(s) {
    return String(s == null ? '' : s)
      .replace(/[\uFF01-\uFF5E]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/\u3000/g, ' ');
  }

  /* ── 基礎正規化：全形→半形、數學符號統一、上標→^n ── */
  function normalizeMath(str, keepSpace) {
    var s = toHalfWidth(str);
    s = s.replace(/[−–—‐‒]/g, '-');            // 各種減號
    s = s.replace(/[×·⋅∙✕＊]/g, '*');           // 各種乘號
    s = s.replace(/[÷／]/g, '/');
    s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, function (c) { return SUP[c]; });
    s = s.replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, function (c) { return VULGAR[c]; });
    s = s.replace(/sqrt/gi, '√');
    s = s.replace(/開方|根號|平方根/g, '√');
    s = s.replace(/圓周率|pi(?![a-z])/gi, 'π');
    s = s.replace(/度|°/g, '');
    if (!keepSpace) s = s.replace(/\s+/g, '');
    return s;
  }

  /* ── 代數式正規化：再移除乘號、統一大小寫，方便比對 ── */
  function canon(str) {
    var s = normalizeMath(str).toLowerCase();
    s = s.replace(/[*]/g, '');
    s = s.replace(/×/g, '');
    return s;
  }

  /* ── 同項集合：把 a+b-c 拆成 {+a,+b,-c} 後排序，容許加法次序不同 ── */
  function termSet(c) {
    var parts = [], depth = 0, cur = '', sign = '+';
    for (var i = 0; i < c.length; i++) {
      var ch = c[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (depth === 0 && (ch === '+' || ch === '-')) {
        if (cur !== '') parts.push((sign === '-' ? '-' : '+') + cur);
        cur = ''; sign = ch; continue;
      }
      cur += ch;
    }
    if (cur !== '') parts.push(sign + cur);
    return parts.sort().join('|');
  }

  /* ── 小型數學運算式求值（支援 + - * / ^ ( ) √ π 及隱式乘法） ── */
  function tokenize(s) {
    var toks = [], i = 0;
    function isDigit(c) { return c >= '0' && c <= '9'; }
    while (i < s.length) {
      var c = s[i];
      if (isDigit(c) || c === '.') {
        var j = i;
        while (j < s.length && (isDigit(s[j]) || s[j] === '.')) j++;
        var raw = s.slice(i, j);
        if ((raw.match(/\./g) || []).length > 1) return null;
        toks.push({ t: 'num', v: parseFloat(raw) });
        i = j; continue;
      }
      if (c === 'π') { toks.push({ t: 'num', v: Math.PI }); i++; continue; }
      if (c === '√') { toks.push({ t: 'fn', v: 'sqrt' }); i++; continue; }
      if ('+-*/^()'.indexOf(c) >= 0) { toks.push({ t: c }); i++; continue; }
      return null;                                  // 出現無法解析的字元
    }
    return toks;
  }

  function evalExpr(str) {
    var toks = tokenize(str);
    if (!toks || !toks.length) return null;
    var p = 0;
    function peek() { return toks[p]; }
    function startsFactor(t) { return !!t && (t.t === 'num' || t.t === '(' || t.t === 'fn'); }

    function parseExpr() {
      var v = parseTerm();
      if (v === null) return null;
      while (peek() && (peek().t === '+' || peek().t === '-')) {
        var op = toks[p++].t, r = parseTerm();
        if (r === null) return null;
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }
    function parseTerm() {
      var v = parseUnary();
      if (v === null) return null;
      for (;;) {
        var t = peek();
        if (t && (t.t === '*' || t.t === '/')) {
          var op = toks[p++].t, r = parseUnary();
          if (r === null) return null;
          v = op === '*' ? v * r : v / r;
        } else if (startsFactor(t)) {               // 隱式乘法：2√3、3π、2(1+2)
          var r2 = parseUnary();
          if (r2 === null) return null;
          v = v * r2;
        } else break;
      }
      return v;
    }
    function parseUnary() {
      var t = peek();
      if (t && (t.t === '-' || t.t === '+')) {
        p++;
        var v = parseUnary();
        if (v === null) return null;
        return t.t === '-' ? -v : v;
      }
      return parsePower();
    }
    function parsePower() {
      var base = parseFactor();
      if (base === null) return null;
      if (peek() && peek().t === '^') {
        p++;
        var e = parseUnary();
        if (e === null) return null;
        return Math.pow(base, e);
      }
      return base;
    }
    function parseFactor() {
      var t = toks[p++];
      if (!t) return null;
      if (t.t === 'num') return t.v;
      if (t.t === '(') {
        var v = parseExpr();
        if (v === null) return null;
        if (!peek() || peek().t !== ')') return null;
        p++;
        return v;
      }
      if (t.t === 'fn') {
        var a = parseUnary();
        if (a === null) return null;
        return Math.sqrt(a);
      }
      return null;
    }

    var res = parseExpr();
    if (res === null || p !== toks.length) return null;
    return res;
  }

  /* ── 把學生輸入化成單一數值 ── */
  function parseNumberInput(raw) {
    var s = normalizeMath(raw).toLowerCase();
    var eq = s.lastIndexOf('=');
    if (eq >= 0) s = s.slice(eq + 1);
    s = s.replace(/(\d(?:\.\d+)?)e([+\-]?\d+)(?![0-9])/g, '$1*10^$2');   // 支援科學記號 7.551e4 = 7.551×10⁴
    s = s.split(/[a-z]/)[0];                        // 砍掉單位尾巴（cm、units、s…），π 不受影響
    s = s.replace(/[^0-9.+\-*/^()π√]/g, '');
    s = s.replace(/\(\)/g, '');
    while (/\(\)/.test(s)) s = s.replace(/\(\)/g, '');
    s = s.replace(/[+\-*/^]+$/, '');                // 去掉尾隨運算子
    if (!s) return null;
    return evalExpr(s);
  }

  /* ── 把學生輸入化成有序數值列表 ── */
  function parseNumberList(raw) {
    var s = normalizeMath(raw, true).toLowerCase();   // 保留空白，才能處理「-2 1 1.5 -0.5」這類寫法
    var chunks;
    if (/[，,;；]/.test(s)) {
      chunks = s.split(/[，,;；]/).map(function (c) {
        var i = c.lastIndexOf('=');
        if (i >= 0) c = c.slice(i + 1);
        return c.replace(/[()\[\]{}]/g, '');
      });
    } else {
      var eq = s.lastIndexOf('=');
      if (eq >= 0) s = s.slice(eq + 1);
      s = s.replace(/[()\[\]{}]/g, '');
      chunks = s.split(/\s+|、/);
    }
    var out = [];
    for (var i = 0; i < chunks.length; i++) {
      var c = chunks[i].replace(/[()\[\]{}]/g, '');
      if (!c) continue;
      var v = parseNumberInput(c);
      if (v === null) return null;
      out.push(v);
    }
    return out.length ? out : null;
  }

  function closeEnough(a, b) {
    if (typeof a !== 'number' || typeof b !== 'number' || isNaN(a) || isNaN(b)) return false;
    if (Math.abs(a - b) < 1e-6) return true;
    /* 整數答案必須完全相等：0.2% 相對容差只為小數／無理數的約數與進位而設，
       否則 75500 會因 75510 的 0.2%（151）容差而被判為正確。 */
    if (Number.isInteger(a) && Number.isInteger(b)) return false;
    var scale = Math.max(1, Math.abs(b));
    return Math.abs(a - b) / scale < 0.002;         // 容許 0.2% 的約數／進位差異
  }

  /* ── 主批改函式 ── */
  function grade(q, raw) {
    if (!q || !q.answer) return { ok: false, reason: 'no-answer-key' };
    var a = q.answer;
    var input = String(raw == null ? '' : raw).trim();
    if (!input) return { ok: false, reason: 'empty' };

    if (a.type === 'num') {
      var v = parseNumberInput(input);
      if (v !== null && a.accept.some(function (x) { return closeEnough(v, x); })) return { ok: true, reason: 'num', value: v };
      return { ok: false, reason: 'num-wrong', value: v };
    }

    if (a.type === 'numbers') {
      var list = parseNumberList(input);
      if (list) {
        var hit = a.accept.some(function (exp) {
          return exp.length === list.length && exp.every(function (x, i) { return closeEnough(list[i], x); });
        });
        if (hit) return { ok: true, reason: 'numbers', value: list };
      }
      return { ok: false, reason: 'numbers-wrong', value: list };
    }

    /* 代數式／文字 */
    var c = canon(input);
    var cands = a.accept.map(canon);
    if (cands.indexOf(c) >= 0) return { ok: true, reason: 'symbol' };
    if (c.length > 1 && cands.some(function (e) { return termSet(e) === termSet(c); })) {
      return { ok: true, reason: 'symbol-termset' };
    }
    var wantsC = cands.some(function (e) { return /\+c$/.test(e); });
    if (wantsC) {
      var withC = c + '+c';
      if (cands.some(function (e) { return e === withC || termSet(e) === termSet(withC); })) {
        return { ok: false, reason: 'missing-C' };
      }
    }
    return { ok: false, reason: 'symbol-wrong' };
  }

  /* ══════════════════════════════════════════════════════════════
     顯示用數學排版：把程式碼寫法轉成 Unicode 數學寫法
       x^2 → x²     2^(n − 1) → 2ⁿ⁻¹     x_1 → x₁     A^-1 → A⁻¹
     只作用於「顯示文字」，不影響批改（批改仍接受 ^ 與上標字元）。
     無法完整轉換時（例如含大寫字母或不支援的字元）保留原樣，不會出錯。
     ══════════════════════════════════════════════════════════════ */
  var SUP_MAP = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', ' ': ' ',
    'n': 'ⁿ', 'i': 'ⁱ', 'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ',
    'j': 'ʲ', 'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
    'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
    /* 已是 Unicode 上標的字元原樣保留，令 7^(n²) → 7ⁿ² 之類混合寫法也能轉換 */
    '⁰': '⁰', '¹': '¹', '²': '²', '³': '³', '⁴': '⁴', '⁵': '⁵', '⁶': '⁶', '⁷': '⁷', '⁸': '⁸', '⁹': '⁹',
    '⁺': '⁺', '⁻': '⁻', '⁼': '⁼', '⁽': '⁽', '⁾': '⁾', 'ⁿ': 'ⁿ', 'ⁱ': 'ⁱ'
  };
  var SUB_MAP = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '−': '₋', '=': '₌', '(': '₍', ')': '₎', ' ': ' ',
    'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
    'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ', 'v': 'ᵥ', 'x': 'ₓ',
    /* 已是 Unicode 下標的字元原樣保留 */
    '₀': '₀', '₁': '₁', '₂': '₂', '₃': '₃', '₄': '₄', '₅': '₅', '₆': '₆', '₇': '₇', '₈': '₈', '₉': '₉',
    '₊': '₊', '₋': '₋', '₌': '₌', '₍': '₍', '₎': '₎'
  };

  function mapToken(text, map) {
    var out = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === ' ') continue;                        // 指數內的空白可省略，排版更貼近教科書
      var mapped = map[ch];
      if (mapped === undefined) return null;
      out += mapped;
    }
    return out;
  }

  function convertPowers(str, marker, map) {
    var out = '', i = 0;
    while (i < str.length) {
      if (str.charAt(i) !== marker) { out += str.charAt(i); i++; continue; }
      var j = i + 1;
      if (str.charAt(j) === '(') {                     // x^(...) 形式：抓出對應的右括號
        var depth = 0, k = j, close = -1;
        for (; k < str.length; k++) {
          if (str.charAt(k) === '(') depth++;
          else if (str.charAt(k) === ')') { depth--; if (depth === 0) { close = k; break; } }
        }
        if (close < 0) { out += str.slice(i); break; }
        var whole = mapToken(str.slice(j + 1, close), map);
        if (whole === null) { out += str.slice(i, close + 1); i = close + 1; continue; }
        out += whole; i = close + 1; continue;
      }
      var single = str.charAt(j);
      if (single === '+' || single === '-' || single === '−') {      // 帶正負號的指數，如 ^-1
        var digit = str.charAt(j + 1);
        if (!map[digit] || digit === ' ') { out += marker; i++; continue; }
        if (/[A-Za-z0-9]/.test(str.charAt(j + 2))) { out += marker; i++; continue; }
        out += map[single] + map[digit]; i = j + 2; continue;
      }
      if (!map[single] || single === ' ') { out += marker; i++; continue; }
      if (/[A-Za-z0-9]/.test(str.charAt(j + 1))) { out += marker; i++; continue; }  // 避免 x^2y 之類誤轉
      out += map[single]; i = j + 1;
    }
    return out;
  }

  function mathify(str) {
    if (typeof str !== 'string' || !str) return str;
    return convertPowers(convertPowers(str, '^', SUP_MAP), '_', SUB_MAP);
  }

  var api = {
    toHalfWidth: toHalfWidth,
    mathify: mathify,
    normalizeMath: normalizeMath,
    canon: canon,
    termSet: termSet,
    evalExpr: evalExpr,
    parseNumberInput: parseNumberInput,
    parseNumberList: parseNumberList,
    closeEnough: closeEnough,
    grade: grade
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.M2Grader = api;
})(typeof window !== 'undefined' ? window : globalThis);
