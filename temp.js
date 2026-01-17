/* ===== js/data/cards.js ===== */
/**
 * РљРђР РўРћР’Рђ Р‘РђР—Рђ Р“Р Р - 40 Р¤Р РђРљР¦Р†Р™, 240 РљРђР Рў
 * 
 * РЎС‚СЂСѓРєС‚СѓСЂР° РєР°СЂС‚Рё:
 * - id: СѓРЅС–РєР°Р»СЊРЅРёР№ С–РґРµРЅС‚РёС„С–РєР°С‚РѕСЂ (С„РѕСЂРјР°С‚: "F##-R#" РґРµ ## - РЅРѕРјРµСЂ С„СЂР°РєС†С–С—, # - СЂС–РґРєС–СЃС‚СЊ)
 * - element: "fire" | "water" | "air" | "earth"
 * - faction: ID С„СЂР°РєС†С–С—
 * - factionName: РќР°Р·РІР° С„СЂР°РєС†С–С—
 * - rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic"
 * - basePower: С„С–РЅР°Р»СЊРЅР° СЃРёР»Р° РєР°СЂС‚Рё (base * multiplier)
 * - multiplier: РјРЅРѕР¶РЅРёРє СЂС–РґРєРѕСЃС‚С– (РґР»СЏ СЂРѕР·СЂР°С…СѓРЅРєС–РІ)
 * - upgradeMult: РјРЅРѕР¶РЅРёРє РїСЂРѕРєР°С‡РєРё (РґР»СЏ СЃРёСЃС‚РµРјРё СЂС–РІРЅС–РІ)
 * - attack: Р°С‚Р°РєР° (РґРѕСЂС–РІРЅСЋС” basePower)
 * - defense: Р·Р°С…РёСЃС‚ (80% РІС–Рґ basePower)
 * - name: С–Рј'СЏ РєР°СЂС‚Рё
 */

// =========================================================
// TASKS DATA
// =========================================================

const TASKS = [
  {
    id: "duel_1",
    title: "РџРµСЂС€РёР№ Р±С–Р№",
    desc: "Р—С–РіСЂР°Р№С‚Рµ 1 РґСѓРµР»СЊ",
    type: "duel",
    target: 1,
    reward: { xp: 50, gears: 1 }
  },
  {
    id: "duel_10",
    title: "Р РѕР·С–РіСЂС–РІ",
    desc: "Р—С–РіСЂР°Р№С‚Рµ 10 РґСѓРµР»РµР№",
    type: "duel",
    target: 10,
    reward: { xp: 200, gears: 3 }
  },
  {
    id: "win_5",
    title: "РџРµСЂРµРјРѕР¶РµС†СЊ",
    desc: "Р’РёРіСЂР°Р№С‚Рµ 5 РґСѓРµР»РµР№",
    type: "win",
    target: 5,
    reward: { xp: 300, gears: 5 }
  }
];

const TASKS_RESET_MS = 12 * 60 * 60 * 1000; // 12 РіРѕРґРёРЅ

function ensureTasksState(profile) {
  profile.tasks = profile.tasks || {};
  profile.completedTasks = profile.completedTasks || [];
  if (!profile.tasksResetAt) profile.tasksResetAt = Date.now();
}

function maybeResetTasks(profile) {
  ensureTasksState(profile);

  const now = Date.now();
  const last = Number(profile.tasksResetAt) || 0;

  if (now - last < TASKS_RESET_MS) return false;

  // reset
  profile.tasks = {};
  profile.completedTasks = [];
  profile.tasksResetAt = now;

  userProfile.updateCurrentUser(profile);
  userProfile.updateUI();

  return true;
}

// =========================================================
// TASKS RENDERING & UPDATING
// =========================================================
function renderTasks() {
  if (typeof renderTasksV2 === 'function') return renderTasksV2();
  const container = document.getElementById('tasks-list');
  if (!container) return;
  const profile = userProfile.getProfile();
  if (!profile) {
    container.innerHTML = '<div class="no-tasks">РЈРІС–Р№РґС–С‚СЊ, С‰РѕР± Р±Р°С‡РёС‚Рё Р·Р°РІРґР°РЅРЅСЏ</div>';
    return;
  }

  ensureTasksState(profile);

  container.innerHTML = TASKS.map(task => {
    const progress = profile.tasks[task.id] || 0;
    const completed = Array.isArray(profile.completedTasks) && profile.completedTasks.includes(task.id);
    const pct = Math.min(100, Math.round((progress / Math.max(1, task.target)) * 100));
    const rewardParts = [];
    if (task.reward && task.reward.xp) rewardParts.push(`+${task.reward.xp} XP`);
    if (task.reward && task.reward.gears) rewardParts.push(`+${task.reward.gears} вљ™пёЏ`);
    const rewardTxt = rewardParts.join(', ');

    return `
      <div class="task-card ${completed ? 'task-done' : ''}" data-task-id="${task.id}">
        <div class="task-top"><div class="task-title">${task.title}</div><div class="task-reward">${rewardTxt}</div></div>
        <div class="task-desc">${task.desc}</div>
        <div class="task-bar"><div class="task-bar-fill" style="width:${pct}%"></div></div>
        <div class="task-footer">${completed ? 'Р’РёРєРѕРЅР°РЅРѕ' : `${progress}/${task.target}`}</div>
      </div>
    `;
  }).join('');
}

function updateTasks(type, amount = 1) {
  if (typeof taskEvent === 'function') {
    try { taskEvent(type, amount); } catch (e) { console.warn('taskEvent delegate failed', e); }
    return;
  }
  const profile = userProfile.getProfile();
  if (!profile) return;
  ensureTasksState(profile);

  let changed = false;
  TASKS.forEach(task => {
    if (task.type !== type) return;
    const cur = Number(profile.tasks[task.id] || 0);
    const next = Math.min(task.target, cur + Number(amount || 1));
    if (next !== cur) {
      profile.tasks[task.id] = next;
      changed = true;
    }

    if (next >= task.target && !(profile.completedTasks || []).includes(task.id)) {
      // complete and award
      profile.completedTasks = profile.completedTasks || [];
      profile.completedTasks.push(task.id);
      profile.xp = (profile.xp || 0) + (task.reward && task.reward.xp ? task.reward.xp : 0);
      profile.gears = (profile.gears || 0) + (task.reward && task.reward.gears ? task.reward.gears : 0);
    }
  });

  if (changed) {
    userProfile.updateCurrentUser(profile);
    userProfile.updateUI();
    try {
      if (typeof navigation !== 'undefined' && typeof navigation.updateXP === 'function') navigation.updateXP(profile);
      else if (typeof updateHudXp === 'function') updateHudXp(profile);
    } catch (e) { /* ignore */ }
    try { renderTasks(); } catch (e) { /* ignore */ }
  }
}


// =========================================================
// PATCH: Enemy power cap relative to player (+20 max)
// =========================================================

function capEnemyPowerRelative(enemyPower, playerPower) {
  const ep = Number(enemyPower) || 0;
  const pp = Number(playerPower) || 0;
  // Сила ворога у діапазоні [pp-20, pp+20], але не менше 0
  const minPower = Math.max(0, pp - 20);
  const maxPower = pp + 20;
  return Math.max(minPower, Math.min(ep, maxPower));
}

// =========================================================
// PATCH: Build enemy card pool by target power (no random mismatch)
// =========================================================
function buildEnemyCardPool(targetPower, allCards, maxCards = 9) {
  // Р±РµСЂРµРјРѕ С‚С–Р»СЊРєРё Р±Р°Р·РѕРІС– РєР°СЂС‚Рё (Р±РµР· РїСЂРѕРєР°С‡РєРё РіСЂР°РІС†СЏ)
  const pool = allCards
    .filter(c => c && typeof c.power === 'number')
    .sort((a, b) => b.power - a.power); // РІС–Рґ СЃРёР»СЊРЅРёС… РґРѕ СЃР»Р°Р±РєРёС…

  const result = [];
  let total = 0;

  for (const card of pool) {
    if (result.length >= maxCards) break;
    if (total + card.power <= targetPower) {
      result.push(card);
      total += card.power;
    }
    if (total >= targetPower * 0.95) break; // РґРѕРїСѓСЃРє 5%
  }

  // fallback: СЏРєС‰Рѕ РЅРµ РЅР°Р±СЂР°Р»Рё РЅС–С‡РѕРіРѕ вЂ” РІР·СЏС‚Рё РјС–РЅС–РјР°Р»СЊРЅСѓ РєР°СЂС‚Сѓ
  if (result.length === 0 && pool.length) {
    result.push(pool[pool.length - 1]);
    total = result[0].power;
  }

  return { cards: result, totalPower: total };
}

// РњР°РїРїС–РЅРі РµР»РµРјРµРЅС‚С–РІ РґР»СЏ С„СЂР°РєС†С–Р№
const FACTION_ELEMENTS = {
  "F01": "fire", "F02": "fire", "F03": "fire", "F04": "fire", "F05": "fire",
  "F06": "fire", "F07": "fire", "F08": "fire", "F09": "fire", "F10": "fire",
  "F11": "water", "F12": "water", "F13": "water", "F14": "water", "F15": "water",
  "F16": "water", "F17": "water", "F18": "water", "F19": "water", "F20": "water",
  "F21": "air", "F22": "air", "F23": "air", "F24": "air", "F25": "air",
  "F26": "air", "F27": "air", "F28": "air", "F29": "air", "F30": "air",
  "F31": "earth", "F32": "earth", "F33": "earth", "F34": "earth", "F35": "earth",
  "F36": "earth", "F37": "earth", "F38": "earth", "F39": "earth", "F40": "earth"
};

// РќР°Р·РІРё С„СЂР°РєС†С–Р№
const FACTION_NAMES = {
  "F01": "РћСЂРґРµРЅ РџРѕРїРµР»СЏСЃС‚РѕРіРѕ РЎРѕРЅС†СЏ",
  "F02": "Р›РµРіС–РѕРЅ РџР°Р»Р°СЋС‡РёС… РљР»РёРЅРєС–РІ",
  "F03": "РљСѓР»СЊС‚ Р’С–С‡РЅРѕРіРѕ РџРѕР»СѓРј'СЏ",
  "F04": "Р†РјРїРµСЂС–СЏ Р§РµСЂРІРѕРЅРѕРіРѕ Р”СЂР°РєРѕРЅР°",
  "F05": "РљРѕРІР°Р»С– РњР°РіРјРё",
  "F06": "РЎРёРЅРё Р’СѓР»РєР°РЅСѓ",
  "F07": "РџС–СЂР°С‚СЃСЊРєС– РљР»Р°РЅРё Р–Р°СЂСѓ",
  "F08": "Р‘СЂР°С‚СЃС‚РІРѕ РћР±РІСѓРіР»РµРЅРёС…",
  "F09": "Р’Р°СЂС‚РѕРІС– РљР°Р»СЊРґРµСЂРё",
  "F10": "РџСЂРѕСЂРѕРєРё Р’РѕРіРЅСЏРЅРѕС— РљСЂРѕРЅРё",
  "F11": "РљРѕСЂРѕР»С–РІСЃС‚РІРѕ Р“Р»РёР±РёРЅ",
  "F12": "РћСЂРґРµРЅ РџСЂРёРїР»РёРІСѓ",
  "F13": "РњРѕСЂСЃСЊРєС– Р’С–РґСЊРјРё РЎРёРЅС–С… Р РёС„С–РІ",
  "F14": "Р¤Р»РѕС‚ Р‘РµР·РґРѕРЅРЅРѕС— РўРёС€С–",
  "F15": "РҐСЂР°РЅРёС‚РµР»С– РљСЂРёР¶Р°РЅРёС… РћР·РµСЂ",
  "F16": "РќР°СЂРѕРґ РўСѓРјР°РЅРЅРёС… Р”РµР»СЊС‚",
  "F17": "Р›РµРІС–Р°С„Р°РЅРѕРІС– Р–РµСЂС†С–",
  "F18": "РџРµСЂР»РёРЅРЅРёР№ РљРѕРЅРєР»Р°РІ",
  "F19": "РљР»Р°РЅ РЁС‚РѕСЂРјРѕРІРёС… РҐРІРёР»СЊ",
  "F20": "РђСЂС…С–РІРё Р—Р°Р±СѓС‚РёС… РњРѕСЂС–РІ",
  "F21": "РќРµР±РµСЃРЅС– РљРѕС‡С–РІРЅРёРєРё",
  "F22": "РћСЂРґРµРЅ Р§РёСЃС‚РѕРіРѕ Р’С–С‚СЂСѓ",
  "F23": "РЁС‚РѕСЂРјРѕРІС– РЇСЃС‚СЂСѓР±Рё",
  "F24": "Р›С–РіР° Р›РµРІС–С‚Р°С†С–С—",
  "F25": "РҐРјР°СЂРЅС– РњР°РіС–СЃС‚СЂРё",
  "F26": "РЎРёРЅРё РЈСЂР°РіР°РЅСѓ",
  "F27": "Р”Р·РІРѕРЅР°СЂС– РђС‚РјРѕСЃС„РµСЂРё",
  "F28": "Р’Р°СЂС‚РѕРІС– Р’РёСЃРѕРєРёС… РџС–РєС–РІ",
  "F29": "РђСЃС‚СЂР°Р»СЊРЅС– РњР°РЅРґСЂС–РІС†С–",
  "F30": "РљРѕРЅРєР»Р°РІ РџРѕРІС–С‚СЂСЏРЅРёС… РЎС„РµСЂ",
  "F31": "РљР°Рј'СЏРЅС– Р”РѕРјС–РЅС–РѕРЅРё",
  "F32": "РћСЂРґРµРЅ РљРѕСЂС–РЅРЅСЏ",
  "F33": "Р—Р°Р»С–Р·РЅС– Р”СЂСѓС—РґРё",
  "F34": "РљР»Р°РЅРё Р“С–СЂСЃСЊРєРёС… Р©РёС‚С–РІ",
  "F35": "РҐСЂР°РЅРёС‚РµР»С– РњРѕРЅРѕР»С–С‚С–РІ",
  "F36": "РќР°СЂРѕРґ РџРµС‡РµСЂ",
  "F37": "РћР±СЃРёРґС–Р°РЅРѕРІРёР№ РЎРёРЅРґРёРєР°С‚",
  "F38": "РЎС‚РѕСЂРѕР¶С– Р”Р°РІРЅС–С… Р›С–СЃС–РІ",
  "F39": "РђСЂС…РѕРЅС‚Рё РўРµРєС‚РѕРЅС–РєРё",
  "F40": "РџР»РµРјРµРЅР° РџРµСЂС€РѕС— РЎРєРµР»С–"
};

// РќР°Р·РІРё РєР°СЂС‚ РґР»СЏ РєРѕР¶РЅРѕС— С„СЂР°РєС†С–С—
const CARD_NAMES = {
  "F01": ["РџРѕСЃР»СѓС€РЅРёРє РџРѕРїРµР»СЏСЃС‚РѕРіРѕ РЎРѕРЅС†СЏ", "РЎРІС–С‚РѕС‡ РџРѕРїРµР»СЏСЃС‚РёС… РњРѕР»РёС‚РІ", "Р†РЅРєРІС–Р·РёС‚РѕСЂ РЎР°Р¶С–", "РџР°Р»Р°РґРёРЅ РЎРѕРЅСЏС‡РЅРѕРіРѕ РџРѕРїРµР»Сѓ", "РђСЂС…РѕРЅС‚ РџРѕРїРµР»СЏСЃС‚РѕРіРѕ РЎРІС–С‚Р°РЅРєСѓ", "Р•РјС–СЃР°СЂ Р§РѕСЂРЅРѕРіРѕ РџРѕР»СѓРґРЅСЏ"],
  "F02": ["Р›РµРіС–РѕРЅРµСЂ РџР°Р»Р°СЋС‡РѕРіРѕ РљР»РёРЅРєР°", "РљР°РїСЂР°Р» Р РѕР·Р¶Р°СЂРµРЅРѕС— РЎС‚Р°Р»С–", "Р”СѓРµР»СЏРЅРёСЃС‚ Р’РѕРіРЅСЏРЅРѕРіРѕ Р РµР±СЂР°", "Р¦РµРЅС‚СѓСЂС–РѕРЅ РџРѕР»СѓРј'СЏРЅРёС… РЁРµСЂРµРЅРі", "РњР°СЂС€Р°Р» РљР»РёРЅРєС–РІ-РљРѕРјРµС‚", "Р’РѕР»РѕРґР°СЂ РџРµСЂС€РѕРіРѕ Р РѕР·Р¶Р°СЂРµРЅРЅСЏ"],
  "F03": ["Р¤Р°РЅР°С‚РёРє Р’С–С‡РЅРѕРіРѕ РџРѕР»СѓРј'СЏ", "Р–СЂРµС†СЊ Р–Р°СЂРєРѕРіРѕ РљР°РґРёР»Р°", "РџСЂРѕРІРёРґРµС†СЊ Р‘РµР·РєС–РЅРµС‡РЅРѕС— Р†СЃРєСЂРё", "РћР±СЂСЏРґРЅРёРє РќРµРїРѕРіР°СЃРЅРѕРіРѕ Р’РѕРіРЅСЋ", "Р’РµСЂС…РѕРІРЅРёР№ РџР°Р»Р°РјР°СЂ РљСѓР»СЊС‚Сѓ", "РЎРµСЂС†Рµ Р’С–С‡РЅРѕРіРѕ РџРѕР»СѓРј'СЏ"],
  "F04": ["РЎРѕР»РґР°С‚ Р”СЂР°РєРѕРЅРѕРІРѕС— Р’Р°СЂС‚Рё", "Р”СЂР°РєРѕРЅС–РІ Р’РµСЂС€РЅРёРє РџРѕСЂРѕС…Сѓ", "Р“РІР°СЂРґС–С”С†СЊ Р§РµСЂРІРѕРЅРѕРіРѕ РўСЂРѕРЅСѓ", "РџСЂР°РїРѕСЂРѕРЅРѕСЃРµС†СЊ Р”СЂР°РєРѕРЅРѕРІРѕРіРѕ Р’РѕРіРЅСЋ", "Р РµРіРµРЅС‚ Р›СѓСЃРєРё Р№ РџРѕР»СѓРј'СЏ", "Р§РµСЂРІРѕРЅРёР№ Р”СЂР°РєРѕРЅ-Р†РјРїРµСЂР°С‚РѕСЂ"],
  "F05": ["РљРѕРІР°Р»СЊ РњР°РіРјРѕРІРѕРіРѕ Р“РѕСЂРЅР°", "Р›РёРІР°СЂРЅРёРє Р С–РґРєРѕРіРѕ РљР°РјРµРЅСЋ", "РњР°Р№СЃС‚РµСЂ Р СѓРЅ Р РѕР·РїР»Р°РІСѓ", "РљРѕРІР°Р»СЊ-РђР»С…С–РјС–Рє Р’СѓР»РєР°РЅС–С‡РЅРёС… РЎРїР»Р°РІС–РІ", "Р’РµР»РёРєРёР№ Р“РѕСЂРЅСЏРє РњР°РіРјРё", "Р“РѕСЂРЅРёР»Рѕ РџРµСЂС€РѕС— РљСѓР·РЅС–"],
  "F06": ["Р РµР№РґРµСЂ Р’СѓР»РєР°РЅС–С‡РЅРёС… РЎС…РёР»С–РІ", "РњРёСЃР»РёРІРµС†СЊ РЅР° Р›Р°РІРѕРІРёС… РџСЃС–РІ", "РЁР°РјР°РЅ Р“СЂРёРјСѓС‡РѕРіРѕ РљСЂР°С‚РµСЂР°", "Р’Р°С‚Р°Р¶РѕРє РЎРёРЅС–РІ Р’СѓР»РєР°РЅСѓ", "РџРµСЂС€РѕСЂРѕРґРЅРёР№ Р’СѓР»РєР°РЅС–С‚", "РЎРїР°РґРєРѕС”РјРµС†СЊ РЎРµСЂС†СЏ РљСЂР°С‚РµСЂР°"],
  "F07": ["РџС–СЂР°С‚ Р–Р°СЂРєРѕРіРѕ Р’С–С‚СЂРёР»Р°", "Р‘РѕС†РјР°РЅ РљС–РїС‚СЏРІРёС… РљР°РЅР°С‚С–РІ", "Р“Р°СЂРїСѓРЅРЅРёРє Р’РѕРіРЅСЏРЅРѕС— РҐРІРёР»С–", "РљР°РїС–С‚Р°РЅ РџР°Р»Р°СЋС‡РёС… Р РёС„С–РІ", "РљРѕСЂСЃР°СЂ Р§РµСЂРІРѕРЅРѕРіРѕ РЁС‚РѕСЂРјСѓ", "Р¤Р»Р°РіРјР°РЅ В«Р РѕР·Р¶Р°СЂРµРЅРёР№ РџСЂРёРІРёРґВ»"],
  "F08": ["РћР±РІСѓРіР»РµРЅРёР№ РЎС‚РѕСЂРѕР¶", "Р—Р±РёСЂР°С‡ Р’СѓРіР»РёРЅ", "РўС–РЅСЊ РЎР°Р¶РёСЃС‚РѕРіРѕ Р›РµР·Р°", "РџР°Р»РєРёР№ РњРµСЃРЅРёРє Р‘СЂР°С‚СЃС‚РІР°", "РЎС‚Р°СЂС–Р№С€РёРЅР° РћР±РІСѓРіР»РµРЅРёС… РљР»СЏС‚РІ", "РџСЂР°С…, Р©Рѕ РџР°Рј'СЏС‚Р°С” Р†РјРµРЅР°"],
  "F09": ["Р’Р°СЂС‚РѕРІРёР№ РљР°Р»СЊРґРµСЂРё", "Р РѕР·РІС–РґРЅРёРє РљРёРїР»СЏС‡РёС… РџРѕСЂРѕР¶РЅРёРЅ", "РҐСЂР°РЅРёС‚РµР»СЊ Р›Р°РІРѕРІРёС… Р‘СЂР°Рј", "РљРѕРјР°РЅРґРёСЂ РљР°Р»СЊРґРµСЂРЅРёС… Р©РёС‚С–РІ", "РЎС‚СЂР°Р¶ РљСЂР°СЋ Р’СѓР»РєР°РЅСѓ", "РљР°Р»СЊРґРµСЂР°, Р©Рѕ Р”РёС…Р°С”"],
  "F10": ["РђРєРѕР»С–С‚ Р’РѕРіРЅСЏРЅРѕС— РљСЂРѕРЅРё", "РўР»СѓРјР°С‡ Р†СЃРєРѕСЂРЅРѕРіРѕ Р—РЅР°РєСѓ", "РџСЂРѕРІС–СЃРЅРёРє РџРѕР»СѓРј'СЏРЅРѕРіРѕ РџСЂРѕСЂРѕС†С‚РІР°", "РћСЂР°РєСѓР» РљРѕСЂРѕРЅРѕРІР°РЅРѕРіРѕ Р–Р°СЂСѓ", "Р’РµСЂС…РѕРІРЅРёР№ РџСЂРѕСЂРѕРє РџР°Р»Р°СЋС‡РѕС— РљСЂРѕРЅРё", "РљСЂРѕРЅР°, Р©Рѕ Р“РѕРІРѕСЂРёС‚СЊ Р’РѕРіРЅРµРј"],
  "F11": ["Р”РѕР·РѕСЂРµС†СЊ Р“Р»РёР±РёРЅ", "Р’РѕРґРѕР»Р°Р· РљРѕСЂРѕР»С–РІСЃСЊРєРѕС— Р’Р°СЂС‚Рё", "РњР°Рі РўРёСЃРєСѓ Р‘РµР·РѕРґРЅС–", "Р РёС†Р°СЂ РџРµСЂР»РёРЅРЅРѕС— Р‘СЂРѕРЅС–", "Р РµРіРµРЅС‚ РўСЂРѕРЅСѓ Р“Р»РёР±РёРЅ", "РљРѕСЂРѕР»СЊ Р‘РµР·РѕРґРЅС–, Р’РѕР»РѕРґР°СЂ РџСЂРёРїР»РёРІС–РІ"],
  "F12": ["РџРѕСЃР»СѓС€РЅРёРє РћСЂРґРµРЅСѓ РџСЂРёРїР»РёРІСѓ", "РњРѕРЅР°С… РЎРѕР»РѕРЅРёС… РҐРІРёР»СЊ", "РќР°СЃС‚РѕСЏС‚РµР»СЊ Р’РѕРґСЏРЅРёС… РљСЂСѓРіС–РІ", "РњР°Р№СЃС‚РµСЂ Р”РµРІ'СЏС‚Рё РџСЂРёРїР»РёРІС–РІ", "РђСЂС…С–РјРѕРЅР°С… Р’РµР»РёРєРѕС— РџРѕРІРµСЂС‚С–", "РџСЂРёРїР»РёРІ, Р©Рѕ РќРµ РњР°С” Р‘РµСЂРµРіР°"],
  "F13": ["Р’С–РґСЊРѕРјСЃСЊРєР° РЈС‡РµРЅРёС†СЏ Р РёС„С–РІ", "РўСЂР°РІРЅРёС†СЏ РЎРѕР»РѕРЅРёС… Р§Р°СЂ", "Р§Р°СЂС–РІРЅРёС†СЏ РЎРёРЅСЊРѕРіРѕ Р РёС„Сѓ", "РњР°С‚СЂРѕРЅР° Р РёС„РѕРІРёС… Р—Р°РєР»СЏС‚СЊ", "Р’РѕР»РѕРґР°СЂРєР° Р РёС„РѕРІРѕС— РќРѕС‡С–", "РЎРёСЂРµРЅР° В«РЎРёРЅСЏ Р‘РµР·РІРёС…С–РґСЊВ»"],
  "F14": ["РњР°С‚СЂРѕСЃ Р‘РµР·РґРѕРЅРЅРѕС— РўРёС€С–", "РЁС‚СѓСЂРјР°РЅ РњРѕРІС‡Р°Р·РЅРёС… Р’РѕРґ", "РљР°РїС–С‚Р°РЅ Р‘РµР·Р·РІСѓС‡РЅРѕРіРѕ РљРѕСЂР°Р±Р»СЏ", "РђРґРјС–СЂР°Р» РўРёС…РёС… РњРѕСЂС–РІ", "Р¤Р»Р°РіРјР°РЅ В«Р“Р»РёР±РѕРєР° РџР°СѓР·Р°В»", "РўРёС€Р°, Р©Рѕ РўСЏРіРЅРµ РќР° Р”РЅРѕ"],
  "F15": ["РЎС‚РѕСЂРѕР¶ РљСЂРёР¶Р°РЅРѕРіРѕ РћР·РµСЂР°", "Р›РёР¶РЅРёРє РџС–РІРЅС–С‡РЅРёС… Р—Р°С‚РѕРє", "Р—Р°РєР»РёРЅР°С‡ Р›СЊРѕРґСЏРЅРёС… Р”Р·РµСЂРєР°Р»", "РљСЂРёР¶Р°РЅРёР№ Р§РµРјРїС–РѕРЅ РћР·РµСЂ", "РЎС‚Р°СЂС€РёР№ РҐСЂР°РЅРёС‚РµР»СЊ РџС–РІРЅС–С‡РЅРѕС— РљСЂРѕРјРєРё", "РћР·РµСЂРѕ, Р©Рѕ РџР°Рј'СЏС‚Р°С” Р—РёРјСѓ"],
  "F16": ["РџСЂРѕРІС–РґРЅРёРє РўСѓРјР°РЅРЅРѕС— Р”РµР»СЊС‚Рё", "РњРёСЃР»РёРІРµС†СЊ РњРѕРєСЂРёС… РЎС‚РµР¶РѕРє", "РўРєР°С‡ РўСѓРјР°РЅСѓ Р№ Р›РѕР·Рё", "Р’Р°СЂС‚РѕРІРёР№ Р”РµР»СЊС‚РѕРІРёС… Р‘РѕР»РѕС‚", "РЎС‚Р°СЂС–Р№С€РёРЅР° РЎРµРјРё Р СѓРє Р”РµР»СЊС‚Рё", "РўСѓРјР°РЅ, Р©Рѕ РҐРѕРґРёС‚СЊ Р›СЋРґСЊРјРё"],
  "F17": ["РЎР»СѓР¶РєР° Р›РµРІС–Р°С„Р°РЅР°", "Р–СЂРµС†СЊ РЎРѕР»СЏРЅРёС… РџСЃР°Р»РјС–РІ", "РќР°РіР»СЏРґР°С‡ РљРёС‚РѕРІРѕРіРѕ РҐСЂР°РјСѓ", "РџСЂРѕРїРѕРІС–РґРЅРёРє РџС–РґРІРѕРґРЅРѕС— Р’РµР»РёС‡С–", "Р’РµСЂС…РѕРІРЅРёР№ Р–СЂРµС†СЊ Р›РµРІС–Р°С„Р°РЅР°", "Р›РµРІС–Р°С„Р°РЅ В«РЎРѕР»РѕРЅР° Р’РѕР»СЏВ»"],
  "F18": ["Р—Р±РёСЂР°С‡ РџРµСЂР»РёРЅ РљРѕРЅРєР»Р°РІСѓ", "Р”РёРїР»РѕРјР°С‚ РџРµСЂР»РёРЅРЅРёС… Р—РЅР°РєiРІ", "РђСЂР±С–С‚СЂ РљРѕСЂР°Р»РѕРІРёС… РЈРіРѕРґ", "РњР°Рі РџРµСЂР»РёРЅРЅРѕС— Р›РѕРіС–РєРё", "Р“РѕР»РѕРІР° РџРµСЂР»РёРЅРЅРѕРіРѕ РљРѕРЅРєР»Р°РІСѓ", "РџРµСЂР»РёРЅР°, Р©Рѕ РЎСѓРґРёС‚СЊ РЁС‚РѕСЂРјРё"],
  "F19": ["Р’РѕС—РЅ РЁС‚РѕСЂРјРѕРІРѕС— РҐРІРёР»С–", "Р‘С–РіСѓРЅ РџСЂРёР±РѕСЋ", "РЎРїРёСЃРѕРЅРѕСЃРµС†СЊ Р“СЂРѕРјСѓ РЅР°Рґ Р’РѕРґРѕСЋ", "РџСЂРѕРІС–РґРЅРёРє РЁС‚РѕСЂРјРѕРІРѕРіРѕ РќР°Р»СЊРѕС‚Сѓ", "Р’Р°С‚Р°Р¶РѕРє РљР»Р°РЅСѓ Р“Р»РёР±РѕРєРѕРіРѕ Р“СЂРѕРјСѓ", "РҐРІРёР»СЏ В«Р“СЂС–Рј-Р РѕР·Р»РѕРјВ»"],
  "F20": ["РџРёСЃР°СЂ Р—Р°Р±СѓС‚РёС… РњРѕСЂС–РІ", "РљР°СЂС‚РѕРіСЂР°С„ РЎРѕР»РѕРЅРёС… РўР°С”РјРЅРёС†СЊ", "РҐСЂР°РЅРёС‚РµР»СЊ Р Р°РєСѓС€РєРѕРІРёС… РҐСЂРѕРЅС–Рє", "РђСЂС…С–РІР°СЂС–СѓСЃ РџС–РґРІРѕРґРЅРёС… Р›С–С‚РѕРїРёСЃС–РІ", "РљСѓСЂР°С‚РѕСЂ Р‘РµР·РґРѕРЅРЅРѕС— Р‘С–Р±Р»С–РѕС‚РµРєРё", "РљРЅРёРіР°, Р©Рѕ РџРёС€Рµ РџСЂРёРїР»РёРІ"],
  "F21": ["РЎРєР°СѓС‚ РќРµР±РµСЃРЅРёС… РљРѕС‡С–РІРЅРёРєС–РІ", "РџРѕРіРѕРЅРёС‡ Р’С–С‚СЂСЏРЅРёС… Р—РІС–СЂС–РІ", "Р›СѓС‡РЅРёРє РҐРјР°СЂРЅРёС… РЎС‚РµРїС–РІ", "Р’РѕР¶РґСЊ РџРѕРІС–С‚СЂСЏРЅРѕРіРѕ РљР°СЂР°РІР°РЅСѓ", "РЎС‚Р°СЂС€РёР№ РЁР°РјР°РЅ РќРµР±РµСЃРЅРёС… Р”РѕСЂС–Рі", "РљР°СЂР°РІР°РЅ, Р©Рѕ Р™РґРµ РџРѕ РќРµР±Сѓ"],
  "F22": ["РџРѕСЃР»СѓС€РЅРёРє Р§РёСЃС‚РѕРіРѕ Р’С–С‚СЂСѓ", "РњРѕРЅР°С… Р›РµРіРєРѕРіРѕ РџРѕРґРёС…Сѓ", "РЎС‚РёС…С–Р№РЅРёРє РџСЂРѕР·РѕСЂРёС… РџРѕСЂРёРІС–РІ", "РќР°СЃС‚РѕСЏС‚РµР»СЊ Р’С–С‚СЂСЏРЅРѕРіРѕ РљРѕР»Р°", "РђСЂС…С–РјР°Рі Р§РёСЃС‚РѕРіРѕ Р’С–С‚СЂСѓ", "РџРѕРґРёС…, Р©Рѕ РћС‡РёС‰СѓС” РЎРІС–С‚"],
  "F23": ["РЇСЃС‚СЂСѓР±РёРЅРёР№ Р РѕР·РІС–РґРЅРёРє", "РџС–РєС–РЅРµСЂ Р“СЂРѕР·РѕРІРёС… РљСЂРёР»", "РЎРЅР°Р№РїРµСЂ РЁС‚РѕСЂРјРѕРІРѕРіРѕ РќРµР±Р°", "РљРѕРјР°РЅРґРёСЂ РЇСЃС‚СЂСѓР±РёРЅРёС… Р›Р°РЅРѕРє", "Р’РѕР»РѕРґР°СЂ Р“СЂРѕР·РѕРІРёС… РўРµС‡С–Р№", "РЇСЃС‚СЂСѓР± В«Р“СЂС–РјРѕРєР»СЋРІВ»"],
  "F24": ["РўРµС…РЅС–Рє Р›РµРІС–С‚Р°С†С–Р№РЅРёС… Р СѓРЅ", "Р†РЅР¶РµРЅРµСЂ РџС–РґР№РѕРјРЅРёС… РЎС„РµСЂ", "РђСЂРєР°РЅС–СЃС‚ Р“СЂР°РІС–С‚Р°С†С–Р№РЅРёС… Р—СЃСѓРІС–РІ", "РњР°Р№СЃС‚РµСЂ Р›РµРІС–С‚Р°С†С–Р№РЅРёС… РџРѕСЂС‚С–РІ", "Р“РѕР»РѕРІР° Р›С–РіРё Р›РµРІС–С‚Р°С†С–С—", "РќСѓР»СЊРѕРІР° Р’Р°РіР°, РџРµС‡Р°С‚РєР° Р›С–РіРё"],
  "F25": ["РЈС‡РµРЅСЊ РҐРјР°СЂРЅРёС… РњР°РіС–СЃС‚СЂС–РІ", "РЎРєСѓР»СЊРїС‚РѕСЂ РўСѓРјР°РЅСѓ", "РњР°РіС–СЃС‚СЂ РҐРјР°СЂРЅРёС… Р¤РѕСЂРј", "РђСЂС…С–С‚РµРєС‚РѕСЂ РќРµР±РµСЃРЅРёС… Р’РµР¶", "Р’РµР»РёРєРёР№ РњР°РіС–СЃС‚СЂ Р’РёСЃРѕС‚Рё", "РџР°Р»Р°С† Р†Р· РҐРјР°СЂ, Р©Рѕ РќРµ РўР°РЅСѓС‚СЊ"],
  "F26": ["Р РµР№РґРµСЂ РЈСЂР°РіР°РЅРЅРѕРіРѕ РљР»Р°РЅСѓ", "Р‘РѕСЂРµС†СЊ Р’РёС…РѕСЂС–РІ", "РЁР°РјР°РЅ РЎРїС–СЂР°Р»СЊРЅРёС… Р‘СѓСЂ", "Р’Р°С‚Р°Р¶РѕРє РЎРёРЅС–РІ РЈСЂР°РіР°РЅСѓ", "РџРµСЂС€РѕСЂРѕРґРЅРёР№ Р’РёС…РѕСЂРЅРёРє", "РЈСЂР°РіР°РЅ, Р©Рѕ РњР°С” Р†Рј'СЏ"],
  "F27": ["Р”Р·РІРѕРЅР°СЂ РќРµР±РµСЃРЅРѕС— Р’РµР¶С–", "Р РёС‚РјС–СЃС‚ РџРѕРІС–С‚СЂСЏРЅРёС… РҐРѕСЂС–РІ", "РўРѕРЅР°Р»СЊРЅРёРє Р‘Р°СЂРѕРјРµС‚СЂС–РІ", "РњР°Р№СЃС‚РµСЂ Р”Р·РІРѕРЅС–РІ Р“СЂРѕР·РѕРІРѕС— РњРµР¶С–", "Р’РµСЂС…РѕРІРЅРёР№ Р”Р·РІРѕРЅР°СЂ РђС‚РјРѕСЃС„РµСЂРё", "Р”Р·РІС–РЅ, Р©Рѕ РљРµСЂСѓС” РќРµР±РѕРј"],
  "F28": ["РЎС‚РѕСЂРѕР¶ Р’РёСЃРѕРєРѕРіРѕ РџС–РєСѓ", "РџСЂРѕРІС–РґРЅРёРє РљСЂСѓС‡", "РЎС‚СЂС–Р»РµС†СЊ РџС–РєРѕРІРёС… Р’С–С‚СЂС–РІ", "РљРѕРјР°РЅРґРёСЂ РџС–РєРѕРІРёС… Р—Р°СЃС‚Р°РІ", "Р“РѕР»РѕРІР° Р’Р°СЂС‚Рё РќРµР±РµСЃРЅРѕРіРѕ РҐСЂРµР±С‚Р°", "РџС–Рє, Р©Рѕ Р”РёРІРёС‚СЊСЃСЏ РќР° Р§Р°СЃ"],
  "F29": ["РњР°РЅРґСЂС–РІРµС†СЊ РђСЃС‚СЂР°Р»СЊРЅРёС… РЎС‚РµР¶РѕРє", "РќР°РІС–РіР°С‚РѕСЂ РЎСѓР·С–СЂ'С—РІ", "РџС–Р»С–РіСЂРёРј РќСѓР»СЊРѕРІРѕРіРѕ РќРµР±Р°", "РљР°РїС–С‚Р°РЅ РђСЃС‚СЂР°Р»СЊРЅРѕРіРѕ Р’С–С‚СЂРёР»Р°", "РђСЂС…С–РјР°РЅРґСЂС–РІРµС†СЊ РџРѕСЂРѕР¶РЅСЊРѕС— РћСЂР±С–С‚Рё", "РЎСѓР·С–СЂ'СЏ, Р©Рѕ Р’РµРґРµ Р”РѕРјС–РІ"],
  "F30": ["РЈС‡РµРЅСЊ РЎС„РµСЂ РљРѕРЅРєР»Р°РІСѓ", "РћРїРµСЂР°С‚РѕСЂ РђРµСЂРѕСЃС„РµСЂРё", "РњР°Рі РЎС„РµСЂРёС‡РЅРёС… РўРµС‡С–Р№", "РђСЂС…РѕРЅС‚ РџРѕРІС–С‚СЂСЏРЅРёС… РЎС„РµСЂ", "Р“РѕР»РѕРІР° РљРѕРЅРєР»Р°РІСѓ Р’РёСЃРѕРєРѕРіРѕ РўРёСЃРєСѓ", "РЎС„РµСЂР°, Р©Рѕ РўСЂРёРјР°С” Р‘СѓСЂСЋ"],
  "F31": ["Р”СЂСѓР¶РёРЅРЅРёРє РљР°Рј'СЏРЅРёС… Р”РѕРјС–РЅС–РѕРЅС–РІ", "РўРµСЃР»СЏ РњРѕРЅРѕР»С–С‚РЅРёС… Р‘СЂР°Рј", "Р“РµРѕРјР°РЅС‚ Р”РѕРјС–РЅС–РѕРЅС–РІ", "РљРѕРјР°РЅРґРёСЂ Р‘Р°Р·Р°Р»СЊС‚РѕРІРёС… Р›РµРіС–Р№", "РљРЅСЏР·СЊ РљР°Рј'СЏРЅРѕРіРѕ Р—Р°РєРѕРЅСѓ", "Р”РѕРјС–РЅС–РѕРЅ, Р©Рѕ РќРµ РџР°РґР°С”"],
  "F32": ["РџРѕСЃР»СѓС€РЅРёРє РћСЂРґРµРЅСѓ РљРѕСЂС–РЅРЅСЏ", "РЎР°РґС–РІРЅРёРє РЎРІСЏС‰РµРЅРЅРёС… Р›С–Р°РЅ", "Р”СЂСѓС—Рґ Р“Р»РёР±РѕРєРёС… РљРѕСЂРµРЅС–РІ", "РќР°СЃС‚РѕСЏС‚РµР»СЊ Р–РёРІРѕРіРѕ Р“Р°СЋ", "РђСЂС…С–РґСЂСѓС—Рґ РљРѕСЂС–РЅРЅСЏ", "РљРѕСЂС–РЅСЊ, Р©Рѕ Рџ'С” РЎРІС–С‚Р»Рѕ"],
  "F33": ["Р—Р°Р»С–Р·РЅРёР№ РџРѕСЃР»СѓС€РЅРёРє", "РљРѕРІР°Р»РѕРґСЂСѓС—Рґ Р СѓРЅ РњРµС‚Р°Р»Сѓ", "РҐСЂР°РЅРёС‚РµР»СЊ РЎС‚Р°Р»РµРІРёС… Р“Р°С—РІ", "РђСЂС…С–С‚РµРєС‚РѕСЂ Р—Р°Р»С–Р·РЅРѕС— Р¤Р»РѕСЂРё", "Р’РµСЂС…РѕРІРЅРёР№ Р”СЂСѓС—Рґ Р¤РµСЂСѓРјСѓ", "Р”РµСЂРµРІРѕ Р·С– РЎС‚Р°Р»С–, Р–РёРІРёР№ РљРѕР»РѕСЃ"],
  "F34": ["Р©РёС‚РѕРЅРѕСЃРµС†СЊ Р“С–СЂСЃСЊРєРѕРіРѕ РљР»Р°РЅСѓ", "РЎРѕРєРёСЂРЅРёРє РљР°Рј'СЏРЅРѕС— Р‘СЂРѕРІРё", "РљР»СЏС‚РІРµРЅРёРє Р“С–СЂСЃСЊРєРёС… Р‘СЂР°Рј", "РўР°РЅ Р§РѕСЂРЅРѕРіРѕ Р“СЂР°РЅС–С‚Сѓ", "Р’РµСЂС…РѕРІРЅРёР№ Р’РѕР¶РґСЊ Р©РёС‚С–РІ", "Р©РёС‚ В«Р“РѕСЂР°-РЎРµСЂС†РµВ»"],
  "F35": ["Р’Р°СЂС‚РѕРІРёР№ РњРѕРЅРѕР»С–С‚Сѓ", "Р СѓРЅРЅРёРє РљР°Рј'СЏРЅРёС… РџР»РёС‚", "РћСЂР°РєСѓР» РњРѕРЅРѕР»С–С‚РЅРёС… Р—РЅР°РєС–РІ", "РљРѕРјР°РЅРґРёСЂ РњРѕРЅРѕР»С–С‚РЅРѕС— Р’Р°СЂС‚Рё", "РЎС‚Р°СЂС€РёР№ РҐСЂР°РЅРёС‚РµР»СЊ РЎРµРјРё РњРѕРЅРѕР»С–С‚С–РІ", "РњРѕРЅРѕР»С–С‚, Р©Рѕ Р’С–РґС‡РёРЅСЏС” РќС–С‡"],
  "F36": ["РЎР»С–РґРѕРїРёС‚ РџРµС‡РµСЂРЅРѕРіРѕ РҐРѕРґСѓ", "РЁР°С…С‚Р°СЂ РЎРІС–С‚Р»СЏРЅРёС… Р–РёР»", "РџРµС‡РµСЂРЅРёР№ РњРёСЃР»РёРІРµС†СЊ РўС–РЅРµР№", "Р’РѕР¶РґСЊ РџС–РґР·РµРјРЅРёС… Р—Р°Р»С–РІ", "РљРѕСЂРѕР»СЊ РљР°Рј'СЏРЅРѕС— РќРѕСЂРё", "РџРµС‡РµСЂР°, Р©Рѕ РљРѕРІС‚Р°С” Р›С–С…С‚Р°СЂС–"],
  "F37": ["РђРіРµРЅС‚ РћР±СЃРёРґС–Р°РЅРѕРІРѕРіРѕ РЎРёРЅРґРёРєР°С‚Сѓ", "РљРѕРЅС‚СЂР°РєС‚РѕСЂ Р§РѕСЂРЅРѕРіРѕ РЎРєР»Сѓ", "РќРѕС‚Р°СЂС–СѓСЃ Р“РѕСЃС‚СЂРёС… РЈРіРѕРґ", "РљСѓСЂР°С‚РѕСЂ РћР±СЃРёРґС–Р°РЅРѕРІРёС… РљР°РЅР°Р»С–РІ", "Р”РёСЂРµРєС‚РѕСЂ РЎРёРЅРґРёРєР°С‚Сѓ РўС–РЅСЊ-Р СѓРґ", "РћР±СЃРёРґС–Р°РЅРѕРІР° РџРµС‡Р°С‚РєР° Р‘РѕСЂРіСѓ"],
  "F38": ["РЎС‚РѕСЂРѕР¶ Р”Р°РІРЅСЊРѕРіРѕ Р›С–СЃСѓ", "РЎС‚СЂС–Р»РµС†СЊ Р—РµР»РµРЅРёС… РўС–РЅРµР№", "РЁРµРїС‚СѓРЅ РЎС‚Р°СЂРёС… Р”РµСЂРµРІ", "Р’Р°СЂС‚РѕРІРёР№ РЎРІСЏС‰РµРЅРЅРѕРіРѕ Р“Р°СЋ", "РђСЂС…С–СЃС‚РѕСЂРѕР¶ Р”Р°РІРЅС–С… Р›С–СЃС–РІ", "Р”РµСЂРµРІРѕ-РџСЂРµРґРѕРє В«РџРµСЂС€РѕР»РёСЃС‚В»"],
  "F39": ["РЎР»СѓР¶РёС‚РµР»СЊ РўРµРєС‚РѕРЅС–РєРё", "Р†РЅР¶РµРЅРµСЂ Р РѕР·Р»РѕРјС–РІ", "Р“РµРѕСЃС‚СЂР°С‚РµРі РџР»РёС‚", "РђСЂС…РѕРЅС‚ РџС–РґР·РµРјРЅРёС… Р—СЃСѓРІС–РІ", "Р’РµСЂС…РѕРІРЅРёР№ РђСЂС…РѕРЅС‚ РўРµРєС‚РѕРЅС–РєРё", "РџР»РёС‚Р°, Р©Рѕ Р СѓС…Р°С”С‚СЊСЃСЏ РЎР°РјР°"],
  "F40": ["РњРёСЃР»РёРІРµС†СЊ РџРµСЂС€РѕС— РЎРєРµР»С–", "РљР°РјРµРЅРµС…РѕРґ РџР»РµРјРµРЅ", "РЁР°РјР°РЅ РџРёР»РѕРІРёС… РџС–СЃРµРЅСЊ", "Р’РѕР¶РґСЊ РџРµСЂС€РѕС— РЎРєРµР»С–", "РџСЂР°РјР°С‚С–СЂ РљР°Рј'СЏРЅРёС… РџР»РµРјРµРЅ", "РџРµСЂС€Р° РЎРєРµР»СЏ, Р–РёРІРёР№ РћР±С–С‚"]
};

// РњРЅРѕР¶РЅРёРєРё СЂС–РґРєРѕСЃС‚С–
const RARITY_MULTIPLIERS = {
  "R1": { value: 1.00, name: "common", displayName: "Р—РІРёС‡Р°Р№РЅР°" },
  "R2": { value: 1.10, name: "uncommon", displayName: "РќРµР·РІРёС‡Р°Р№РЅР°" },
  "R3": { value: 1.25, name: "rare", displayName: "Р С–РґРєС–СЃРЅР°" },
  "R4": { value: 1.45, name: "epic", displayName: "Р•РїС–С‡РЅР°" },
  "R5": { value: 1.70, name: "legendary", displayName: "Р›РµРіРµРЅРґР°СЂРЅР°" },
  "R6": { value: 2.00, name: "mythic", displayName: "РњС–С„С–С‡РЅР°" }
};

/**
 * Р‘Р°Р»Р°РЅСЃ СЃРёР» (Р»С–РЅС–Р№РЅР° РїСЂРѕРєР°С‡РєР°):
 *  - R1 / СЃС‚Р°СЂС‚РѕРІС–: +10 Р·Р° СЂС–РІРµРЅСЊ
 *  - R2: +20
 *  - R3: +50
 *  - R4: +100
 *  - R5: +500
 *  - R6: +500
 *
 * Р‘Р°Р·Р° (РґС–Р°РїР°Р·РѕРЅРё РїРѕ СЂС–РґРєРѕСЃС‚С–):
 *  - R1: 12..100
 *  - R2: 30..140
 *  - R3: 60..220
 *  - R4: 100..320
 *  - R5: 160..450
 *  - R6: 250..650
 */

const RARITY_BASE_RANGES = {
  R1: [12, 100],
  R2: [30, 140],
  R3: [60, 220],
  R4: [100, 320],
  R5: [160, 450],
  R6: [250, 650]
};

function lerp(min, max, t) {
  return Math.round(min + (max - min) * t);
}

// Р„РґРёРЅРµ РґР¶РµСЂРµР»Рѕ С–СЃС‚РёРЅРё РґР»СЏ СЃРёР»Рё РєР°СЂС‚Рё Р· СѓСЂР°С…СѓРІР°РЅРЅСЏРј СЂС–РІРЅСЏ
if (typeof window !== 'undefined' && typeof window.getPower === 'undefined') {
  window.getPower = function getPower(card, level = 1) {
    const lvl = Math.max(1, Number(level) || 1);
    const rarityId = (card.rarityId || card.rarity || 'R1').toString().toUpperCase();
    const incByRarity = { R1: 10, R2: 20, R3: 50, R4: 100, R5: 500, R6: 500 };
    const inc = incByRarity[rarityId] ?? 10;
    const base = Number(card.basePower) || 0;
    return Math.round(base + inc * (lvl - 1));
  };
}

// Р“РµРЅРµСЂР°С†С–СЏ РІСЃС–С… 240 РєР°СЂС‚
const ALL_CARDS = [];

for (let factionNum = 1; factionNum <= 40; factionNum++) {
  const factionId = `F${String(factionNum).padStart(2, '0')}`;
  const element = FACTION_ELEMENTS[factionId];
  const factionName = FACTION_NAMES[factionId];
  const cardNames = CARD_NAMES[factionId];

  // РґРµС‚РµСЂРјС–РЅРѕРІР°РЅР° РїРѕР·РёС†С–СЏ РІ РґС–Р°РїР°Р·РѕРЅС– 0..1 (С‰РѕР± Р±Р°Р·Рё Р±СѓР»Рё СЃС‚Р°Р±С–Р»СЊРЅС–)
  const t = (factionNum - 1) / 39;

  for (let rarityNum = 1; rarityNum <= 6; rarityNum++) {
    const rarityId = `R${rarityNum}`;
    const cardId = `${factionId}-${rarityId}`;
    const rarityData = RARITY_MULTIPLIERS[rarityId];

    // РќРѕРІР° Р±Р°Р·Р° РїРѕ РґС–Р°РїР°Р·РѕРЅР°С… (Р·Р°РјС–СЃС‚СЊ РјРЅРѕР¶РµРЅРЅСЏ rarity multiplier)
    const [minP, maxP] = RARITY_BASE_RANGES[rarityId] || RARITY_BASE_RANGES.R1;
    const finalPower = lerp(minP, maxP, t);
    
    // upgradeMult РґР»СЏ СЃРёСЃС‚РµРјРё РїСЂРѕРєР°С‡РєРё (Р·Р°Р»РµР¶РёС‚СЊ РІС–Рґ СЂС–РґРєРѕСЃС‚С–)
    // Р§РёРј СЂС–РґРєС–СЃРЅС–С€Р° РєР°СЂС‚Р°, С‚РёРј РјРµРЅС€РёР№ РїСЂРёСЂС–СЃС‚ РїСЂРё РїСЂРѕРєР°С‡С†С– (Р±Р°Р»Р°РЅСЃ)
    const upgradeMult = {
      1: 1.15, // common - С€РІРёРґРєРµ Р·СЂРѕСЃС‚Р°РЅРЅСЏ
      2: 1.13, // uncommon
      3: 1.11, // rare
      4: 1.09, // epic
      5: 1.07, // legendary
      6: 1.05  // mythic - РїРѕРІС–Р»СЊРЅРµ Р·СЂРѕСЃС‚Р°РЅРЅСЏ, Р°Р»Рµ РІРёСЃРѕРєР° Р±Р°Р·Р°
    }[rarityNum];
    
    ALL_CARDS.push({
      id: cardId,
      element: element,
      faction: factionId,
      factionName: factionName,
      // РЇРІРЅРѕ РїСЂРёСЃРІРѕСЋС”РјРѕ rarity РґР»СЏ РєРѕР¶РЅРѕС— РєР°СЂС‚Рё (РІР°Р¶Р»РёРІРѕ РґР»СЏ CSS-СЂР°РјРѕРє)
      rarity: rarityData.name, // "common", "uncommon", ...
      rarityId: rarityId,      // "R1".."R6"
      rarityName: rarityData.name,
      rarityDisplay: rarityData.displayName,
      basePower: finalPower,
      multiplier: 1.0,
      upgradeMult: upgradeMult,
      attack: finalPower,
      defense: Math.round(finalPower * 0.8),
      name: cardNames[rarityNum - 1]
    });
  }
}

// РЎС‚Р°СЂС‚РѕРІРёР№ РЅР°Р±С–СЂ РєР°СЂС‚ (16 С€С‚), СѓСЃС– РјР°СЋС‚СЊ СЃРёР»Сѓ 12
const STARTER_CARDS = [
  { id: 'S01', name: 'Р†СЃРєСЂРѕРІРёР№ РќРѕРІРѕР±СЂР°РЅРµС†СЊ', element: 'fire',  faction: 'S', factionName: 'РЎС‚Р°СЂС‚РѕРІРёР№ РЅР°Р±С–СЂ', rarity: 'common', rarityDisplay: 'Р—РІРёС‡Р°Р№РЅР°', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S02', name: 'РџС–РґРїР°Р»СЋРІР°С‡ РЁРµСЃС‚РµСЂРµРЅСЊ', element: 'fire',  faction: 'S', factionName: 'РЎС‚Р°СЂС‚РѕРІРёР№ РЅР°Р±С–СЂ', rarity: 'common', rarityDisplay: 'Р—РІРёС‡Р°Р№РЅР°', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S03', name: 'РЎС‚РѕСЂРѕР¶ Р–Р°СЂРєРѕРіРѕ РљРѕС‚Р»Р°', element: 'fire',  faction: 'S', factionName: 'РЎС‚Р°СЂС‚РѕРІРёР№ РЅР°Р±С–СЂ', rarity: 'common', rarityDisplay: 'Р—РІРёС‡Р°Р№РЅР°', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S04', name: 'РљРѕС‡РµРіР°СЂ РњС–РґРЅРѕРіРѕ РЎРµСЂС†СЏ', element: 'fire',  faction: 'S', factionName: 'РЎС‚Р°СЂС‚РѕРІРёР№ РЅР°Р±С–СЂ', rarity: 'common', rarityDisplay: 'Р—РІРёС‡Р°Р№РЅР°', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S05', name: 'РњР°С‚СЂРѕСЃ РўСѓРјР°РЅРЅРѕС— Р’Р°СЂС‚Рё', element: 'water', faction: 'S', factionName: 'РЎС‚Р°СЂС‚РѕРІРёР№ РЅР°Р±С–СЂ', rarity: 'common', rarityDisplay: 'Р—РІРёС‡Р°Р№РЅР°', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S06', name: 'Р РµРіСѓР»СЏС‚РѕСЂ РџР°СЂРѕРІРёС… РљР»Р°РїР°РЅС–РІ', element: 'water', faction: 'S', factionName: 'РЎС‚Р°СЂС‚РѕРІРёР№ РЅР°Р±С–СЂ', rarity: 'common', rarityDisplay: 'Р—РІРёС‡Р°Р№РЅР°', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S07', name: 'РќР°РІС–РіР°С‚РѕСЂ Р“Р»РёР±РѕРєРѕРіРѕ РљР°РЅР°Р»Сѓ', element: 'water', faction: 'S', factionName: 'РЎС‚Р°СЂС‚РѕРІРёР№ РЅР°Р±С–СЂ', rarity: 'common', rarityDisplay: 'Р—РІРёС‡Р°Р№РЅР°', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S08', name: 'РћС…РѕСЂРѕРЅРµС†СЊ РҐРѕР»РѕРґРЅРёС… Р РµР·РµСЂРІСѓР°СЂС–РІ', element: 'water', faction: 'S', factionName: 'РЎС‚Р°СЂС‚РѕРІРёР№ РЅР°Р±С–СЂ', rarity: 'common', rarityDisplay: 'Р—РІРёС‡Р°Р№РЅР°', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S09', name: 'РљСѓСЂвЂ™С”СЂ Р’С–С‚СЂСЏРЅРёС… РўСЂР°СЃ', element: 'air',   faction: 'S', factionName: 'РЎС‚Р°СЂС‚РѕРІРёР№ РЅР°Р±С–СЂ', rarity: 'common', rarityDisplay: 'Р—РІРёС‡Р°Р№РЅР°', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S10', name: 'РњРµС…Р°РЅС–Рє РђРµСЂРѕРєСЂРёР»', element: 'air',  faction: 'S', factionName: 'РЎС‚Р°СЂС‚РѕРІРёР№ РЅР°Р±С–СЂ', rarity: 'common', rarityDisplay: 'Р—РІРёС‡Р°Р№РЅР°', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S11', name: 'РЎРёРіРЅР°Р»СЊРЅРёРє Р’РёСЃРѕРєРёС… Р©РѕРіР»', element: 'air',  faction: 'S', factionName: 'РЎС‚Р°СЂС‚РѕРІРёР№ РЅР°Р±С–СЂ', rarity: 'common', rarityDisplay: 'Р—РІРёС‡Р°Р№РЅР°', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S12', name: 'РЎРїРѕСЃС‚РµСЂС–РіР°С‡ РќРµР±РµСЃРЅРёС… РўСѓСЂР±С–РЅ', element: 'air',  faction: 'S', factionName: 'РЎС‚Р°СЂС‚РѕРІРёР№ РЅР°Р±С–СЂ', rarity: 'common', rarityDisplay: 'Р—РІРёС‡Р°Р№РЅР°', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S13', name: 'Р РѕР±С–С‚РЅРёРє РљР°РјвЂ™СЏРЅРёС… Р”РѕРєС–РІ', element: 'earth', faction: 'S', factionName: 'РЎС‚Р°СЂС‚РѕРІРёР№ РЅР°Р±С–СЂ', rarity: 'common', rarityDisplay: 'Р—РІРёС‡Р°Р№РЅР°', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S14', name: 'РћРїРµСЂР°С‚РѕСЂ Р“С–СЂСЃСЊРєРёС… Р›С–С„С‚С–РІ', element: 'earth', faction: 'S', factionName: 'РЎС‚Р°СЂС‚РѕРІРёР№ РЅР°Р±С–СЂ', rarity: 'common', rarityDisplay: 'Р—РІРёС‡Р°Р№РЅР°', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S15', name: 'Р’Р°СЂС‚РѕРІРёР№ РЁР°С…С‚РЅРѕРіРѕ РџРµСЂРёРјРµС‚СЂСѓ', element: 'earth', faction: 'S', factionName: 'РЎС‚Р°СЂС‚РѕРІРёР№ РЅР°Р±С–СЂ', rarity: 'common', rarityDisplay: 'Р—РІРёС‡Р°Р№РЅР°', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S16', name: 'РўРµС…РЅС–Рє РћСЃР°РґРѕРІРёС… РњР°С€РёРЅ', element: 'earth', faction: 'S', factionName: 'РЎС‚Р°СЂС‚РѕРІРёР№ РЅР°Р±С–СЂ', rarity: 'common', rarityDisplay: 'Р—РІРёС‡Р°Р№РЅР°', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 }
];

ALL_CARDS.push(...STARTER_CARDS);

/**
 * РЁРІРёРґРєРёР№ С–РЅРґРµРєСЃ РєР°СЂС‚ Р·Р° ID
 */
const CARDS_BY_ID = Object.fromEntries(
  ALL_CARDS.map(card => [card.id, card])
);

/**
 * Р“СЂСѓРїСѓРІР°РЅРЅСЏ РєР°СЂС‚ РїРѕ СЃС‚РёС…С–СЏС…
 */
const CARDS_BY_ELEMENT = ALL_CARDS.reduce((acc, card) => {
  if (!acc[card.element]) {
    acc[card.element] = [];
  }
  acc[card.element].push(card);
  return acc;
}, {});

/**
 * Р“СЂСѓРїСѓРІР°РЅРЅСЏ РєР°СЂС‚ РїРѕ С„СЂР°РєС†С–СЏС…
 */
const CARDS_BY_FACTION = ALL_CARDS.reduce((acc, card) => {
  if (!acc[card.faction]) {
    acc[card.faction] = [];
  }
  acc[card.faction].push(card);
  return acc;
}, {});

// РҐРµР»РїРµСЂРё РґР»СЏ РґРѕСЃС‚СѓРїСѓ РґРѕ СЃС‚Р°СЂС‚РѕРІРёС… С‚Р° СѓСЃС–С… РєР°СЂС‚
const getAllCardIds = () => ALL_CARDS.map(card => card.id);
const getStarterCardIds = () => STARTER_CARDS.map(card => card.id);
const getRandomStarterCardIds = (count = 9) => {
  const ids = [...getStarterCardIds()];

  // Fisher-Yates shuffle РґР»СЏ С‡РµСЃРЅРѕРіРѕ РІРёРїР°РґРєРѕРІРѕРіРѕ РїРѕСЂСЏРґРєСѓ
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  return ids.slice(0, Math.min(count, ids.length));
};

// Р›РѕРєР°Р»СЊРЅРёР№ РїРѕС€СѓРє Р±РµР· РєРѕРЅС„Р»С–РєС‚Сѓ Р· РіР»РѕР±Р°Р»СЊРЅРёРјРё РѕРіРѕР»РѕС€РµРЅРЅСЏРјРё
function lookupCardById(id) {
  return CARDS_BY_ID[id] || null;
}

/**
 * Р“СЂСѓРїСѓРІР°РЅРЅСЏ РєР°СЂС‚ РїРѕ СЂС–РґРєРѕСЃС‚С–
 */
const CARDS_BY_RARITY = ALL_CARDS.reduce((acc, card) => {
  if (!acc[card.rarity]) {
    acc[card.rarity] = [];
  }
  acc[card.rarity].push(card);
  return acc;
}, {});

// Р•РєСЃРїРѕСЂС‚СѓС”РјРѕ РіР»РѕР±Р°Р»СЊРЅРѕ РґР»СЏ Р±СЂР°СѓР·РµСЂР°
window.ALL_CARDS = ALL_CARDS;
window.CARDS_BY_ID = CARDS_BY_ID;
window.CARDS_BY_ELEMENT = CARDS_BY_ELEMENT;
window.CARDS_BY_FACTION = CARDS_BY_FACTION;
window.CARDS_BY_RARITY = CARDS_BY_RARITY;
window.FACTION_NAMES = FACTION_NAMES;
window.RARITY_MULTIPLIERS = RARITY_MULTIPLIERS;
window.STARTER_CARDS = STARTER_CARDS;

// Р“Р»РѕР±Р°Р»СЊРЅС– С„СѓРЅРєС†С–С— РґР»СЏ РґРѕСЃС‚СѓРїСѓ РґРѕ РєР°СЂС‚
window.CARDS = ALL_CARDS;

if (!window.getCardById) {
  window.getCardById = function(id) {
    return lookupCardById(id);
  };
}

window.getAllCardIds = function() {
  return getAllCardIds();
};

window.getStarterCardIds = function() {
  return getStarterCardIds();
};

window.getRandomStarterCardIds = function(count = 9) {
  return getRandomStarterCardIds(count);
};

window.getCardsByElement = function(element) {
  return CARDS_BY_ELEMENT[element] || [];
};

window.getCardsByFaction = function(factionId) {
  return CARDS_BY_FACTION[factionId] || [];
};

window.getCardsByRarity = function(rarity) {
  return CARDS_BY_RARITY[rarity] || [];
};

// Node/CommonJS fallback
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CARDS: ALL_CARDS,
    STARTER_CARDS,
    getAllCardIds,
    getStarterCardIds,
    getRandomStarterCardIds,
    getCardById: lookupCardById,
    CARDS_BY_ID,
    CARDS_BY_ELEMENT,
    CARDS_BY_FACTION,
    CARDS_BY_RARITY
  };
}


/* ===== js/game/power.js ===== */
/**
 * РЎРРЎРўР•РњРђ Р РћР—Р РђРҐРЈРќРљРЈ РЎРР›Р РљРђР Рў
 * 
 * Р¤РѕСЂРјСѓР»Р° РїСЂРѕРєР°С‡РєРё:
 * power(level) = basePower * (upgradeMult) ^ (level - 1)
 * 
 * РџСЂРёРєР»Р°РґРё:
 * - Level 1: 10 * 1.12^0 = 10
 * - Level 2: 10 * 1.12^1 = 11.2 в‰€ 11
 * - Level 3: 10 * 1.12^2 = 12.54 в‰€ 13
 * - Level 5: 10 * 1.12^4 = 15.73 в‰€ 16
 */

/**
 * РћС‚СЂРёРјР°С‚Рё РїРѕС‚РѕС‡РЅСѓ СЃРёР»Сѓ РєР°СЂС‚Рё РїСЂРё РїРµРІРЅРѕРјСѓ СЂС–РІРЅС–
 * 
 * @param {Object} card - РѕР±'С”РєС‚ РєР°СЂС‚Рё Р· basePower С‚Р° upgradeMult
 * @param {number} level - СЂС–РІРµРЅСЊ РїСЂРѕРєР°С‡РєРё (РјС–РЅ 1)
 * @returns {number} РѕРєСЂСѓРіР»РµРЅР° СЃРёР»Р° РєР°СЂС‚Рё
 */
function getPower(card, level = 1) {
  if (!card || !card.basePower) {
    console.warn('Invalid card or missing basePower:', card);
    return 0;
  }

  const lvl = Math.max(1, Math.floor(level));
  const multiplier = card.upgradeMult || 1.1;
  
  // Р¤РѕСЂРјСѓР»Р°: basePower * (mult)^(level-1)
  const power = card.basePower * Math.pow(multiplier, lvl - 1);
  return Math.round(power);
}

/**
 * РћС‚СЂРёРјР°С‚Рё РјР°СЃРёРІ СЃРёР» РєР°СЂС‚Рё РїСЂРё СЂС–Р·РЅРёС… СЂС–РІРЅСЏС…
 * РћС‚СЂРёРјР°С‚Рё РјР°СЃРёРІ СЃРёР» РєР°СЂС‚Рё РїСЂРё СЂС–Р·РЅРёС… СЂС–РІРЅСЏС…
 * РљРѕСЂРёСЃРЅРѕ РґР»СЏ РІС–РґРѕР±СЂР°Р¶РµРЅРЅСЏ С‚Р°Р±Р»РёС†С– РїСЂРѕРєР°С‡РєРё
 * 
 * @param {Object} card - РѕР±'С”РєС‚ РєР°СЂС‚Рё
 * @param {number} maxLevel - РјР°РєСЃРёРјР°Р»СЊРЅРёР№ СЂС–РІРµРЅСЊ РґР»СЏ РїРѕРєР°Р·Сѓ
 * @returns {Array} РјР°СЃРёРІ [level, power]
 */
function getPowerProgression(card, maxLevel = 20) {
  const progression = [];
  for (let level = 1; level <= maxLevel; level++) {
    progression.push({
      level,
      power: getPower(card, level)
    });
  }
  return progression;
}

/**
 * РћС‚СЂРёРјР°С‚Рё РїСЂРёСЂС–СЃС‚ СЃРёР»Рё РїСЂРё РїРµСЂРµС…РѕРґС– РјС–Р¶ СЂС–РІРЅСЏРјРё
 * 
 * @param {Object} card - РѕР±'С”РєС‚ РєР°СЂС‚Рё
 * @param {number} fromLevel - РІС–Рґ СЏРєРѕРіРѕ СЂС–РІРЅСЏ
 * @param {number} toLevel - РґРѕ СЏРєРѕРіРѕ СЂС–РІРЅСЏ
 * @returns {number} РїСЂРёСЂС–СЃС‚ СЃРёР»Рё (С‡РёСЃР»o)
 */
function getPowerGain(card, fromLevel, toLevel) {
  const from = getPower(card, fromLevel);
  const to = getPower(card, toLevel);
  return to - from;
}

/**
 * РћС‚СЂРёРјР°С‚Рё РІС–РґСЃРѕС‚РѕРє РїСЂРёСЂРѕСЃС‚Сѓ СЃРёР»Рё
 * 
 * @param {Object} card - РѕР±'С”РєС‚ РєР°СЂС‚Рё
 * @param {number} fromLevel - РІС–Рґ СЏРєРѕРіРѕ СЂС–РІРЅСЏ
 * @param {number} toLevel - РґРѕ СЏРєРѕРіРѕ СЂС–РІРЅСЏ
 * @returns {number} РІС–РґСЃРѕС‚РѕРє РїСЂРёСЂРѕСЃС‚Сѓ (0-100)
 */
function getPowerGainPercent(card, fromLevel, toLevel) {
  const from = getPower(card, fromLevel);
  const to = getPower(card, toLevel);
  if (from === 0) return 0;
  return Math.round(((to - from) / from) * 100);
}

/**
 * РћС‚СЂРёРјР°С‚Рё СЃС‚Р°РЅРґР°СЂС‚РЅСѓ СЃРёР»Сѓ РєР°СЂС‚Рё (level 1)
 * 
 * @param {Object} card - РѕР±'С”РєС‚ РєР°СЂС‚Рё
 * @returns {number} Р±Р°Р·РѕРІР° СЃРёР»Р°
 */
function getBasePower(card) {
  return card?.basePower || 0;
}

/**
 * РџРѕСЂС–РІРЅСЏС‚Рё РґРІС– РєР°СЂС‚Рё РїРѕ СЃРёР»С– РїСЂРё РїРµРІРЅРѕРјСѓ СЂС–РІРЅС–
 * 
 * @param {Object} card1 - РїРµСЂС€Р° РєР°СЂС‚Р°
 * @param {Object} card2 - РґСЂСѓРіР° РєР°СЂС‚Р°
 * @param {number} level - СЂС–РІРµРЅСЊ РґР»СЏ РїРѕСЂС–РІРЅСЏРЅРЅСЏ
 * @returns {number} СЂС–Р·РЅРёС†СЏ (card1 - card2)
 */
function comparePower(card1, card2, level = 1) {
  const power1 = getPower(card1, level);
  const power2 = getPower(card2, level);
  return power1 - power2;
}

/**
 * Р РѕР·СЂР°С…СѓРІР°С‚Рё СЃРёР»Сѓ РєРѕР»РѕРґРё (СЃСѓРјР° РІСЃС–С… РєР°СЂС‚)
 * 
 * @param {Array} cards - РјР°СЃРёРІ РєР°СЂС‚
 * @param {number} level - СЂС–РІРµРЅСЊ РєРѕР¶РЅРѕС— РєР°СЂС‚Рё
 * @returns {number} Р·Р°РіР°Р»СЊРЅР° СЃРёР»Р° РєРѕР»РѕРґРё
 */
function getDeckPower(cards, level = 1) {
  if (!Array.isArray(cards)) return 0;
  
  return cards.reduce((total, card) => {
    return total + getPower(card, level);
  }, 0);
}

/**
 * РћС‚СЂРёРјР°С‚Рё С–РЅС„РѕСЂРјР°С†С–СЋ РїСЂРѕ РїСЂРѕРєР°С‡РєСѓ РєР°СЂС‚Рё РІ С‚РµРєСЃС‚РѕРІРѕРјСѓ С„РѕСЂРјР°С‚С–
 * 
 * @param {Object} card - РѕР±'С”РєС‚ РєР°СЂС‚Рё
 * @param {number} level - СЂС–РІРµРЅСЊ РєР°СЂС‚Рё
 * @returns {string} СЂСЏРґРѕРє С–РЅС„РѕСЂРјР°С†С–С—
 */
function getCardInfoString(card, level = 1) {
  const power = getPower(card, level);
  const mult = (card.upgradeMult * 100 - 100).toFixed(0);
  return `${card.name}: ${power} (+${mult}% Р·Р° СЂС–РІРµРЅСЊ)`;
}

/**
 * РЎРРЎРўР•РњРђ РџР РћРљРђР§РљР РљРђР Рў (XP-СЃРёСЃС‚РµРјР°)
 * Р§РёСЃС‚Р° СЂРµР°Р»С–Р·Р°С†С–СЏ Р±РµР· Р·Р°Р»РµР¶РЅРѕСЃС‚РµР№, Р»РµРіРєРѕ СЂРѕР·С€РёСЂСЋРІР°РЅР°.
 */

/**
 * Р“Р°СЂР°РЅС‚СѓРІР°С‚Рё, С‰Рѕ РїСЂРѕРіСЂРµСЃ РєР°СЂС‚Рё С–СЃРЅСѓС” (С…РµР»РїРµСЂ)
 * @param {Object} state - РѕР±'С”РєС‚ РіСЂР°РІС†СЏ
 * @param {string} cardId - ID РєР°СЂС‚Рё
 * @returns {Object} {level, xp}
 */
function getProgress(state, cardId) {
  if (!state.progress) state.progress = {};
  if (!state.progress[cardId]) {
    state.progress[cardId] = { level: 1, xp: 0 };
  }
  return state.progress[cardId];
}

/**
 * РЎРєС–Р»СЊРєРё XP РїРѕС‚СЂС–Р±РЅРѕ РґР»СЏ Р°Рї РЅР° РЅР°СЃС‚СѓРїРЅРёР№ СЂС–РІРµРЅСЊ
 * РџР»Р°РІРЅРµ Р·СЂРѕСЃС‚Р°РЅРЅСЏ: lvl1в†’2: 20, lvl2в†’3: 32, lvl3в†’4: 46, lvl4в†’5: 62 ...
 * @param {number} level - РїРѕС‚РѕС‡РЅРёР№ СЂС–РІРµРЅСЊ
 * @returns {number} XP РґР»СЏ level в†’ level+1
 */
function xpNeed(level) {
  return Math.round((20 + 12 * (level - 1) + 2 * (level - 1) ** 2) * 1.15);
}

/**
 * РЎРєС–Р»СЊРєРё XP РґР°С” РєР°СЂС‚Р° РїСЂРё СЃРїР°Р»РµРЅРЅС–
 * lvl1 = 5, lvl5 = 50
 * Р¤РѕСЂРјСѓР»Р°: (5 * level * (level + 3)) / 4
 * @param {number} level - СЂС–РІРµРЅСЊ РєР°СЂС‚Рё, СЏРєСѓ СЃРїР°Р»СЋС”РјРѕ
 * @returns {number} РєС–Р»СЊРєС–СЃС‚СЊ XP
 */
function xpValue(level) {
  return Math.round((5 * level * (level + 3)) / 4);
}

/**
 * Р”РѕРґР°С‚Рё XP РґРѕ РєР°СЂС‚Рё С– Р°РІС‚РѕРјР°С‚РёС‡РЅРѕ Р°Рї СЂС–РІРЅС–
 * @param {Object} state - РѕР±'С”РєС‚ РіСЂР°РІС†СЏ
 * @param {string} cardId - ID РєР°СЂС‚Рё
 * @param {number} amount - СЃРєС–Р»СЊРєРё XP РґРѕРґР°С‚Рё
 */
function addXp(state, cardId, amount) {
  const p = getProgress(state, cardId);
  p.xp += amount;

  // РђРї СЂС–РІРЅС–РІ, РїРѕРєРё РІРёСЃС‚Р°С‡Р°С” XP
  while (p.xp >= xpNeed(p.level)) {
    p.xp -= xpNeed(p.level);
    p.level += 1;
  }
}

/**
 * Р РµРЅРґРµСЂРёС‚Рё XP-Р±Р°СЂ (РѕРЅРѕРІРёС‚Рё DOM РµР»РµРјРµРЅС‚Рё cu-*)
 * @param {Object} state - РѕР±'С”РєС‚ РіСЂР°РІС†СЏ
 * @param {string} cardId - ID РєР°СЂС‚Рё
 */
function renderUpgradeBar(state, cardId) {
  const cuLevel = document.getElementById('cu-level');
  const cuXpText = document.getElementById('cu-xp-text');
  const cuXpFill = document.getElementById('cu-xp-fill');

  if (!cuLevel || !cuXpText || !cuXpFill) {
    console.warn('Upgrade bar elements not found');
    return;
  }

  const prog = getProgress(state, cardId);
  const need = xpNeed(prog.level);
  const pct = Math.min(100, Math.round((prog.xp / need) * 100));

  cuLevel.textContent = `LV ${prog.level}`;
  cuXpText.textContent = `${prog.xp} / ${need} XP`;
  cuXpFill.style.width = `${pct}%`;
}

/**
 * РћРЅРѕРІРёС‚Рё СЃС‚Р°РЅ РєРЅРѕРїРєРё РџСЂРѕРєР°С‡РёС‚Рё (disabled СЏРєС‰Рѕ РЅРµРјР°С” РєР°СЂС‚ РґР»СЏ СЃРїР°Р»РµРЅРЅСЏ)
 * @param {Object} state - РѕР±'С”РєС‚ РіСЂР°РІС†СЏ
 * @param {string} cardId - ID РєР°СЂС‚Рё РґР»СЏ РїСЂРѕРєР°С‡РєРё
 */
function updateUpgradeButton(state, cardId) {
  const btn = document.getElementById('cu-upgrade-btn');
  if (!btn) return;

  // Р—РЅР°Р№С‚Рё РґР°РЅС– РєР°СЂС‚Рё РґР»СЏ РѕС‚СЂРёРјР°РЅРЅСЏ СЃС‚РёС…С–С—
  const cardData = window.getCardById ? window.getCardById(cardId) : null;
  if (!cardData) {
    btn.disabled = true;
    return;
  }

  // Р—РЅР°Р№С‚Рё РІСЃС– РєР°СЂС‚Рё, СЏРєС– РјРѕР¶РµРјРѕ СЃРїР°Р»РёС‚Рё (С‚Р° Р¶ СЃС‚РёС…С–СЏ, Р°Р»Рµ РЅРµ СЃР°РјР° РєР°СЂС‚Р°)
  const allCards = window.ALL_CARDS || window.CARDS_COMMON || [];
  const canBurn = allCards.some(c => {
    // РўР° Р¶ СЃС‚РёС…С–СЏ, Р°Р»Рµ РЅРµ СЃР°РјР° РєР°СЂС‚Р°
    if (c.element !== cardData.element || c.id === cardId) return false;
    // РџРµСЂРµРІС–СЂРёС‚Рё С–РЅРІРµРЅС‚Р°СЂ (С” РєР°СЂС‚Рё РґР»СЏ СЃРїР°Р»РµРЅРЅСЏ)
    const count = state.inventory && state.inventory[c.id] ? state.inventory[c.id] : 0;
    return count > 0;
  });

  btn.disabled = !canBurn;
}

// Р•РєСЃРїРѕСЂС‚СѓС”РјРѕ РіР»РѕР±Р°Р»СЊРЅРѕ РґР»СЏ Р±СЂР°СѓР·РµСЂР°
window.getPower = getPower;
window.getPowerProgression = getPowerProgression;
window.getPowerGain = getPowerGain;
window.getPowerGainPercent = getPowerGainPercent;
window.getBasePower = getBasePower;
window.comparePower = comparePower;
window.getDeckPower = getDeckPower;
window.getCardInfoString = getCardInfoString;
window.getProgress = getProgress;
window.xpValue = xpValue;
window.xpNeed = xpNeed;
window.addXp = addXp;
window.renderUpgradeBar = renderUpgradeBar;
window.updateUpgradeButton = updateUpgradeButton;


/* ===== js/game/drop.js ===== */
// Card drop system with rarity and element chances
// Based on balanced TCG drop rates

// Drop rate configuration
const DROP_CONFIG = {
  rarity_drop_rates: {
    R1: 60,
    R2: 15,
    R3: 15,
    R4: 10,
    R5: 0,
    R6: 0
  },
  element_drop_rates: {
    fire: 25,
    water: 25,
    air: 25,
    earth: 25
  },
  starter_pool: {
    enabled_until_complete: true
  },
  pity_system: {
    legendary_guarantee_after: 40,
    mythic_guarantee_after: 120
  }
};

const RARITY_ORDER = ['R1','R2','R3','R4','R5','R6'];
const rarityRank = r => Math.max(1, RARITY_ORDER.indexOf(r) + 1);

const sumRates = (rates) => Object.values(rates || {}).reduce((s,v)=>s+(v||0),0);

const normalizeRates = (rates) => {
  const total = sumRates(rates) || 1;
  const out = {};
  for (const r of RARITY_ORDER) out[r] = ((rates[r] || 0) / total) * 100;
  return out;
};

const clampRatesToMax = (rates, maxRarity) => {
  if (!maxRarity) return {...rates};
  const maxRank = rarityRank(maxRarity);
  const out = {};
  for (const r of RARITY_ORDER) out[r] = (rarityRank(r) > maxRank) ? 0 : (rates[r] || 0);
  return out;
};

const rollFromNormalized = (normalized) => {
  const roll = Math.random() * 100;
  let cum = 0;
  for (const r of RARITY_ORDER) {
    cum += (normalized[r] || 0);
    if (roll <= cum) return r;
  }
  return 'R1';
};

const rollElement = (elementRates) => {
  const rates = elementRates || DROP_CONFIG.element_drop_rates;
  const roll = Math.random() * 100;
  let cum = 0;
  for (const el of Object.keys(rates)) {
    cum += rates[el] || 0;
    if (roll <= cum) return el;
  }
  return Object.keys(rates)[0] || 'fire';
};

const getRandomFromPool = (pool) => {
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
};

const hasCompletedStarterCollection = (profile, starterCards) => {
  if (!profile || !profile.inventory) return false;
  const starterIds = (starterCards || []).map(c => c.id);
  return starterIds.every(id => profile.inventory && profile.inventory[id] > 0);
};

// Core option-aware single drop implementation
const dropCardCore = (profile, allCards, starterCards, pityCounters = {noLegendary:0,noMythic:0}, opts = {}) => {
  const counters = { noLegendary: (pityCounters.noLegendary||0), noMythic: (pityCounters.noMythic||0) };

  // Starter pool
  const starterActive = DROP_CONFIG.starter_pool.enabled_until_complete && !hasCompletedStarterCollection(profile, starterCards);
  if (starterActive && starterCards && starterCards.length) {
    return { card: getRandomFromPool(starterCards), rarity: null, fromStarterPool: true, pityCounters: counters };
  }

  // Assemble rates
  const baseRates = opts.rarityRates || DROP_CONFIG.rarity_drop_rates;
  // First clamp to maxRarity if provided
  const capped = clampRatesToMax(baseRates, opts.maxRarity);
  // Normalize
  const normalized = normalizeRates(capped);

  // Pity checks (won't exceed maxRarity because capped above)
  let forcedRarity = null;
  if ((counters.noMythic || 0) >= (DROP_CONFIG.pity_system.mythic_guarantee_after || 999999)) {
    forcedRarity = 'R6';
  } else if ((counters.noLegendary || 0) >= (DROP_CONFIG.pity_system.legendary_guarantee_after || 999999)) {
    forcedRarity = 'R5';
  }

  if (forcedRarity) {
    // If forced rarity is above maxRarity, clamp it down
    if (opts.maxRarity && rarityRank(forcedRarity) > rarityRank(opts.maxRarity)) {
      forcedRarity = opts.maxRarity;
    }
    // If the forced rarity has zero chance in the capped rates, pick the highest allowed rarity with non-zero chance
    const cappedRates = clampRatesToMax(baseRates, opts.maxRarity);
    const hasChance = (r) => (cappedRates[r] || 0) > 0;
    if (!hasChance(forcedRarity)) {
      // find highest allowed rarity with positive weight
      let found = null;
      for (let i = RARITY_ORDER.length - 1; i >= 0; i--) {
        const r = RARITY_ORDER[i];
        if (hasChance(r)) { found = r; break; }
      }
      forcedRarity = found; // may be null
    }
  }

  // Roll rarity (or apply forced)
  let rarity = forcedRarity || rollFromNormalized(normalized);

  // Guaranteed at least
  if (opts.guaranteedAtLeast) {
    const need = rarityRank(opts.guaranteedAtLeast);
    if (rarityRank(rarity) < need) rarity = opts.guaranteedAtLeast;
  }

  // Final clamp to maxRarity again to be safe
  if (opts.maxRarity && rarityRank(rarity) > rarityRank(opts.maxRarity)) {
    rarity = opts.maxRarity;
  }

  const element = rollElement(opts.elementRates);

  let pool = (allCards || []).filter(c => c.rarity === rarity && c.element === element);
  if (!pool.length) pool = (allCards || []).filter(c => c.rarity === rarity);
  if (!pool.length) pool = (allCards || []).filter(c => c.element === element);
  if (!pool.length) pool = allCards || [];

  const card = getRandomFromPool(pool);

  // Update pity counters
  if (rarity === 'R6') {
    counters.noMythic = 0; counters.noLegendary = 0;
  } else if (rarity === 'R5') {
    counters.noLegendary = 0; counters.noMythic = (counters.noMythic||0) + 1;
  } else {
    counters.noLegendary = (counters.noLegendary||0) + 1; counters.noMythic = (counters.noMythic||0) + 1;
  }

  return { card, rarity, fromStarterPool: false, pityCounters: counters };
};

// Public API
if (typeof window !== 'undefined') {
  window.dropCardWithOptions = window.dropCardWithOptions || function(profile, allCards, starterCards, pityCounters, opts) {
    return dropCardCore(profile, allCards, starterCards, pityCounters, opts);
  };

  window.dropCardsWithOptions = window.dropCardsWithOptions || function(profile, allCards, starterCards, count = 1, pityCounters, opts) {
    const res = { cards: [], pityCounters: { noLegendary: (pityCounters && pityCounters.noLegendary)||0, noMythic: (pityCounters && pityCounters.noMythic)||0 } };
    for (let i=0;i<count;i++){
      const t = dropCardCore(profile, allCards, starterCards, res.pityCounters, opts);
      if (t.card) res.cards.push(t.card);
      res.pityCounters = t.pityCounters;
    }
    return res;
  };

  // Backwards-compatible wrappers
  window.dropCard = window.dropCard || function(profile, allCards, starterCards, pityCounters) {
    const opts = {}; return dropCardCore(profile, allCards, starterCards, pityCounters, opts);
  };

  window.dropCards = window.dropCards || function(profile, allCards, starterCards, count, pityCounters) {
    return window.dropCardsWithOptions(profile, allCards, starterCards, count, pityCounters, {});
  };

  const getDropChance = (result) => {
    // After duel drop chance: set to 5% for all duel outcomes
    switch (result) {
      case 'win': return 0.05;
      case 'lose': return 0.05;
      case 'draw': return 0.05;
      default: return 0;
    }
  };

  const shouldDrop = (result) => Math.random() < getDropChance(result);

  window.dropSystem = window.dropSystem || {};
  window.dropSystem.DROP_CONFIG = DROP_CONFIG;
