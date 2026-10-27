'use strict';
/* ============================================================
   のんびり島ぐらし  v0.20（倉庫廃止・共通インベントリ・満足度・島レベル）
   仕様：NonbiriIsland/spec-v0.20.md / spec-v0.20-stage1.md
   仮置きの数値は CONFIG にまとめる。
   ============================================================ */

const VERSION = '0.26.0';   // 画面左下と ⚙️ に表示。更新時はここを上げる

// ---------- 調整用の定数 ----------
const CONFIG = {
  MAP: 23,              // 23×23 のマスの中に、丸い島を置く（島の外は海）
  CORE: 4,              // 資源を置く15×15の区画の左上（(23-15)/2）
  ISLAND: { a: 9.4, b: 8.0, wobble: 0.05 },    // 島の形：横・縦の半径（マス幅）と、縁のでこぼこ。陸は約275マス（前の四角い島は225マス）。陸の外側1マスが砂浜（海岸）
  HEX: true,            // マスの形：true＝六角形（ハニカム。奇数行が半マス右にずれる）、false＝四角
  TILE: 32,             // ワールド座標の1マスのピクセル
  START_COINS: 100,
  START_POP: 3,
  START_ITEMS: { wood: 10 },
  MAX_WORKERS: 5,       // 施設1棟あたりの作業員の上限（市場は MARKET.workers）
  OFFLINE_MAX_SEC: 2 * 3600,   // オフラインで進むのは2時間まで
  // ---- 採集 ----
  GATHER_SEC: 10,       // 原材料1個の採集時間（作業員1人）
  TILE_SEC: 1,          // 1マス1秒（採集は資源マスまでの往復、市場は家までの往復）
  GATHER_RANGE: 1,      // 採集範囲：施設の周り8マス
  REGEN_SEC: 10,        // 資源マスの回復（10秒に1個）：木・石も畑と同じ（資源の数を平均化したため。燃料と板材で木が足りなくなる）
  REGEN_SEC_RES: { wheat: 10, orange: 10, cotton: 10, herb: 10 },   // 畑・果樹は早く回復（10秒に1個）。7マスの畑で1分に約42個
  // ---- インベントリ ----
  INV_CAP: 100,         // 1品目の上限
  // ---- 市場 ----
  MARKET: {
    slots: 5, stock: 20,            // 初期 5スロット×20個
    range: 2,                        // 配達範囲：市場の周り5×5マス
    workers: [3, 5],                 // 規模Lvごとの作業員の上限
    upCost: [{ brick: 10, coins: 300 }],   // Lv1→2（島レベル2から）
    upStage: [2],
    handSec: 2,                      // 受け渡しの時間（＋往復 距離×2秒）
  },
  // ---- 住民・満足度 ----
  HOUSE_CAP: 4,         // 住居1棟の定員
  POP_GROW_SEC: 180,    // 人口+1の間隔
  CONSUME_PER_PT: 75,   // 消費時間 = ポイント × 75秒（ゲージ100→0 はこれ × CONSUME_MULT）
  CONSUME_MULT: 1.5,
  CONSUME_TIER_MULT: [1, 1.5, 2.25, 3.4],   // 加工段階ごとの持ちの倍率（案2：加工品1×1.5・加工品2×2.25）
  DELIVER_BELOW: 30,    // 満足度ゲージがこの%を切ったら配達
  TIER_PTS: [2, 4, 8, 12],    // 原材料／加工品1／加工品2／加工品3 の満足度ポイント（最上位は12）
  TIER_PRICE: [2, 4, 8, 12],  // 売値（ポイントと同じ）
  DIFFICULTY: {
    easy:   { name: 'イージー', need: 35 },
    normal: { name: 'ノーマル', need: 45 },
    hard:   { name: 'ハード',   need: 55 },
  },
  RECIPE_COST: 100,
  // レシピの価格：そのレシピが使えるようになる島レベルごと（石レンガ100、小麦粉以降200、次300、次500、次800（仮））
  RECIPE_COST_BY_LV: { 1: 100, 2: 200, 3: 300, 4: 500, 5: 800, 6: 1000, 7: 1000, 8: 1000, 9: 1000 },
  HOUSE_LV1_FROM: 6,    // この島レベルから、新しい住居は最初からレベル1（板材10＋木のベッド4＋1000コイン）
  HOUSE_LV1_COST: { plank: 10, bed: 4, coins: 1000 },
  // ---- 道具のブースト ----
  BOOST_SEC: 180,       // 道具1個＝作業員1人ぶん×3分、作業時間が半分（人数で割って減る）
  BOOST_MAX: 10,        // 1施設に入れられる数
  // ---- 巣箱 ----
  COMB_SEC: 10, COMB_MAX: 100,   // 蜂の巣は10秒に1個（畑と同じ）、上限100
  // ---- 住居・市場の拡張 ----
  HOUSE_UP: [{ bed: 4, coins: 1000 }],       // 住居レベル0→1
  MARKET_SLOT_UP: { cost: { plank: 20, brick: 20 }, slots: 10, stage: 3 },  // 島レベル3から5→10個（作業員は島レベル2から）
  // ---- 島レベル10（やり込み）：コインで強化 ----
  EXTRA: {
    stage: 10,
    inv:     { name: '倉庫の拡張', cost: [5000, 10000, 20000, 40000, 80000], cap: 100, stock: 10 },  // 島全体。1回ごとにインベントリ上限+100、市場の在庫上限+10
    range:   { name: '配達範囲の拡大', cost: [5000, 15000] },                // 市場ごと。1回ごとに配達範囲+1
    dual:    { name: '2つのレシピ', cost: [3000] },                           // 生産施設ごと。2つのレシピを交互に作る
    workers: { name: '作業員の上限アップ', cost: [3000, 6000, 12000] },       // 施設ごと。1回ごとに作業員の上限+1
  },
  SPEEDS: [1, 2, 4, 8], // 時間加速（テスト用）
  DEBUG_SPEED: true,
  SAVE_KEY: 'nonbiri-island-v20',
};
// 範囲の言い方（マスの形で変わる）
const AROUND = CONFIG.HEX ? '周り6マス' : '周り8マス';
const rangeText = R => CONFIG.HEX ? `${R}マス以内（${3 * R * (R + 1)}マス）` : `周り${R * 2 + 1}×${R * 2 + 1}マス`;

// ---------- アイテム ----------
// tier: 0=原材料 1=加工品1 2=加工品2 3=加工品3。cat: 満足度のカテゴリ（food/cloth/luxury）。cat なし＝満足度の対象外（売るだけ・建材）
const ITEMS = {
  wood:   { name: '木材',   color: '#8b5a2b', tier: 0, time: 10 },
  stone:  { name: '石材',   color: '#8a8a8a', tier: 0, time: 10 },
  water:  { name: '水',     color: '#4a90e2', tier: 0, time: 10, cat: 'food' },
  wheat:  { name: '小麦',   color: '#c9a43a', tier: 0, time: 10, cat: 'food' },
  orange: { name: 'オレンジ', color: '#e07a1c', tier: 0, time: 10, cat: 'food' },
  cotton: { name: '綿',     color: '#9a9aa8', tier: 0, time: 10, cat: 'cloth' },   // 島レベル3以降
  plank:  { name: '板材',   color: '#a87a42', tier: 1 },
  brick:  { name: '石レンガ', color: '#b5533c', tier: 1 },
  flour:  { name: '小麦粉', color: '#a89a70', tier: 1, cat: 'food' },
  juice:  { name: 'オレンジジュース', color: '#e8901a', tier: 1, cat: 'food' },
  thread: { name: '糸',     color: '#8a7a9a', tier: 1, cat: 'cloth' },
  axe:     { name: '石のオノ',     color: '#6a6a6a', tier: 1, tool: true },   // 売値は加工品1と同じ
  pickaxe: { name: '石のピッケル', color: '#5a5a6a', tier: 1, tool: true },
  scissors:{ name: '石のハサミ',   color: '#6a7a5a', tier: 1, tool: true },
  bread:  { name: 'パン',   color: '#c07a2a', tier: 2, cat: 'food' },
  honey:  { name: 'ハチミツ', color: '#d89a10', tier: 0, time: 10, cat: 'luxury' },   // 養蜂場で巣箱から採る
  polish: { name: '磨き石', color: '#7a8a9a', tier: 1, cat: 'luxury' },
  jam:    { name: 'オレンジジャム', color: '#d8601a', tier: 2, cat: 'luxury' },
  cloth:  { name: '布',     color: '#9a7aaa', tier: 2, cat: 'cloth' },
  bed:    { name: '木のベッド', color: '#8a5a3a', tier: 3 },   // 住居のアップグレードの材料
  obread: { name: 'オレンジパン', color: '#d07a20', tier: 3, cat: 'food' },
  clothes:{ name: '服',     color: '#b05080', tier: 3, cat: 'cloth' },
  shine:  { name: '輝き石', color: '#5a9ab8', tier: 3, cat: 'luxury' },
  herb:   { name: 'ハーブ', color: '#4a9a4a', tier: 0, time: 10, cat: 'hygiene' },
  oint:   { name: '軟膏',   color: '#6aa08a', tier: 1, cat: 'hygiene' },
  tea:    { name: 'ハーブ茶', color: '#6a8a3a', tier: 2, cat: 'hygiene' },
  comp:   { name: '湿布',   color: '#7a9aa0', tier: 3, cat: 'hygiene' },
};
const CATS_SAT = { food: '食', cloth: '衣', luxury: '贅沢品', hygiene: '衛生' };
// buy: true はコインで購入が必要（CONFIG.RECIPE_COST）。fuel は燃料（表示用。作業時間には加える）
const RECIPES = {
  plank: { out: 'plank', need: { wood: 2 } },
  brick: { out: 'brick', need: { stone: 2 }, buy: true },
  flour: { out: 'flour', need: { wheat: 2 }, buy: true },
  juice: { out: 'juice', need: { orange: 1, water: 1 }, buy: true },
  thread:  { out: 'thread',  need: { cotton: 2 }, buy: true },
  axe:     { out: 'axe',     need: { wood: 1, stone: 1 }, buy: true },
  pickaxe: { out: 'pickaxe', need: { wood: 1, stone: 1 }, buy: true },
  scissors:{ out: 'scissors', need: { wood: 1, stone: 1 }, buy: true },
  bread:   { out: 'bread',   need: { flour: 1, water: 1, wood: 1 }, fuel: 'wood', buy: true },
  cloth:   { out: 'cloth',   need: { thread: 2 }, buy: true },
  polish:  { out: 'polish',  need: { stone: 1, water: 1 }, buy: true },
  jam:     { out: 'jam',     need: { juice: 1, honey: 1, wood: 1 }, fuel: 'wood', buy: true },
  bed:     { out: 'bed',     need: { plank: 5 }, buy: true },
  obread:  { out: 'obread',  need: { flour: 1, orange: 1, water: 1, honey: 1, wood: 1 }, fuel: 'wood', buy: true },
  clothes: { out: 'clothes', need: { thread: 1, cloth: 1 }, buy: true },
  shine:   { out: 'shine',   need: { polish: 2, water: 2 }, buy: true },
  oint:    { out: 'oint',    need: { herb: 1, water: 1 }, buy: true },
  tea:     { out: 'tea',     need: { herb: 1, water: 1, honey: 1, wood: 1 }, fuel: 'wood', buy: true },
  comp:    { out: 'comp',    need: { oint: 1, cloth: 1 }, buy: true },
};
(function initItems() {
  const byOut = {}; for (const id in RECIPES) byOut[RECIPES[id].out] = RECIPES[id];
  const calc = k => {
    const it = ITEMS[k];
    if (it.time === undefined) { const r = byOut[k]; let t = 0; for (const m in r.need) t += calc(m).time * r.need[m]; it.time = t; }
    it.pts = it.cat ? CONFIG.TIER_PTS[it.tier] : 0;
    it.price = CONFIG.TIER_PRICE[it.tier];
    it.consume = it.pts * CONFIG.CONSUME_PER_PT * (CONFIG.CONSUME_TIER_MULT[it.tier] || 1);
    return it;
  };
  for (const k in ITEMS) calc(k);
})();
// 資源マス（t はそこから採れるアイテム。花畑は巣箱を隣に置く）
const RES_NAMES = { honey: '巣箱の蜂の巣', wood: '木', stone: '石', wheat: '小麦畑', orange: 'オレンジの木', cotton: '綿花畑', flower: '花畑', herb: 'ハーブ' };
const RES_SPR = { wood: 'tree', stone: 'rock', wheat: 'wheat', orange: 'orangetree', cotton: 'cotton', flower: 'flower', herb: 'herb' };
function resName(t) { return RES_NAMES[t] || (ITEMS[t] && ITEMS[t].name) || t; }

// ---------- 施設 ----------
// kind: gather（採集）/ prod（生産）/ market / house。res: 採る品（collect は選択）。noTile: 資源マス不要（井戸）
const CATS = [
  { id: 'gather', name: '採集' },
  { id: 'prod',   name: '生産' },
  { id: 'home',   name: '暮らし' },
];
const BUILD = {
  lumber:  { name: '伐採所', cat: 'gather', kind: 'gather', res: 'wood', cost: { wood: 10 }, tool: 'axe', desc: AROUND + 'の木から木材を採ります。' },
  well:    { name: '井戸',   cat: 'gather', kind: 'gather', res: 'water', noTile: true, cost: { wood: 5 }, desc: '水を汲みます。資源マスは不要で、枯れません。' },
  quarry:  { name: '採石所', cat: 'gather', kind: 'gather', res: 'stone', cost: { plank: 10 }, tool: 'pickaxe', desc: AROUND + 'の石から石材を採ります。' },
  collect: { name: '採集所', cat: 'gather', kind: 'gather', choose: ['wheat', 'orange', 'cotton', 'herb'], cost: { plank: 10 }, tool: 'scissors', desc: '小麦畑・オレンジの木・綿花畑・ハーブから採ります。何を採るかはパネルで選べます。' },
  hive:    { name: '巣箱',   cat: 'gather', kind: 'hive', cost: { plank: 5 }, desc: '花畑の隣に置くと、蜂の巣がたまります（10秒に1個、100個まで）。島レベル5から、養蜂場で周りの巣箱からハチミツを採れます。' },
  apiary:  { name: '養蜂場', cat: 'gather', kind: 'gather', res: 'honey', cost: { plank: 10, brick: 10 }, desc: AROUND + 'の巣箱から、蜂の巣を採ってハチミツにします。' },
  sawmill: { name: '製材所', cat: 'prod', kind: 'prod', recipes: ['plank'], cost: { wood: 10 }, desc: '木材2 → 板材' },
  mason:   { name: '石工所', cat: 'prod', kind: 'prod', recipes: ['brick'], cost: { plank: 10, stone: 10 }, desc: '石材2 → 石レンガ（レシピ購入）' },
  mill:    { name: '製粉所', cat: 'prod', kind: 'prod', recipes: ['flour'], cost: { plank: 10, brick: 5 }, desc: '小麦2 → 小麦粉（レシピ購入）' },
  food:    { name: '食品工房', cat: 'prod', kind: 'prod', recipes: ['juice', 'bread', 'jam', 'obread'], cost: { plank: 10, brick: 5 }, desc: 'オレンジ＋水 → オレンジジュース、小麦粉＋水＋木材（燃料） → パン（レシピ購入。1施設で1レシピ）' },
  spinner: { name: '紡績所', cat: 'prod', kind: 'prod', recipes: ['thread', 'cloth'], cost: { plank: 10, brick: 5 }, desc: '綿2 → 糸、糸2 → 布（レシピ購入。1施設で1レシピ）' },
  polisher:{ name: '研磨所', cat: 'prod', kind: 'prod', recipes: ['polish', 'shine'], cost: { plank: 10, brick: 10 }, desc: '石材＋水 → 磨き石、磨き石2＋水2 → 輝き石（レシピ購入。1施設で1レシピ）' },
  pharmacy:{ name: '薬局', cat: 'prod', kind: 'prod', recipes: ['oint', 'tea', 'comp'], cost: { plank: 10, brick: 10 }, desc: 'ハーブ＋水 → 軟膏、ハーブ＋水＋ハチミツ＋木材（燃料） → ハーブ茶、軟膏＋布 → 湿布（レシピ購入。1施設で1レシピ）' },
  tailor:  { name: '仕立て屋', cat: 'prod', kind: 'prod', recipes: ['clothes'], cost: { plank: 10, brick: 10 }, desc: '糸＋布 → 服（レシピ購入）' },
  furniture:{ name: '家具屋', cat: 'prod', kind: 'prod', recipes: ['bed'], cost: { plank: 10, brick: 10 }, desc: '板材5 → 木のベッド（レシピ購入）。ベッドは住居のアップグレードに使います' },
  toolshop:{ name: '道具屋', cat: 'prod', kind: 'prod', recipes: ['axe', 'pickaxe', 'scissors'], cost: { plank: 10, brick: 5 }, desc: '木材＋石材 → 石のオノ・石のピッケル・石のハサミ（レシピ購入。1施設で1レシピ）。道具は施設に入れると作業が速くなります' },
  house:   { name: '自宅',   cat: 'home', kind: 'house', cost: { plank: 10 }, desc: '4人まで住めます。全員が住居に入れないと人口は増えません。' },
  market:  { name: '市場',   cat: 'home', kind: 'market', cost: { plank: 10 }, desc: '作業員が周りの家に品物を配達してコインを得ます。いくつでも建てられます。' },
};
BUILD.collect.res = 'wheat';
for (const t in BUILD) BUILD[t].size = 1;

// ---------- 島レベルと目標 ----------
// goal: prog() が n 以上で達成。req のゴールが済むと表示。unlock は達成で解放される施設
const pv = k => (S.stats[k] || 0);
const L5ITEMS = ['water', 'wheat', 'orange', 'flour', 'juice', 'bread', 'cotton', 'thread', 'cloth', 'honey', 'polish', 'jam'];
const STAGES = [
  { n: 1, cap: 8, denom: { food: 2 }, items: ['water'], unlock: ['lumber'],
    intro: '島レベル1：水を配って住民を8人にしましょう',
    goals: [
      { id: 'a1', text: '伐採所を建てて木材を5個採る', n: 5, prog: () => pv('made_wood'), unlock: ['well'] },
      { id: 'a2', text: '井戸を建てて水を5個汲む', n: 5, prog: () => pv('made_water'), req: ['a1'], unlock: ['sawmill'] },
      { id: 'a3', text: '製材所で板材を10個作る', n: 10, prog: () => pv('made_plank'), req: ['a2'], unlock: ['house'] },
      { id: 'a4', text: '自宅を建てて全員を住居に入れる', n: 1, prog: () => (countType('house') && housedAll() ? 1 : 0), req: ['a3'], unlock: ['market'] },
      { id: 'a5', text: '市場で水を配って人口を1人増やす', n: 4, prog: () => S.pop, req: ['a4'], unlock: ['quarry'], hint: '市場の販売品に水を設定し、作業員を置きましょう' },
      { id: 'a6', text: '採石所を建てて石材を10個採る', n: 10, prog: () => pv('made_stone'), req: ['a5'], unlock: ['mason'] },
      { id: 'a7', text: '石工所を建てて石レンガのレシピを買う（🪙100）', n: 1, prog: () => (S.recipes.includes('brick') ? 1 : 0), req: ['a6'], hint: '石工所を建ててパネルから買えます' },
      { id: 'a8', text: '石工所で石レンガを10個作る', n: 10, prog: () => pv('made_brick'), req: ['a7'] },
      { id: 'a9', text: '住民を8人にする', n: 8, prog: () => S.pop, req: ['a5'] },
    ] },
  { n: 2, cap: 16, denom: { food: 14 }, items: ['water', 'wheat', 'orange', 'flour', 'juice'], unlock: ['collect', 'mill', 'food'],
    intro: '島レベル2：小麦・オレンジ・小麦粉・オレンジジュースも食の満足度に加わりました（分母2→14）。いろいろな食べ物を配りましょう',
    goals: [
      { id: 'b1', text: '採集所で小麦を10個採る', n: 10, prog: () => pv('made_wheat') },
      { id: 'b1o', text: '採集所でオレンジを10個採る', n: 10, prog: () => pv('made_orange') },
      { id: 'b2', text: '製粉所で小麦粉を10個作る', n: 10, prog: () => pv('made_flour'), hint: '小麦粉のレシピ（🪙200）が必要です' },
      { id: 'b3', text: '食品工房でオレンジジュースを10個作る', n: 10, prog: () => pv('made_juice'), hint: 'ジュースのレシピ（🪙200）が必要です' },
      { id: 'b4', text: '市場をアップグレードする（石レンガ10）', n: 1, prog: () => (S.buildings.some(b => b.type === 'market' && (b.lv || 1) >= 2) ? 1 : 0) },
      { id: 'b5', text: '住民を16人にする', n: 16, prog: () => S.pop },
    ] },
  { n: 3, cap: 28, denom: { food: 14, cloth: 4 }, items: ['water', 'wheat', 'orange', 'flour', 'juice', 'cotton', 'thread'], unlock: ['toolshop'],
    intro: '島レベル3：衣のカテゴリが始まりました（綿・糸、分母4）。採集所で綿を採り、配りましょう',
    goals: [
      { id: 'c1', text: '採集所で綿を10個採る', n: 10, prog: () => pv('made_cotton'), unlock: ['spinner'], hint: '綿花畑の近くに採集所を建て、「綿」を選びます' },
      { id: 'c2', text: '紡績所で糸を5個作る', n: 5, prog: () => pv('made_thread'), req: ['c1'], hint: '糸のレシピ（🪙300）が必要です' },
      { id: 'c3', text: '道具屋で石のオノを3個作る', n: 3, prog: () => pv('made_axe'), hint: 'オノのレシピ（🪙300）が必要です' },
      { id: 'c4', text: '石のオノで伐採を速める', n: 1, prog: () => pv('boost_axe'), req: ['c3'], hint: '伐採所のパネルから石のオノを入れます' },
      { id: 'c5', text: '住民を28人にする', n: 28, prog: () => S.pop },
    ] },
  { n: 4, cap: 36, denom: { food: 18, cloth: 4 }, items: ['water', 'wheat', 'orange', 'flour', 'juice', 'bread', 'cotton', 'thread'], unlock: ['hive'],
    intro: '島レベル4：パンが食の満足度に加わりました（食の分母14→18）。巣箱も建てられます',
    goals: [
      { id: 'd1', text: 'パンのレシピを買ってパンを10個作る', n: 10, prog: () => pv('made_bread'), hint: '食品工房でパンのレシピ（🪙500）を買い、レシピをパンに変えます' },
      { id: 'd2', text: '巣箱を花畑の隣に1個置く', n: 1, prog: () => countType('hive') },
      { id: 'd3', text: '住民を36人にする', n: 36, prog: () => S.pop },
    ] },
  { n: 5, cap: 44, denom: { food: 18, cloth: 8, luxury: 8 }, items: ['water', 'wheat', 'orange', 'flour', 'juice', 'bread', 'cotton', 'thread', 'cloth', 'honey', 'polish', 'jam'], unlock: ['apiary', 'polisher', 'furniture'],
    intro: '島レベル5：贅沢品のカテゴリが始まりました（ハチミツ・磨き石・オレンジジャム、分母8）。衣に布が加わりました（分母8）',
    goals: [
      { id: 'e1', text: '研磨所を建てて磨き石を10個作る', n: 10, prog: () => pv('made_polish'), hint: '磨き石のレシピ（🪙800）が必要です' },
      { id: 'e2', text: '養蜂場を建ててハチミツを10個採る', n: 10, prog: () => pv('made_honey'), hint: '巣箱の隣に養蜂場を建てます' },
      { id: 'e3', text: '紡績所で布を10個作る', n: 10, prog: () => pv('made_cloth'), hint: '布のレシピ（🪙800）を買い、紡績所のレシピを布に変えます' },
      { id: 'e4', text: '家具屋で木のベッドを4個作る', n: 4, prog: () => pv('made_bed'), hint: 'ベッドのレシピ（🪙800）が必要です' },
      { id: 'e5', text: '木のベッド4個と1000コインで住居をアップグレードする', n: 1, prog: () => (S.buildings.some(b => b.type === 'house' && (b.lv || 0) >= 1) ? 1 : 0), req: ['e4'], hint: '自宅をタップして「アップグレード」' },
      { id: 'e6', text: '住民を44人にする', n: 44, prog: () => S.pop },
    ] },
  // 島レベル6〜9：分母は「そのカテゴリの品の全ポイント×0.75」（品ぞろえを求める）。house は住居レベル1の必要な割合
  { n: 6, cap: 56, house: 50, denom: { food: 26, cloth: 20, luxury: 10, hygiene: 4 }, items: [...L5ITEMS, 'obread', 'clothes', 'herb', 'oint'], unlock: ['pharmacy', 'tailor'],
    intro: '島レベル6：衛生（ハーブ・軟膏）と住（住居レベル1の割合50%）のカテゴリが始まりました。オレンジパン・服も加わりました。新しい住居は最初から住居レベル1です',
    goals: [
      { id: 'f1', text: '採集所でハーブを10個採る', n: 10, prog: () => pv('made_herb'), hint: '左下・右下のハーブの近くに採集所を建て、「ハーブ」を選びます' },
      { id: 'f2', text: '薬局で軟膏を10個作る', n: 10, prog: () => pv('made_oint'), hint: '軟膏のレシピ（🪙1000）が必要です' },
      { id: 'f3', text: 'オレンジパンを10個作る', n: 10, prog: () => pv('made_obread'), hint: '食品工房でレシピ（🪙1000）を買います' },
      { id: 'f4', text: '仕立て屋で服を10個作る', n: 10, prog: () => pv('made_clothes'), hint: '服のレシピ（🪙1000）が必要です' },
      { id: 'f5', text: '住居レベル1の割合を50%以上にする', n: 50, prog: () => Math.floor(housePct()), hint: '自宅をアップグレード（ベッド4＋1000コイン）' },
      { id: 'f6', text: '住民を56人にする', n: 56, prog: () => S.pop },
    ] },
  { n: 7, cap: 68, house: 75, denom: { food: 26, cloth: 20, luxury: 20, hygiene: 4 }, items: [...L5ITEMS, 'obread', 'clothes', 'herb', 'oint', 'shine'], unlock: [],
    intro: '島レベル7：贅沢品に輝き石が加わりました（分母20）。住居レベル1の割合は75%が必要です',
    goals: [
      { id: 'g1', text: '研磨所で輝き石を10個作る', n: 10, prog: () => pv('made_shine'), hint: '輝き石のレシピ（🪙1000）を買い、研磨所のレシピを変えます' },
      { id: 'g2', text: '住居レベル1の割合を75%以上にする', n: 75, prog: () => Math.floor(housePct()) },
      { id: 'g3', text: '住民を68人にする', n: 68, prog: () => S.pop },
    ] },
  { n: 8, cap: 80, house: 90, denom: { food: 26, cloth: 20, luxury: 20, hygiene: 10 }, items: [...L5ITEMS, 'obread', 'clothes', 'herb', 'oint', 'shine', 'tea'], unlock: [],
    intro: '島レベル8：衛生にハーブ茶が加わりました（分母10）。住居レベル1の割合は90%が必要です',
    goals: [
      { id: 'h1', text: '薬局でハーブ茶を10個作る', n: 10, prog: () => pv('made_tea'), hint: 'ハーブ茶のレシピ（🪙1000）が必要です' },
      { id: 'h2', text: '住居レベル1の割合を90%以上にする', n: 90, prog: () => Math.floor(housePct()) },
      { id: 'h3', text: '住民を80人にする', n: 80, prog: () => S.pop },
    ] },
  { n: 9, cap: 100, house: 100, denom: { food: 26, cloth: 20, luxury: 20, hygiene: 20 }, items: [...L5ITEMS, 'obread', 'clothes', 'herb', 'oint', 'shine', 'tea', 'comp'], unlock: [],
    intro: '島レベル9：衛生に湿布が加わりました（分母20）。すべての住居を住居レベル1にしましょう',
    goals: [
      { id: 'i1', text: '薬局で湿布を10個作る', n: 10, prog: () => pv('made_comp'), hint: '湿布のレシピ（🪙1000）が必要です' },
      { id: 'i2', text: 'すべての住居を住居レベル1にする', n: 100, prog: () => Math.floor(housePct()) },
      { id: 'i3', text: '住民を100人にする', n: 100, prog: () => S.pop },
    ] },
  { n: 10, cap: Infinity, house: 100, denom: { food: 26, cloth: 20, luxury: 20, hygiene: 20 }, items: [...L5ITEMS, 'obread', 'clothes', 'herb', 'oint', 'shine', 'tea', 'comp'], unlock: [],
    intro: '島レベル10：自由モード。満足度を保てば、住居を置けるかぎり住民が増えます。コインで島を強化できます（📦倉庫の拡張、施設の作業員の上限アップ・2つのレシピ、市場の配達範囲の拡大）',
    goals: [] },
];
function stageDef() { return STAGES[Math.min(S.stage, STAGES.length) - 1]; }
function goalDone(id) { return S.goalsDone.includes(id); }
function goalVisible(g) { return !goalDone(g.id) && (g.req || []).every(goalDone); }
function visibleGoals() { return stageDef().goals.filter(goalVisible); }
function stageComplete() { const gs = stageDef().goals; return S.stage <= STAGES.length && gs.length > 0 && gs.every(g => goalDone(g.id)); }
function freeMode() { return stageDef().goals.length === 0; }
function hasNextStage() { return S.stage < STAGES.length; }
function checkGoals() {
  if (S.stage > STAGES.length) return;
  for (const g of stageDef().goals) {
    if (!goalVisible(g) || g.prog() < g.n) continue;
    S.goalsDone.push(g.id);
    for (const t of g.unlock || []) unlockType(t);
    notify(`✅ 目標達成：${g.text}`);
  }
  if (stageComplete() && !S.notified['stage' + S.stage]) { S.notified['stage' + S.stage] = true; notify(hasNextStage() ? `🎉 島レベル${S.stage}の目標をすべて達成！ 目標から「島レベル達成」を押すと次の島レベルへ` : `🎉 島レベル${S.stage}の目標をすべて達成！ 次の島レベルは準備中です`); }
}
function advanceStage() {
  if (!stageComplete() || !hasNextStage()) return false;
  S.stage++;
  for (const t of stageDef().unlock) unlockType(t);
  notify(`📈 島レベル${S.stage}に上がりました。${stageDef().intro}`);
  return true;
}
function unlockType(t) { if (!S.unlocked.includes(t)) { S.unlocked.push(t); S.newTypes.push(t); notify(`🔓 ${BUILD[t].name}が建てられるようになりました`); } }

// ---------- 状態 ----------
let S = null;          // セーブ対象
let occ = [];          // マス → 建物id
const N = CONFIG.MAP;
const idx = (x, y) => y * N + x;
const inMap = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
// 海岸：外周1マス
// マスの種類：2＝陸、1＝砂浜（海岸。港など専用・今は何も建てられない）、0＝海。S.land（陸=1）から作る
let KIND = new Uint8Array(N * N);
const isCoast = (x, y) => KIND[idx(x, y)] !== 2;   // 建てられない（砂浜か海）
const isSea = (x, y) => KIND[idx(x, y)] === 0;
// ---------- マスの形（六角形／四角） ----------
// 六角形は「とがった頭」で横に並べ、奇数行を半マス右にずらす（odd-r）。マスの横幅＝T、行の間隔＝T×0.866
const HEXMAP = CONFIG.HEX, ROW_H = HEXMAP ? Math.sqrt(3) / 2 : 1;
const HEX_DIRS = [[[1, 0], [-1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]], [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]]];
// 隣のマス（六角形は6つ、四角は8つ）
function neighbors(x, y) {
  const out = [];
  if (HEXMAP) { for (const [dx, dy] of HEX_DIRS[y & 1]) if (inMap(x + dx, y + dy)) out.push([x + dx, y + dy]); }
  else for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && inMap(x + dx, y + dy)) out.push([x + dx, y + dy]);
  return out;
}
function toCube(x, y) { const q = x - (y - (y & 1)) / 2; return [q, y, -q - y]; }
// マスの距離：六角形は歩数、四角は縦横の和（往復の時間に使う）
function tileDist(ax, ay, bx, by) { if (HEXMAP) { const a = toCube(ax, ay), b = toCube(bx, by); return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])); } return Math.abs(ax - bx) + Math.abs(ay - by); }
// 範囲の判定：六角形は歩数、四角は縦横それぞれ（周り8マス＝1）
function tileRange(ax, ay, bx, by) { return HEXMAP ? tileDist(ax, ay, bx, by) : Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }
// (x,y) から範囲 R 以内のマス（自分を除く）
function tilesWithin(x, y, R) { const out = []; for (let ny = Math.max(0, y - R); ny <= Math.min(N - 1, y + R); ny++) for (let nx = Math.max(0, x - R - 1); nx <= Math.min(N - 1, x + R + 1); nx++) if ((nx !== x || ny !== y) && tileRange(x, y, nx, ny) <= R) out.push([nx, ny]); return out; }
// マスの中心（ワールド座標をマス幅で割った値）。dx,dy はマスの中でのずれ
function cpos(x, y, dx = 0, dy = 0) { return [x + 0.5 + (HEXMAP && (y & 1) ? 0.5 : 0) + dx, (y + 0.5) * ROW_H + dy * ROW_H]; }
// ワールド座標（ピクセル）→ マス。六角形は近い中心を探す
function worldToTile(wx, wy) {
  const fx = wx / CONFIG.TILE, fy = wy / CONFIG.TILE;
  if (!HEXMAP) return [Math.floor(fx), Math.floor(fy)];
  const y0 = Math.round(fy / ROW_H - 0.5); let best = null, bd = 1e9;
  for (let y = y0 - 1; y <= y0 + 1; y++) for (let x = Math.floor(fx) - 1; x <= Math.floor(fx) + 1; x++) { const [cx, cy] = cpos(x, y); const d = (cx - fx) ** 2 + (cy - fy) ** 2; if (d < bd) { bd = d; best = [x, y]; } }
  return best;
}
// ワールドの大きさ（マス幅単位）
// 丸い島の形（陸=1）。だ円の縁に少しでこぼこをつける。形は毎回同じ
function islandLand() {
  const [ww, wh] = worldSize(), cx = ww / 2, cy = wh / 2, I = CONFIG.ISLAND, land = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const [wx, wy] = cpos(x, y), dx = (wx - cx) / I.a, dy = (wy - cy) / I.b, th = Math.atan2(dy, dx);
    const wob = 1 + I.wobble * (0.6 * Math.sin(3 * th + 0.7) + 0.4 * Math.sin(5 * th + 2.1) + 0.3 * Math.sin(2 * th + 4));
    land.push(Math.hypot(dx, dy) / wob <= 1 ? 1 : 0);
  }
  return land;
}
// 陸の外側1マスを砂浜にする
function buildKinds(land) {
  KIND = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y);
    KIND[i] = land[i] ? 2 : (neighbors(x, y).some(([a, b]) => land[idx(a, b)]) ? 1 : 0);
  }
}
function worldSize() { return [N + (HEXMAP ? 0.5 : 0), (N - 1) * ROW_H + (HEXMAP ? 2 / Math.sqrt(3) : 1)]; }
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// 資源の配置（各資源をだいたい同じ数に）。ブロック(bx,by)は陸の5×5区画
// 中央：木／左：小麦畑／右：オレンジの木／上・下：石と木／左上：綿花畑／右上：花畑とオレンジ／左下：ハーブと小麦／右下：綿花畑とハーブ
function placeResources(cluster, nearHome, only) {
  const plan = [
    [1, 1, 'wood', 6, nearHome], [0, 1, 'wheat', 7], [2, 1, 'orange', 7],
    [1, 0, 'stone', 6], [1, 0, 'wood', 4], [1, 2, 'stone', 6], [1, 2, 'wood', 4],
    [0, 0, 'cotton', 7], [2, 0, 'flower', 6], [2, 0, 'orange', 5],
    [0, 2, 'herb', 7], [0, 2, 'wheat', 5], [2, 2, 'cotton', 6], [2, 2, 'herb', 5],
  ];
  for (const [bx, by, t, n, av] of plan) if (!only || only.includes(t)) cluster(bx, by, t, n, av);
}
// かたまり配置の関数を作る：ブロック(bx,by)（陸の5×5）の中に種類 t を n マス、ひとつながりで置く
function makeClusterFn(tiles, r) {
  const B = 5, O = CONFIG.CORE;
  const put = (x, y, t) => { tiles[idx(x, y)].res = { t, amt: 60 + Math.floor(r() * 40), max: 100 }; };
  // かたまり配置：ブロック(bx,by)（5×5）の中に種類 t を n マス、ひとつながりで置く
  return (bx, by, t, n, avoid) => {
    const x0 = O + bx * B, y0 = O + by * B; let tries = 40;
    while (tries--) {
      const sx = x0 + Math.floor(r() * B), sy = y0 + Math.floor(r() * B);
      if (tiles[idx(sx, sy)].res || isCoast(sx, sy) || (avoid && avoid(sx, sy))) continue;
      const cells = [[sx, sy]], set = new Set([idx(sx, sy)]); let guard = 80;
      while (cells.length < n && guard--) {
        const [cx, cy] = cells[Math.floor(r() * cells.length)];
        const nb = neighbors(cx, cy); if (!nb.length) continue;
        const [nx, ny] = nb[Math.floor(r() * nb.length)];
        if (nx < x0 || ny < y0 || nx >= x0 + B || ny >= y0 + B || set.has(idx(nx, ny)) || tiles[idx(nx, ny)].res || isCoast(nx, ny) || (avoid && avoid(nx, ny))) continue;
        cells.push([nx, ny]); set.add(idx(nx, ny));
      }
      if (cells.length >= Math.min(n, 4)) { for (const [x, y] of cells) put(x, y, t); return true; }
    }
    return false;
  };
}
function newGame() {
  const r = rng(Date.now() & 0xffff);
  const tiles = [];
  for (let i = 0; i < N * N; i++) tiles.push({ res: null });
  const c = Math.floor(N / 2), land = islandLand(); buildKinds(land);
  const cluster = makeClusterFn(tiles, r);
  const nearHome = (x, y) => tileRange(x, y, c, c) <= 1;
  placeResources(cluster, nearHome);
  S = {
    v: 20, coins: CONFIG.START_COINS, pop: CONFIG.START_POP, residents: [], stage: 1, diff: 'normal',
    tiles, land, buildings: [], nextId: 1, order: 1,
    inv: {}, invOrder: [], reserve: {}, invCap: CONFIG.INV_CAP,
    unlocked: [], newTypes: [], recipes: [], goalsDone: [], notified: {}, lastTab: 'gather',
    stats: { earned: 0 },
    t: 0, timers: { regen: 0, grow: 0 }, speed: 1, lastSave: Date.now(),
  };
  for (const k in CONFIG.START_ITEMS) invAdd(k, CONFIG.START_ITEMS[k]);
  for (const t of STAGES[0].unlock) { S.unlocked.push(t); S.newTypes.push(t); }
  for (let i = 0; i < S.pop; i++) addResident();
  rebuildOcc();
}

// ---------- インベントリ（島で1つ） ----------
function invCount(k) { return S.inv[k] || 0; }
function invCap(k) { return CONFIG.INV_CAP + (S.invUp || 0) * CONFIG.EXTRA.inv.cap; }
function marketStock() { return CONFIG.MARKET.stock + (S.invUp || 0) * CONFIG.EXTRA.inv.stock; }
// ---------- 島レベル10の強化（コイン） ----------
// key: inv（島全体）／range（市場）／dual（生産施設）／workers（施設）。b は施設（inv のときは null）
function extraLv(key, b) { return key === 'inv' ? (S.invUp || 0) : key === 'range' ? (b.rangeUp || 0) : key === 'dual' ? (b.dual ? 1 : 0) : (b.wUp || 0); }
function extraCost(key, b) { return S.stage >= CONFIG.EXTRA.stage ? (CONFIG.EXTRA[key].cost[extraLv(key, b)] || null) : null; }
function extraOk(key, b) {
  if (key === 'inv') return true;
  const k = BUILD[b.type].kind;
  if (key === 'range') return k === 'market';
  if (key === 'dual') return k === 'prod' && BUILD[b.type].recipes.length > 1;
  return k === 'gather' || k === 'prod' || k === 'market';
}
function buyExtra(key, b) {
  const c = extraCost(key, b); if (!c || !extraOk(key, b) || S.coins < c) return false;
  S.coins -= c;
  if (key === 'inv') S.invUp = (S.invUp || 0) + 1;
  else if (key === 'range') b.rangeUp = (b.rangeUp || 0) + 1;
  else if (key === 'dual') { b.dual = true; b.recipe2 = b.recipe2 || BUILD[b.type].recipes.find(r => r !== b.recipe && recipeOwned(r)) || null; }
  else b.wUp = (b.wUp || 0) + 1;
  notify('✨ ' + (key === 'inv' ? `倉庫を拡張しました（上限${invCap()}）` : key === 'range' ? `${bname(b)}の配達範囲を広げました` : key === 'dual' ? `${bname(b)}で2つのレシピを作れるようになりました` : `${bname(b)}の作業員の上限を${maxWorkers(b)}人にしました`)); return true;
}
function invRoom(k) { return Math.max(0, invCap(k) - invCount(k)); }
function reserveOf(k) { return S.reserve[k] || 0; }
// 生産・市場の自動補充に使える数（確保を除く）
function invAvail(k) { return Math.max(0, invCount(k) - reserveOf(k)); }
function invAdd(k, n) {
  const a = Math.min(n, invRoom(k)); if (a <= 0) return 0;
  S.inv[k] = invCount(k) + a; if (!S.invOrder.includes(k)) { S.invOrder.push(k); }
  return a;
}
// useReserve: 確保分も使う（建築・アップグレード・市場の手動補充・売却）
function invTake(k, n, useReserve) { const a = Math.min(n, useReserve ? invCount(k) : invAvail(k)); if (a > 0) S.inv[k] = invCount(k) - a; return a; }
function canAfford(cost) { for (const k in cost) { if (k === 'coins' ? S.coins < cost[k] : invCount(k) < cost[k]) return false; } return true; }
function payCost(cost) { for (const k in cost) { if (k === 'coins') S.coins -= cost[k]; else invTake(k, cost[k], true); } }
function setReserve(k, n) { S.reserve[k] = Math.max(0, Math.min(invCap(k), n)); }
function sellItem(k, n) { const a = invTake(k, n, true); if (a > 0) { const c = a * ITEMS[k].price; S.coins += c; S.stats.earned += c; S.stats.sold = (S.stats.sold || 0) + a; } return a; }

// ---------- 住民・満足度 ----------
function houseOf(r) { return r.house ? getB(r.house) : null; }
function residentsOf(h) { return S.residents.filter(r => r.house === h.id); }
function houseWithRoom() { const hs = S.buildings.filter(b => b.type === 'house' && residentsOf(b).length < CONFIG.HOUSE_CAP).sort((a, b) => residentsOf(b).length - residentsOf(a).length || a.order - b.order); return hs[0] || null; }
function addResident() { const h = houseWithRoom(); S.residents.push({ id: S.residents.length + 1, house: h ? h.id : null, demand: {} }); }
function rehouse() { for (const r of S.residents) if (!r.house || !getB(r.house)) { const h = houseWithRoom(); r.house = h ? h.id : null; } }
function housedAll() { return S.residents.every(r => r.house && getB(r.house)); }
function houseCapacity() { return countType('house') * CONFIG.HOUSE_CAP; }
function needPct() { return CONFIG.DIFFICULTY[S.diff || 'normal'].need; }
function denoms() { return stageDef().denom; }
function activeCats() { return Object.keys(denoms()); }
// 住民1人のカテゴリ満足度（%）：ポイント × ゲージ ÷ 分母
function resSat(r, cat) { const d = denoms()[cat]; if (!d) return 100; let p = 0; for (const k in r.demand) if (ITEMS[k].cat === cat && itemCounts(k)) p += ITEMS[k].pts * r.demand[k] / 100; return Math.min(100, p / d * 100); }
function catSat(cat) { return S.residents.length ? S.residents.reduce((a, r) => a + resSat(r, cat), 0) / S.residents.length : 0; }
function minSat() { const cs = activeCats(); return cs.length ? Math.min(...cs.map(catSat)) : 100; }
// 品物がそのカテゴリで今の島レベルに含まれるか（分母に入っている品）
// 今の島レベルで満足度に数える品（分母に入っている品）。それ以外の品は届けても満足度にならない
function stageItems() { return stageDef().items; }
function itemCounts(k) { return stageItems().includes(k); }
function stageCap() { return stageDef().cap; }
// 住の満足度：人が住んでいる住居のうち、住居レベル1以上の割合（%）。島レベルごとに必要な割合 house がある
function housePct() { const hs = S.buildings.filter(b => b.type === 'house' && residentsOf(b).length); return hs.length ? hs.filter(b => (b.lv || 0) >= 1).length / hs.length * 100 : 0; }
function houseNeed() { return stageDef().house || 0; }
// 建築の材料（住居は島レベル6から、最初からレベル1）
function buildCost(type) { return type === 'house' && S.stage >= CONFIG.HOUSE_LV1_FROM ? CONFIG.HOUSE_LV1_COST : BUILD[type].cost; }
function popCap() { return Math.min(stageCap(), houseCapacity()); }
// 人口が増えない理由（増えるなら null）
function growBlock() {
  if (S.pop >= stageCap() && stageCap() !== Infinity) return hasNextStage() ? `島レベル${S.stage}は${stageCap()}人まで。目標をすべて達成して島レベルを上げましょう` : `島レベル${S.stage}は${stageCap()}人まで（次の島レベルは準備中）`;
  if (!countType('house')) return '自宅を建てて住民を住まわせましょう';
  if (S.pop >= houseCapacity()) return '住居が満員です。自宅を建てましょう';
  for (const c of activeCats()) if (catSat(c) < needPct()) return `${CATS_SAT[c]}の満足度が${needPct()}%に届いていません（今${Math.floor(catSat(c))}%）`;
  if (houseNeed() && housePct() < houseNeed()) return `住の満足度（住居レベル1の割合）が${houseNeed()}%に届いていません（今${Math.floor(housePct())}%）`;
  return null;
}
function canGrow() { return !growBlock(); }

// ---------- 建物 ----------
function makeBuilding(type, x, y) {
  const d = BUILD[type];
  const b = { id: S.nextId++, type, x, y, order: S.order++, workers: 0 };
  if (d.kind === 'gather') { b.prog = 0; b.res = d.res; }
  if (d.tool) { b.boost = 0; b.autoBoost = false; }
  if (d.kind === 'hive') { b.combs = 0; b.ct = 0; }
  if (d.kind === 'house') b.lv = 0;
  if (d.kind === 'prod') { b.recipe = d.recipes[0]; b.prog = 0; b.active = false; }
  if (d.kind === 'market') { b.lv = 1; b.slots = []; for (let i = 0; i < CONFIG.MARKET.slots; i++) b.slots.push({ item: null, stock: 0, auto: true }); b.jobs = []; }
  return b;
}
function addBuilding(type, x, y) {
  const b = makeBuilding(type, x, y); S.buildings.push(b);
  if (type === 'house') rehouse();
  rebuildOcc();
  const k = 'built_' + type; S.stats[k] = (S.stats[k] || 0) + 1;
  return b;
}
function rebuildOcc() { occ = new Array(N * N).fill(null); for (const b of S.buildings) occ[idx(b.x, b.y)] = b.id; }
function getB(id) { return S.buildings.find(b => b.id === id); }
function countType(type) { return S.buildings.filter(b => b.type === type).length; }
function bname(b) { const same = S.buildings.filter(x => x.type === b.type).sort((p, q) => p.order - q.order); return same.length > 1 ? `${BUILD[b.type].name} ${same.indexOf(b) + 1}` : BUILD[b.type].name; }
function maxWorkers(b) { const k = BUILD[b.type].kind; return k === 'market' ? CONFIG.MARKET.workers[(b.lv || 1) - 1] + (b.wUp || 0) : (k === 'house' || k === 'hive') ? 0 : CONFIG.MAX_WORKERS + (b.wUp || 0); }
function assigned() { return S.buildings.reduce((a, b) => a + (b.workers || 0), 0); }
function freeWorkers() { return S.pop - assigned(); }
function setWorkers(b, n) {
  n = Math.max(0, Math.min(maxWorkers(b), n));
  if (n > b.workers && freeWorkers() < n - b.workers) return;
  b.workers = n;
  if (b.jobs) while (b.jobs.length > n) { const j = b.jobs.pop(); const sl = b.slots.find(s => s.item === j.item); if (sl) sl.stock++; else invAdd(j.item, 1); }
}
function canPlace(type, x, y, ignoreId) { if (!inMap(x, y) || isCoast(x, y)) return false; const o = occ[idx(x, y)]; if (o && o !== ignoreId) return false; if (BUILD[type].kind === 'hive' && !hiveSpotOk(x, y)) return false; return true; }
// 巣箱：花畑のマスそのものではなく、花畑の隣（周り8マス）に置く
function nearFlower(x, y) { return neighbors(x, y).some(([nx, ny]) => S.tiles[idx(nx, ny)].res && S.tiles[idx(nx, ny)].res.t === 'flower'); }
function hiveSpotOk(x, y) { const t = S.tiles[idx(x, y)]; return !(t.res && t.res.t === 'flower') && nearFlower(x, y); }
function build(type, x, y) {
  const cost = buildCost(type);
  if (!S.unlocked.includes(type) || !canPlace(type, x, y) || !canAfford(cost)) return null;
  payCost(cost);
  const b = addBuilding(type, x, y);
  if (type === 'house' && S.stage >= CONFIG.HOUSE_LV1_FROM) b.lv = 1;
  return b;
}
function moveBuilding(b, x, y) { if (!canPlace(b.type, x, y, b.id)) return false; b.x = x; b.y = y; rebuildOcc(); return true; }
// 取り壊し：材料の半分を返す（端数切り捨て）。市場の在庫はインベントリへ
function demolishRefund(b) { const o = {}; const c = b.type === 'house' && (b.lv || 0) >= 1 && S.stage >= CONFIG.HOUSE_LV1_FROM ? CONFIG.HOUSE_LV1_COST : BUILD[b.type].cost; for (const k in c) o[k] = Math.floor(c[k] / 2); return o; }
function demolish(b) {
  setWorkers(b, 0);
  if (b.slots) for (const s of b.slots) if (s.item && s.stock) invAdd(s.item, s.stock);
  const ref = demolishRefund(b); for (const k in ref) invAdd(k, ref[k]);
  S.buildings = S.buildings.filter(x => x !== b); rebuildOcc();
  if (b.type === 'house') { for (const r of S.residents) if (r.house === b.id) r.house = null; rehouse(); }
}
// 採集所の「採るもの」
function resAvailable(r) { return r === 'cotton' ? S.stage >= 3 : r === 'herb' ? S.stage >= 6 : true; }
function setRes(b, r) { if (BUILD[b.type].choose && BUILD[b.type].choose.includes(r) && resAvailable(r)) { b.res = r; b.prog = 0; } }
// 生産施設のレシピを変える（1施設で1レシピ）。作りかけの材料はインベントリへ戻す
// slot：1＝1つ目のレシピ、2＝2つ目（島レベル10の「2つのレシピ」）。作っている途中のレシピを変えたら材料を戻す
function changeRecipe(b, r, slot = 1) {
  const rs = BUILD[b.type].recipes, key = slot === 2 ? 'recipe2' : 'recipe';
  if (!rs || !rs.includes(r) || b[key] === r || !recipeOwned(r) || (slot === 2 && !b.dual) || (b.dual && b[slot === 2 ? 'recipe' : 'recipe2'] === r)) return false;
  if (b.active && curRecipe(b) === b[key]) { const old = RECIPES[b[key]]; for (const m in old.need) invAdd(m, old.need[m]); b.active = false; b.prog = 0; b.cur = null; }
  b[key] = r; return true;
}
// 作っている（これから作る）レシピ
function curRecipe(b) { return b.active && b.cur ? b.cur : b.recipe; }
// この施設で作るレシピ（2つのレシピを買った施設は2つ）
function prodRecipes(b) { return b.dual && b.recipe2 && b.recipe2 !== b.recipe ? [b.recipe, b.recipe2] : [b.recipe]; }
// ---------- 道具のブースト ----------
// b.boost は「作業員1人ぶんの残り秒数」。作業員がいて作業中のときだけ、人数ぶん減る
function boostTool(b) { const d = BUILD[b.type]; if (!d.tool) return null; if (d.toolRes && !d.toolRes.includes(b.res)) return null; return d.tool; }
function boostCount(b) { return (b.boost || 0) / CONFIG.BOOST_SEC; }
function canAddBoost(b) { return boostTool(b) && (b.boost || 0) + CONFIG.BOOST_SEC <= CONFIG.BOOST_MAX * CONFIG.BOOST_SEC + 1e-6; }
// useReserve: 手動で入れるときは確保分も使える。自動投入は確保分を使わない
function addBoost(b, useReserve) { const tool = boostTool(b); if (!tool || !canAddBoost(b) || invTake(tool, 1, useReserve) < 1) return false; b.boost = (b.boost || 0) + CONFIG.BOOST_SEC; S.stats['boost_' + tool] = (S.stats['boost_' + tool] || 0) + 1; return true; }
function boostLeftSec(b) { return b.workers ? (b.boost || 0) / b.workers : (b.boost || 0); }

// ---------- レシピ ----------
function recipeOwned(r) { return !RECIPES[r].buy || S.recipes.includes(r); }
// レシピの価格：そのレシピの品が初めて満足度・材料に使われる島レベルで決まる
const RECIPE_LV = { brick: 1, flour: 2, juice: 2, thread: 3, axe: 3, pickaxe: 3, scissors: 3, bread: 4, cloth: 5, polish: 5, jam: 5, bed: 5, obread: 6, clothes: 6, oint: 6, shine: 7, tea: 8, comp: 9 };
function recipeCost(r) { return CONFIG.RECIPE_COST_BY_LV[RECIPE_LV[r]] || CONFIG.RECIPE_COST; }
// レシピはその品が使えるようになる島レベルから買える
function recipeUnlocked(r) { return S.stage >= (RECIPE_LV[r] || 1); }
function buyRecipe(r) { if (recipeOwned(r) || !recipeUnlocked(r) || S.coins < recipeCost(r)) return false; S.coins -= recipeCost(r); S.recipes.push(r); notify(`📜 レシピ「${ITEMS[RECIPES[r].out].name}」を買いました`); return true; }
function workSec(b) {
  const d = BUILD[b.type];
  if (d.kind === 'gather') { if (d.noTile) return CONFIG.GATHER_SEC; const t = gatherTarget(b); return CONFIG.GATHER_SEC + (t ? t.d : 1) * 2 * CONFIG.TILE_SEC; }
  if (d.kind === 'prod') { const r = RECIPES[curRecipe(b)]; let t = 0; for (const m in r.need) t += ITEMS[m].time * r.need[m]; return t; }
  return 10;
}
// 採集対象：周り8マスで量が残っている同じ資源。近い順（同距離は上→右→下→左）
function gatherTarget(b) {
  const res = b.res, R = CONFIG.GATHER_RANGE; let best = null, bd = 1e9, bp = 99;
  if (res === 'honey') {  // 養蜂場：周りの巣箱の蜂の巣
    for (const h of S.buildings) {
      if (h.type !== 'hive' || h.combs <= 0 || tileRange(h.x, h.y, b.x, b.y) > R) continue;
      const d = tileDist(h.x, h.y, b.x, b.y);
      if (d < bd || (d === bd && best && h.combs > best.h.combs)) { best = { tile: { get amt() { return h.combs; }, set amt(v) { h.combs = v; } }, x: h.x, y: h.y, d, h }; bd = d; }
    }
    return best;
  }
  for (const [x, y] of tilesWithin(b.x, b.y, R)) {
    const i = idx(x, y), tl = S.tiles[i]; if (!tl.res || tl.res.t !== res || tl.res.amt <= 0 || occ[i]) continue;
    const d = tileDist(b.x, b.y, x, y), dx = x - b.x, dy = y - b.y, p = (dy < 0 && !dx) ? 0 : (dx > 0 && !dy) ? 1 : (dy > 0 && !dx) ? 2 : (dx < 0 && !dy) ? 3 : 4;
    if (d < bd || (d === bd && p < bp)) { best = { tile: tl.res, x, y, d }; bd = d; bp = p; }
  }
  return best;
}
// 材料が足りないもの（確保を除いた在庫で判定）
function missingFor(rk) { const r = RECIPES[rk]; return Object.keys(r.need).filter(m => invAvail(m) < r.need[m]); }
function missingMats(b) { return missingFor(b.recipe); }

// ---------- 市場 ----------
function marketRange(m) { return CONFIG.MARKET.range + (m.rangeUp || 0); }
function inMarketRange(m, h) { return tileRange(m.x, m.y, h.x, h.y) <= marketRange(m); }
function mDist(a, b) { return tileDist(a.x, a.y, b.x, b.y); }
function marketUpCost(m) { const i = (m.lv || 1) - 1; return CONFIG.MARKET.upCost[i] || null; }
function marketUpStage(m) { return CONFIG.MARKET.upStage[(m.lv || 1) - 1] || 99; }
function marketUp(m) { const c = marketUpCost(m); if (!c || S.stage < marketUpStage(m) || !canAfford(c)) return false; payCost(c); m.lv = (m.lv || 1) + 1; notify(`⬆ ${bname(m)}が Lv${m.lv} に（作業員${maxWorkers(m)}人まで）`); return true; }
// 市場のスロット拡張（5→8）
function marketSlotUpOk(m) { return m.slots.length < CONFIG.MARKET_SLOT_UP.slots && S.stage >= CONFIG.MARKET_SLOT_UP.stage; }
function marketSlotUp(m) { if (!marketSlotUpOk(m) || !canAfford(CONFIG.MARKET_SLOT_UP.cost)) return false; payCost(CONFIG.MARKET_SLOT_UP.cost); while (m.slots.length < CONFIG.MARKET_SLOT_UP.slots) m.slots.push({ item: null, stock: 0, auto: true }); notify(`⬆ ${bname(m)}の販売スロットが${m.slots.length}個になりました`); return true; }
// 住居のアップグレード
function houseUpCost(h) { return CONFIG.HOUSE_UP[h.lv || 0] || null; }
function houseUpStage() { return 5; }
function houseUp(h) { const c = houseUpCost(h); if (!c || S.stage < houseUpStage() || !canAfford(c)) return false; payCost(c); h.lv = (h.lv || 0) + 1; notify(`🏠 ${bname(h)}が住居レベル${h.lv}になりました`); return true; }
function setMarketItem(m, i, item) { const s = m.slots[i]; if (s.item && s.stock) invAdd(s.item, s.stock); s.item = item || null; s.stock = 0; S.stats.market_set = 1; }
function marketRefillManual(m, i) { const s = m.slots[i]; if (!s.item) return 0; const a = invTake(s.item, marketStock() - s.stock, true); s.stock += a; return a; }
// 配達先を選ぶ：範囲内の家の住民で、ゲージが30%未満の品。近い家から順、同じ家ならゲージの低い順
function marketTarget(m) {
  const taken = new Set(); for (const b of S.buildings) if (b.jobs) for (const j of b.jobs) taken.add(j.rid + ':' + j.item);
  let best = null;
  for (const r of S.residents) {
    const h = houseOf(r); if (!h || !inMarketRange(m, h)) continue;
    const d = mDist(m, h);
    for (const s of m.slots) {
      if (!s.item || s.stock <= 0 || !itemCounts(s.item)) continue;
      const g = r.demand[s.item] || 0; if (g >= CONFIG.DELIVER_BELOW || taken.has(r.id + ':' + s.item)) continue;
      if (!best || d < best.d || (d === best.d && g < best.g)) best = { r, h, s, d, g };
    }
  }
  return best;
}
function stepMarket(m, dt, acc) {
  // 自動補充（即時）：確保を除いた在庫から
  for (const s of m.slots) if (s.item && s.auto && s.stock < marketStock()) s.stock += invTake(s.item, marketStock() - s.stock, false);
  // 配達中の作業
  for (const j of m.jobs) j.t += dt;
  for (const j of m.jobs.filter(j => j.t >= j.T)) {
    const r = S.residents.find(x => x.id === j.rid);
    if (r) { r.demand[j.item] = 100; const p = ITEMS[j.item].price; S.coins += p; S.stats.earned += p; S.stats['delivered_' + j.item] = (S.stats['delivered_' + j.item] || 0) + 1; if (acc) acc.coins += p; }
  }
  m.jobs = m.jobs.filter(j => j.t < j.T);
  // 空いている作業員が次の配達へ
  while (m.jobs.length < m.workers) {
    const tg = marketTarget(m); if (!tg) break;
    tg.s.stock--;
    m.jobs.push({ rid: tg.r.id, item: tg.s.item, hid: tg.h.id, t: 0, T: CONFIG.MARKET.handSec + tg.d * 2 * CONFIG.TILE_SEC });
  }
}

// ---------- シミュレーション ----------
function sim(dt, acc) {
  S.t += dt;
  // 資源マスの回復：種類ごとの間隔で1個ずつ（建物の下のマスは回復しない）
  for (let i = 0; i < S.tiles.length; i++) {
    const r = S.tiles[i].res; if (!r || occ[i] || r.amt >= r.max) continue;
    const sec = (CONFIG.REGEN_SEC_RES[r.t] || CONFIG.REGEN_SEC);
    r.rg = (r.rg || 0) + dt; while (r.rg >= sec) { r.rg -= sec; if (r.amt < r.max) r.amt++; }
  }
  for (const b of S.buildings) stepBuilding(b, dt, acc);
  // 満足度ゲージ：消費時間×倍率で 100→0
  for (const r of S.residents) for (const k in r.demand) if (r.demand[k] > 0) r.demand[k] = Math.max(0, r.demand[k] - dt / (ITEMS[k].consume * CONFIG.CONSUME_MULT) * 100);
  S.timers.grow += dt;
  while (S.timers.grow >= CONFIG.POP_GROW_SEC) { S.timers.grow -= CONFIG.POP_GROW_SEC; if (canGrow()) { S.pop++; addResident(); if (acc) acc.pop++; } }
  S.stats.pop = S.pop;
  checkGoals();
}
function made(k, acc) { S.stats['made_' + k] = (S.stats['made_' + k] || 0) + 1; if (acc) acc.items[k] = (acc.items[k] || 0) + 1; }
function stepBuilding(b, dt, acc) {
  const d = BUILD[b.type];
  if (d.kind === 'hive') {
    b.ct = (b.ct || 0) + dt;
    while (b.ct >= CONFIG.COMB_SEC) { b.ct -= CONFIG.COMB_SEC; if (b.combs < CONFIG.COMB_MAX && nearFlower(b.x, b.y)) b.combs++; }
    return;
  }
  if (d.kind === 'gather') {
    if (b.workers === 0 || invRoom(b.res) <= 0) return;
    const tg = d.noTile ? null : gatherTarget(b); if (!d.noTile && !tg) return;
    // ブースト：残りがあれば作業時間が半分。自動投入はインベントリから（確保分は使わない）
    if (b.autoBoost && boostTool(b) && (b.boost || 0) < CONFIG.BOOST_SEC) addBoost(b, false);
    let mult = 1;
    if (boostTool(b) && b.boost > 0) { mult = 2; b.boost = Math.max(0, b.boost - dt * b.workers); }
    b.prog += dt * b.workers * mult / workSec(b);
    while (b.prog >= 1) { b.prog -= 1; if (tg) tg.tile.amt--; invAdd(b.res, 1); made(b.res, acc); if (invRoom(b.res) <= 0 || (tg && tg.tile.amt <= 0)) { b.prog = 0; break; } }
  } else if (d.kind === 'prod') {
    if (b.workers === 0 || !b.recipe) return;
    if (!b.active) {
      // 2つのレシピは交互に作る。片方が材料待ち・上限なら、もう片方を作る
      let rs = prodRecipes(b).filter(recipeOwned); if (!rs.length) return;
      if (rs.length > 1 && b.last === rs[0]) rs = [rs[1], rs[0]];
      const rk = rs.find(x => invRoom(RECIPES[x].out) > 0 && !missingFor(x).length); if (!rk) return;
      for (const m in RECIPES[rk].need) invTake(m, RECIPES[rk].need[m], false);
      b.active = true; b.prog = 0; b.cur = rk; b.last = rk;
    }
    const r = RECIPES[curRecipe(b)];
    b.prog = Math.min(1, b.prog + dt * b.workers / workSec(b));
    if (b.prog >= 1 && invRoom(r.out) > 0) { invAdd(r.out, 1); made(r.out, acc); b.active = false; b.prog = 0; }
  } else if (d.kind === 'market') {
    stepMarket(b, dt, acc);
  }
}

// ---------- セーブ ----------
function save() { S.lastSave = Date.now(); try { localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
// 旧セーブ（15×15・17×17の四角い島）を今の地図に移す：全体を真ん中にずらし、丸い島にする
// 島の外になったマスに資源や施設があれば、そのマスは陸のまま残す。ハーブが無ければ左下・右下に足す
function migrateMap() {
  const old = Math.round(Math.sqrt(S.tiles.length));
  if (old === N) { if (!S.land) { S.land = islandLand(); forceLand(); } buildKinds(S.land); return; }
  const d = Math.floor((N - old) / 2), tiles = [];
  for (let i = 0; i < N * N; i++) tiles.push({ res: null });
  for (let y = 0; y < old; y++) for (let x = 0; x < old; x++) tiles[idx(x + d, y + d)] = S.tiles[y * old + x];
  for (const b of S.buildings) { b.x += d; b.y += d; }
  S.tiles = tiles; rebuildOcc();
  S.land = islandLand(); forceLand(); buildKinds(S.land);
  if (!tiles.some(t => t.res && t.res.t === 'herb')) { const cl = makeClusterFn(tiles, rng(Date.now() & 0xffff)); const freeT = (x, y) => !!occ[idx(x, y)]; cl(0, 2, 'herb', 6, freeT); cl(2, 2, 'herb', 5, freeT); }
}
function forceLand() { for (let i = 0; i < N * N; i++) if (S.tiles[i].res || occ[i]) S.land[i] = 1; for (const b of S.buildings) S.land[idx(b.x, b.y)] = 1; }
function load() {
  try { const j = localStorage.getItem(CONFIG.SAVE_KEY); if (!j) return false; S = JSON.parse(j); migrateMap(); S.notified = S.notified || {}; S.reserve = S.reserve || {}; S.newTypes = S.newTypes || []; for (const b of S.buildings) { const d = BUILD[b.type]; if (d.tool && b.boost === undefined) { b.boost = 0; b.autoBoost = false; } } if (S.inv.sickle) { S.inv.scissors = (S.inv.scissors || 0) + S.inv.sickle; delete S.inv.sickle; } S.invOrder = S.invOrder.map(k => k === 'sickle' ? 'scissors' : k).filter((k, i, a) => ITEMS[k] && a.indexOf(k) === i); S.recipes = S.recipes.map(r => r === 'sickle' ? 'scissors' : r); for (const b of S.buildings) if (b.recipe === 'sickle') b.recipe = 'scissors'; if (S.reserve.sickle) { S.reserve.scissors = S.reserve.sickle; delete S.reserve.sickle; } rebuildOcc(); return true; } catch (e) { return false; }
}
function offlineProgress() {
  const elapsed = Math.min(CONFIG.OFFLINE_MAX_SEC, Math.floor((Date.now() - S.lastSave) / 1000));
  if (elapsed < 60) return null;
  const acc = { coins: 0, pop: 0, items: {} };
  for (let i = 0; i < elapsed; i++) sim(1, acc);
  acc.elapsed = elapsed; return acc;
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
SPR.food = SPR.bakery;   // 食品加工所（旧パン屋の絵）
SPR.flower = [
  '................',
  '..r.......y.....',
  '.rYr.....yOy....',
  '..r...p...y..r..',
  '..t..pYp..t.rYr.',
  '..t...p...t..r..',
  '.tt...t..tt..t..',
  '..t..tt...t..tt.',
  '.y.......r...t..',
  'yOy..p..rYr.....',
  '.y..pYp..r...p..',
  '.t...p...t..pYp.',
  '.tt..t..tt...p..',
  '..t..tt..t...t..',
  '.ttt.t..ttt.ttt.',
  '................',
];
SPR.hive = [
  '................',
  '.......BB.......',
  '.......BB.......',
  '....yyyyyyyy....',
  '...YyyyyyyyyY...',
  '...kkkkkkkkkk...',
  '..yyyyyyyyyyyy..',
  '..YyyyyyyyyyyY..',
  '..kkkkkkkkkkkk..',
  '..yyyyykkyyyyy..',
  '..YyyyykkyyyyY..',
  '...kkkkkkkkkk...',
  '....BBBBBBBB....',
  '....B......B....',
  '...BBB....BBB...',
  '................',
];
const VILL = ['..ii....', '..ii....', '.llll...', '.llll...', '..ll....', '.ll.l...', '.B..B...', '........'];
const WORK = ['..ii....', '.yii....', '.oooo...', '.oooo...', '..oo....', '.oo.o...', '.B..B...', '........'];

SPR.collect = SPR.farm;   // 採集所は畑の絵
SPR.toolshop = SPR.workshop;
SPR.herb = [
  '................',
  '....t.....t.....',
  '...tGt...tGt....',
  '..tGgGt.tGgGt...',
  '...tGt.t.tGt..t.',
  '....T.tGt.T..tGt',
  '....T..T..T...T.',
  '.t..T..T..T.t.T.',
  'tGt.T..T..TtGtT.',
  '.T..TttTttT.T.T.',
  '.T...TTTTT..T...',
  '.TTt..TTT..tT...',
  '..TTTTTTTTTT....',
  '....uuuuuuu.....',
  '................',
  '................',
];
SPR.pharmacy = [
  '................',
  '..tttttttttttt..',
  '.tTTTTTTTTTTTTt.',
  '.tttttttttttttt.',
  '.BBBBBBBBBBBBBB.',
  '.BccccccccccccB.',
  '.Bccccc..cccccB.',
  '.Bccccc..cccccB.',
  '.Bcc........ccB.',
  '.Bcc........ccB.',
  '.Bccccc..cccccB.',
  '.Bccccc..cccccB.',
  '.BcCkkCcccccccB.',
  '.BcCkkCcccccccB.',
  '.BBBBBBBBBBBBBB.',
  '................',
].map((r, y) => (y >= 6 && y <= 11) ? r.replace(/\./g, (m, i) => (i >= 3 && i <= 12) ? 'g' : m) : r);
SPR.house1 = SPR.house.map(r => r.replace(/r/g, 'l').replace(/R/g, 'L'));   // 住居レベル1：屋根が青
// 島レベル5の施設（仮の絵：既存の絵を流用）
SPR.apiary = SPR.drinks.map(r => r.replace(/o/g, 'y').replace(/O/g, 'Y'));
SPR.polisher = SPR.warehouse.map(r => r.replace(/n/g, 's').replace(/N/g, 'S').replace(/m/g, 'x'));
SPR.furniture = SPR.tailor.map(r => r.replace(/r/g, 'b').replace(/R/g, 'B'));

// ============================================================
//  描画
// ============================================================
const cv = document.getElementById('map'), ctx = cv.getContext('2d');
const cam = { x: 0, y: 0, s: 1.6 };
let W = 0, H = 0, DPR = 1;
const spriteCache = {};
function sprite(name) {
  if (spriteCache[name]) return spriteCache[name];
  // 絵が見つからないときは仮の箱を描く（絵の書き忘れで画面が止まらないように）
  const rows = name === 'villager' ? VILL : name === 'worker' ? WORK : (SPR[name] || SPR.warehouse), n = rows.length;
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
const UI = { mode: 'normal', placeType: null, px: 0, py: 0, moveB: null, sel: null };

// マスの左上（スプライトを描く四角の左上。六角形のときは六角形の中心に合わせる）
function tileBox(x, y, ox, oy, ts) { const [cx, cy] = cpos(x, y); return [ox + (cx - 0.5) * ts, oy + (cy - 0.5) * ts]; }
// マスの形の線をなぞる
function tilePath(x, y, ox, oy, ts, shrink = 0) {
  const [cx, cy] = cpos(x, y), px = ox + cx * ts, py = oy + cy * ts;
  if (!HEXMAP) { const h = ts / 2 - shrink; ctx.rect(px - h, py - h, h * 2, h * 2); return; }
  const r = ts / Math.sqrt(3) - shrink;
  for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k - Math.PI / 2; const vx = px + r * Math.cos(a), vy = py + r * Math.sin(a); if (k) ctx.lineTo(vx, vy); else ctx.moveTo(vx, vy); }
  ctx.closePath();
}
function draw() {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#2a7fb8'; ctx.fillRect(0, 0, W, H); // 海
  const ts = T * cam.s, [ox, oy] = toScreen(0, 0), [ww, wh] = worldSize();
  // 島のまわりの浅い海と砂浜の縁：砂浜のマスに丸を重ねて、縁をなめらかにする
  for (const [col, rr] of [['#4fa6d6', 1.05], ['#e8d9a0', 0.72]]) {
    ctx.fillStyle = col; ctx.beginPath();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (KIND[idx(x, y)] === 1) { const [cx, cy] = cpos(x, y), px = ox + cx * ts, py = oy + cy * ts; ctx.moveTo(px + ts * rr, py); ctx.arc(px, py, ts * rr, 0, Math.PI * 2); }
    ctx.fill();
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (isSea(x, y)) continue;
    const [sx, sy] = tileBox(x, y, ox, oy, ts); if (sx + ts < 0 || sy + ts * 1.2 < 0 || sx > W || sy - ts * 0.2 > H) continue;
    const t = S.tiles[idx(x, y)];
    // マスの色。六角形は3色で塗り分けると隣どうしが同じ色にならない
    const alt = HEXMAP ? ((x + (y & 1 ? 2 : 0) + y * 2) % 3) : ((x + y) & 1);
    ctx.beginPath(); tilePath(x, y, ox, oy, ts, -0.4);
    if (isCoast(x, y)) { ctx.fillStyle = ['#e2d096', '#ead9a0', '#e6d49b'][alt]; ctx.fill(); continue; }  // 海岸（砂浜）
    ctx.fillStyle = ['#64ad52', '#6db85a', '#68b256'][alt]; ctx.fill();
    if (t.res && !occ[idx(x, y)]) {
      const nm = RES_SPR[t.res.t];
      if (t.res.amt > 0) ctx.drawImage(sprite(nm), sx, sy, ts, ts);
      else { ctx.globalAlpha = 0.3; ctx.drawImage(sprite(nm), sx + ts * 0.15, sy + ts * 0.15, ts * 0.7, ts * 0.7); ctx.globalAlpha = 1; }
    }
  }
  // マスの線
  ctx.strokeStyle = 'rgba(0,0,0,.10)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!isSea(x, y)) tilePath(x, y, ox, oy, ts);
  ctx.stroke();
  // 範囲の表示：採集所は周りのマス（黄）、市場は配達範囲（青）
  const sel = UI.mode === 'normal' ? UI.sel : null;
  if (sel) {
    const d = BUILD[sel.type];
    if (d.kind === 'gather' && !d.noTile) rangeBox(sel, CONFIG.GATHER_RANGE, 'rgba(255,255,120,.25)', 'rgba(255,230,80,.9)', ox, oy, ts);
    if (d.kind === 'market') rangeBox(sel, marketRange(sel), 'rgba(120,190,255,.22)', 'rgba(60,140,255,.9)', ox, oy, ts);
  }
  if (UI.mode === 'place' && BUILD[UI.placeType].kind === 'market') rangeBox({ x: UI.px, y: UI.py }, CONFIG.MARKET.range, 'rgba(120,190,255,.18)', 'rgba(60,140,255,.7)', ox, oy, ts);
  for (const b of S.buildings.slice().sort((a, b) => a.y - b.y)) { if (UI.mode === 'move' && UI.moveB === b) continue; drawBuilding(b.type, b.x, b.y, ox, oy, ts, UI.sel === b ? 'sel' : null, b); }
  if (UI.mode === 'place' || UI.mode === 'move') {
    const type = UI.mode === 'place' ? UI.placeType : UI.moveB.type;
    const ok = canPlace(type, UI.px, UI.py, UI.mode === 'move' ? UI.moveB.id : null) && (UI.mode === 'move' || canAfford(buildCost(type)));
    ctx.globalAlpha = 0.75; drawBuilding(type, UI.px, UI.py, ox, oy, ts, ok ? 'ok' : 'ng'); ctx.globalAlpha = 1;
  }
  drawVillagers(ox, oy, ts);
}
// 範囲のマスを塗って、外側の縁を太線で囲む
function rangeBox(b, R, fill, stroke, ox, oy, ts) {
  const cells = tilesWithin(b.x, b.y, R).filter(([x, y]) => !isSea(x, y)); cells.push([b.x, b.y]);
  ctx.fillStyle = fill; ctx.beginPath(); for (const [x, y] of cells) tilePath(x, y, ox, oy, ts); ctx.fill();
  ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.beginPath();
  if (!HEXMAP) { const x0 = Math.max(0, b.x - R), y0 = Math.max(0, b.y - R), x1 = Math.min(N - 1, b.x + R), y1 = Math.min(N - 1, b.y + R); ctx.rect(ox + x0 * ts, oy + y0 * ts, (x1 - x0 + 1) * ts, (y1 - y0 + 1) * ts); }
  else for (const [x, y] of cells) {  // 外側の辺だけ線を引く（辺の向こうのマスが範囲外・地図外なら外側）
    const [cx, cy] = cpos(x, y), r = ts / Math.sqrt(3);
    for (let k = 0; k < 6; k++) {
      const am = Math.PI / 3 * k - Math.PI / 3, [nx, ny] = worldToTile((cx + Math.cos(am)) * T, (cy + Math.sin(am)) * T);
      if (inMap(nx, ny) && !isSea(nx, ny) && tileRange(b.x, b.y, nx, ny) <= R) continue;
      const a0 = Math.PI / 3 * k - Math.PI / 2, a1 = a0 + Math.PI / 3, px = ox + cx * ts, py = oy + cy * ts;
      ctx.moveTo(px + r * Math.cos(a0), py + r * Math.sin(a0)); ctx.lineTo(px + r * Math.cos(a1), py + r * Math.sin(a1));
    }
  }
  ctx.stroke();
}
function drawBuilding(type, x, y, ox, oy, ts, mark, b) {
  const [sx, sy] = tileBox(x, y, ox, oy, ts);
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(sx + ts / 2, sy + ts * 0.9, ts * 0.45, ts * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(sprite(type === 'house' && b && (b.lv || 0) >= 1 ? 'house1' : type), sx, sy, ts, ts);
  if (b && type === 'collect') {  // 採るものの小さな印
    const bs = ts * 0.42, bx = sx + ts - bs - ts * 0.02, by = sy + ts - bs - ts * 0.02;
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(bx + bs / 2, by + bs / 2, bs / 2 + 1, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(sprite(RES_SPR[b.res]), bx + 1, by + 1, bs - 2, bs - 2);
  }
  if (b && type === 'hive') { // 蜂の巣の数
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(sx + ts * 0.05, sy + ts * 0.72, ts * 0.9, ts * 0.24);
    ctx.fillStyle = '#ffd34a'; ctx.font = `bold ${Math.max(8, ts * 0.2)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.combs, sx + ts / 2, sy + ts * 0.85);
  }
  if (b && maxWorkers(b) > 0 && b.workers === 0 && mark !== 'sel') { // 作業員なしの印
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.arc(sx + ts * 0.16, sy + ts * 0.16, ts * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(8, ts * 0.18)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('0', sx + ts * 0.16, sy + ts * 0.17);
  }
  if (mark === 'sel') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); tilePath(x, y, ox, oy, ts, 1.5); ctx.stroke(); }
  if (mark === 'ok') { ctx.strokeStyle = '#3ad24a'; ctx.lineWidth = 3; ctx.beginPath(); tilePath(x, y, ox, oy, ts, 1.5); ctx.stroke(); }
  if (mark === 'ng') { ctx.fillStyle = 'rgba(255,0,0,.45)'; ctx.beginPath(); tilePath(x, y, ox, oy, ts); ctx.fill(); }
}
// 住民：作業員は施設⇄採集先／市場⇄配達先を往復、それ以外は散歩
const villagers = [];
function drawVillagers(ox, oy, ts) {
  const c = Math.floor(N / 2);
  const [c0x, c0y] = cpos(c, c);
  while (villagers.length < S.pop) villagers.push({ x: c0x, y: c0y, tx: c0x, ty: c0y, wait: 0, job: null, phase: 0 });
  villagers.length = Math.min(villagers.length, S.pop);
  const jobs = []; for (const b of S.buildings.slice().sort((a, b) => a.order - b.order)) for (let k = 0; k < (b.workers || 0); k++) jobs.push([b, k]);
  villagers.forEach((v, i) => { const j = jobs[i] || null; const key = j ? j[0].id + ':' + j[1] : null; if (v.key !== key) { v.key = key; v.job = j; v.phase = 0; v.wait = 0; if (j) [v.tx, v.ty] = cpos(j[0].x, j[0].y, 0, 0.4); } });
  for (const v of villagers) {
    const dx = v.tx - v.x, dy = v.ty - v.y, d = Math.hypot(dx, dy);
    if (v.wait > 0) v.wait -= 1 / 60;
    else if (d > 0.04) { const sp = 0.025; v.x += dx / d * Math.min(sp, d); v.y += dy / d * Math.min(sp, d); }
    else if (v.job) {
      const [b, k] = v.job, kind = BUILD[b.type].kind;
      if (kind === 'gather' && !BUILD[b.type].noTile) {
        if (v.phase === 0) { const t = gatherTarget(b); if (t) { [v.tx, v.ty] = cpos(t.x, t.y); v.phase = 1; } v.wait = 1; }
        else { [v.tx, v.ty] = cpos(b.x, b.y, 0, 0.4); v.phase = 0; v.wait = 1.5; }
      } else if (kind === 'market') {
        const jb = b.jobs[k]; const h = jb ? getB(jb.hid) : null;
        if (v.phase === 0 && h) { [v.tx, v.ty] = cpos(h.x, h.y, 0, 0.4); v.phase = 1; v.wait = 0.5; }
        else { [v.tx, v.ty] = cpos(b.x, b.y, 0, 0.4); v.phase = 0; v.wait = 1; }
      } else { [v.tx, v.ty] = cpos(b.x, b.y, -0.2 + (k % 3) * 0.2, 0.45); v.wait = 3; }
    } else {
      v.wait = 1 + Math.random() * 3; let tries = 12;
      const [vx, vy] = worldToTile(v.x * T, v.y * T); while (tries--) { const nx = vx + Math.floor(Math.random() * 7) - 3, ny = vy + Math.floor(Math.random() * 7) - 3; if (inMap(nx, ny) && !isCoast(nx, ny) && !occ[idx(nx, ny)] && !S.tiles[idx(nx, ny)].res) { [v.tx, v.ty] = cpos(nx, ny); break; } }
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
    cam.s = Math.max(0.45, Math.min(5, pinch0.s * d / pinch0.d));
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
cv.addEventListener('wheel', e => { cam.s = Math.max(0.45, Math.min(5, cam.s * (e.deltaY < 0 ? 1.1 : 0.9))); clampCam(); }, { passive: true });
function centerCam() { const c = Math.floor(N / 2); [cam.x, cam.y] = cpos(c, c).map(v => v * T); }
function clampCam() { const [ww, wh] = worldSize(); cam.x = Math.max(0, Math.min(T * ww, cam.x)); cam.y = Math.max(0, Math.min(T * wh, cam.y)); }

function onTap(sx, sy) {
  const [wx, wy] = toWorld(sx, sy); const [x, y] = worldToTile(wx, wy);
  if (UI.mode === 'place' || UI.mode === 'move') {
    UI.px = Math.max(0, Math.min(N - 1, x)); UI.py = Math.max(0, Math.min(N - 1, y));
    UI.mode === 'place' ? showPlacePanel() : showMovePanel();
    return;
  }
  if (!inMap(x, y)) { closeAll(); return; }
  const id = occ[idx(x, y)];
  if (id) { UI.sel = getB(id); closeAll(false); openInfo(); return; }
  closeAll();
  const t = S.tiles[idx(x, y)];
  if (t.res) toast(t.res.t === 'flower' ? '花畑（島レベル4以降で使います）' : t.res.t === 'cotton' ? `綿花畑 ${t.res.amt}/${t.res.max}（島レベル3以降で使います）` : `${resName(t.res.t)} ${t.res.amt}/${t.res.max}`);
}

// ============================================================
//  UI パネル
// ============================================================
const $ = id => document.getElementById(id);
const panels = ['buildmenu', 'placepanel', 'infopanel', 'storepanel', 'goalpanel', 'peoplepanel'];
function isOpen(p) { return !$(p).classList.contains('hidden'); }
function closeAll(resetSel = true) { if (shownNew.length) { S.newTypes = S.newTypes.filter(t => !shownNew.includes(t)); shownNew = []; } panels.forEach(p => $(p).classList.add('hidden')); if (resetSel) UI.sel = null; }
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { $(b.dataset.close).classList.add('hidden'); if (b.dataset.close === 'infopanel') UI.sel = null; }));
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
const iname = k => k === 'coins' ? '🪙' : ITEMS[k].name;
function costText(cost) { return Object.entries(cost).map(([k, v]) => iname(k) + v).join('＋'); }
function costHtml(cost, check) {
  let h = '';
  for (const k in cost) {
    const have = k === 'coins' ? S.coins : invCount(k), ng = check && have < cost[k];
    h += `<div class="line"><span class="lbl">${k === 'coins' ? '🪙 コイン' : ITEMS[k].name}</span><span class="val ${ng ? 'red' : ''}">${cost[k]}${check ? ` <small>(所持 ${have})</small>` : ''}</span></div>`;
  }
  return h;
}
function iconCanvas(type) { const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.getContext('2d').drawImage(sprite(type), 0, 0); return c; }
function gaugeLine(label, v, max, cls) { return `<div class="line"><span class="lbl">${label}</span><div class="gauge ${cls || ''}"><div style="width:${Math.min(100, v / max * 100)}%"></div></div><span class="val">${Math.floor(v)}/${max}</span></div>`; }
// 白っぽい色は濃くして文字色に使う
function itemTextColor(k) {
  const c = ITEMS[k].color, r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255; if (lum < 0.62) return c;
  const f = 0.62 / lum * 0.75, h = v => Math.round(v * f).toString(16).padStart(2, '0'); return '#' + h(r) + h(g) + h(b);
}

// --- 建築メニュー ---
$('btn-build').addEventListener('click', () => { if (UI.mode !== 'normal') return; closeAll(); openBuildMenu(); });
let shownNew = [];
function openBuildMenu() {
  if (shownNew.length) { S.newTypes = S.newTypes.filter(t => !shownNew.includes(t)); shownNew = []; }
  const tabs = $('build-tabs'); tabs.innerHTML = '';
  for (const c of CATS) { const b = document.createElement('button'); b.className = 'tab' + (S.lastTab === c.id ? ' active' : ''); b.textContent = c.name; if (S.newTypes.some(t => BUILD[t].cat === c.id)) b.innerHTML += '<span class="new">N</span>'; b.onclick = () => { S.lastTab = c.id; openBuildMenu(); }; tabs.appendChild(b); }
  const list = $('build-list'); list.innerHTML = '';
  for (const type in BUILD) {
    const d = BUILD[type]; if (d.cat !== S.lastTab) continue;
    const el = document.createElement('div'); el.appendChild(iconCanvas(type));
    if (!S.unlocked.includes(type)) {
      el.className = 'bitem disabled'; el.insertAdjacentHTML('beforeend', `<div>🔒${d.name}</div><div class="bcost">目標で解放</div>`);
      el.addEventListener('click', () => toast(`${d.name}は目標を進めると建てられるようになります`));
      list.appendChild(el); continue;
    }
    const ok = canAfford(buildCost(type));
    el.className = 'bitem' + (ok ? '' : ' short');
    el.insertAdjacentHTML('beforeend', `<div>${d.name}</div><div class="bcost ${ok ? '' : 'red'}">${costText(buildCost(type))}</div><div class="bcnt">${countType(type)}棟</div>`);
    if (S.newTypes.includes(type)) { el.insertAdjacentHTML('beforeend', '<span class="ribbon">NEW</span>'); shownNew.push(type); }
    let lp = null, fired = false, p0 = null;
    const down = (x, y) => { fired = false; p0 = [x, y]; lp = setTimeout(() => { fired = true; showDetail(type); }, 500); };
    const move = (x, y) => { if (p0 && Math.hypot(x - p0[0], y - p0[1]) > 10) { clearTimeout(lp); fired = true; } };
    const up = () => { clearTimeout(lp); if (!fired) startPlace(type); fired = true; };
    if (window.PointerEvent) {
      el.addEventListener('pointerdown', e => down(e.clientX, e.clientY)); el.addEventListener('pointermove', e => move(e.clientX, e.clientY));
      el.addEventListener('pointercancel', () => { clearTimeout(lp); fired = true; }); el.addEventListener('pointerup', up);
    } else {
      el.addEventListener('touchstart', e => down(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
      el.addEventListener('touchmove', e => move(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
      el.addEventListener('touchcancel', () => { clearTimeout(lp); fired = true; });
      el.addEventListener('touchend', e => { e.preventDefault(); up(); });
      el.addEventListener('mousedown', e => down(e.clientX, e.clientY)); el.addEventListener('mousemove', e => move(e.clientX, e.clientY)); el.addEventListener('mouseup', up);
    }
    el.addEventListener('contextmenu', e => e.preventDefault());
    list.appendChild(el);
  }
  $('buildmenu').classList.remove('hidden');
}
function showDetail(type) {
  const d = BUILD[type];
  let extra = '';
  if (d.kind === 'prod') extra = `<div>レシピ：${d.recipes.map(r => `${Object.entries(RECIPES[r].need).map(([k, v]) => ITEMS[k].name + v).join('＋')} → ${ITEMS[RECIPES[r].out].name}${RECIPES[r].buy ? '（🪙' + recipeCost(r) + 'で購入）' : ''}`).join(' / ')}</div>`;
  modal(d.name, `<div>${d.desc}</div>${extra}<div style="margin-top:8px"><b>建築の材料</b>${costHtml(buildCost(type), true)}</div><div class="hint">今 ${countType(type)}棟</div>`);
}
function startPlace(type) {
  UI.mode = 'place'; UI.placeType = type; UI.sel = null;
  { const [px, py] = worldToTile(cam.x, cam.y); UI.px = Math.max(0, Math.min(N - 1, px)); UI.py = Math.max(0, Math.min(N - 1, py)); }
  if (shownNew.length) { S.newTypes = S.newTypes.filter(t => !shownNew.includes(t)); shownNew = []; }
  $('buildmenu').classList.add('hidden'); showPlacePanel();
}
function showPlacePanel() {
  const d = BUILD[UI.placeType];
  $('place-title').textContent = `${d.name} を配置（タップで位置変更）`;
  $('place-cost').innerHTML = costHtml(buildCost(UI.placeType), true) + (UI.placeType === 'house' && S.stage >= CONFIG.HOUSE_LV1_FROM ? '<div class="hint">島レベル6からは、最初から住居レベル1の自宅を建てます</div>' : '') + (d.kind === 'market' ? `<div class="hint">青い枠が配達できる範囲（${rangeText(CONFIG.MARKET.range)}）</div>` : d.kind === 'gather' && !d.noTile ? `<div class="hint">${AROUND}の資源から採ります</div>` : '');
  $('place-ok').disabled = !(canPlace(UI.placeType, UI.px, UI.py) && canAfford(buildCost(UI.placeType))); $('place-ok').textContent = '建築する';
  $('place-cancel').onclick = () => { UI.mode = 'normal'; $('placepanel').classList.add('hidden'); openBuildMenu(); };
  $('place-ok').onclick = () => { const b = build(UI.placeType, UI.px, UI.py); if (b) { UI.mode = 'normal'; $('placepanel').classList.add('hidden'); toast(`${d.name}を建てました`); save(); UI.sel = b; openInfo(); } };
  $('placepanel').classList.remove('hidden');
}
function showMovePanel() {
  const b = UI.moveB;
  $('place-title').textContent = `${bname(b)} を移動（タップで移動先を選択）`;
  $('place-cost').innerHTML = '<div class="hint">移動は無料です</div>';
  $('place-ok').disabled = !canPlace(b.type, UI.px, UI.py, b.id); $('place-ok').textContent = '決定';
  $('place-cancel').onclick = () => { UI.mode = 'normal'; UI.moveB = null; $('placepanel').classList.add('hidden'); };
  $('place-ok').onclick = () => { if (moveBuilding(b, UI.px, UI.py)) { UI.mode = 'normal'; UI.moveB = null; $('placepanel').classList.add('hidden'); save(); } };
  $('placepanel').classList.remove('hidden');
}

// --- 施設パネル ---
function openInfo() { $('infopanel').classList.remove('hidden'); renderInfo(); }
function renderInfo() {
  const b = UI.sel; if (!b || !getB(b.id)) { $('infopanel').classList.add('hidden'); return; }
  const d = BUILD[b.type];
  $('info-title').textContent = bname(b);
  let h = '';
  const workersLine = () => `<div class="line"><span class="lbl">作業員 ${b.workers}/${maxWorkers(b)}人 <small>（手の空いた人 ${freeWorkers()}）</small></span><button class="btn small" id="w-minus" ${b.workers === 0 ? 'disabled' : ''}>－</button><button class="btn small" id="w-plus" ${(b.workers >= maxWorkers(b) || freeWorkers() <= 0) ? 'disabled' : ''}>＋</button></div>`;
  const status = s => `<div class="line status"><span class="lbl">${s}</span></div>`;
  if (d.kind === 'gather') {
    if (d.choose) h += `<div class="line"><span class="lbl">採るもの</span></div><div class="resbtns">` + d.choose.map(r => resAvailable(r) ? `<button class="btn small resb ${b.res === r ? 'on' : ''}" data-r="${r}">${ITEMS[r].name}</button>` : `<button class="btn small" disabled>🔒${ITEMS[r].name}</button>`).join('') + `</div>`;
    else h += `<div class="line"><span class="lbl">採るもの</span><span class="val">${ITEMS[b.res].name}</span></div>`;
    h += workersLine();
    h += boostHtml(b);
    const tg = d.noTile ? null : gatherTarget(b);
    let st;
    if (b.workers === 0) st = '⏸ 停止中（作業員を置いてください）';
    else if (invRoom(b.res) <= 0) st = `📦 ${ITEMS[b.res].name}がインベントリの上限（${invCap(b.res)}）です`;
    else if (!d.noTile && !tg) st = `🔍 周りに${resName(b.res)}がありません（回復待ち、または移動）`;
    else st = '⛏ 採集中';
    h += status(st);
    h += `<div class="line"><span class="lbl">採集速度</span><span class="val">${b.workers ? (workSec(b) / b.workers / (boostTool(b) && b.boost > 0 ? 2 : 1)).toFixed(0) + '秒/個' + (boostTool(b) && b.boost > 0 ? ' <small>(道具で2倍)</small>' : '') : '停止'}</span></div>`;
    if (b.res === 'honey') { const hs = S.buildings.filter(h => h.type === 'hive' && tileRange(h.x, h.y, b.x, b.y) <= CONFIG.GATHER_RANGE); h += `<div class="line"><span class="lbl">周りの巣箱</span><span class="val">${hs.length}個・蜂の巣 ${hs.reduce((a, x) => a + x.combs, 0)}</span></div>`; }
    else if (!d.noTile) { let a = 0, m = 0; for (const [x, y] of tilesWithin(b.x, b.y, CONFIG.GATHER_RANGE)) { const t = S.tiles[idx(x, y)]; if (t.res && t.res.t === b.res && !occ[idx(x, y)]) { a += t.res.amt; m += t.res.max; } } h += `<div class="line"><span class="lbl">周りの${resName(b.res)}</span><span class="val">${a}/${m}</span></div>`; }
    h += `<div class="line"><span class="lbl">インベントリ</span><span class="val">${ITEMS[b.res].name} ${invCount(b.res)}/${invCap(b.res)}</span></div>`;
  } else if (d.kind === 'prod') {
    const r = RECIPES[b.recipe], it = ITEMS[r.out];
    h += `<div class="line"><span class="lbl">レシピ${b.dual ? '1' : ''}</span>${d.recipes.length > 1 ? `<button class="recipe-btn" id="pick-recipe">${recipeLabel(b.recipe)}　▼</button>` : `<span class="val">${recipeLabel(b.recipe)}</span>`}</div>`;
    if (b.dual) h += `<div class="line"><span class="lbl">レシピ2</span><button class="recipe-btn" id="pick-recipe2">${b.recipe2 ? recipeLabel(b.recipe2) : '（選ぶ）'}　▼</button></div>`;
    if (!recipeOwned(b.recipe)) h += `<div class="line buyable"><span class="lbl">📜 <b>${it.name}のレシピ</b>が必要です<br><small>買うと島のどの${d.name}でも作れます</small></span>` + (recipeUnlocked(b.recipe) ? `<button class="btn small primary" id="buy-recipe" ${S.coins >= recipeCost(b.recipe) ? '' : 'disabled'}>🪙${recipeCost(b.recipe)}で買う</button>` : `<span class="val"><small>🔒島レベル${RECIPE_LV[b.recipe]}から</small></span>`) + `</div>`;
    h += workersLine();
    let st; const miss = recipeOwned(b.recipe) ? missingMats(b) : [];
    const dualWait = b.dual && !b.active && b.workers && prodRecipes(b).length > 1 ? prodRecipes(b).filter(recipeOwned).map(x => `${ITEMS[RECIPES[x].out].name}（${invRoom(RECIPES[x].out) <= 0 ? '上限' : missingFor(x).map(m => ITEMS[m].name).join('・')}）`) : null;
    if (!recipeOwned(b.recipe)) st = '📜 レシピを買うと作れます';
    else if (b.workers === 0) st = '⏸ 停止中（作業員を置いてください）';
    else if (b.active && invRoom(r.out) <= 0) st = `📦 ${it.name}がインベントリの上限です`;
    else if (dualWait && dualWait.length > 1) st = `🔍 材料待ち：${dualWait.join('／')}`;
    else if (b.active) st = `⚙️ 生産中${b.dual ? '：' + ITEMS[RECIPES[curRecipe(b)].out].name : ''}`;
    else if (invRoom(r.out) <= 0) st = `📦 ${it.name}がインベントリの上限（${invCap(r.out)}）です`;
    else if (miss.length) st = `🔍 材料待ち：${miss.map(m => ITEMS[m].name + (reserveOf(m) && invCount(m) >= r.need[m] ? '（確保のため使えません）' : '')).join('・')}`;
    else st = '…';
    h += status(st);
    h += `<div class="line"><span class="lbl">生産速度</span><span class="val">${b.workers ? (workSec(b) / b.workers).toFixed(0) + '秒/個' : '停止'}</span></div>`;
    h += gaugeLine('生産進捗', b.active ? b.prog * 100 : 0, 100, 'prog');
    for (const rk of prodRecipes(b)) { const rr = RECIPES[rk]; h += `<div class="line"><span class="lbl">インベントリ</span><span class="val">${Object.keys(rr.need).map(k => `${ITEMS[k].name} ${invAvail(k)}`).join('・')} → ${ITEMS[rr.out].name} ${invCount(rr.out)}</span></div>`; }
    h += extraLine('dual', b);
  } else if (d.kind === 'market') {
    const up = marketUpCost(b);
    h += `<div class="line"><span class="lbl">規模Lv ${b.lv || 1} <small>作業員${maxWorkers(b)}人まで</small></span>` + (up ? (S.stage < marketUpStage(b) ? `<span class="val"><small>島レベル${marketUpStage(b)}から</small></span>` : `<button class="btn small" id="mk-up" ${canAfford(up) ? '' : 'disabled'}>⬆ ${costText(up)}</button>`) : '<span class="val">最大</span>') + `</div>`;
    h += workersLine();
    const hs = S.buildings.filter(x => x.type === 'house' && inMarketRange(b, x)), rn = hs.reduce((a, x) => a + residentsOf(x).length, 0);
    h += status(b.workers === 0 ? '⏸ 停止中（作業員を置いてください）' : b.jobs.length ? `🚶 配達中 ${b.jobs.length}人` : '👀 配達を待っています（範囲内で30%を切った品なし、または在庫なし）');
    if (b.slots.length < CONFIG.MARKET_SLOT_UP.slots) h += `<div class="line"><span class="lbl">販売スロット ${b.slots.length}個</span>` + (marketSlotUpOk(b) ? `<button class="btn small" id="mk-slot" ${canAfford(CONFIG.MARKET_SLOT_UP.cost) ? '' : 'disabled'}>⬆ ${CONFIG.MARKET_SLOT_UP.slots}個に ${costText(CONFIG.MARKET_SLOT_UP.cost)}</button>` : `<span class="val"><small>島レベル${CONFIG.MARKET_SLOT_UP.stage}から${CONFIG.MARKET_SLOT_UP.slots}個に</small></span>`) + `</div>`;
    h += `<div class="line"><span class="lbl">配達範囲</span><span class="val">${rangeText(marketRange(b))} <small>家${hs.length}軒・${rn}人</small></span></div>`;
    h += `<div class="hint" style="text-align:left">販売品（タップで変更）。満足度ゲージが${CONFIG.DELIVER_BELOW}%を切った住民に、近い家から配ります。自動補充は確保を除いた在庫から</div>`;
    b.slots.forEach((s, i) => {
      h += `<div class="mkslot"><button class="recipe-btn mk-item" data-i="${i}">${s.item ? ITEMS[s.item].name : '（なし）'}</button>` +
        (s.item ? `<span class="mkst">${s.stock}/${marketStock()}</span><button class="btn small mk-auto ${s.auto ? 'on' : ''}" data-i="${i}">${s.auto ? '自動' : '手動'}</button><button class="btn small mk-fill" data-i="${i}" ${s.stock >= marketStock() || !invCount(s.item) ? 'disabled' : ''}>補充</button>` : '') + `</div>`;
    });
  } else if (d.kind === 'hive') {
    h += gaugeLine('蜂の巣', b.combs, CONFIG.COMB_MAX);
    h += status(nearFlower(b.x, b.y) ? (b.combs >= CONFIG.COMB_MAX ? '🐝 満杯です' : `🐝 ${CONFIG.COMB_SEC}秒に1個たまります`) : '🌼 隣に花畑がありません（移動してください）');
    h += `<div class="hint" style="text-align:left">作業員はいりません。島レベル5で養蜂場ができると、ここからハチミツを採れます。</div>`;
  } else if (d.kind === 'house') {
    const rs = residentsOf(b);
    const hc = houseUpCost(b);
    h += `<div class="line"><span class="lbl">住居レベル ${b.lv || 0}</span>` + (hc ? (S.stage < houseUpStage() ? `<span class="val"><small>島レベル${houseUpStage()}から</small></span>` : `<button class="btn small" id="house-up" ${canAfford(hc) ? '' : 'disabled'}>⬆ ${costText(hc)}</button>`) : '<span class="val">最大</span>') + `</div>`;
    h += `<div class="line"><span class="lbl">住民</span><span class="val">${rs.length}/${CONFIG.HOUSE_CAP}人</span></div>`;
    const ms = S.buildings.filter(m => m.type === 'market' && inMarketRange(m, b));
    if (!ms.length) h += `<div class="hint red" style="text-align:left">⚠ どの市場の配達範囲にも入っていません</div>`;
    rs.forEach(r => { h += `<div class="line"><span class="lbl">住民${r.id}</span><span class="val satv">${activeCats().map(c => { const v = Math.round(resSat(r, c)); return `<span class="${v >= needPct() ? '' : 'red'}">${CATS_SAT[c]} ${v}%</span>`; }).join('　')}</span></div>`; });
  }
  h += extraLine('workers', b) + extraLine('range', b);
  $('info-body').innerHTML = h;
  let acts = `<button class="btn" id="a-move">移動</button><button class="btn danger" id="a-demo">取り壊す</button>`;
  $('info-actions').innerHTML = acts;
  const wm = $('w-minus'), wp = $('w-plus');
  if (wm) wm.onclick = () => { setWorkers(b, b.workers - 1); renderInfo(); };
  if (wp) wp.onclick = () => { setWorkers(b, b.workers + 1); renderInfo(); };
  document.querySelectorAll('.resb').forEach(el => el.onclick = () => { setRes(b, el.dataset.r); save(); renderInfo(); });
  const br = $('buy-recipe'); if (br) br.onclick = () => { if (buyRecipe(b.recipe)) save(); renderInfo(); };
  const pr = $('pick-recipe'); if (pr) pr.onclick = () => pickRecipe(b);
  const pr2 = $('pick-recipe2'); if (pr2) pr2.onclick = () => pickRecipe(b, 2);
  document.querySelectorAll('#info-body .extra').forEach(el => el.onclick = () => { if (buyExtra(el.dataset.k, b)) save(); renderInfo(); });
  const bt = $('boost-add'); if (bt) bt.onclick = () => { if (addBoost(b, true)) { toast(`${ITEMS[boostTool(b)].name}を入れました`); save(); } renderInfo(); };
  const ba = $('boost-auto'); if (ba) ba.onclick = () => { b.autoBoost = !b.autoBoost; save(); renderInfo(); };
  const mu = $('mk-up'); if (mu) mu.onclick = () => { if (marketUp(b)) save(); renderInfo(); };
  const msu = $('mk-slot'); if (msu) msu.onclick = () => { if (marketSlotUp(b)) save(); renderInfo(); };
  const hu = $('house-up'); if (hu) hu.onclick = () => { if (houseUp(b)) save(); renderInfo(); };
  document.querySelectorAll('.mk-item').forEach(el => el.onclick = () => pickMarketItem(b, +el.dataset.i));
  document.querySelectorAll('.mk-auto').forEach(el => el.onclick = () => { const s = b.slots[+el.dataset.i]; s.auto = !s.auto; save(); renderInfo(); });
  document.querySelectorAll('.mk-fill').forEach(el => el.onclick = () => { const n = marketRefillManual(b, +el.dataset.i); toast(n ? `${n}個 補充しました` : '補充できる在庫がありません'); save(); renderInfo(); });
  $('a-move').onclick = () => { UI.mode = 'move'; UI.moveB = b; UI.px = b.x; UI.py = b.y; $('infopanel').classList.add('hidden'); showMovePanel(); };
  $('a-demo').onclick = () => {
    const ref = demolishRefund(b);
    let note = `<div>${bname(b)}を取り壊します。</div><div>材料の半分（${costText(ref) || 'なし'}）が戻ります。</div>`;
    if (b.workers) note += `<div>作業員 ${b.workers}人は手が空きます。</div>`;
    if (b.type === 'house' && residentsOf(b).length) note += `<div class="red">住んでいる${residentsOf(b).length}人は家を失います。</div>`;
    if (b.slots) note += `<div>市場の在庫はインベントリに戻ります。</div>`;
    modal('取り壊しの確認', note, () => { demolish(b); UI.sel = null; $('infopanel').classList.add('hidden'); toast(`${BUILD[b.type].name}を取り壊しました`); save(); }, true);
  };
}
function pickMarketItem(m, i) {
  const cand = S.invOrder.filter(k => ITEMS[k].cat && itemCounts(k));
  let h = `<div class="line"><button class="recipe-btn pick" data-it="">（なし）</button></div>`;
  for (const k of cand) {
    if (m.slots.some((s, j) => j !== i && s.item === k)) continue;
    const counts = itemCounts(k);
    h += `<div class="mkrow2"><button class="recipe-btn pick" data-it="${k}">${ITEMS[k].name}</button><div class="mkinfo"><div class="mkprice">🪙${ITEMS[k].price}　${counts ? `${CATS_SAT[ITEMS[k].cat]} ${ITEMS[k].pts}pt` : '<span class="red">今の島レベルでは満足度にならない</span>'}</div><div class="mksub">在庫 ${invAvail(k)}${reserveOf(k) ? `（＋確保${Math.min(reserveOf(k), invCount(k))}）` : ''}</div></div></div>`;
  }
  if (!cand.length) h += '<div class="hint">配れる品がまだありません（水など、今の島レベルで満足度になる品を手に入れましょう）</div>';
  h += `<div class="hint">満足度のない品（木材など）はインベントリ（📦）から売れます</div>`;
  modal('販売品を選ぶ', h);
  document.querySelectorAll('.pick').forEach(el => el.onclick = () => { setMarketItem(m, i, el.dataset.it || null); $('modal').classList.add('hidden'); renderInfo(); save(); });
}


// 道具のブースト欄（伐採所・採石所・採集所）
function boostHtml(b) {
  const d = BUILD[b.type]; if (!d.tool) return '';
  const tool = boostTool(b);
  if (!tool) return `<div class="line"><span class="lbl"><small>🔧 ${ITEMS[d.tool].name}は${d.toolRes.map(r => ITEMS[r].name).join('・')}を採るときだけ使えます</small></span></div>`;
  const n = invCount(tool), left = boostLeftSec(b), cnt = boostCount(b);
  const st = b.boost > 0 ? `⚡ 2倍速 残り${Math.floor(left / 60)}分${String(Math.floor(left % 60)).padStart(2, '0')}秒${b.workers ? '' : '（作業員0人なので止まっています）'}` : '道具なし';
  return `<div class="line boostline"><span class="lbl">🔧 ${ITEMS[tool].name} <small>${st}<br>中に${cnt.toFixed(1)}個ぶん（${CONFIG.BOOST_MAX}個まで）・在庫${n}</small></span>` +
    `<button class="btn small" id="boost-add" ${canAddBoost(b) && n > 0 ? '' : 'disabled'}>入れる</button><button class="btn small ${b.autoBoost ? 'on' : ''}" id="boost-auto">自動${b.autoBoost ? 'ON' : 'OFF'}</button></div>`;
}
// 島レベル10の強化ボタン
function extraLine(key, b) {
  if (S.stage < CONFIG.EXTRA.stage || (b && !extraOk(key, b))) return '';
  const c = extraCost(key, b), lv = extraLv(key, b), E = CONFIG.EXTRA[key];
  const desc = key === 'inv' ? `インベントリ上限 ${invCap()}${c ? '→' + (invCap() + E.cap) : ''}・市場の在庫 ${marketStock()}${c ? '→' + (marketStock() + E.stock) : ''}`
    : key === 'range' ? `${marketRange(b)}${c ? '→' + (marketRange(b) + 1) : ''}マス以内`
    : key === 'dual' ? (lv ? '2つのレシピを交互に作ります' : '2つのレシピを交互に作れるようにする')
    : `作業員 ${maxWorkers(b)}${c ? '→' + (maxWorkers(b) + 1) : ''}人まで`;
  return `<div class="line extraline"><span class="lbl">✨ ${E.name}${E.cost.length > 1 ? ` <small>${lv}/${E.cost.length}</small>` : ''}<br><small>${desc}</small></span>` +
    (c ? `<button class="btn small extra" data-k="${key}" ${S.coins >= c ? '' : 'disabled'}>🪙${c.toLocaleString()}</button>` : '<span class="val">最大</span>') + `</div>`;
}
function recipeLabel(rk) { const r = RECIPES[rk]; return `${Object.entries(r.need).map(([k, v]) => ITEMS[k].name + v + (k === r.fuel ? '(燃料)' : '')).join('＋')} → <b>${ITEMS[r.out].name}</b>`; }
function pickRecipe(b, slot = 1) {
  const d = BUILD[b.type];
  let h = '';
  for (const r of d.recipes) {
    const label = recipeLabel(r), mine = slot === 2 ? b.recipe2 : b.recipe, other = slot === 2 ? b.recipe : b.recipe2;
    if (recipeOwned(r)) h += `<div class="line"><button class="recipe-btn pick" data-r="${r}" ${b.dual && other === r ? 'disabled' : ''}>${label}${mine === r ? '　✔' : b.dual && other === r ? '　（もう1つのレシピ）' : ''}</button></div>`;
    else if (!recipeUnlocked(r)) h += `<div class="line"><span class="lbl" style="opacity:.55">${label}</span><span class="val"><small>🔒島レベル${RECIPE_LV[r]}から</small></span></div>`;
    else h += `<div class="line"><span class="lbl">${label}</span><button class="btn small buyr" data-r="${r}" ${S.coins >= recipeCost(r) ? '' : 'disabled'}>🪙${recipeCost(r)}で買う</button></div>`;
  }
  h += b.dual ? '<div class="hint" style="text-align:left">この施設は2つのレシピを交互に作ります（片方が材料待ちのときは、もう片方を続けて作ります）</div>'
    : `<div class="hint" style="text-align:left">1つの施設で作れるのは1つのレシピだけ。別の品も作りたいときは、同じ施設をもう1つ建てます${S.stage >= CONFIG.EXTRA.stage ? '（島レベル10では「2つのレシピ」で2つ作れます）' : ''}</div>`;
  modal(slot === 2 ? '2つ目のレシピを選ぶ' : 'レシピを選ぶ', h);
  document.querySelectorAll('.pick').forEach(el => el.onclick = () => { changeRecipe(b, el.dataset.r, slot); $('modal').classList.add('hidden'); save(); renderInfo(); });
  document.querySelectorAll('.buyr').forEach(el => el.onclick = () => { if (buyRecipe(el.dataset.r)) save(); pickRecipe(b, slot); });
}
function housesOutOfRange() { const ms = S.buildings.filter(b => b.type === 'market'); return S.buildings.filter(h => h.type === 'house' && residentsOf(h).length && !ms.some(m => inMarketRange(m, h))).length; }

// --- インベントリ ---
$('btn-store').addEventListener('click', () => { if (UI.mode !== 'normal') return; closeAll(); openStore(); });
function openStore() { $('storepanel').classList.remove('hidden'); renderStore(); }
function renderStore() {
  let h = '';
  h += extraLine('inv', null);
  if (!S.invOrder.length) h += '<div class="hint">まだ何もありません</div>';
  for (const k of S.invOrder) {
    const it = ITEMS[k], q = invCount(k), rv = reserveOf(k);
    h += `<div class="invrow"><div class="invname" style="color:${itemTextColor(k)}">${it.name}<small>${it.cat ? `${CATS_SAT[it.cat]}${it.pts}pt` : '素材'}・🪙${it.price}</small></div>` +
      `<div class="invq"><b>${q}</b>/${invCap(k)}</div>` +
      `<div class="invres"><small>確保</small><button class="btn small rv" data-k="${k}" data-d="-5">－</button><span>${rv}</span><button class="btn small rv" data-k="${k}" data-d="5">＋</button></div>` +
      `<div class="invsell"><small>売る</small><button class="btn small sell" data-k="${k}" data-n="1" ${q ? '' : 'disabled'}>1</button><button class="btn small sell" data-k="${k}" data-n="10" ${q >= 10 ? '' : 'disabled'}>10</button></div></div>`;
  }
  h += `<div class="hint" style="text-align:left">確保＝生産の材料や市場の自動補充に使わずに残す数。建築・アップグレード・市場の手動補充には使えます</div>`;
  $('store-body').innerHTML = h;
  document.querySelectorAll('#store-body .extra').forEach(el => el.onclick = () => { if (buyExtra(el.dataset.k, null)) save(); renderStore(); });
  document.querySelectorAll('.rv').forEach(el => el.onclick = () => { setReserve(el.dataset.k, reserveOf(el.dataset.k) + +el.dataset.d); save(); renderStore(); });
  document.querySelectorAll('.sell').forEach(el => el.onclick = () => { const k = el.dataset.k, n = sellItem(k, +el.dataset.n); if (n) toast(`${ITEMS[k].name}を${n}個売りました（🪙+${n * ITEMS[k].price}）`); save(); renderStore(); });
}

// --- 住民・満足度パネル ---
['st-pop', 'st-happy', 'st-free'].forEach(id => $(id).addEventListener('click', () => { if (UI.mode !== 'normal') return; closeAll(); openPeople(); }));
function openPeople() { $('peoplepanel').classList.remove('hidden'); renderPeople(); }
function renderPeople() {
  const need = needPct(), gb = growBlock();
  let h = `<div class="line"><span class="lbl">人口</span><span class="val">${S.pop}人 <small>(住居の定員 ${houseCapacity()}・島レベル${S.stage}の上限 ${stageCap() === Infinity ? "なし" : stageCap()})</small></span></div>`;
  h += `<div class="line"><span class="lbl">手の空いた人</span><span class="val">${freeWorkers()}人</span></div>`;
  h += `<div class="sub">満足度 <small>（${CONFIG.DIFFICULTY[S.diff].name}：すべて${need}%以上で3分ごとに1人増えます）</small></div>`;
  for (const c of activeCats()) { const v = catSat(c); h += `<div class="happybox ${v >= need ? 'ok' : ''}"><div class="hb-row"><span>${CATS_SAT[c]}</span><b>${Math.floor(v)}%</b><span>必要</span><b>${need}%</b></div><div class="hb-gauge"><div class="hb-fill" style="width:${Math.min(100, v)}%"></div><div class="hb-mark" style="left:${need}%"></div></div><div class="hb-msg">配る品：${stageItems().filter(k => ITEMS[k].cat === c).map(k => `${ITEMS[k].name}(${ITEMS[k].pts}pt)`).join('・')}　分母 ${denoms()[c]}</div></div>`; }
  h += `<div class="line"><span class="lbl">住</span><span class="val ${housedAll() ? '' : 'red'}">${housedAll() ? '全員が住居に住んでいます' : `家のない住民 ${S.residents.filter(r => !r.house).length}人`}</span></div>`;
  if (houseNeed()) { const v = housePct(); h += `<div class="happybox ${v >= houseNeed() ? 'ok' : ''}"><div class="hb-row"><span>住（住居レベル1の割合）</span><b>${Math.floor(v)}%</b><span>必要</span><b>${houseNeed()}%</b></div><div class="hb-gauge"><div class="hb-fill" style="width:${Math.min(100, v)}%"></div><div class="hb-mark" style="left:${houseNeed()}%"></div></div><div class="hb-msg">人が住んでいる自宅のうち、住居レベル1の割合</div></div>`; }
  h += `<div class="hint ${gb ? 'red' : ''}" style="text-align:left">${gb ? '⚠ ' + gb : `✅ あと${Math.ceil(CONFIG.POP_GROW_SEC - S.timers.grow)}秒で1人増えます`}</div>`;
  h += `<div class="sub">作業員の割り当て</div>`;
  const work = S.buildings.filter(b => maxWorkers(b) > 0).sort((a, b) => a.order - b.order);
  if (!work.length) h += `<div class="hint">まだ作業できる施設がありません</div>`;
  for (const b of work) {
    const d = BUILD[b.type], what = d.kind === 'gather' ? ITEMS[b.res].name : d.kind === 'prod' ? prodRecipes(b).map(r => ITEMS[RECIPES[r].out].name).join('・') : '配達';
    h += `<div class="line"><span class="lbl"><a class="jump" data-id="${b.id}">${bname(b)}</a> <small>${what}</small></span><span class="val">${b.workers}/${maxWorkers(b)}</span><button class="btn small pw-minus" data-id="${b.id}" ${b.workers === 0 ? 'disabled' : ''}>－</button><button class="btn small pw-plus" data-id="${b.id}" ${(b.workers >= maxWorkers(b) || freeWorkers() <= 0) ? 'disabled' : ''}>＋</button></div>`;
  }
  $('people-body').innerHTML = h;
  document.querySelectorAll('.pw-minus').forEach(el => el.onclick = () => { const b = getB(+el.dataset.id); setWorkers(b, b.workers - 1); renderPeople(); });
  document.querySelectorAll('.pw-plus').forEach(el => el.onclick = () => { const b = getB(+el.dataset.id); setWorkers(b, b.workers + 1); renderPeople(); });
  document.querySelectorAll('.jump').forEach(el => el.onclick = () => { const b = getB(+el.dataset.id); [cam.x, cam.y] = cpos(b.x, b.y).map(v => v * T); UI.sel = b; closeAll(false); openInfo(); });
}

// --- 目標・島レベル ---
$('btn-goal').addEventListener('click', () => { if (UI.mode !== 'normal') return; closeAll(); openGoals(); });
$('goalbar').addEventListener('click', () => { if (UI.mode !== 'normal') return; closeAll(); openGoals(); });
function openGoals() { $('goalpanel').classList.remove('hidden'); renderGoal(); }
function renderGoal() {
  const sd = stageDef();
  let h = `<div class="sub">島レベル${S.stage} <small>${sd.cap === Infinity ? '自由モード（人口の上限なし）' : `人口${sd.cap}人まで`}${sd.house ? `・住居レベル1 ${sd.house}%` : ''}・${activeCats().map(c => CATS_SAT[c]).join('・')}の満足度</small></div>`;
  const hidden = sd.goals.filter(g => !goalDone(g.id) && !goalVisible(g)).length;
  for (const g of sd.goals) {
    const done = goalDone(g.id), vis = goalVisible(g); if (!done && !vis) continue;
    const p = Math.min(g.n, g.prog()); const hint = g.hint && !done ? `<div class="gr">${g.hint}</div>` : '';
    h += `<div class="goal ${done ? 'done' : ''}"><div class="gt">${done ? '✅' : '🎯'} ${g.text}</div>${done ? '' : `<div class="gr">進捗 ${p} / ${g.n}${g.unlock ? '　達成で ' + g.unlock.map(t => BUILD[t].name).join('・') + ' を解放' : ''}</div>`}${hint}</div>`;
  }
  if (hidden) h += `<div class="goal locked"><div class="gt">🔒 ほかに${hidden}つの目標（今の目標を進めると出てきます）</div></div>`;
  if (stageComplete()) h += hasNextStage() ? `<div class="row"><button class="btn primary" id="stage-up">🎉 島レベル${S.stage}を達成！ 島レベル${S.stage + 1}へ</button></div>` : `<div class="hint">🎉 島レベル${S.stage}を達成しました。次の島レベルは準備中です</div>`;
  $('goal-body').innerHTML = h;
  const su = $('stage-up'); if (su) su.onclick = () => { if (advanceStage()) { save(); renderGoal(); } };
}

// --- 設定（難易度・やり直し） ---
$('btn-reset').addEventListener('click', () => { if (UI.mode !== 'normal') return; closeAll(); openSettings(); });
function openSettings() {
  let h = `<div class="sub">難易度 <small>（人口が増えるのに必要な満足度。いつでも変えられます）</small></div><div class="row">` +
    Object.entries(CONFIG.DIFFICULTY).map(([k, v]) => `<button class="btn diff ${S.diff === k ? 'primary' : ''}" data-k="${k}">${v.name}<br><small>${v.need}%</small></button>`).join('') + `</div>`;
  h += `<div class="row" style="margin-top:14px"><button class="btn danger" id="do-reset">最初からやり直す</button></div><div class="hint">バージョン ${VERSION}　保存キー ${CONFIG.SAVE_KEY}</div>`;
  modal('設定', h);
  document.querySelectorAll('.diff').forEach(el => el.onclick = () => { S.diff = el.dataset.k; save(); openSettings(); });
  $('do-reset').onclick = () => modal('最初からやり直す', '<div>今の島のデータを消して、新しい島を始めます。元には戻せません。</div>', () => {
    try { localStorage.removeItem(CONFIG.SAVE_KEY); } catch (e) { }
    newGame(); villagers.length = 0; UI.mode = 'normal'; UI.sel = null; closeAll();
    centerCam(); save(); showWelcome();
  }, true);
}

// --- 上部バー・目標バー ---
function renderTop() {
  $('st-coins').querySelector('span').textContent = S.coins;
  // 人口／上限（住居がまだ無いときは「人口/人口」）。上限で止まっていれば赤
  const cap = countType('house') ? popCap() : S.pop;
  $('st-pop').querySelector('span').innerHTML = `${S.pop}<small>/${cap}</small>`;
  $('st-pop').classList.toggle('full', S.pop >= cap);
  $('st-free').querySelector('span').textContent = freeWorkers();
  const v = minSat(), need = needPct();
  $('st-happy').querySelector('span').innerHTML = `${Math.floor(v)}<small>/${need}%</small>`;
  $('st-happy').classList.toggle('ok', v >= need);
  $('btn-goal').textContent = stageComplete() && hasNextStage() ? '🎉' : '🎯';
  $('btn-goal').classList.toggle('pulse', stageComplete() && hasNextStage());
  $('build-badge').classList.toggle('hidden', S.newTypes.length === 0);
  renderGoalBar();
}
let goalBarHtml = '';
function renderGoalBar() {
  const el = $('goalbar');
  let h = '';
  if (stageComplete()) h = hasNextStage() ? `<div class="gb-row done"><span class="gb-i">🎉</span><span class="gb-t">島レベル${S.stage}の目標をすべて達成</span><span class="gb-p">タップで次の島レベルへ</span></div>` : `<div class="gb-row"><span class="gb-i">🎉</span><span class="gb-t">島レベル${S.stage}を達成（次の島レベルは準備中）</span></div>`;
  else if (freeMode()) h = `<div class="gb-row"><span class="gb-i">🏝</span><span class="gb-t">自由モード：満足度を保って島を大きくしましょう</span></div>`;
  else h = visibleGoals().slice(0, 3).map(g => `<div class="gb-row"><span class="gb-i">🎯</span><span class="gb-t">${g.text}</span><span class="gb-p">${Math.min(g.n, g.prog())}/${g.n}</span></div>`).join('');
  const gb = growBlock();
  if (gb && S.residents.length && countType('market')) h += `<div class="gb-warn">⚠ 人口が増えません：${gb}</div>`;
  const out = housesOutOfRange();
  if (out && countType('market')) h += `<div class="gb-warn">⚠ 市場の配達範囲の外に、人が住んでいる自宅が${out}軒あります</div>`;
  if (h !== goalBarHtml) { goalBarHtml = h; el.innerHTML = h; el.classList.toggle('hidden', !h); }
  const top = $('topbar').offsetHeight; if (top && el.style.top !== top + 'px') el.style.top = top + 'px';
  // お知らせは目標バーの下に出す
  const tt = (top || 52) + (el.classList.contains('hidden') ? 0 : el.offsetHeight) + 10; if ($('toast').style.top !== tt + 'px') $('toast').style.top = tt + 'px';
}
let prevPop = null;
function checkEvents() {
  if (prevPop !== null && S.pop > prevPop) notify(`👤 住民が増えました（${S.pop}人）`);
  prevPop = S.pop;
}

// ============================================================
//  起動・ループ
// ============================================================
function showWelcome() {
  modal('のんびり島ぐらしへようこそ', '<div>小さな島をのんびり育てる経営ゲームです。</div><div>・上の目標を順に進めると、新しい施設が建てられるようになります<br>・施設をタップして作業員（🙋 は手の空いている住民）を割り当てましょう<br>・作ったものは島のインベントリ（📦）に自動で入り、建築や生産にそのまま使えます<br>・市場が住民に品物を配ると満足度（😊）が上がり、必要な%を超えると3分ごとに住民が増えます<br>・満足度のない品（木材など）は📦から売ってコインにできます<br>・難易度は⚙️で変えられます。離れている間も進みます（最大12時間分）</div>');
}
function showWelcomeBack(acc) {
  const hrs = Math.floor(acc.elapsed / 3600), mins = Math.floor(acc.elapsed % 3600 / 60);
  const items = Object.keys(acc.items).map(k => `${ITEMS[k].name} +${acc.items[k]}`).join('、') || 'なし';
  modal('おかえりなさい', `<div>留守の間：約 ${hrs ? hrs + '時間' : ''}${mins}分${acc.elapsed >= CONFIG.OFFLINE_MAX_SEC ? `（上限${CONFIG.OFFLINE_MAX_SEC / 3600}時間分）` : ''}</div><div>🪙 収入 +${acc.coins}</div><div>👤 住民 +${acc.pop}</div><div>📦 つくった品：${items}</div>`);
}
function start() {
  resize();
  // iOS Safari：ダブルタップ・ピンチでページが拡大しないように（地図のズームはゲーム側で処理）
  let lastTouchEnd = 0;
  // 素早い2回目のタップは拡大を止め、ボタンならクリックとして扱う（＋ボタンの連打が効くように）
  document.addEventListener('touchend', e => { const now = Date.now(); if (now - lastTouchEnd < 350 && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') { e.preventDefault(); const btn = e.target.closest && e.target.closest('button'); if (btn && !btn.disabled) btn.click(); } lastTouchEnd = now; }, { passive: false });
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
  $('ver').textContent = 'v' + VERSION;
  const loaded = load();
  if (!loaded) newGame();
  centerCam();
  cam.s = Math.max(1, Math.min(4, (W - 16) / (T * 7)));
  if (!loaded) showWelcome(); else { const acc = offlineProgress(); if (acc) showWelcomeBack(acc); }
  $('btn-speed').onclick = () => { const i = CONFIG.SPEEDS.indexOf(S.speed || 1); S.speed = CONFIG.SPEEDS[(i + 1) % CONFIG.SPEEDS.length]; $('btn-speed').textContent = '⏩×' + S.speed; save(); };
  $('btn-speed').textContent = '⏩×' + (S.speed || 1);
  if (!CONFIG.DEBUG_SPEED) { S.speed = 1; $('btn-speed').classList.add('hidden'); }
  let last = performance.now(), saveT = 0, uiT = 0;
  function loop(now) {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    const total = dt * (S.speed || 1), steps = Math.ceil(total / 0.25);
    for (let i = 0; i < steps; i++) sim(total / steps, null);
    checkEvents();
    draw(); renderTop();
    uiT += dt; if (uiT > 0.5) { uiT = 0; if (isOpen('infopanel')) renderInfo(); if (isOpen('storepanel')) renderStore(); if (isOpen('goalpanel')) renderGoal(); if (isOpen('peoplepanel')) renderPeople(); }
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
