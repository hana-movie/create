'use strict';
/* ============================================================
   のんびり島ぐらし  初期版（1島め）
   仕様引き継ぎ書に基づく実装。仮置きの数値は CONFIG にまとめる。
   ============================================================ */

const VERSION = '0.15.1';   // 画面左下と ⚙️ に表示。更新時はここを上げる

// ---------- 調整用の定数（未確定仕様はここで仮置き） ----------
const CONFIG = {
  MAP: 15,              // 15×15
  TILE: 32,             // ワールド座標の1マスのピクセル
  START_COINS: 300,
  START_POP: 3,
  MAX_WORKERS: 5,       // 施設1棟あたり
  BASE_SEC: 10,         // 原材料1個の採集時間（作業員1人）。生産時間は材料の時間の合計（燃料の木材は加算しない）
  OFFLINE_MAX_SEC: 12 * 3600,
  // ---- 材料を取りに行くモデル（v0.7）。false にすると v0.6 の挙動（毎分の材料配分・採集10秒）に戻る ----
  FETCH_MODE: true,
  TILE_SEC: 1,          // 1マス1秒
  GATHER_TRIP: 2,       // 原材料は隣のマスなので往復2秒を加算
  CARRY_BASE: 1,        // 採集・生産施設の作業員が一度に運べる数
  WH_CARRY: 2,          // 倉庫の作業員が一度に運べる数
  MK_CARRY: 2,          // 市場の作業員が仕入れに行くとき一度に運べる数
  // 運搬レベル：施設ごと。上げると一度に運べる数が増える（作業員を入れ替えても変わらない）
  CARRY_BONUS: [0, 2, 4],                     // 運搬Lv1/2/3 の加算
  CARRY_COST: [{ bag: 5 }, { cart: 5 }],      // Lv1→2 はカバン5個、Lv2→3 は台車5個
  MARKET_SLOTS: 20,     // 市場の販売枠
  SPEEDS: [1, 2, 4],    // 時間加速の倍率
  DEBUG_SPEED: true,    // 時間加速ボタン（テスト用）。本番では false
  INV_CAP: 20,          // 施設内在庫の上限
  TRANSFER_SEC: 30,     // 完成品→倉庫の搬送間隔
  REFILL_SEC: 60,       // 倉庫→施設の材料補充間隔
  SLOT_CAP: 100,

  REGEN_SEC: 60,        // 資源マスの回復間隔（1個）
  BLOCK: 5,                        // エリア開放は5×5単位
  LAND_BASE: 200, LAND_STEP: 150,  // エリア開放価格 = BASE + STEP×開放済みエリア数（初期エリアを除く）
  HOUSE_BASE: 5, HOUSE_PER_AREA: 3, // 住居上限 = 初期5 + エリア開放ごとに3
  FIRST_AREA: [1, 2],               // 最初に開放できるエリア（初期マップの下）
  GATHER_RANGE: 1,                  // 採集範囲：施設の周り8マス（半径1）
  SLOT_MIN: 0,                      // 倉庫スロットの「確保」初期値（市場・生産への補充はこれを下回らない）
  HOUSE_CAP: 4,         // 住居1棟あたり人口上限
  POP_GROW_SEC: 180,    // 人口+1の間隔
  // ---- 幸福度（住民ごと）----
  // 個人幸福度 = 持っているアイテムの幸福ポイント合計 ÷ 分母 × 100（上限100）。分母は解放済みの最大加工段階で決まり、下がらない
  HAPPY_POINTS: [1, 2, 3, 4, 5],       // 加工段階 0/1/2/3 のアイテム1種あたりの幸福ポイント（仮）
  HAPPY_DENOM: null,                // null = 今手に入るアイテムの幸福ポイント合計（全部届けば100%、下がらない）。数値の配列にすると段階ごとの固定値
  // 人口の段階上限：今の人口が cap 未満の段のうち最初の段が適用される。
  // stage = その段に進むのに必要な加工段階（解放済み）、need = その段で人口が増えるのに必要な幸福度(%)
  POP_TIERS: [
    { cap: 8,   stage: 0, need: 35 },
    { cap: 12,  stage: 1, need: 35 },
    { cap: 20,  stage: 2, need: 40 },
    { cap: 28,  stage: 3, need: 45 },
    { cap: 40,  stage: 4, need: 50 },
    { cap: 60,  stage: 4, need: 60 },
    { cap: 80,  stage: 4, need: 70 },
    { cap: 100, stage: 4, need: 80 },
  ],
  // 市場・倉庫は最初から1つずつ建っている。コインで規模レベルを上げる（市場＝作業員、倉庫＝スロット）
  LEVELS: {
    market:    { workers: [3, 5, 7, 9, 11], cost: [0, 300, 600, 1200, 2400] },
    warehouse: { slots: [10, 20, 30, 40],   cost: [0, 400, 900, 1800] },
  },
  CONSUME_MULT: 1.5,    // 消費時間の倍率（搬送に時間がかかるようになったぶん長く）
  DELIVER_AT: 20,       // 施設の完成品棚がこの数以上（または作業できないとき）なら搬送先へ運ぶ
  DELIVER_BELOW: 30,        // 需要ゲージがこの%を切ったら配達対象
  MAX_GATHER_ITEMS: 4,  // 採集アイテムの種類上限（木材・石材・小麦・水）
  MAX_PROD_ITEMS: 5,    // 生産アイテムの種類上限
  SAVE_KEY: 'nonbiri-island-v15',
};

// consume: 住民が1個を消費しきる秒数（作るのに手間がかかる品ほど長い）
// stage: 加工段階（0=原材料 1=一次加工 2=二次加工 3=三次加工）。幸福ポイントと分母はこれで決まる
const ITEMS = {
  // 第0段階（原材料）
  wood:   { name: '木',     color: '#2e6b2a', price: 2,  consume: 90,  time: 10, stage: 0 },
  water:  { name: '水',     color: '#4a90e2', price: 2,  consume: 60,  time: 10, stage: 0 },
  stone:  { name: '石',     color: '#8a8a8a', price: 2,  consume: 90,  time: 10, stage: 0 },
  wheat:  { name: '小麦',   color: '#d4b24a', price: 2,  consume: 90,  time: 10, stage: 0 },
  cotton: { name: '綿',     color: '#f0f0f0', price: 2,  consume: 90,  time: 10, stage: 0 },
  orange: { name: 'オレンジ', color: '#f08a24', price: 2, consume: 90, time: 10, stage: 0 },
  // 第1段階（原材料×2）
  timber: { name: '木材',   color: '#8b5a2b', price: 5,  consume: 180, time: 20, stage: 1 },
  brick:  { name: '石材',   color: '#b5533c', price: 5,  consume: 180, time: 20, stage: 1 },
  thread: { name: '糸',     color: '#d8c8b0', price: 5,  consume: 180, time: 20, stage: 1 },
  flour:  { name: '小麦粉', color: '#f2eee0', price: 5,  consume: 180, time: 20, stage: 1 },
  juice:  { name: 'オレンジジュース', color: '#f5a623', price: 5, consume: 180, time: 20, stage: 1 },
  // 第2段階（1段階×2、または 0段階×2＋1段階×1）
  plank:  { name: '板材',   color: '#c49a5a', price: 10, consume: 240, time: 40, stage: 2 },
  wheel:  { name: '車輪',   color: '#7a5a3a', price: 10, consume: 240, time: 40, stage: 2 },
  cutstone:{ name: '切石',  color: '#a0a0a8', price: 10, consume: 240, time: 40, stage: 2 },
  cloth:  { name: '布',     color: '#e8d8f0', price: 10, consume: 240, time: 40, stage: 2 },
  bread:  { name: 'パン',   color: '#d9893b', price: 10, consume: 240, time: 30, stage: 2 },
  // 第3段階（2段階×2）
  bag:    { name: 'カバン', color: '#8a6a3a', price: 20, consume: 360, time: 80, stage: 3 },  // 施設の運搬レベルを上げるのにも使う
  clothes:{ name: '服',     color: '#c05070', price: 20, consume: 360, time: 80, stage: 3 },
  // 第4段階（2段階×4 など）
  cart:   { name: '台車',   color: '#6a4a2a', price: 40, consume: 480, time: 160, stage: 4 },  // 施設の運搬レベルを上げるのにも使う
};
// fuel: 火として使う木材（生産時間には加算しない）
// buy のあるレシピはコインで購入すると使える（購入した時点で加工段階が上がる）。up: true はさらに施設Lv2が必要
const RECIPES = {
  timber:  { out: 'timber',  need: { wood: 2 } },
  plank:   { out: 'plank',   need: { timber: 2 }, up: true, buy: 200 },
  wheel:   { out: 'wheel',   need: { timber: 2 }, buy: 250 },
  cart:    { out: 'cart',    need: { wheel: 2, plank: 2 }, up: true, buy: 500 },
  brick:   { out: 'brick',   need: { stone: 2 } },
  cutstone:{ out: 'cutstone',need: { brick: 2 }, up: true, buy: 200 },
  thread:  { out: 'thread',  need: { cotton: 2 } },
  cloth:   { out: 'cloth',   need: { thread: 2 }, up: true, buy: 250 },
  bag:     { out: 'bag',     need: { cloth: 2 }, buy: 300 },
  clothes: { out: 'clothes', need: { cloth: 2 }, up: true, buy: 400 },
  flour:   { out: 'flour',   need: { wheat: 2 } },
  bread:   { out: 'bread',   need: { flour: 1, water: 1, wood: 1 }, fuel: 'wood' },
  juice:   { out: 'juice',   need: { orange: 1, water: 1 } },
};
// 採集所が採れる資源（水は井戸で別に扱う）
const GATHERABLE = ['wood', 'stone', 'wheat', 'cotton', 'orange'];
function gRes(b) { return b.res || BUILD[b.type].res || 'wood'; }
function noRes(b) { return gRes(b) === 'water'; }
// 1個あたりの作業時間（作業員1人）：採集は10秒、生産は材料の時間の合計
function workSec(b) {
  const d = BUILD[b.type];
  if (d.kind === 'gather') return ITEMS[gRes(b)].time + (CONFIG.FETCH_MODE && !noRes(b) ? CONFIG.GATHER_TRIP : 0);
  if (d.kind === 'prod') { if (!b.recipe) return CONFIG.BASE_SEC; const r = RECIPES[b.recipe]; let t = 0; for (const m in r.need) if (m !== r.fuel) t += ITEMS[m].time * r.need[m]; return t; }
  return CONFIG.BASE_SEC;
}

const CATS = [
  { id: 'gather', name: '採集' },
  { id: 'prod',   name: '生産' },
  { id: 'home',   name: '暮らし' },
];

// bp: 設計図の価格（0 = 最初から建てられる）。req: 設計図を買うのに必要な設計図。
// 採集施設（資源マスが必要なもの）は、その資源を見つけてから設計図を買える
const BUILD = {
  house:    { name: '住居',     cat: 'home',   size: 1, kind: 'house',   bp: 0,   cost: { coins: 50, wood: 5 }, desc: '住民が4人まで住めます。建てられる数はエリア開放ごとに増えます。' },
  collect:  { name: '採集所',   cat: 'gather', size: 1, kind: 'gather',  bp: 0,   cost: { coins: 30 }, desc: '原材料を採集します。何を採るかはパネルで選べます（見つけた資源）。周り8マスの資源から採ります。' },
  well:     { name: '井戸',     cat: 'gather', size: 1, kind: 'gather',  bp: 40,  res: 'water', cost: { coins: 30 }, desc: '水を汲みます。資源マスは不要で、枯れません。' },
  sawmill:  { name: '製材所',   cat: 'prod',   size: 1, kind: 'prod', upCost: 300, bp: 200, recipes: ['timber', 'plank'], cost: { coins: 120, wood: 10 }, desc: '木2 → 木材 ／ Lv2：木材2 → 板材' },
  workshop: { name: '加工所',   cat: 'prod',   size: 1, kind: 'prod', upCost: 600, bp: 400, req: ['sawmill'], recipes: ['wheel', 'cart'], cost: { coins: 250, plank: 5 }, desc: 'レシピ購入：木材2 → 車輪 ／ Lv2：車輪2＋板材2 → 台車' },
  mason:    { name: '石工所',   cat: 'prod',   size: 1, kind: 'prod', upCost: 300, bp: 200, needRes: 'stone', recipes: ['brick', 'cutstone'], cost: { coins: 120, stone: 10 }, desc: '石2 → 石材 ／ Lv2：石材2 → 切石' },
  spinner:  { name: '紡績所',   cat: 'prod',   size: 1, kind: 'prod', upCost: 400, bp: 250, needRes: 'cotton', recipes: ['thread', 'cloth'], cost: { coins: 150, timber: 5 }, desc: '綿2 → 糸 ／ Lv2：糸2 → 布' },
  tailor:   { name: '仕立て屋', cat: 'prod',   size: 1, kind: 'prod', upCost: 600, bp: 400, req: ['spinner'], recipes: ['bag', 'clothes'], cost: { coins: 250, plank: 5 }, desc: 'レシピ購入：布2 → カバン ／ Lv2：布2 → 服' },
  mill:     { name: '製粉所',   cat: 'prod',   size: 1, kind: 'prod', bp: 200, needRes: 'wheat', recipes: ['flour'], cost: { coins: 150, timber: 5 }, desc: '小麦2 → 小麦粉' },
  bakery:   { name: 'パン屋',   cat: 'prod',   size: 1, kind: 'prod', bp: 350, req: ['mill'], recipes: ['bread'], cost: { coins: 250, brick: 5 }, desc: '小麦粉1＋水1＋木1（燃料） → パン' },
  drinks:   { name: '飲料工房', cat: 'prod',   size: 1, kind: 'prod', bp: 200, needRes: 'orange', recipes: ['juice'], cost: { coins: 150, timber: 5 }, desc: 'オレンジ1＋水1 → オレンジジュース' },
  market:   { name: '市場',     cat: 'home',   size: 1, kind: 'market', fixed: true, cost: {}, desc: '作業員が住民に商品を届け、コインを得ます。島に1つだけ（最初から建っています）。規模レベルを上げると作業員が増えます。' },
  warehouse:{ name: '倉庫',     cat: 'home',   size: 1, kind: 'warehouse', fixed: true, cost: {}, desc: '島の共通倉庫。島に1つだけ（最初から建っています）。規模レベルを上げるとスロットが増えます。作業員を置くと施設の完成品を回収し、市場や生産施設へ届けます。' },
};

// 目標は報酬と案内だけ。施設は建築メニューで設計図を買って解放する。hint は関数でも可（状況で文面を変える）
// main は一本道。main を終えたあと、wheat / cotton は「その資源を見つけたら」始まる（並行して進められる）
const GOAL_TRACKS = {
  main: { when: () => true, list: [
    { id: 'm1', text: '採集所を建てて木を5個採集',      stat: 'made_wood',   n: 5,  reward: 60, hint: '採集所のパネルで「採るもの」を選べます。木の近くに建てましょう' },
    { id: 'm2', text: '井戸を建てて水を5個採集',        stat: 'made_water',  n: 5,  reward: 60, hint: '建築メニューで🔒の井戸をタップすると設計図を買えます（水はどこでも汲めます）' },
    { id: 'm3', text: '倉庫のスロットに品物を設定',     stat: 'slot_set',    n: 1,  reward: 60, hint: '倉庫に作業員を置くと、施設の完成品を回収して倉庫に入れます' },
    { id: 'm4', text: '市場の販売商品を設定',           stat: 'market_set',  n: 1,  reward: 60, hint: '市場に作業員を置くと、住民に商品を届けてコインを得ます' },
    { id: 'm5', text: '販売で20コイン稼ぐ',             stat: 'earned',      n: 20, reward: 60 },
    { id: 'm6', text: '住居を建てて住民を5人にする',    stat: 'pop',         n: 5,  reward: 100, area: 1, hint: () => `島の幸福度が${growNeed()}%に届くと3分ごとに1人増えます。達成で下のエリアを開放できます` },
    { id: 'm7', text: '下のエリアを開放する',           stat: 'areas',       n: 2,  reward: 150, area: 2 },
    { id: 'm8', text: '石を5個採集',                    stat: 'made_stone',  n: 5,  reward: 150, hint: () => findHint('stone') },
    { id: 'm9', text: '製材所で木材を5個つくる',        stat: 'made_timber', n: 5,  reward: 150, hint: '製材所の設計図を買うと、木材（第1段階）と板材（第2段階）が解放され、幸福度の分母が上がります' },
  ] },
};
const GOALS = Object.values(GOAL_TRACKS).flatMap(t => t.list);  // 全目標（参照用）
function goalIdx(tr) { S.goalIdx = S.goalIdx || {}; return S.goalIdx[tr] || 0; }
// 今出ている目標（main を終えるまでは main だけ）
function activeGoals() {
  const out = [], mainDone = goalIdx('main') >= GOAL_TRACKS.main.list.length;
  for (const tr in GOAL_TRACKS) {
    const T = GOAL_TRACKS[tr], i = goalIdx(tr);
    if (tr !== 'main' && !mainDone) continue;
    if (i >= T.list.length || !T.when()) continue;
    out.push({ tr, g: T.list[i] });
  }
  return out;
}
function allGoalsDone() { return Object.keys(GOAL_TRACKS).every(tr => goalIdx(tr) >= GOAL_TRACKS[tr].list.length); }
function claimGoal(tr) {
  const g = GOAL_TRACKS[tr].list[goalIdx(tr)]; if (!g || goalProgress(g) < g.n) return false;
  S.coins += g.reward; toast(`🪙${g.reward} 獲得`);
  if (g.area && S.areaStage < g.area) { S.areaStage = g.area; notify(g.area === 1 ? '🗺 下のエリアを開放できるようになりました' : '🗺 隣のエリアを自由に開放できるようになりました'); }
  S.goalIdx[tr] = goalIdx(tr) + 1;
  if (allGoalsDone()) notify('🎉 すべての目標を達成しました！ここからは自由モードです');
  return true;
}
// 資源を見つけているかどうかで案内を変える
function findHint(res) {
  if (resFound(res)) return `${ITEMS[res].name}は見つかっています。${ITEMS[res].name}の近くに採集所を建てて「${ITEMS[res].name}」を選びましょう`;
  return `${ITEMS[res].name}のあるエリアを開放すると、採集所で採れるようになります`;
}
const INITIAL_UNLOCK = ['house', 'collect', 'market', 'warehouse'];
// ---------- 設計図 ----------
function resFound(res) { return S.tiles.some(t => t.unl && t.res && t.res.t === res); }
// 設計図を買えない理由（買えるなら null）
function bpBlocker(type) {
  const d = BUILD[type];
  if (d.needRes && !resFound(d.needRes)) return `${ITEMS[d.needRes].name}を見つけていません（エリアを開放）`;
  const miss = (d.req || []).filter(r => !S.unlocked.includes(r));
  if (miss.length) return `先に ${miss.map(r => BUILD[r].name).join('・')} の設計図が必要`;
  return null;
}
function buyBlueprint(type) {
  const d = BUILD[type];
  if (S.unlocked.includes(type) || bpBlocker(type) || S.coins < d.bp) return false;
  S.coins -= d.bp; S.unlocked.push(type); S.newTypes.push(type);
  notify(`📐 ${d.name}の設計図を買いました`);
  return true;
}

// ---------- ドット絵スプライト（16×16） ----------
const PAL = {
  // 木・草
  g: '#6abf5a', G: '#4d9a44', t: '#3f8f3a', T: '#2c6b2a', u: '#1f4f1f',
  // 幹・木材
  b: '#8a5a2b', B: '#5e3a16', n: '#c89a5e', N: '#a87a42', m: '#e2bf86',
  // 石
  s: '#b8b8b8', S: '#8c8c8c', d: '#5e5e5e', x: '#d8d8d8',
  // 小麦
  w: '#f0d060', W: '#c9a43a', v: '#8f7020',
  // 屋根・レンガ
  r: '#d9483b', R: '#a3302a', q: '#c0634e', Q: '#8e4232',
  // 壁
  c: '#f6ead0', C: '#d9c7a2', k: '#2d2d2d',
  // 黄色・オレンジ
  y: '#f4c04a', Y: '#c48f1f', o: '#e08a3c', O: '#a85f22',
  // 白・小麦粉・パン
  p: '#f2f2f2', P: '#c4c4c4', f: '#fbf5e4', h: '#d89a4a', H: '#a86a22',
  // 水色・青
  l: '#5aa0e6', L: '#2f6fb8', e: '#8fd0ff',
  // 肌
  i: '#f5d2a8',
};
const SPR = {
  tree: [
    '......uu........',
    '.....uTTu.......',
    '....uTTTTu......',
    '...uTTttTTu.....',
    '..uTTtttTTTu....',
    '..uTttttTTTu....',
    '.uTTtttTTTTTu...',
    '.uTTTttTTTTTu...',
    '.uTTTTTTTTTTu...',
    '..uTTTTTTTTu....',
    '...uTTTTTTu.....',
    '....uuBBuu......',
    '......BB........',
    '......BB........',
    '.....bBBb.......',
    '................',
  ],
  rock: [
    '................',
    '................',
    '......ddd.......',
    '.....dxssd......',
    '....dxsssSd.....',
    '...dxssssSSd....',
    '...dssssSSSd....',
    '..dxsssSSSSSd...',
    '..dsssSSSSSSd...',
    '..dssSSSSSSdd...',
    '..ddSSSSSSSd....',
    '...dddSSSddd....',
    '.....ddddd......',
    '................',
    '................',
    '................',
  ],
  cotton: [
    '................',
    '..pp......pp....',
    '.pPPp....pPPp...',
    '.pPPp.pp.pPPp...',
    '..pp.pPPp.pp....',
    '..t..pPPp..t....',
    '..t...pp...t....',
    '.pp...t...pp....',
    'pPPp..t..pPPp...',
    'pPPp.pp..pPPp...',
    '.pp.pPPp..pp....',
    '..t.pPPp...t....',
    '..t..pp....t....',
    '..t...t....t....',
    '.ttt.ttt..ttt...',
    '................',
  ],
  wheat: [
    '................',
    '..w...w...w.....',
    '.wWw.wWw.wWw....',
    '.wWw.wWw.wWw..w.',
    '.wWw.wWw.wWw.wWw',
    '..W...W...W..wWw',
    '..v...v...v..wWw',
    '..v...v...v...W.',
    '.w.v.w.v.w.v..v.',
    'wWwv.wWwvwWwv.v.',
    'wWwv.wWwvwWwv.v.',
    '.W.v..W.v.W.v.v.',
    '.v.v..v.v.v.v.v.',
    '.v.v..v.v.v.v.v.',
    '.v....v...v...v.',
    '................',
  ],
  house: [
    '................',
    '.......RR.......',
    '......RrrR......',
    '.....RrrrrR.....',
    '....RrrrrrrR....',
    '...RrrrrrrrrR...',
    '..RrrrrrrrrrrR..',
    '.RRRRRRRRRRRRRR.',
    '..cccccccccccc..',
    '..cCCccccccCCc..',
    '..cCkCcccckCkc..',
    '..cCkCcccckCkc..',
    '..cCCCccBBcCCc..',
    '..ccccccBBcccc..',
    '..CCCCCCBBCCCC..',
    '................',
  ],
  well: [
    '................',
    '....BBBBBBBB....',
    '...BnnnnnnnnB...',
    '..BnnnnnnnnnnB..',
    '..BBBBBBBBBBBB..',
    '...B........B...',
    '...B........B...',
    '...B..dddd..B...',
    '...BddssssddB...',
    '..ddsSlllLSsdd..',
    '..dsSlleelLSsd..',
    '..dsSllllllSsd..',
    '..dsSSSSSSSSsd..',
    '..ddddddddddd...',
    '................',
    '................',
  ],
  lumber: [
    '................',
    '......uu........',
    '.....uTTu.......',
    '....uTTTTu...BB.',
    '...uTTTTTTu.BnnB',
    '....uTTTTu..BnnB',
    '......BB.....BB.',
    '..BBBBBBBBBBBB..',
    '.BnnnnnnnnnnnnB.',
    '.BnNNNNNNNNNNnB.',
    '.BnNcccccccCNnB.',
    '.BnNcCkkCccCNnB.',
    '.BnNcCkkCccCNnB.',
    '.BnNcccccccCNnB.',
    '.BBBBBBBBBBBBBB.',
    '................',
  ],
  quarry: [
    '................',
    '....ddd.........',
    '...dxssd...dd...',
    '..dxsssSd.dxsd..',
    '..dssSSSd.dsSd..',
    '..ddSSSdd..dd...',
    '...ddddd........',
    '..dddddddddddd..',
    '.dssssssssssssd.',
    '.dsSSSSSSSSSSsd.',
    '.dsSccccccccSsd.',
    '.dsScCkkCcccSsd.',
    '.dsScCkkCcccSsd.',
    '.dsSccccccccSsd.',
    '.dddddddddddddd.',
    '................',
  ],
  cottonfarm: [
    '................',
    '.p.p.p.p.p.p.p..',
    'pPpPpPpPpPpPpPp.',
    '.t.t.t.t.t.t.t..',
    '.t.t.t.t.t.t.t..',
    '.BBBBBBBBBBBBBB.',
    '.BnnnnnnnnnnnnB.',
    '.BnppppppppppnB.',
    '.BnPPPPPPPPPPnB.',
    '.BnccccccccccnB.',
    '.BncCCccccCCcnB.',
    '.BncCkCccbbkcnB.',
    '.BncCkCccbbkcnB.',
    '.BnccccccbbccnB.',
    '.BBBBBBBBBBBBBB.',
    '................',
  ],
  weaver: [
    '................',
    '..BBBBBBBBBBBB..',
    '.BnnnnnnnnnnnnB.',
    '.BNNNNNNNNNNNNB.',
    '.BBBBBBBBBBBBBB.',
    '.BccccccccccccB.',
    '.BcBBBBBBBBBBcB.',
    '.BcBpepepepeBcB.',
    '.BcBepepepepBcB.',
    '.BcBpepepepeBcB.',
    '.BcBBBBBBBBBBcB.',
    '.BccccccccccccB.',
    '.BcCkkCcccccccB.',
    '.BcCkkCccccccB..',
    '.BBBBBBBBBBBBBB.',
    '................',
  ],
  farm: [
    '................',
    '.w.w.w.w.w.w.w..',
    'wWwWwWwWwWwWwWw.',
    '.v.v.v.v.v.v.v..',
    '.v.v.v.v.v.v.v..',
    '.BBBBBBBBBBBBBB.',
    '.BnnnnnnnnnnnnB.',
    '.BnRRRRRRRRRRnB.',
    '.BnRrrrrrrrrRnB.',
    '.BnccccccccccnB.',
    '.BncCCccccCCcnB.',
    '.BncCkCccbbkcnB.',
    '.BncCkCccbbkcnB.',
    '.BnccccccbbccnB.',
    '.BBBBBBBBBBBBBB.',
    '................',
  ],
  sawmill: [
    '................',
    '..BBBBBBBBBBBB..',
    '.BnnnnnnnnnnnnB.',
    '.BnNNNNNNNNNNnB.',
    '.BBBBBBBBBBBBBB.',
    '.BccccccccccccB.',
    '.BcmmmmccmmmmcB.',
    '.BcmNNmccmNNmcB.',
    '.BcmmmmccmmmmcB.',
    '.BccccccccccccB.',
    '.BcCCCCccCCCCcB.',
    '.Bcccccc..ddd.B.',
    '.BcCkkCc.dxsxd..',
    '.BcCkkCc.dxsxd..',
    '.BBBBBBBB.ddd...',
    '................',
  ],
  mason: [
    '................',
    '..dddddddddddd..',
    '.dssssssssssssd.',
    '.dsSSSSSSSSSSsd.',
    '.dddddddddddddd.',
    '.dccccccccccccd.',
    '.dcqqQqqQqqQqcd.',
    '.dcQqqQqqQqqQcd.',
    '.dcqqQqqQqqQqcd.',
    '.dccccccccccccd.',
    '.dcCCCCccCCCCcd.',
    '.dccccccckkkccd.',
    '.dcCkkCcckkkccd.',
    '.dcCkkCccccccd..',
    '.dddddddddddddd.',
    '................',
  ],
  mill: [
    '....p.......p...',
    '...pPp.....pPp..',
    '....pPp...pPp...',
    '.....pPp.pPp....',
    '......pPpPp.....',
    '.......ppp......',
    '......pPpPp.....',
    '.....pPp.pPp....',
    '....pPp.ccc.pPp.',
    '...pPp.ccccc.pPp',
    '..p...ccccccc...',
    '......cCCCCCc...',
    '......cCkkkCc...',
    '......cCkkkCc...',
    '......CCCCCCC...',
    '................',
  ],
  workshop: [
    '................',
    '..BBBBBBBBBBBB..',
    '.BNNNNNNNNNNNNB.',
    '.BnnnnnnnnnnnnB.',
    '.BBBBBBBBBBBBBB.',
    '.BccccccccccccB.',
    '.BcyyyyccnnnncB.',
    '.BcyYYyccnBBncB.',
    '.BcyyyyccnnnncB.',
    '.BccccccccccccB.',
    '.BcCCCCccCCCCcB.',
    '.BccccccccccccB.',
    '.BcCkkCccdxxdcB.',
    '.BcCkkCccdxxdcB.',
    '.BBBBBBBBBBBBBB.',
    '................',
  ],
  bakery: [
    '................',
    '..OOOOOOOOOOOO..',
    '.OooooooooooooO.',
    '.OohhhhhhhhhhoO.',
    '.OOOOOOOOOOOOOO.',
    '.OccccccccccccO.',
    '.OcffffccffffcO.',
    '.OcfhhfccfhhfcO.',
    '.OcfHhfccfhHfcO.',
    '.OcffffccffffcO.',
    '.OcCCCCccCCCCcO.',
    '.OccccccccccccO.',
    '.OcCkkCcccccccO.',
    '.OcCkkCcckkkccO.',
    '.OOOOOOOOOOOOOO.',
    '................',
  ],
  warehouse: [
    '................',
    '..BBBBBBBBBBBB..',
    '.BnnnnnnnnnnnnB.',
    '.BnNNNNNNNNNNnB.',
    '.BnnnnnnnnnnnnB.',
    '.BBBBBBBBBBBBBB.',
    '.BNNNNNNNNNNNNB.',
    '.BNmmmNNNmmmNNB.',
    '.BNmBmNNNmBmNNB.',
    '.BNmmmNNNmmmNNB.',
    '.BNNNNNNNNNNNNB.',
    '.BNNNNBBBBNNNNB.',
    '.BNNNNBnnBNNNNB.',
    '.BNNNNBnnBNNNNB.',
    '.BBBBBBBBBBBBBB.',
    '................',
  ],
  market: [
    '................',
    '.rrpprrpprrpprr.',
    '.rrpprrpprrpprr.',
    '.RRRRRRRRRRRRRR.',
    '..B..........B..',
    '..B..........B..',
    '..B.ww.hh.ss.B..',
    '..B.wW.hH.sS.B..',
    '..BBBBBBBBBBBB..',
    '..BnnnnnnnnnnB..',
    '..BnNNNNNNNNnB..',
    '..BnnnnnnnnnnB..',
    '..B..........B..',
    '..B..........B..',
    '.BBB........BBB.',
    '................',
  ],
};
// 住民（8×8、1色差し替え用）
SPR.collect = SPR.lumber;
SPR.spinner = SPR.weaver;
SPR.orangetree = [
  '......uu........',
  '.....uTTu.......',
  '....uTTTTu......',
  '...uTToTTTu.....',
  '..uTTTTTTTTu....',
  '..uTTTTToTTu....',
  '.uToTTTTTTTTu...',
  '.uTTTTTTToTTu...',
  '.uTTTToTTTTTu...',
  '..uTTTTTTTTu....',
  '...uToTTTTu.....',
  '....uuBBuu......',
  '......BB........',
  '......BB........',
  '.....bBBb.......',
  '................',
];
SPR.tailor = [
  '................',
  '..rrrrrrrrrrrr..',
  '.rRRRRRRRRRRRRr.',
  '.rrrrrrrrrrrrrr.',
  '.BBBBBBBBBBBBBB.',
  '.BccccccccccccB.',
  '.Bc.rr..cpppcB..',
  '.BcrRRr.cpPpcB..',
  '.BcrRRr.cpppcB..',
  '.Bc.rr..ccccB...',
  '.BcCCCCccCCCCcB.',
  '.BccccccccccccB.',
  '.BcCkkCcccccccB.',
  '.BcCkkCcccccccB.',
  '.BBBBBBBBBBBBBB.',
  '................',
];
SPR.drinks = [
  '................',
  '..oooooooooooo..',
  '.oOOOOOOOOOOOOo.',
  '.oooooooooooooo.',
  '.BBBBBBBBBBBBBB.',
  '.BccccccccccccB.',
  '.Bc.p..p..p.ccB.',
  '.Bc.y..o..y.ccB.',
  '.Bc.Y..O..Y.ccB.',
  '.BcppppppppppcB.',
  '.BcCCCCccCCCCcB.',
  '.BccccccccccccB.',
  '.BcCkkCcccccccB.',
  '.BcCkkCcccccccB.',
  '.BBBBBBBBBBBBBB.',
  '................',
];
const VILL = ['..ii....', '..ii....', '.llll...', '.llll...', '..ll....', '.ll.l...', '.B..B...', '........'];
const WORK = ['..ii....', '.yii....', '.oooo...', '.oooo...', '..oo....', '.oo.o...', '.B..B...', '........'];

// ---------- 状態 ----------
let S = null;          // セーブ対象の状態
let occ = [];          // マス → 建物id（占有）
const N = CONFIG.MAP;
const idx = (x, y) => y * N + x;
const NB = CONFIG.MAP / CONFIG.BLOCK;            // 3×3 エリア
const bidx = (bx, by) => by * NB + bx;
const blockOf = (x, y) => [Math.floor(x / CONFIG.BLOCK), Math.floor(y / CONFIG.BLOCK)];
function unlockBlock(bx, by) {
  S.blocks[bidx(bx, by)] = true;
  const found = new Set();
  for (let y = by * CONFIG.BLOCK; y < (by + 1) * CONFIG.BLOCK; y++) for (let x = bx * CONFIG.BLOCK; x < (bx + 1) * CONFIG.BLOCK; x++) { const t = S.tiles[idx(x, y)]; t.unl = true; if (t.res) found.add(t.res.t); }
  S.stats.areas = blocksOpen();
  if (S.areaStage === 1) S.areaStage = 2;
  // 新しい資源の発見 → 採集所で選べるようになったことを知らせる
  for (const res of found) { if (S.buildings.length && !S.notified['found_' + res]) { S.notified['found_' + res] = true; notify(`🔎 ${ITEMS[res].name}を発見！ 採集所で採れるようになりました`); } }
}
function blocksOpen() { return S.blocks.filter(Boolean).length; }
function houseCap() { return CONFIG.HOUSE_BASE + CONFIG.HOUSE_PER_AREA * (blocksOpen() - 1); }
const inMap = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function newGame() {
  const r = rng(Date.now() & 0xffff);
  const tiles = [];
  for (let i = 0; i < N * N; i++) tiles.push({ unl: false, res: null });
  const c = Math.floor(N / 2), B = CONFIG.BLOCK, cb = Math.floor(NB / 2);
  const put = (x, y, t) => { tiles[idx(x, y)].res = { t, amt: 60 + Math.floor(r() * 40), max: 100 }; };
  // かたまり配置：エリア内に種類 t の資源を n マス、ひとつながりで置く
  const cluster = (bx, by, t, n, avoid) => {
    const x0 = bx * B, y0 = by * B;
    let tries = 30;
    while (tries--) {
      const sx = x0 + Math.floor(r() * B), sy = y0 + Math.floor(r() * B);
      if (tiles[idx(sx, sy)].res || (avoid && avoid(sx, sy))) continue;
      const cells = [[sx, sy]]; const set = new Set([idx(sx, sy)]);
      let guard = 60;
      while (cells.length < n && guard--) {
        const [cx, cy] = cells[Math.floor(r() * cells.length)];
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(r() * 4)];
        const nx = cx + dx, ny = cy + dy;
        if (nx < x0 || ny < y0 || nx >= x0 + B || ny >= y0 + B || set.has(idx(nx, ny)) || tiles[idx(nx, ny)].res || (avoid && avoid(nx, ny))) continue;
        cells.push([nx, ny]); set.add(idx(nx, ny));
      }
      if (cells.length >= Math.min(n, 4)) { for (const [x, y] of cells) put(x, y, t); return true; }
    }
    return false;
  };
  const nearHome = (x, y) => Math.abs(x - c) <= 2 && Math.abs(y - c) <= 1;
  // 初期マップ（中央）：木のかたまり2つ。住居の周りは空ける
  cluster(cb, cb, 'wood', 7, nearHome); cluster(cb, cb, 'wood', 6, nearHome);
  // 2エリアめ（下）：石2つ
  cluster(cb, cb + 1, 'stone', 7); cluster(cb, cb + 1, 'stone', 6);
  // 左右・上：小麦＋木 or 石。四隅：綿＋何か
  cluster(cb - 1, cb, 'wheat', 7); cluster(cb - 1, cb, 'wood', 6);
  cluster(cb + 1, cb, 'orange', 7); cluster(cb + 1, cb, 'stone', 6);
  cluster(cb, cb - 1, 'wheat', 7); cluster(cb, cb - 1, 'wood', 6);
  cluster(cb - 1, cb - 1, 'cotton', 7); cluster(cb - 1, cb - 1, 'wood', 6);
  cluster(cb + 1, cb - 1, 'cotton', 7); cluster(cb + 1, cb - 1, 'orange', 6);
  cluster(cb - 1, cb + 1, 'cotton', 7); cluster(cb - 1, cb + 1, 'wheat', 6);
  cluster(cb + 1, cb + 1, 'cotton', 7); cluster(cb + 1, cb + 1, 'wood', 6);

  S = {
    v: 11, coins: CONFIG.START_COINS, pop: CONFIG.START_POP, happy: 0, residents: [], maxStage: 0,
    tiles, blocks: new Array(NB * NB).fill(false), areaStage: 0, buildings: [], nextId: 1, order: 1,
    slots: [], unlocked: [...INITIAL_UNLOCK], lastTab: 'gather',
    stats: { made_water: 0, made_wood: 0, made_stone: 0, made_wheat: 0, made_plank: 0, made_brick: 0, made_flour: 0, made_bread: 0, made_basket: 0, made_wheel: 0, made_cart: 0, dest_market: 0, dest_warehouse: 0, wh_ready: 0, made_cotton: 0, made_cloth: 0, made_thread: 0, made_clothset: 0, made_bag: 0, made_clothes: 0, recipe_bag: 0, bags_given: 0, built_house: 0, slot_set: 0, market_set: 0, earned: 0, happyMax: 0, areas: 1 },
    goalIdx: { main: 0 }, newTypes: [], notified: {},
    t: 0, timers: { transfer: 0, refill: 0, regen: 0, grow: 0 },
    speed: 1, recipes: [], lastSave: Date.now(),
  };
  unlockBlock(cb, cb);
  addBuilding('house', c, c, true);
  addBuilding('warehouse', c - 1, c, true);
  addBuilding('market', c + 1, c, true);
  for (let i = 0; i < S.pop; i++) addResident();
}
// ---------- 住民 ----------
// 住民は家に属し、商品ごとの需要ゲージ（100→0）を持つ。幸福度はゲージ>0のアイテムの幸福ポイント合計から
function houseOf(r) { return r.house ? getB(r.house) : null; }
function residentsOf(h) { return S.residents.filter(r => r.house === h.id); }
function houseWithRoom() { const hs = S.buildings.filter(b => b.type === 'house' && residentsOf(b).length < CONFIG.HOUSE_CAP).sort((a, b) => residentsOf(a).length - residentsOf(b).length || a.order - b.order); return hs[0] || null; }
function addResident() { const h = houseWithRoom(); const r = { id: S.residents.length + 1, house: h ? h.id : null, demand: {}, happy: 0 }; S.residents.push(r); recalcHappy(); return r; }
function rehouse() { for (const r of S.residents) if (!r.house || !getB(r.house)) { const h = houseWithRoom(); r.house = h ? h.id : null; } }
function itemPoints(k) { return CONFIG.HAPPY_POINTS[ITEMS[k].stage] || 0; }
function happyDenom() {
  const st = S.maxStage || 0;
  if (CONFIG.HAPPY_DENOM) return CONFIG.HAPPY_DENOM[Math.min(st, CONFIG.HAPPY_DENOM.length - 1)];
  // 自動：今手に入る（見つけた資源・設計図のある施設で作れる）アイテムのポイント合計。全部届けば100%。下がらない
  let d = 0; for (const k of unlockedItems()) d += itemPoints(k);
  S.denomMax = Math.max(S.denomMax || 0, d); return Math.max(1, S.denomMax);
}
function residentPoints(r) { let p = 0; for (const k in r.demand) if (r.demand[k] > 0) p += itemPoints(k); return p; }
function recalcHappy() {
  for (const r of S.residents) r.happy = Math.min(100, residentPoints(r) / happyDenom() * 100);
  S.happy = S.residents.length ? S.residents.reduce((a, r) => a + r.happy, 0) / S.residents.length : 0;
  if (S.happy > S.stats.happyMax) S.stats.happyMax = S.happy;
}
// 人口の段階：今の人口が属する段（cap 未満の最初の段）
function popTier() { return CONFIG.POP_TIERS.find(t => S.pop < t.cap) || null; }
function growNeed() { const t = popTier(); return t ? t.need : 100; }
// 段の上限で止まっているときの理由（増やせるなら null）
function tierBlock() { const t = popTier(); if (!t) return '島の人口は最大です'; if (t.stage > (S.maxStage || 0)) return `第${t.stage}段階の品を解放すると${t.cap}人まで増やせます`; return null; }
function canGrow() { return !tierBlock() && S.happy >= growNeed(); }
function popLimit() { let c = 0; for (const t of CONFIG.POP_TIERS) if (t.stage <= (S.maxStage || 0)) c = t.cap; return c; }
// 解放済みアイテムの最大加工段階 → 分母（下がらない）
function updateStage() {
  let st = 0; for (const k of unlockedItems()) st = Math.max(st, ITEMS[k].stage);
  const prevD = S.denomMax || 0, d = happyDenom();
  if (st > (S.maxStage || 0)) { S.maxStage = st; notify(`📈 第${st}段階のアイテムが解放。幸福度の分母が ${d} になりました`); }
  else if (prevD && d > prevD) notify(`📈 新しいアイテムが解放。幸福度の分母が ${d} になりました`);
}

// ---------- 建物 ----------
function makeBuilding(type, x, y) {
  const d = BUILD[type];
  const b = { id: S.nextId++, type, x, y, order: S.order++, workers: 0 };
  if (d.kind === 'gather') { b.inv = { out: 0 }; b.prog = 0; b.fetch = null; b.clv = 1; b.res = d.res || 'wood'; b.dest = defaultDest(); }
  if (d.kind === 'prod') { b.lv = 1; b.recipe = d.recipes.find(r => recipeUsable({ lv: 1 }, r)) || null; b.inv = { a: 0, b: 0, c: 0, out: 0 }; b.prog = 0; b.active = false; b.pending = {}; b.clv = 1; b.fetch = null; b.dest = defaultDest(); }
  if (d.kind === 'warehouse') { b.fetch = null; b.clv = 1; }
  if (d.kind === 'market') { b.fetch = null; b.clv = 1; }
  if (d.kind === 'market') { b.lv = 1; b.items = new Array(CONFIG.MARKET_SLOTS).fill(null); b.stock = {}; b.prog = 0; }
  if (d.kind === 'house') { }
  return b;
}
function addBuilding(type, x, y, free) {
  const b = makeBuilding(type, x, y);
  S.buildings.push(b);
  if (type === 'house' && S.residents) rehouse();
  if (BUILD[type].kind === 'warehouse') { b.lv = 1; while (S.slots.length < CONFIG.LEVELS.warehouse.slots[0]) S.slots.push({ cfg: null, item: null, qty: 0, min: CONFIG.SLOT_MIN }); }
  rebuildOcc();
  if (!free) { const k = 'built_' + type; S.stats[k] = (S.stats[k] || 0) + 1; }
  return b;
}
function rebuildOcc() {
  occ = new Array(N * N).fill(null);
  for (const b of S.buildings) forTiles(b.type, b.x, b.y, (x, y) => { occ[idx(x, y)] = b.id; });
}
function forTiles(type, x, y, fn) { const s = BUILD[type].size; for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) fn(x + dx, y + dy); }
function getB(id) { return S.buildings.find(b => b.id === id); }
function lvOf(b) { return b.lv || 1; }
function lvData(b) { return CONFIG.LEVELS[b.type]; }
function maxWorkers(b) { const L = lvData(b); return L && L.workers ? L.workers[lvOf(b) - 1] : CONFIG.MAX_WORKERS; }
function mkCap(m) { return CONFIG.INV_CAP; }
function nextLevelCost(b) { const L = lvData(b); return L && lvOf(b) < L.cost.length ? L.cost[lvOf(b)] : null; }
function levelUp(b) {
  const c = nextLevelCost(b); if (c === null || S.coins < c) return false;
  S.coins -= c; b.lv = lvOf(b) + 1;
  const L = lvData(b);
  if (b.type === 'warehouse') while (S.slots.length < L.slots[b.lv - 1]) S.slots.push({ cfg: null, item: null, qty: 0, min: CONFIG.SLOT_MIN });
  notify(`⬆ ${BUILD[b.type].name}が Lv${b.lv} になりました`);
  return true;
}
// 建てられる数の上限（null=上限なし）。住居だけエリア開放で増える上限がある。市場・倉庫は最初からの1つだけ
function limitOf(type) { const d = BUILD[type]; return type === 'house' ? houseCap() : d.fixed ? 1 : null; }
// 搬送先の初期値：倉庫があれば倉庫、無ければ市場、どちらも無ければなし
function defaultDest() { return S.buildings.some(b => b.type === 'warehouse') ? 'warehouse' : S.buildings.some(b => b.type === 'market') ? 'market' : 'none'; }
const DEST_NAMES = { none: 'なし', warehouse: '倉庫', market: '市場' };
function setDest(b, dest) { b.dest = dest; if (dest === 'market') S.stats.dest_market = 1; if (dest === 'warehouse') S.stats.dest_warehouse = 1; }
// 表示名：同種が複数あれば建築順の番号を付ける（市場 1 / 市場 2）
function bname(b) {
  const same = S.buildings.filter(x => x.type === b.type).sort((p, q) => p.order - q.order);
  return same.length > 1 ? `${BUILD[b.type].name} ${same.indexOf(b) + 1}` : BUILD[b.type].name;
}
function countType(type) { return S.buildings.filter(b => b.type === type).length; }
function assigned() { return S.buildings.reduce((a, b) => a + (b.workers || 0), 0); }
function freeWorkers() { return S.pop - assigned(); }

function canPlace(type, x, y, ignoreId) {
  let ok = true;
  forTiles(type, x, y, (tx, ty) => {
    if (!inMap(tx, ty) || !S.tiles[idx(tx, ty)].unl) ok = false;
    else { const o = occ[idx(tx, ty)]; if (o && o !== ignoreId) ok = false; }
  });
  return ok;
}
// 建築費用の所持数：倉庫の在庫 ＋ 各施設の完成品棚（材料棚は加工に回した分なので数えない）
function shelfCount(item) { return S.buildings.reduce((a, b) => { const d = BUILD[b.type]; if (!b.inv) return a; const out = d.kind === 'gather' ? gRes(b) : (b.recipe ? RECIPES[b.recipe].out : null); return a + (out === item ? b.inv.out : 0); }, 0); }
function haveCount(item) { return whCount(item) + shelfCount(item); }
function canAfford(cost) {
  if ((cost.coins || 0) > S.coins) return false;
  for (const k in cost) if (k !== 'coins' && haveCount(k) < cost[k]) return false;
  return true;
}
function payCost(cost) {
  S.coins -= cost.coins || 0;
  for (const k in cost) {
    if (k === 'coins') continue;
    let left = cost[k] - whTake(k, cost[k]);
    for (const b of S.buildings) { if (left <= 0) break; const d = BUILD[b.type]; if (!b.inv) continue; const out = d.kind === 'gather' ? gRes(b) : (b.recipe ? RECIPES[b.recipe].out : null); if (out !== k) continue; const n = Math.min(b.inv.out, left); b.inv.out -= n; left -= n; }
  }
}

// レシピ材料の対応（材料A/B）
const MK = ['a', 'b', 'c'];   // 材料欄（最大3種）
function recipeMats(b) { return b.recipe ? Object.keys(RECIPES[b.recipe].need) : []; }

// ---------- 共通倉庫 ----------
function whCount(item) { return S.slots.reduce((a, s) => a + (s.item === item ? s.qty : 0), 0); }
function whTotalItems() { const o = {}; for (const s of S.slots) if (s.item && s.qty) o[s.item] = (o[s.item] || 0) + s.qty; return o; }
// 搬入。受け入れた数を返す
// 搬入先は「そのアイテムを設定したスロット」のみ（若い番号から）。未設定・🚫のスロットには入らない
function whAdd(item, qty) {
  let left = qty;
  for (const s of S.slots) { if (left <= 0) break; if (s.cfg === item && (s.item === item || s.qty === 0)) left -= putSlot(s, item, left); }
  return qty - left;
}
// 解放済み施設から作れるアイテム一覧（幸福度の分母）
function recipeOwned(r) { return !RECIPES[r].buy || S.recipes.includes(r); }
function recipeUsable(b, r) { return recipeOwned(r) && (!RECIPES[r].up || (b.lv || 1) >= 2); }
function unlockedItems(all) {
  const set = new Set();
  if (S.unlocked.includes('collect')) for (const r of GATHERABLE) if (resFound(r)) set.add(r);
  if (S.unlocked.includes('well')) set.add('water');
  for (const t of S.unlocked) { const d = BUILD[t]; if (d.kind === 'prod') d.recipes.forEach(r => { if (recipeOwned(r)) set.add(RECIPES[r].out); }); }
  return Object.keys(ITEMS).filter(k => set.has(k));
}
// 生産施設のアップグレード（Lv1→2）。Lv2 で上位レシピを購入・使用できる
function facUpCost(b) { const d = BUILD[b.type]; return d.upCost && (b.lv || 1) < 2 ? d.upCost : null; }
function facUp(b) { const c = facUpCost(b); if (c === null || S.coins < c) return false; S.coins -= c; b.lv = 2; notify(`⬆ ${bname(b)}を Lv2 にアップグレードしました。新しいレシピが買えます`); return true; }
function buyRecipe(b, r) { const rc = RECIPES[r]; if (!rc.buy || S.recipes.includes(r) || (rc.up && (b.lv || 1) < 2) || S.coins < rc.buy) return false; S.coins -= rc.buy; S.recipes.push(r); notify(`📜 レシピ「${ITEMS[rc.out].name}」を購入しました`); return true; }
// 一度に運べる数：基本値 ＋ 運搬レベルの加算（施設ごと、作業員を入れ替えても変わらない）
function carryOf(b) { const k = BUILD[b.type].kind, base = k === 'warehouse' ? CONFIG.WH_CARRY : k === 'market' ? CONFIG.MK_CARRY : CONFIG.CARRY_BASE; return base + CONFIG.CARRY_BONUS[(b.clv || 1) - 1]; }
function carryCost(b) { return CONFIG.CARRY_COST[(b.clv || 1) - 1] || null; }
function carryUp(b) { const c = carryCost(b); if (!c || !canAfford(c)) return false; payCost(c); b.clv = (b.clv || 1) + 1; S.stats.carry_up = 1; notify(`⬆ ${bname(b)}の運搬レベルが ${b.clv} に（一度に${carryOf(b)}個）`); return true; }
function dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function putSlot(s, item, n) { const room = CONFIG.SLOT_CAP - s.qty; const k = Math.min(room, n); if (k > 0) { s.item = item; s.qty += k; } return k; }
// keepMin=true のとき各スロットの最低保管量を下回らない範囲で取り出す（市場・生産への補充用）。建築費用は keepMin なし
function whTake(item, qty, keepMin) {
  let left = qty;
  for (let i = S.slots.length - 1; i >= 0 && left > 0; i--) {
    const s = S.slots[i]; if (s.item !== item || s.qty === 0) continue;
    const avail = keepMin ? Math.max(0, s.qty - (s.min || 0)) : s.qty;
    const k = Math.min(avail, left); s.qty -= k; left -= k; if (s.qty === 0) s.item = null;
  }
  return qty - left;
}
function whRoom(item) { return S.slots.reduce((a, s) => a + (s.cfg === item && (s.item === item || s.qty === 0) ? CONFIG.SLOT_CAP - s.qty : 0), 0); }
function whAvail(item) { return S.slots.reduce((a, s) => a + (s.item === item ? Math.max(0, s.qty - (s.min || 0)) : 0), 0); }

// ---------- シミュレーション ----------
function sim(dt, acc) {
  S.t += dt;
  // 資源回復
  S.timers.regen += dt;
  while (S.timers.regen >= CONFIG.REGEN_SEC) {
    S.timers.regen -= CONFIG.REGEN_SEC;
    for (let i = 0; i < S.tiles.length; i++) { const r = S.tiles[i].res; if (r && !occ[i] && r.amt < r.max) r.amt++; }
  }
  for (const b of S.buildings) stepBuilding(b, dt, acc);
  S.timers.transfer += dt;
  while (S.timers.transfer >= CONFIG.TRANSFER_SEC) { S.timers.transfer -= CONFIG.TRANSFER_SEC; doTransfer(acc); }
  S.timers.refill += dt;
  while (S.timers.refill >= CONFIG.REFILL_SEC) { S.timers.refill -= CONFIG.REFILL_SEC; if (!CONFIG.FETCH_MODE) { doRefill(); doMarketRefill(); } }
  // 需要：住民ごとに、届いた商品は消費時間をかけて100%→0%に減る
  for (const r of S.residents) for (const k in r.demand) { if (r.demand[k] > 0) r.demand[k] = Math.max(0, r.demand[k] - dt / (ITEMS[k].consume * CONFIG.CONSUME_MULT) * 100); }
  updateStage();
  recalcHappy();
  const cap = countType('house') * CONFIG.HOUSE_CAP;
  S.timers.grow += dt;
  while (S.timers.grow >= CONFIG.POP_GROW_SEC) {
    S.timers.grow -= CONFIG.POP_GROW_SEC;
    if (S.pop < cap && canGrow()) { S.pop++; addResident(); if (acc) acc.pop++; }
  }
  S.stats.pop = S.pop;
}

function stepBuilding(b, dt, acc) {
  const d = BUILD[b.type];
  if (d.kind === 'gather') {
    if (b.workers === 0) { b.prog = 0; return; }
    if (CONFIG.FETCH_MODE && b.fetch) { stepTrip(b, dt); return; }
    const tgt = gatherTarget(b);
    if (b.inv.out >= CONFIG.INV_CAP || !tgt) { if (CONFIG.FETCH_MODE) startDeliver(b); return; }
    b.prog += dt * b.workers / workSec(b);
    if (b.prog >= 1) { b.prog = 0; if (!tgt.infinite) tgt.amt--; b.inv.out++; S.stats['made_' + gRes(b)] = (S.stats['made_' + gRes(b)] || 0) + 1; if (acc) acc.items[gRes(b)] = (acc.items[gRes(b)] || 0) + 1; }
  } else if (d.kind === 'prod') {
    if (b.workers === 0 || !b.recipe) return;
    const r = RECIPES[b.recipe];
    if (!b.active) {
      if (CONFIG.FETCH_MODE && b.fetch) { stepTrip(b, dt); return; }
      if (b.inv.out >= CONFIG.INV_CAP) { if (CONFIG.FETCH_MODE) startDeliver(b); return; }
      const mats = Object.keys(r.need);
      const has = mats.every((m, i) => b.inv[MK[i]] >= r.need[m]);
      if (!has) { if (CONFIG.FETCH_MODE) { if (!startFetch(b)) startDeliver(b); } return; }
      mats.forEach((m, i) => { b.inv[MK[i]] -= r.need[m]; });
      b.active = true; b.prog = 0;
    }
    b.prog += dt * b.workers / workSec(b);
    if (b.prog >= 1) { b.prog = 0; b.active = false; b.inv.out++; S.stats['made_' + r.out] = (S.stats['made_' + r.out] || 0) + 1; S.stats.made_clothset = Math.min(S.stats.made_cloth || 0, S.stats.made_thread || 0); if (acc) acc.items[r.out] = (acc.items[r.out] || 0) + 1; }
  } else if (d.kind === 'warehouse' && CONFIG.FETCH_MODE) {
    if (b.workers === 0) return;
    if (b.fetch) { stepTrip(b, dt); return; }
    // 回収先：搬送先が倉庫で、完成品が最も多い施設（同数なら近い方）。倉庫に入れられる品だけ
    let best = null, bestN = 0, bestD = 1e9;
    for (const o of S.buildings) {
      if (!o.inv || o.inv.out <= 0 || o.dest !== 'warehouse' || o.fetch) continue;
      const item = outItem(o); if (!item || whRoom(item) <= 0) continue;
      const dd = dist(b, o);
      if (o.inv.out > bestN || (o.inv.out === bestN && dd < bestD)) { best = { o, item, d: dd }; bestN = o.inv.out; bestD = dd; }
    }
    if (!best) { startWhDeliver(b); return; }
    const qty = Math.min(carryOf(b), best.o.inv.out, whRoom(best.item));
    best.o.inv.out -= qty;
    b.fetch = { mode: 'in', item: best.item, qty, from: best.o.id, time: best.d * 2 * CONFIG.TILE_SEC, prog: 0 };
  } else if (d.kind === 'market') {
    if (b.workers === 0 || S.pop === 0) { b.prog = 0; return; }
    if (CONFIG.FETCH_MODE && b.fetch) { stepTrip(b, dt); return; }
    if (!marketTarget(b)) { if (CONFIG.FETCH_MODE) startMarketFetch(b); return; }
    b.prog += dt * b.workers / CONFIG.BASE_SEC;
    if (b.prog >= 1) {
      b.prog = 0;
      const tg = marketTarget(b); if (!tg) return;
      b.stock[tg.item]--;
      const p = ITEMS[tg.item].price; S.coins += p; S.stats.earned += p; if (acc) acc.coins += p;
      tg.res.demand[tg.item] = 100;
    }
  }
}

// ---- 材料を取りに行く（FETCH_MODE）----
// 足りない材料を、在庫のある最も近い場所（倉庫 or その材料をつくる施設）へ1回に carry 個まで取りに行く。往復 = 距離×2 ×1秒
function fetchSource(b, m) {
  let best = null, bestD = 1e9;
  for (const o of S.buildings) {
    if (o === b) continue;
    const od = BUILD[o.type]; let avail = 0;
    if (od.kind === 'warehouse') avail = whAvail(m);
    else if (od.kind === 'gather' && gRes(o) === m) avail = o.inv.out;
    else if (od.kind === 'prod' && o.recipe && RECIPES[o.recipe].out === m) avail = o.inv.out;
    if (avail <= 0) continue;
    const dd = dist(b, o); if (dd < bestD) { bestD = dd; best = { o, avail, d: dd }; }
  }
  return best;
}
// 往復中の処理（fetch＝材料を取りに行く / deliver＝完成品を運ぶ）。到着で中身を移す
function stepTrip(b, dt) {
  const f = b.fetch; f.prog += dt * b.workers;
  if (f.prog < f.time) return;
  if (f.mode === 'in') {
    if (BUILD[b.type].kind === 'market') b.stock[f.item] = (b.stock[f.item] || 0) + f.qty;
    else if (f.key) b.inv[f.key] = Math.min(CONFIG.INV_CAP, b.inv[f.key] + f.qty);
    else { const left = f.qty - whAdd(f.item, f.qty); if (left) { const o = getB(f.from); if (o && o.inv) o.inv.out += left; } }
  } else {
    const o = getB(f.from);
    if (!o) { b.inv.out += f.qty; }
    else if (o.type === 'warehouse') { const left = f.qty - whAdd(f.item, f.qty); if (left) b.inv.out += left; }
    else if (o.type === 'market') { o.stock[f.item] = (o.stock[f.item] || 0) + f.qty; }
    else if (o.inv && f.key) { o.inv[f.key] = Math.min(CONFIG.INV_CAP, o.inv[f.key] + f.qty); }
  }
  b.fetch = null;
}
// 生産施設：足りない材料を取りに行く。開始できたら true
function startFetch(b) {
  const r = RECIPES[b.recipe], mats = Object.keys(r.need);
  for (let i = 0; i < mats.length; i++) {
    const m = mats[i], key = MK[i];
    if (b.inv[key] >= r.need[m]) continue;
    const src = fetchSource(b, m); if (!src) continue;
    const qty = Math.min(carryOf(b), src.avail, CONFIG.INV_CAP - b.inv[key]); if (qty <= 0) continue;
    const od = BUILD[src.o.type];
    if (od.kind === 'warehouse') whTake(m, qty, true); else src.o.inv.out -= qty;
    b.fetch = { mode: 'in', item: m, key, qty, from: src.o.id, time: src.d * 2 * CONFIG.TILE_SEC, prog: 0 };
    return true;
  }
  return false;
}
// 施設の完成品を搬送先（倉庫 or 市場）へ運ぶ。開始できたら true
function outItem(b) { const d = BUILD[b.type]; return d.kind === 'gather' ? gRes(b) : (b.recipe ? RECIPES[b.recipe].out : null); }
function startDeliver(b) {
  if (!b.inv || b.inv.out <= 0 || !b.dest || b.dest === 'none') return false;
  const item = outItem(b); if (!item) return false;
  let best = null, bestD = 1e9;
  for (const o of S.buildings) {
    if (o.type !== b.dest) continue;
    let room = 0;
    if (o.type === 'warehouse') room = whRoom(item);
    else if (o.type === 'market') room = o.items.includes(item) ? mkCap(o) - (o.stock[item] || 0) : 0;
    if (room <= 0) continue;
    const dd = dist(b, o); if (dd < bestD) { bestD = dd; best = { o, room, d: dd }; }
  }
  if (!best) return false;
  const qty = Math.min(carryOf(b), b.inv.out, best.room);
  b.inv.out -= qty;
  b.fetch = { mode: 'out', item, qty, from: best.o.id, time: best.d * 2 * CONFIG.TILE_SEC, prog: 0 };
  return true;
}
// 市場：販売商品で在庫が少ないものを、倉庫 or 施設の棚へ仕入れに行く
function startMarketFetch(b) {
  const wants = b.items.filter(i => i && (b.stock[i] || 0) < mkCap(b) && houseWanting(i) > 0).sort((p, q) => (b.stock[p] || 0) - (b.stock[q] || 0));
  for (const m of wants) {
    const src = fetchSource(b, m); if (!src) continue;
    const qty = Math.min(carryOf(b), src.avail, mkCap(b) - (b.stock[m] || 0)); if (qty <= 0) continue;
    if (BUILD[src.o.type].kind === 'warehouse') whTake(m, qty, true); else src.o.inv.out -= qty;
    b.fetch = { mode: 'in', item: m, qty, from: src.o.id, time: src.d * 2 * CONFIG.TILE_SEC, prog: 0 };
    return true;
  }
  return false;
}
// 倉庫：回収するものが無ければ、市場や生産施設へ届ける
function startWhDeliver(b) {
  let best = null, bestD = 1e9;
  for (const o of S.buildings) {
    if (o.type === 'market') {
      for (const it of o.items) { if (!it || whAvail(it) <= 0 || (o.stock[it] || 0) >= mkCap(o) || houseWanting(it) === 0) continue; const dd = dist(b, o); if (dd < bestD) { bestD = dd; best = { o, item: it, room: mkCap(o) - (o.stock[it] || 0), d: dd }; } }
    } else if (BUILD[o.type].kind === 'prod' && o.recipe) {
      const r = RECIPES[o.recipe]; Object.keys(r.need).forEach((m, i) => { const key = MK[i]; if (o.inv[key] >= CONFIG.INV_CAP / 2 || whAvail(m) <= 0) return; const dd = dist(b, o); if (dd < bestD) { bestD = dd; best = { o, item: m, key, room: CONFIG.INV_CAP - o.inv[key], d: dd }; } });
    }
  }
  if (!best) return false;
  const qty = Math.min(carryOf(b), whAvail(best.item), best.room); if (qty <= 0) return false;
  whTake(best.item, qty, true);
  b.fetch = { mode: 'out', item: best.item, key: best.key, qty, from: best.o.id, time: best.d * 2 * CONFIG.TILE_SEC, prog: 0 };
  return true;
}
// 配達対象：（住民, 商品）のうち在庫があり需要ゲージが閾値未満で、残りが最も少ない組。同率はランダム
function marketTarget(b) {
  const cands = [];
  for (const r of S.residents) { if (!r.house || !getB(r.house)) continue; for (const i of b.items) { if (!i || (b.stock[i] || 0) <= 0) continue; const g = r.demand[i] || 0; if (g < CONFIG.DELIVER_BELOW) cands.push({ res: r, house: getB(r.house), item: i, g: Math.round(g) }); } }
  if (!cands.length) return null;
  const min = Math.min(...cands.map(c => c.g));
  const low = cands.filter(c => c.g === min);
  return low[Math.floor(Math.random() * low.length)];
}
function houseWanting(item) { return S.residents.filter(r => r.house && (r.demand[item] || 0) < CONFIG.DELIVER_BELOW).length; }
// 採集対象：範囲5×5内で最も近い資源。同距離は上→右→下→左
function gatherTarget(b) {
  const res = gRes(b), R = CONFIG.GATHER_RANGE;
  if (noRes(b)) return { amt: Infinity, infinite: true };
  let best = null, bestD = 1e9, bestP = 9;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const x = b.x + dx, y = b.y + dy; if (!inMap(x, y)) continue;
    const i = idx(x, y), t = S.tiles[i];
    if (!t.unl || !t.res || t.res.t !== res || t.res.amt <= 0 || occ[i]) continue;
    const dist = Math.abs(dx) + Math.abs(dy);
    const pri = (dy < 0 && dx === 0) ? 0 : (dx > 0 && dy === 0) ? 1 : (dy > 0 && dx === 0) ? 2 : (dx < 0 && dy === 0) ? 3 : 4 + (dy < 0 ? 0 : 2) + (dx > 0 ? 0 : 1);
    if (dist < bestD || (dist === bestD && pri < bestP)) { best = t.res; bestD = dist; bestP = pri; }
  }
  return best;
}

function doTransfer(acc) {
  for (const b of S.buildings) {
    if (!b.inv) continue;
    if (!CONFIG.FETCH_MODE && b.inv.out > 0 && (BUILD[b.type].kind === 'gather' || b.recipe)) {
      const item = BUILD[b.type].kind === 'gather' ? gRes(b) : RECIPES[b.recipe].out;
      const n = whAdd(item, b.inv.out);
      b.inv.out -= n;

    }
    if (b.pending) for (const k in b.pending) { if (b.pending[k] > 0) { b.pending[k] -= whAdd(k, b.pending[k]); } if (b.pending[k] <= 0) delete b.pending[k]; }
  }
}

// 材料配分：種類ごとに、充填率が低い施設から1個ずつ
function doRefill() {
  const byMat = {};
  for (const b of S.buildings) {
    if (BUILD[b.type].kind !== 'prod') continue;
    recipeMats(b).forEach((m, i) => { (byMat[m] = byMat[m] || []).push({ b, key: MK[i] }); });
  }
  for (const m in byMat) {
    const list = byMat[m];
    let guard = 10000;
    while (guard-- > 0) {
      const cands = list.filter(e => e.b.inv[e.key] < CONFIG.INV_CAP);
      if (!cands.length || whAvail(m) === 0) break;
      cands.sort((p, q) => (p.b.inv[p.key] - q.b.inv[q.key]) || (p.b.order - q.b.order));
      if (whTake(m, 1, true) === 0) break;
      cands[0].b.inv[cands[0].key]++;
    }
  }
}
function doMarketRefill() {
  for (const b of S.buildings) {
    if (BUILD[b.type].kind !== 'market') continue;
    for (const it of b.items) { if (!it) continue; const cur = b.stock[it] || 0; const need = CONFIG.INV_CAP - cur; if (need > 0) b.stock[it] = cur + whTake(it, need, true); }
  }
}

// ---------- 作業員 ----------
function setWorkers(b, n) {
  n = Math.max(0, Math.min(maxWorkers(b), n));
  if (n > b.workers && freeWorkers() < n - b.workers) return;
  const was = b.workers; b.workers = n;
  if (n === 0 && was > 0) { b.prog = 0; if (b.active !== undefined) b.active = false; } // 材料は返却しない
}

// ---------- 建築・移動・取り壊し ----------
function build(type, x, y) {
  const d = BUILD[type];
  if (!S.unlocked.includes(type) || (limitOf(type) !== null && countType(type) >= limitOf(type))) return false;
  if (type === 'house' && countType('house') >= houseCap()) return false;
  if (!canPlace(type, x, y) || !canAfford(d.cost)) return false;
  payCost(d.cost);
  addBuilding(type, x, y, false);
  return true;
}
// 採集所の「採るもの」を変える。棚に残っていた品は倉庫へ（入りきらない分は破棄）
function setRes(b, r) {
  if (b.type !== 'collect' || gRes(b) === r || !resFound(r)) return;
  if (b.inv.out) whAdd(gRes(b), b.inv.out);
  b.inv.out = 0; b.prog = 0; b.res = r;
  if (b.fetch && b.fetch.mode === 'out') { whAdd(b.fetch.item, b.fetch.qty); b.fetch = null; }
}
function moveBuilding(b, x, y) { if (!canPlace(b.type, x, y, b.id)) return false; b.x = x; b.y = y; rebuildOcc(); return true; }
function demolish(b) {
  const d = BUILD[b.type];
  if (b.fetch) { whAdd(b.fetch.item, b.fetch.qty); b.fetch = null; }
  if (d.kind === 'warehouse') {
    // 倉庫は1棟だけなので、取り壊すとスロットと中身はなくなる（確認画面で警告）
    S.slots = [];
    S.buildings = S.buildings.filter(x => x !== b); rebuildOcc();
  } else {
    if (b.inv) {
      if (d.kind === 'gather') whAdd(gRes(b), b.inv.out);
      else { if (b.recipe) { whAdd(RECIPES[b.recipe].out, b.inv.out); recipeMats(b).forEach((m, i) => whAdd(m, b.inv[MK[i]])); } for (const k in b.pending) whAdd(k, b.pending[k]); }
    }
    if (b.stock) for (const k in b.stock) whAdd(k, b.stock[k]);
    S.buildings = S.buildings.filter(x => x !== b); rebuildOcc();
    if (d.kind === 'house') rehouse();
  }
  S.coins += d.cost.coins || 0; // コインは返金、材料は返却しない
}
function changeRecipe(b, rid) {
  if (b.recipe === rid) return;
  if (!recipeUsable(b, rid)) return;
  if (b.fetch) { const left = b.fetch.qty - whAdd(b.fetch.item, b.fetch.qty); if (left) b.pending[b.fetch.item] = (b.pending[b.fetch.item] || 0) + left; b.fetch = null; }
  const old = b.recipe ? recipeMats(b) : [];
  old.forEach((m, i) => { const k = MK[i]; const q = b.inv[k]; b.inv[k] = 0; if (q) { const left = q - whAdd(m, q); if (left) b.pending[m] = (b.pending[m] || 0) + left; } });
  b.recipe = rid; b.active = false; b.prog = 0;
}

// ---------- エリア開放（5×5単位） ----------
function landPrice() { return CONFIG.LAND_BASE + CONFIG.LAND_STEP * (blocksOpen() - 1); }
function canUnlockBlock(bx, by) {
  if (bx < 0 || by < 0 || bx >= NB || by >= NB || S.blocks[bidx(bx, by)]) return false;
  if (S.areaStage === 0) return false;                                   // 目標達成まで開放不可
  if (S.areaStage === 1) return bx === CONFIG.FIRST_AREA[0] && by === CONFIG.FIRST_AREA[1]; // 最初は決められたエリアのみ
  return [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => bx + dx >= 0 && by + dy >= 0 && bx + dx < NB && by + dy < NB && S.blocks[bidx(bx + dx, by + dy)]);
}
function canUnlock(x, y) { const [bx, by] = blockOf(x, y); return canUnlockBlock(bx, by); }

// ---------- セーブ ----------
function save() { S.lastSave = Date.now(); try { localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
function offlineProgress() {
  const elapsed = Math.min(CONFIG.OFFLINE_MAX_SEC, Math.floor((Date.now() - S.lastSave) / 1000));
  if (elapsed < 60) return null;
  const acc = { coins: 0, pop: 0, items: {} };
  for (let i = 0; i < elapsed; i++) sim(1, acc);
  acc.elapsed = elapsed;
  return acc;
}
function showWelcomeBack(acc) {
  const hrs = Math.floor(acc.elapsed / 3600), mins = Math.floor(acc.elapsed % 3600 / 60);
  const items = Object.keys(acc.items).map(k => `${ITEMS[k].name} +${acc.items[k]}`).join('、') || 'なし';
  modal('おかえりなさい', `<div>留守の間：約 ${hrs ? hrs + '時間' : ''}${mins}分${acc.elapsed >= CONFIG.OFFLINE_MAX_SEC ? '（上限12時間分）' : ''}</div><div>🪙 販売収入 +${acc.coins}</div><div>👤 住民 +${acc.pop}</div><div>📦 つくった品：${items}</div><div class="hint" style="text-align:left">倉庫に入りきらない完成品は施設内に残っています。</div>`);
}
function load() {
  try { const j = localStorage.getItem(CONFIG.SAVE_KEY); if (!j) return false; S = JSON.parse(j); S.newTypes = S.newTypes || []; S.notified = S.notified || {}; for (const sl of S.slots) if (sl.min === undefined) sl.min = CONFIG.SLOT_MIN; if (S.areaStage === undefined) S.areaStage = 2; S.recipes = S.recipes || []; for (const b of S.buildings) { if (b.inv && b.inv.c === undefined && BUILD[b.type].kind === 'prod') b.inv.c = 0; if (b.bags === undefined) b.bags = 0; if (b.inv && b.dest === undefined) b.dest = 'warehouse'; if (b.fetch === undefined) b.fetch = null; } if (!S.residents) { S.residents = []; S.maxStage = 0; for (let i = 0; i < S.pop; i++) addResident(); } rebuildOcc(); return true; } catch (e) { return false; }
}

// ============================================================
//  描画
// ============================================================
const cv = document.getElementById('map'), ctx = cv.getContext('2d');
const cam = { x: 0, y: 0, s: 1.6 };
let W = 0, H = 0, DPR = 1;
const spriteCache = {};
function sprite(name) {
  if (spriteCache[name]) return spriteCache[name];
  const rows = name === 'villager' ? VILL : name === 'worker' ? WORK : SPR[name], n = rows.length;
  const c = document.createElement('canvas'); c.width = n; c.height = n; const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = PAL[ch]; g.fillRect(x, y, 1, 1); } }));
  return spriteCache[name] = c;
}
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
const T = CONFIG.TILE;
const toScreen = (wx, wy) => [(wx - cam.x) * cam.s + W / 2, (wy - cam.y) * cam.s + H / 2];
const toWorld = (sx, sy) => [(sx - W / 2) / cam.s + cam.x, (sy - H / 2) / cam.s + cam.y];

// UI状態
const UI = { mode: 'normal', placeType: null, px: 0, py: 0, moveB: null, sel: null, land: null, pressTimer: null };

function draw() {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#2a7fb8'; ctx.fillRect(0, 0, W, H); // 海
  const ts = T * cam.s;
  const [ox, oy] = toScreen(0, 0);
  // 砂浜
  ctx.fillStyle = '#e8d9a0'; ctx.fillRect(ox - ts * 0.4, oy - ts * 0.4, ts * N + ts * 0.8, ts * N + ts * 0.8);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const sx = ox + x * ts, sy = oy + y * ts; if (sx + ts < 0 || sy + ts < 0 || sx > W || sy > H) continue;
    const t = S.tiles[idx(x, y)];
    ctx.fillStyle = ((x + y) & 1) ? '#6db85a' : '#64ad52'; ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
    if (t.unl && t.res && !occ[idx(x, y)]) {
      const nm = { wood: 'tree', stone: 'rock', cotton: 'cotton', wheat: 'wheat', orange: 'orangetree' }[t.res.t];
      if (t.res.amt > 0) ctx.drawImage(sprite(nm), sx, sy, ts, ts);
      else { ctx.globalAlpha = 0.3; ctx.drawImage(sprite(nm), sx + ts * 0.15, sy + ts * 0.15, ts * 0.7, ts * 0.7); ctx.globalAlpha = 1; }
    }
  }
  // 採集範囲
  if (UI.sel && BUILD[UI.sel.type].kind === 'gather' && UI.mode === 'normal') {
    const R = CONFIG.GATHER_RANGE, [rx, ry] = toScreen((UI.sel.x - R) * T, (UI.sel.y - R) * T), rs = ts * (R * 2 + 1);
    if (!noRes(UI.sel)) { ctx.fillStyle = 'rgba(255,255,120,.25)'; ctx.fillRect(rx, ry, rs, rs);
    ctx.strokeStyle = 'rgba(255,230,80,.9)'; ctx.lineWidth = 2; ctx.strokeRect(rx, ry, rs, rs); }
  }
  // 建物
  for (const b of S.buildings) {
    if (UI.mode === 'move' && UI.moveB === b) continue;
    drawBuilding(b.type, b.x, b.y, ox, oy, ts, UI.sel === b ? 'sel' : null, b);
  }
  // マス目
  ctx.strokeStyle = 'rgba(0,0,0,.10)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i <= N; i++) { ctx.moveTo(ox + i * ts, oy); ctx.lineTo(ox + i * ts, oy + N * ts); ctx.moveTo(ox, oy + i * ts); ctx.lineTo(ox + N * ts, oy + i * ts); }
  ctx.stroke();
  // 霧（未開放エリア）：開放できるエリアは明るく＋中央に「＋」、それ以外は暗い霧
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const t = S.tiles[idx(x, y)]; if (t.unl) continue;
    const sx = ox + x * ts, sy = oy + y * ts; if (sx + ts < 0 || sy + ts < 0 || sx > W || sy > H) continue;
    const edge = canUnlock(x, y);
    ctx.fillStyle = edge ? 'rgba(235,245,255,.5)' : (((x + y) & 1) ? 'rgba(90,110,130,.82)' : 'rgba(80,100,120,.82)');
    ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
  }
  const BS = CONFIG.BLOCK * ts;
  for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
    if (S.blocks[bidx(bx, by)]) continue;
    const sx = ox + bx * BS, sy = oy + by * BS;
    if (canUnlockBlock(bx, by)) {
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeRect(sx + 3, sy + 3, BS - 6, BS - 6); ctx.setLineDash([]);
      const r = ts * 0.5; ctx.fillStyle = '#f0b63c'; ctx.beginPath(); ctx.arc(sx + BS / 2, sy + BS / 2, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a2e00'; ctx.font = `bold ${Math.max(12, ts * 0.8)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', sx + BS / 2, sy + BS / 2 + 1);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.font = `bold ${Math.max(10, ts * 0.4)}px sans-serif`; ctx.fillText(`🪙${landPrice()}`, sx + BS / 2, sy + BS / 2 + r + ts * 0.35);
    }
    if (UI.land && UI.land[0] === bx && UI.land[1] === by) { ctx.strokeStyle = '#ff6a00'; ctx.lineWidth = 4; ctx.strokeRect(sx + 2, sy + 2, BS - 4, BS - 4); }
  }
  // 島の外周
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, N * ts, N * ts);
  // プレビュー
  if (UI.mode === 'place' || UI.mode === 'move') {
    const type = UI.mode === 'place' ? UI.placeType : UI.moveB.type;
    const ok = canPlace(type, UI.px, UI.py, UI.mode === 'move' ? UI.moveB.id : null) && (UI.mode === 'move' || canAfford(BUILD[type].cost));
    ctx.globalAlpha = 0.75; drawBuilding(type, UI.px, UI.py, ox, oy, ts, ok ? 'ok' : 'ng'); ctx.globalAlpha = 1;
  }
  // 住民（簡易：人口分の点が歩き回る）
  drawVillagers(ox, oy, ts);
}
function drawBuilding(type, x, y, ox, oy, ts, mark, b) {
  const s = BUILD[type].size, sx = ox + x * ts, sy = oy + y * ts;
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(sx + ts * s / 2, sy + ts * s * 0.9, ts * s * 0.45, ts * s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(sprite(type), sx, sy, ts * s, ts * s);
  if (b && type === 'collect') {  // 採るものの小さな印
    const r = gRes(b), bs = ts * 0.42, bx = sx + ts - bs - ts * 0.02, by = sy + ts - bs - ts * 0.02;
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(bx + bs / 2, by + bs / 2, bs / 2 + 1, 0, Math.PI * 2); ctx.fill();
    const icon = { wood: 'tree', stone: 'rock', wheat: 'wheat', cotton: 'cotton', orange: 'orangetree' }[r];
    if (icon) ctx.drawImage(sprite(icon), bx + 1, by + 1, bs - 2, bs - 2);
    else { ctx.fillStyle = ITEMS.water.color; ctx.beginPath(); ctx.arc(bx + bs / 2, by + bs * 0.58, bs * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(bx + bs / 2, by + bs * 0.12); ctx.lineTo(bx + bs * 0.27, by + bs * 0.5); ctx.lineTo(bx + bs * 0.73, by + bs * 0.5); ctx.fill(); }
  }
  if (mark === 'sel') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(sx + 1, sy + 1, ts * s - 2, ts * s - 2); }
  if (mark === 'ok') { ctx.strokeStyle = '#3ad24a'; ctx.lineWidth = 3; ctx.strokeRect(sx + 1, sy + 1, ts * s - 2, ts * s - 2); }
  if (mark === 'ng') { ctx.fillStyle = 'rgba(255,0,0,.45)'; ctx.fillRect(sx, sy, ts * s, ts * s); }
}
const villagers = [];
// 採集対象マスの座標版
function gatherTargetPos(b) {
  const res = gRes(b), R = CONFIG.GATHER_RANGE; let best = null, bestD = 1e9, bestP = 9;
  if (noRes(b)) return null;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const x = b.x + dx, y = b.y + dy; if (!inMap(x, y)) continue;
    const i = idx(x, y), t = S.tiles[i];
    if (!t.unl || !t.res || t.res.t !== res || t.res.amt <= 0 || occ[i]) continue;
    const dist = Math.abs(dx) + Math.abs(dy);
    const pri = (dy < 0 && dx === 0) ? 0 : (dx > 0 && dy === 0) ? 1 : (dy > 0 && dx === 0) ? 2 : (dx < 0 && dy === 0) ? 3 : 4 + (dy < 0 ? 0 : 2) + (dx > 0 ? 0 : 1);
    if (dist < bestD || (dist === bestD && pri < bestP)) { best = [x, y]; bestD = dist; bestP = pri; }
  }
  return best;
}
function drawVillagers(ox, oy, ts) {
  const c = Math.floor(N / 2);
  while (villagers.length < S.pop) villagers.push({ x: c + 0.5, y: c + 0.5, tx: c + 0.5, ty: c + 0.5, wait: 0, job: null, phase: 0 });
  villagers.length = Math.min(villagers.length, S.pop);
  // 作業員を施設に割り当て（建築順で前から）
  let vi = 0;
  const jobs = [];
  for (const b of S.buildings.slice().sort((a, b) => a.order - b.order)) for (let k = 0; k < (b.workers || 0); k++) jobs.push(b);
  for (const v of villagers) { const j = jobs[vi++] || null; if (v.job !== j) { v.job = j; v.phase = 0; v.wait = 0; if (j) { v.tx = j.x + 0.5; v.ty = j.y + 0.5; } } }
  for (const v of villagers) {
    const dx = v.tx - v.x, dy = v.ty - v.y, d = Math.hypot(dx, dy);
    if (v.wait > 0) v.wait -= 1 / 60;
    else if (d > 0.04) { const sp = 0.025; v.x += dx / d * Math.min(sp, d); v.y += dy / d * Math.min(sp, d); }
    else if (v.job) {
      const b = v.job, k = BUILD[b.type].kind;
      if (b.fetch && (k === 'gather' || k === 'prod' || k === 'market')) {
        // 運搬中：相手先と施設を往復
        if (v.phase === 0) { const o = getB(b.fetch.from); if (o) { v.tx = o.x + 0.5; v.ty = o.y + 0.9; v.phase = 1; } v.wait = 1; }
        else { v.tx = b.x + 0.5; v.ty = b.y + 0.9; v.phase = 0; v.wait = 1.5; }
      } else if (k === 'gather') {
        // 施設 ⇄ 採集先 を往復。採集先がなければ施設前で待つ
        if (v.phase === 0) { const t = gatherTargetPos(b); if (t) { v.tx = t[0] + 0.5; v.ty = t[1] + 0.5; v.phase = 1; } v.wait = 1; }
        else { v.tx = b.x + 0.5; v.ty = b.y + 0.9; v.phase = 0; v.wait = 1.5; }
      } else if (k === 'market') {
        // 市場 ⇄ 住居 を往復
        if (v.phase === 0) { const hs = S.buildings.filter(h => h.type === 'house'); const h = hs[Math.floor(Math.random() * hs.length)]; if (h) { v.tx = h.x + 0.5; v.ty = h.y + 0.9; v.phase = 1; } v.wait = 1; }
        else { v.tx = b.x + 0.5; v.ty = b.y + 0.9; v.phase = 0; v.wait = 1.5; }
      } else if (k === 'warehouse') {
        if (b.fetch && v.phase === 0) { const o = getB(b.fetch.from); if (o) { v.tx = o.x + 0.5; v.ty = o.y + 0.9; v.phase = 1; } v.wait = 1; }
        else { v.tx = b.x + 0.5; v.ty = b.y + 0.9; v.phase = 0; v.wait = 1.5; }
      } else { v.tx = b.x + 0.5; v.ty = b.y + 0.9; v.wait = 3; } // 生産施設：前に立つ
    } else {
      // 未割り当て：何もないマスだけを散歩
      v.wait = 1 + Math.random() * 3;
      let tries = 12;
      while (tries--) { const nx = Math.floor(v.x) + Math.floor(Math.random() * 7) - 3, ny = Math.floor(v.y) + Math.floor(Math.random() * 7) - 3; if (inMap(nx, ny) && S.tiles[idx(nx, ny)].unl && !occ[idx(nx, ny)] && !S.tiles[idx(nx, ny)].res) { v.tx = nx + 0.5; v.ty = ny + 0.5; break; } }
    }
    const sx = ox + v.x * ts, sy = oy + v.y * ts, vs = ts * 0.5;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(sx, sy + vs * 0.4, vs * 0.25, vs * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(sprite(v.job ? 'worker' : 'villager'), sx - vs * 0.25, sy - vs * 0.45, vs, vs);
  }
}
// ============================================================
//  入力（パン・ズーム・タップ）
// ============================================================
const ptrs = new Map(); let pinch0 = null, tapInfo = null;
function onDown(id, x, y) {
  ptrs.set(id, { x, y });
  if (ptrs.size === 1) tapInfo = { x, y, moved: false, t: Date.now() };
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), s: cam.s }; tapInfo = null; }
}
function onMove(id, x, y) {
  if (!ptrs.has(id)) return;
  const p = ptrs.get(id);
  if (ptrs.size === 1) {
    const dx = x - p.x, dy = y - p.y;
    if (tapInfo && Math.hypot(x - tapInfo.x, y - tapInfo.y) > 8) tapInfo.moved = true;
    if (!tapInfo || tapInfo.moved) { cam.x -= dx / cam.s; cam.y -= dy / cam.s; }
  } else if (ptrs.size === 2 && pinch0) {
    p.x = x; p.y = y;
    const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
    cam.s = Math.max(0.6, Math.min(5, pinch0.s * d / pinch0.d));
  }
  p.x = x; p.y = y;
  clampCam();
}
function onUp(id, x, y) {
  if (!ptrs.has(id)) return;
  ptrs.delete(id);
  if (ptrs.size < 2) pinch0 = null;
  if (ptrs.size === 0 && tapInfo && !tapInfo.moved) onTap(x, y);
  if (ptrs.size === 0) tapInfo = null;
}
// Pointer Events が使えれば使い、無ければ（iOS12以前のSafariなど）Touch/Mouse にフォールバック
if (window.PointerEvent) {
  cv.addEventListener('pointerdown', e => { try { cv.setPointerCapture(e.pointerId); } catch (x) { } onDown(e.pointerId, e.clientX, e.clientY); });
  cv.addEventListener('pointermove', e => onMove(e.pointerId, e.clientX, e.clientY));
  cv.addEventListener('pointerup', e => onUp(e.pointerId, e.clientX, e.clientY));
  cv.addEventListener('pointercancel', e => onUp(e.pointerId, e.clientX, e.clientY));
} else {
  const each = (e, fn) => { for (const t of e.changedTouches) fn(t.identifier, t.clientX, t.clientY); };
  cv.addEventListener('touchstart', e => { e.preventDefault(); each(e, onDown); }, { passive: false });
  cv.addEventListener('touchmove', e => { e.preventDefault(); each(e, onMove); }, { passive: false });
  cv.addEventListener('touchend', e => { e.preventDefault(); each(e, onUp); }, { passive: false });
  cv.addEventListener('touchcancel', e => each(e, onUp));
  let mdown = false;
  cv.addEventListener('mousedown', e => { mdown = true; onDown(1, e.clientX, e.clientY); });
  window.addEventListener('mousemove', e => { if (mdown) onMove(1, e.clientX, e.clientY); });
  window.addEventListener('mouseup', e => { if (mdown) { mdown = false; onUp(1, e.clientX, e.clientY); } });
}
cv.addEventListener('wheel', e => { cam.s = Math.max(0.6, Math.min(5, cam.s * (e.deltaY < 0 ? 1.1 : 0.9))); clampCam(); }, { passive: true });
function clampCam() { const m = T * N; cam.x = Math.max(0, Math.min(m, cam.x)); cam.y = Math.max(0, Math.min(m, cam.y)); }

function onTap(sx, sy) {
  const [wx, wy] = toWorld(sx, sy); const x = Math.floor(wx / T), y = Math.floor(wy / T);
  if (UI.mode === 'place' || UI.mode === 'move') {
    const type = UI.mode === 'place' ? UI.placeType : UI.moveB.type;
    const s = BUILD[type].size;
    UI.px = Math.max(0, Math.min(N - s, x)); UI.py = Math.max(0, Math.min(N - s, y));
    UI.mode === 'place' ? showPlacePanel() : showMovePanel();
    return;
  }
  if (!inMap(x, y)) { closeAll(); return; }
  const t = S.tiles[idx(x, y)];
  if (!t.unl) { const [bx, by] = blockOf(x, y); if (canUnlockBlock(bx, by)) { UI.land = [bx, by]; closeAll(false); openLand(); } else closeAll(); return; }
  const id = occ[idx(x, y)];
  if (id) { UI.sel = getB(id); closeAll(false); openInfo(); }
  else { closeAll(); if (t.res) toast(`${ITEMS[t.res.t].name} ${t.res.amt}/${t.res.max}`); }
}

// ============================================================
//  UI パネル
// ============================================================
const $ = id => document.getElementById(id);
const panels = ['buildmenu', 'placepanel', 'infopanel', 'landpanel', 'storepanel', 'goalpanel', 'peoplepanel'];
function closeAll(resetSel = true) { if (shownNew.length) { S.newTypes = S.newTypes.filter(t => !shownNew.includes(t)); shownNew = []; } panels.forEach(p => $(p).classList.add('hidden')); if (resetSel) { UI.sel = null; UI.land = null; } }
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { $(b.dataset.close).classList.add('hidden'); if (b.dataset.close === 'infopanel') UI.sel = null; if (b.dataset.close === 'landpanel') UI.land = null; }));
function toast(msg, ms = 2200) {
  const box = $('toast'); const el = document.createElement('div'); el.className = 'toast-item'; el.textContent = msg; box.appendChild(el);
  while (box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms);
}
function notify(msg) { toast(msg, 3500); }
function modal(title, html, onOk, cancel) {
  $('modal-title').textContent = title; $('modal-body').innerHTML = html; $('modal').classList.remove('hidden');
  $('modal-cancel').classList.toggle('hidden', !cancel);
  $('modal-ok').textContent = cancel ? '実行する' : 'OK';
  $('modal-ok').onclick = () => { $('modal').classList.add('hidden'); onOk && onOk(); };
  $('modal-cancel').onclick = () => $('modal').classList.add('hidden');
}
function costHtml(cost, check) {
  let h = '';
  for (const k in cost) {
    const nm = k === 'coins' ? '🪙 コイン' : ITEMS[k].name, have = k === 'coins' ? S.coins : haveCount(k);
    const ng = check && have < cost[k];
    h += `<div class="line"><span class="lbl">${nm}</span><span class="val ${ng ? 'red' : ''}">${cost[k]}${check ? ` <small>(所持 ${have})</small>` : ''}</span></div>`;
  }
  return h;
}
function iconCanvas(type) { const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.getContext('2d').drawImage(sprite(type), 0, 0); return c; }

// --- 建築メニュー ---
$('btn-build').addEventListener('click', () => { if (UI.mode !== 'normal') return; closeAll(); openBuildMenu(); });
let shownNew = [];
function openBuildMenu() {
  // 前回表示したNEWは既読にする
  if (shownNew.length) { S.newTypes = S.newTypes.filter(t => !shownNew.includes(t)); shownNew = []; }
  const tabs = $('build-tabs'); tabs.innerHTML = '';
  for (const c of CATS) { const b = document.createElement('button'); b.className = 'tab' + (S.lastTab === c.id ? ' active' : ''); b.textContent = c.name; if (S.newTypes.some(t => BUILD[t].cat === c.id)) b.innerHTML += '<span class="new">N</span>'; b.onclick = () => { S.lastTab = c.id; openBuildMenu(); }; tabs.appendChild(b); }
  const list = $('build-list'); list.innerHTML = '';
  for (const type in BUILD) {
    const d = BUILD[type]; if (d.cat !== S.lastTab || d.fixed) continue;
    const locked = !S.unlocked.includes(type);
    if (locked) {
      const why = bpBlocker(type);
      const el = document.createElement('div'); el.className = 'bitem locked' + (why ? ' disabled' : '');
      el.appendChild(iconCanvas(type));
      el.insertAdjacentHTML('beforeend', `<div>🔒${d.name}</div><div class="bcost">設計図 🪙${d.bp}</div><div class="bcnt">${why ? '条件あり' : 'タップで購入'}</div>`);
      el.addEventListener('click', () => showBlueprint(type));
      list.appendChild(el); continue;
    }
    const lim0 = limitOf(type), full = lim0 !== null && countType(type) >= lim0;
    const el = document.createElement('div'); el.className = 'bitem' + (full ? ' disabled' : '');
    el.appendChild(iconCanvas(type));
    const lim = limitOf(type);
    el.insertAdjacentHTML('beforeend', `<div>${d.name}</div><div class="bcost">${d.cost.coins ? '🪙' + d.cost.coins : '無料'}</div><div class="bcnt ${full ? 'red' : ''}">${lim === null ? `${countType(type)}棟` : `${countType(type)}/${lim}棟`}</div>`);
    if (S.newTypes.includes(type)) { el.insertAdjacentHTML('beforeend', '<span class="ribbon">NEW</span>'); shownNew.push(type); }
    let lp = null, fired = false, p0 = null;
    const down = (x, y) => { fired = false; p0 = [x, y]; lp = setTimeout(() => { fired = true; showDetail(type); }, 500); };
    const move = (x, y) => { if (p0 && Math.hypot(x - p0[0], y - p0[1]) > 10) { clearTimeout(lp); fired = true; } };
    const up = () => { clearTimeout(lp); if (!fired && !full) startPlace(type); fired = true; };
    if (window.PointerEvent) {
      el.addEventListener('pointerdown', e => down(e.clientX, e.clientY));
      el.addEventListener('pointermove', e => move(e.clientX, e.clientY));
      el.addEventListener('pointercancel', () => { clearTimeout(lp); fired = true; });
      el.addEventListener('pointerup', up);
    } else {
      el.addEventListener('touchstart', e => down(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
      el.addEventListener('touchmove', e => move(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
      el.addEventListener('touchcancel', () => { clearTimeout(lp); fired = true; });
      el.addEventListener('touchend', e => { e.preventDefault(); up(); });
      el.addEventListener('mousedown', e => down(e.clientX, e.clientY));
      el.addEventListener('mousemove', e => move(e.clientX, e.clientY));
      el.addEventListener('mouseup', up);
    }
    el.addEventListener('contextmenu', e => e.preventDefault());
    list.appendChild(el);
  }
  $('buildmenu').classList.remove('hidden');
}
function showBlueprint(type) {
  const d = BUILD[type], why = bpBlocker(type);
  const outs = d.kind === 'prod' ? d.recipes.filter(r => !RECIPES[r].buy).map(r => RECIPES[r].out) : d.res ? [d.res] : [];
  const buyNow = d.kind === 'prod' ? d.recipes.filter(r => RECIPES[r].buy && !RECIPES[r].up).map(r => RECIPES[r].out) : [];
  const later = d.kind === 'prod' ? d.recipes.filter(r => RECIPES[r].up).map(r => RECIPES[r].out) : [];
  const stg = outs.length ? Math.max(...outs.map(k => ITEMS[k].stage)) : 0;
  let h = `<div>${d.desc}</div><div class="line"><span class="lbl">設計図</span><span class="val ${S.coins < d.bp ? 'red' : ''}">🪙${d.bp} <small>(所持 ${S.coins})</small></span></div>`;
  h += `<div class="line"><span class="lbl">建てる費用</span><span class="val">${Object.entries(d.cost).map(([k, v]) => (k === 'coins' ? '🪙' : ITEMS[k].name) + v).join(' ') || '無料'}</span></div>`;
  if (outs.length) h += `<div class="line"><span class="lbl">つくれる品</span><span class="val">${outs.map(k => ITEMS[k].name + `<small>(第${ITEMS[k].stage}段階)</small>`).join(' ')}</span></div>`;
  if (buyNow.length) h += `<div class="line"><span class="lbl">レシピ購入で</span><span class="val">${buyNow.map(k => ITEMS[k].name + `<small>(第${ITEMS[k].stage}段階)</small>`).join(' ')}</span></div>`;
  if (later.length) h += `<div class="line"><span class="lbl">施設Lv2＋レシピ購入</span><span class="val">${later.map(k => ITEMS[k].name + `<small>(第${ITEMS[k].stage}段階)</small>`).join(' ')}</span></div>`;
  if (stg > (S.maxStage || 0)) h += `<div class="hint red" style="text-align:left">買うと第${stg}段階が解放され、幸福度の分母が上がります（幸福度が下がります）</div>`;
  if (why) h += `<div class="hint red" style="text-align:left">${why}</div>`;
  modal(`${d.name}の設計図`, h, () => { if (buyBlueprint(type)) { save(); openBuildMenu(); } }, !why && S.coins >= d.bp);
  if (!why && S.coins >= d.bp) $('modal-ok').textContent = '購入する';
}
function showDetail(type) {
  const d = BUILD[type];
  let extra = '';
  if (d.kind === 'prod') extra += `<div>レシピ: ${d.recipes.map(r => `${Object.entries(RECIPES[r].need).map(([k, v]) => ITEMS[k].name + v).join('＋')} → ${ITEMS[RECIPES[r].out].name}1`).join(' / ')}</div>`;
  modal(d.name, `<div>${d.desc}</div>${extra}<div style="margin-top:8px"><b>建築費用</b>${costHtml(d.cost, false)}</div><div class="hint">${type === 'house' ? `住居は${houseCap()}棟まで（エリア開放ごとに+${CONFIG.HOUSE_PER_AREA}）` : '棟数の上限はありません'}（現在 ${countType(type)}）</div>`);
}
function startPlace(type) {
  UI.mode = 'place'; UI.placeType = type; UI.sel = null;
  const c = Math.round(cam.x / T), r = Math.round(cam.y / T), s = BUILD[type].size;
  UI.px = Math.max(0, Math.min(N - s, c)); UI.py = Math.max(0, Math.min(N - s, r));
  if (shownNew.length) { S.newTypes = S.newTypes.filter(t => !shownNew.includes(t)); shownNew = []; }
  $('buildmenu').classList.add('hidden'); showPlacePanel();
}
function showPlacePanel() {
  const d = BUILD[UI.placeType];
  $('place-title').textContent = `${d.name} を配置（タップで位置変更）`;
  $('place-cost').innerHTML = costHtml(d.cost, true);
  const ok = canPlace(UI.placeType, UI.px, UI.py) && canAfford(d.cost);
  $('place-ok').disabled = !ok; $('place-ok').textContent = '建築する';
  $('place-cancel').onclick = () => { UI.mode = 'normal'; $('placepanel').classList.add('hidden'); openBuildMenu(); };
  $('place-ok').onclick = () => { if (build(UI.placeType, UI.px, UI.py)) { UI.mode = 'normal'; $('placepanel').classList.add('hidden'); toast(`${d.name}を建てました`); save(); } };
  $('placepanel').classList.remove('hidden');
}
function showMovePanel() {
  const b = UI.moveB, d = BUILD[b.type];
  $('place-title').textContent = `${bname(b)} を移動（タップで移動先を選択）`;
  $('place-cost').innerHTML = '<div class="hint">移動は無料です</div>';
  $('place-ok').disabled = !canPlace(b.type, UI.px, UI.py, b.id); $('place-ok').textContent = '決定';
  $('place-cancel').onclick = () => { UI.mode = 'normal'; UI.moveB = null; $('placepanel').classList.add('hidden'); };
  $('place-ok').onclick = () => { if (moveBuilding(b, UI.px, UI.py)) { UI.mode = 'normal'; UI.moveB = null; $('placepanel').classList.add('hidden'); save(); } };
  $('placepanel').classList.remove('hidden');
}

// --- 施設情報パネル ---
function openInfo() { $('infopanel').classList.remove('hidden'); renderInfo(); }
function gaugeLine(label, v, max, cls) { return `<div class="line"><span class="lbl">${label}</span><div class="gauge ${cls || ''}"><div style="width:${Math.min(100, v / max * 100)}%"></div></div><span class="val">${Math.floor(v)}/${max}</span></div>`; }
function renderInfo() {
  const b = UI.sel; if (!b) return;
  const d = BUILD[b.type];
  $('info-title').textContent = bname(b);
  let h = '';
  const workersLine = () => `<div class="line"><span class="lbl">作業員 ${b.workers}/${maxWorkers(b)}人</span><button class="btn small" id="w-minus" ${b.workers === 0 ? 'disabled' : ''}>－</button><button class="btn small" id="w-plus" ${(b.workers >= maxWorkers(b) || freeWorkers() <= 0) ? 'disabled' : ''}>＋</button></div>`;
  const levelLine = () => {
    const L = lvData(b); if (!L) return '';
    const c = nextLevelCost(b), lv = lvOf(b), key = b.type === 'market' ? 'workers' : 'slots', nm = b.type === 'market' ? '作業員' : 'スロット';
    return `<div class="line lvline"><span class="lbl">規模Lv ${lv} <small>${nm}${L[key][lv - 1]}${c === null ? '' : ` → ${L[key][lv]}`}</small></span>` + (c === null ? '<span class="val">最大</span>' : `<button class="btn small" id="lv-up" ${S.coins >= c ? '' : 'disabled'}>⬆ 🪙${c}</button>`) + `</div>`;
  };
  const facLine = () => { const d0 = BUILD[b.type]; if (!d0.upCost) return ''; const c = facUpCost(b); return `<div class="line"><span class="lbl">施設Lv ${b.lv || 1} <small>${c === null ? '上位レシピを購入・使用できます' : 'Lv2で上位レシピが買えます'}</small></span>` + (c === null ? '<span class="val">最大</span>' : `<button class="btn small" id="fac-up" ${S.coins >= c ? '' : 'disabled'}>⬆ 🪙${c}</button>`) + `</div>`; };
  const destLine = () => CONFIG.FETCH_MODE ? `<div class="line"><span class="lbl">搬送先</span>` + ['none', 'warehouse', 'market'].map(k => `<button class="btn small dest ${b.dest === k ? 'on' : ''}" data-d="${k}">${DEST_NAMES[k]}</button>`).join('') + `</div>` : '';
  const tripLine = () => {
    if (!CONFIG.FETCH_MODE) return '';
    let st;
    if (b.workers === 0) st = `<span class="lbl">⏸ 停止（作業員なし）</span>`;
    else if (b.fetch) { const fo = getB(b.fetch.from); st = `<span class="lbl">🚶 ${ITEMS[b.fetch.item].name}×${b.fetch.qty} ${b.fetch.mode === 'in' ? '←' : '→'} ${fo ? bname(fo) : '?'}</span><div class="gauge prog"><div style="width:${Math.min(100, b.fetch.prog / b.fetch.time * 100)}%"></div></div><span class="val">${Math.max(0, Math.ceil((b.fetch.time - b.fetch.prog) / Math.max(1, b.workers)))}秒</span>`; }
    else if (b.inv && b.inv.out >= CONFIG.INV_CAP) st = `<span class="lbl">📦 完成品が満杯${b.dest === 'none' ? '（搬送先なし）' : '（搬送先に空きがありません）'}</span>`;
    else if (b.active) st = `<span class="lbl">⚙️ 生産中</span>`;
    else if (d.kind === 'gather') st = `<span class="lbl">${gatherTarget(b) ? '⛏ 採集中' : '🔍 資源待ち'}</span>`;
    else if (b.recipe && !recipeMats(b).every((m, i) => b.inv[MK[i]] >= RECIPES[b.recipe].need[m])) st = `<span class="lbl">🔍 材料待ち（在庫なし）</span>`;
    else st = `<span class="lbl">…</span>`;
    return `<div class="line status">${st}</div>`;
  };
  const bagLine = () => { const c = carryCost(b); return `<div class="line"><span class="lbl">運搬Lv ${b.clv || 1} <small>一度に${carryOf(b)}個運ぶ</small></span>` + (c ? `<button class="btn small" id="carry-up" ${canAfford(c) ? '' : 'disabled'}>⬆ ${Object.entries(c).map(([k, v]) => (k === 'coins' ? '🪙' : ITEMS[k].name) + v).join('+')}</button>` : '<span class="val">最大</span>') + `</div>`; };
  if (d.kind === 'gather') {
    const tgt = gatherTarget(b);
    const R = CONFIG.GATHER_RANGE;
    const sum = (() => { let a = 0, m = 0; for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const x = b.x + dx, y = b.y + dy; if (!inMap(x, y)) continue; const t = S.tiles[idx(x, y)]; if (t.unl && t.res && t.res.t === gRes(b) && !occ[idx(x, y)]) { a += t.res.amt; m += t.res.max; } } return [a, m]; })();
    if (b.type === 'collect') h += `<div class="line"><span class="lbl">採るもの</span></div><div class="resbtns">` + GATHERABLE.map(r => { const ok = resFound(r); return `<button class="btn small resb ${gRes(b) === r ? 'on' : ''}" data-r="${r}" ${ok ? '' : 'disabled'}>${ok ? ITEMS[r].name : '？'}</button>`; }).join('') + `</div>`;
    else h += `<div class="line"><span class="lbl">採るもの</span><span class="val">${ITEMS[gRes(b)].name}</span></div>`;
    if (!noRes(b)) h += `<div class="line"><span class="lbl">範囲内の資源量</span><span class="val">${sum[0]}/${sum[1]}${tgt ? '' : ' <small>(採集できる資源なし)</small>'}</span></div>`;
    h += workersLine(); h += destLine(); if (CONFIG.FETCH_MODE) h += bagLine(); h += tripLine();
    h += `<div class="line"><span class="lbl">採集速度</span><span class="val">${b.workers ? (workSec(b) / b.workers).toFixed(0) + '秒/個' : '停止'}</span></div>`;
    if (!noRes(b)) h += `<div class="line"><span class="lbl">採集範囲</span><span class="val">周り${(R * 2 + 1) ** 2 - 1}マス</span></div>`;
    h += gaugeLine(`完成品 ${ITEMS[gRes(b)].name}`, b.inv.out, CONFIG.INV_CAP);
  } else if (d.kind === 'prod' && !b.recipe) {
    h += `<div class="line"><span class="lbl">レシピ</span><button class="recipe-btn" id="recipe-btn">レシピを選ぶ／買う</button></div>`;
    h += workersLine(); h += destLine();
  } else if (d.kind === 'prod') {
    const r = RECIPES[b.recipe], mats = Object.keys(r.need);
    h += `<div class="line"><span class="lbl">レシピ</span><button class="recipe-btn" id="recipe-btn">${mats.map(m => ITEMS[m].name + r.need[m]).join('＋')} → ${ITEMS[r.out].name}</button></div>`;
    h += workersLine();
    h += facLine(); h += destLine(); if (CONFIG.FETCH_MODE) h += bagLine(); h += tripLine();
    h += `<div class="line"><span class="lbl">生産速度</span><span class="val">${b.workers ? (workSec(b) / b.workers).toFixed(0) + '秒/個' : '停止'}${r.fuel ? ' <small>(' + ITEMS[r.fuel].name + 'は火)</small>' : ''}</span></div>`;
    h += gaugeLine('生産進捗', b.active ? b.prog * 100 : 0, 100, 'prog');
    mats.forEach((m, i) => { h += gaugeLine(ITEMS[m].name + (m === r.fuel ? '（燃料）' : ''), b.inv[MK[i]] || 0, CONFIG.INV_CAP); });
    h += gaugeLine(`完成品 ${ITEMS[r.out].name}`, b.inv.out, CONFIG.INV_CAP);
  } else if (d.kind === 'market') {
    h += levelLine(); h += workersLine(); if (CONFIG.FETCH_MODE) h += bagLine();
    if (CONFIG.FETCH_MODE) { let st; if (b.workers === 0) st = '⏸ 停止（作業員なし）'; else if (b.fetch) { const fo = getB(b.fetch.from); st = `🚶 ${ITEMS[b.fetch.item].name}×${b.fetch.qty} ← ${fo ? bname(fo) : '?'} を仕入れ中`; } else if (marketTarget(b)) st = '🏠 配達中'; else st = '👀 配達する商品を待っています（在庫なし or 需要なし）'; h += `<div class="line status"><span class="lbl">${st}</span></div>`; }
    h += gaugeLine('配送進捗', b.prog * 100, 100, 'prog');
    const nh = countType('house');
    h += `<div class="line"><span class="lbl">島の幸福度</span><span class="val">😊${Math.round(S.happy)}% <small>(住民${S.residents.length}人の平均)</small></span></div>`;
    h += `<div class="hint" style="text-align:left">販売商品（タップで変更）。需要が${CONFIG.DELIVER_BELOW}%を切った家から順に届けます</div>`;
    b.items.forEach((it, i) => {
      h += `<div class="line"><span class="lbl"><button class="recipe-btn mk-item" data-i="${i}">${it ? ITEMS[it].name : '（なし）'}</button></span>` +
        (it ? `<span class="val">欲しい人 ${houseWanting(it)}/${S.residents.length}　${(b.stock[it] || 0) === 0 && whCount(it) > 0 && whAvail(it) === 0 ? '<span class="red">確保で出せません</span>' : '在庫' + (b.stock[it] || 0)}　🪙${ITEMS[it].price}</span>` : '') + `</div>`;
    });
  } else if (d.kind === 'house') {
    const rs = residentsOf(b);
    h += `<div class="line"><span class="lbl">住民</span><span class="val">${rs.length}/${CONFIG.HOUSE_CAP}人</span></div>`;
    rs.forEach((r, i) => {
      const got = Object.keys(r.demand).filter(k => r.demand[k] > 0);
      h += `<div class="line"><span class="lbl">住民${r.id} <small>${residentPoints(r)}/${happyDenom()}pt</small></span><div class="gauge"><div style="width:${r.happy}%"></div></div><span class="val">😊${Math.round(r.happy)}%</span></div>`;
      h += `<div class="chips">` + unlockedItems().map(k => { const g = Math.round(r.demand[k] || 0); return `<span class="chip ${g > 0 ? 'on' : ''}">${ITEMS[k].name}${g > 0 ? ' ' + g + '%' : ''}</span>`; }).join('') + `</div>`;
    });
    h += `<div class="hint" style="text-align:left">需要が${CONFIG.DELIVER_BELOW}%を切ると市場が届けます。幸福度＝持っている商品の幸福ポイント合計÷分母${happyDenom()}。島の幸福度 ${Math.round(S.happy)}% ／ 人口が増える幸福度 ${growNeed()}%</div>`;
  } else if (d.kind === 'warehouse') {
    h += levelLine();
    h += `<div class="line"><span class="lbl">容量</span><span class="val">${S.slots.length}スロット×${CONFIG.SLOT_CAP}個</span></div>`;
    if (CONFIG.FETCH_MODE) {
      h += workersLine(); h += bagLine();
      let st;
      if (b.workers === 0) st = `<span class="lbl">⏸ 回収していません（作業員を置くと施設の完成品を回収）</span>`;
      else if (b.fetch) { const fo = getB(b.fetch.from); st = `<span class="lbl">🚶 ${ITEMS[b.fetch.item].name}×${b.fetch.qty} ${b.fetch.mode === 'in' ? '←' : '→'} ${fo ? bname(fo) : '?'}</span><div class="gauge prog"><div style="width:${Math.min(100, b.fetch.prog / b.fetch.time * 100)}%"></div></div><span class="val">${Math.max(0, Math.ceil((b.fetch.time - b.fetch.prog) / Math.max(1, b.workers)))}秒</span>`; }
      else st = `<span class="lbl">👀 回収・配送するものを待っています</span>`;
      h += `<div class="line status">${st}</div>`;
    }
  } else { h += `<div class="hint">${d.desc}</div>`; }
  $('info-body').innerHTML = h;
  let acts = '';
  if (d.kind === 'warehouse') acts += `<button class="btn" id="a-store">在庫</button>`;
  acts += `<button class="btn" id="a-move">移動</button>` + (d.fixed ? '' : `<button class="btn danger" id="a-demo">取り壊す</button>`);
  $('info-actions').innerHTML = acts;
  const wm = $('w-minus'), wp = $('w-plus');
  if (wm) wm.onclick = () => { setWorkers(b, b.workers - 1); renderInfo(); };
  if (wp) wp.onclick = () => { setWorkers(b, b.workers + 1); renderInfo(); };
  const rb = $('recipe-btn'); if (rb) rb.onclick = () => pickRecipe(b);
  document.querySelectorAll('.dest').forEach(el => el.onclick = () => { setDest(b, el.dataset.d); save(); renderInfo(); });
  document.querySelectorAll('.resb').forEach(el => el.onclick = () => { setRes(b, el.dataset.r); save(); renderInfo(); });
  const cu = $('carry-up'); if (cu) cu.onclick = () => { carryUp(b); save(); renderInfo(); };
  const fu = $('fac-up'); if (fu) fu.onclick = () => { facUp(b); save(); renderInfo(); };
  const lu = $('lv-up'); if (lu) lu.onclick = () => { if (levelUp(b)) save(); renderInfo(); };

  document.querySelectorAll('.mk-item').forEach(el => el.onclick = () => pickMarketItem(b, +el.dataset.i));
  const as = $('a-store'); if (as) as.onclick = () => { $('infopanel').classList.add('hidden'); storeTab = 'slots'; openStore(); };
  $('a-move').onclick = () => { UI.mode = 'move'; UI.moveB = b; UI.px = b.x; UI.py = b.y; $('infopanel').classList.add('hidden'); showMovePanel(); };
  if ($('a-demo')) $('a-demo').onclick = () => {
    let note = `<div>${bname(b)}を取り壊します。</div><div>🪙 ${d.cost.coins || 0} を返金します（建築に使った材料は戻りません）。</div>`;
    if (b.workers) note += `<div>作業員 ${b.workers}人は未割り当てに戻ります。</div>`;
    if (b.inv || b.stock) note += `<div>施設内の在庫は倉庫へ返却し、入りきらない分は破棄されます。</div>`;
    if (b.type === 'warehouse') note += `<div class="red">倉庫の中身（${Object.values(whTotalItems()).reduce((a, n) => a + n, 0)}個）とレベルはすべてなくなります。</div>`;
    if (b.type === 'market' && lvOf(b) > 1) note += `<div class="red">市場のレベルは1に戻ります。</div>`;
    modal('取り壊しの確認', note, () => { demolish(b); UI.sel = null; $('infopanel').classList.add('hidden'); toast(`${d.name}を取り壊しました`); save(); }, true);
  };
}
function pickRecipe(b) {
  const d = BUILD[b.type], list = d.recipes;
  if (list.length === 1 && !RECIPES[list[0]].buy) { toast('このレシピのみです'); return; }
  let h = '';
  for (const r of list) {
    const rc = RECIPES[r], label = `${Object.entries(rc.need).map(([k, v]) => ITEMS[k].name + v + (k === rc.fuel ? '(燃料)' : '')).join('＋')} → ${ITEMS[rc.out].name}<small>（第${ITEMS[rc.out].stage}段階）</small>`;
    if (recipeUsable(b, r)) h += `<div class="line"><button class="recipe-btn pick" data-r="${r}">${label}${b.recipe === r ? '　✔' : ''}</button></div>`;
    else if (rc.up && (b.lv || 1) < 2) h += `<div class="line"><span class="lbl">🔒 ${label}</span><span class="val"><small>施設Lv2で購入可</small></span></div>`;
    else if (!recipeOwned(r)) h += `<div class="line"><span class="lbl">${label}</span><button class="btn small buy" data-r="${r}" ${S.coins >= rc.buy ? '' : 'disabled'}>🪙${rc.buy}で購入</button></div>`;
  }
  h += `<div class="hint" style="text-align:left">新しい段階のレシピを買うと、その段階が解放されて幸福度の分母が上がります</div>`;
  modal('レシピを選択', h);
  document.querySelectorAll('.pick').forEach(el => el.onclick = () => { changeRecipe(b, el.dataset.r); $('modal').classList.add('hidden'); renderInfo(); save(); });
  document.querySelectorAll('.buy').forEach(el => el.onclick = () => { if (buyRecipe(b, el.dataset.r)) save(); pickRecipe(b); });
}
function pickMarketItem(b, i) {
  let h = `<div class="line"><button class="recipe-btn pick" data-it="">（なし）</button></div>`;
  const nh = countType('house');
  for (const k of unlockedItems()) if (!b.items.includes(k) || b.items[i] === k) {
    const wh = whCount(k), av = whAvail(k), sh = shelfCount(k);
    h += `<div class="mkrow2"><button class="recipe-btn pick" data-it="${k}">${ITEMS[k].name}</button><div class="mkinfo"><div class="mkprice">🪙${ITEMS[k].price}で売れる　😊${itemPoints(k)}pt</div><div class="mksub">倉庫 ${av}${wh - av ? `(+確保${wh - av})` : ''}　施設 ${sh}　欲しい人 ${houseWanting(k)}/${S.residents.length}</div></div></div>`;
  }
  h += `<div class="hint">😊pt＝届けたときの幸福ポイント　倉庫＝市場に出せる数　施設＝完成品棚の数</div>`;
  modal('販売商品を選択', h);
  document.querySelectorAll('.pick').forEach(el => el.onclick = () => {
    const it = el.dataset.it || null;
    const old = b.items[i]; if (old && old !== it && b.stock[old]) { whAdd(old, b.stock[old]); b.stock[old] = 0; }
    b.items[i] = it; if (it) S.stats.market_set++; $('modal').classList.add('hidden'); renderInfo(); save();
  });
}

// --- 住民パネル ---
$('st-pop').addEventListener('click', () => { if (UI.mode !== 'normal') return; closeAll(); openPeople(); });
$('st-happy').addEventListener('click', () => { if (UI.mode !== 'normal') return; closeAll(); openPeople(); });
$('st-free').addEventListener('click', () => { if (UI.mode !== 'normal') return; closeAll(); openPeople(); });
function openPeople() { $('peoplepanel').classList.remove('hidden'); renderPeople(); }
function renderPeople() {
  const cap = countType('house') * CONFIG.HOUSE_CAP, ul = unlockedItems();
  let h = `<div class="line"><span class="lbl">人口</span><span class="val">${S.pop}人 <small>(住居の定員 ${cap}・段階の上限 ${popLimit()})</small></span></div>`;
  h += `<div class="line"><span class="lbl">未割り当て</span><span class="val">${freeWorkers()}人</span></div>`;
  const ok = S.happy >= growNeed(), full = S.pop >= cap, tb = tierBlock();
  const hp = Math.round(S.happy), goal = growNeed();
  h += `<div class="happybox ${ok ? 'ok' : ''}"><div class="hb-row"><span>今の幸福度</span><b>${hp}%</b><span>人口が増える幸福度</span><b>${goal}%</b></div>`;
  h += `<div class="hb-gauge"><div class="hb-fill" style="width:${Math.min(100, S.happy)}%"></div><div class="hb-mark" style="left:${goal}%"></div></div>`;
  h += `<div class="hb-msg">${tb ? `<span class="red">🔒 ${tb}</span>` : ok ? '✅ 目標に届いています。' + (full ? '<span class="red">住居が満員です（住居を建てると増えます）</span>' : `あと${Math.ceil(CONFIG.POP_GROW_SEC - S.timers.grow)}秒で1人増えます`) : `あと <b>${Math.max(1, goal - hp)}%</b> で人口が増え始めます`}</div></div>`;
  // 人口の段階表
  h += `<div class="sub">人口の段階 <small>（段が上がるほど必要な幸福度も上がります）</small></div><div class="tiers">` + CONFIG.POP_TIERS.map((t, i) => { const prev = i ? CONFIG.POP_TIERS[i - 1].cap : 0; const cur = S.pop >= prev && S.pop < t.cap; const lock = t.stage > (S.maxStage || 0); return `<span class="tier ${cur ? 'cur' : ''} ${lock ? 'lock' : ''} ${S.pop >= t.cap ? 'done' : ''}">${lock ? '🔒' : ''}〜${t.cap}人<small>😊${t.need}%${lock ? '・第' + t.stage + '段階' : ''}</small></span>`; }).join('') + `</div>`;
  h += `<div class="hint" style="text-align:left">新しい住民は幸福度0で加わり、商品が届くと上がります</div>`;
  h += `<div class="sub">家ごとの幸福度 <small>（住民の平均。分母 ${happyDenom()}＝第${S.maxStage}段階まで）</small></div>`;
  for (const hb of S.buildings.filter(b => b.type === 'house').sort((a, b) => a.order - b.order)) {
    const rs = residentsOf(hb); const avg = rs.length ? rs.reduce((a, r) => a + r.happy, 0) / rs.length : 0;
    h += `<div class="line"><span class="lbl"><a class="jump" data-id="${hb.id}">${bname(hb)}</a> <small>${rs.length}人</small></span><div class="gauge"><div style="width:${avg}%"></div></div><span class="val">${Math.round(avg)}%</span></div>`;
  }
  const homeless = S.residents.filter(r => !r.house || !getB(r.house)).length; if (homeless) h += `<div class="line"><span class="lbl red">家のない住民</span><span class="val red">${homeless}人</span></div>`;
  h += `<div class="line"><span class="lbl">住居</span><span class="val">${countType('house')} / ${houseCap()}棟 <small>(エリア開放で+${CONFIG.HOUSE_PER_AREA})</small></span></div>`;
  h += `<div class="sub">作業員の割り当て</div>`;
  const work = S.buildings.filter(b => b.workers !== undefined && ['gather', 'prod', 'market', 'warehouse'].includes(BUILD[b.type].kind)).sort((a, b) => a.order - b.order);
  if (!work.length) h += `<div class="hint">まだ作業できる施設がありません</div>`;
  for (const b of work) {
    const d = BUILD[b.type];
    const what = d.kind === 'gather' ? ITEMS[gRes(b)].name : d.kind === 'prod' ? (b.recipe ? ITEMS[RECIPES[b.recipe].out].name : 'レシピ未設定') : d.kind === 'warehouse' ? '回収' : '配達';
    h += `<div class="line"><span class="lbl"><a class="jump" data-id="${b.id}">${bname(b)}</a> <small>${what}</small></span><span class="val">${b.workers}人</span><button class="btn small pw-minus" data-id="${b.id}" ${b.workers === 0 ? 'disabled' : ''}>－</button><button class="btn small pw-plus" data-id="${b.id}" ${(b.workers >= maxWorkers(b) || freeWorkers() <= 0) ? 'disabled' : ''}>＋</button></div>`;
  }
  $('people-body').innerHTML = h;
  document.querySelectorAll('.pw-minus').forEach(el => el.onclick = () => { const b = getB(+el.dataset.id); setWorkers(b, b.workers - 1); renderPeople(); });
  document.querySelectorAll('.pw-plus').forEach(el => el.onclick = () => { const b = getB(+el.dataset.id); setWorkers(b, b.workers + 1); renderPeople(); });
  document.querySelectorAll('.jump').forEach(el => el.onclick = () => { const b = getB(+el.dataset.id); cam.x = (b.x + 0.5) * T; cam.y = (b.y + 0.5) * T; UI.sel = b; closeAll(false); openInfo(); });
}

// --- 倉庫パネル ---
$('btn-store').addEventListener('click', () => { if (UI.mode !== 'normal') return; closeAll(); openStore(); });
document.querySelectorAll('#store-tabs .tab').forEach(t => t.onclick = () => { storeTab = t.dataset.tab; renderStore(); });
let storeTab = 'items';
function openStore() { $('storepanel').classList.remove('hidden'); renderStore(); }
function islandItems() {
  // 島全体の品物：倉庫 / 施設内 / 市場
  const o = {}; const add = (k, where, n) => { if (!n) return; o[k] = o[k] || { wh: 0, fac: 0, mk: 0 }; o[k][where] += n; };
  for (const sl of S.slots) if (sl.item) add(sl.item, 'wh', sl.qty);
  for (const b of S.buildings) {
    const d = BUILD[b.type];
    if (d.kind === 'gather') add(gRes(b), 'fac', b.inv.out);
    if (d.kind === 'prod' && b.recipe) { add(RECIPES[b.recipe].out, 'fac', b.inv.out); recipeMats(b).forEach((m, i) => add(m, 'fac', b.inv[MK[i]])); for (const k in b.pending) add(k, 'fac', b.pending[k]); }
    if (d.kind === 'market') for (const k in b.stock) add(k, 'mk', b.stock[k]);
  }
  return o;
}
function renderItems() {
  const o = islandItems(), el = $('store-items'); let h = '';
  for (const k of Object.keys(ITEMS)) {
    const v = o[k]; if (!v && !unlockedItems(true).includes(k)) continue;
    const t = v ? v.wh + v.fac + v.mk : 0;
    h += `<div class="line"><span class="lbl"><b>${ITEMS[k].name}</b> <small>🪙${ITEMS[k].price}</small></span><span class="val"><b>${t}</b> <small>倉庫${v ? v.wh : 0}(確保${v ? v.wh - whAvail(k) : 0})・施設${v ? v.fac : 0}・市場${v ? v.mk : 0}</small></span></div>`;
  }
  el.innerHTML = h || '<div class="hint">まだ品物がありません</div>';
}
function slotHtml(s) {
  const cfgName = s.cfg === 'block' ? '🚫' : s.cfg ? ITEMS[s.cfg].name : '未設定';
  const col = s.item ? (ITEMS[s.item].color === '#f2eee0' ? '#999' : ITEMS[s.item].color) : '#bbb';
  const out = Math.max(0, s.qty - (s.min || 0));
  return `<div class="sq" style="color:${col}">${s.item ? ITEMS[s.item].name : '－'}</div><div>${s.qty}/${CONFIG.SLOT_CAP}</div><div class="cfg">${cfgName}</div><div class="cfg ${s.qty > 0 && out === 0 ? 'red' : ''}">出せる ${out}</div>`;
}
function renderStore() {
  document.querySelectorAll('#store-tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === storeTab));
  $('store-items').classList.toggle('hidden', storeTab !== 'items');
  $('store-slots').classList.toggle('hidden', storeTab !== 'slots');
  $('store-hint').classList.toggle('hidden', storeTab !== 'slots');
  if (storeTab === 'items') { renderItems(); return; }
  const el = $('store-slots'); el.innerHTML = '';
  S.slots.forEach(s => {
    const d = document.createElement('div'); d.className = 'slot';
    const info = document.createElement('div'); info.className = 'sinfo'; info.innerHTML = slotHtml(s); d.appendChild(info);
    const sel = document.createElement('select');
    sel.innerHTML = `<option value="">未設定</option>` + unlockedItems(true).map(k => `<option value="${k}">${ITEMS[k].name}</option>`).join('') + `<option value="block">🚫 搬入停止</option>`;
    sel.value = s.cfg || '';
    sel.onchange = () => { s.cfg = sel.value === '' ? null : sel.value; if (s.cfg && s.cfg !== 'block') S.stats.slot_set++; info.innerHTML = slotHtml(s); save(); };
    d.appendChild(sel);
    const mn = document.createElement('div'); mn.className = 'minrow';
    mn.innerHTML = `<span>確保</span><button class="mbtn" data-d="-5">－</button><b>${s.min || 0}</b><button class="mbtn" data-d="5">＋</button>`;
    mn.querySelectorAll('.mbtn').forEach(bt => bt.onclick = () => { s.min = Math.max(0, Math.min(CONFIG.SLOT_CAP, (s.min || 0) + (+bt.dataset.d))); mn.querySelector('b').textContent = s.min; info.innerHTML = slotHtml(s); save(); });
    d.appendChild(mn); el.appendChild(d);
  });
}
function updateStore() {
  if (storeTab === 'items') { renderItems(); return; }
  const infos = document.querySelectorAll('#store-slots .sinfo');
  if (infos.length !== S.slots.length) { renderStore(); return; }
  S.slots.forEach((s, i) => { const h = slotHtml(s); if (infos[i].innerHTML !== h) infos[i].innerHTML = h; });
}

// --- 土地開放 ---
function openLand() {
  const p = landPrice();
  $('land-cost').innerHTML = `<div class="line"><span class="lbl">🪙 コイン</span><span class="val ${S.coins < p ? 'red' : ''}">${p} <small>(所持 ${S.coins})</small></span></div>`;
  $('land-ok').disabled = S.coins < p;
  $('land-cost').innerHTML += `<div class="line"><span class="lbl">広さ</span><span class="val">${CONFIG.BLOCK}×${CONFIG.BLOCK}マス</span></div><div class="line"><span class="lbl">住居の上限</span><span class="val">${houseCap()} → ${houseCap() + CONFIG.HOUSE_PER_AREA}棟</span></div>`;
  $('land-ok').onclick = () => { const [bx, by] = UI.land; if (S.coins >= p && canUnlockBlock(bx, by)) { S.coins -= p; unlockBlock(bx, by); UI.land = null; $('landpanel').classList.add('hidden'); notify(`🗺 エリアを開放しました（住居の上限 ${houseCap()}棟）`); save(); } };
  $('landpanel').classList.remove('hidden');
}

// --- 目標 ---
$('btn-reset').addEventListener('click', () => { if (UI.mode !== 'normal') return; closeAll(); resetGame(); });
$('btn-goal').addEventListener('click', () => { if (UI.mode !== 'normal') return; closeAll(); $('goalpanel').classList.remove('hidden'); renderGoal(); });
function goalProgress(g) { return Math.min(g.n, S.stats[g.stat] || 0); }
function renderGoal() {
  const list = activeGoals();
  if (!list.length) {
    $('goal-body').innerHTML = allGoalsDone()
      ? '<div class="goal"><div class="gt">すべての目標を達成しました！</div><div class="gr">ここからは自由モード。新しいエリアで綿やオレンジを探し、施設をアップグレードして島を育てましょう。</div></div>'
      : '<div class="goal"><div class="gt">今は目標がありません</div><div class="gr">新しいエリアを開放して、綿やオレンジを探してみましょう。見つけた資源の目標が始まります。</div></div>';
    return;
  }
  const label = { main: '' };
  $('goal-body').innerHTML = list.map(({ tr, g }) => {
    const p = goalProgress(g), done = p >= g.n, hint = typeof g.hint === 'function' ? g.hint() : g.hint;
    return `<div class="goal"><div class="gt">${label[tr]}${g.text}</div><div class="gr">進捗 ${p} / ${g.n}　報酬 🪙${g.reward}${g.area ? '　解放: エリア開放' : ''}</div>${hint ? `<div class="gr">${hint}</div>` : ''}<div class="row"><button class="btn primary goal-claim" data-tr="${tr}" ${done ? '' : 'disabled'}>獲得</button></div></div>`;
  }).join('');
  document.querySelectorAll('.goal-claim').forEach(el => el.onclick = () => { if (claimGoal(el.dataset.tr)) { save(); renderGoal(); } });
}

// --- 通知チェック（毎フレーム） ---
let prevPop = null;
function checkEvents() {
  // 目標判定は「ボタンを押したか」ではなく今の状態で見る（倉庫を先に建てると新しい施設は最初から搬送先が倉庫になるため）
  if (S.buildings.some(b => b.dest === 'market')) S.stats.dest_market = 1;
  if (S.buildings.some(b => b.dest === 'warehouse')) S.stats.dest_warehouse = 1;
  S.stats.wh_ready = (S.slots.some(sl => sl.cfg && sl.cfg !== 'block') && S.stats.dest_warehouse > 0 && countType('warehouse') > 0) ? 1 : 0;
  for (const { g } of activeGoals()) if (!S.notified['goal_' + g.id] && goalProgress(g) >= g.n) { S.notified['goal_' + g.id] = true; notify(`🎁 目標達成「${g.text}」 🎯で報酬を受け取れます`); }
  for (const tr of []) { const T = GOAL_TRACKS[tr]; if (goalIdx('main') >= GOAL_TRACKS.main.list.length && T.when() && !S.notified['track_' + tr]) { S.notified['track_' + tr] = true; notify(`🎯 新しい目標：${T.list[goalIdx(tr)] ? T.list[goalIdx(tr)].text : ''}`); } }
  if (prevPop !== null && S.pop > prevPop) notify(`👤 住民が増えました（${S.pop}人）`);
  prevPop = S.pop;
  // 倉庫にはあるのに確保で市場に出せない商品がある
  const blocked = S.buildings.some(m => m.type === 'market' && m.workers > 0 && m.items.some(it => it && (m.stock[it] || 0) === 0 && whCount(it) > 0 && whAvail(it) === 0));
  if (blocked && !S.notified.reserve) { S.notified.reserve = true; notify('📦 倉庫の「確保」が多くて市場に出せない商品があります（倉庫スロットで確保を下げてください）'); }
  if (!blocked) delete S.notified.reserve;
  for (const b of S.buildings) {
    const d = BUILD[b.type], key = 'b' + b.id;
    if (d.kind === 'gather') {
      const dead = !noRes(b) && b.workers > 0 && !gatherTarget(b);
      if (dead && !S.notified[key + 'res']) { S.notified[key + 'res'] = true; notify(`🪓 ${bname(b)}の周りの${ITEMS[gRes(b)].name}がなくなりました（回復待ち）`); }
      if (!dead) delete S.notified[key + 'res'];
    }
  }
}
// --- 上部バー ---
function renderTop() {
  $('st-coins').querySelector('span').textContent = S.coins;
  $('st-pop').querySelector('span').textContent = S.pop;
  $('st-free').querySelector('span').textContent = freeWorkers();
  const hp = Math.round(S.happy), goal = growNeed();
  $('st-happy').querySelector('span').innerHTML = `${hp}<small>/${goal}%</small>`;
  $('st-happy').classList.toggle('ok', S.happy >= goal);
  const ready = activeGoals().some(({ g }) => goalProgress(g) >= g.n);
  $('btn-goal').textContent = ready ? '🎁' : '🎯';
  $('btn-goal').classList.toggle('pulse', ready);
  $('build-badge').classList.toggle('hidden', S.newTypes.length === 0);
}

// ============================================================
//  起動・ループ
// ============================================================
function showWelcome() {
  modal('のんびり島ぐらしへようこそ', '<div>小さな島をのんびり育てる経営ゲームです。</div><div>・下の「🔨 建築」から施設を建てられます<br>・施設をタップして作業員を割り当てましょう（🙋 は手の空いている住民）<br>・霧の「＋」マスをタップすると土地を開放できます<br>・🎯 の目標を進めると新しい施設が解放されます<br>・倉庫のスロットと市場の販売商品は自分で設定します<br>・😊 は「今の幸福度／人口が増える幸福度」。届いた商品の種類と加工段階で上がり、右の数字に届くと人口が増えます<br>・施設は建築メニューで設計図を買うと建てられます。採集所は何を採るか選べます<br>・施設の「搬送先」を市場や倉庫にすると、作業員が完成品を運びます<br>・離れている間も進みます（最大12時間分）</div>');
}
function resetGame() {
  modal(`最初からやり直す（v${VERSION}）`, `<div>今の島のデータを消して、新しい島を始めます。元には戻せません。</div><div class="hint" style="text-align:left">バージョン ${VERSION}　保存キー ${CONFIG.SAVE_KEY}</div>`, () => {
    try { localStorage.removeItem(CONFIG.SAVE_KEY); } catch (e) { }
    newGame(); villagers.length = 0; UI.mode = 'normal'; UI.sel = null; closeAll();
    cam.x = T * N / 2; cam.y = T * N / 2; save(); showWelcome();
  }, true);
}
function start() {
  resize();
  $('ver').textContent = 'v' + VERSION;
  const loaded = load();
  if (!loaded) newGame();
  cam.x = T * N / 2; cam.y = T * N / 2;
  cam.s = Math.max(1, Math.min(4, (W - 16) / (T * 7)));
  if (!loaded) showWelcome(); else { const acc = offlineProgress(); if (acc) showWelcomeBack(acc); }
  $('btn-speed').onclick = () => { const i = CONFIG.SPEEDS.indexOf(S.speed || 1); S.speed = CONFIG.SPEEDS[(i + 1) % CONFIG.SPEEDS.length]; $('btn-speed').textContent = '⏩×' + S.speed; save(); };
  $('btn-speed').textContent = '⏩×' + (S.speed || 1);
  if (!CONFIG.DEBUG_SPEED) { S.speed = 1; $('btn-speed').classList.add('hidden'); }
  let last = performance.now(), saveT = 0, uiT = 0;
  function loop(now) {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    sim(dt * (S.speed || 1), null);
    checkEvents();
    draw(); renderTop();
    uiT += dt; if (uiT > 0.5) { uiT = 0; if (!$('infopanel').classList.contains('hidden')) renderInfo(); if (!$('storepanel').classList.contains('hidden')) updateStore(); if (!$('goalpanel').classList.contains('hidden')) renderGoal(); if (!$('peoplepanel').classList.contains('hidden')) renderPeople(); }
    saveT += dt; if (saveT > 5) { saveT = 0; save(); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { save(); return; }
    const acc = offlineProgress(); if (acc) showWelcomeBack(acc); save(); last = performance.now();
  });
  window.addEventListener('pagehide', save);
}
start();
