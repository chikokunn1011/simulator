/* シミュレーターの一覧。ここに1件たすと、一覧ページにカードが1枚ふえる。
  {
    id:       'functions',              // sim.html?s=functions で開く。sims/<id>.js（と lib/<id>.js）を読む
    title:    '一次関数・二次関数',
    subject:  '数学',                    // 数学 / 物理 / 化学 / 地学
    unit:     '関数',                    // 単元（一覧のしぼりこみに出る）
    grades:   '中2〜高1',                // 対象学年（カードにそのまま出る）
    levels:   ['中学', '高校'],          // 学校段階のしぼりこみ
    desc:     '…',                       // 学習内容（カードに出る）
    minutes:  15,                        // 所要時間の目安（分）
    keywords: ['傾き', '切片'],          // キーワード検索に使う（画面には出ない）
    status:   'open',                    // 'open' = 公開中 / 'soon' = 準備中（リンクなし）
    lib:      true                       // （なくてOK）true = lib/<id>.js（計算の部分）も読む
  }
*/
window.SIM_SUBJECTS = {
  '数学': { mark: '数', color: 'var(--s-ma)' },
  '物理': { mark: '物', color: 'var(--s-ph)' },
  '化学': { mark: '化', color: 'var(--s-ch)' },
  '地学': { mark: '地', color: 'var(--s-ea)' }
};

window.SIMS = [
  // ---------- 数学 ----------
  { id: 'functions', title: '一次関数・二次関数', subject: '数学', unit: '関数', grades: '中2〜高1', levels: ['中学', '高校'],
    desc: 'y = ax + b の傾きと切片、y = ax² + bx + c の係数を動かして、グラフ・頂点・軸・x 軸との交点がどう変わるかを見る。',
    lede: '係数を動かすと、グラフと式がいっしょに変わる。傾き・切片・頂点・軸・x 軸との交点の関係を見てみよう。',
    minutes: 15, keywords: ['一次関数', '二次関数', '傾き', '切片', '変化の割合', '放物線', '頂点', '軸', '判別式', '平方完成', 'グラフ', 'y=ax+b', 'y=ax²'],
    status: 'open', lib: true },
  { id: 'trig', title: '三角関数と単位円', subject: '数学', unit: '三角関数', grades: '高1〜高2', levels: ['高校'],
    desc: '単位円の上を点が回ると、sin・cos・tan のグラフがどう描かれるかを連動して見る。角度は度・ラジアンで切りかえ。',
    lede: '単位円の点を回すと、sin・cos・tan の値とグラフがいっしょに動く。',
    minutes: 15, keywords: ['三角比', '三角関数', 'sin', 'cos', 'tan', 'サイン', 'コサイン', 'タンジェント', '単位円', 'ラジアン', '弧度法', '周期'],
    status: 'open', lib: true },
  { id: 'inscribed-angle', title: '円周角と中心角', subject: '数学', unit: '図形', grades: '中3', levels: ['中学'],
    desc: '円周上の点を動かして、円周角が中心角の半分になること、同じ弧に対する円周角が等しいことを確かめる。', minutes: 10,
    keywords: ['円周角', '中心角', '円'], status: 'soon' },
  { id: 'pythagoras', title: '三平方の定理', subject: '数学', unit: '図形', grades: '中3', levels: ['中学'],
    desc: '直角三角形の辺の長さを変えて、各辺の上の正方形の面積の関係を見る。', minutes: 10,
    keywords: ['三平方', 'ピタゴラス', '直角三角形'], status: 'soon' },
  { id: 'vectors', title: 'ベクトルの合成', subject: '数学', unit: 'ベクトル', grades: '高2', levels: ['高校'],
    desc: 'ベクトルを動かして、和・差・実数倍と成分の関係を見る。', minutes: 15, keywords: ['ベクトル', '成分', '和', '差'], status: 'soon' },
  { id: 'derivative', title: '接線と導関数', subject: '数学', unit: '微分', grades: '高2', levels: ['高校'],
    desc: '曲線の上の点を動かして、接線の傾きの変化から導関数のグラフができる様子を見る。', minutes: 15,
    keywords: ['微分', '導関数', '接線', '微分係数'], status: 'soon' },
  { id: 'integral', title: '定積分と面積', subject: '数学', unit: '積分', grades: '高2', levels: ['高校'],
    desc: '分割の数をふやして、長方形の面積の和が定積分に近づく様子（区分求積）を見る。', minutes: 15,
    keywords: ['積分', '定積分', '区分求積', '面積'], status: 'soon' },

  // ---------- 物理 ----------
  { id: 'motion', title: '等速直線運動・等加速度運動', subject: '物理', unit: '力学', grades: '中3〜高1', levels: ['中学', '高校'],
    desc: '初速度と加速度を変えて物体を走らせ、位置・速度・加速度の時間変化を x-t・v-t・a-t グラフといっしょに見る。',
    lede: '初速度と加速度を決めて走らせると、物体の動きと 3 つのグラフがいっしょに進む。',
    minutes: 15, keywords: ['等速直線運動', '等加速度直線運動', '速さ', '速度', '加速度', 'v-tグラフ', 'x-tグラフ', '記録タイマー', 'ストロボ', '物理基礎'],
    status: 'open', lib: true },
  { id: 'projectile', title: '斜方投射', subject: '物理', unit: '力学', grades: '高1〜高2', levels: ['高校'],
    desc: '初速度と角度を変えて、放物運動の軌道・最高点・水平到達距離を見る。', minutes: 15, keywords: ['斜方投射', '放物運動', '水平投射'], status: 'soon' },
  { id: 'spring', title: 'ばね振り子', subject: '物理', unit: '力学', grades: '高2〜高3', levels: ['高校'],
    desc: '質量とばね定数を変えて、単振動の周期がどう変わるかを見る。', minutes: 15, keywords: ['単振動', 'ばね', '周期'], status: 'soon' },
  { id: 'sine-wave', title: '正弦波', subject: '物理', unit: '波動', grades: '高1', levels: ['高校'],
    desc: '振幅・波長・振動数・位相を変えて、波形と媒質の動きを見る。', minutes: 15, keywords: ['波', '正弦波', '波長', '振動数'], status: 'soon' },
  { id: 'interference', title: '波の干渉', subject: '物理', unit: '波動', grades: '高2〜高3', levels: ['高校'],
    desc: '2 つの波源から出た波が重なり、強め合う所・弱め合う所ができる様子を見る。波源の間かくと波長を変えて、経路差との関係を確かめる。',
    lede: '2 つの波源から出た波が重なると、強め合う所と弱め合う所ができる。どこがそうなるのかを経路差で確かめよう。',
    minutes: 20, keywords: ['干渉', '波源', '経路差', '強め合い', '弱め合い', '節線', '腹線', '水面波', '波長', '同位相', '逆位相'],
    status: 'open', lib: true },
  { id: 'refraction', title: '光の屈折', subject: '物理', unit: '光学', grades: '中1〜高2', levels: ['中学', '高校'],
    desc: '入射角と屈折率を変えて、屈折角・全反射を見る。', minutes: 10, keywords: ['屈折', '全反射', '屈折率', 'スネル'], status: 'soon' },
  { id: 'ohm', title: 'オームの法則', subject: '物理', unit: '電磁気', grades: '中2〜高1', levels: ['中学', '高校'],
    desc: '電圧と抵抗を変えて回路に流れる電流を見る。1 つの抵抗・直列・並列で、電流と電圧の分かれ方を電流計・電圧計の値とグラフで確かめる。',
    lede: '電圧と抵抗を変えて、回路に流れる電流を見よう。直列・並列のつなぎ方でも確かめられる。',
    minutes: 15, keywords: ['オームの法則', '電流', '電圧', '抵抗', '直列', '並列', '合成抵抗', '電力', '回路', '電流計', '電圧計'],
    status: 'open', lib: true },
  { id: 'rc-circuit', title: 'RC 回路', subject: '物理', unit: '電磁気', grades: '高3', levels: ['高校'],
    desc: 'コンデンサーの充電・放電で、電流と電圧が時間とともにどう変わるかを見る。', minutes: 15, keywords: ['コンデンサー', '充電', '放電', '時定数'], status: 'soon' },

  // ---------- 化学 ----------
  { id: 'atom', title: '原子の構造', subject: '化学', unit: '原子', grades: '中3〜高1', levels: ['中学', '高校'],
    desc: '陽子・中性子・電子の数を変えて、元素・同位体・イオンの関係を模式図で見る。', minutes: 10, keywords: ['原子', '陽子', '中性子', '電子', '同位体', 'イオン'], status: 'soon' },
  { id: 'molecule', title: '分子の立体構造', subject: '化学', unit: '分子', grades: '高1', levels: ['高校'],
    desc: '分子模型を回して、形と結合の角度を見る。', minutes: 10, keywords: ['分子', '立体構造', '結合角'], status: 'soon' },
  { id: 'reaction', title: '化学反応式と粒子数', subject: '化学', unit: '化学反応', grades: '中2〜高1', levels: ['中学', '高校'],
    desc: '反応の前後で粒子の数を数えて、原子の数が保存されることを確かめる。', minutes: 10, keywords: ['化学反応式', '係数', '質量保存'], status: 'soon' },
  { id: 'dilution', title: '濃度と希釈', subject: '化学', unit: '溶液', grades: '中1〜高1', levels: ['中学', '高校'],
    desc: '溶質と溶媒の量を変えて、質量パーセント濃度・モル濃度の変化を見る。', minutes: 10, keywords: ['濃度', '希釈', 'モル濃度'], status: 'soon' },
  { id: 'ph', title: 'pH と中和', subject: '化学', unit: '酸と塩基', grades: '中3〜高1', levels: ['中学', '高校'],
    desc: '酸と塩基の量を変えて、pH と中和の関係を見る。', minutes: 15, keywords: ['pH', '中和', '酸', '塩基', '滴定'], status: 'soon' },
  { id: 'gas', title: '気体の状態変化', subject: '化学', unit: '気体', grades: '高2', levels: ['高校'],
    desc: '圧力・体積・温度の関係（ボイル・シャルルの法則）を見る。', minutes: 15, keywords: ['気体', 'ボイル', 'シャルル', '状態方程式'], status: 'soon' },

  // ---------- 地学 ----------
  { id: 'moon-phase', title: '太陽・地球・月', subject: '地学', unit: '天文', grades: '中3', levels: ['中学'],
    desc: '月の位置を動かして、満ち欠けの見え方を見る。', minutes: 10, keywords: ['月', '満ち欠け', '月食', '日食'], status: 'soon' },
  { id: 'seasons', title: '地球の公転と季節', subject: '地学', unit: '天文', grades: '中3', levels: ['中学'],
    desc: '地軸の傾きと公転の位置から、昼の長さ・太陽の高さが変わる様子を見る。', minutes: 10, keywords: ['季節', '地軸', '南中高度'], status: 'soon' },
  { id: 'planets', title: '惑星の公転', subject: '地学', unit: '天文', grades: '中3〜高1', levels: ['中学', '高校'],
    desc: '軌道の大きさと公転周期の関係を見る。', minutes: 10, keywords: ['惑星', '公転周期', 'ケプラー'], status: 'soon' },
  { id: 'seismic', title: 'P 波・S 波', subject: '地学', unit: '地震', grades: '中1', levels: ['中学'],
    desc: '震源からの距離と初期微動継続時間の関係を見る。', minutes: 10, keywords: ['地震', 'P波', 'S波', '初期微動'], status: 'soon' },
  { id: 'clouds', title: '雲の発生', subject: '地学', unit: '気象', grades: '中2', levels: ['中学'],
    desc: '気温・湿度・露点の関係から、空気が上昇して雲ができる様子を見る。', minutes: 10, keywords: ['雲', '露点', '湿度', '飽和水蒸気量'], status: 'soon' }
];
