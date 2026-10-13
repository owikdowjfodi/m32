/* ══════════════════════════════════════════════════════════════════
   M2 無限答題練習 · 中英雙語介面字串 (i18n.js)
   · 用法：M2I18N.t('btnSubmit')、M2I18N.setLang('en')、M2I18N.apply(document)
   · index.html 內任何元素可加 data-i18n（文字）、data-i18n-ph（placeholder）、
     data-i18n-title（title）屬性，呼叫 M2I18N.apply() 即自動翻譯。
   · 語言選擇存於 localStorage('m2.lang')；首次進入依瀏覽器語言自動判斷。
   ══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var KEY = 'm2.lang';

  var STRINGS = {
    zh: {
      appTitle: 'M2 無限答題練習',
      appSubtitle: 'HKDSE 數學延伸單元二 · {topics} 個主題 · 題庫 {total} 題 · 連續答對 10 題闖關',
      statCorrect: '總答對',
      statWrong: '本局失手',
      statMode: '狀態',
      modeChallenge: '闖關中',
      modeInfinite: '無限訓練',
      sec1Title: '① 選擇主題',
      sec1Tip: '（切換主題不會中斷連續紀錄）',
      btnRandomTopic: '🎲 隨機主題',
      levelLabel: '難度',
      levelAll: '全部',
      levelTip: 'LV1 基礎 · LV2 標準 · LV3 進階（可只練某一級）',
      sec2Title: '② 連續答對進度',
      sec3Title: '③ 題目',
      answerLabel: '輸入你的答案（可接受 開方2、√2、2^(1/2)、3/4、0.75 等寫法）',
      answerPlaceholder: '例：12  或  √57',
      btnSubmit: '提交答案',
      btnHint: '💡 提示',
      reviewNotice: '本題是證明／論述題：請先在紙上作答，再按下面按鈕對照標準解答。',
      btnReveal: '看解答',
      localBadge: '私用版：含教材原文題，請勿公開分享',
      rawNotice: '本題是教材原文題：請先在紙上作答，再按「看解答」核對標準答案（本題不計入連續答對）。',
      rawNoSolution: '本題是教材原文題，暫未附逐步詳解。',
      solTitleRaw: '📘 標準答案（教材原文題）',
      footerPrivacyLocal: '本練習為個人自製的學習工具，與任何出版社及考試機構無關；私用版含教材原文題，只供個人學習之用，所有作答紀錄只存在你的瀏覽器內，不會上傳或收集任何個人資料。',
      solTitle: '📘 答案與解題（DSE 評分標準）',
      standardAnswer: '標準答案：',
      btnNext: '下一題 →',
      btnReset: '↺ 重新開始（火歸零）',
      footerNotation: '數學輸出全部採用 Unicode 書寫格式（∫ x² dx、√2、3/4），不出現任何原始程式碼符號。',
      footerPrivacy: '本練習為個人自製的學習工具，與任何出版社及考試機構無關，題目並非教材原文；所有作答紀錄只存在你的瀏覽器內，不會上傳或收集任何個人資料。',
      footerPrivacyLink: '私隱政策',
      qLabel: '【題目】',
      hintPrefix: '💡 ',
      notePrefix: '📌 考試提示：',
      markingNote: '評分說明：M = 方法分，A = 答案分。DSE 會按步驟給分，即使最終答案錯誤，正確的方法步驟仍可得分。',
      topicLine: '{name} · 本主題 {count} 題',
      streakProgress: '🔥 目前連續答對：{n}/{target} 題',
      streakInfinite: '🔥 無限訓練模式 · 總答對 {total} 題',
      statusDefault: '加油！連續答對 {target} 題即可啟動「無限訓練模式」。',
      statusWin: '🎉 挑戰成功！你已啟動「無限訓練模式」，之後可無限答題，只記錄總答對題數。',
      statusInfiniteCorrect: '🔥 無限訓練模式進行中：總答對 {total} 題。',
      statusNext: '答得好！連續答對 {n}/{target} 題，再答對 {left} 題即啟動無限訓練模式。',
      statusBroke: '🔥 連續紀錄中斷！目前連續答對：0/{target} 題。',
      statusBrokeWas: '🔥 連續紀錄中斷！目前連續答對：0/{target} 題（原為 {was}/{target} 題）。',
      statusInfiniteWrong: '無限訓練模式：答錯不歸零，可繼續挑戰。',
      feedbackOk: '【結果】正確！',
      feedbackOkDetail: '🔥 目前連續答對：{n}/{target} 題',
      feedbackOkWin: '🔥 連續答對 {target} 題！',
      feedbackOkInfinite: '無限訓練模式：繼續作答，總答對 {total} 題。',
      feedbackWrong: '【結果】錯誤。',
      detailMissingC: '你的式子本身正確，但不定積分必須加上積分常數 + C（DSE 會因此扣分）。',
      detailNumWrong: '你輸入的數值與標準答案不符，請對照解題步驟檢查計算。',
      detailNumWrongValue: '你輸入的數值與標準答案不符，請對照解題步驟檢查計算。（系統讀取到的數值：{value}）',
      detailGeneric: '你的答案與標準答案不一致，請看下面的解題步驟。',
      detailInfiniteSuffix: '（無限訓練模式：不扣連續紀錄，繼續累計總答對題數。）',
      resetMsg: '已重新開始，火歸零。',
      switchMsg: '已為你轉到「{name}」，連續紀錄保留不變。',
      missingBank: '此主題的題庫未載入，請檢查 bank/{file}.js。',
      levelRunOut: '此難度暫時沒有題目，請選「全部」或其他等級。',
      badgeTitle: '難度等級 {lv}：LV1 基礎、LV2 標準、LV3 進階',
      langZh: '中文',
      langEn: 'English',
      langTitle: '切換語言 / Switch language',

      /* ══════════ v5：模擬試卷模式 ══════════ */
      modeSwitchLabel: '模式',
      modePractice: '📚 練習模式',
      modePaper: '📝 模擬試卷',
      modePracticeTitle: '返回無限答題練習',
      modePaperTitle: '進入模擬試卷模式',
      paperSecTitle: '選擇試卷',
      paperSecTip: '（跟考試一樣計時；只作個人練習，不影響練習模式的連續紀錄）',
      paperEmpty: '尚未載入試卷（私用版會載入教材期考卷）。你仍可留在這裡，之後載入試卷便會顯示。',
      paperQuestionsCount: '{n} 題',
      paperMarksCount: '{n} 分',
      paperDuration: '時限 {min} 分鐘',
      paperUnnamed: '未命名試卷',
      btnPaperStart: '開始作答',
      examSecTitle: '作答中',
      examTimeLeft: '剩餘時間 {time}',
      examTimeUp: '時間到，已自動交卷。',
      examTimeWarnTitle: '剩下不足 {min} 分鐘，請把握時間',
      examNoTimeLimit: '不限時',
      examProgress: '第 {n}／{total} 題',
      navLegendUnanswered: '未作答',
      navLegendAnswered: '已作答',
      navLegendMarked: '已標記',
      navLegendCurrent: '本題',
      marksLabel: '本題 {n} 分',
      btnPaperMark: '標記此題',
      btnPaperUnmark: '取消標記',
      btnPaperSubmitOne: '提交此題',
      btnPaperPrev: '← 上一題',
      btnPaperNext: '下一題 →',
      btnPaperHandIn: '📮 交卷',
      confirmHandIn: '確定要交卷嗎？未作答的題目會以 0 分計。',
      confirmQuitPaper: '確定要離開模擬試卷嗎？計時會暫停，作答進度會為你保留，下次可以續答。',
      confirmRedo: '確定要重做這份卷嗎？現有作答紀錄會被清除。',
      reviewSelfNotice: '本題是證明／論述題：請先在紙上作答，再按「看解答」自評，由於只有真人改卷才知道分數，所以由你自己給分。',
      reviewSelfPrompt: '自評得分：',
      btnSelfFull: '滿分',
      btnSelfZero: '0 分',
      selfScoreRecorded: '已記錄自評得分：{score} / {marks} 分',
      reportSecTitle: '📊 模擬試卷報告',
      reportTotal: '總分 {score} / {total}',
      reportPercent: '得分率 {pct}%',
      reportGrade: '等第 {grade}',
      reportGradeNote: '等第門檻：5** ≥ 85%、5* ≥ 75%、5 ≥ 65%、4 ≥ 55%、3 ≥ 45%、2 ≥ 35%、1 ≥ 25%，其餘為 U。',
      reportTableHead: ['題號', '小主題', '得分', '滿分', '結果'],
      reportCorrect: '✔ 正確',
      reportWrong: '✖ 錯誤',
      reportSelf: '○ 自評',
      reportUnanswered: '— 未作答',
      reportMissing: '本題題目未載入（可能未載入 bank-local 試卷題庫）',
      reportViewSolution: '看解答',
      reportNoSolution: '此題未載入標準解答。',
      btnRedoPaper: '↺ 重做這份卷',
      btnBackPractice: '返回練習模式',

      /* ── v6 · AI 出題（選用功能；API Key 只存本機） ── */
      aiSecTitle: 'AI 出題',
      aiSecTip: '（選用：用你自己的 AI 服務生成新題，與題庫題目混合練習）',
      aiSettingsBtn: '⚙️ AI 設定',
      aiOff: 'AI 出題：關',
      aiOn: 'AI 出題：開',
      aiDialogTitle: 'AI 出題設定',
      aiProvider: 'AI 服務',
      aiBase: 'API 端點',
      aiModel: '模型名稱',
      aiKey: 'API 金鑰（Key）',
      aiJsonMode: '要求 JSON 模式（較穩定；部分服務不支援）',
      aiAutoPrefetch: '背景預先出題（答題更順暢，會多用少量額度）',
      aiKeyNote: 'API Key 只存在你的瀏覽器（localStorage），並只會直接送到上面填寫的端點；本練習不會收集或上傳任何資料。',
      aiClearPool: '清除已快取題目',
      aiClose: '關閉',
      aiSave: '儲存並啟用',
      aiPoolNone: '目前沒有快取的 AI 題目。',
      aiPoolCount: '已快取 {n} 題 AI 題目（會優先使用，減少重複生成）。',
      aiPoolCleared: '已清除 AI 題目快取。',
      aiSaved: 'AI 設定已儲存。',
      aiStatusOn: '已啟用 · {provider} · 快取 {n} 題',
      aiStatusOff: '未啟用',
      aiGenerating: '🤖 AI 正在生成新題目…（一般 5–20 秒）',
      aiGeneratingStatus: 'AI 正在為你生成新題目，請稍候…',
      aiFailed: 'AI 出題失敗：{msg}（已改用題庫題目）',
      aiNotReady: 'AI 未能使用：{msg}（已改用題庫題目）',
      aiTag: '🤖 AI 出題',
      aiNeedKey: '請先在「⚙️ AI 設定」填入 API Key 並儲存。'
    },

    en: {
      appTitle: 'M2 Infinite Practice',
      appSubtitle: 'HKDSE Mathematics Extended Part (Module 2) · {topics} topics · {total} questions · 10 correct in a row to unlock Infinite Training',
      statCorrect: 'Correct',
      statWrong: 'Wrong',
      statMode: 'Mode',
      modeChallenge: 'Challenge',
      modeInfinite: 'Infinite',
      sec1Title: '① Choose a topic',
      sec1Tip: '(switching topics does not break your streak)',
      btnRandomTopic: '🎲 Random topic',
      levelLabel: 'Level',
      levelAll: 'All',
      levelTip: 'LV1 basic · LV2 standard · LV3 advanced (you can practise one level only)',
      sec2Title: '② Streak progress',
      sec3Title: '③ Question',
      answerLabel: 'Type your answer (√2, sqrt(2), 2^(1/2), 3/4, 0.75 and similar forms are all accepted)',
      answerPlaceholder: 'e.g. 12  or  √57',
      btnSubmit: 'Submit',
      btnHint: '💡 Hint',
      reviewNotice: 'This is a proof or discussion question: work it out on paper first, then press the button below to compare with the standard solution.',
      btnReveal: 'Show solution',
      localBadge: 'Private build: contains textbook questions — do not share publicly',
      rawNotice: 'This is an original textbook question: work it out on paper first, then press "Show solution" to check the standard answer (it does not affect your streak).',
      rawNoSolution: 'Original textbook question — a step-by-step solution is not available yet.',
      solTitleRaw: '📘 Standard answer (textbook question)',
      footerPrivacyLocal: 'This is a self-made study tool and is not affiliated with any publisher or examination body. The private build contains original textbook questions for personal study only; all records stay in your browser — no personal data is collected or uploaded.',
      solTitle: '📘 Answer and worked solution (DSE marking)',
      standardAnswer: 'Standard answer: ',
      btnNext: 'Next question →',
      btnReset: '↺ Restart (flames reset)',
      footerNotation: 'All mathematics is displayed in Unicode form (∫ x² dx, √2, 3/4); no raw code notation is used.',
      footerPrivacy: 'This is a self-made study tool. It is not affiliated with any publisher or examination body, and the questions are not textbook material. All practice records stay in your browser — no personal data is collected or uploaded.',
      footerPrivacyLink: 'Privacy policy',
      qLabel: '[Question]',
      hintPrefix: '💡 ',
      notePrefix: '📌 Exam tip: ',
      markingNote: 'Marking note: M = method mark, A = answer mark. In the DSE marks are awarded step by step, so correct method steps still earn marks even when the final answer is wrong.',
      topicLine: '{name} · {count} questions in this topic',
      streakProgress: '🔥 Current streak: {n}/{target}',
      streakInfinite: '🔥 Infinite Training · {total} correct in total',
      statusDefault: 'Keep going! Get {target} correct in a row to unlock Infinite Training Mode.',
      statusWin: '🎉 Challenge complete! Infinite Training Mode is on — keep practising as long as you like; only your total number of correct answers is counted.',
      statusInfiniteCorrect: '🔥 Infinite Training Mode: {total} correct in total.',
      statusNext: 'Well done! {n}/{target} in a row — {left} more to unlock Infinite Training Mode.',
      statusBroke: '🔥 Streak broken! Current streak: 0/{target}.',
      statusBrokeWas: '🔥 Streak broken! Current streak: 0/{target} (was {was}/{target}).',
      statusInfiniteWrong: 'Infinite Training Mode: a wrong answer will not reset your streak.',
      feedbackOk: '[Result] Correct!',
      feedbackOkDetail: '🔥 Current streak: {n}/{target}',
      feedbackOkWin: '🔥 {target} correct in a row!',
      feedbackOkInfinite: 'Infinite Training Mode: keep going — {total} correct in total.',
      feedbackWrong: '[Result] Incorrect.',
      detailMissingC: 'Your expression is correct, but an indefinite integral must include the constant of integration, + C (you would lose marks in the DSE for omitting it).',
      detailNumWrong: 'Your value does not match the standard answer. Check your working against the solution steps below.',
      detailNumWrongValue: 'Your value does not match the standard answer. Check your working against the solution steps below. (Value read by the system: {value})',
      detailGeneric: 'Your answer does not match the standard answer. Please read the worked solution below.',
      detailInfiniteSuffix: ' (Infinite Training Mode: your streak is not reset and your total keeps counting.)',
      resetMsg: 'Restarted — the flames are reset.',
      switchMsg: 'Switched to “{name}”. Your streak is kept.',
      missingBank: 'The question bank for this topic has not been loaded. Please check bank/{file}.js.',
      levelRunOut: 'There are no questions at this level yet — please choose “All” or another level.',
      badgeTitle: 'Difficulty level {lv}: LV1 basic, LV2 standard, LV3 advanced',
      langZh: '中文',
      langEn: 'English',
      langTitle: 'Switch language / 切換語言',

      /* ══════════ v5：Mock paper mode ══════════ */
      modeSwitchLabel: 'Mode',
      modePractice: '📚 Practice',
      modePaper: '📝 Mock paper',
      modePracticeTitle: 'Back to infinite practice',
      modePaperTitle: 'Go to mock paper mode',
      paperSecTitle: 'Choose a paper',
      paperSecTip: '(timed like a real exam; for personal practice only — it does not affect your practice streak)',
      paperEmpty: 'No paper has been loaded yet (the private build loads textbook exam papers). You can stay here; papers will appear once they are loaded.',
      paperQuestionsCount: '{n} questions',
      paperMarksCount: '{n} marks',
      paperDuration: 'Time limit: {min} min',
      paperUnnamed: 'Untitled paper',
      btnPaperStart: 'Start',
      examSecTitle: 'In progress',
      examTimeLeft: 'Time left {time}',
      examTimeUp: 'Time is up — your paper was submitted automatically.',
      examTimeWarnTitle: 'Less than {min} minutes left — keep an eye on the clock',
      examNoTimeLimit: 'No time limit',
      examProgress: 'Question {n} of {total}',
      navLegendUnanswered: 'Not answered',
      navLegendAnswered: 'Answered',
      navLegendMarked: 'Flagged',
      navLegendCurrent: 'Current',
      marksLabel: 'This question: {n} marks',
      btnPaperMark: 'Flag this question',
      btnPaperUnmark: 'Remove flag',
      btnPaperSubmitOne: 'Submit answer',
      btnPaperPrev: '← Previous',
      btnPaperNext: 'Next →',
      btnPaperHandIn: '📮 Hand in',
      confirmHandIn: 'Hand in this paper? Questions you have not answered will score 0.',
      confirmQuitPaper: 'Leave the mock paper? The timer pauses and your progress is kept, so you can carry on next time.',
      confirmRedo: 'Redo this paper? Your current answers will be discarded.',
      reviewSelfNotice: 'This is a proof or discussion question: work it out on paper first, then press Show solution and mark yourself, since only a human marker knows the score.',
      reviewSelfPrompt: 'Self-assessment:',
      btnSelfFull: 'Full marks',
      btnSelfZero: '0 marks',
      selfScoreRecorded: 'Self-assessment recorded: {score} / {marks}',
      reportSecTitle: '📊 Mock paper report',
      reportTotal: 'Total {score} / {total}',
      reportPercent: 'Score {pct}%',
      reportGrade: 'Grade {grade}',
      reportGradeNote: 'Grade boundaries: 5** at 85%+, 5* at 75%+, 5 at 65%+, 4 at 55%+, 3 at 45%+, 2 at 35%+, 1 at 25%+, otherwise U.',
      reportTableHead: ['No.', 'Sub-topic', 'Score', 'Full marks', 'Result'],
      reportCorrect: '✔ Correct',
      reportWrong: '✖ Wrong',
      reportSelf: '○ Self-marked',
      reportUnanswered: '— Not answered',
      reportMissing: 'This question could not be loaded (the paper bank may not be loaded).',
      reportViewSolution: 'Solution',
      reportNoSolution: 'No standard solution has been loaded for this question.',
      btnRedoPaper: '↺ Redo this paper',
      btnBackPractice: 'Back to practice mode',

      /* ── v6 · AI question generation (optional; API key stays on this device) ── */
      aiSecTitle: 'AI questions',
      aiSecTip: '(optional: generate new questions with your own AI service and mix them with the bank)',
      aiSettingsBtn: '⚙️ AI settings',
      aiOff: 'AI questions: off',
      aiOn: 'AI questions: on',
      aiDialogTitle: 'AI question settings',
      aiProvider: 'AI service',
      aiBase: 'API endpoint',
      aiModel: 'Model name',
      aiKey: 'API key',
      aiJsonMode: 'Request JSON mode (more reliable; not supported by every service)',
      aiAutoPrefetch: 'Prefetch in the background (smoother, uses slightly more quota)',
      aiKeyNote: 'The API key is stored only in your browser (localStorage) and is sent only to the endpoint above; this practice app never collects or uploads any data.',
      aiClearPool: 'Clear cached questions',
      aiClose: 'Close',
      aiSave: 'Save and enable',
      aiPoolNone: 'No AI questions are cached right now.',
      aiPoolCount: '{n} AI question(s) cached (used first, so fewer repeat calls).',
      aiPoolCleared: 'AI question cache cleared.',
      aiSaved: 'AI settings saved.',
      aiStatusOn: 'On · {provider} · {n} cached',
      aiStatusOff: 'Off',
      aiGenerating: '🤖 Generating a new question… (usually 5–20 seconds)',
      aiGeneratingStatus: 'Generating a new question with AI, please wait…',
      aiFailed: 'AI generation failed: {msg} (showing a bank question instead)',
      aiNotReady: 'AI is not usable: {msg} (showing a bank question instead)',
      aiTag: '🤖 AI question',
      aiNeedKey: 'Open "⚙️ AI settings" and enter your API key first.'
    }
  };

  var listeners = [];

  function detect() {
    var saved = null;
    try { saved = root.localStorage ? root.localStorage.getItem(KEY) : null; } catch (e) { saved = null; }
    if (saved === 'zh' || saved === 'en') return saved;
    var nav = '';
    try { nav = (root.navigator && (root.navigator.language || root.navigator.userLanguage)) || ''; } catch (e) { nav = ''; }
    if (/^zh/i.test(nav)) return 'zh';
    if (/^[a-z]{2}/i.test(nav)) return 'en';
    return 'zh';
  }

  var current = detect();

  function t(key, vars) {
    var table = STRINGS[current] || STRINGS.zh;
    var s = table[key];
    if (s === undefined) s = STRINGS.zh[key];
    if (s === undefined) return key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.split('{' + k + '}').join(String(vars[k]));
      });
    }
    return s;
  }

  function save(lang) {
    try { if (root.localStorage) root.localStorage.setItem(KEY, lang); } catch (e) { /* 忽略：無 localStorage 時只作用於本次瀏覽 */ }
  }

  function setLang(lang) {
    if (lang !== 'zh' && lang !== 'en') return current;
    if (lang === current) return current;
    current = lang;
    save(lang);
    listeners.forEach(function (fn) { try { fn(current); } catch (e) { if (root.console) root.console.error(e); } });
    return current;
  }

  function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

  /* 掃描 DOM 內的 data-i18n / data-i18n-ph / data-i18n-title 並套用當前語言 */
  function apply(scope) {
    var doc = root.document;
    if (!doc) return;
    var s = scope || doc;
    if (!s.querySelectorAll) return;
    var list = s.querySelectorAll('[data-i18n]');
    for (var i = 0; i < list.length; i++) list[i].textContent = t(list[i].getAttribute('data-i18n'));
    list = s.querySelectorAll('[data-i18n-ph]');
    for (var j = 0; j < list.length; j++) list[j].setAttribute('placeholder', t(list[j].getAttribute('data-i18n-ph')));
    list = s.querySelectorAll('[data-i18n-title]');
    for (var k = 0; k < list.length; k++) list[k].setAttribute('title', t(list[k].getAttribute('data-i18n-title')));
    if (doc.documentElement) doc.documentElement.setAttribute('lang', current === 'zh' ? 'zh-Hant' : 'en');
  }

  root.M2I18N = {
    t: t,
    apply: apply,
    setLang: setLang,
    onChange: onChange,
    strings: STRINGS,
    langs: ['zh', 'en'],
    get lang() { return current; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
