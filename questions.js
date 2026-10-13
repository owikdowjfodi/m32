/* ══════════════════════════════════════════════════════════════════
   M2 無限答題練習 · 題庫裝配檔
   牛津《數學新世代》數學延伸單元二 (M2) · 13 個主題 · 每主題 ≥ 30 題

   題目本體分別存放於 bank/ 目錄：
     bank/induction.js    數學歸納法          bank/defint.js    定積分及其應用
     bank/binomial.js     二項式定理          bank/matrix.js    矩陣與行列式
     bank/sincos.js       正弦法及餘弦法      bank/linear.js    線性方程組
     bank/trig.js         三角函數            bank/vector.js    向量的引入與運算
     bank/limits.js       極限與導數          bank/vectorprod.js 向量的積及其應用
     bank/diff.js         微分法
     bank/appdiff.js      微分法的應用
     bank/indef.js        不定積分及其應用

   本檔只負責：① 定義 13 個主題的中英文名與小主題（subs／subsEn）清單；
               ② 把 bank/ 載入的題目裝配成 App 使用的 TOPICS，
                  並依 subs 索引自動為每題填入 subEn（雙語顯示用）。
   答案規格與出題要求見 bank/SPEC.md；驗證指令：node tools/validate-bank.js
   ══════════════════════════════════════════════════════════════════ */

const M2_TOPIC_META = [
  {
    id: 'surds', name: '根式與分母有理化', en: 'Surds and Rationalization of Denominators',
    subs: [
      '根式的化簡與運算',
      '分母有理化',
      '雙重根式與化簡技巧',
      '根式方程',
      '根式的應用與估算'
    ],
    subsEn: [
      'Simplifying and operating with surds',
      'Rationalizing denominators',
      'Nested radicals and simplification techniques',
      'Equations involving surds',
      'Applications and estimation with surds'
    ]
  },
  {
    id: 'induction', name: '數學歸納法', en: 'Mathematical Induction',
    subs: [
      '1.1 數學歸納法原理（基本步驟）',
      '1.2 數列求和命題的歸納證明',
      '1.3 整除性命題的歸納證明',
      '1.4 不等式命題的歸納證明',
      '1.5 遞推數列與歸納法'
    ],
    subsEn: [
      '1.1 Principle of mathematical induction (basic steps)',
      '1.2 Inductive proof of summation formulae',
      '1.3 Inductive proof of divisibility statements',
      '1.4 Inductive proof of inequalities',
      '1.5 Recurrence sequences and induction'
    ]
  },
  {
    id: 'binomial', name: '二項式定理', en: 'Binomial Theorem',
    subs: [
      '2.1 二項式定理的展開',
      '2.2 二項展開的通項公式',
      '2.3 求特定項（含 x^k 的項、常數項）',
      '2.4 求係數與係數和',
      '2.5 二項式定理的應用（近似值、恆等式）'
    ],
    subsEn: [
      '2.1 Expansion by the binomial theorem',
      '2.2 General term of a binomial expansion',
      '2.3 Finding a particular term (term in x^k, constant term)',
      '2.4 Finding coefficients and sums of coefficients',
      '2.5 Applications (approximate values, identities)'
    ]
  },
  {
    id: 'sincos', name: '正弦法及餘弦法', en: 'Sine and Cosine Laws',
    subs: [
      '3.1 正弦法',
      '3.2 餘弦法',
      '3.3 三角形面積公式 ½ab sin C',
      '3.4 解三角形的疑題（SSA 兩解情況）',
      '3.5 立體與日常應用題（方位角、仰角、斜角）'
    ],
    subsEn: [
      '3.1 The sine rule',
      '3.2 The cosine rule',
      '3.3 Area of a triangle: ½ab sin C',
      '3.4 Ambiguous case of solving a triangle (SSA, two solutions)',
      '3.5 3-D and real-life problems (bearings, angles of elevation and depression)'
    ]
  },
  {
    id: 'trig', name: '三角函數的性質與恆等式', en: 'Trigonometric Functions',
    subs: [
      '4.1 弧度制、弧長與扇形面積',
      '4.2 三角函數的圖像與週期性',
      '4.3 複角公式（和差角公式）',
      '4.4 二倍角與半角公式',
      '4.5 三角恆等式的化簡與證明',
      '4.6 三角方程'
    ],
    subsEn: [
      '4.1 Radian measure, arc length and sector area',
      '4.2 Graphs and periodicity of trigonometric functions',
      '4.3 Compound angle formulae',
      '4.4 Double-angle and half-angle formulae',
      '4.5 Simplifying and proving trigonometric identities',
      '4.6 Trigonometric equations'
    ]
  },
  {
    id: 'limits', name: '極限與導數的概念', en: 'Limits and Derivatives',
    subs: [
      '5.1 數列的極限',
      '5.2 函數的極限',
      '5.3 極限的運算與 0/0 型不定式',
      '5.4 導數的第一原理（定義）',
      '5.5 連續性與可導性'
    ],
    subsEn: [
      '5.1 Limits of sequences',
      '5.2 Limits of functions',
      '5.3 Limit laws and the indeterminate form 0/0',
      '5.4 Derivative from first principles',
      '5.5 Continuity and differentiability'
    ]
  },
  {
    id: 'diff', name: '微分法', en: 'Differentiation Techniques',
    subs: [
      '6.1 基本求導公式（多項式與冪函數）',
      '6.2 乘積法則',
      '6.3 商法則',
      '6.4 連鎖法則',
      '6.5 三角函數的導數',
      '6.6 隱函數微分與高階導數'
    ],
    subsEn: [
      '6.1 Basic differentiation rules (polynomials and powers)',
      '6.2 Product rule',
      '6.3 Quotient rule',
      '6.4 Chain rule',
      '6.5 Derivatives of trigonometric functions',
      '6.6 Implicit differentiation and higher-order derivatives'
    ]
  },
  {
    id: 'appdiff', name: '微分法的應用', en: 'Applications of Differentiation',
    subs: [
      '7.1 切線與法線',
      '7.2 相關變率',
      '7.3 單調性與極值（一階導數檢驗）',
      '7.4 凹凸性與拐點（二階導數檢驗）',
      '7.5 最大最小值應用題',
      '7.6 洛必達法則'
    ],
    subsEn: [
      '7.1 Tangents and normals',
      '7.2 Related rates of change',
      '7.3 Monotonicity and extrema (first derivative test)',
      '7.4 Concavity and points of inflexion (second derivative test)',
      '7.5 Applied maximum and minimum problems',
      "7.6 L'Hôpital's rule"
    ]
  },
  {
    id: 'indef', name: '不定積分及其應用', en: 'Indefinite Integration',
    subs: [
      '8.1 不定積分的概念與基本公式',
      '8.2 代換積分法',
      '8.3 三角函數的積分',
      '8.4 由導函數求原函數',
      '8.5 積分的應用（初值問題與曲線族）'
    ],
    subsEn: [
      '8.1 Indefinite integrals and basic formulae',
      '8.2 Integration by substitution',
      '8.3 Integration of trigonometric functions',
      '8.4 Finding a primitive function from its derivative',
      '8.5 Applications (initial-value problems and families of curves)'
    ]
  },
  {
    id: 'defint', name: '定積分及其應用', en: 'Definite Integration',
    subs: [
      '9.1 定積分的定義與性質',
      '9.2 微積分基本定理',
      '9.3 代換法於定積分',
      '9.4 平面圖形的面積',
      '9.5 旋轉體的體積',
      '9.6 定積分的其他應用（平均值、變率）'
    ],
    subsEn: [
      '9.1 Definition and properties of the definite integral',
      '9.2 Fundamental theorem of calculus',
      '9.3 Substitution in definite integrals',
      '9.4 Area of a plane region',
      '9.5 Volume of a solid of revolution',
      '9.6 Other applications (mean value, rates of change)'
    ]
  },
  {
    id: 'matrix', name: '矩陣與行列式', en: 'Matrices and Determinants',
    subs: [
      '10.1 矩陣的定義、加法與純量乘法',
      '10.2 矩陣乘法與單位矩陣',
      '10.3 二階行列式與逆矩陣',
      '10.4 三階行列式與逆矩陣',
      '10.5 行列式的性質',
      '10.6 矩陣的應用（變換與編碼）'
    ],
    subsEn: [
      '10.1 Matrices: definition, addition and scalar multiplication',
      '10.2 Matrix multiplication and the identity matrix',
      '10.3 2×2 determinants and inverse matrices',
      '10.4 3×3 determinants and inverse matrices',
      '10.5 Properties of determinants',
      '10.6 Applications of matrices (transformations and coding)'
    ]
  },
  {
    id: 'linear', name: '線性方程組', en: 'Systems of Linear Equations',
    subs: [
      '11.1 高斯消去法',
      '11.2 克拉瑪法則',
      '11.3 解的存在性與唯一性（無解／無限多解）',
      '11.4 齊次方程組',
      '11.5 線性方程組的應用題'
    ],
    subsEn: [
      '11.1 Gaussian elimination',
      '11.2 Cramer’s rule',
      '11.3 Existence and uniqueness of solutions (no solution / infinitely many)',
      '11.4 Homogeneous systems',
      '11.5 Applications of systems of linear equations'
    ]
  },
  {
    id: 'vector', name: '向量的引入與運算', en: 'Introduction to Vectors',
    subs: [
      '12.1 向量的概念與分量表示',
      '12.2 向量的加減與純量乘法',
      '12.3 位置向量與分點公式',
      '12.4 向量的線性組合與共線、共面',
      '12.5 三維向量與距離'
    ],
    subsEn: [
      '12.1 Concept of a vector and component form',
      '12.2 Addition, subtraction and scalar multiplication of vectors',
      '12.3 Position vectors and the section formula',
      '12.4 Linear combinations, collinearity and coplanarity',
      '12.5 Vectors in 3-D and distance'
    ]
  },
  {
    id: 'vectorprod', name: '向量的積及其應用', en: 'Scalar Product and Vector Product',
    subs: [
      '13.1 純量積（點積）',
      '13.2 兩向量的夾角與投影',
      '13.3 向量積（叉積）',
      '13.4 面積與體積的計算',
      '13.5 三維空間中的直線與平面'
    ],
    subsEn: [
      '13.1 Scalar (dot) product',
      '13.2 Angle between two vectors and projection',
      '13.3 Vector (cross) product',
      '13.4 Areas and volumes',
      '13.5 Lines and planes in 3-D space'
    ]
  }
];

/* bank/*.js 以 root.M2Bank['<topicId>'] 註冊題目（瀏覽器 window、Node/vm globalThis）
   教材融合題庫分兩條產線：
     bank-extra/*.js  → root.M2BankExtra（公開：原創改編題）
     bank-local/*.js  → root.M2BankLocal（私用：教材原文題，只在 m2-app-local.html 載入） */
const M2_ROOT = (typeof window !== 'undefined' ? window : globalThis);
const M2_BANK = M2_ROOT.M2Bank || {};
const M2_EXTRA = M2_ROOT.M2BankExtra || {};
const M2_LOCAL = M2_ROOT.M2BankLocal || {};

/* 同一主題的題目＝原生題庫 + 公開改編 + （私用版才有）原文題 */
function m2BankFor(id) {
  return (M2_BANK[id] || []).concat(M2_EXTRA[id] || []).concat(M2_LOCAL[id] || []);
}

/* 依 sub 在 subs 清單中的索引，自動填入對應的英文小主題 subEn
   （英文由 questions.js 統一提供，題庫檔只需寫中文 sub，避免各檔不一致） */
function m2AttachSubEn(m, list) {
  var subs = m.subs || [], subsEn = m.subsEn || [];
  return (list || []).map(function (q) {
    var i = subs.indexOf(q.sub);
    if (!q.subEn) q.subEn = (i >= 0 && subsEn[i]) ? subsEn[i] : '';
    return q;
  });
}

const ALL_TOPICS = M2_TOPIC_META.map(function (m) {
  return {
    id: m.id,
    name: m.name,
    en: m.en,
    subs: m.subs,
    subsEn: m.subsEn,
    questions: m2AttachSubEn(m, m2BankFor(m.id))
  };
});

/* 只把「真的有題目」的主題交給 App：某主題尚未出題時（例如根式正由教材改編題補上），
   不會出現在主題列、也不會被隨機抽到，避免出現空白題目畫面。
   載入後若某主題仍是 0 題，在 console 明確示警（不中斷 App）。 */
const EMPTY_TOPICS = ALL_TOPICS.filter(function (t) { return !t.questions.length; });
const TOPICS = ALL_TOPICS.filter(function (t) { return t.questions.length > 0; });

if (typeof console !== 'undefined' && console.warn) {
  EMPTY_TOPICS.forEach(function (t) {
    console.warn('[題庫] 主題「' + t.name + '」尚未有題目，暫時不會出現在練習畫面（可放進 bank/' +
      t.id + '.js 或 bank-extra/' + t.id + '.js）');
  });
}
