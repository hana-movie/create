'use strict';
/* ============================================================
   のんびり島ぐらし  初期版（1島め）
   仕様引き継ぎ書に基づく実装。仮置きの数値は CONFIG にまとめる。
   ============================================================ */

// ---------- 調整用の定数（未確定仕様はここで仮置き） ----------
const CONFIG = {
  MAP: 15,              // 15×15
  START_AREA: 5,        // 中央5×5を初期開放
  TILE: 32,             // ワールド座標の1マスのピクセル
  START_COINS: 300,
  START_POP: 3,
  MAX_WORKERS: 5,       // 施設1棟あたり
  MAX_SAME: 3,          // 同種施設の上限
  PROD_SEC: 30,         // 作業員1人で1個30秒
  INV_CAP: 20,          // 施設内在庫の上限
  TRANSFER_SEC: 30,     // 完成品→倉庫の搬送間隔
  REFILL_SEC: 60,       // 倉庫→施設の材料補充間隔
  SLOT_CAP: 100,
  SLOTS_PER_WH: 5,
  REGEN_SEC: 60,        // 資源マスの回復間隔（1個）
  LAND_BASE: 30, LAND_STEP: 12,   // 土地開放価格 = BASE + STEP×開放済み数
  HOUSE_CAP: 4,         // 住居1棟あたり人口上限
  POP_GROW_SEC: 60,     // 人口+1の間隔
  HAPPY_MIN_FOR_GROW: 60,   // 幸福度(%)がこれ以上で人口増
  DELIVER_BELOW: 30,        // 需要ゲージがこの%を切ったら配達対象
  MAX_GATHER_ITEMS: 3,  // 採集アイテムの種類上限
  MAX_PROD_ITEMS: 5,    // 生産アイテムの種類上限
  SAVE_KEY: 'nonbiri-island-v3',
};

// consume: 住民が1個を消費しきる秒数（作るのに手間がかかる品ほど長い）
const ITEMS = {
  wood:  { name: '木材',   color: '#8b5a2b', price: 3,  consume: 90 },
  stone: { name: '石材',   color: '#8a8a8a', price: 3,  consume: 90 },
  wheat: { name: '小麦',   color: '#d4b24a', price: 2,  consume: 90 },
  plank: { name: '板材',   color: '#c49a5a', price: 8,  consume: 180 },
  brick: { name: 'レンガ', color: '#b5533c', price: 8,  consume: 180 },
  flour: { name: '小麦粉', color: '#f2eee0', price: 6,  consume: 180 },
  bread: { name: 'パン',   color: '#d9893b', price: 15, consume: 360 },
};

const RECIPES = {
  plank: { out: 'plank', need: { wood: 2 } },
  brick: { out: 'brick', need: { stone: 2 } },
  flour: { out: 'flour', need: { wheat: 2 } },
  bread: { out: 'bread', need: { flour: 1, wood: 1 } },
};

const CATS = [
  { id: 'gather', name: '採集' },
  { id: 'prod',   name: '生産' },
  { id: 'home',   name: '暮らし' },
];

const BUILD = {
  house:     { name: '住居',   cat: 'home',   size: 1, kind: 'house',   cost: { coins: 30, wood: 5 },  desc: '住民が4人まで住めます。人口が増えると作業員を割り当てられます。棟数制限なし。', nolimit: true },
  lumber:    { name: '伐採所', cat: 'gather', size: 1, kind: 'gather',  res: 'wood',  cost: { coins: 20 }, desc: '周囲5×5マスの木から木材を集めます。' },
  quarry:    { name: '採石場', cat: 'gather', size: 1, kind: 'gather',  res: 'stone', cost: { coins: 30 }, desc: '周囲5×5マスの岩から石材を集めます。' },
  farm:      { name: '農場',   cat: 'gather', size: 1, kind: 'gather',  res: 'wheat', cost: { coins: 25 }, desc: '周囲5×5マスの小麦畑から小麦を集めます。' },
  sawmill:   { name: '製材所', cat: 'prod',   size: 1, kind: 'prod', recipes: ['plank'], cost: { coins: 60, wood: 10 }, desc: '木材2 → 板材1' },
  mason:     { name: '石工所', cat: 'prod',   size: 1, kind: 'prod', recipes: ['brick'], cost: { coins: 60, stone: 10 }, desc: '石材2 → レンガ1' },
  mill:      { name: '製粉所', cat: 'prod',   size: 1, kind: 'prod', recipes: ['flour'], cost: { coins: 80, plank: 5, stone: 5 }, desc: '小麦2 → 小麦粉1' },
  bakery:    { name: 'パン屋', cat: 'prod',   size: 1, kind: 'prod', recipes: ['bread'], cost: { coins: 120, plank: 10, brick: 5 }, desc: '小麦粉1＋木材1 → パン1' },
  warehouse: { name: '倉庫',   cat: 'home',   size: 1, kind: 'warehouse', cost: { coins: 100, wood: 10, stone: 10 }, desc: '共通倉庫の容量が5スロット（各100個）増えます。' },
  market:    { name: '市場',   cat: 'home',   size: 1, kind: 'market', cost: {}, desc: '作業員が住民に商品を届け、コインを得ます。販売商品は自分で選びます。届いている商品の種類が多いほど幸福度が上がります。' },
};

// チュートリアル目標（順番に進行）
const GOALS = [
  { id: 'g1',  text: '市場を建てる',               stat: 'built_market', n: 1,  reward: 30,  unlock: [] },
  { id: 'g2',  text: '伐採所を建てる',             stat: 'built_lumber', n: 1,  reward: 30,  unlock: [] },
  { id: 'g3',  text: '倉庫のスロットに品物を設定', stat: 'slot_set',     n: 1,  reward: 30,  unlock: [] },
  { id: 'g4',  text: '木材を10個集める',           stat: 'got_wood',     n: 10, reward: 40,  unlock: ['quarry', 'farm'] },
  { id: 'g5',  text: '市場の販売商品を設定',       stat: 'market_set',   n: 1,  reward: 30,  unlock: [] },
  { id: 'g6',  text: '販売で50コイン稼ぐ',         stat: 'earned',       n: 50, reward: 60,  unlock: ['sawmill'] },
  { id: 'g7',  text: '幸福度を60%にする',          stat: 'happyMax',     n: 60, reward: 60,  unlock: ['mason'] },
  { id: 'g8',  text: '板材を5個つくる',            stat: 'got_plank',    n: 5,  reward: 80,  unlock: ['mill'] },
  { id: 'g9',  text: '住民を6人にする',            stat: 'pop',          n: 6,  reward: 100, unlock: ['bakery'] },
  { id: 'g10', text: 'パンを10個つくる',           stat: 'got_bread',    n: 10, reward: 200, unlock: [] },
];
const INITIAL_UNLOCK = ['market', 'house', 'lumber', 'warehouse'];

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

// ---------- 状態 ----------
let S = null;          // セーブ対象の状態
let occ = [];          // マス → 建物id（占有）
const N = CONFIG.MAP;
const idx = (x, y) => y * N + x;
const inMap = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function newGame() {
  const r = rng(Date.now() & 0xffff);
  const tiles = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let res = null;
    const v = r();
    if (v < 0.22) res = { t: 'wood', amt: 60 + Math.floor(r() * 40), max: 100 };
    else if (v < 0.34) res = { t: 'stone', amt: 50 + Math.floor(r() * 50), max: 100 };
    else if (v < 0.44) res = { t: 'wheat', amt: 40 + Math.floor(r() * 60), max: 100 };
    tiles.push({ unl: false, res });
  }
  const c = Math.floor(N / 2), h = Math.floor(CONFIG.START_AREA / 2);
  for (let y = c - h; y <= c + h; y++) for (let x = c - h; x <= c + h; x++) tiles[idx(x, y)].unl = true;
  // 中央付近に必ず少し資源があるようにする
  const ensure = [[c - 2, c - 2, 'wood'], [c + 2, c - 2, 'wood'], [c - 2, c + 2, 'stone'], [c + 2, c + 2, 'wheat'], [c, c - 2, 'wood']];
  for (const [x, y, t] of ensure) tiles[idx(x, y)].res = { t, amt: 80, max: 100 };
  tiles[idx(c - 1, c)].res = null; tiles[idx(c + 1, c)].res = null; tiles[idx(c, c)].res = null;

  S = {
    v: 3, coins: CONFIG.START_COINS, pop: CONFIG.START_POP, happy: 0, demand: {},
    tiles, buildings: [], nextId: 1, order: 1,
    slots: [], unlocked: [...INITIAL_UNLOCK], lastTab: 'gather',
    stats: { built_lumber: 0, built_quarry: 0, built_market: 0, got_wood: 0, got_plank: 0, got_bread: 0, earned: 0, happyMax: 0, slot_set: 0, market_set: 0 },
    goal: 0, goalClaimed: false,
    t: 0, timers: { transfer: 0, refill: 0, regen: 0, grow: 0 },
    lastSave: Date.now(),
  };
  addBuilding('warehouse', c - 1, c, true);
  addBuilding('house', c + 1, c, true);
}

// ---------- 建物 ----------
function makeBuilding(type, x, y) {
  const d = BUILD[type];
  const b = { id: S.nextId++, type, x, y, order: S.order++, workers: 0 };
  if (d.kind === 'gather') { b.inv = { out: 0 }; b.prog = 0; }
  if (d.kind === 'prod') { b.recipe = d.recipes[0]; b.inv = { a: 0, b: 0, out: 0 }; b.prog = 0; b.active = false; b.pending = {}; }
  if (d.kind === 'market') { b.items = [null, null, null, null, null]; b.stock = {}; b.prog = 0; }
  return b;
}
function addBuilding(type, x, y, free) {
  const b = makeBuilding(type, x, y);
  S.buildings.push(b);
  if (BUILD[type].kind === 'warehouse') for (let i = 0; i < CONFIG.SLOTS_PER_WH; i++) S.slots.push({ cfg: null, item: null, qty: 0 });
  rebuildOcc();
  if (!free) { const k = 'built_' + type; if (k in S.stats) S.stats[k]++; }
  return b;
}
function rebuildOcc() {
  occ = new Array(N * N).fill(null);
  for (const b of S.buildings) forTiles(b.type, b.x, b.y, (x, y) => { occ[idx(x, y)] = b.id; });
}
function forTiles(type, x, y, fn) { const s = BUILD[type].size; for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) fn(x + dx, y + dy); }
function getB(id) { return S.buildings.find(b => b.id === id); }
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
function canAfford(cost) {
  if ((cost.coins || 0) > S.coins) return false;
  for (const k in cost) if (k !== 'coins' && whCount(k) < cost[k]) return false;
  return true;
}
function payCost(cost) {
  S.coins -= cost.coins || 0;
  for (const k in cost) if (k !== 'coins') whTake(k, cost[k]);
}

// レシピ材料の対応（材料A/B）
function recipeMats(b) { return Object.keys(RECIPES[b.recipe].need); }

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
function unlockedItems() {
  const set = new Set();
  for (const t of S.unlocked) { const d = BUILD[t]; if (d.kind === 'gather') set.add(d.res); if (d.kind === 'prod') d.recipes.forEach(r => set.add(RECIPES[r].out)); }
  return Object.keys(ITEMS).filter(k => set.has(k));
}
function putSlot(s, item, n) { const room = CONFIG.SLOT_CAP - s.qty; const k = Math.min(room, n); if (k > 0) { s.item = item; s.qty += k; } return k; }
function whTake(item, qty) {
  let left = qty;
  for (let i = S.slots.length - 1; i >= 0 && left > 0; i--) {
    const s = S.slots[i]; if (s.item !== item || s.qty === 0) continue;
    const k = Math.min(s.qty, left); s.qty -= k; left -= k; if (s.qty === 0) s.item = null;
  }
  return qty - left;
}

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
  while (S.timers.refill >= CONFIG.REFILL_SEC) { S.timers.refill -= CONFIG.REFILL_SEC; doRefill(); doMarketRefill(); }
  // 需要：届いた商品は消費時間をかけて100%→0%に減る
  for (const k in S.demand) { if (S.demand[k] > 0) S.demand[k] = Math.max(0, S.demand[k] - dt / ITEMS[k].consume * 100); }
  // 幸福度 = 消費中（ゲージ>0）の商品の種類 / 解放済みの商品の種類
  const ul = unlockedItems();
  const sup = ul.filter(k => (S.demand[k] || 0) > 0).length;
  S.happy = ul.length ? Math.round(sup / ul.length * 100) : 0;
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
    b.prog += dt * b.workers / CONFIG.PROD_SEC;
    if (b.prog >= 1) { b.prog = 0; tgt.amt--; b.inv.out++; }
  } else if (d.kind === 'prod') {
    if (b.workers === 0) return;
    const r = RECIPES[b.recipe];
    if (!b.active) {
      if (b.inv.out >= CONFIG.INV_CAP) return;
      const mats = Object.keys(r.need);
      const has = mats.every((m, i) => b.inv[i === 0 ? 'a' : 'b'] >= r.need[m]);
      if (!has) return;
      mats.forEach((m, i) => { b.inv[i === 0 ? 'a' : 'b'] -= r.need[m]; });
      b.active = true; b.prog = 0;
    }
    b.prog += dt * b.workers / CONFIG.PROD_SEC;
    if (b.prog >= 1) { b.prog = 0; b.active = false; b.inv.out++; }
  } else if (d.kind === 'market') {
    if (b.workers === 0 || S.pop === 0) { b.prog = 0; return; }
    if (!marketTarget(b)) return;
    b.prog += dt * b.workers / CONFIG.PROD_SEC;
    if (b.prog >= 1) {
      b.prog = 0;
      const it = marketTarget(b); if (!it) return;
      b.stock[it]--;
      const p = ITEMS[it].price; S.coins += p; S.stats.earned += p; if (acc) acc.coins += p;
      S.demand[it] = 100;
    }
  }
}

// 配達対象：在庫があり需要ゲージが閾値未満の商品のうち、残りが最も少ないもの。同率はランダム
function marketTarget(b) {
  const cands = b.items.filter(i => i && (b.stock[i] || 0) > 0 && (S.demand[i] || 0) < CONFIG.DELIVER_BELOW);
  if (!cands.length) return null;
  const min = Math.min(...cands.map(i => Math.round(S.demand[i] || 0)));
  const low = cands.filter(i => Math.round(S.demand[i] || 0) === min);
  return low[Math.floor(Math.random() * low.length)];
}
// 採集対象：範囲5×5内で最も近い資源。同距離は上→右→下→左
function gatherTarget(b) {
  const res = BUILD[b.type].res;
  let best = null, bestD = 1e9, bestP = 9;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
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
    if (b.inv.out > 0) {
      const item = BUILD[b.type].kind === 'gather' ? BUILD[b.type].res : RECIPES[b.recipe].out;
      const n = whAdd(item, b.inv.out);
      b.inv.out -= n;
      if (n) { const k = 'got_' + item; if (k in S.stats) S.stats[k] += n; if (acc) acc.items[item] = (acc.items[item] || 0) + n; }
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
      if (!cands.length || whCount(m) === 0) break;
      cands.sort((p, q) => (p.b.inv[p.key] - q.b.inv[q.key]) || (p.b.order - q.b.order));
      if (whTake(m, 1) === 0) break;
      cands[0].b.inv[cands[0].key]++;
    }
  }
}
function doMarketRefill() {
  for (const b of S.buildings) {
    if (BUILD[b.type].kind !== 'market') continue;
    for (const it of b.items) { if (!it) continue; const cur = b.stock[it] || 0; const need = CONFIG.INV_CAP - cur; if (need > 0) b.stock[it] = cur + whTake(it, need); }
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
      else { whAdd(RECIPES[b.recipe].out, b.inv.out); recipeMats(b).forEach((m, i) => whAdd(m, b.inv[i === 0 ? 'a' : 'b'])); for (const k in b.pending) whAdd(k, b.pending[k]); }
    }
    if (b.stock) for (const k in b.stock) whAdd(k, b.stock[k]);
    S.buildings = S.buildings.filter(x => x !== b); rebuildOcc();
  }
  S.coins += d.cost.coins || 0; // コインは返金、材料は返却しない
}
function changeRecipe(b, rid) {
  if (b.recipe === rid) return;
  const old = recipeMats(b);
  old.forEach((m, i) => { const k = i === 0 ? 'a' : 'b'; const q = b.inv[k]; b.inv[k] = 0; if (q) { const left = q - whAdd(m, q); if (left) b.pending[m] = (b.pending[m] || 0) + left; } });
  b.recipe = rid; b.active = false; b.prog = 0;
}

// ---------- 土地開放 ----------
function unlockedCount() { return S.tiles.filter(t => t.unl).length; }
function landPrice() { return CONFIG.LAND_BASE + CONFIG.LAND_STEP * (unlockedCount() - CONFIG.START_AREA * CONFIG.START_AREA); }
function canUnlock(x, y) {
  if (!inMap(x, y) || S.tiles[idx(x, y)].unl) return false;
  return [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => inMap(x + dx, y + dy) && S.tiles[idx(x + dx, y + dy)].unl);
}

// ---------- セーブ ----------
function save() { S.lastSave = Date.now(); try { localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
function load() {
  try { const j = localStorage.getItem(CONFIG.SAVE_KEY); if (!j) return false; S = JSON.parse(j); rebuildOcc(); return true; } catch (e) { return false; }
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
  const rows = name === 'villager' ? VILL : SPR[name], n = rows.length;
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
    const [rx, ry] = toScreen((UI.sel.x - 2) * T, (UI.sel.y - 2) * T);
    ctx.fillStyle = 'rgba(255,255,120,.25)'; ctx.fillRect(rx, ry, ts * 5, ts * 5);
    ctx.strokeStyle = 'rgba(255,230,80,.9)'; ctx.lineWidth = 2; ctx.strokeRect(rx, ry, ts * 5, ts * 5);
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
  // 霧（未開放）：隣接マスは明るめ＋「＋」、それ以外は暗い霧
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const t = S.tiles[idx(x, y)]; if (t.unl) continue;
    const sx = ox + x * ts, sy = oy + y * ts; if (sx + ts < 0 || sy + ts < 0 || sx > W || sy > H) continue;
    const edge = canUnlock(x, y);
    if (edge) {
      ctx.fillStyle = 'rgba(235,245,255,.55)'; ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.strokeRect(sx + 2, sy + 2, ts - 4, ts - 4); ctx.setLineDash([]);
      const r = ts * 0.22; ctx.fillStyle = '#f0b63c'; ctx.beginPath(); ctx.arc(sx + ts / 2, sy + ts / 2, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a2e00'; ctx.font = `bold ${Math.max(10, ts * 0.36)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', sx + ts / 2, sy + ts / 2 + 1);
    } else {
      ctx.fillStyle = ((x + y) & 1) ? 'rgba(90,110,130,.82)' : 'rgba(80,100,120,.82)'; ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
    }
    if (UI.land && UI.land[0] === x && UI.land[1] === y) { ctx.strokeStyle = '#ff6a00'; ctx.lineWidth = 4; ctx.strokeRect(sx + 2, sy + 2, ts - 4, ts - 4); }
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
function drawVillagers(ox, oy, ts) {
  while (villagers.length < S.pop) { const c = Math.floor(N / 2); villagers.push({ x: c + Math.random(), y: c + Math.random(), tx: c, ty: c, wait: 0 }); }
  villagers.length = Math.min(villagers.length, S.pop);
  for (const v of villagers) {
    if (v.wait > 0) v.wait -= 1 / 60; else {
      const dx = v.tx - v.x, dy = v.ty - v.y, d = Math.hypot(dx, dy);
      if (d < 0.05) { v.wait = 1 + Math.random() * 3; let tries = 10; while (tries--) { const nx = Math.floor(v.x) + Math.floor(Math.random() * 7) - 3, ny = Math.floor(v.y) + Math.floor(Math.random() * 7) - 3; if (inMap(nx, ny) && S.tiles[idx(nx, ny)].unl && !occ[idx(nx, ny)]) { v.tx = nx + 0.5; v.ty = ny + 0.5; break; } } }
      else { v.x += dx / d * 0.02; v.y += dy / d * 0.02; }
    }
    const sx = ox + v.x * ts, sy = oy + v.y * ts, vs = ts * 0.5;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(sx, sy + vs * 0.4, vs * 0.25, vs * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(sprite('villager'), sx - vs * 0.25, sy - vs * 0.45, vs, vs);
  }
}

// ============================================================
//  入力（パン・ズーム・タップ）
// ============================================================
const ptrs = new Map(); let pinch0 = null, tapInfo = null;
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) tapInfo = { x: e.clientX, y: e.clientY, moved: false, t: Date.now() };
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), s: cam.s }; tapInfo = null; }
});
cv.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  const p = ptrs.get(e.pointerId);
  if (ptrs.size === 1) {
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (tapInfo && Math.hypot(e.clientX - tapInfo.x, e.clientY - tapInfo.y) > 8) tapInfo.moved = true;
    if (!tapInfo || tapInfo.moved) { cam.x -= dx / cam.s; cam.y -= dy / cam.s; }
  } else if (ptrs.size === 2 && pinch0) {
    p.x = e.clientX; p.y = e.clientY;
    const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
    cam.s = Math.max(0.6, Math.min(5, pinch0.s * d / pinch0.d));
  }
  p.x = e.clientX; p.y = e.clientY;
  clampCam();
});
function endPtr(e) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch0 = null;
  if (ptrs.size === 0 && tapInfo && !tapInfo.moved) onTap(e.clientX, e.clientY);
  if (ptrs.size === 0) tapInfo = null;
}
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
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
  if (!t.unl) { if (canUnlock(x, y)) { UI.land = [x, y]; closeAll(false); openLand(); } else closeAll(); return; }
  const id = occ[idx(x, y)];
  if (id) { UI.sel = getB(id); closeAll(false); openInfo(); }
  else { closeAll(); if (t.res) toast(`${ITEMS[t.res.t].name} ${t.res.amt}/${t.res.max}`); }
}

// ============================================================
//  UI パネル
// ============================================================
const $ = id => document.getElementById(id);
const panels = ['buildmenu', 'placepanel', 'infopanel', 'landpanel', 'storepanel', 'goalpanel', 'peoplepanel'];
function closeAll(resetSel = true) { panels.forEach(p => $(p).classList.add('hidden')); if (resetSel) { UI.sel = null; UI.land = null; } }
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { $(b.dataset.close).classList.add('hidden'); if (b.dataset.close === 'infopanel') UI.sel = null; if (b.dataset.close === 'landpanel') UI.land = null; }));
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 1800); }
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
    const nm = k === 'coins' ? '🪙 コイン' : ITEMS[k].name, have = k === 'coins' ? S.coins : whCount(k);
    const ng = check && have < cost[k];
    h += `<div class="line"><span class="lbl">${nm}</span><span class="val ${ng ? 'red' : ''}">${cost[k]}${check ? ` <small>(所持 ${have})</small>` : ''}</span></div>`;
  }
  return h;
}
function iconCanvas(type) { const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.getContext('2d').drawImage(sprite(type), 0, 0); return c; }

// --- 建築メニュー ---
$('btn-build').addEventListener('click', () => { if (UI.mode !== 'normal') return; closeAll(); openBuildMenu(); });
function openBuildMenu() {
  const tabs = $('build-tabs'); tabs.innerHTML = '';
  for (const c of CATS) { const b = document.createElement('button'); b.className = 'tab' + (S.lastTab === c.id ? ' active' : ''); b.textContent = c.name; b.onclick = () => { S.lastTab = c.id; openBuildMenu(); }; tabs.appendChild(b); }
  const list = $('build-list'); list.innerHTML = '';
  for (const type in BUILD) {
    const d = BUILD[type]; if (d.cat !== S.lastTab || !S.unlocked.includes(type)) continue;
    const full = !d.nolimit && countType(type) >= CONFIG.MAX_SAME;
    const el = document.createElement('div'); el.className = 'bitem' + (full ? ' disabled' : '');
    el.appendChild(iconCanvas(type));
    el.insertAdjacentHTML('beforeend', `<div>${d.name}${d.size === 2 ? '<br><small>2×2</small>' : ''}</div><div class="bcost">🪙${d.cost.coins || 0}${full ? '<br>上限' : ''}</div>`);
    let lp = null, fired = false, p0 = null;
    el.addEventListener('pointerdown', e => { fired = false; p0 = [e.clientX, e.clientY]; lp = setTimeout(() => { fired = true; showDetail(type); }, 500); });
    el.addEventListener('pointermove', e => { if (p0 && Math.hypot(e.clientX - p0[0], e.clientY - p0[1]) > 10) { clearTimeout(lp); fired = true; } });
    el.addEventListener('pointercancel', () => { clearTimeout(lp); fired = true; });
    el.addEventListener('pointerup', () => { clearTimeout(lp); if (!fired && !full) startPlace(type); });
    el.addEventListener('contextmenu', e => e.preventDefault());
    list.appendChild(el);
  }
  $('buildmenu').classList.remove('hidden');
}
function showDetail(type) {
  const d = BUILD[type];
  let extra = '';
  if (d.kind === 'prod') extra += `<div>レシピ: ${d.recipes.map(r => `${Object.entries(RECIPES[r].need).map(([k, v]) => ITEMS[k].name + v).join('＋')} → ${ITEMS[RECIPES[r].out].name}1`).join(' / ')}</div>`;
  modal(d.name, `<div>${d.desc}</div>${extra}<div style="margin-top:8px"><b>建築費用</b>${costHtml(d.cost, false)}</div><div class="hint">同種は島全体で${d.nolimit ? '無制限' : CONFIG.MAX_SAME + '棟まで'}（現在 ${countType(type)}）</div>`);
}
function startPlace(type) {
  UI.mode = 'place'; UI.placeType = type; UI.sel = null;
  const c = Math.round(cam.x / T), r = Math.round(cam.y / T), s = BUILD[type].size;
  UI.px = Math.max(0, Math.min(N - s, c)); UI.py = Math.max(0, Math.min(N - s, r));
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
  $('place-title').textContent = `${d.name} を移動（タップで移動先を選択）`;
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
  $('info-title').textContent = d.name;
  let h = '';
  const workersLine = () => `<div class="line"><span class="lbl">作業員 ${b.workers}/${CONFIG.MAX_WORKERS}人</span><button class="btn small" id="w-minus" ${b.workers === 0 ? 'disabled' : ''}>－</button><button class="btn small" id="w-plus" ${(b.workers >= CONFIG.MAX_WORKERS || freeWorkers() <= 0) ? 'disabled' : ''}>＋</button></div>`;
  if (d.kind === 'gather') {
    const tgt = gatherTarget(b);
    const sum = (() => { let a = 0, m = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = b.x + dx, y = b.y + dy; if (!inMap(x, y)) continue; const t = S.tiles[idx(x, y)]; if (t.unl && t.res && t.res.t === d.res && !occ[idx(x, y)]) { a += t.res.amt; m += t.res.max; } } return [a, m]; })();
    h += `<div class="line"><span class="lbl">対象資源</span><span class="val">${ITEMS[d.res].name}</span></div>`;
    h += `<div class="line"><span class="lbl">範囲内の資源量</span><span class="val">${sum[0]}/${sum[1]}${tgt ? '' : ' <small>(採集できる資源なし)</small>'}</span></div>`;
    h += workersLine();
    h += `<div class="line"><span class="lbl">採集速度</span><span class="val">${b.workers ? (CONFIG.PROD_SEC / b.workers).toFixed(0) + '秒/個' : '停止'}</span></div>`;
    h += `<div class="line"><span class="lbl">採集範囲</span><span class="val">5×5マス</span></div>`;
    h += gaugeLine(`完成品 ${ITEMS[d.res].name}`, b.inv.out, CONFIG.INV_CAP);
  } else if (d.kind === 'prod') {
    const r = RECIPES[b.recipe], mats = Object.keys(r.need);
    h += `<div class="line"><span class="lbl">レシピ</span><button class="recipe-btn" id="recipe-btn">${mats.map(m => ITEMS[m].name + r.need[m]).join('＋')} → ${ITEMS[r.out].name}</button></div>`;
    h += workersLine();
    h += gaugeLine('生産進捗', b.active ? b.prog * 100 : 0, 100, 'prog');
    h += gaugeLine(ITEMS[mats[0]].name, b.inv.a, CONFIG.INV_CAP);
    if (mats[1]) h += gaugeLine(ITEMS[mats[1]].name, b.inv.b, CONFIG.INV_CAP);
    h += gaugeLine(`完成品 ${ITEMS[r.out].name}`, b.inv.out, CONFIG.INV_CAP);
  } else if (d.kind === 'market') {
    h += workersLine();
    h += gaugeLine('配送進捗', b.prog * 100, 100, 'prog');
    const ul = unlockedItems(), sup = ul.filter(k => (S.demand[k] || 0) > 0);
    h += `<div class="line"><span class="lbl">届いている商品</span><span class="val">${sup.length}/${ul.length}種 (😊${S.happy}%)</span></div>`;
    h += `<div class="hint" style="text-align:left">販売商品（タップで変更）。需要ゲージが${CONFIG.DELIVER_BELOW}%を切った商品から配達します</div>`;
    b.items.forEach((it, i) => {
      const dm = it ? Math.round(S.demand[it] || 0) : 0;
      h += `<div class="line"><span class="lbl"><button class="recipe-btn mk-item" data-i="${i}">${it ? ITEMS[it].name : '（なし）'}</button></span>` +
        (it ? `<div class="gauge dem"><div style="width:${dm}%"></div></div><span class="val">${dm}%　在庫${b.stock[it] || 0}　🪙${ITEMS[it].price}</span>` : '') + `</div>`;
    });
  } else if (d.kind === 'house') {
    h += `<div class="line"><span class="lbl">住める人数</span><span class="val">${CONFIG.HOUSE_CAP}人</span></div><div class="line"><span class="lbl">島の人口</span><span class="val">${S.pop}/${countType('house') * CONFIG.HOUSE_CAP}人</span></div><div class="hint" style="text-align:left">幸福度${CONFIG.HAPPY_MIN_FOR_GROW}%以上で${CONFIG.POP_GROW_SEC}秒ごとに1人増えます</div>`;
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
  document.querySelectorAll('.mk-item').forEach(el => el.onclick = () => pickMarketItem(b, +el.dataset.i));
  const as = $('a-store'); if (as) as.onclick = () => { $('infopanel').classList.add('hidden'); storeTab = 'slots'; openStore(); };
  $('a-move').onclick = () => { UI.mode = 'move'; UI.moveB = b; UI.px = b.x; UI.py = b.y; $('infopanel').classList.add('hidden'); showMovePanel(); };
  $('a-demo').onclick = () => {
    let note = `<div>${d.name}を取り壊します。</div><div>🪙 ${d.cost.coins || 0} を返金します（建築に使った材料は戻りません）。</div>`;
    if (b.workers) note += `<div>作業員 ${b.workers}人は未割り当てに戻ります。</div>`;
    if (b.inv || b.stock) note += `<div>施設内の在庫は倉庫へ返却し、入りきらない分は破棄されます。</div>`;
    modal('取り壊しの確認', note, () => { demolish(b); UI.sel = null; $('infopanel').classList.add('hidden'); toast(`${d.name}を取り壊しました`); save(); }, true);
  };
}
function pickRecipe(b) {
  const list = BUILD[b.type].recipes;
  if (list.length === 1) { toast('このレシピのみです'); return; }
  let h = '';
  for (const r of list) { const rc = RECIPES[r]; h += `<div class="line"><button class="recipe-btn pick" data-r="${r}">${Object.entries(rc.need).map(([k, v]) => ITEMS[k].name + v).join('＋')} → ${ITEMS[rc.out].name}</button></div>`; }
  modal('レシピを選択', h);
  document.querySelectorAll('.pick').forEach(el => el.onclick = () => { changeRecipe(b, el.dataset.r); $('modal').classList.add('hidden'); renderInfo(); });
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
  h += `<div class="sub">😊 幸福度 ${S.happy}%　<small>作れる商品 ${ul.length}種のうち 届いている ${ul.filter(k => (S.demand[k] || 0) > 0).length}種</small></div>`;
  h += `<div class="chips">` + ul.map(k => { const d = Math.round(S.demand[k] || 0); return `<span class="chip ${d > 0 ? 'on' : ''}">${ITEMS[k].name} ${d}%</span>`; }).join('') + `</div>`;
  h += `<div class="sub">作業員の割り当て</div>`;
  const work = S.buildings.filter(b => b.workers !== undefined && ['gather', 'prod', 'market'].includes(BUILD[b.type].kind)).sort((a, b) => a.order - b.order);
  if (!work.length) h += `<div class="hint">まだ作業できる施設がありません</div>`;
  for (const b of work) {
    const d = BUILD[b.type];
    const what = d.kind === 'gather' ? ITEMS[d.res].name : d.kind === 'prod' ? ITEMS[RECIPES[b.recipe].out].name : '配達';
    h += `<div class="line"><span class="lbl"><a class="jump" data-id="${b.id}">${d.name}</a> <small>${what}</small></span><span class="val">${b.workers}人</span><button class="btn small pw-minus" data-id="${b.id}" ${b.workers === 0 ? 'disabled' : ''}>－</button><button class="btn small pw-plus" data-id="${b.id}" ${(b.workers >= CONFIG.MAX_WORKERS || freeWorkers() <= 0) ? 'disabled' : ''}>＋</button></div>`;
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
    if (d.kind === 'prod') { add(RECIPES[b.recipe].out, 'fac', b.inv.out); recipeMats(b).forEach((m, i) => add(m, 'fac', b.inv[i === 0 ? 'a' : 'b'])); for (const k in b.pending) add(k, 'fac', b.pending[k]); }
    if (d.kind === 'market') for (const k in b.stock) add(k, 'mk', b.stock[k]);
  }
  return o;
}
function renderItems() {
  const o = islandItems(), el = $('store-items'); let h = '';
  for (const k of Object.keys(ITEMS)) {
    const v = o[k]; if (!v && !unlockedItems().includes(k)) continue;
    const t = v ? v.wh + v.fac + v.mk : 0;
    h += `<div class="line"><span class="lbl"><b>${ITEMS[k].name}</b> <small>🪙${ITEMS[k].price}</small></span><span class="val"><b>${t}</b> <small>倉庫${v ? v.wh : 0}・施設${v ? v.fac : 0}・市場${v ? v.mk : 0}</small></span></div>`;
  }
  el.innerHTML = h || '<div class="hint">まだ品物がありません</div>';
}
function slotHtml(s) {
  const cfgName = s.cfg === 'block' ? '🚫' : s.cfg ? ITEMS[s.cfg].name : '未設定';
  const col = s.item ? (ITEMS[s.item].color === '#f2eee0' ? '#999' : ITEMS[s.item].color) : '#bbb';
  return `<div class="sq" style="color:${col}">${s.item ? ITEMS[s.item].name : '－'}</div><div>${s.qty}/${CONFIG.SLOT_CAP}</div><div class="cfg">設定: ${cfgName}</div>`;
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
    sel.innerHTML = `<option value="">未設定</option>` + unlockedItems().map(k => `<option value="${k}">${ITEMS[k].name}</option>`).join('') + `<option value="block">🚫 搬入停止</option>`;
    sel.value = s.cfg || '';
    sel.onchange = () => { s.cfg = sel.value === '' ? null : sel.value; if (s.cfg && s.cfg !== 'block') S.stats.slot_set++; info.innerHTML = slotHtml(s); save(); };
    d.appendChild(sel); el.appendChild(d);
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
  $('land-ok').onclick = () => { const [x, y] = UI.land; if (S.coins >= p && canUnlock(x, y)) { S.coins -= p; S.tiles[idx(x, y)].unl = true; UI.land = null; $('landpanel').classList.add('hidden'); toast('土地を開放しました'); save(); } };
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
  $('goal-body').innerHTML = `<div class="goal"><div class="gt">${S.goal + 1}. ${g.text}</div><div class="gr">進捗 ${p} / ${g.n}　報酬 🪙${g.reward}${g.unlock.length ? '　解放: ' + g.unlock.map(u => BUILD[u].name).join('・') : ''}</div><div class="row"><button class="btn primary" id="goal-claim" ${done ? '' : 'disabled'}>獲得</button></div></div>`;
  $('goal-claim').onclick = () => { if (goalProgress(g) < g.n) return; S.coins += g.reward; for (const u of g.unlock) if (!S.unlocked.includes(u)) S.unlocked.push(u); S.goal++; toast(`目標達成！ 🪙${g.reward} 獲得`); save(); renderGoal(); };
}

// --- 上部バー ---
function renderTop() {
  $('st-coins').querySelector('span').textContent = S.coins;
  $('st-pop').querySelector('span').textContent = S.pop;
  $('st-free').querySelector('span').textContent = freeWorkers();
  $('st-happy').querySelector('span').textContent = Math.round(S.happy) + '%';
  const g = GOALS[S.goal];
  $('btn-goal').textContent = (g && goalProgress(g) >= g.n) ? '🎁' : '🎯';
}

// ============================================================
//  起動・ループ
// ============================================================
function showWelcome() {
  modal('のんびり島ぐらしへようこそ', '<div>小さな島をのんびり育てる経営ゲームです。</div><div>・下の「🔨 建築」から施設を建てられます<br>・施設をタップして作業員を割り当てましょう<br>・霧の「＋」マスをタップすると土地を開放できます<br>・🎯 の目標を進めると新しい施設が解放されます<br>・倉庫のスロットと市場の販売商品は自分で設定します<br>・😊 は「住民に届いている商品の種類」の割合です。60%以上で人口が増えます</div>');
}
function resetGame() {
  modal('最初からやり直す', '<div>今の島のデータを消して、新しい島を始めます。元には戻せません。</div>', () => {
    try { localStorage.removeItem(CONFIG.SAVE_KEY); } catch (e) { }
    newGame(); villagers.length = 0; UI.mode = 'normal'; UI.sel = null; closeAll();
    cam.x = T * N / 2; cam.y = T * N / 2; save(); showWelcome();
  }, true);
}
function start() {
  resize();
  const loaded = load();
  if (!loaded) newGame();
  cam.x = T * N / 2; cam.y = T * N / 2;
  cam.s = Math.max(1, Math.min(4, (W - 16) / (T * 7)));
  if (!loaded) showWelcome();
  let last = performance.now(), saveT = 0, uiT = 0;
  function loop(now) {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    sim(dt, null);
    draw(); renderTop();
    uiT += dt; if (uiT > 0.5) { uiT = 0; if (!$('infopanel').classList.contains('hidden')) renderInfo(); if (!$('storepanel').classList.contains('hidden')) updateStore(); if (!$('goalpanel').classList.contains('hidden')) renderGoal(); if (!$('peoplepanel').classList.contains('hidden')) renderPeople(); }
    saveT += dt; if (saveT > 5) { saveT = 0; save(); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else last = performance.now(); });
  window.addEventListener('pagehide', save);
}
start();
