/* ══════════════════════════════════════════════════════════════════
   M2 無限答題練習 · AI 出題模組 (ai.js)  v6
   ──────────────────────────────────────────────────────────────────
   做三件事：
     ① 依「主題＋難度 LV1/2/3＋題型」組出固定提示詞（buildPrompt）
     ② 直接呼叫使用者自己設定的 AI 服務（DeepSeek／OpenAI 相容端點／本機 Ollama）
     ③ 把回覆嚴格驗證、清洗成 App 現有題目格式（可即刻用 grader.js 批改）

   兩條硬規則（顯示質素與安全）：
     · 數學一律 Unicode（x²、√2、π、∫₀¹、≤）；杜絕 LaTeX 與程式碼寫法。
       cleanMath() 會先轉換，轉不掉就退回原字串；LATEX 殘留的題目直接不採用。
     · 圖形題只接受兩種來源：結構化圖表規格（由本檔自己畫成 SVG，字體一定清晰）
       或 AI 給的 SVG（經 sanitizeSvg() 白名單過濾，去 script／on*／外部 URL）。

   本檔不依賴任何外部程式庫，亦不會自行發送請求；只有 App 按下「生成」時
   才會用使用者的 API Key 直接連到使用者選擇的服務端點。
   ══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var VERSION = '6.0.0';
  var SETTINGS_KEY = 'm2ai.settings';
  var POOL_KEY = 'm2ai.pool';
  var MAX_POOL = 40;
  var MAX_COUNT = 5;
  var TIMEOUT_MS = 60000;

  /* ── 服務商預設（全部走 OpenAI 相容的 /chat/completions 介面） ── */
  var PROVIDERS = {
    deepseek: {
      id: 'deepseek', label: 'DeepSeek', base: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat', needKey: true, jsonMode: true
    },
    openai: {
      id: 'openai', label: 'OpenAI 相容端點（自訂）', base: '', model: '', needKey: true, jsonMode: true
    },
    ollama: {
      id: 'ollama', label: '本機 Ollama', base: 'http://localhost:11434/v1',
      model: 'qwen2.5:7b', needKey: false, jsonMode: false
    }
  };

  /* ── 題型（App 會把 id 顯示成中文／英文標籤） ── */
  var TYPES = [
    { id: 'calc', zh: '計算題', en: 'Calculation' },
    { id: 'proof', zh: '證明題', en: 'Proof' },
    { id: 'word', zh: '應用文字題', en: 'Word problem' },
    { id: 'graph', zh: '圖像／作圖題', en: 'Graph & sketching' },
    { id: 'figure', zh: '幾何圖形題', en: 'Geometry figure' },
    { id: 'mc', zh: '選擇題', en: 'Multiple choice' },
    { id: 'fill', zh: '填空題', en: 'Fill in the blank' }
  ];
  var TYPE_BY_ID = {};
  TYPES.forEach(function (t) { TYPE_BY_ID[t.id] = t; });

  var ANS_TYPES = { num: 1, numbers: 1, symbol: 1, show: 1 };

  /* LaTeX／程式碼寫法偵測（與 tools/validate-corpus.js 同一套概念） */
  var LATEX_RE = /\\[a-zA-Z]+|\$\$|\$[^$\n]*\$/;
  var CODEY = [
    { re: /sqrt\s*\(/i, fix: function (s) { return s.replace(/sqrt\s*\(/gi, '√('); } },
    { re: /\bpi\b/i, fix: function (s) { return s.replace(/\bpi\b/gi, 'π'); } },
    { re: /\btheta\b/i, fix: function (s) { return s.replace(/\btheta\b/gi, 'θ'); } },
    { re: /\binf(inity)?\b/i, fix: function (s) { return s.replace(/\binf(inity)?\b/gi, '∞'); } },
    { re: /\bint\s*\(/i, fix: function (s) { return s.replace(/\bint\s*\(/gi, '∫('); } },
    { re: /<=/, fix: function (s) { return s.replace(/<=/g, '≤'); } },
    { re: />=/, fix: function (s) { return s.replace(/>=/g, '≥'); } },
    { re: /!=/, fix: function (s) { return s.replace(/!=/g, '≠'); } },
    { re: /\b(lim|log|ln|max|min)\s*_\{/i, fix: function (s) {
        return s.replace(/\b(lim|log|ln|max|min)\s*_\{([^{}]*)\}/gi, '$1($2)');
      } },
    { re: /\b(alpha|beta|gamma|delta|lambda|mu|sigma|omega)\b/i, fix: function (s) {
        var g = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', lambda: 'λ', mu: 'μ', sigma: 'σ', omega: 'ω' };
        return s.replace(/\b(alpha|beta|gamma|delta|lambda|mu|sigma|omega)\b/gi, function (m) { return g[m.toLowerCase()] || m; });
      } }
  ];

  function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }

  /* ── 共用小工具 ────────────────────────────────────────────────── */
  function lsGet(key, dflt) {
    try {
      var raw = root.localStorage ? root.localStorage.getItem(key) : null;
      if (raw == null) return dflt;
      return JSON.parse(raw);
    } catch (e) { return dflt; }
  }
  function lsSet(key, val) {
    try { if (root.localStorage) root.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 忽略 */ }
  }
  function esc(s) {
    return str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uniq(arr) {
    var seen = {}, out = [];
    (arr || []).forEach(function (v) {
      var k = typeof v === 'string' ? v : JSON.stringify(v);
      if (k == null || k === '') return;
      if (seen[k]) return;
      seen[k] = 1; out.push(v);
    });
    return out;
  }

  /* ── ① 數學文字清洗 ───────────────────────────────────────────── */
  /* 由 i 開始的 { ... } 群組（容許巢狀大括號），回傳 { body, end } */
  function groupAt(s, i) {
    if (s.charAt(i) !== '{') return null;
    var depth = 0;
    for (var j = i; j < s.length; j++) {
      if (s.charAt(j) === '{') depth++;
      else if (s.charAt(j) === '}') { depth--; if (depth === 0) return { body: s.slice(i + 1, j), end: j }; }
    }
    return null;
  }

  /* 讀 _ 與 ^ 的上下限：可加括號或用單一字元，可任意次序（\int_0^1、\sum_{n=1}^{5}） */
  function boundsAt(s, i) {
    var lo = '', hi = '';
    for (var n = 0; n < 4; n++) {
      var k = i;
      while (k < s.length && /\s/.test(s.charAt(k))) k++;
      var c = s.charAt(k);
      if (c !== '_' && c !== '^') break;
      var t = null;
      if (s.charAt(k + 1) === '{') { t = groupAt(s, k + 1); if (t) t = { body: t.body, end: t.end }; }
      else if (k + 1 < s.length) t = { body: s.charAt(k + 1), end: k + 1 };
      if (!t) break;
      if (c === '_') lo = deLatexStruct(t.body); else hi = deLatexStruct(t.body);
      i = t.end + 1;
    }
    return { lo: lo, hi: hi, end: i };
  }

  /* 分數：單一數字／單一字母（1、2、x、π）不加括號，其餘加括號避免歧義（2a、x+1） */
  function fracText(a, b) {
    function simple(t) { return /^([0-9]+(\.[0-9]+)?|[A-Za-z]|[πθ°√])$/.test(t); }
    return (simple(a) ? a : '(' + a + ')') + '/' + (simple(b) ? b : '(' + b + ')');
  }

  /* 結構式 LaTeX（\frac、\sqrt、\int、\sum、\lim 等）轉成 Unicode 寫法；
     看不懂的指令原樣保留（連反斜號），交由 hasLatex() 判斷是否採用該題 */
  function deLatexStruct(s) {
    var out = '', i = 0;
    while (i < s.length) {
      if (s.charAt(i) !== '\\') { out += s.charAt(i); i++; continue; }
      var m = /^\\([a-zA-Z]+)/.exec(s.slice(i));
      if (!m) { out += s.charAt(i); i++; continue; }
      var name = m[1], j = i + m[0].length, g, k;
      if (name === 'frac' || name === 'tfrac' || name === 'dfrac') {
        var a = groupAt(s, j);
        if (a) {
          k = a.end + 1;
          while (k < s.length && /\s/.test(s.charAt(k))) k++;
          var b = groupAt(s, k);
          if (b) { out += fracText(deLatexStruct(a.body), deLatexStruct(b.body)); i = b.end + 1; continue; }
        }
        out += m[0]; i = j; continue;
      }
      if (name === 'sqrt') {
        k = j;
        var idx = '';
        while (k < s.length && /\s/.test(s.charAt(k))) k++;
        if (s.charAt(k) === '[') {
          var close = s.indexOf(']', k);
          if (close > 0) { idx = deLatexStruct(s.slice(k + 1, close)); k = close + 1; }
        }
        g = groupAt(s, k);
        if (!g) { out += m[0]; i = j; continue; }
        out += (idx ? 'root_' + idx : '√') + '(' + deLatexStruct(g.body) + ')';
        i = g.end + 1; continue;
      }
      if (name === 'int' || name === 'sum' || name === 'prod') {
        var sym = name === 'int' ? '∫' : (name === 'sum' ? 'Σ' : '∏');
        var bo = boundsAt(s, j);
        out += sym + ((bo.lo || bo.hi) ? '(' + (bo.lo || '') + (bo.hi ? ' to ' + bo.hi : '') + ')' : '');
        i = bo.end; continue;
      }
      if (name === 'lim' || name === 'log' || name === 'ln' || name === 'max' || name === 'min') {
        k = j;
        while (k < s.length && /\s/.test(s.charAt(k))) k++;
        if (s.charAt(k) === '_') {
          var bo2 = boundsAt(s, j);
          out += name + '(' + (bo2.lo || bo2.hi) + (bo2.hi ? ' to ' + bo2.hi : '') + ')';
          i = bo2.end; continue;
        }
        out += m[0]; i = j; continue;
      }
      out += m[0]; i = j;
    }
    return out;
  }

  /* LaTeX → Unicode 的常用寫法（只處理最常見、可無歧義轉換的形式） */
  function deLatex(input) {
    var s = str(input);
    if (!s) return s;
    s = s.replace(/\$\$?/g, '');
    s = s.replace(/\\\[|\\\]|\\\(|\\\)/g, '');
    s = s.replace(/\\\\/g, '<br>');
    s = deLatexStruct(s);
    s = s.replace(/\\pi\b/g, 'π');
    s = s.replace(/\\theta\b/g, 'θ');
    s = s.replace(/\\alpha\b/g, 'α');
    s = s.replace(/\\beta\b/g, 'β');
    s = s.replace(/\\gamma\b/g, 'γ');
    s = s.replace(/\\delta\b/g, 'δ');
    s = s.replace(/\\lambda\b/g, 'λ');
    s = s.replace(/\\mu\b/g, 'μ');
    s = s.replace(/\\sigma\b/g, 'σ');
    s = s.replace(/\\omega\b/g, 'ω');
    s = s.replace(/\\phi\b/g, 'φ');
    s = s.replace(/\\times/g, '×');
    s = s.replace(/\\cdot/g, '·');
    s = s.replace(/\\div/g, '÷');
    s = s.replace(/\\pm/g, '±');
    s = s.replace(/\\neq/g, '≠');
    s = s.replace(/\\approx/g, '≈');
    s = s.replace(/\\le(q)?\b/g, '≤');
    s = s.replace(/\\ge(q)?\b/g, '≥');
    s = s.replace(/\\to\b/g, '→');
    s = s.replace(/\\infty/g, '∞');
    s = s.replace(/\\infinity/g, '∞');
    s = s.replace(/\\ln\b/g, 'ln');
    s = s.replace(/\\lim\b/g, 'lim');
    s = s.replace(/\\log\b/g, 'log');
    s = s.replace(/\\sin\b/g, 'sin');
    s = s.replace(/\\cos\b/g, 'cos');
    s = s.replace(/\\tan\b/g, 'tan');
    s = s.replace(/\\left|\\right|\\displaystyle|\\limits|\\,|\\;|\\!|\\quad|\\qquad/g, '');
    s = s.replace(/\\%/, '%');
    s = s.replace(/\\([{}\[\]|])/g, '$1');
    /* 看不懂的 \xxx 指令原樣保留（連反斜號），令 hasLatex() 可以攔下該題 */
    return s;
  }

  function fixCodey(input) {
    var s = str(input);
    CODEY.forEach(function (c) { if (c.re.test(s)) s = c.fix(s); });
    return s;
  }

  /* 顯示用清洗：把 ^ 與 _ 交給 grader.mathify 轉 Unicode 上／下標 */
  function cleanMath(input) {
    var s = deLatex(input);
    s = fixCodey(s);
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  function hasLatex(s) { return LATEX_RE.test(str(s)); }

  /* 圖內文字（SVG 的刻度、標籤、圖例、圖說）不經 App 的 grader.mathify，
     所以在這裡直接把 x^2 轉成 x²、x_1 轉成 x₁，確保畫面上看到的是
     Unicode 數學符號而不是 x^2 這種程式碼寫法。 */
  var SUP_MAP = {
    '0': '\u2070', '1': '\u00b9', '2': '\u00b2', '3': '\u00b3', '4': '\u2074',
    '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079',
    '+': '\u207a', '-': '\u207b', '=': '\u207c', '(': '\u207d', ')': '\u207e',
    n: '\u207f', i: '\u2071', x: '\u02e3', k: '\u1d4f'
  };
  var SUB_MAP = {
    '0': '\u2080', '1': '\u2081', '2': '\u2082', '3': '\u2083', '4': '\u2084',
    '5': '\u2085', '6': '\u2086', '7': '\u2087', '8': '\u2088', '9': '\u2089',
    '+': '\u208a', '-': '\u208b', '=': '\u208c', '(': '\u208d', ')': '\u208e',
    n: '\u2099', a: '\u2090', i: '\u1d62', k: '\u2096', x: '\u2093'
  };
  function scriptMap(s, map) {
    var out = '';
    for (var i = 0; i < s.length; i++) out += (map[s.charAt(i)] || s.charAt(i));
    return out;
  }
  /* x^2 → x²、x^{n+1} → xⁿ⁺¹、x_1 → x₁（只在有上下標字元可對應時才轉） */
  function mathScripts(s) {
    s = str(s);
    s = s.replace(/\^\{([^{}]{1,8})\}|\^([0-9a-zA-Z+\-()])/g, function (m, a, b) { return scriptMap(a || b, SUP_MAP); });
    s = s.replace(/_\{([^{}]{1,8})\}|_([0-9a-zA-Z+\-()])/g, function (m, a, b) { return scriptMap(a || b, SUB_MAP); });
    return s;
  }
  function figText(s) {
    s = mathScripts(cleanMath(s));
    /* 負號用 Unicode 減號（−）而不是程式碼的連字號，看起來才是數學符號 */
    s = s.replace(/(^|[\s(,=[{])-(?=[0-9])/g, '$1\u2212');
    return s;
  }
  /* 圖內文字加上白色描邊，讓標籤壓在曲線或格線上時仍然看得清 */
  var HALO = ' stroke="#ffffff" stroke-width="3" paint-order="stroke" stroke-linejoin="round"';

  /* ── ② 提示詞 ─────────────────────────────────────────────────── */
  var MATH_RULES = [
    '數學書寫一律用 Unicode 符號：√ π θ α β λ ° × · ÷ ± ≠ ≈ ≤ ≥ → ∞ ∫ Σ',
    '次方寫 x²、x³、x⁻¹ 或 x^2（程式會轉成 Unicode）；分數寫 3/4（不要用直式）',
    '定積分寫 ∫₀¹ x² dx（上下限用下標字元）；對數寫 ln x、log x；三角寫 sin x、cos 2x',
    '矩陣用 <br> 分行；方程組逐行用 <br> 分隔',
    '嚴禁 LaTeX：不得出現 \\frac、\\sqrt、$、$$、\\int、\\pi、\\theta 等寫法',
    '嚴禁程式碼寫法：sqrt(、pi、theta、inf、int(、<=、>=、!= 不可出現',
    '英文欄位（qEn、displayEn、txEn、subEn）不可含任何中文字'
  ].join('；');

  function typeList(ids) {
    var list = (ids && ids.length ? ids : ['calc']).filter(function (id) { return TYPE_BY_ID[id]; });
    return list.length ? list : ['calc'];
  }

  function typeNamesZh(ids) {
    return typeList(ids).map(function (id) { return TYPE_BY_ID[id].zh + '（' + id + '）'; }).join('、');
  }

  /* 回傳 { system, user, body }；body 是可直接 POST 的 payload（未含 model 亦可） */
  function buildPrompt(opts) {
    opts = opts || {};
    var count = Math.max(1, Math.min(MAX_COUNT, parseInt(opts.count, 10) || 2));
    var lv = (opts.lv === 1 || opts.lv === 2 || opts.lv === 3) ? opts.lv : 0;
    var ids = typeList(opts.types);
    var topicId = str(opts.topicId) || 'diff';
    var topicName = str(opts.topicName) || topicId;
    var topicNameEn = str(opts.topicNameEn) || topicName;
    var subs = (opts.subs || []).filter(function (s) { return str(s).trim(); });
    var subsEn = (opts.subsEn || []).filter(function (s) { return str(s).trim(); });

    var system = [
      '你是香港 HKDSE 數學延伸單元二（M2）的資深出題老師與批改員。',
      '你要即時創作全新題目（不可抄襲任何教材或公開試題），並提供標準答案與 DSE 評分步驟。',
      '',
      '【輸出格式】只輸出一個 JSON 物件，不要任何解釋、不要 markdown 圍欄：',
      '{"questions":[{"lv":1|2|3,"type":"' + ids.join('|') + '","sub":"小主題（中文）","subEn":"Sub-topic (English)",',
      '"q":"題目（中文，可用 <br> 換行）","qEn":"Question (English)","hint":"提示","hintEn":"Hint",',
      '"answer":{"type":"num|numbers|symbol|show","display":"標準答案","displayEn":"Standard answer","accept":["可接受的寫法",…]},',
      '"choices":["A. …","B. …","C. …","D. …"],',
      '"sol":[{"mk":"M1","tx":"步驟（中文）","txEn":"Step (English)"},…],',
      '"figure":{"kind":"graph","xmin":-5,"xmax":5,"ymin":-5,"ymax":5,"caption":"圖 1",',
      '"items":[{"kind":"function","expr":"x^2-4*x+3","label":"y = x² − 4x + 3"},{"kind":"point","x":1,"y":0,"label":"A(1, 0)"},{"kind":"line","x1":0,"y1":0,"x2":3,"y2":4,"label":"L"}]}}]}',
      '',
      '【規則】',
      '1. 每次出 ' + count + ' 題，`type` 只可用：' + typeNamesZh(ids) + '。',
      (lv ? '2. 難度固定 LV' + lv + '：' + lvHint(lv) + '。' : '2. 三級難度都要有，LV 值分散在 1、2、3。'),
      '3. 主題：' + topicName + '（' + topicId + '）／' + topicNameEn + '；小主題 sub 請沿用教材小主題' +
        (subs.length ? '：' + subs.join('／') : '') + (subsEn.length ? '（英文對應：' + subsEn.join(' / ') + '）' : '') + '。',
      '4. 一定要能自動批改：把學生可能輸入的所有等價寫法放入 accept（含化簡前後、無空格版本）。' +
        '只有證明題、作圖題或無法短答的題目才用 answer.type = "show"（此時 accept 給 []）。',
      '5. sol 要 3 至 5 步，每步 mk 用 M1／M1A1／A1 等 DSE 評分標記。',
      '6. 出圖像／作圖題時：用 figure.kind = "graph" 給結構化規格（本程式會畫成清晰圖表）；' +
        '幾何圖形題可用 figure.kind = "svg"，只可用 svg／g／line／polyline／polygon／circle／ellipse／rect／path／text 標籤，' +
        '不可有 script、on* 事件、外部連結；所有數字標籤用 Unicode 數學符號。',
      '7. 數學書寫規則：' + MATH_RULES + '。',
      '8. 題目要原創、數值要合理（答案盡量簡潔或優美），並與主題及小主題相符。'
    ].join('\n');

    var user = [
      '請為「' + topicName + '」出 ' + count + ' 題' +
        (lv ? '（LV' + lv + '）' : '（LV1／LV2／LV3 各一，若不足則自由分配）') +
        '，題型：' + typeNamesZh(ids) + '。',
      '只輸出 JSON（{"questions":[…]}）。'
    ].join('\n');

    return {
      system: system,
      user: user,
      count: count,
      lv: lv,
      types: ids,
      topicId: topicId
    };
  }

  function lvHint(lv) {
    if (lv === 1) return '單步套公式、直接代入，適合初學者';
    if (lv === 3) return '多步、綜合或含陷阱，需要較多推導';
    return '標準兩至三步，DSE 常見題型';
  }

  /* 由 App 組出實際送到服務端的 messages */
  function buildMessages(opts) {
    var p = buildPrompt(opts);
    return {
      messages: [
        { role: 'system', content: p.system },
        { role: 'user', content: p.user }
      ],
      prompt: p
    };
  }

  /* ── ③ 圖表：安全表達式求值 + SVG 繪圖 ───────────────────────── */
  var FUNCS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    ln: Math.log, log: function (v) { return v > 0 ? Math.log(v) / Math.LN10 : NaN; },
    log10: function (v) { return v > 0 ? Math.log(v) / Math.LN10 : NaN; },
    exp: Math.exp, sqrt: Math.sqrt, abs: Math.abs,
    floor: Math.floor, ceil: Math.ceil, round: Math.round
  };

  /* 把 "x^2 - 4*x + 3"、"2 sin x"、"√(x+1)" 轉成 function(x)；不合法回 null */
  function makeFn(expr) {
    var s = deLatex(str(expr)).replace(/√/g, 'sqrt').replace(/π/g, 'π');
    var toks = [];
    var i = 0;
    while (i < s.length) {
      var c = s.charAt(i);
      if (c === ' ' || c === '\t') { i++; continue; }
      if ((c >= '0' && c <= '9') || c === '.') {
        var j = i;
        while (j < s.length && ((s.charAt(j) >= '0' && s.charAt(j) <= '9') || s.charAt(j) === '.')) j++;
        var num = s.slice(i, j);
        if ((num.match(/\./g) || []).length > 1) return null;
        toks.push({ t: 'num', v: parseFloat(num) });
        i = j; continue;
      }
      if (c === 'π') { toks.push({ t: 'num', v: Math.PI }); i++; continue; }
      if (c === 'e' && !/[a-zA-Z]/.test(s.charAt(i + 1))) { toks.push({ t: 'num', v: Math.E }); i++; continue; }
      if (c === 'x') { toks.push({ t: 'x' }); i++; continue; }
      if ('+-*/^()'.indexOf(c) >= 0) { toks.push({ t: c }); i++; continue; }
      if (/[a-zA-Z]/.test(c)) {
        var k = i;
        while (k < s.length && /[a-zA-Z0-9]/.test(s.charAt(k))) k++;
        var name = s.slice(i, k).toLowerCase();
        if (!FUNCS[name]) return null;
        toks.push({ t: 'fn', v: name });
        i = k; continue;
      }
      return null;
    }
    if (!toks.length) return null;

    var p = 0;
    function peek() { return toks[p]; }
    function startsFactor(t) { return !!t && (t.t === 'num' || t.t === '(' || t.t === 'fn' || t.t === 'x'); }

    function parseExpr(x) {
      var v = parseTerm(x);
      if (v === null) return null;
      while (peek() && (peek().t === '+' || peek().t === '-')) {
        var op = toks[p++].t, r = parseTerm(x);
        if (r === null || isNaN(r)) return null;
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }
    function parseTerm(x) {
      var v = parseUnary(x);
      if (v === null) return null;
      for (;;) {
        var t = peek();
        if (t && (t.t === '*' || t.t === '/')) {
          var op = toks[p++].t, r = parseUnary(x);
          if (r === null) return null;
          v = op === '*' ? v * r : v / r;
        } else if (startsFactor(t)) {
          var r2 = parseUnary(x);
          if (r2 === null) return null;
          v = v * r2;
        } else break;
      }
      return v;
    }
    function parseUnary(x) {
      var t = peek();
      if (t && (t.t === '-' || t.t === '+')) {
        p++;
        var v = parseUnary(x);
        if (v === null) return null;
        return t.t === '-' ? -v : v;
      }
      return parsePower(x);
    }
    function parsePower(x) {
      var base = parseFactor(x);
      if (base === null) return null;
      if (peek() && peek().t === '^') {
        p++;
        var e = parseUnary(x);
        if (e === null) return null;
        return Math.pow(base, e);
      }
      return base;
    }
    function parseFactor(x) {
      var t = toks[p++];
      if (!t) return null;
      if (t.t === 'num') return t.v;
      if (t.t === 'x') return x;
      if (t.t === '(') {
        var v = parseExpr(x);
        if (v === null) return null;
        if (!peek() || peek().t !== ')') return null;
        p++;
        return v;
      }
      if (t.t === 'fn') {
        var a = parseUnary(x);
        if (a === null) return null;
        var f = FUNCS[t.v];
        return f ? f(a) : null;
      }
      return null;
    }

    /* 先驗一次語法（x = 0.1234 避免 sin(πx)=0 之類的退化） */
    p = 0;
    if (parseExpr(0.1234) === null || p !== toks.length) return null;

    return function (x) {
      p = 0;
      var v = parseExpr(x);
      return (v === null || typeof v !== 'number' || !isFinite(v)) ? NaN : v;
    };
  }

  function niceStep(span, target) {
    var raw = span / Math.max(1, target);
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var norm = raw / mag;
    var mult = norm < 1.5 ? 1 : (norm < 3 ? 2 : (norm < 7 ? 5 : 10));
    return mult * mag;
  }

  function fmtNum(v) {
    if (!isFinite(v)) return '';
    var r = Math.round(v * 1e6) / 1e6;
    var s = String(r);
    return s.replace(/-/g, '−');
  }

  /* 回傳 { svg, caption }；不合法回 null */
  function renderGraphHtml(fig, idSuffix) {
    var f = fig || {};
    var xmin = Number(f.xmin), xmax = Number(f.xmax), ymin = Number(f.ymin), ymax = Number(f.ymax);
    if (!isFinite(xmin) || !isFinite(xmax) || !isFinite(ymin) || !isFinite(ymax)) return null;
    if (!(xmax > xmin) || !(ymax > ymin)) return null;
    var items = (f.items || []).slice(0, 8);
    var W = 340, H = 250, M = { l: 40, r: 12, t: 14, b: 30 };
    var pw = W - M.l - M.r, ph = H - M.t - M.b;
    function sx(x) { return M.l + (x - xmin) / (xmax - xmin) * pw; }
    function sy(y) { return M.t + (ymax - y) / (ymax - ymin) * ph; }
    var out = [];
    out.push('<svg class="ff-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      esc(figText(f.caption || 'graph')) + '">');
    out.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>');
    /* 網格 */
    var stepX = niceStep(xmax - xmin, 8), stepY = niceStep(ymax - ymin, 6);
    var gx, gy;
    for (gx = Math.ceil(xmin / stepX) * stepX; gx <= xmax + 1e-9; gx += stepX) {
      out.push('<line x1="' + sx(gx).toFixed(1) + '" y1="' + M.t + '" x2="' + sx(gx).toFixed(1) + '" y2="' + (M.t + ph) +
        '" stroke="#e6ecf5" stroke-width="1"/>');
    }
    for (gy = Math.ceil(ymin / stepY) * stepY; gy <= ymax + 1e-9; gy += stepY) {
      out.push('<line x1="' + M.l + '" y1="' + sy(gy).toFixed(1) + '" x2="' + (M.l + pw) + '" y2="' + sy(gy).toFixed(1) +
        '" stroke="#e6ecf5" stroke-width="1"/>');
    }
    /* 座標軸 */
    var ax = sy(0), ay = sx(0);
    var y0 = Math.max(M.t, Math.min(M.t + ph, ax));
    var x0 = Math.max(M.l, Math.min(M.l + pw, ay));
    out.push('<line x1="' + M.l + '" y1="' + y0.toFixed(1) + '" x2="' + (M.l + pw) + '" y2="' + y0.toFixed(1) + '" stroke="#22303f" stroke-width="1.4"/>');
    out.push('<line x1="' + x0.toFixed(1) + '" y1="' + M.t + '" x2="' + x0.toFixed(1) + '" y2="' + (M.t + ph) + '" stroke="#22303f" stroke-width="1.4"/>');
    out.push('<text x="' + (M.l + pw) + '" y="' + (y0 - 5).toFixed(1) + '" font-size="12.5" text-anchor="end" fill="#22303f">x</text>');
    out.push('<text x="' + (x0 + 5).toFixed(1) + '" y="' + M.t + '" font-size="12.5" fill="#22303f" dominant-baseline="hanging">y</text>');
    out.push('<text x="' + (x0 - 4).toFixed(1) + '" y="' + (y0 + 13).toFixed(1) + '" font-size="11.5" text-anchor="end" fill="#22303f">O</text>');
    /* 刻度數字 */
    for (gx = Math.ceil(xmin / stepX) * stepX; gx <= xmax + 1e-9; gx += stepX) {
      if (Math.abs(gx) < 1e-9) continue;
      out.push('<text x="' + sx(gx).toFixed(1) + '" y="' + (M.t + ph + 14) + '" font-size="11" text-anchor="middle" fill="#43536b">' + fmtNum(gx) + '</text>');
      out.push('<line x1="' + sx(gx).toFixed(1) + '" y1="' + (y0 - 3).toFixed(1) + '" x2="' + sx(gx).toFixed(1) + '" y2="' + (y0 + 3).toFixed(1) + '" stroke="#22303f" stroke-width="1"/>');
    }
    for (gy = Math.ceil(ymin / stepY) * stepY; gy <= ymax + 1e-9; gy += stepY) {
      if (Math.abs(gy) < 1e-9) continue;
      out.push('<text x="' + (M.l - 5) + '" y="' + (sy(gy) + 3.8).toFixed(1) + '" font-size="11" text-anchor="end" fill="#43536b">' + fmtNum(gy) + '</text>');
      out.push('<line x1="' + (x0 - 3).toFixed(1) + '" y1="' + sy(gy).toFixed(1) + '" x2="' + (x0 + 3).toFixed(1) + '" y2="' + sy(gy).toFixed(1) + '" stroke="#22303f" stroke-width="1"/>');
    }
    /* 圖形項目 */
    var legend = [];
    items.forEach(function (it) {
      it = it || {};
      if (it.kind === 'function' && it.expr) {
        var fn = makeFn(it.expr);
        if (!fn) return;
        var N = 260, segs = [], cur = [];
        for (var k = 0; k <= N; k++) {
          var x = xmin + (xmax - xmin) * k / N;
          var y = fn(x);
          if (!isFinite(y) || y < ymin - (ymax - ymin) || y > ymax + (ymax - ymin)) {
            if (cur.length > 1) segs.push(cur);
            cur = []; continue;
          }
          cur.push(sx(x).toFixed(1) + ',' + sy(Math.max(ymin, Math.min(ymax, y))).toFixed(1));
        }
        if (cur.length > 1) segs.push(cur);
        segs.forEach(function (seg) {
          out.push('<polyline points="' + seg.join(' ') + '" fill="none" stroke="#e0561f" stroke-width="2" stroke-linejoin="round"/>');
        });
        if (it.label) legend.push({ color: '#e0561f', text: it.label });
      } else if (it.kind === 'line' || it.kind === 'segment') {
        if (![it.x1, it.y1, it.x2, it.y2].every(Number.isFinite)) return;
        out.push('<line x1="' + sx(it.x1).toFixed(1) + '" y1="' + sy(it.y1).toFixed(1) + '" x2="' + sx(it.x2).toFixed(1) +
          '" y2="' + sy(it.y2).toFixed(1) + '" stroke="#1f6feb" stroke-width="1.6" stroke-dasharray="' + (it.kind === 'line' ? '5 4' : '') + '"/>');
        if (it.label) legend.push({ color: '#1f6feb', text: it.label });
      } else if (it.kind === 'point') {
        if (!Number.isFinite(it.x) || !Number.isFinite(it.y)) return;
        out.push('<circle cx="' + sx(it.x).toFixed(1) + '" cy="' + sy(it.y).toFixed(1) + '" r="3.4" fill="#0f8f5f"/>');
        if (it.label) {
          /* 標籤貼近右邊界時改成向左顯示，避免被裁掉 */
          var px0 = sx(it.x), py0 = sy(it.y);
          var right = px0 > M.l + pw * 0.7;
          out.push('<text x="' + (right ? px0 - 6 : px0 + 6).toFixed(1) + '" y="' + (py0 - 6).toFixed(1) +
            '" font-size="11.5" text-anchor="' + (right ? 'end' : 'start') + '" fill="#0b6b47"' + HALO + '>' +
            esc(figText(it.label)) + '</text>');
        }
      } else if (it.kind === 'circle') {
        if (![it.cx, it.cy, it.r].every(Number.isFinite)) return;
        out.push('<circle cx="' + sx(it.cx).toFixed(1) + '" cy="' + sy(it.cy).toFixed(1) + '" r="' + Math.abs((it.r / (xmax - xmin)) * pw).toFixed(1) +
          '" fill="none" stroke="#7a3fd8" stroke-width="1.6"/>');
      } else if (it.kind === 'label') {
        if (!Number.isFinite(it.x) || !Number.isFinite(it.y)) return;
        /* 文字不可超出繪圖區：靠右改為尾端對齊，並把錨點夾在區內 */
        var lx = Math.max(M.l + 2, Math.min(M.l + pw - 2, sx(it.x)));
        var anchor = lx > M.l + pw * 0.66 ? 'end' : (lx > M.l + pw * 0.34 ? 'middle' : 'start');
        out.push('<text x="' + lx.toFixed(1) + '" y="' + sy(it.y).toFixed(1) + '" font-size="11.5" text-anchor="' + anchor +
          '" fill="#22303f"' + HALO + '>' + esc(figText(it.text || '')) + '</text>');
      }
    });
    out.push('</svg>');
    var caption = figText(f.caption || '');
    var legendHtml = legend.length ? '<div class="fig-legend">' + legend.map(function (l) {
      return '<span class="fig-key" style="--k:' + l.color + '"><i></i>' + esc(figText(l.text)) + '</span>';
    }).join('') + '</div>' : '';
    return {
      svg: out.join(''),
      html: '<figure class="q-figure" data-fig="graph">' + out.join('') + legendHtml +
        (caption ? '<figcaption>' + esc(caption) + '</figcaption>' : '') + '</figure>'
    };
  }

  /* ── SVG 白名單消毒（AI 直接給 SVG 時使用） ───────────────────── */
  var SVG_TAGS = {
    svg: 1, g: 1, line: 1, polyline: 1, polygon: 1, circle: 1, ellipse: 1, rect: 1,
    path: 1, text: 1, tspan: 1, title: 1, desc: 1, defs: 1, marker: 1
  };
  var SVG_ATTRS = {
    viewbox: 0, width: 0, height: 0, x: 0, y: 0, x1: 0, y1: 0, x2: 0, y2: 0,
    cx: 0, cy: 0, r: 0, rx: 0, ry: 0, d: 0, points: 0, fill: 0, stroke: 0, 'stroke-width': 0,
    'stroke-dasharray': 0, 'stroke-linejoin': 0, 'stroke-linecap': 0, 'fill-opacity': 0,
    'stroke-opacity': 0, 'font-size': 0, 'font-family': 0, 'font-weight': 0, 'text-anchor': 0,
    'dominant-baseline': 0, transform: 0, opacity: 0, id: 0, class: 0, marker: 0, 'marker-end': 0,
    orient: 0, refx: 0, refy: 0, markerwidth: 0, markerheight: 0, 'markerUnits': 0
  };
  var SAFE_FONTS = /^[a-zA-Z0-9 ,.'-]*$/;

  function sanitizeSvg(input) {
    var s = str(input).trim();
    if (!s) return '';
    var m = s.match(/<svg[\s\S]*?<\/svg>/i);
    if (!m) return '';
    s = m[0];
    s = s.replace(/<!--[\s\S]*?-->/g, '');
    s = s.replace(/<\s*(script|style|foreignObject|iframe|image|use|animate|set|link|meta)[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
    s = s.replace(/<\s*(script|style|foreignObject|iframe|image|use|animate|set|link|meta)\b[^>]*>/gi, '');
    s = s.replace(/<\s*\/?\s*([a-zA-Z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*)\/?\s*>/g, function (tag, name) {
      var lname = String(name).toLowerCase();
      if (!SVG_TAGS[lname]) return '';
      var closing = /^<\s*\//.test(tag);
      var attrs = tag.replace(/^<\s*\/?\s*[a-zA-Z][\w:.-]*/, '').replace(/\/?>$/, '');
      var kept = '';
      var re = /([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g, mm;
      while ((mm = re.exec(attrs))) {
        var a = mm[1].toLowerCase();
        var v = mm[3] !== undefined ? mm[3] : (mm[4] !== undefined ? mm[4] : mm[5]);
        if (a.indexOf('on') === 0) continue;
        if (!(a in SVG_ATTRS)) continue;
        if (/javascript:|data:text\/html|url\s*\(|expression/i.test(v)) continue;
        if ((a === 'href' || a === 'xlink:href' || a === 'src')) continue;
        if (a === 'font-family' && !SAFE_FONTS.test(v)) continue;
        v = v.replace(/[\u0000-\u001f]/g, '');
        kept += ' ' + a + '="' + esc(v) + '"';
      }
      if (lname === 'svg' && kept.indexOf('viewBox') < 0) kept += ' viewBox="0 0 200 200"';
      return '<' + (closing ? '/' : '') + lname + kept + '>';
    });
    if (s.indexOf('<svg') < 0) return '';
    return s.replace(/<svg/, '<svg class="ff-svg" ');
  }

  /* ── ④ 題目驗證與清洗 ─────────────────────────────────────────── */
  function coerceNum(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    var G = root.M2Grader;
    if (G && G.parseNumberInput) {
      var n = G.parseNumberInput(str(v));
      if (typeof n === 'number' && isFinite(n)) return n;
    }
    var direct = Number(str(v).replace(/[, ]/g, ''));
    return isFinite(direct) ? direct : null;
  }

  function coerceNumbers(arr) {
    if (!Array.isArray(arr)) return null;
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var n = coerceNum(arr[i]);
      if (n === null) return null;
      out.push(n);
    }
    return out.length ? out : null;
  }

  function stripEq(s) {
    var t = str(s);
    var i = t.lastIndexOf('=');
    return i >= 0 ? t.slice(i + 1).trim() : t;
  }

  /* 把 AI 的 answer 物件整理成 grader.js 可用的形狀；無法批改時退回 show */
  function normAnswer(raw, ctx) {
    var a = raw && typeof raw === 'object' ? raw : {};
    var kind = ANS_TYPES[a.type] ? a.type : '';
    var display = cleanMath(a.display || a.answer || '');
    var displayEn = cleanMath(a.displayEn || display);
    var issues = [];
    var lostNumeric = '';   /* num／numbers 解析失敗 → 只信 AI 明示的 accept，否則退回 show */

    if (!kind) {
      /* 由 accept／display 猜：能化簡成純數值就用 num，否則 symbol */
      kind = (a.accept && a.accept.length !== 0 || display) ? (coerceNum(display) !== null ? 'num' : 'symbol') : 'show';
      issues.push('answer.type 缺失，已判斷為 ' + kind);
    }

    if (kind === 'num') {
      var list = (Array.isArray(a.accept) ? a.accept : []).map(coerceNum).filter(function (v) { return v !== null; });
      var dv = coerceNum(display);
      if (dv !== null) list.push(dv);
      list = uniq(list);
      if (!list.length) {
        kind = 'symbol';
        lostNumeric = 'num';
        issues.push('num 答案無法解析為數值，改以文字比對');
      } else {
        return { type: 'num', display: display || fmtNum(list[0]), displayEn: displayEn || fmtNum(list[0]), accept: list, issues: issues };
      }
    }

    if (kind === 'numbers') {
      var exp = [];
      (Array.isArray(a.accept) ? a.accept : []).forEach(function (v) {
        var one = Array.isArray(v) ? coerceNumbers(v) : (str(v).split(/[,;、]/).length > 1 ? coerceNumbers(str(v).split(/[,;、]/)) : null);
        if (one) exp.push(one);
      });
      var dList = str(display).replace(/[()\[\]{}]/g, '').split(/[,;、]/);
      if (dList.length > 1) {
        var dArr = coerceNumbers(dList);
        if (dArr) exp.push(dArr);
      }
      exp = uniq(exp);
      if (!exp.length) { kind = 'symbol'; lostNumeric = 'numbers'; issues.push('numbers 答案無法解析，改以文字比對'); }
      else return { type: 'numbers', display: display || exp[0].join(', '), displayEn: displayEn || exp[0].join(', '), accept: exp, issues: issues };
    }

    if (kind === 'symbol' || kind === 'show') {
      var acc = [];
      (Array.isArray(a.accept) ? a.accept : []).forEach(function (v) {
        if (typeof v === 'string' || typeof v === 'number') acc.push(cleanMath(v));
        else if (Array.isArray(v)) acc.push(v.map(str).join(', '));
      });
      [display, displayEn, stripEq(display), stripEq(displayEn)].forEach(function (v) {
        if (!str(v).trim()) return;
        /* 原本是數值題但解析失敗：顯示欄可能只是「見圖」之類的說明，不可拿來當答案 */
        if (lostNumeric && !/[0-9]|[=+\-*/^√πθ°≤≥]/.test(str(v))) return;
        acc.push(cleanMath(v));
      });
      acc = uniq(acc.filter(function (v) { return str(v).trim() !== ''; }));
      if (kind === 'symbol' && !acc.length) {
        /* 沒有任何可比對寫法 → 退回 show，避免永遠批錯 */
        return { type: 'show', display: displayEn || 'See solution', displayEn: displayEn || 'See solution', accept: [], issues: issues.concat(['無可比對答案，改用 show']) };
      }
      return { type: kind, display: display || (kind === 'show' ? 'See solution' : acc[0]), displayEn: displayEn || display || 'See solution', accept: acc, issues: issues };
    }

    return { type: 'show', display: displayEn || 'See solution', displayEn: displayEn || 'See solution', accept: [], issues: issues };
  }

  function normSol(raw, ctx) {
    var out = [];
    (Array.isArray(raw) ? raw : []).forEach(function (s) {
      if (!s || typeof s !== 'object') return;
      var tx = cleanMath(s.tx || s.text || '');
      var txEn = cleanMath(s.txEn || s.textEn || tx);
      var mk = cleanMath(s.mk || '');
      if (!tx && !txEn) return;
      out.push({ mk: mk || 'M1', tx: tx || txEn, txEn: txEn || tx });
    });
    return out.slice(0, 8);
  }

  function normFigure(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var kind = str(raw.kind || raw.type).toLowerCase();
    if (kind === 'svg' || raw.svg) {
      var svg = sanitizeSvg(raw.svg || '');
      return svg ? { kind: 'svg', svg: svg, caption: cleanMath(raw.caption || '') } : null;
    }
    if (kind === 'graph' || Array.isArray(raw.items)) {
      var p = renderGraphHtml(raw);
      if (!p) return null;
      return {
        kind: 'graph', svg: p.svg, caption: cleanMath(raw.caption || ''),
        spec: {
          xmin: Number(raw.xmin), xmax: Number(raw.xmax), ymin: Number(raw.ymin), ymax: Number(raw.ymax),
          items: (raw.items || []).slice(0, 8)
        }
      };
    }
    return null;
  }

  var CJK = /[\u3400-\u9fff\uf900-\ufaff]/;

  /* 單題清洗：回傳 { ok:true, q } 或 { ok:false, reason } */
  function normalizeQuestion(raw, ctx) {
    ctx = ctx || {};
    if (!raw || typeof raw !== 'object') return { ok: false, reason: 'not-object' };
    var issues = [];
    var q = {};
    q.lv = (raw.lv === 1 || raw.lv === 2 || raw.lv === 3) ? raw.lv : (ctx.lv || 2);
    var typeId = str(raw.type).toLowerCase();
    if (!TYPE_BY_ID[typeId]) {
      /* 用圖形／小題內容猜題型，令標籤至少合理 */
      typeId = (raw.figure ? 'graph' : (raw.choices && raw.choices.length ? 'mc' : 'calc'));
      issues.push('type 不在清單，已判斷為 ' + typeId);
    }
    if (raw.figure && (typeId === 'calc' || typeId === 'fill')) typeId = (str(raw.figure.kind) === 'svg' ? 'figure' : 'graph');

    q.q = cleanMath(raw.q || raw.question || '');
    q.qEn = cleanMath(raw.qEn || raw.questionEn || raw.q || '');
    if (!q.q && !q.qEn) return { ok: false, reason: 'empty-question' };
    if (!q.q) q.q = q.qEn;
    if (!q.qEn) q.qEn = q.q;
    if (hasLatex(q.q) || hasLatex(q.qEn)) return { ok: false, reason: 'latex-left' };
    if (CJK.test(q.qEn)) { q.qEn = q.q; issues.push('qEn 含中文，已改用中文題目原文'); }

    q.hint = cleanMath(raw.hint || '');
    q.hintEn = cleanMath(raw.hintEn || '');
    if (CJK.test(q.hintEn)) q.hintEn = q.hint;
    q.sub = cleanMath(raw.sub || '');
    q.subEn = cleanMath(raw.subEn || '');
    if (CJK.test(q.subEn)) q.subEn = q.sub;

    var ans = normAnswer(raw.answer, ctx);
    if (ans.issues && ans.issues.length) issues = issues.concat(ans.issues);
    q.answer = { type: ans.type, display: ans.display, displayEn: ans.displayEn, accept: ans.accept };
    q.answer.accept = ans.accept;

    if (typeId === 'mc') {
      var choices = (Array.isArray(raw.choices) ? raw.choices : []).slice(0, 6).map(function (c) { return cleanMath(c); }).filter(Boolean);
      if (choices.length >= 2) {
        q.choices = choices;
        if (q.answer.type !== 'show') {
          var letters = 'ABCDEF';
          var extra = [];
          for (var i = 0; i < choices.length; i++) {
            extra.push(letters.charAt(i));
            extra.push(letters.charAt(i).toLowerCase());
          }
          q.answer.accept = uniq(q.answer.accept.concat(extra));
          if (!str(q.answer.display).trim()) q.answer.display = q.answer.displayEn = letters.charAt(0);
        }
      } else {
        typeId = q.answer.type === 'show' ? 'proof' : 'calc';
        issues.push('mc 沒有足夠選項，已改為 ' + typeId);
      }
    }

    q.sol = normSol(raw.sol || raw.solution || raw.steps, ctx);
    if (q.answer.type === 'show' && !q.sol.length) {
      /* 無法批改又沒有詳解 → 至少放一句 DSE 評分提示，避免空白解答 */
      q.sol = [{ mk: 'M1', tx: '請參考標準答案並核對自己的做法。', txEn: 'Check your working against the standard answer above.' }];
      issues.push('show 題沒有詳解，已補上提示');
    }

    q.figure = normFigure(raw.figure);
    q.type = typeId;
    q.topic = str(ctx.topicId || raw.topic || '');
    q.origin = 'original';
    q.ai = true;
    q.review = (q.answer.type === 'show');
    q.id = 'ai-' + (ctx.stamp || 0) + '-' + (ctx.index || 0);
    q.src = 'AI';
    q._issues = issues;
    return { ok: true, q: q };
  }

  /* ── ⑤ 回覆解析 ───────────────────────────────────────────────── */
  function extractJson(text) {
    var s = str(text).trim();
    s = s.replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '').trim();
    var start = -1, opener = '';
    for (var i = 0; i < s.length; i++) {
      if (s.charAt(i) === '{' || s.charAt(i) === '[') { start = i; opener = s.charAt(i); break; }
    }
    if (start < 0) return '';
    var closer = opener === '{' ? '}' : ']';
    var depth = 0, inStr = false, escp = false, end = -1;
    for (var k = start; k < s.length; k++) {
      var c = s.charAt(k);
      if (inStr) {
        if (escp) escp = false;
        else if (c === '\\') escp = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; continue; }
      if (c === opener) depth++;
      else if (c === closer) { depth--; if (depth === 0) { end = k; break; } }
    }
    return end > start ? s.slice(start, end + 1) : '';
  }

  /* 解析 API 回覆文字 → { questions, issues, rejected } */
  function parseQuestions(text, ctx) {
    ctx = ctx || {};
    var json = extractJson(text);
    var issues = [], rejected = [];
    if (!json) return { questions: [], issues: ['no-json'], rejected: [] };
    var data;
    try { data = JSON.parse(json); } catch (e) { return { questions: [], issues: ['bad-json'], rejected: [] }; }
    var list = Array.isArray(data) ? data : (Array.isArray(data.questions) ? data.questions : (Array.isArray(data.items) ? data.items : []));
    if (!list.length) return { questions: [], issues: ['no-questions'], rejected: [] };
    var questions = [], seen = {};
    var stamp = ctx.stamp || Date.now();
    list.slice(0, MAX_COUNT + 2).forEach(function (raw, i) {
      var r = normalizeQuestion(raw, {
        topicId: ctx.topicId, lv: ctx.lv, stamp: stamp, index: i
      });
      if (!r.ok) { rejected.push(r.reason); return; }
      var key = r.q.q.replace(/\s+/g, '').slice(0, 90);
      if (seen[key]) { rejected.push('duplicate'); return; }
      seen[key] = 1;
      if (r.q._issues && r.q._issues.length) issues = issues.concat(r.q._issues);
      questions.push(r.q);
    });
    return { questions: questions, issues: issues, rejected: rejected };
  }

  /* ── ⑥ 題目快取（同一部裝置即時重用，減少 API 花費） ─────────── */
  function poolKey(o) {
    return [str(o.topicId), str(o.lv || 'all'), (o.types || []).slice().sort().join('+')].join('|');
  }
  function loadPool() {
    var v = lsGet(POOL_KEY, []);
    return Array.isArray(v) ? v : [];
  }
  function savePool(list) { lsSet(POOL_KEY, list.slice(-MAX_POOL)); }
  function pushPool(items, key) {
    if (!items || !items.length) return;
    var list = loadPool();
    items.forEach(function (q) { list.push({ key: key, ts: Date.now(), q: q }); });
    savePool(list);
  }
  function takeFromPool(key) {
    var list = loadPool();
    for (var i = 0; i < list.length; i++) {
      if (!list[i] || !list[i].q) continue;
      if (list[i].key === key) {
        var q = list[i].q;
        list.splice(i, 1);
        savePool(list);
        return q;
      }
    }
    return null;
  }
  function clearPool() { lsSet(POOL_KEY, []); }
  function poolSize(key) {
    return loadPool().filter(function (it) { return !key || it.key === key; }).length;
  }

  /* ── ⑦ 設定 ───────────────────────────────────────────────────── */
  function defaults() {
    var p = PROVIDERS.deepseek;
    return {
      provider: p.id, base: p.base, model: p.model, key: '',
      jsonMode: p.jsonMode, autoPrefetch: true, timeout: TIMEOUT_MS
    };
  }
  function getSettings() {
    var s = lsGet(SETTINGS_KEY, null);
    var base = defaults();
    if (s && typeof s === 'object') {
      Object.keys(base).forEach(function (k) { if (s[k] !== undefined && s[k] !== null) base[k] = s[k]; });
    }
    return base;
  }
  function saveSettings(patch) {
    var s = getSettings();
    if (patch && typeof patch === 'object') {
      Object.keys(patch).forEach(function (k) { if (patch[k] !== undefined) s[k] = patch[k]; });
    }
    lsSet(SETTINGS_KEY, s);
    return s;
  }
  function providerDefaults(id) {
    var p = PROVIDERS[id] || PROVIDERS.deepseek;
    return { provider: p.id, base: p.base, model: p.model, jsonMode: p.jsonMode };
  }

  function endpoint(settings) {
    var base = str(settings.base).trim().replace(/\/+$/, '');
    if (!base) return '';
    if (/\/chat\/completions$/.test(base)) return base;
    if (/\/v\d+$/.test(base)) return base + '/chat/completions';
    if (PROVIDERS.deepseek.base === base || base === 'https://api.deepseek.com') return base + (base.indexOf('/v1') < 0 ? '/v1/chat/completions' : '/chat/completions');
    return base + '/chat/completions';
  }

  /* ── ⑧ 呼叫 AI 服務 ───────────────────────────────────────────── */
  function errorText(code, detail) {
    var zh = {
      'no-endpoint': '未設定 API 端點（請在 AI 設定填入）',
      'no-key': '未設定 API Key',
      'no-model': '未設定模型名稱',
      'no-fetch': '此瀏覽器不支援網絡請求，無法使用 AI 出題',
      'key': 'API Key 無效或已過期',
      'quota': '額度不足或請求太頻密',
      'rate': '請求太頻密，請稍後再試',
      'server': 'AI 服務暫時出錯',
      'timeout': 'AI 回應逾時，請再試一次',
      'network': '無法連接 AI 服務（檢查網絡、端點或 CORS）',
      'parse': 'AI 回覆不是有效題目格式，請再生成一次',
      'empty': 'AI 沒有回覆內容'
    };
    return { ok: false, code: code, message: zh[code] || 'AI 出題失敗', detail: detail || '' };
  }

  /* 回傳 { ok:true, questions, prompt } 或 { ok:false, code, message, detail } */
  function generate(opts) {
    opts = opts || {};
    var settings = opts.settings || getSettings();
    var url = endpoint(settings);
    if (!settings.base) return Promise.resolve(errorText('no-endpoint'));
    if (!url) return Promise.resolve(errorText('no-endpoint'));
    var preset = PROVIDERS[settings.provider] || null;
    if ((!preset || preset.needKey) && !str(settings.key).trim()) return Promise.resolve(errorText('no-key'));
    if (!str(settings.model).trim()) return Promise.resolve(errorText('no-model'));
    if (typeof root.fetch !== 'function') return Promise.resolve(errorText('no-fetch'));

    var built = buildMessages(opts);
    var payload = {
      model: settings.model,
      messages: built.messages,
      temperature: 0.9,
      stream: false
    };
    if (settings.jsonMode) payload.response_format = { type: 'json_object' };
    var headers = { 'Content-Type': 'application/json' };
    if (str(settings.key).trim()) headers.Authorization = 'Bearer ' + str(settings.key).trim();

    var ctrl = null;
    var timer = null;
    var timeout = Math.max(10000, Math.min(180000, Number(settings.timeout) || TIMEOUT_MS));
    if (typeof root.AbortController === 'function') {
      ctrl = new root.AbortController();
      timer = setTimeout(function () { try { ctrl.abort(); } catch (e) { /* 忽略 */ } }, timeout);
    }

    var ctx = {
      topicId: opts.topicId, lv: opts.lv,
      stamp: Date.now(), index: 0
    };

    return root.fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      return res.text().then(function (body) {
        if (!res.ok) {
          var code = res.status === 401 || res.status === 403 ? 'key'
            : (res.status === 402 ? 'quota' : (res.status === 429 ? 'rate' : 'server'));
          var detail = body.slice(0, 300);
          try {
            var j = JSON.parse(body);
            detail = (j.error && (j.error.message || j.error.code)) || j.message || detail;
          } catch (e) { /* 保留原文 */ }
          return errorText(code, detail);
        }
        var data = null;
        try { data = JSON.parse(body); } catch (e) { return errorText('parse', 'API 回覆不是 JSON'); }
        var msg = data && data.choices && data.choices[0] && (data.choices[0].message || data.choices[0]);
        var content = msg ? (msg.content || msg.text || '') : (data && data.response) || '';
        if (Array.isArray(content)) {
          content = content.map(function (part) { return typeof part === 'string' ? part : (part && part.text) || ''; }).join('');
        }
        if (!str(content).trim()) return errorText('empty');
        var parsed = parseQuestions(content, ctx);
        if (!parsed.questions.length) return errorText('parse', '無法解析題目（' + parsed.rejected.join(',') + '）');
        return { ok: true, questions: parsed.questions, issues: parsed.issues, prompt: built.prompt, raw: content };
      });
    }).catch(function (err) {
      var name = err && err.name;
      if (name === 'AbortError') return errorText('timeout');
      return errorText('network', (err && err.message) || '');
    }).then(function (result) {
      if (timer) clearTimeout(timer);
      return result;
    });
  }

  /* 快速檢查設定是否可用（不發請求） */
  function ready(settings) {
    var s = settings || getSettings();
    if (!str(s.base).trim()) return { ok: false, code: 'no-endpoint' };
    var preset = PROVIDERS[s.provider] || null;
    if ((!preset || preset.needKey) && !str(s.key).trim()) return { ok: false, code: 'no-key' };
    if (!str(s.model).trim()) return { ok: false, code: 'no-model' };
    if (typeof root.fetch !== 'function') return { ok: false, code: 'no-fetch' };
    return { ok: true };
  }

  var api = {
    version: VERSION,
    PROVIDERS: PROVIDERS, TYPES: TYPES, TYPE_BY_ID: TYPE_BY_ID, MATH_RULES: MATH_RULES,
    providerDefaults: providerDefaults, getSettings: getSettings, saveSettings: saveSettings,
    buildPrompt: buildPrompt, buildMessages: buildMessages,
    deLatex: deLatex, cleanMath: cleanMath, fixCodey: fixCodey, hasLatex: hasLatex, mathScripts: mathScripts,
    sanitizeSvg: sanitizeSvg, makeFn: makeFn, renderGraphHtml: renderGraphHtml,
    renderFigureHtml: function (fig) {
      if (!fig) return '';
      if (fig.kind === 'svg' && fig.svg) {
        var svg = sanitizeSvg(fig.svg);
        if (!svg) return '';
        return '<figure class="q-figure" data-fig="svg">' + svg +
          (fig.caption ? '<figcaption>' + esc(figText(fig.caption)) + '</figcaption>' : '') + '</figure>';
      }
      if (fig.kind === 'graph' && fig.svg) {
        return '<figure class="q-figure" data-fig="graph">' + fig.svg +
          (fig.caption ? '<figcaption>' + esc(figText(fig.caption)) + '</figcaption>' : '') + '</figure>';
      }
      return '';
    },
    normalizeQuestion: normalizeQuestion, normAnswer: normAnswer, parseQuestions: parseQuestions,
    extractJson: extractJson, coerceNum: coerceNum,
    poolKey: poolKey, pushPool: pushPool, takeFromPool: takeFromPool, clearPool: clearPool, poolSize: poolSize,
    generate: generate, ready: ready, endpoint: endpoint, errorText: errorText
  };

  root.M2AI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
