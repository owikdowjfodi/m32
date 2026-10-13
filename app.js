/* ══════════════════════════════════════════════════════════════════
   M2 無限答題練習 · 遊戲主程式 (app.js)
   規則：
     · 連續答對 10 題 → 挑戰成功，啟動「無限訓練模式」
     · 答錯 → 連續紀錄歸零（無限訓練模式下只累計總答對數，不再歸零）
     · 隨時可按主題按鈕自行轉換小主題（轉主題不會中斷連續紀錄）
     · 可切換難度等級（全部／LV1／LV2／LV3），題目旁顯示 LV 標記
     · 可切換中英文介面（UI、題目、答案、解題同步切換）
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var G = window.M2Grader;
  var I = window.M2I18N;
  var AI = window.M2AI;              /* AI 出題模組（ai.js）；未載入時為 undefined，功能自動停用 */
  var TARGET = 10;
  var LS_TOPIC = 'm2.topic';
  var LS_LEVEL = 'm2.level';
  var LS_AI_ON = 'm2.ai.on';         /* AI 出題開關（其餘設定由 ai.js 自己存 m2ai.settings） */

  function T(key, vars) { return I ? I.t(key, vars) : key; }
  function zh() { return !I || I.lang === 'zh'; }

  /* ────────── 語言相關取值（缺英文時自動退回中文） ────────── */
  function fTopic(t) { return zh() ? t.name : (t.en || t.name); }
  function fQ(q) { return zh() ? q.q : (q.qEn || q.q); }
  function fHint(q) { return zh() ? q.hint : (q.hintEn || q.hint); }
  function fNote(q) { return zh() ? q.note : (q.noteEn || q.note); }
  function fDisplay(q) { return zh() ? q.answer.display : (q.answer.displayEn || q.answer.display); }
  function fSub(q) { return zh() ? q.sub : (q.subEn || q.sub); }
  function fTx(s) { return zh() ? s.tx : (s.txEn || s.tx); }

  /* ────────── 讀取上次選擇（主題／難度） ────────── */
  function lsGet(k, dflt) {
    try { var v = window.localStorage && window.localStorage.getItem(k); return v === null || v === undefined ? dflt : v; }
    catch (e) { return dflt; }
  }
  function lsSet(k, v) { try { if (window.localStorage) window.localStorage.setItem(k, String(v)); } catch (e) { /* 略 */ } }

  var savedTopic = lsGet(LS_TOPIC, null);
  var startTopic = (window.TOPICS || []).some(function (t) { return t.id === savedTopic; }) ? savedTopic : TOPICS[0].id;
  var savedLevel = parseInt(lsGet(LS_LEVEL, '0'), 10);
  if ([0, 1, 2, 3].indexOf(savedLevel) < 0) savedLevel = 0;

  var state = {
    topicId: startTopic,
    level: savedLevel,          /* 0 = 全部，1/2/3 = LV1/LV2/LV3 */
    streak: 0,
    totalCorrect: 0,
    wrongCount: 0,
    unlocked: false,
    current: null,
    answered: false,
    revealed: false,            /* 溫習題是否已按「看解答」展開標準解答 */
    timer: null,
    statusKind: 'default',
    statusVars: {},
    statusCls: '',
    fbKind: null,               /* null / 'ok' / 'bad' */
    fbDetail: null,             /* {kind, vars} */
    fbCls: '',
    /* ── v6 · AI 出題 ── */
    aiOn: lsGet(LS_AI_ON, '0') === '1',   /* 使用者上次的開關狀態 */
    aiBusy: false,                        /* 是否正在背景預取題目 */
    aiSeq: 0                              /* 每次換題 +1，用來丟棄過期的 AI 回應 */
  };

  var el = {};
  ['topicGrid', 'btnRandomTopic', 'flames', 'streakText', 'statusLine', 'topicTag', 'qSub',
    'qLevel', 'levelRow', 'questionText', 'answerInput', 'btnSubmit', 'btnShowHint', 'hintBox',
    'feedback', 'solution', 'solTitle', 'stdAnswer', 'solutionBody', 'btnNext', 'btnReset',
    'statTotal', 'statWrong', 'statMode', 'answerArea', 'answerLabel', 'appSubtitle',
    'answerInputRow', 'reviewBox', 'reviewNotice', 'btnReveal', 'localBadge', 'footerPrivacy',
    'btnLangZh', 'btnLangEn', 'qAiBadge', 'questionFigure',
    /* ── v6 · AI 出題 ── */
    'aiPanel', 'btnAiToggle', 'aiToggleText', 'aiStatus', 'btnAiSettings',
    'aiDialog', 'aiProvider', 'aiBase', 'aiModel', 'aiKey', 'aiJson', 'aiAuto',
    'aiPoolNote', 'btnAiSave', 'btnAiClose', 'btnAiClearPool',
    /* ── v5 模擬試卷模式 ── */
    'modeSwitch', 'practiceMode', 'paperMode', 'btnModePractice', 'btnModePaper',
    'paperListPanel', 'paperList', 'paperEmpty',
    'examPanel', 'examTimer', 'examPaperName', 'examProgress', 'examMarks', 'examNav',
    'lgUnanswered', 'lgAnswered', 'lgMarked', 'examQLevel', 'examQSub', 'examQuestionText',
    'examAnswerLabel', 'examAnswerRow', 'examAnswerInput', 'btnExamSubmitOne',
    'btnExamHint', 'examHintBox', 'examReviewBox', 'examReviewNotice', 'btnExamReveal',
    'examSelfRow', 'examSelfPrompt', 'btnSelfFull', 'btnSelfZero', 'examSelfRecorded',
    'examFeedback', 'examSolution', 'examStdAnswer', 'examSolutionBody',
    'btnPaperPrev', 'btnPaperMark', 'btnPaperNext', 'btnPaperHandIn', 'btnExamToList',
    'reportPanel', 'reportPaperName', 'reportNote', 'reportSummary', 'reportGradeNote',
    'reportHead', 'reportBody', 'reportSolution', 'reportStdAnswer', 'reportSolutionBody',
    'btnPaperListBack', 'btnRedoPaper', 'btnBackPractice'
  ].forEach(function (id) { el[id] = document.getElementById(id); });

  /* ────────── 主題列（依 TOPICS 生成按鈕，學生可隨時自行轉主題） ────────── */
  function renderTopics() {
    el.topicGrid.innerHTML = '';
    TOPICS.forEach(function (t, i) {
      var b = document.createElement('button');
      b.className = 'topic-btn' + (t.id === state.topicId ? ' active' : '');
      b.type = 'button';
      b.title = zh() ? (t.en || '') : (t.name || '');
      b.innerHTML = '<span class="num">' + (i + 1) + '</span><span>' + fTopic(t) + '</span>';
      b.addEventListener('click', function () { switchTopic(t.id); });
      el.topicGrid.appendChild(b);
    });
  }

  /* ────────── 難度等級列（全部／LV1／LV2／LV3） ────────── */
  function renderLevels() {
    if (!el.levelRow) return;
    var pool = currentTopic().questions || [];
    var counts = { 0: pool.length, 1: 0, 2: 0, 3: 0 };
    pool.forEach(function (q) { if (counts[q.lv] !== undefined) counts[q.lv]++; });

    el.levelRow.innerHTML = '';
    [0, 1, 2, 3].forEach(function (lv) {
      var b = document.createElement('button');
      b.type = 'button';
      var label = lv === 0 ? T('levelAll') : ('LV' + lv);
      b.className = 'level-btn' + (state.level === lv ? ' active' : '') + (counts[lv] ? '' : ' empty');
      b.innerHTML = label + '<span class="cnt">' + counts[lv] + '</span>';
      if (!counts[lv] && lv !== 0) b.title = T('levelRunOut');
      b.addEventListener('click', function () { setLevel(lv); });
      el.levelRow.appendChild(b);
    });
  }

  function currentTopic() {
    return TOPICS.filter(function (t) { return t.id === state.topicId; })[0] || TOPICS[0];
  }

  function switchTopic(id) {
    if (id === state.topicId && state.current) return;
    state.topicId = id;
    lsSet(LS_TOPIC, id);
    renderTopics();
    renderLevels();
    newQuestion('switchMsg', { name: fTopic(currentTopic()) });
  }

  function setLevel(lv) {
    state.level = lv;
    lsSet(LS_LEVEL, lv);
    renderLevels();
    newQuestion(null);   /* 轉難度視為新一題（連續紀錄同樣保留） */
  }

  /* ────────── 火焰進度 ────────── */
  function renderFlames(douse) {
    el.flames.innerHTML = '';
    var lit = state.unlocked ? TARGET : state.streak;
    for (var i = 0; i < TARGET; i++) {
      var f = document.createElement('div');
      f.className = 'flame' + (i < lit ? ' lit' : '') + (douse ? ' doused' : '');
      f.textContent = i < lit ? '🔥' : '·';
      el.flames.appendChild(f);
    }
    el.streakText.textContent = state.unlocked
      ? T('streakInfinite', { total: state.totalCorrect })
      : T('streakProgress', { n: state.streak, target: TARGET });
  }

  function renderStats() {
    el.statTotal.textContent = state.totalCorrect;
    el.statWrong.textContent = state.wrongCount;
    el.statMode.textContent = state.unlocked ? T('modeInfinite') : T('modeChallenge');
    el.statMode.className = 'v badge' + (state.unlocked ? ' unlocked' : '');
    if (el.answerLabel) el.answerLabel.textContent = T('answerLabel');
  }

  function setStatusKey(kind, vars, cls) {
    state.statusKind = kind;
    state.statusVars = vars || {};
    state.statusCls = cls || '';
    renderStatus();
  }

  function renderStatus() {
    var keyMap = {
      default: 'statusDefault',
      win: 'statusWin',
      infiniteCorrect: 'statusInfiniteCorrect',
      next: 'statusNext',
      broke: 'statusBroke',
      brokeWas: 'statusBrokeWas',
      infiniteWrong: 'statusInfiniteWrong',
      switchMsg: 'switchMsg',
      resetMsg: 'resetMsg'
    };
    var vars = {};
    Object.keys(state.statusVars).forEach(function (k) { vars[k] = state.statusVars[k]; });
    if (vars.target === undefined) vars.target = TARGET;
    /* v6：AI 出題的狀態（aiNotReady / aiFailed / aiGeneratingStatus）直接以 kind 當 i18n key */
    el.statusLine.textContent = T(keyMap[state.statusKind] || state.statusKind || 'statusDefault', vars);
    el.statusLine.className = 'status-line' + (state.statusCls ? ' ' + state.statusCls : '');
  }

  function defaultStatus() {
    if (state.unlocked) setStatusKey('win', {}, 'win');
    else setStatusKey('default', {}, '');
  }

  /* ────────── 出題 ────────── */
  function levelPool() {
    var pool = currentTopic().questions || [];
    return state.level ? pool.filter(function (q) { return q.lv === state.level; }) : pool;
  }

  function pickQuestion() {
    var pool = levelPool();
    if (!pool.length) return null;
    if (pool.length === 1) return pool[0];
    var q = pool[Math.floor(Math.random() * pool.length)];
    var guard = 0;
    while (state.current && q.id === state.current.id && guard++ < 20) {
      q = pool[Math.floor(Math.random() * pool.length)];
    }
    return q;
  }

  function newQuestion(statusKind, statusVars) {
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
    state.aiSeq++;                    /* 令未完成的 AI 生成結果失效（使用者已換題） */
    state.answered = false;
    state.revealed = false;
    state.fbKind = null;
    state.fbDetail = null;

    el.feedback.hidden = true;
    el.feedback.className = 'feedback';
    el.feedback.innerHTML = '';
    el.solution.hidden = true;
    el.solutionBody.innerHTML = '';
    el.btnNext.hidden = true;
    el.qLevel.hidden = true;

    /* AI 出題模式：改用 AI 題目（失敗或未設定時自動退回題庫題） */
    if (state.aiOn && AI) { aiQuestion(statusKind, statusVars); return; }

    state.current = pickQuestion();
    paintQuestion(statusKind, statusVars);
  }

  /* 依 state.current 畫出題目（題庫題與 AI 題共用；不改變作答狀態） */
  function paintQuestion(statusKind, statusVars) {
    if (!state.current) {
      el.topicTag.textContent = T('topicLine', { name: fTopic(currentTopic()), count: currentTopic().questions.length });
      el.qSub.textContent = '';
      el.qSub.hidden = true;
      el.questionText.innerHTML = '<span class="qtag">' + T('qLabel') + '</span><br>' +
        T('missingBank', { file: currentTopic().id });
      el.answerInput.disabled = true;
      el.btnSubmit.disabled = true;
      el.btnNext.hidden = true;
      renderAiBadge();
      renderReviewUI();
      renderFlames(false);
      renderStats();
      if (statusKind) setStatusKey(statusKind, statusVars, '');
      else defaultStatus();
      return;
    }

    el.qSub.hidden = false;
    el.answerInput.value = '';
    el.answerInput.disabled = false;
    el.btnSubmit.disabled = false;
    renderAiBadge();
    renderReviewUI();
    el.answerInput.focus();

    renderQuestionCard();
    renderFlames(false);
    renderStats();
    if (statusKind) setStatusKey(statusKind, statusVars, '');
    else defaultStatus();
  }

  /* 只重畫題目卡（不改變作答狀態、不清空輸入） */
  function renderQuestionCard() {
    var q = state.current;
    var t = currentTopic();
    el.topicTag.textContent = T('topicLine', { name: fTopic(t), count: t.questions.length });
    el.qSub.textContent = fSub(q) || '';
    el.qSub.hidden = !fSub(q);
    if (q.lv) {
      el.qLevel.hidden = false;
      el.qLevel.textContent = 'LV' + q.lv;
      el.qLevel.className = 'lv-badge lv' + q.lv;
      el.qLevel.setAttribute('title', T('badgeTitle', { lv: q.lv }));
    } else {
      el.qLevel.hidden = true;
    }
    el.questionText.innerHTML = '<span class="qtag">' + T('qLabel') + '</span><br>' + G.mathify(fQ(q));
    /* AI 圖形題：結構化規格或白名單 SVG（ai.js 負責產生／過濾） */
    if (el.questionFigure) {
      var figHtml = (q.figure && AI) ? AI.renderFigureHtml(q.figure) : '';
      el.questionFigure.innerHTML = figHtml;
      el.questionFigure.hidden = !figHtml;
    }
    el.hintBox.innerHTML = T('hintPrefix') + G.mathify(fHint(q));
    /* 原文題（方案 A）通常沒有 hint：不要把「提示」按鈕留在畫面上按出空白框 */
    if (el.btnShowHint) {
      var hasHint = !!(q.hint || q.hintEn);
      el.btnShowHint.hidden = !hasHint;
      if (!hasHint) el.hintBox.hidden = true;
    }
  }

  /* ────────── v6 · AI 出題 ──────────
     · 開關狀態存 localStorage('m2.ai.on')；服務商／端點／模型／Key 由 ai.js 存 m2ai.settings
     · 出題流程：先取 ai.js 的題目快取（同主題同難度）→ 沒有就即時生成
       → 未設定或失敗就自動退回題庫題，並在狀態列說明原因
     · AI 題目一樣帶 answer.accept，直接交由 grader.js 批改，故同樣計入連續答對與火焰；
       證明／論述題（answer.type = 'show'）走原有的「看解答」流程，不影響紀錄。 */
  function renderAiBadge() {
    if (!el.qAiBadge) return;
    var q = state.current;
    var show = !!(q && q.ai);
    el.qAiBadge.hidden = !show;
    if (!show) { el.qAiBadge.textContent = ''; return; }
    var label = T('aiTag');
    if (AI && AI.TYPE_BY_ID[q.type]) label += ' · ' + (zh() ? AI.TYPE_BY_ID[q.type].zh : AI.TYPE_BY_ID[q.type].en);
    el.qAiBadge.textContent = label;
  }

  function aiPoolKey() {
    return AI.poolKey({ topicId: state.topicId, lv: state.level, types: [] });
  }

  function aiProviderLabel(s) {
    var p = AI.PROVIDERS[s.provider];
    return (p && p.label) || s.model || s.provider || '';
  }

  function aiStatusText() {
    return T('aiStatusOn', { provider: aiProviderLabel(AI.getSettings()), n: AI.poolSize(aiPoolKey()) });
  }

  function aiSetStatus(text, cls) {
    if (!el.aiStatus) return;
    el.aiStatus.textContent = text || '';
    el.aiStatus.hidden = !text;
    el.aiStatus.className = 'ai-status' + (cls ? ' ' + cls : '');
  }

  function aiApplyToggle() {
    if (el.btnAiToggle) el.btnAiToggle.setAttribute('aria-pressed', state.aiOn ? 'true' : 'false');
    if (el.aiToggleText) el.aiToggleText.textContent = T(state.aiOn ? 'aiOn' : 'aiOff');
  }

  /* 送給 ai.js 的出題參數：沿用目前主題、小主題與難度 */
  function aiOpts() {
    var t = currentTopic();
    var subs = [];
    (t.questions || []).forEach(function (q) {
      var s = q.sub || q.subEn;
      if (s && subs.indexOf(s) < 0) subs.push(s);
    });
    return {
      settings: AI.getSettings(),
      topicId: state.topicId,
      topicName: t.name || state.topicId,
      topicNameEn: t.en || t.name || state.topicId,
      lv: state.level,
      types: [],                   /* 空 = 由 ai.js 決定可用題型 */
      count: 2,
      subs: subs.slice(0, 8)
    };
  }

  /* 背景預取：讓下一題即時出現，不阻塞目前作答 */
  function aiPrefetch() {
    if (!state.aiOn || !AI || state.aiBusy) return;
    var s = AI.getSettings();
    if (!s.autoPrefetch || !AI.ready(s).ok) return;
    var key = aiPoolKey();
    if (AI.poolSize(key) >= 2) return;
    state.aiBusy = true;
    AI.generate(aiOpts()).then(function (res) {
      state.aiBusy = false;
      if (res && res.ok) AI.pushPool(res.questions, key);
    }).catch(function () { state.aiBusy = false; });
  }

  /* 出題：快取 → 即時生成 → 退回題庫題 */
  function aiQuestion(statusKind, statusVars) {
    var key = aiPoolKey();
    var cached = AI.takeFromPool(key);
    if (cached) {
      state.current = cached;
      paintQuestion(statusKind, statusVars);
      aiPrefetch();
      return;
    }

    var rdy = AI.ready();
    if (!rdy.ok) {
      var why = AI.errorText(rdy.code).message;
      state.current = pickQuestion();
      paintQuestion('aiNotReady', { msg: why }, '');
      aiSetStatus(T('aiNotReady', { msg: why }), 'warn');
      return;
    }

    /* 生成中：清空題目卡並鎖住作答，避免顯示上一題 */
    state.current = null;
    el.topicTag.textContent = T('topicLine', { name: fTopic(currentTopic()), count: currentTopic().questions.length });
    el.qSub.textContent = '';
    el.qSub.hidden = true;
    el.qLevel.hidden = true;
    el.questionText.innerHTML = '<span class="qtag">' + T('qLabel') + '</span><br>' +
      '<span class="ai-gen">' + T('aiGenerating') + '</span>';
    if (el.questionFigure) { el.questionFigure.innerHTML = ''; el.questionFigure.hidden = true; }
    if (el.btnShowHint) el.btnShowHint.hidden = true;
    el.btnNext.hidden = true;
    el.answerInput.value = '';
    renderAiBadge();
    renderReviewUI();
    el.answerInput.disabled = true;
    el.btnSubmit.disabled = true;
    renderFlames(false);
    renderStats();
    if (statusKind) setStatusKey(statusKind, statusVars, '');
    else setStatusKey('aiGeneratingStatus', {}, 'warn');
    aiSetStatus(T('aiGeneratingStatus'), '');

    var seq = state.aiSeq;
    AI.generate(aiOpts()).then(function (res) {
      if (seq !== state.aiSeq) return;                 /* 使用者已換題／關掉 AI：丟棄結果 */
      if (!res.ok) {
        state.current = pickQuestion();
        paintQuestion();
        setStatusKey('aiFailed', { msg: res.message }, 'warn');
        aiSetStatus(T('aiFailed', { msg: res.message }), 'bad');
        return;
      }
      AI.pushPool(res.questions.slice(1), key);
      state.current = res.questions[0];
      paintQuestion();
      aiSetStatus(aiStatusText(), '');
      aiPrefetch();
    });
  }

  /* 開關（開啟時立即出題；關閉時保留目前題目，下一題起用題庫題） */
  function aiSetOn(on) {
    if (!AI) return;                  /* 未載入 ai.js 時整個功能停用 */
    state.aiOn = !!on;
    lsSet(LS_AI_ON, state.aiOn ? '1' : '0');
    aiApplyToggle();
    if (!state.aiOn) {
      aiSetStatus('', '');
      return;
    }
    var rdy = AI.ready();
    if (!rdy.ok) {
      aiSetStatus(T('aiNeedKey'), 'warn');
      openAiDialog();
      return;
    }
    newQuestion();
  }

  /* ── AI 設定對話框 ── */
  function aiPoolNote(extra) {
    if (!el.aiPoolNote) return;
    var n = AI.poolSize(aiPoolKey());
    el.aiPoolNote.textContent = (extra ? extra + ' ' : '') + (n ? T('aiPoolCount', { n: n }) : T('aiPoolNone'));
  }

  function fillAiForm() {
    var s = AI.getSettings();
    if (el.aiProvider) {
      if (!el.aiProvider.children.length) {
        Object.keys(AI.PROVIDERS).forEach(function (id) {
          var o = document.createElement('option');
          o.value = id;
          o.textContent = AI.PROVIDERS[id].label;
          el.aiProvider.appendChild(o);
        });
      }
      el.aiProvider.value = s.provider;
    }
    if (el.aiBase) el.aiBase.value = s.base || '';
    if (el.aiModel) el.aiModel.value = s.model || '';
    if (el.aiKey) el.aiKey.value = s.key || '';
    if (el.aiJson) el.aiJson.checked = !!s.jsonMode;
    if (el.aiAuto) el.aiAuto.checked = !!s.autoPrefetch;
    aiPoolNote();
  }

  function openAiDialog() {
    if (!el.aiDialog || !AI) return;
    fillAiForm();
    el.aiDialog.hidden = false;
  }

  function closeAiDialog() {
    if (el.aiDialog) el.aiDialog.hidden = true;
  }

  function aiProviderChanged() {
    if (!el.aiProvider) return;
    var d = AI.providerDefaults(el.aiProvider.value);
    if (el.aiBase) el.aiBase.value = d.base || '';
    if (el.aiModel) el.aiModel.value = d.model || '';
    if (el.aiJson) el.aiJson.checked = !!d.jsonMode;
  }

  function saveAiForm() {
    if (!AI) return;
    AI.saveSettings({
      provider: el.aiProvider ? el.aiProvider.value : AI.PROVIDERS.deepseek.id,
      base: el.aiBase ? String(el.aiBase.value).trim() : '',
      model: el.aiModel ? String(el.aiModel.value).trim() : '',
      key: el.aiKey ? String(el.aiKey.value).trim() : '',
      jsonMode: !!(el.aiJson && el.aiJson.checked),
      autoPrefetch: !!(el.aiAuto && el.aiAuto.checked)
    });
    closeAiDialog();
    var rdy = AI.ready();
    if (rdy.ok) {
      aiSetStatus(aiStatusText(), '');
      if (state.aiOn) newQuestion();          /* 已開啟 → 立即用新設定出題 */
    } else {
      aiSetStatus(T('aiNotReady', { msg: AI.errorText(rdy.code).message }), 'warn');
    }
  }

  function clearAiPool() {
    if (!AI) return;
    AI.clearPool();
    aiPoolNote(T('aiPoolCleared'));
    if (state.aiOn) aiSetStatus(aiStatusText(), '');
  }

  /* ────────── 解題展示 ────────── */
  /* 逐步解題的 HTML（練習模式與模擬試卷共用；每步都是 .sol-step，方便同一套樣式） */
  function solutionHtml(q) {
    var html = '';
    (q.sol || []).forEach(function (s) {
      html += '<div class="sol-step"><span class="mk">' + (s.mk || '·') + '</span><span class="tx">' +
        G.mathify(fTx(s)) + '</span></div>';
    });
    if (isRaw(q)) {                 /* 教材原文題（方案 A）：只提供標準答案，沒有逐步詳解與 DSE 評分說明 */
      html += '<div class="sol-note">' + T('rawNoSolution') + '</div>';
      return html;
    }
    if (fNote(q)) html += '<div class="sol-note">' + T('notePrefix') + G.mathify(fNote(q)) + '</div>';
    html += '<div class="sol-note">' + T('markingNote') + '</div>';
    return html;
  }

  function renderSolution() {
    var q = state.current;
    if (!q) return;
    if (el.solTitle) el.solTitle.textContent = T(isRaw(q) ? 'solTitleRaw' : 'solTitle');
    el.stdAnswer.innerHTML = G.mathify(fDisplay(q));
    el.solutionBody.innerHTML = solutionHtml(q);
    el.solution.hidden = false;
  }

  /* ────────── 溫習題（證明／論述題，review: true 或 answer.type === 'show'） ──────────
     這類題目無法短答：隱藏輸入框與「提交答案」，改為提示 + 「看解答」按鈕；
     它們完全不經 grader 批改，故不會改動連續答對、總答對、失手數。 */
  function isReview(q) {
    return !!q && (q.review === true || (q.answer && q.answer.type === 'show'));
  }

  /* 教材原文題（方案 A 收錄）：raw: true，只有英文原文與標準答案，沒有逐步詳解 */
  function isRaw(q) {
    return !!q && q.raw === true;
  }

  function renderReviewUI() {
    var rv = isReview(state.current);
    if (el.answerLabel) el.answerLabel.hidden = rv;
    if (el.answerInputRow) el.answerInputRow.hidden = rv;
    if (el.reviewNotice) el.reviewNotice.textContent = T(isRaw(state.current) ? 'rawNotice' : 'reviewNotice');
    if (el.btnReveal) {
      el.btnReveal.textContent = T('btnReveal');
      el.btnReveal.hidden = !rv || state.revealed;
    }
    if (el.reviewBox) el.reviewBox.hidden = !rv || state.revealed;
    if (rv) {                       /* 只在此時停用；已作答的非溫習題不會被重新啟用 */
      if (el.answerInput) el.answerInput.disabled = true;
      if (el.btnSubmit) el.btnSubmit.disabled = true;
    }
  }

  /* 按「看解答」：顯示標準答案與逐步解題，隱藏提示與按鈕，直接給「下一題」 */
  function revealSolution() {
    if (!state.current || !isReview(state.current) || state.revealed) return;
    state.revealed = true;
    renderSolution();
    renderReviewUI();
    el.btnNext.hidden = false;
    el.btnNext.textContent = T('btnNext');
  }

  /* ────────── 私用版標示（只在載入了 bank-local 原文題時顯示） ────────── */
  function hasLocalBank() {
    var root = (typeof window !== 'undefined' ? window : globalThis);
    var bank = root.M2BankLocal;
    if (!bank || typeof bank !== 'object') return false;
    return Object.keys(bank).some(function (k) {
      return bank[k] && bank[k].length;
    });
  }

  function renderLocalBadge() {
    if (!el.localBadge) return;
    var local = hasLocalBank();
    el.localBadge.hidden = !local;
    el.localBadge.textContent = T('localBadge');
    /* 私用版含教材原文題：頁尾聲明要如實改寫（公開版維持「題目並非教材原文」） */
    if (local && el.footerPrivacy) el.footerPrivacy.textContent = T('footerPrivacyLocal');
  }

  /* ────────── 提交與批改 ────────── */
  function submitAnswer() {
    if (state.answered || !state.current) return;
    if (isReview(state.current)) return;   /* 溫習題不經 grader 批改 */
    var raw = el.answerInput.value;
    if (!raw.trim()) { el.answerInput.focus(); return; }

    var res = G.grade(state.current, raw);
    state.answered = true;
    el.answerInput.disabled = true;
    el.btnSubmit.disabled = true;

    if (res.ok) onCorrect();
    else onWrong(res);
  }

  function onCorrect() {
    state.totalCorrect++;
    state.fbKind = 'ok';
    state.fbCls = 'feedback ok';

    if (state.unlocked) {
      state.fbDetail = { key: 'feedbackOkInfinite', vars: { total: state.totalCorrect } };
      setStatusKey('infiniteCorrect', { total: state.totalCorrect }, 'win');
    } else {
      state.streak++;
      if (state.streak >= TARGET) {
        state.unlocked = true;
        state.fbDetail = { key: 'feedbackOkWin', vars: { target: TARGET } };
        setStatusKey('win', {}, 'win');
      } else {
        state.fbDetail = { key: 'feedbackOkDetail', vars: { n: state.streak, target: TARGET } };
        setStatusKey('next', { n: state.streak, target: TARGET, left: TARGET - state.streak }, '');
      }
    }

    renderFeedback();
    renderFlames(false);
    renderStats();
    el.btnNext.hidden = false;
    el.btnNext.textContent = T('btnNext');
    state.timer = setTimeout(function () { if (state.answered) newQuestion(); }, 2000);
  }

  function onWrong(res) {
    state.wrongCount++;
    var wasStreak = state.streak;
    var broke = !state.unlocked && wasStreak > 0;
    if (!state.unlocked) state.streak = 0;

    state.fbKind = 'bad';
    state.fbCls = 'feedback bad';

    var detail;
    if (res.reason === 'missing-C') detail = { key: 'detailMissingC', vars: {} };
    else if (res.reason === 'empty') detail = { key: 'detailGeneric', vars: {} };
    else if (res.reason === 'num-wrong' || res.reason === 'numbers-wrong') {
      var hasVal = res.value !== null && res.value !== undefined && !Array.isArray(res.value);
      detail = hasVal ? { key: 'detailNumWrongValue', vars: { value: res.value } } : { key: 'detailNumWrong', vars: {} };
    } else detail = { key: 'detailGeneric', vars: {} };

    if (state.unlocked) {
      detail = { key: detail.key, vars: detail.vars, suffix: 'detailInfiniteSuffix' };
      setStatusKey('infiniteWrong', {}, '');
    } else if (broke) {
      setStatusKey('brokeWas', { was: wasStreak, target: TARGET }, 'lose');
    } else {
      setStatusKey('broke', {}, 'lose');
    }

    state.fbDetail = detail;
    renderFeedback();
    renderFlames(broke && wasStreak > 0);
    renderStats();
    renderSolution();
    el.btnNext.hidden = false;
    el.btnNext.textContent = T('btnNext');
  }

  function renderFeedback() {
    if (!state.fbKind) return;
    var d = state.fbDetail || {};
    var detail = d.key ? T(d.key, d.vars) : '';
    if (d.suffix) detail += T(d.suffix);
    el.feedback.hidden = false;
    el.feedback.className = state.fbCls;
    el.feedback.innerHTML = (state.fbKind === 'ok' ? T('feedbackOk') : T('feedbackWrong')) +
      '<span class="detail">' + detail + '</span>';
  }

  function nextQuestion() {
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
    newQuestion();
  }

  function resetGame() {
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
    state.streak = 0;
    state.totalCorrect = 0;
    state.wrongCount = 0;
    state.unlocked = false;
    state.current = null;
    newQuestion('resetMsg', {});
  }

  /* ══════════════════════════════════════════════════════════════════
     v5 · 模擬試卷模式（Mock Paper）
     · 完全獨立於練習模式：不呼叫 newQuestion()，亦不碰 streak／
       totalCorrect／wrongCount／unlocked，練習模式的 DOM 與狀態保持原封不動。
     · 由 window.M2Papers 讀卷（CORPUS-SPEC §8）：
         root.M2Papers['sy-f5-2022-23'] =
           { id, name, en, durationMin, totalMarks, questions: [{ id, marks }] }
     ══════════════════════════════════════════════════════════════════ */

  var LS_PAPER = 'm2.paper.progress';   /* 未交卷進度（localStorage，讀寫全部 try/catch 保護） */

  /* 等第門檻（得分率百分比 → 等第）：由高至低比對，第一個達標者為準，其餘 U。
     5** ≥ 85、5* ≥ 75、5 ≥ 65、4 ≥ 55、3 ≥ 45、2 ≥ 35、1 ≥ 25（與 i18n 的 reportGradeNote 一致）。 */
  var GRADE_CUTS = [
    { min: 85, grade: '5**' },
    { min: 75, grade: '5*' },
    { min: 65, grade: '5' },
    { min: 55, grade: '4' },
    { min: 45, grade: '3' },
    { min: 35, grade: '2' },
    { min: 25, grade: '1' }
  ];
  var WARN_SEC = 5 * 60;   /* 剩 5 分鐘開始變色警示 */

  var paper = {
    list: [],       /* 已載入的試卷（依 id 排序） */
    id: null,
    paper: null,    /* 目前試卷物件 */
    order: [],      /* [{ id, marks, q }]；q === null 代表題庫找不到該題 */
    idx: 0,         /* 目前題號索引 */
    rec: {},        /* 題目 id → { state:'correct'|'wrong'|'self', score, marks, raw } */
    draft: {},      /* 題目 id → 未提交的輸入草稿 */
    marked: {},     /* 題目 id → true（已標記） */
    running: false, /* 是否正在作答（未交卷） */
    handed: false,  /* 是否已交卷 */
    auto: false,    /* 是否時間到自動交卷 */
    left: null,     /* 剩餘秒數；null = 不限時 */
    lastTick: 0,
    timer: null,
    view: 'list'    /* list | exam | report */
  };

  /* ────────── 讀卷 ────────── */
  function fPaperName(p) {
    if (!p) return T('paperUnnamed');
    return zh() ? (p.name || p.en || T('paperUnnamed')) : (p.en || p.name || T('paperUnnamed'));
  }

  function paperMarks(p) {
    if (!p) return 0;
    if (typeof p.totalMarks === 'number') return p.totalMarks;
    var sum = 0;
    (p.questions || []).forEach(function (it) { if (typeof it.marks === 'number') sum += it.marks; });
    return sum;
  }

  function collectPapers() {
    var root = (typeof window !== 'undefined' ? window : globalThis);
    var src = root.M2Papers;
    if (!src || typeof src !== 'object') return [];
    var out = [];
    Object.keys(src).forEach(function (k) {
      var p = src[k];
      if (!p || typeof p !== 'object') return;
      if (!p.id) p.id = k;
      out.push(p);
    });
    out.sort(function (a, b) { return String(a.id) < String(b.id) ? -1 : 1; });
    return out;
  }

  /* 依題目 id 在已載入的題庫（TOPICS）找回題目物件 */
  function findQuestion(id) {
    for (var i = 0; i < TOPICS.length; i++) {
      var qs = TOPICS[i].questions || [];
      for (var j = 0; j < qs.length; j++) if (qs[j].id === id) return qs[j];
    }
    return null;
  }

  function buildOrder(p) {
    return (p.questions || []).map(function (it) {
      var mk = (typeof it.marks === 'number' && isFinite(it.marks)) ? it.marks : 0;
      return { id: it.id, marks: mk, q: findQuestion(it.id) };
    });
  }

  /* ────────── 未交卷進度（localStorage） ────────── */
  function saveProgress() {
    if (!paper.running) return;
    try {
      lsSet(LS_PAPER, JSON.stringify({
        v: 1, paperId: paper.id, idx: paper.idx, left: paper.left,
        rec: paper.rec, draft: paper.draft, marked: paper.marked
      }));
    } catch (e) { /* 儲存失敗（私密模式等）不影響作答 */ }
  }

  function readProgress() {
    try {
      var raw = lsGet(LS_PAPER, null);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || d.v !== 1 || !d.paperId) return null;
      return d;
    } catch (e) { return null; }
  }

  function clearProgress() {
    try { if (window.localStorage) window.localStorage.removeItem(LS_PAPER); } catch (e) { /* 略 */ }
  }

  /* ────────── 計時器 ────────── */
  function two(n) { return (n < 10 ? '0' : '') + n; }

  function clockText(sec) {
    if (sec === null || sec === undefined) return T('examNoTimeLimit');
    var s = Math.max(0, Math.round(sec));
    return two(Math.floor(s / 60)) + ':' + two(s % 60);
  }

  function renderExamTimer() {
    if (!el.examTimer) return;
    el.examTimer.textContent = clockText(paper.left);
    var warn = paper.left !== null && paper.left <= WARN_SEC && paper.running;
    el.examTimer.className = 'exam-timer' + (warn ? ' warn' : '');
    el.examTimer.setAttribute('title', warn ? T('examTimeWarnTitle', { min: Math.max(1, Math.ceil(paper.left / 60)) }) : '');
  }

  function stopPaperTimer() {
    if (paper.timer) { clearTimeout(paper.timer); paper.timer = null; }
  }

  /* 用「實際經過時間」扣秒（背景分頁被節流時仍準確），但每次至少扣 1 秒，
     令假計時器（測試）可以逐格推進。 */
  function tickPaperTimer() {
    paper.timer = null;
    if (!paper.running || paper.left === null) return;
    var now = Date.now();
    var elapsed = Math.round((now - paper.lastTick) / 1000);
    if (elapsed < 1) elapsed = 1;
    paper.lastTick = now;
    paper.left = Math.max(0, paper.left - elapsed);
    renderExamTimer();
    if (paper.left <= 0) { handInPaper(true); return; }   /* 時間到 → 自動交卷 */
    saveProgress();
    paper.timer = setTimeout(tickPaperTimer, 1000);
  }

  function startPaperTimer() {
    stopPaperTimer();
    if (paper.left === null) return;
    paper.lastTick = Date.now();
    paper.timer = setTimeout(tickPaperTimer, 1000);
  }

  /* ────────── 面板切換（只改 hidden，不破壞任何既有 DOM） ────────── */
  function showPaperPanel(which) {
    paper.view = which;
    if (el.paperListPanel) el.paperListPanel.hidden = which !== 'list';
    if (el.examPanel) el.examPanel.hidden = which !== 'exam';
    if (el.reportPanel) el.reportPanel.hidden = which !== 'report';
  }

  /* 模式切換：練習模式／模擬試卷。練習模式的所有狀態（火焰、連續紀錄、目前題目）完全不動。 */
  function setMode(mode) {
    if (mode === 'practice' && paper.running) {
      /* 考試進行中仍然可以回練習模式（計時會暫停、進度已存），離開前先確認 */
      if (!askConfirm('confirmQuitPaper')) return;
      stopPaperTimer();               /* 未交卷進度保留在 localStorage，下次入卷可續答 */
    }
    var isPaper = mode === 'paper';
    if (el.practiceMode) el.practiceMode.hidden = isPaper;
    if (el.paperMode) el.paperMode.hidden = !isPaper;
    if (el.btnModePractice) el.btnModePractice.className = 'mode-btn' + (!isPaper ? ' active' : '');
    if (el.btnModePaper) el.btnModePaper.className = 'mode-btn' + (isPaper ? ' active' : '');
    if (isPaper) {
      renderPaperUI();
      if (paper.running) showPaperPanel('exam');
      else if (paper.handed) showPaperPanel('report');
      else showPaperPanel('list');
    }
  }

  /* ────────── 選卷畫面 ────────── */
  function renderPaperList() {
    if (!el.paperList) return;
    paper.list = collectPapers();
    el.paperList.innerHTML = '';
    if (!paper.list.length) {
      if (el.paperEmpty) el.paperEmpty.hidden = false;   /* 冇試卷 → 顯示友善提示，不會留白 */
      return;
    }
    if (el.paperEmpty) el.paperEmpty.hidden = true;

    paper.list.forEach(function (p) {
      var card = document.createElement('div');
      card.className = 'paper-card';

      var name = document.createElement('div');
      name.className = 'paper-card-name';
      name.textContent = fPaperName(p);
      card.appendChild(name);

      var meta = document.createElement('div');
      meta.className = 'paper-card-meta';
      [T('paperQuestionsCount', { n: (p.questions || []).length }),
       T('paperMarksCount', { n: paperMarks(p) }),
       (typeof p.durationMin === 'number' && p.durationMin > 0) ? T('paperDuration', { min: p.durationMin }) : T('examNoTimeLimit')
      ].forEach(function (txt) {
        var chip = document.createElement('span');
        chip.className = 'exam-chip';
        chip.textContent = txt;
        meta.appendChild(chip);
      });
      card.appendChild(meta);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'primary-btn';
      btn.textContent = T('btnPaperStart');
      btn.addEventListener('click', function () { startPaper(p.id); });
      card.appendChild(btn);

      el.paperList.appendChild(card);
    });
  }

  /* ────────── 開始作答 ────────── */
  function startPaper(id) {
    var found = null;
    paper.list.forEach(function (p) { if (p.id === id) found = p; });
    if (!found) return;
    var saved = readProgress();
    var order = buildOrder(found);
    if (!order.length) return;         /* 空卷（冇題目）不進入作答畫面 */

    stopPaperTimer();
    paper.id = found.id;
    paper.paper = found;
    paper.order = order;
    paper.idx = 0;
    paper.rec = {};
    paper.draft = {};
    paper.marked = {};
    paper.auto = false;
    paper.handed = false;
    paper.left = (typeof found.durationMin === 'number' && found.durationMin > 0)
      ? Math.round(found.durationMin * 60) : null;

    /* 同一份卷有未交卷進度就接住（題號、剩餘時間、已答題目、草稿、標記） */
    if (saved && saved.paperId === found.id && (saved.left === null || saved.left > 0)) {
      paper.idx = Math.min(Math.max(0, saved.idx | 0), order.length - 1);
      paper.left = (saved.left === null) ? null : Math.max(1, saved.left | 0);
      paper.rec = (saved.rec && typeof saved.rec === 'object') ? saved.rec : {};
      paper.draft = (saved.draft && typeof saved.draft === 'object') ? saved.draft : {};
      paper.marked = (saved.marked && typeof saved.marked === 'object') ? saved.marked : {};
    }

    paper.running = true;
    showPaperPanel('exam');
    renderExam();
    startPaperTimer();
    saveProgress();
    if (el.examAnswerInput && !isReview(currentQ())) el.examAnswerInput.focus();
  }

  function currentItem() { return paper.order[paper.idx] || null; }
  function currentQ() { var it = currentItem(); return it ? it.q : null; }
  function recOf(id) { return paper.rec[id] || null; }
  function answeredState(id) { var r = recOf(id); return r ? r.state : 'unanswered'; }

  /* 換題前把未提交的輸入存成草稿（切換題目／交卷時用） */
  function stashDraft() {
    var it = currentItem();
    if (!it || !it.q || !el.examAnswerInput) return;
    if (isReview(it.q)) return;
    var v = String(el.examAnswerInput.value || '');
    if (v.trim()) paper.draft[it.id] = v; else delete paper.draft[it.id];
  }

  /* ────────── 作答畫面 ────────── */
  function renderExamNav() {
    if (!el.examNav) return;
    el.examNav.innerHTML = '';
    paper.order.forEach(function (it, i) {
      var st = answeredState(it.id);
      var b = document.createElement('button');
      b.type = 'button';
      /* 三態可辨：未作答（預設）／已作答（.answered）／已標記（.marked），當前題另有 .current */
      b.className = 'nav-btn' + (st !== 'unanswered' ? ' answered' : '') +
        (paper.marked[it.id] ? ' marked' : '') + (i === paper.idx ? ' current' : '');
      b.textContent = String(i + 1);
      b.setAttribute('title', paper.marked[it.id] ? T('navLegendMarked')
        : (st !== 'unanswered' ? T('navLegendAnswered') : T('navLegendUnanswered')));
      b.addEventListener('click', function () { gotoPaperQ(i); });
      el.examNav.appendChild(b);
    });
    if (el.lgUnanswered) el.lgUnanswered.textContent = T('navLegendUnanswered');
    if (el.lgAnswered) el.lgAnswered.textContent = T('navLegendAnswered');
    if (el.lgMarked) el.lgMarked.textContent = T('navLegendMarked');
  }

  function renderExamFeedback() {
    if (!el.examFeedback) return;
    var it = currentItem();
    var r = it ? recOf(it.id) : null;
    if (!r || r.state === 'unanswered') {
      el.examFeedback.hidden = true;
      el.examFeedback.className = 'feedback';
      el.examFeedback.innerHTML = '';
      return;
    }
    var ok = r.state === 'correct';
    var main = r.state === 'self' ? T('reportSelf') : (ok ? T('feedbackOk') : T('feedbackWrong'));
    el.examFeedback.hidden = false;
    el.examFeedback.className = 'feedback ' + (ok ? 'ok' : (r.state === 'self' ? '' : 'bad'));
    el.examFeedback.innerHTML = main + '<span class="detail">' +
      T('marksLabel', { n: r.score + ' / ' + r.marks }) + '</span>';
  }

  function renderExamAnswerArea() {
    var it = currentItem();
    if (!it) return;
    var q = it.q;
    var rv = !q || isReview(q);           /* 溫習題／找不到的題目：不設輸入框 */
    var r = recOf(it.id);
    var done = !!r && r.state !== 'unanswered';

    if (el.examAnswerLabel) { el.examAnswerLabel.hidden = rv; el.examAnswerLabel.textContent = T('answerLabel'); }
    if (el.examAnswerRow) el.examAnswerRow.hidden = rv;
    if (el.examReviewBox) el.examReviewBox.hidden = !rv;
    if (el.examReviewNotice) el.examReviewNotice.textContent = T('reviewSelfNotice');
    if (el.examSelfPrompt) el.examSelfPrompt.textContent = T('reviewSelfPrompt');
    if (el.btnExamReveal) el.btnExamReveal.textContent = T('btnReveal');
    if (el.btnExamHint) el.btnExamHint.textContent = T('btnHint');
    if (el.btnExamSubmitOne) {
      el.btnExamSubmitOne.textContent = T('btnPaperSubmitOne');
      el.btnExamSubmitOne.disabled = done || rv;
    }
    if (el.btnSelfFull) { el.btnSelfFull.textContent = T('btnSelfFull'); el.btnSelfFull.disabled = !rv; }
    if (el.btnSelfZero) { el.btnSelfZero.textContent = T('btnSelfZero'); el.btnSelfZero.disabled = !rv; }
    if (el.examAnswerInput) {
      el.examAnswerInput.disabled = done || rv;
      el.examAnswerInput.value = rv ? '' : (paper.draft[it.id] || '');
    }
    if (el.examSelfRecorded) {
      if (r && r.state === 'self') {
        el.examSelfRecorded.hidden = false;
        el.examSelfRecorded.textContent = T('selfScoreRecorded', { score: r.score, marks: r.marks });
      } else {
        el.examSelfRecorded.hidden = true;
        el.examSelfRecorded.textContent = '';
      }
    }
    /* 已作答（批改過或自評過）就直接展開標準解答，方便即時核對（與練習模式一致） */
    if (q && r) renderExamSolution();
  }

  function renderExam() {
    var it = currentItem();
    if (!it) return;
    var q = it.q;

    if (el.examPaperName) el.examPaperName.textContent = fPaperName(paper.paper);
    if (el.examProgress) el.examProgress.textContent = T('examProgress', { n: paper.idx + 1, total: paper.order.length });
    if (el.examMarks) el.examMarks.textContent = T('marksLabel', { n: it.marks });
    renderExamTimer();

    if (el.examQLevel) {
      if (q && q.lv) {
        el.examQLevel.hidden = false;
        el.examQLevel.textContent = 'LV' + q.lv;
        el.examQLevel.className = 'lv-badge lv' + q.lv;
        el.examQLevel.setAttribute('title', T('badgeTitle', { lv: q.lv }));
      } else {
        el.examQLevel.hidden = true;
      }
    }
    if (el.examQSub) el.examQSub.textContent = q ? (fSub(q) || '') : T('reportMissing');
    if (el.examQuestionText) {
      el.examQuestionText.innerHTML = '<span class="qtag">' + T('qLabel') + '</span><br>' +
        (q ? G.mathify(fQ(q)) : T('reportMissing'));
    }
    if (el.examHintBox) {
      el.examHintBox.innerHTML = q ? (T('hintPrefix') + G.mathify(fHint(q))) : '';
      el.examHintBox.hidden = true;
    }
    if (el.examSolution) el.examSolution.hidden = true;
    if (el.examSolutionBody) el.examSolutionBody.innerHTML = '';

    renderExamNav();
    renderExamAnswerArea();
    renderExamFeedback();

    if (el.btnPaperPrev) el.btnPaperPrev.disabled = paper.idx <= 0;
    if (el.btnPaperNext) el.btnPaperNext.disabled = paper.idx >= paper.order.length - 1;
    if (el.btnPaperMark) el.btnPaperMark.textContent = paper.marked[it.id] ? T('btnPaperUnmark') : T('btnPaperMark');
    if (el.btnPaperHandIn) el.btnPaperHandIn.textContent = T('btnPaperHandIn');
    if (el.btnExamToList) el.btnExamToList.textContent = T('paperSecTitle');
  }

  function renderExamSolution() {
    var it = currentItem();
    if (!it || !it.q) return;
    if (el.examStdAnswer) el.examStdAnswer.innerHTML = G.mathify(fDisplay(it.q));
    if (el.examSolutionBody) el.examSolutionBody.innerHTML = solutionHtml(it.q);
    if (el.examSolution) el.examSolution.hidden = false;
  }

  /* ────────── 作答動作 ────────── */
  function gotoPaperQ(i) {
    if (!paper.running) return;
    if (i < 0 || i >= paper.order.length) return;
    stashDraft();
    var wasReview = isReview(currentQ());
    paper.idx = i;
    renderExam();
    if (el.examAnswerInput && !wasReview && !isReview(currentQ())) el.examAnswerInput.focus();
    saveProgress();
  }

  function paperPrev() { gotoPaperQ(paper.idx - 1); }
  function paperNext() { gotoPaperQ(paper.idx + 1); }

  function togglePaperMark() {
    var it = currentItem();
    if (!it || !paper.running) return;
    if (paper.marked[it.id]) delete paper.marked[it.id]; else paper.marked[it.id] = true;
    renderExamNav();
    if (el.btnPaperMark) el.btnPaperMark.textContent = paper.marked[it.id] ? T('btnPaperUnmark') : T('btnPaperMark');
    saveProgress();
  }

  /* 提交此題：輸入批改沿用 M2Grader（與練習模式同一套批改器） */
  function submitPaperOne() {
    var it = currentItem();
    if (!it || !it.q || !paper.running) return;
    if (isReview(it.q)) return;
    var r = recOf(it.id);
    if (r && r.state !== 'unanswered') return;
    var raw = el.examAnswerInput ? String(el.examAnswerInput.value || '') : '';
    if (!raw.trim()) { if (el.examAnswerInput) el.examAnswerInput.focus(); return; }

    var res = G.grade(it.q, raw);
    paper.rec[it.id] = {
      state: res.ok ? 'correct' : 'wrong',
      score: res.ok ? it.marks : 0,
      marks: it.marks,
      raw: raw
    };
    delete paper.draft[it.id];
    renderExamNav();
    renderExamAnswerArea();
    renderExamFeedback();
    saveProgress();
  }

  /* 溫習題（證明／論述題）自評：真人改卷才知分數，學生自選滿分或 0 分 */
  function selfMark(full) {
    var it = currentItem();
    if (!it || !paper.running) return;
    if (!isReview(it.q)) return;
    paper.rec[it.id] = { state: 'self', score: full ? it.marks : 0, marks: it.marks, raw: '' };
    renderExamNav();
    renderExamAnswerArea();
    renderExamFeedback();
    saveProgress();
  }

  function revealExamSolution() {
    var it = currentItem();
    if (!it || !isReview(it.q)) return;
    renderExamSolution();
  }

  /* ────────── 交卷與報告 ────────── */
  function askConfirm(key) {
    /* 無 confirm（測試沙箱／部分環境）時直接繼續，不會卡住流程 */
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') return true;
    try { return window.confirm(T(key)); } catch (e) { return true; }
  }

  function handInPaper(auto) {
    if (!paper.running) return;
    if (!auto && !askConfirm('confirmHandIn')) return;   /* 手動交卷需確認 */
    stashDraft();
    stopPaperTimer();
    paper.running = false;
    paper.handed = true;
    paper.auto = !!auto;
    clearProgress();
    renderReport();
    showPaperPanel('report');
  }

  function paperScore() {
    var got = 0, full = 0;
    paper.order.forEach(function (it) {
      full += it.marks;
      var r = recOf(it.id);
      if (r && typeof r.score === 'number') got += r.score;
    });
    return { got: got, full: full };
  }

  function gradeOf(pct) {
    for (var i = 0; i < GRADE_CUTS.length; i++) {
      if (pct >= GRADE_CUTS[i].min) return GRADE_CUTS[i].grade;
    }
    return 'U';
  }

  function renderReportTable() {
    if (!el.reportHead || !el.reportBody) return;
    var head = (I && I.t) ? I.t('reportTableHead') : null;
    if (!head || !head.length) head = ['#', '', '', '', ''];

    el.reportHead.innerHTML = '';
    var tr = document.createElement('tr');
    head.forEach(function (h) {
      var th = document.createElement('th');
      th.textContent = h;
      tr.appendChild(th);
    });
    el.reportHead.appendChild(tr);

    el.reportBody.innerHTML = '';
    paper.order.forEach(function (it, i) {
      var r = recOf(it.id);
      var state = r ? r.state : 'unanswered';
      var score = (r && typeof r.score === 'number') ? r.score : 0;
      var result = state === 'correct' ? T('reportCorrect')
        : state === 'wrong' ? T('reportWrong')
        : state === 'self' ? T('reportSelf')
        : T('reportUnanswered');

      var row = document.createElement('tr');
      row.className = 'report-row ' + state;
      [[String(i + 1), 'cell-no'],
       [it.q ? (fSub(it.q) || '') : T('reportMissing'), 'cell-sub'],
       [String(score), 'cell-score'],
       [String(it.marks), 'cell-marks'],
       [result, 'cell-res']
      ].forEach(function (c) {
        var td = document.createElement('td');
        td.className = c[1];
        td.textContent = c[0];
        row.appendChild(td);
      });

      /* 每題都可以即時看標準解答（按鈕放在「結果」格內） */
      var last = row.children[row.children.length - 1];
      if (it.q) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ghost-btn tiny';
        btn.textContent = T('reportViewSolution');
        btn.addEventListener('click', function () { renderReportSolution(it.q); });
        last.appendChild(btn);
      } else {
        var none = document.createElement('span');
        none.className = 'sol-none';
        none.textContent = T('reportNoSolution');
        last.appendChild(none);
      }
      el.reportBody.appendChild(row);
    });
  }

  function renderReportSolution(q) {
    if (!q) return;
    if (el.reportStdAnswer) el.reportStdAnswer.innerHTML = G.mathify(fDisplay(q));
    if (el.reportSolutionBody) el.reportSolutionBody.innerHTML = solutionHtml(q);
    if (el.reportSolution) el.reportSolution.hidden = false;
  }

  function renderReport() {
    var s = paperScore();
    var pct = s.full > 0 ? Math.round(s.got / s.full * 100) : 0;
    var grade = gradeOf(pct);

    if (el.reportPaperName) el.reportPaperName.textContent = fPaperName(paper.paper);
    if (el.reportNote) {
      el.reportNote.hidden = !paper.auto;
      el.reportNote.textContent = paper.auto ? T('examTimeUp') : '';
    }
    if (el.reportSummary) {
      el.reportSummary.innerHTML = '';
      [T('reportTotal', { score: s.got, total: s.full }),
       T('reportPercent', { pct: pct }),
       T('reportGrade', { grade: grade })
      ].forEach(function (txt) {
        var sp = document.createElement('span');
        sp.className = 'report-chip';
        sp.textContent = txt;
        el.reportSummary.appendChild(sp);
      });
    }
    if (el.reportGradeNote) el.reportGradeNote.textContent = T('reportGradeNote');
    renderReportTable();
    if (el.reportSolution) el.reportSolution.hidden = true;
    if (el.reportSolutionBody) el.reportSolutionBody.innerHTML = '';
    if (el.btnPaperListBack) el.btnPaperListBack.textContent = T('paperSecTitle');
    if (el.btnRedoPaper) el.btnRedoPaper.textContent = T('btnRedoPaper');
    if (el.btnBackPractice) el.btnBackPractice.textContent = T('btnBackPractice');
  }

  /* 交卷報告 → 返選卷清單（可以再揀另一份卷） */
  function backToPaperList() {
    renderPaperList();
    showPaperPanel('list');
  }

  /* 作答中 → 返選卷清單（等於離場：計時暫停、進度已存，下次按「開始作答」可續答） */
  function examToList() {
    if (paper.running) {
      if (!askConfirm('confirmQuitPaper')) return;
      stashDraft();
      saveProgress();       /* 先存進度（saveProgress 只在 running 時寫入） */
      stopPaperTimer();
      paper.running = false;
    }
    backToPaperList();
  }

  function redoPaper() {
    if (!paper.paper) return;
    if (!askConfirm('confirmRedo')) return;
    var id = paper.paper.id;
    clearProgress();
    paper.handed = false;
    startPaper(id);
  }

  function backToPractice() { setMode('practice'); }

  /* 語言切換時重畫目前顯示中的試卷畫面（練習模式中毋須重畫） */
  function renderPaperUI() {
    if (!el.paperMode || el.paperMode.hidden) return;
    renderPaperList();
    if (paper.view === 'exam' && paper.running) renderExam();
    else if (paper.view === 'report' && paper.handed) renderReport();
  }

  function initPapers() {
    paper.list = collectPapers();
    renderPaperList();
    showPaperPanel('list');
  }

  /* ────────── 語言切換 ────────── */
  function renderLangButtons() {
    if (el.btnLangZh) el.btnLangZh.className = 'lang-btn' + (zh() ? ' active' : '');
    if (el.btnLangEn) el.btnLangEn.className = 'lang-btn' + (!zh() ? ' active' : '');
  }

  /* ────────── 副標題：主題數與題庫總數即時計算（不再寫死 13 個主題） ────────── */
  function renderSubtitle() {
    if (!el.appSubtitle) return;
    var total = 0;
    TOPICS.forEach(function (t) { total += (t.questions || []).length; });
    el.appSubtitle.textContent = T('appSubtitle', { topics: TOPICS.length, total: total });
  }

  function applyLang() {
    if (I) I.apply(document);
    renderLangButtons();
    renderSubtitle();
    renderTopics();
    renderLevels();
    renderStats();
    renderFlames(false);
    renderStatus();
    if (state.current) renderQuestionCard();
    renderReviewUI();
    renderLocalBadge();
    aiApplyToggle();
    renderAiBadge();
    if (state.aiOn && AI) aiSetStatus(aiStatusText(), '');
    if (el.aiDialog && !el.aiDialog.hidden && AI) aiPoolNote();
    renderPaperUI();
    if (state.fbKind) renderFeedback();
    if (!el.solution.hidden && state.current) renderSolution();
    if (el.btnNext && !el.btnNext.hidden) el.btnNext.textContent = T('btnNext');
  }

  /* ────────── 事件綁定 ────────── */
  el.btnSubmit.addEventListener('click', submitAnswer);
  el.btnNext.addEventListener('click', nextQuestion);
  el.btnReveal.addEventListener('click', revealSolution);
  el.btnReset.addEventListener('click', resetGame);
  el.btnRandomTopic.addEventListener('click', function () {
    var others = TOPICS.filter(function (t) { return t.id !== state.topicId; });
    switchTopic(others[Math.floor(Math.random() * others.length)].id);
  });
  el.btnShowHint.addEventListener('click', function () {
    el.hintBox.hidden = !el.hintBox.hidden;
  });
  el.answerInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); submitAnswer(); }
  });
  if (el.btnLangZh) el.btnLangZh.addEventListener('click', function () { if (I) I.setLang('zh'); });
  if (el.btnLangEn) el.btnLangEn.addEventListener('click', function () { if (I) I.setLang('en'); });
  if (I) I.onChange(applyLang);

  /* ── v5 模擬試卷：模式切換、作答、交卷、報告 ── */
  if (el.btnModePractice) el.btnModePractice.addEventListener('click', function () { setMode('practice'); });
  if (el.btnModePaper) el.btnModePaper.addEventListener('click', function () { setMode('paper'); });
  if (el.btnExamSubmitOne) el.btnExamSubmitOne.addEventListener('click', submitPaperOne);
  if (el.examAnswerInput) el.examAnswerInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); submitPaperOne(); }
  });
  if (el.btnExamHint) el.btnExamHint.addEventListener('click', function () {
    if (el.examHintBox) el.examHintBox.hidden = !el.examHintBox.hidden;
  });
  if (el.btnExamReveal) el.btnExamReveal.addEventListener('click', revealExamSolution);
  if (el.btnSelfFull) el.btnSelfFull.addEventListener('click', function () { selfMark(true); });
  if (el.btnSelfZero) el.btnSelfZero.addEventListener('click', function () { selfMark(false); });
  if (el.btnPaperPrev) el.btnPaperPrev.addEventListener('click', paperPrev);
  if (el.btnPaperNext) el.btnPaperNext.addEventListener('click', paperNext);
  if (el.btnPaperMark) el.btnPaperMark.addEventListener('click', togglePaperMark);
  if (el.btnPaperHandIn) el.btnPaperHandIn.addEventListener('click', function () { handInPaper(false); });
  if (el.btnExamToList) el.btnExamToList.addEventListener('click', examToList);
  if (el.btnPaperListBack) el.btnPaperListBack.addEventListener('click', backToPaperList);
  if (el.btnRedoPaper) el.btnRedoPaper.addEventListener('click', redoPaper);
  if (el.btnBackPractice) el.btnBackPractice.addEventListener('click', backToPractice);

  /* ── v6 模擬 AI 出題：開關、設定對話框 ── */
  if (el.btnAiToggle) el.btnAiToggle.addEventListener('click', function () { aiSetOn(!state.aiOn); });
  if (el.btnAiSettings) el.btnAiSettings.addEventListener('click', openAiDialog);
  if (el.btnAiClose) el.btnAiClose.addEventListener('click', closeAiDialog);
  if (el.btnAiSave) el.btnAiSave.addEventListener('click', saveAiForm);
  if (el.btnAiClearPool) el.btnAiClearPool.addEventListener('click', function () { clearAiPool(); });
  if (el.aiProvider) el.aiProvider.addEventListener('change', aiProviderChanged);
  if (el.aiDialog) el.aiDialog.addEventListener('click', function (e) {
    if (e && e.target === el.aiDialog) closeAiDialog();   /* 點背景關閉 */
  });
  if (el.aiDialog && el.aiDialog.addEventListener) {
    var onKey = function (e) { if (e && e.key === 'Escape' && !el.aiDialog.hidden) closeAiDialog(); };
    if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('keydown', onKey);
  }

  /* ────────── 啟動 ────────── */
  initPapers();
  applyLang();
  newQuestion();
})();
