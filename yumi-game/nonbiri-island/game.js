'use strict';
/* ============================================================
   のんびり島ぐらし  初期版（1島め）
   仕様引き継ぎ書に基づく実装。仮置きの数値は CONFIG にまとめる。
   ============================================================ */

const VERSION = '0.7.1';   // 画面左下と ⚙️ に表示。更新時はここを上げる

// ---------- 調整用の定数（未確定仕様はここで仮置き） ----------
const CONFIG = {
  MAP: 15,              // 15×15
  TILE: 32,             // ワールド座標の1マスのピクセル
  START_COINS: 300,
  START_POP: 3,
  MAX_WORKERS: 5,       // 施設1棟あたり
  MAX_SAME: 3,          // 同種施設の上限
  BASE_SEC: 10,         // 原材料1個の採集時間（作業員1人）。生産時間は材料の時間の合計（燃料の木材は加算しない）
  OFFLINE_MAX_SEC: 12 * 3600,
  // ---- 材料を取りに行くモデル（v0.7）。false にすると v0.6 の挙動（毎分の材料配分・採集10秒）に戻る ----
  FETCH_MODE: true,
  TILE_SEC: 1,          // 1マス1秒
  GATHER_TRIP: 2,       // 原材料は隣のマスなので往復2秒を加算
  CARRY: [1, 2, 5],     // 施設レベル1/2/3で一度に持てる材料数
  LEVEL_COST: [{ coins: 50, basket: 1 }, { coins: 150, cart: 1 }],  // Lv1→2, Lv2→3
  SPEEDS: [1, 2, 4],    // 時間加速の倍率
  INV_CAP: 20,          // 施設内在庫の上限
  TRANSFER_SEC: 30,     // 完成品→倉庫の搬送間隔
  REFILL_SEC: 60,       // 倉庫→施設の材料補充間隔
  SLOT_CAP: 100,
  SLOTS_PER_WH: 5,
  REGEN_SEC: 60,        // 資源マスの回復間隔（1個）
  BLOCK: 5,                        // エリア開放は5×5単位
  LAND_BASE: 100, LAND_STEP: 80,   // エリア開放価格 = BASE + STEP×開放済みエリア数（初期エリアを除く）
  HOUSE_BASE: 5, HOUSE_PER_AREA: 3, // 住居上限 = 初期5 + エリア開放ごとに3
  FIRST_AREA: [1, 2],               // 最初に開放できるエリア（初期マップの下）
  GATHER_RANGE: 1,                  // 採集範囲：施設の周り8マス（半径1）
  SLOT_MIN: 20,                     // 倉庫スロットの最低保管量の初期値（市場・生産への補充はこれを下回らない）
  HOUSE_CAP: 4,         // 住居1棟あたり人口上限
  POP_GROW_SEC: 60,     // 人口+1の間隔
  HAPPY_MIN_FOR_GROW: 60,   // 幸福度(%)がこれ以上で人口増
  DELIVER_BELOW: 30,        // 需要ゲージがこの%を切ったら配達対象
  MAX_GATHER_ITEMS: 4,  // 採集アイテムの種類上限（木材・石材・小麦・水）
  MAX_PROD_ITEMS: 5,    // 生産アイテムの種類上限
  SAVE_KEY: 'nonbiri-island-v7',
};

// consume: 住民が1個を消費しきる秒数（作るのに手間がかかる品ほど長い）
const ITEMS = {
  water: { name: '水',     color: '#4a90e2', price: 1,  consume: 60,  time: 10 },
  wood:  { name: '木材',   color: '#8b5a2b', price: 2,  consume: 90,  time: 10 },
  stone: { name: '石材',   color: '#8a8a8a', price: 2,  consume: 90,  time: 10 },
  wheat: { name: '小麦',   color: '#d4b24a', price: 2,  consume: 90,  time: 10 },
  plank: { name: '板材',   color: '#c49a5a', price: 6,  consume: 180, time: 20 },
  brick: { name: 'レンガ', color: '#b5533c', price: 6,  consume: 180, time: 20 },
  flour: { name: '小麦粉', color: '#f2eee0', price: 6,  consume: 180, time: 20 },
  bread: { name: 'パン',   color: '#d9893b', price: 16, consume: 360, time: 40 },
  // 道具（需要・幸福度には入らない）
  basket:{ name: 'カゴ',   color: '#b8893a', price: 15, time: 40,  tool: true },
  wheel: { name: '車輪',   color: '#7a5a3a', price: 15, time: 40,  tool: true },
  cart:  { name: '台車',   color: '#6a4a2a', price: 50, time: 120, tool: true },
};

// fuel: 火として使う木材（生産時間には加算しない）
const RECIPES = {
  plank: { out: 'plank', need: { wood: 2 } },
  brick: { out: 'brick', need: { stone: 2 } },
  flour: { out: 'flour', need: { wheat: 2 } },
  bread: { out: 'bread', need: { flour: 2, wood: 1 }, fuel: 'wood' },
  basket: { out: 'basket', need: { plank: 2 }, buy: 100 },            // buy: レシピ購入価格（加工所）
  wheel:  { out: 'wheel',  need: { plank: 2 }, buy: 150 },
  cart:   { out: 'cart',   need: { wheel: 2, basket: 1 }, buy: 250 },
};
// 1個あたりの作業時間（作業員1人）：採集は10秒、生産は材料の時間の合計
function workSec(b) {
  const d = BUILD[b.type];
  if (d.kind === 'gather') return ITEMS[d.res].time + (CONFIG.FETCH_MODE && !d.nores ? CONFIG.GATHER_TRIP : 0);
  if (d.kind === 'prod') { if (!b.recipe) return CONFIG.BASE_SEC; const r = RECIPES[b.recipe]; let t = 0; for (const m in r.need) if (m !== r.fuel) t += ITEMS[m].time * r.need[m]; return t; }
  return CONFIG.BASE_SEC;
}

const CATS = [
  { id: 'gather', name: '採集' },
  { id: 'prod',   name: '生産' },
  { id: 'home',   name: '暮らし' },
];

const BUILD = {
  house:     { name: '住居',   cat: 'home',   size: 1, kind: 'house',   cost: { coins: 30, wood: 5 },  desc: '住民が4人まで住めます。家ごとに商品の需要があり、市場が届けると幸福度が上がります。建てられる数はエリア開放ごとに5棟増えます。', nolimit: true },
  well:      { name: '井戸',   cat: 'gather', size: 1, kind: 'gather',  res: 'water', cost: { coins: 20 }, nores: true, desc: '水を汲みます。資源マスは不要で、枯れません。' },
  lumber:    { name: '伐採所', cat: 'gather', size: 1, kind: 'gather',  res: 'wood',  cost: { coins: 20 }, desc: '周り8マスの木から木材を集めます。' },
  quarry:    { name: '採石場', cat: 'gather', size: 1, kind: 'gather',  res: 'stone', cost: { coins: 30 }, desc: '周り8マスの岩から石材を集めます。' },
  farm:      { name: '農場',   cat: 'gather', size: 1, kind: 'gather',  res: 'wheat', cost: { coins: 25 }, desc: '周り8マスの小麦畑から小麦を集めます。' },
  sawmill:   { name: '製材所', cat: 'prod',   size: 1, kind: 'prod', recipes: ['plank'], cost: { coins: 60, wood: 10 }, desc: '木材2 → 板材1' },
  mason:     { name: '石工所', cat: 'prod',   size: 1, kind: 'prod', recipes: ['brick'], cost: { coins: 60, stone: 10 }, desc: '石材2 → レンガ1' },
  mill:      { name: '製粉所', cat: 'prod',   size: 1, kind: 'prod', recipes: ['flour'], cost: { coins: 80, plank: 5, stone: 5 }, desc: '小麦2 → 小麦粉1' },
  workshop:  { name: '加工所', cat: 'prod',   size: 1, kind: 'prod', recipes: ['basket', 'wheel', 'cart'], shop: true, cost: { coins: 150, plank: 10 }, desc: '板材から道具（カゴ・車輪・台車）をつくります。レシピはコインで購入します。道具で施設のレベルを上げると、一度に運べる材料が増えます。' },
  bakery:    { name: 'パン屋', cat: 'prod',   size: 1, kind: 'prod', recipes: ['bread'], cost: { coins: 120, plank: 10, brick: 5 }, desc: '小麦粉2＋木材1（火） → パン1' },
  warehouse: { name: '倉庫',   cat: 'home',   size: 1, kind: 'warehouse', cost: { coins: 80 }, desc: '共通倉庫の容量が5スロット（各100個）増えます。' },
  market:    { name: '市場',   cat: 'home',   size: 1, kind: 'market', cost: {}, desc: '作業員が住民に商品を届け、コインを得ます。販売商品は自分で選びます。届いている商品の種類が多いほど幸福度が上がります。' },
};

// チュートリアル目標（順番に進行）
const GOALS = [
  { id: 'g1', text: '伐採所を建てて木材を5個採集',   stat: 'made_wood',   n: 5,  reward: 30,  unlock: ['well'] },
  { id: 'g2', text: '井戸を建てて水を5個採集',       stat: 'made_water',  n: 5,  reward: 30,  unlock: ['warehouse'] },
  { id: 'g3', text: '倉庫を建ててスロットを設定',    stat: 'slot_set',    n: 1,  reward: 60,  unlock: ['market'] },
  { id: 'g4', text: '市場を建てて販売商品を設定',    stat: 'market_set',  n: 1,  reward: 60,  unlock: [] },
  { id: 'g4b', text: '販売で100コイン稼ぐ',          stat: 'earned',      n: 100, reward: 60, unlock: [], area: 1 },
  { id: 'g5', text: '下のエリアを開放する',          stat: 'areas',       n: 2,  reward: 60,  unlock: ['quarry'], area: 2 },
  { id: 'g6', text: '採石場で石材を5個採集',         stat: 'made_stone',  n: 5,  reward: 80,  unlock: ['sawmill', 'mason'] },
  { id: 'g7', text: '小麦を見つけて5個採集',         stat: 'made_wheat',  n: 5,  reward: 80,  unlock: ['mill'], hint: '小麦のあるエリアを開放すると農場が建てられます' },
  { id: 'g8', text: '小麦粉を5個つくる',             stat: 'made_flour',  n: 5,  reward: 100, unlock: ['bakery'] },
  { id: 'g9', text: 'パンを5個つくる',               stat: 'made_bread',  n: 5,  reward: 200, unlock: ['workshop'], hint: '達成すると自由モード。加工所が建てられます' },
];
const INITIAL_UNLOCK = ['house', 'lumber'];

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
  // 新しい資源の発見 → 対応する採集施設を解放
  const disc = { stone: 'quarry', wheat: 'farm' };
  for (const res of found) { const t = disc[res]; if (t && !S.unlocked.includes(t) && S.buildings.length) { S.unlocked.push(t); S.newTypes.push(t); notify(`🔎 ${ITEMS[res].name}を発見！ ${BUILD[t].name}が建てられるようになりました`); } }
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
  const fill = (bx, by, weights) => { // weights: {wood:p, stone:p, wheat:p}（合計<1、残りは空き）
    for (let y = by * B; y < (by + 1) * B; y++) for (let x = bx * B; x < (bx + 1) * B; x++) {
      const v = r(); let acc = 0; for (const t in weights) { acc += weights[t]; if (v < acc) { put(x, y, t); break; } }
    }
  };
  // 初期マップ（中央）：木のみ。住居の周りは空ける
  fill(cb, cb, { wood: 0.45 });
  for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, 1]]) tiles[idx(c + dx, c + dy)].res = null;
  for (const [dx, dy] of [[-2, -2], [2, -2], [0, -2], [-2, 1]]) put(c + dx, c + dy, 'wood');
  // 2エリアめ（下）：石が中心
  fill(cb, cb + 1, { stone: 0.4, wood: 0.1 });
  // それ以外：木・石・小麦の混合（小麦は左右と上に必ず）
  for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
    if ((bx === cb && by === cb) || (bx === cb && by === cb + 1)) continue;
    fill(bx, by, { wood: 0.15, stone: 0.12, wheat: 0.18 });
  }
  for (const [bx, by] of [[cb - 1, cb], [cb + 1, cb], [cb, cb - 1]]) put(bx * B + 2, by * B + 2, 'wheat');

  S = {
    v: 6, coins: CONFIG.START_COINS, pop: CONFIG.START_POP, happy: 0,
    tiles, blocks: new Array(NB * NB).fill(false), areaStage: 0, buildings: [], nextId: 1, order: 1,
    slots: [], unlocked: [...INITIAL_UNLOCK], lastTab: 'gather',
    stats: { made_water: 0, made_wood: 0, made_stone: 0, made_wheat: 0, made_plank: 0, made_brick: 0, made_flour: 0, made_bread: 0, made_basket: 0, made_wheel: 0, made_cart: 0, slot_set: 0, market_set: 0, earned: 0, happyMax: 0, areas: 1 },
    goal: 0, goalNotified: false, newTypes: [], notified: {},
    t: 0, timers: { transfer: 0, refill: 0, regen: 0, grow: 0 },
    speed: 1, recipes: [], lastSave: Date.now(),
  };
  unlockBlock(cb, cb);
  addBuilding('house', c, c, true);
}

// ---------- 建物 ----------
function makeBuilding(type, x, y) {
  const d = BUILD[type];
  const b = { id: S.nextId++, type, x, y, order: S.order++, workers: 0 };
  if (d.kind === 'gather') { b.inv = { out: 0 }; b.prog = 0; }
  if (d.kind === 'prod') { b.recipe = d.shop ? null : d.recipes[0]; b.inv = { a: 0, b: 0, out: 0 }; b.prog = 0; b.active = false; b.pending = {}; b.lv = 1; b.fetch = null; }
  if (d.kind === 'market') { b.items = [null, null, null, null, null]; b.stock = {}; b.prog = 0; }
  if (d.kind === 'house') { b.demand = {}; }
  return b;
}
function addBuilding(type, x, y, free) {
  const b = makeBuilding(type, x, y);
  S.buildings.push(b);
  if (BUILD[type].kind === 'warehouse') for (let i = 0; i < CONFIG.SLOTS_PER_WH; i++) S.slots.push({ cfg: null, item: null, qty: 0, min: CONFIG.SLOT_MIN });
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
function shelfCount(item) { return S.buildings.reduce((a, b) => { const d = BUILD[b.type]; if (!b.inv) return a; const out = d.kind === 'gather' ? d.res : (b.recipe ? RECIPES[b.recipe].out : null); return a + (out === item ? b.inv.out : 0); }, 0); }
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
    for (const b of S.buildings) { if (left <= 0) break; const d = BUILD[b.type]; if (!b.inv) continue; const out = d.kind === 'gather' ? d.res : (b.recipe ? RECIPES[b.recipe].out : null); if (out !== k) continue; const n = Math.min(b.inv.out, left); b.inv.out -= n; left -= n; }
  }
}

// レシピ材料の対応（材料A/B）
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
function unlockedItems(all) {
  const set = new Set();
  for (const t of S.unlocked) { const d = BUILD[t]; if (d.kind === 'gather') set.add(d.res); if (d.kind === 'prod') d.recipes.forEach(r => { if (!RECIPES[r].buy || S.recipes.includes(r)) set.add(RECIPES[r].out); }); }
  return Object.keys(ITEMS).filter(k => set.has(k) && (all || !ITEMS[k].tool));
}
function carryOf(b) { return CONFIG.CARRY[Math.min(CONFIG.CARRY.length, b.lv || 1) - 1]; }
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
  while (S.timers.refill >= CONFIG.REFILL_SEC) { S.timers.refill -= CONFIG.REFILL_SEC; if (!CONFIG.FETCH_MODE) doRefill(); doMarketRefill(); }
  // 需要：家ごとに、届いた商品は消費時間をかけて100%→0%に減る
  const houses = S.buildings.filter(b => b.type === 'house');
  for (const h of houses) for (const k in h.demand) { if (h.demand[k] > 0) h.demand[k] = Math.max(0, h.demand[k] - dt / ITEMS[k].consume * 100); }
  // 幸福度 = 各家の「届いている商品の種類 / 解放済みの商品の種類」の平均
  const ul = unlockedItems();
  S.happy = (ul.length && houses.length) ? Math.round(houses.reduce((a, h) => a + ul.filter(k => (h.demand[k] || 0) > 0).length / ul.length, 0) / houses.length * 100) : 0;
  if (S.happy > S.stats.happyMax) S.stats.happyMax = S.happy;
  const cap = countType('house') * CONFIG.HOUSE_CAP;
  S.timers.grow += dt;
  while (S.timers.grow >= CONFIG.POP_GROW_SEC) {
    S.timers.grow -= CONFIG.POP_GROW_SEC;
    if (S.pop < cap && S.happy >= CONFIG.HAPPY_MIN_FOR_GROW) { S.pop++; if (acc) acc.pop++; }
  }
  S.stats.pop = S.pop;
}

function stepBuilding(b, dt, acc) {
  const d = BUILD[b.type];
  if (d.kind === 'gather') {
    if (b.workers === 0) { b.prog = 0; return; }
    if (b.inv.out >= CONFIG.INV_CAP) return;
    const tgt = gatherTarget(b);
    if (!tgt) return;
    b.prog += dt * b.workers / workSec(b);
    if (b.prog >= 1) { b.prog = 0; if (!tgt.infinite) tgt.amt--; b.inv.out++; S.stats['made_' + d.res]++; if (acc) acc.items[d.res] = (acc.items[d.res] || 0) + 1; }
  } else if (d.kind === 'prod') {
    if (b.workers === 0 || !b.recipe) return;
    const r = RECIPES[b.recipe];
    if (!b.active) {
      if (b.inv.out >= CONFIG.INV_CAP) return;
      const mats = Object.keys(r.need);
      const has = mats.every((m, i) => b.inv[i === 0 ? 'a' : 'b'] >= r.need[m]);
      if (!has) { if (CONFIG.FETCH_MODE) stepFetch(b, dt); return; }
      mats.forEach((m, i) => { b.inv[i === 0 ? 'a' : 'b'] -= r.need[m]; });
      b.active = true; b.prog = 0;
    }
    b.prog += dt * b.workers / workSec(b);
    if (b.prog >= 1) { b.prog = 0; b.active = false; b.inv.out++; S.stats['made_' + r.out]++; if (acc) acc.items[r.out] = (acc.items[r.out] || 0) + 1; }
  } else if (d.kind === 'market') {
    if (b.workers === 0 || S.pop === 0) { b.prog = 0; return; }
    if (!marketTarget(b)) return;
    b.prog += dt * b.workers / CONFIG.BASE_SEC;
    if (b.prog >= 1) {
      b.prog = 0;
      const tg = marketTarget(b); if (!tg) return;
      b.stock[tg.item]--;
      const p = ITEMS[tg.item].price; S.coins += p; S.stats.earned += p; if (acc) acc.coins += p;
      tg.house.demand[tg.item] = 100;
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
    else if (od.kind === 'gather' && od.res === m) avail = o.inv.out;
    else if (od.kind === 'prod' && o.recipe && RECIPES[o.recipe].out === m) avail = o.inv.out;
    if (avail <= 0) continue;
    const dd = dist(b, o); if (dd < bestD) { bestD = dd; best = { o, avail, d: dd }; }
  }
  return best;
}
function stepFetch(b, dt) {
  if (b.fetch) {
    b.fetch.prog += dt * b.workers;
    if (b.fetch.prog >= b.fetch.time) { const k = b.fetch.key; b.inv[k] = Math.min(CONFIG.INV_CAP, b.inv[k] + b.fetch.qty); b.fetch = null; }
    return;
  }
  const r = RECIPES[b.recipe], mats = Object.keys(r.need);
  for (let i = 0; i < mats.length; i++) {
    const m = mats[i], key = i === 0 ? 'a' : 'b';
    if (b.inv[key] >= r.need[m]) continue;
    const src = fetchSource(b, m); if (!src) continue;
    const qty = Math.min(carryOf(b), src.avail, CONFIG.INV_CAP - b.inv[key]); if (qty <= 0) continue;
    const od = BUILD[src.o.type];
    if (od.kind === 'warehouse') whTake(m, qty, true); else src.o.inv.out -= qty;
    b.fetch = { item: m, key, qty, from: src.o.id, time: src.d * 2 * CONFIG.TILE_SEC, prog: 0 };
    return;
  }
}
// 配達対象：（家, 商品）のうち在庫があり需要ゲージが閾値未満で、残りが最も少ない組。同率はランダム
function marketTarget(b) {
  const cands = [];
  for (const h of S.buildings) { if (h.type !== 'house') continue; for (const i of b.items) { if (!i || (b.stock[i] || 0) <= 0) continue; const g = h.demand[i] || 0; if (g < CONFIG.DELIVER_BELOW) cands.push({ house: h, item: i, g: Math.round(g) }); } }
  if (!cands.length) return null;
  const min = Math.min(...cands.map(c => c.g));
  const low = cands.filter(c => c.g === min);
  return low[Math.floor(Math.random() * low.length)];
}
function houseWanting(item) { return S.buildings.filter(h => h.type === 'house' && (h.demand[item] || 0) < CONFIG.DELIVER_BELOW).length; }
// 採集対象：範囲5×5内で最も近い資源。同距離は上→右→下→左
function gatherTarget(b) {
  const res = BUILD[b.type].res, R = CONFIG.GATHER_RANGE;
  if (BUILD[b.type].nores) return { amt: Infinity, infinite: true };
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
    if (b.inv.out > 0 && (BUILD[b.type].kind === 'gather' || b.recipe)) {
      const item = BUILD[b.type].kind === 'gather' ? BUILD[b.type].res : RECIPES[b.recipe].out;
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
    recipeMats(b).forEach((m, i) => { (byMat[m] = byMat[m] || []).push({ b, key: i === 0 ? 'a' : 'b' }); });
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
  n = Math.max(0, Math.min(CONFIG.MAX_WORKERS, n));
  if (n > b.workers && freeWorkers() < n - b.workers) return;
  const was = b.workers; b.workers = n;
  if (n === 0 && was > 0) { b.prog = 0; if (b.active !== undefined) b.active = false; } // 材料は返却しない
}

// ---------- 建築・移動・取り壊し ----------
function build(type, x, y) {
  const d = BUILD[type];
  if (!S.unlocked.includes(type) || (!d.nolimit && countType(type) >= CONFIG.MAX_SAME)) return false;
  if (type === 'house' && countType('house') >= houseCap()) return false;
  if (!canPlace(type, x, y) || !canAfford(d.cost)) return false;
  payCost(d.cost);
  addBuilding(type, x, y, false);
  return true;
}
function moveBuilding(b, x, y) { if (!canPlace(b.type, x, y, b.id)) return false; b.x = x; b.y = y; rebuildOcc(); return true; }
function demolish(b) {
  const d = BUILD[b.type];
  if (d.kind === 'warehouse') {
    // 倉庫を減らす：末尾5スロットを削除。中身は残る倉庫へ移せる分だけ移す
    const removed = S.slots.splice(S.slots.length - CONFIG.SLOTS_PER_WH, CONFIG.SLOTS_PER_WH);
    S.buildings = S.buildings.filter(x => x !== b); rebuildOcc();
    for (const s of removed) if (s.item && s.qty) whAdd(s.item, s.qty);
  } else {
    if (b.inv) {
      if (d.kind === 'gather') whAdd(d.res, b.inv.out);
      else { if (b.recipe) { whAdd(RECIPES[b.recipe].out, b.inv.out); recipeMats(b).forEach((m, i) => whAdd(m, b.inv[i === 0 ? 'a' : 'b'])); } for (const k in b.pending) whAdd(k, b.pending[k]); if (b.fetch) whAdd(b.fetch.item, b.fetch.qty); }
    }
    if (b.stock) for (const k in b.stock) whAdd(k, b.stock[k]);
    S.buildings = S.buildings.filter(x => x !== b); rebuildOcc();
  }
  S.coins += d.cost.coins || 0; // コインは返金、材料は返却しない
}
function changeRecipe(b, rid) {
  if (b.recipe === rid) return;
  if (b.fetch) { const left = b.fetch.qty - whAdd(b.fetch.item, b.fetch.qty); if (left) b.pending[b.fetch.item] = (b.pending[b.fetch.item] || 0) + left; b.fetch = null; }
  const old = b.recipe ? recipeMats(b) : [];
  old.forEach((m, i) => { const k = i === 0 ? 'a' : 'b'; const q = b.inv[k]; b.inv[k] = 0; if (q) { const left = q - whAdd(m, q); if (left) b.pending[m] = (b.pending[m] || 0) + left; } });
  b.recipe = rid; b.active = false; b.prog = 0;
}

// ---------- 施設レベル（一度に運べる材料数） ----------
function levelCost(b) { return CONFIG.LEVEL_COST[(b.lv || 1) - 1] || null; }
function levelUp(b) { const c = levelCost(b); if (!c || !canAfford(c)) return false; payCost(c); b.lv = (b.lv || 1) + 1; return true; }
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
  try { const j = localStorage.getItem(CONFIG.SAVE_KEY); if (!j) return false; S = JSON.parse(j); S.newTypes = S.newTypes || []; S.notified = S.notified || {}; for (const sl of S.slots) if (sl.min === undefined) sl.min = CONFIG.SLOT_MIN; if (S.areaStage === undefined) S.areaStage = 2; S.recipes = S.recipes || []; for (const b of S.buildings) { if (b.inv && b.lv === undefined) b.lv = 1; } rebuildOcc(); return true; } catch (e) { return false; }
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
      const nm = t.res.t === 'wood' ? 'tree' : t.res.t === 'stone' ? 'rock' : 'wheat';
      if (t.res.amt > 0) ctx.drawImage(sprite(nm), sx, sy, ts, ts);
      else { ctx.globalAlpha = 0.3; ctx.drawImage(sprite(nm), sx + ts * 0.15, sy + ts * 0.15, ts * 0.7, ts * 0.7); ctx.globalAlpha = 1; }
    }
  }
  // 採集範囲
  if (UI.sel && BUILD[UI.sel.type].kind === 'gather' && UI.mode === 'normal') {
    const R = CONFIG.GATHER_RANGE, [rx, ry] = toScreen((UI.sel.x - R) * T, (UI.sel.y - R) * T), rs = ts * (R * 2 + 1);
    if (!BUILD[UI.sel.type].nores) { ctx.fillStyle = 'rgba(255,255,120,.25)'; ctx.fillRect(rx, ry, rs, rs);
    ctx.strokeStyle = 'rgba(255,230,80,.9)'; ctx.lineWidth = 2; ctx.strokeRect(rx, ry, rs, rs); }
  }
  // 建物
  for (const b of S.buildings) {
    if (UI.mode === 'move' && UI.moveB === b) continue;
    drawBuilding(b.type, b.x, b.y, ox, oy, ts, UI.sel === b ? 'sel' : null);
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
function drawBuilding(type, x, y, ox, oy, ts, mark) {
  const s = BUILD[type].size, sx = ox + x * ts, sy = oy + y * ts;
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(sx + ts * s / 2, sy + ts * s * 0.9, ts * s * 0.45, ts * s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(sprite(type), sx, sy, ts * s, ts * s);
  if (mark === 'sel') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(sx + 1, sy + 1, ts * s - 2, ts * s - 2); }
  if (mark === 'ok') { ctx.strokeStyle = '#3ad24a'; ctx.lineWidth = 3; ctx.strokeRect(sx + 1, sy + 1, ts * s - 2, ts * s - 2); }
  if (mark === 'ng') { ctx.fillStyle = 'rgba(255,0,0,.45)'; ctx.fillRect(sx, sy, ts * s, ts * s); }
}
const villagers = [];
// 採集対象マスの座標版
function gatherTargetPos(b) {
  const res = BUILD[b.type].res, R = CONFIG.GATHER_RANGE; let best = null, bestD = 1e9, bestP = 9;
  if (BUILD[b.type].nores) return null;
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
      if (k === 'gather') {
        // 施設 ⇄ 採集先 を往復。採集先がなければ施設前で待つ
        if (v.phase === 0) { const t = gatherTargetPos(b); if (t) { v.tx = t[0] + 0.5; v.ty = t[1] + 0.5; v.phase = 1; } v.wait = 1; }
        else { v.tx = b.x + 0.5; v.ty = b.y + 0.9; v.phase = 0; v.wait = 1.5; }
      } else if (k === 'market') {
        // 市場 ⇄ 住居 を往復
        if (v.phase === 0) { const hs = S.buildings.filter(h => h.type === 'house'); const h = hs[Math.floor(Math.random() * hs.length)]; if (h) { v.tx = h.x + 0.5; v.ty = h.y + 0.9; v.phase = 1; } v.wait = 1; }
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
    const d = BUILD[type]; if (d.cat !== S.lastTab || !S.unlocked.includes(type)) continue;
    const full = type === 'house' ? countType('house') >= houseCap() : (!d.nolimit && countType(type) >= CONFIG.MAX_SAME);
    const el = document.createElement('div'); el.className = 'bitem' + (full ? ' disabled' : '');
    el.appendChild(iconCanvas(type));
    el.insertAdjacentHTML('beforeend', `<div>${d.name}${type === 'house' ? `<br><small>${countType('house')}/${houseCap()}棟</small>` : ''}</div><div class="bcost">${d.cost.coins ? '🪙' + d.cost.coins : '無料'}${full ? '<br>上限' : ''}</div>`);
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
function showDetail(type) {
  const d = BUILD[type];
  let extra = '';
  if (d.kind === 'prod') extra += `<div>レシピ: ${d.recipes.map(r => `${Object.entries(RECIPES[r].need).map(([k, v]) => ITEMS[k].name + v).join('＋')} → ${ITEMS[RECIPES[r].out].name}1`).join(' / ')}</div>`;
  modal(d.name, `<div>${d.desc}</div>${extra}<div style="margin-top:8px"><b>建築費用</b>${costHtml(d.cost, false)}</div><div class="hint">${type === 'house' ? `住居は${houseCap()}棟まで（エリア開放ごとに+${CONFIG.HOUSE_PER_AREA}）` : '同種は島全体で' + CONFIG.MAX_SAME + '棟まで'}（現在 ${countType(type)}）</div>`);
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
  const workersLine = () => `<div class="line"><span class="lbl">作業員 ${b.workers}/${CONFIG.MAX_WORKERS}人</span><button class="btn small" id="w-minus" ${b.workers === 0 ? 'disabled' : ''}>－</button><button class="btn small" id="w-plus" ${(b.workers >= CONFIG.MAX_WORKERS || freeWorkers() <= 0) ? 'disabled' : ''}>＋</button></div>`;
  if (d.kind === 'gather') {
    const tgt = gatherTarget(b);
    const R = CONFIG.GATHER_RANGE;
    const sum = (() => { let a = 0, m = 0; for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const x = b.x + dx, y = b.y + dy; if (!inMap(x, y)) continue; const t = S.tiles[idx(x, y)]; if (t.unl && t.res && t.res.t === d.res && !occ[idx(x, y)]) { a += t.res.amt; m += t.res.max; } } return [a, m]; })();
    h += `<div class="line"><span class="lbl">対象資源</span><span class="val">${ITEMS[d.res].name}</span></div>`;
    if (!d.nores) h += `<div class="line"><span class="lbl">範囲内の資源量</span><span class="val">${sum[0]}/${sum[1]}${tgt ? '' : ' <small>(採集できる資源なし)</small>'}</span></div>`;
    h += workersLine();
    h += `<div class="line"><span class="lbl">採集速度</span><span class="val">${b.workers ? (workSec(b) / b.workers).toFixed(0) + '秒/個' : '停止'}</span></div>`;
    if (!d.nores) h += `<div class="line"><span class="lbl">採集範囲</span><span class="val">周り${(R * 2 + 1) ** 2 - 1}マス</span></div>`;
    h += gaugeLine(`完成品 ${ITEMS[d.res].name}`, b.inv.out, CONFIG.INV_CAP);
  } else if (d.kind === 'prod' && !b.recipe) {
    h += `<div class="line"><span class="lbl">レシピ</span><button class="recipe-btn" id="recipe-btn">レシピを選ぶ／買う</button></div>`;
    h += workersLine();
  } else if (d.kind === 'prod') {
    const r = RECIPES[b.recipe], mats = Object.keys(r.need);
    h += `<div class="line"><span class="lbl">レシピ</span><button class="recipe-btn" id="recipe-btn">${mats.map(m => ITEMS[m].name + r.need[m]).join('＋')} → ${ITEMS[r.out].name}</button></div>`;
    h += workersLine();
    if (CONFIG.FETCH_MODE) {
      const lc = levelCost(b);
      h += `<div class="line"><span class="lbl">レベル ${b.lv || 1} <small>一度に${carryOf(b)}個運ぶ</small></span>` + (lc ? `<button class="btn small" id="lv-up" ${canAfford(lc) ? '' : 'disabled'}>⬆ ${Object.entries(lc).map(([k, v]) => (k === 'coins' ? '🪙' : ITEMS[k].name) + v).join('+')}</button>` : '<span class="val">最大</span>') + `</div>`;
      if (b.fetch) { const fo = getB(b.fetch.from); h += `<div class="line"><span class="lbl">🚶 ${ITEMS[b.fetch.item].name}×${b.fetch.qty} を ${fo ? bname(fo) : '?'} から運搬中</span><div class="gauge prog"><div style="width:${Math.min(100, b.fetch.prog / b.fetch.time * 100)}%"></div></div><span class="val">${Math.max(0, Math.ceil((b.fetch.time - b.fetch.prog) / Math.max(1, b.workers)))}秒</span></div>`; }
      else if (!b.active && b.workers > 0 && !mats.every((m, i) => b.inv[i === 0 ? 'a' : 'b'] >= r.need[m])) h += `<div class="hint" style="text-align:left">材料の在庫がどこにもありません</div>`;
    }
    h += `<div class="line"><span class="lbl">生産速度</span><span class="val">${b.workers ? (workSec(b) / b.workers).toFixed(0) + '秒/個' : '停止'}${r.fuel ? ' <small>(' + ITEMS[r.fuel].name + 'は火)</small>' : ''}</span></div>`;
    h += gaugeLine('生産進捗', b.active ? b.prog * 100 : 0, 100, 'prog');
    h += gaugeLine(ITEMS[mats[0]].name, b.inv.a, CONFIG.INV_CAP);
    if (mats[1]) h += gaugeLine(ITEMS[mats[1]].name, b.inv.b, CONFIG.INV_CAP);
    h += gaugeLine(`完成品 ${ITEMS[r.out].name}`, b.inv.out, CONFIG.INV_CAP);
  } else if (d.kind === 'market') {
    h += workersLine();
    h += gaugeLine('配送進捗', b.prog * 100, 100, 'prog');
    const nh = countType('house');
    h += `<div class="line"><span class="lbl">島の幸福度</span><span class="val">😊${S.happy}% <small>(住居${nh}棟の平均)</small></span></div>`;
    h += `<div class="hint" style="text-align:left">販売商品（タップで変更）。需要が${CONFIG.DELIVER_BELOW}%を切った家から順に届けます</div>`;
    b.items.forEach((it, i) => {
      h += `<div class="line"><span class="lbl"><button class="recipe-btn mk-item" data-i="${i}">${it ? ITEMS[it].name : '（なし）'}</button></span>` +
        (it ? `<span class="val">欲しい家 ${houseWanting(it)}/${nh}　在庫${b.stock[it] || 0}　🪙${ITEMS[it].price}</span>` : '') + `</div>`;
    });
  } else if (d.kind === 'house') {
    const ul = unlockedItems(), got = ul.filter(k => (b.demand[k] || 0) > 0).length;
    h += `<div class="line"><span class="lbl">住める人数</span><span class="val">${CONFIG.HOUSE_CAP}人</span></div><div class="line"><span class="lbl">島の人口</span><span class="val">${S.pop}/${countType('house') * CONFIG.HOUSE_CAP}人</span></div>`;
    h += `<div class="sub">この家の需要　<small>届いている ${got}/${ul.length}種</small></div><div class="chips">` + ul.map(k => { const g = Math.round(b.demand[k] || 0); return `<span class="chip ${g > 0 ? 'on' : ''}">${ITEMS[k].name} ${g}%</span>`; }).join('') + `</div>`;
    h += `<div class="hint" style="text-align:left">${CONFIG.DELIVER_BELOW}%を切ると市場が届けに来ます。島全体の幸福度${CONFIG.HAPPY_MIN_FOR_GROW}%以上で${CONFIG.POP_GROW_SEC}秒ごとに1人増えます</div>`;
  } else if (d.kind === 'warehouse') {
    h += `<div class="line"><span class="lbl">容量</span><span class="val">${CONFIG.SLOTS_PER_WH}スロット×${CONFIG.SLOT_CAP}個</span></div><div class="line"><span class="lbl">島全体</span><span class="val">${S.slots.length}スロット</span></div>`;
  } else { h += `<div class="hint">${d.desc}</div>`; }
  $('info-body').innerHTML = h;
  let acts = '';
  if (d.kind === 'warehouse') acts += `<button class="btn" id="a-store">在庫</button>`;
  acts += `<button class="btn" id="a-move">移動</button><button class="btn danger" id="a-demo">取り壊す</button>`;
  $('info-actions').innerHTML = acts;
  const wm = $('w-minus'), wp = $('w-plus');
  if (wm) wm.onclick = () => { setWorkers(b, b.workers - 1); renderInfo(); };
  if (wp) wp.onclick = () => { setWorkers(b, b.workers + 1); renderInfo(); };
  const rb = $('recipe-btn'); if (rb) rb.onclick = () => pickRecipe(b);
  const lu = $('lv-up'); if (lu) lu.onclick = () => { if (levelUp(b)) { toast(`${bname(b)}が Lv${b.lv} になりました`); save(); } renderInfo(); };
  document.querySelectorAll('.mk-item').forEach(el => el.onclick = () => pickMarketItem(b, +el.dataset.i));
  const as = $('a-store'); if (as) as.onclick = () => { $('infopanel').classList.add('hidden'); storeTab = 'slots'; openStore(); };
  $('a-move').onclick = () => { UI.mode = 'move'; UI.moveB = b; UI.px = b.x; UI.py = b.y; $('infopanel').classList.add('hidden'); showMovePanel(); };
  $('a-demo').onclick = () => {
    let note = `<div>${bname(b)}を取り壊します。</div><div>🪙 ${d.cost.coins || 0} を返金します（建築に使った材料は戻りません）。</div>`;
    if (b.workers) note += `<div>作業員 ${b.workers}人は未割り当てに戻ります。</div>`;
    if (b.inv || b.stock) note += `<div>施設内の在庫は倉庫へ返却し、入りきらない分は破棄されます。</div>`;
    modal('取り壊しの確認', note, () => { demolish(b); UI.sel = null; $('infopanel').classList.add('hidden'); toast(`${d.name}を取り壊しました`); save(); }, true);
  };
}
function pickRecipe(b) {
  const d = BUILD[b.type], list = d.recipes;
  if (!d.shop && list.length === 1) { toast('このレシピのみです'); return; }
  let h = '';
  for (const r of list) {
    const rc = RECIPES[r], owned = !rc.buy || S.recipes.includes(r);
    const label = `${Object.entries(rc.need).map(([k, v]) => ITEMS[k].name + v).join('＋')} → ${ITEMS[rc.out].name}`;
    if (owned) h += `<div class="line"><button class="recipe-btn pick" data-r="${r}">${label}${b.recipe === r ? '　✔' : ''}</button></div>`;
    else h += `<div class="line"><span class="lbl">${label}</span><button class="btn small buy" data-r="${r}" ${S.coins >= rc.buy ? '' : 'disabled'}>🪙${rc.buy}で購入</button></div>`;
  }
  modal(d.shop ? 'レシピを選択／購入' : 'レシピを選択', h);
  document.querySelectorAll('.pick').forEach(el => el.onclick = () => { changeRecipe(b, el.dataset.r); $('modal').classList.add('hidden'); renderInfo(); save(); });
  document.querySelectorAll('.buy').forEach(el => el.onclick = () => { const r = el.dataset.r; if (S.coins < RECIPES[r].buy) return; S.coins -= RECIPES[r].buy; S.recipes.push(r); notify(`📜 レシピ「${ITEMS[RECIPES[r].out].name}」を購入しました`); save(); pickRecipe(b); });
}
function pickMarketItem(b, i) {
  let h = `<div class="line"><button class="recipe-btn pick" data-it="">（なし）</button></div>`;
  for (const k of unlockedItems()) if (!b.items.includes(k) || b.items[i] === k) h += `<div class="line"><button class="recipe-btn pick" data-it="${k}">${ITEMS[k].name}　🪙${ITEMS[k].price}　消費${ITEMS[k].consume}秒</button></div>`;
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
  let h = `<div class="line"><span class="lbl">人口</span><span class="val">${S.pop} / ${cap}人 <small>(住居${countType('house')}棟)</small></span></div>`;
  h += `<div class="line"><span class="lbl">未割り当て</span><span class="val">${freeWorkers()}人</span></div>`;
  const ok = S.happy >= CONFIG.HAPPY_MIN_FOR_GROW, full = S.pop >= cap;
  h += `<div class="line"><span class="lbl">次の住民まで</span><span class="val">${full ? '<span class="red">住居が足りません</span>' : ok ? Math.ceil(CONFIG.POP_GROW_SEC - S.timers.grow) + '秒' : '<span class="red">😊が' + CONFIG.HAPPY_MIN_FOR_GROW + '%未満</span>'}</span></div>`;
  h += `<div class="sub">😊 幸福度 ${S.happy}%　<small>各家に届いている商品の割合の平均（作れる商品 ${ul.length}種）</small></div>`;
  for (const hb of S.buildings.filter(b => b.type === 'house').sort((a, b) => a.order - b.order)) {
    const got = ul.filter(k => (hb.demand[k] || 0) > 0).length;
    h += `<div class="line"><span class="lbl"><a class="jump" data-id="${hb.id}">${bname(hb)}</a></span><div class="gauge"><div style="width:${ul.length ? got / ul.length * 100 : 0}%"></div></div><span class="val">${got}/${ul.length}種</span></div>`;
  }
  h += `<div class="line"><span class="lbl">住居</span><span class="val">${countType('house')} / ${houseCap()}棟 <small>(エリア開放で+${CONFIG.HOUSE_PER_AREA})</small></span></div>`;
  h += `<div class="sub">作業員の割り当て</div>`;
  const work = S.buildings.filter(b => b.workers !== undefined && ['gather', 'prod', 'market'].includes(BUILD[b.type].kind)).sort((a, b) => a.order - b.order);
  if (!work.length) h += `<div class="hint">まだ作業できる施設がありません</div>`;
  for (const b of work) {
    const d = BUILD[b.type];
    const what = d.kind === 'gather' ? ITEMS[d.res].name : d.kind === 'prod' ? (b.recipe ? ITEMS[RECIPES[b.recipe].out].name : 'レシピ未設定') : '配達';
    h += `<div class="line"><span class="lbl"><a class="jump" data-id="${b.id}">${bname(b)}</a> <small>${what}</small></span><span class="val">${b.workers}人</span><button class="btn small pw-minus" data-id="${b.id}" ${b.workers === 0 ? 'disabled' : ''}>－</button><button class="btn small pw-plus" data-id="${b.id}" ${(b.workers >= CONFIG.MAX_WORKERS || freeWorkers() <= 0) ? 'disabled' : ''}>＋</button></div>`;
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
    if (d.kind === 'gather') add(d.res, 'fac', b.inv.out);
    if (d.kind === 'prod' && b.recipe) { add(RECIPES[b.recipe].out, 'fac', b.inv.out); recipeMats(b).forEach((m, i) => add(m, 'fac', b.inv[i === 0 ? 'a' : 'b'])); for (const k in b.pending) add(k, 'fac', b.pending[k]); }
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
  return `<div class="sq" style="color:${col}">${s.item ? ITEMS[s.item].name : '－'}</div><div>${s.qty}/${CONFIG.SLOT_CAP}</div><div class="cfg">${cfgName}</div>`;
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
    mn.querySelectorAll('.mbtn').forEach(bt => bt.onclick = () => { s.min = Math.max(0, Math.min(CONFIG.SLOT_CAP, (s.min || 0) + (+bt.dataset.d))); mn.querySelector('b').textContent = s.min; save(); });
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
  const g = GOALS[S.goal];
  if (!g) { $('goal-body').innerHTML = '<div class="goal"><div class="gt">すべての目標を達成しました！</div><div class="gr">あとはのんびり島を育ててください。</div></div>'; return; }
  const p = goalProgress(g), done = p >= g.n;
  $('goal-body').innerHTML = `<div class="goal"><div class="gt">${S.goal + 1}. ${g.text}</div><div class="gr">進捗 ${p} / ${g.n}　報酬 🪙${g.reward}${g.unlock.length ? '　解放: ' + g.unlock.map(u => BUILD[u].name).join('・') : ''}${g.area ? '　解放: エリア開放' : ''}</div>${g.hint ? `<div class="gr">${g.hint}</div>` : ''}<div class="row"><button class="btn primary" id="goal-claim" ${done ? '' : 'disabled'}>獲得</button></div></div>`;
  $('goal-claim').onclick = () => {
    if (goalProgress(g) < g.n) return;
    S.coins += g.reward; toast(`🪙${g.reward} 獲得`);
    const nu = g.unlock.filter(u => !S.unlocked.includes(u));
    for (const u of nu) { S.unlocked.push(u); S.newTypes.push(u); }
    if (nu.length) notify(`🔨 新しい施設：${nu.map(u => BUILD[u].name).join('・')} が建てられるようになりました`);
    if (g.area && S.areaStage < g.area) { S.areaStage = g.area; notify(g.area === 1 ? '🗺 下のエリアを開放できるようになりました' : '🗺 隣のエリアを自由に開放できるようになりました'); }
    S.goal++; S.goalNotified = false;
    if (S.goal >= GOALS.length) notify('🎉 チュートリアル完了！ここからは自由モードです');
    save(); renderGoal();
  };
}

// --- 通知チェック（毎フレーム） ---
let prevPop = null;
function checkEvents() {
  const g = GOALS[S.goal];
  if (g && !S.goalNotified && goalProgress(g) >= g.n) { S.goalNotified = true; notify(`🎁 目標達成「${g.text}」 🎯で報酬を受け取れます`); }
  if (prevPop !== null && S.pop > prevPop) notify(`👤 住民が増えました（${S.pop}人）`);
  prevPop = S.pop;
  for (const b of S.buildings) {
    const d = BUILD[b.type], key = 'b' + b.id;
    if (d.kind === 'gather') {
      const dead = !d.nores && b.workers > 0 && !gatherTarget(b);
      if (dead && !S.notified[key + 'res']) { S.notified[key + 'res'] = true; notify(`🪓 ${bname(b)}の周りの${ITEMS[d.res].name}がなくなりました（回復待ち）`); }
      if (!dead) delete S.notified[key + 'res'];
    }
    if (b.inv) {
      const full = b.inv.out >= CONFIG.INV_CAP && (d.kind === 'gather' || b.recipe);
      const item = d.kind === 'gather' ? d.res : (b.recipe ? RECIPES[b.recipe].out : null);
      if (full && !S.notified[key + 'full']) { S.notified[key + 'full'] = true; notify(S.slots.length ? `📦 ${bname(b)}の${ITEMS[item].name}が倉庫に入らず満杯です（スロットを確認）` : `📦 ${bname(b)}の${ITEMS[item].name}が満杯です（倉庫がありません）`); }
      if (!full) delete S.notified[key + 'full'];
    }
  }
}
// --- 上部バー ---
function renderTop() {
  $('st-coins').querySelector('span').textContent = S.coins;
  $('st-pop').querySelector('span').textContent = S.pop;
  $('st-free').querySelector('span').textContent = freeWorkers();
  $('st-happy').querySelector('span').textContent = Math.round(S.happy) + '%';
  const g = GOALS[S.goal];
  $('btn-goal').textContent = (g && goalProgress(g) >= g.n) ? '🎁' : '🎯';
  $('btn-goal').classList.toggle('pulse', !!(g && goalProgress(g) >= g.n));
  $('build-badge').classList.toggle('hidden', S.newTypes.length === 0);
}

// ============================================================
//  起動・ループ
// ============================================================
function showWelcome() {
  modal('のんびり島ぐらしへようこそ', '<div>小さな島をのんびり育てる経営ゲームです。</div><div>・下の「🔨 建築」から施設を建てられます<br>・施設をタップして作業員を割り当てましょう（🙋 は手の空いている住民）<br>・霧の「＋」マスをタップすると土地を開放できます<br>・🎯 の目標を進めると新しい施設が解放されます<br>・倉庫のスロットと市場の販売商品は自分で設定します<br>・😊 は「住民に届いている商品の種類」の割合です。60%以上で人口が増えます<br>・⏩ で時間を速められます。離れている間も進みます（最大12時間分）</div>');
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
