/* ===== js/data/cards.js ===== */
/**
 * КАРТОВА БАЗА ГРИ - 40 ФРАКЦІЙ, 240 КАРТ
 * 
 * Структура карти:
 * - id: унікальний ідентифікатор (формат: "F##-R#" де ## - номер фракції, # - рідкість)
 * - element: "fire" | "water" | "air" | "earth"
 * - faction: ID фракції
 * - factionName: Назва фракції
 * - rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic"
 * - basePower: фінальна сила карти (base * multiplier)
 * - multiplier: множник рідкості (для розрахунків)
 * - upgradeMult: множник прокачки (для системи рівнів)
 * - attack: атака (дорівнює basePower)
 * - defense: захист (80% від basePower)
 * - name: ім'я карти
 */

// =========================================================
// TASKS DATA
// =========================================================

const TASKS = [
  {
    id: "duel_1",
    title: "Перший бій",
    desc: "Зіграйте 1 дуель",
    type: "duel",
    target: 1,
    reward: { xp: 50, gears: 1 }
  },
  {
    id: "duel_10",
    title: "Розігрів",
    desc: "Зіграйте 10 дуелей",
    type: "duel",
    target: 10,
    reward: { xp: 200, gears: 3 }
  },
  {
    id: "win_5",
    title: "Переможець",
    desc: "Виграйте 5 дуелей",
    type: "win",
    target: 5,
    reward: { xp: 300, gears: 5 }
  }
];

const TASKS_RESET_MS = 12 * 60 * 60 * 1000; // 12 годин

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
    container.innerHTML = '<div class="no-tasks">Увійдіть, щоб бачити завдання</div>';
    return;
  }

  ensureTasksState(profile);

  container.innerHTML = TASKS.map(task => {
    const progress = profile.tasks[task.id] || 0;
    const completed = Array.isArray(profile.completedTasks) && profile.completedTasks.includes(task.id);
    const pct = Math.min(100, Math.round((progress / Math.max(1, task.target)) * 100));
    const rewardParts = [];
    if (task.reward && task.reward.xp) rewardParts.push(`+${task.reward.xp} XP`);
    if (task.reward && task.reward.gears) rewardParts.push(`+${task.reward.gears} ⚙️`);
    const rewardTxt = rewardParts.join(', ');

    return `
      <div class="task-card ${completed ? 'task-done' : ''}" data-task-id="${task.id}">
        <div class="task-top"><div class="task-title">${task.title}</div><div class="task-reward">${rewardTxt}</div></div>
        <div class="task-desc">${task.desc}</div>
        <div class="task-bar"><div class="task-bar-fill" style="width:${pct}%"></div></div>
        <div class="task-footer">${completed ? 'Виконано' : `${progress}/${task.target}`}</div>
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
  // беремо тільки базові карти (без прокачки гравця)
  // Якщо сила гравця = 12 * кількість карт (всі карти по 12), не давати ворогу міфічні карти
  let filteredCards = allCards.filter(c => c && typeof c.power === 'number');
  // Визначаємо, чи всі карти гравця по 12 (стартові)
  if (typeof window !== 'undefined' && window.playerDeck) {
    const playerCards = window.playerDeck;
    const allTwelve = Array.isArray(playerCards) && playerCards.length > 0 && playerCards.every(card => (card.basePower || card.power) === 12);
    if (allTwelve) {
      filteredCards = filteredCards.filter(c => c.rarity !== 'mythic' && c.rarityId !== 'R6');
    }
  }
  // Підбір карт так, щоб сума їх сили була в діапазоні [targetPower-20, targetPower+20]
  filteredCards = filteredCards.sort((a, b) => b.power - a.power);
  let bestCombo = [];
  let bestSum = 0;
  const minPower = Math.max(0, targetPower - 20);
  const maxPower = targetPower + 20;
  // Перебираємо всі комбінації до maxCards (жадібно, але не рандомно)
  function findBestCombo(cards, maxCards, minTarget, maxTarget, current = [], sum = 0, idx = 0) {
    if (current.length > maxCards || sum > maxTarget) return;
    if (sum >= minTarget && sum <= maxTarget && sum > bestSum) {
      bestSum = sum;
      bestCombo = [...current];
    }
    for (let i = idx; i < cards.length; i++) {
      findBestCombo(cards, maxCards, minTarget, maxTarget, [...current, cards[i]], sum + cards[i].power, i + 1);
    }
  }
  findBestCombo(filteredCards, maxCards, minPower, maxPower);
  // fallback: якщо не набрали нічого — взяти мінімальну карту
  if (bestCombo.length === 0 && filteredCards.length) {
    bestCombo = [filteredCards[filteredCards.length - 1]];
    bestSum = bestCombo[0].power;
  }
  return { cards: bestCombo, totalPower: bestSum };
}

// --- Helper utilities for enemy generation ---
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function getPlayerDeckPower() {
  try {
    const profile = (typeof userProfile !== 'undefined') ? userProfile.getProfile() : null;
    const deck = (profile && profile.deckCards) ? profile.deckCards : [];
    return deck.reduce((sum, c) => {
      const card = getCardById(c.cardId || c.id || c);
      return sum + (card ? (window.getPower ? window.getPower(card, c.level || 1) : getPower(card, c.level || 1)) : 0);
    }, 0);
  } catch (e) {
    return 0;
  }
}

function isStarterDeck(deck) {
  if (!deck || !Array.isArray(deck) || deck.length === 0) return false;
  return deck.every(c => {
    const card = getCardById(c.cardId || c.id || c);
    return card && Number(card.basePower) === 12 && (c.level || 1) === 1;
  });
}

function buildEnemyDeckByPower(targetPower, maxCards = 9) {
  const profile = (typeof userProfile !== 'undefined') ? userProfile.getProfile() : null;
  const playerDeck = (profile && profile.deckCards) ? profile.deckCards : [];

  const starter = isStarterDeck(playerDeck);

  let pool = (window.ALL_CARDS || []).filter(c => c);

  if (starter) {
    pool = pool.filter(c => c.rarity !== 'mythic' && c.rarityId !== 'R6');
  }

  pool = pool.sort((a, b) => (window.getPower ? window.getPower(b, 1) : getPower(b, 1)) - (window.getPower ? window.getPower(a, 1) : getPower(a, 1)));

  const deck = [];
  let sum = 0;

  for (const card of pool) {
    if (deck.length >= maxCards) break;

    const p = window.getPower ? window.getPower(card, 1) : getPower(card, 1);
    // try to fit keeping some tolerance
    if (sum + p <= targetPower + 10) {
      deck.push({ id: card.id, level: 1 });
      sum += p;
    }

    if (sum >= targetPower - 10) break;
  }

  return { cards: deck, power: sum };
}

function generateEnemyForDuel() {
  const playerPower = getPlayerDeckPower();

  const target = clamp(
    Math.round(playerPower * rand(0.9, 1.05)),
    Math.max(0, playerPower - 20),
    playerPower + 20
  );

  const enemyDeckRaw = buildEnemyDeckByPower(target, 9);

  const deck = enemyDeckRaw.cards.map(ci => {
    const src = getCardById(ci.id) || {};
    const level = ci.level || 1;
    const power = Math.max(12, Math.round(window.getPower ? window.getPower(src, level) : getPower(src, level) || 12));
    return { id: src.id || ci.id, element: src.element || 'fire', rarity: src.rarity || 'common', power };
  });

  // Diagnostic log: show per-card powers chosen for enemy
  try { console.debug('generateEnemyForDuel -> deck powers', deck.map(d=>d.power)); } catch(e) {}

  const powerSum = deck.reduce((s, c) => s + (c.power || 0), 0);

  return {
    deck,
    power: powerSum,
    hp: powerSum,
    maxHp: powerSum,
    target
  };
}

// Маппінг елементів для фракцій
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

// Назви фракцій
const FACTION_NAMES = {
  "F01": "Орден Попелястого Сонця",
  "F02": "Легіон Палаючих Клинків",
  "F03": "Культ Вічного Полум'я",
  "F04": "Імперія Червоного Дракона",
  "F05": "Ковалі Магми",
  "F06": "Сини Вулкану",
  "F07": "Піратські Клани Жару",
  "F08": "Братство Обвуглених",
  "F09": "Вартові Кальдери",
  "F10": "Пророки Вогняної Крони",
  "F11": "Королівство Глибин",
  "F12": "Орден Припливу",
  "F13": "Морські Відьми Синіх Рифів",
  "F14": "Флот Бездонної Тиші",
  "F15": "Хранителі Крижаних Озер",
  "F16": "Народ Туманних Дельт",
  "F17": "Левіафанові Жерці",
  "F18": "Перлинний Конклав",
  "F19": "Клан Штормових Хвиль",
  "F20": "Архіви Забутих Морів",
  "F21": "Небесні Кочівники",
  "F22": "Орден Чистого Вітру",
  "F23": "Штормові Яструби",
  "F24": "Ліга Левітації",
  "F25": "Хмарні Магістри",
  "F26": "Сини Урагану",
  "F27": "Дзвонарі Атмосфери",
  "F28": "Вартові Високих Піків",
  "F29": "Астральні Мандрівці",
  "F30": "Конклав Повітряних Сфер",
  "F31": "Кам'яні Домініони",
  "F32": "Орден Коріння",
  "F33": "Залізні Друїди",
  "F34": "Клани Гірських Щитів",
  "F35": "Хранителі Монолітів",
  "F36": "Народ Печер",
  "F37": "Обсидіановий Синдикат",
  "F38": "Сторожі Давніх Лісів",
  "F39": "Архонти Тектоніки",
  "F40": "Племена Першої Скелі"
};

// Назви карт для кожної фракції
const CARD_NAMES = {
  "F01": ["Послушник Попелястого Сонця", "Світоч Попелястих Молитв", "Інквізитор Сажі", "Паладин Сонячного Попелу", "Архонт Попелястого Світанку", "Емісар Чорного Полудня"],
  "F02": ["Легіонер Палаючого Клинка", "Капрал Розжареної Сталі", "Дуелянист Вогняного Ребра", "Центуріон Полум'яних Шеренг", "Маршал Клинків-Комет", "Володар Першого Розжарення"],
  "F03": ["Фанатик Вічного Полум'я", "Жрець Жаркого Кадила", "Провидець Безкінечної Іскри", "Обрядник Непогасного Вогню", "Верховний Паламар Культу", "Серце Вічного Полум'я"],
  "F04": ["Солдат Драконової Варти", "Драконів Вершник Пороху", "Гвардієць Червоного Трону", "Прапороносець Драконового Вогню", "Регент Луски й Полум'я", "Червоний Дракон-Імператор"],
  "F05": ["Коваль Магмового Горна", "Ливарник Рідкого Каменю", "Майстер Рун Розплаву", "Коваль-Алхімік Вулканічних Сплавів", "Великий Горняк Магми", "Горнило Першої Кузні"],
  "F06": ["Рейдер Вулканічних Схилів", "Мисливець на Лавових Псів", "Шаман Гримучого Кратера", "Ватажок Синів Вулкану", "Першородний Вулканіт", "Спадкоємець Серця Кратера"],
  "F07": ["Пірат Жаркого Вітрила", "Боцман Кіптявих Канатів", "Гарпунник Вогняної Хвилі", "Капітан Палаючих Рифів", "Корсар Червоного Шторму", "Флагман «Розжарений Привид»"],
  "F08": ["Обвуглений Сторож", "Збирач Вуглин", "Тінь Сажистого Леза", "Палкий Месник Братства", "Старійшина Обвуглених Клятв", "Прах, Що Пам'ятає Імена"],
  "F09": ["Вартовий Кальдери", "Розвідник Киплячих Порожнин", "Хранитель Лавових Брам", "Командир Кальдерних Щитів", "Страж Краю Вулкану", "Кальдера, Що Дихає"],
  "F10": ["Аколіт Вогняної Крони", "Тлумач Іскорного Знаку", "Провісник Полум'яного Пророцтва", "Оракул Коронованого Жару", "Верховний Пророк Палаючої Крони", "Крона, Що Говорить Вогнем"],
  "F11": ["Дозорець Глибин", "Водолаз Королівської Варти", "Маг Тиску Безодні", "Рицар Перлинної Броні", "Регент Трону Глибин", "Король Безодні, Володар Припливів"],
  "F12": ["Послушник Ордену Припливу", "Монах Солоних Хвиль", "Настоятель Водяних Кругів", "Майстер Дев'яти Припливів", "Архімонах Великої Поверті", "Приплив, Що Не Має Берега"],
  "F13": ["Відьомська Учениця Рифів", "Травниця Солоних Чар", "Чарівниця Синього Рифу", "Матрона Рифових Заклять", "Володарка Рифової Ночі", "Сирена «Синя Безвихідь»"],
  "F14": ["Матрос Бездонної Тиші", "Штурман Мовчазних Вод", "Капітан Беззвучного Корабля", "Адмірал Тихих Морів", "Флагман «Глибока Пауза»", "Тиша, Що Тягне На Дно"],
  "F15": ["Сторож Крижаного Озера", "Лижник Північних Заток", "Заклинач Льодяних Дзеркал", "Крижаний Чемпіон Озер", "Старший Хранитель Північної Кромки", "Озеро, Що Пам'ятає Зиму"],
  "F16": ["Провідник Туманної Дельти", "Мисливець Мокрих Стежок", "Ткач Туману й Лози", "Вартовий Дельтових Болот", "Старійшина Семи Рук Дельти", "Туман, Що Ходить Людьми"],
  "F17": ["Служка Левіафана", "Жрець Соляних Псалмів", "Наглядач Китового Храму", "Проповідник Підводної Величі", "Верховний Жрець Левіафана", "Левіафан «Солона Воля»"],
  "F18": ["Збирач Перлин Конклаву", "Дипломат Перлинних Знакiв", "Арбітр Коралових Угод", "Маг Перлинної Логіки", "Голова Перлинного Конклаву", "Перлина, Що Судить Шторми"],
  "F19": ["Воїн Штормової Хвилі", "Бігун Прибою", "Списоносець Грому над Водою", "Провідник Штормового Нальоту", "Ватажок Клану Глибокого Грому", "Хвиля «Грім-Розлом»"],
  "F20": ["Писар Забутих Морів", "Картограф Солоних Таємниць", "Хранитель Ракушкових Хронік", "Архіваріус Підводних Літописів", "Куратор Бездонної Бібліотеки", "Книга, Що Пише Приплив"],
  "F21": ["Скаут Небесних Кочівників", "Погонич Вітряних Звірів", "Лучник Хмарних Степів", "Вождь Повітряного Каравану", "Старший Шаман Небесних Доріг", "Караван, Що Йде По Небу"],
  "F22": ["Послушник Чистого Вітру", "Монах Легкого Подиху", "Стихійник Прозорих Поривів", "Настоятель Вітряного Кола", "Архімаг Чистого Вітру", "Подих, Що Очищує Світ"],
  "F23": ["Яструбиний Розвідник", "Пікінер Грозових Крил", "Снайпер Штормового Неба", "Командир Яструбиних Ланок", "Володар Грозових Течій", "Яструб «Грімоклюв»"],
  "F24": ["Технік Левітаційних Рун", "Інженер Підйомних Сфер", "Арканіст Гравітаційних Зсувів", "Майстер Левітаційних Портів", "Голова Ліги Левітації", "Нульова Вага, Печатка Ліги"],
  "F25": ["Учень Хмарних Магістрів", "Скульптор Туману", "Магістр Хмарних Форм", "Архітектор Небесних Веж", "Великий Магістр Висоти", "Палац Із Хмар, Що Не Тануть"],
  "F26": ["Рейдер Ураганного Клану", "Борець Вихорів", "Шаман Спіральних Бур", "Ватажок Синів Урагану", "Першородний Вихорник", "Ураган, Що Має Ім'я"],
  "F27": ["Дзвонар Небесної Вежі", "Ритміст Повітряних Хорів", "Тональник Барометрів", "Майстер Дзвонів Грозової Межі", "Верховний Дзвонар Атмосфери", "Дзвін, Що Керує Небом"],
  "F28": ["Сторож Високого Піку", "Провідник Круч", "Стрілець Пікових Вітрів", "Командир Пікових Застав", "Голова Варти Небесного Хребта", "Пік, Що Дивиться На Час"],
  "F29": ["Мандрівець Астральних Стежок", "Навігатор Сузір'їв", "Пілігрим Нульового Неба", "Капітан Астрального Вітрила", "Архімандрівець Порожньої Орбіти", "Сузір'я, Що Веде Домів"],
  "F30": ["Учень Сфер Конклаву", "Оператор Аеросфери", "Маг Сферичних Течій", "Архонт Повітряних Сфер", "Голова Конклаву Високого Тиску", "Сфера, Що Тримає Бурю"],
  "F31": ["Дружинник Кам'яних Домініонів", "Тесля Монолітних Брам", "Геомант Домініонів", "Командир Базальтових Легій", "Князь Кам'яного Закону", "Домініон, Що Не Падає"],
  "F32": ["Послушник Ордену Коріння", "Садівник Священних Ліан", "Друїд Глибоких Коренів", "Настоятель Живого Гаю", "Архідруїд Коріння", "Корінь, Що П'є Світло"],
  "F33": ["Залізний Послушник", "Ковалодруїд Рун Металу", "Хранитель Сталевих Гаїв", "Архітектор Залізної Флори", "Верховний Друїд Феруму", "Дерево зі Сталі, Живий Колос"],
  "F34": ["Щитоносець Гірського Клану", "Сокирник Кам'яної Брови", "Клятвеник Гірських Брам", "Тан Чорного Граніту", "Верховний Вождь Щитів", "Щит «Гора-Серце»"],
  "F35": ["Вартовий Моноліту", "Рунник Кам'яних Плит", "Оракул Монолітних Знаків", "Командир Монолітної Варти", "Старший Хранитель Семи Монолітів", "Моноліт, Що Відчиняє Ніч"],
  "F36": ["Слідопит Печерного Ходу", "Шахтар Світляних Жил", "Печерний Мисливець Тіней", "Вождь Підземних Залів", "Король Кам'яної Нори", "Печера, Що Ковтає Ліхтарі"],
  "F37": ["Агент Обсидіанового Синдикату", "Контрактор Чорного Склу", "Нотаріус Гострих Угод", "Куратор Обсидіанових Каналів", "Директор Синдикату Тінь-Руд", "Обсидіанова Печатка Боргу"],
  "F38": ["Сторож Давнього Лісу", "Стрілець Зелених Тіней", "Шептун Старих Дерев", "Вартовий Священного Гаю", "Архісторож Давніх Лісів", "Дерево-Предок «Першолист»"],
  "F39": ["Служитель Тектоніки", "Інженер Розломів", "Геостратег Плит", "Архонт Підземних Зсувів", "Верховний Архонт Тектоніки", "Плита, Що Рухається Сама"],
  "F40": ["Мисливець Першої Скелі", "Каменеход Племен", "Шаман Пилових Пісень", "Вождь Першої Скелі", "Праматір Кам'яних Племен", "Перша Скеля, Живий Обіт"]
};

// Множники рідкості
const RARITY_MULTIPLIERS = {
  "R1": { value: 1.00, name: "common", displayName: "Звичайна" },
  "R2": { value: 1.10, name: "uncommon", displayName: "Незвичайна" },
  "R3": { value: 1.25, name: "rare", displayName: "Рідкісна" },
  "R4": { value: 1.45, name: "epic", displayName: "Епічна" },
  "R5": { value: 1.70, name: "legendary", displayName: "Легендарна" },
  "R6": { value: 2.00, name: "mythic", displayName: "Міфічна" }
};

/**
 * Баланс сил (лінійна прокачка):
 *  - R1 / стартові: +10 за рівень
 *  - R2: +20
 *  - R3: +50
 *  - R4: +100
 *  - R5: +500
 *  - R6: +500
 *
 * База (діапазони по рідкості):
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

// Єдине джерело істини для сили карти з урахуванням рівня
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

// Генерація всіх 240 карт
const ALL_CARDS = [];

for (let factionNum = 1; factionNum <= 40; factionNum++) {
  const factionId = `F${String(factionNum).padStart(2, '0')}`;
  const element = FACTION_ELEMENTS[factionId];
  const factionName = FACTION_NAMES[factionId];
  const cardNames = CARD_NAMES[factionId];

  // детермінована позиція в діапазоні 0..1 (щоб бази були стабільні)
  const t = (factionNum - 1) / 39;

  for (let rarityNum = 1; rarityNum <= 6; rarityNum++) {
    const rarityId = `R${rarityNum}`;
    const cardId = `${factionId}-${rarityId}`;
    const rarityData = RARITY_MULTIPLIERS[rarityId];

    // Нова база по діапазонах (замість множення rarity multiplier)
    const [minP, maxP] = RARITY_BASE_RANGES[rarityId] || RARITY_BASE_RANGES.R1;
    const finalPower = lerp(minP, maxP, t);
    
    // upgradeMult для системи прокачки (залежить від рідкості)
    // Чим рідкісніша карта, тим менший приріст при прокачці (баланс)
    const upgradeMult = {
      1: 1.15, // common - швидке зростання
      2: 1.13, // uncommon
      3: 1.11, // rare
      4: 1.09, // epic
      5: 1.07, // legendary
      6: 1.05  // mythic - повільне зростання, але висока база
    }[rarityNum];
    
    ALL_CARDS.push({
      id: cardId,
      element: element,
      faction: factionId,
      factionName: factionName,
      // Явно присвоюємо rarity для кожної карти (важливо для CSS-рамок)
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

// Стартовий набір карт (16 шт), усі мають силу 12
const STARTER_CARDS = [
  { id: 'S01', name: 'Іскровий Новобранець', element: 'fire',  faction: 'S', factionName: 'Стартовий набір', rarity: 'common', rarityDisplay: 'Звичайна', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S02', name: 'Підпалювач Шестерень', element: 'fire',  faction: 'S', factionName: 'Стартовий набір', rarity: 'common', rarityDisplay: 'Звичайна', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S03', name: 'Сторож Жаркого Котла', element: 'fire',  faction: 'S', factionName: 'Стартовий набір', rarity: 'common', rarityDisplay: 'Звичайна', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S04', name: 'Кочегар Мідного Серця', element: 'fire',  faction: 'S', factionName: 'Стартовий набір', rarity: 'common', rarityDisplay: 'Звичайна', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S05', name: 'Матрос Туманної Варти', element: 'water', faction: 'S', factionName: 'Стартовий набір', rarity: 'common', rarityDisplay: 'Звичайна', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S06', name: 'Регулятор Парових Клапанів', element: 'water', faction: 'S', factionName: 'Стартовий набір', rarity: 'common', rarityDisplay: 'Звичайна', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S07', name: 'Навігатор Глибокого Каналу', element: 'water', faction: 'S', factionName: 'Стартовий набір', rarity: 'common', rarityDisplay: 'Звичайна', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S08', name: 'Охоронець Холодних Резервуарів', element: 'water', faction: 'S', factionName: 'Стартовий набір', rarity: 'common', rarityDisplay: 'Звичайна', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S09', name: 'Кур’єр Вітряних Трас', element: 'air',   faction: 'S', factionName: 'Стартовий набір', rarity: 'common', rarityDisplay: 'Звичайна', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S10', name: 'Механік Аерокрил', element: 'air',  faction: 'S', factionName: 'Стартовий набір', rarity: 'common', rarityDisplay: 'Звичайна', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S11', name: 'Сигнальник Високих Щогл', element: 'air',  faction: 'S', factionName: 'Стартовий набір', rarity: 'common', rarityDisplay: 'Звичайна', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S12', name: 'Спостерігач Небесних Турбін', element: 'air',  faction: 'S', factionName: 'Стартовий набір', rarity: 'common', rarityDisplay: 'Звичайна', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S13', name: 'Робітник Кам’яних Доків', element: 'earth', faction: 'S', factionName: 'Стартовий набір', rarity: 'common', rarityDisplay: 'Звичайна', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S14', name: 'Оператор Гірських Ліфтів', element: 'earth', faction: 'S', factionName: 'Стартовий набір', rarity: 'common', rarityDisplay: 'Звичайна', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S15', name: 'Вартовий Шахтного Периметру', element: 'earth', faction: 'S', factionName: 'Стартовий набір', rarity: 'common', rarityDisplay: 'Звичайна', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 },
  { id: 'S16', name: 'Технік Осадових Машин', element: 'earth', faction: 'S', factionName: 'Стартовий набір', rarity: 'common', rarityDisplay: 'Звичайна', basePower: 12, multiplier: 1.0, upgradeMult: 1.0, attack: 12, defense: 0 }
];

ALL_CARDS.push(...STARTER_CARDS);

/**
 * Швидкий індекс карт за ID
 */
const CARDS_BY_ID = Object.fromEntries(
  ALL_CARDS.map(card => [card.id, card])
);

/**
 * Групування карт по стихіях
 */
const CARDS_BY_ELEMENT = ALL_CARDS.reduce((acc, card) => {
  if (!acc[card.element]) {
    acc[card.element] = [];
  }
  acc[card.element].push(card);
  return acc;
}, {});

/**
 * Групування карт по фракціях
 */
const CARDS_BY_FACTION = ALL_CARDS.reduce((acc, card) => {
  if (!acc[card.faction]) {
    acc[card.faction] = [];
  }
  acc[card.faction].push(card);
  return acc;
}, {});

// Хелпери для доступу до стартових та усіх карт
const getAllCardIds = () => ALL_CARDS.map(card => card.id);
const getStarterCardIds = () => STARTER_CARDS.map(card => card.id);
const getRandomStarterCardIds = (count = 9) => {
  const ids = [...getStarterCardIds()];

  // Fisher-Yates shuffle для чесного випадкового порядку
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  return ids.slice(0, Math.min(count, ids.length));
};

// Локальний пошук без конфлікту з глобальними оголошеннями
function lookupCardById(id) {
  return CARDS_BY_ID[id] || null;
}

/**
 * Групування карт по рідкості
 */
const CARDS_BY_RARITY = ALL_CARDS.reduce((acc, card) => {
  if (!acc[card.rarity]) {
    acc[card.rarity] = [];
  }
  acc[card.rarity].push(card);
  return acc;
}, {});

// Експортуємо глобально для браузера
window.ALL_CARDS = ALL_CARDS;
window.CARDS_BY_ID = CARDS_BY_ID;
window.CARDS_BY_ELEMENT = CARDS_BY_ELEMENT;
window.CARDS_BY_FACTION = CARDS_BY_FACTION;
window.CARDS_BY_RARITY = CARDS_BY_RARITY;
window.FACTION_NAMES = FACTION_NAMES;
window.RARITY_MULTIPLIERS = RARITY_MULTIPLIERS;
window.STARTER_CARDS = STARTER_CARDS;

// Глобальні функції для доступу до карт
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
 * СИСТЕМА РОЗРАХУНКУ СИЛИ КАРТ
 * 
 * Формула прокачки:
 * power(level) = basePower * (upgradeMult) ^ (level - 1)
 * 
 * Приклади:
 * - Level 1: 10 * 1.12^0 = 10
 * - Level 2: 10 * 1.12^1 = 11.2 ≈ 11
 * - Level 3: 10 * 1.12^2 = 12.54 ≈ 13
 * - Level 5: 10 * 1.12^4 = 15.73 ≈ 16
 */

/**
 * Отримати поточну силу карти при певному рівні
 * 
 * @param {Object} card - об'єкт карти з basePower та upgradeMult
 * @param {number} level - рівень прокачки (мін 1)
 * @returns {number} округлена сила карти
 */
function getPower(card, level = 1) {
  if (!card) return 0;

  // Если есть basePower — используем формулу прокачки
  if (typeof card.basePower === 'number' && !isNaN(card.basePower) && card.basePower > 0) {
    const lvl = Math.max(1, Math.floor(level));
    const multiplier = card.upgradeMult || 1.1;
    const power = card.basePower * Math.pow(multiplier, lvl - 1);
    return Math.round(power);
  }

  // Если basePower отсутствует, но уже есть рассчитанное поле `power` — используем его
  if (typeof card.power === 'number' && !isNaN(card.power)) {
    return Math.round(card.power);
  }

  // В остальных случаях логируем одно предупреждение и возвращаем 0
  console.warn('Invalid card or missing basePower and power:', card);
  return 0;
}

/**
 * Отримати масив сил карти при різних рівнях
 * Отримати масив сил карти при різних рівнях
 * Корисно для відображення таблиці прокачки
 * 
 * @param {Object} card - об'єкт карти
 * @param {number} maxLevel - максимальний рівень для показу
 * @returns {Array} масив [level, power]
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
 * Отримати приріст сили при переході між рівнями
 * 
 * @param {Object} card - об'єкт карти
 * @param {number} fromLevel - від якого рівня
 * @param {number} toLevel - до якого рівня
 * @returns {number} приріст сили (числo)
 */
function getPowerGain(card, fromLevel, toLevel) {
  const from = getPower(card, fromLevel);
  const to = getPower(card, toLevel);
  return to - from;
}

/**
 * Отримати відсоток приросту сили
 * 
 * @param {Object} card - об'єкт карти
 * @param {number} fromLevel - від якого рівня
 * @param {number} toLevel - до якого рівня
 * @returns {number} відсоток приросту (0-100)
 */
function getPowerGainPercent(card, fromLevel, toLevel) {
  const from = getPower(card, fromLevel);
  const to = getPower(card, toLevel);
  if (from === 0) return 0;
  return Math.round(((to - from) / from) * 100);
}

/**
 * Отримати стандартну силу карти (level 1)
 * 
 * @param {Object} card - об'єкт карти
 * @returns {number} базова сила
 */
function getBasePower(card) {
  return card?.basePower || 0;
}

/**
 * Порівняти дві карти по силі при певному рівні
 * 
 * @param {Object} card1 - перша карта
 * @param {Object} card2 - друга карта
 * @param {number} level - рівень для порівняння
 * @returns {number} різниця (card1 - card2)
 */
function comparePower(card1, card2, level = 1) {
  const power1 = getPower(card1, level);
  const power2 = getPower(card2, level);
  return power1 - power2;
}

/**
 * Розрахувати силу колоди (сума всіх карт)
 * 
 * @param {Array} cards - масив карт
 * @param {number} level - рівень кожної карти
 * @returns {number} загальна сила колоди
 */
function getDeckPower(cards, level = 1) {
  if (!Array.isArray(cards)) return 0;
  
  return cards.reduce((total, card) => {
    return total + getPower(card, level);
  }, 0);
}

/**
 * Отримати інформацію про прокачку карти в текстовому форматі
 * 
 * @param {Object} card - об'єкт карти
 * @param {number} level - рівень карти
 * @returns {string} рядок інформації
 */
function getCardInfoString(card, level = 1) {
  const power = getPower(card, level);
  const mult = (card.upgradeMult * 100 - 100).toFixed(0);
  return `${card.name}: ${power} (+${mult}% за рівень)`;
}

/**
 * СИСТЕМА ПРОКАЧКИ КАРТ (XP-система)
 * Чиста реалізація без залежностей, легко розширювана.
 */

/**
 * Гарантувати, що прогрес карти існує (хелпер)
 * @param {Object} state - об'єкт гравця
 * @param {string} cardId - ID карти
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
 * Скільки XP потрібно для ап на наступний рівень
 * Плавне зростання: lvl1→2: 20, lvl2→3: 32, lvl3→4: 46, lvl4→5: 62 ...
 * @param {number} level - поточний рівень
 * @returns {number} XP для level → level+1
 */
function xpNeed(level) {
  return Math.round((20 + 12 * (level - 1) + 2 * (level - 1) ** 2) * 1.15);
}

/**
 * Скільки XP дає карта при спаленні
 * lvl1 = 5, lvl5 = 50
 * Формула: (5 * level * (level + 3)) / 4
 * @param {number} level - рівень карти, яку спалюємо
 * @returns {number} кількість XP
 */
function xpValue(level) {
  return Math.round((5 * level * (level + 3)) / 4);
}

/**
 * Додати XP до карти і автоматично ап рівні
 * @param {Object} state - об'єкт гравця
 * @param {string} cardId - ID карти
 * @param {number} amount - скільки XP додати
 */
function addXp(state, cardId, amount) {
  const p = getProgress(state, cardId);
  p.xp += amount;

  // Ап рівнів, поки вистачає XP
  while (p.xp >= xpNeed(p.level)) {
    p.xp -= xpNeed(p.level);
    p.level += 1;
  }
}

/**
 * Рендерити XP-бар (оновити DOM елементи cu-*)
 * @param {Object} state - об'єкт гравця
 * @param {string} cardId - ID карти
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
 * Оновити стан кнопки Прокачити (disabled якщо немає карт для спалення)
 * @param {Object} state - об'єкт гравця
 * @param {string} cardId - ID карти для прокачки
 */
function updateUpgradeButton(state, cardId) {
  const btn = document.getElementById('cu-upgrade-btn');
  if (!btn) return;

  // Знайти дані карти для отримання стихії
  const cardData = window.getCardById ? window.getCardById(cardId) : null;
  if (!cardData) {
    btn.disabled = true;
    return;
  }

  // Знайти всі карти, які можемо спалити (та ж стихія, але не сама карта)
  const allCards = window.ALL_CARDS || window.CARDS_COMMON || [];
  const canBurn = allCards.some(c => {
    // Та ж стихія, але не сама карта
    if (c.element !== cardData.element || c.id === cardId) return false;
    // Перевірити інвентар (є карти для спалення)
    const count = state.inventory && state.inventory[c.id] ? state.inventory[c.id] : 0;
    return count > 0;
  });

  btn.disabled = !canBurn;
}

// Експортуємо глобально для браузера
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
  window.dropSystem.dropCard = window.dropCard;
  window.dropSystem.dropCards = window.dropCards;
  window.dropSystem.dropCardWithOptions = window.dropCardWithOptions;
  window.dropSystem.dropCardsWithOptions = window.dropCardsWithOptions;
  window.dropSystem.getDropChance = getDropChance;
  window.dropSystem.shouldDrop = shouldDrop;
  window.dropSystem.simulateDrops = function(allCards, starterCards, profile = {}, trials = 10000, opts = {}){
    let counters = { noLegendary: 0, noMythic: 0 };
    const counts = { R1:0,R2:0,R3:0,R4:0,R5:0,R6:0 };
    for (let i=0;i<trials;i++){
      const r = dropCardCore(profile, allCards, starterCards, counters, opts);
      counters = r.pityCounters;
      const rr = r.rarity || (r.card && r.card.rarity) || null;
      if (rr) counts[rr] = (counts[rr]||0) + 1;
    }
    return { counts, counters };
  };
}


/* ===== js/data/cards_index.js ===== */
/**
 * ІНДЕКСИ КАРТ - для швидкого пошуку
 * 
 * Використання:
 * - getCardById('C-F-001')
 * - getCardsByElement('fire')
 * - getRandomCards(16)
 */

// Функції доступу до карт (безпечні присвоєння в глобальній області)
if (typeof window.getCardById === 'undefined') {
  window.getCardById = function(id) {
    return (window.CARDS_BY_ID && window.CARDS_BY_ID[id]) || null;
  };
}

if (typeof window.getCardsByElement === 'undefined') {
  window.getCardsByElement = function(element) {
    return (window.CARDS_BY_ELEMENT && window.CARDS_BY_ELEMENT[element]) || [];
  };
}

if (typeof window.getRandomCards === 'undefined') {
  window.getRandomCards = function(count) {
    const allCards = window.ALL_CARDS || [];
    const shuffled = [...allCards].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, allCards.length));
  };
}


/* ===== js/game/currencies.js ===== */
/**
 * Currency System
 * Валютна система гри
 * 
 * Валюти:
 * 🔩 Болти (bolts) - базова валюта
 * ⚙️ Шестерні (gears) - середня валюта
 * ✴︎ Парові ядра (cores) - преміум валюта
 */

window.CurrencySystem = {
  // Типи валют
  TYPES: {
    BOLTS: 'bolts',    // 🔩
    GEARS: 'gears',    // ⚙️
    CORES: 'cores'     // ✴︎
  },

  // Емодзі валют
  EMOJIS: {
    bolts: '🔩',
    gears: '⚙️',
    cores: '✴︎'
  },

  // Назви валют
  NAMES: {
    bolts: 'Болти',
    gears: 'Шестерні',
    cores: 'Парові ядра'
  },

  // Стартові значення
  STARTING_AMOUNTS: {
    bolts: 500,   // 🔩
    gears: 0,   // ⚙️
    cores: 0    // ✴︎
  },

  /**
   * Отримати інформацію про валюту
   */
  getCurrency(type) {
    return {
      type: type,
      emoji: this.EMOJIS[type],
      name: this.NAMES[type],
      starting: this.STARTING_AMOUNTS[type]
    };
  },

  /**
   * Отримати всі валюти
   */
  getAllCurrencies() {
    return Object.values(this.TYPES).map(type => this.getCurrency(type));
  },

  /**
   * Отримати дані для топбара
   */
  getTopbarData(profile) {
    const data = {};
    this.getAllCurrencies().forEach(currency => {
      data[currency.type] = {
        emoji: currency.emoji,
        value: profile[currency.type] || 0
      };
    });
    return data;
  },

  /**
   * Перевірити, чи вистачає валюти
   */
  canAfford(profile, currency, amount) {
    if (!profile[currency]) return false;
    return profile[currency] >= amount;
  },

  /**
   * Списати валюту
   */
  deduct(profile, currency, amount) {
    if (!this.canAfford(profile, currency, amount)) {
      return false;
    }
    profile[currency] -= amount;
    return true;
  },

  /**
   * Додати валюту
   */
  add(profile, currency, amount) {
    profile[currency] = (profile[currency] || 0) + amount;
    return true;
  },

  /**
   * Отримати ціну товару як текст
   */
  getPriceText(product) {
    const currency = window.CurrencySystem.getCurrency(product.price.currency);
    return `${currency.emoji} ${product.price.amount}`;
  },

  /**
   * Отримати назву валюти в родовому відмінку
   */
  getCurrencyNameGenitive(type) {
    const genetiveNames = {
      bolts: 'болтів',
      gears: 'шестерень',
      cores: 'парових ядер'
    };
    return genetiveNames[type] || type;
  }
};

// Експорт для глобального використання
window.Currencies = window.CurrencySystem;


/* ===== card-renderer.js ===== */
/**
 * СИСТЕМА РЕНДЕРУ КАРТ - Стимпанк ДЕТАЛЬНИЙ ДИЗАЙН
 * Велика шестерня, заклепки, анімовані значки, детальні ефекти
 */

class CardRenderer {
  constructor() {
    // Емодзі значки для кожної стихії з класами анімацій
    this.elementIcons = {
      fire: `<div class="element-emoji fire-emoji">🔥</div>`,
      water: `<div class="element-emoji water-emoji">💧</div>`,
      air: `<div class="element-emoji air-emoji">💨</div>`,
      earth: `<div class="element-emoji earth-emoji">🍃</div>`
    };

    this.rarityNames = {
      R1: 'ЗВИЧАЙНА',
      R2: 'НЕЗВИЧАЙНА',
      R3: 'РІДКІСНА',
      R4: 'ЕПІЧНА',
      R5: 'ЛЕГЕНДАРНА',
      R6: 'МІФІЧНА'
    };

    this.elementNames = {
      fire: 'Вогонь',
      water: 'Вода',
      air: 'Повітря',
      earth: 'Земля'
    };
  }

  /**
   * ОСНОВНИЙ МЕТОД РЕНДЕРУ - ДЕТАЛЬНИЙ ДИЗАЙН
   * @param {Object} cardData - дані карти з бази
   * @returns {String} HTML розмітка карти з детальним дизайном
   */
  render(cardData, opts = {}) {
    const {
      id = 'unknown',
      name = 'Unknown Card',
      element = 'fire',
      rarity = 'R1',
      basePower = 0,
      attack = 0,
      factionName = '',
      rarityDisplay = '',
      faction = ''
    } = cardData;

    const rarityBadge = rarityDisplay || this.rarityNames[rarity] || 'ЗВИЧАЙНА';
    const elementIcon = this.elementIcons[element] || this.elementIcons.fire;
    const displayPower = (opts.power !== undefined) ? opts.power : (attack || basePower);
    const level = opts.level || (cardData.level || 1);
    const showUpgrade = !!opts.showUpgrade;

    return `
      <div class="sp-card ${element} ${rarity} ${showUpgrade ? 'upgradable' : ''}" 
           data-id="${id}"
           data-card-id="${id}"
           data-element="${element}"
           data-rarity="${rarity}"
           data-power="${displayPower}"
           data-attack="${attack}"
           data-level="${level}"
           data-faction="${faction}"
           data-name="${name}">
        
        <!-- ДЕКОРАТИВНІ ЛІНІЇ -->
        <div class="decor-line line-top"></div>
        <div class="decor-line line-bottom"></div>
        
        <!-- БЕЙДЖ РІДКОСТІ -->
        <div class="rarity-badge">${rarityBadge}</div>
        
        <!-- ВЕЛИКА ДЕТАЛЬНА ШЕСТЕРНЯ -->
        <div class="corner-gear">
          <div class="gear-inner">
            ${elementIcon}
          </div>
        </div>

        <!-- ПЛАШКА СИЛИ внизу -->
        <div class="power-plate">
          <div class="power-value">${displayPower}</div>
        </div>
        ${showUpgrade ? '<div class="upgrade-arrow" title="Можна прокачати">▲</div>' : ''}
      </div>
    `;
  }

  /**
   * ПАКЕТНИЙ РЕНДЕРИНГ
   * @param {Array} cardsArray - масив карт
   * @returns {String} HTML всіх карт
   */
  renderMultiple(cardsArray) {
    return cardsArray
      .map(card => this.render(card))
      .join('');
  }

  /**
   * РЕНДЕРИНГ З ІНФОРМАЦІЙНОЮ ПАНЕЛЛЮ
   * @param {Object} cardData - дані карти
   * @returns {String} HTML карти + інформація
   */
  renderWithInfo(cardData) {
    const cardHTML = this.render(cardData);
    const infoHTML = this.renderInfo(cardData);
    
    return `
      <div class="card-with-info">
        ${cardHTML}
        ${infoHTML}
      </div>
    `;
  }

  /**
   * ІНФОРМАЦІЙНА ПАНЕЛЬ
   * @param {Object} cardData - дані карти (нова структура)
   * @returns {String} HTML інформації
   */
  renderInfo(cardData) {
    const {
      name = 'Unknown',
      element = 'fire',
      rarity = 'R1',
      basePower = 0,
      attack = 0,
      defense = 0,
      multiplier = 1.0,
      upgradeMult = 1.05,
      factionName = '',
      rarityDisplay = '',
      faction = ''
    } = cardData;

    const elementName = this.elementNames[element] || element;
    const rarityName = rarityDisplay || this.rarityNames[rarity] || rarity;

    return `
      <div class="card-info">
        <h3 class="card-name">${name}</h3>
        
        <div class="card-stats">
          <div class="stat">
            <span class="stat-label">Стихія:</span>
            <span class="stat-value element-${element}">${elementName}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Рідкість:</span>
            <span class="stat-value rarity-${rarity}">${rarityName}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Фракція:</span>
            <span class="stat-value faction">${factionName || faction}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Атака:</span>
            <span class="stat-value attack">⚔️ ${attack}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Захист:</span>
            <span class="stat-value defense">🛡️ ${defense}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Множник покращення:</span>
            <span class="stat-value upgrade">×${upgradeMult}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * ГЕНЕРАТОР CSS ДЛЯ ДИНАМІЧНИХ КОЛЬОРІВ
   * @returns {String} CSS змінні для 4 стихій і 6 рідкостей
   */
  generateColorCSS() {
    return `
      :root {
        /* 4 основні стихії */
        --fire:   #c45a2a;
        --water:  #3b6c8e;
        --air:    #9fb6c1;
        --earth:  #7a6a3a;
        
        /* 6 рівнів рідкості */
        --R1: #b8a27b;    /* Звичайна */
        --R2: #7aaa6f;    /* Незвичайна */
        --R3: #6fb2ff;    /* Рідкісна */
        --R4: #b07cff;    /* Епічна */
        --R5: #ffcc66;    /* Легендарна */
        --R6: #ff6b9d;    /* Міфічна */
      }
    `;
  }

  /**
   * ПІДГОТОВКА КАРТИ ДО ВІДОБРАЖЕННЯ
   * Додає обробники подій та інші функції
   */
  attachEventHandlers(cardElement, onSelect = null, onHover = null) {
    // При кліку на карту
    cardElement.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Видаляємо клас з інших карт
      document.querySelectorAll('.sp-card').forEach(c => {
        c.classList.remove('selected');
      });
      
      // Додаємо клас поточній карті
      cardElement.classList.add('selected');
      
      // Callback
      if (onSelect) {
        const cardData = {
          id: cardElement.dataset.id,
          name: cardElement.dataset.name,
          element: cardElement.dataset.element,
          rarity: cardElement.dataset.rarity,
          power: cardElement.dataset.power
        };
        onSelect(cardData);
      }
    });

    // При ховері
    if (onHover) {
      cardElement.addEventListener('mouseenter', () => {
        onHover(cardElement.dataset.id, true);
      });
      cardElement.addEventListener('mouseleave', () => {
        onHover(cardElement.dataset.id, false);
      });
    }
  }

  /**
   * ФІЛЬТРАЦІЯ КАРТ
   * @param {Array} cardsArray - всі карти
   * @param {String} filter - фільтр (element або 'legend')
   * @returns {Array} відфільтровані карти
   */
  filterCards(cardsArray, filter) {
    if (filter === 'all') return cardsArray;
    
    if (filter === 'legend') {
      return cardsArray.filter(card => card.rarity === 'legend');
    }
    
    // Фільтр по стихії
    return cardsArray.filter(card => card.element === filter);
  }

  /**
   * СОРТУВАННЯ КАРТ
   * @param {Array} cardsArray - карти
   * @param {String} sortBy - поле для сортування
   * @param {String} order - 'asc' або 'desc'
   * @returns {Array} відсортовані карти
   */
  sortCards(cardsArray, sortBy = 'power', order = 'desc') {
    const sorted = [...cardsArray].sort((a, b) => {
      const valueA = a[sortBy];
      const valueB = b[sortBy];
      
      if (order === 'asc') {
        return valueA - valueB;
      } else {
        return valueB - valueA;
      }
    });
    
    return sorted;
  }

  /**
   * ПОШУК КАРТ
   * @param {Array} cardsArray - карти
   * @param {String} query - пошуковий запит
   * @returns {Array} результати пошуку
   */
  searchCards(cardsArray, query) {
    const lowerQuery = query.toLowerCase();
    
    return cardsArray.filter(card => {
      return card.name.toLowerCase().includes(lowerQuery) ||
             card.description.toLowerCase().includes(lowerQuery) ||
             card.element.toLowerCase().includes(lowerQuery);
    });
  }

  /**
   * ГРУПУВАННЯ КАРТ ПО СТИХІЯМ
   * @param {Array} cardsArray - карти
   * @returns {Object} карти згруповані по стихіям
   */
  groupByElement(cardsArray) {
    return cardsArray.reduce((groups, card) => {
      const element = card.element;
      if (!groups[element]) {
        groups[element] = [];
      }
      groups[element].push(card);
      return groups;
    }, {});
  }

  /**
   * ГРУПУВАННЯ КАРТ ПО РІДКОСТІ
   * @param {Array} cardsArray - карти
   * @returns {Object} карти згруповані по рідкості
   */
  groupByRarity(cardsArray) {
    return cardsArray.reduce((groups, card) => {
      const rarity = card.rarity;
      if (!groups[rarity]) {
        groups[rarity] = [];
      }
      groups[rarity].push(card);
      return groups;
    }, {});
  }
}

// ЕКСПОРТ ДЛЯ ВИКОРИСТАННЯ
// якщо це модуль
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CardRenderer;
}

// ПРИКЛАД ВИКОРИСТАННЯ:
/*
// 1. Ініціалізація
const cardRenderer = new CardRenderer();

// 2. Завантажити базу карт
fetch('assets/cards-database.json')
  .then(response => response.json())
  .then(data => {
    const cards = data.cards;
    
    // 3. Отримати контейнер
    const container = document.getElementById('cardsContainer');
    
    // 4. Рендеринг всіх карт
    container.innerHTML = cardRenderer.renderMultiple(cards);
    
    // 5. Прикріпити обробники подій
    document.querySelectorAll('.sp-card').forEach(cardEl => {
      cardRenderer.attachEventHandlers(
        cardEl,
        (cardData) => {
          console.log('Вибрана карта:', cardData);
        },
        (cardId, isHovering) => {
          if (isHovering) {
            console.log('Ховер на карту:', cardId);
          }
        }
      );
    });
    
    // 6. Фільтрація
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        const filtered = cardRenderer.filterCards(cards, filter);
        container.innerHTML = cardRenderer.renderMultiple(filtered);
      });
    });
  });

// ДОДАТКОВО - Пошук карт
const searchInput = document.querySelector('.search-input');
searchInput?.addEventListener('input', (e) => {
  const query = e.target.value;
  const filtered = cardRenderer.searchCards(cards, query);
  container.innerHTML = cardRenderer.renderMultiple(filtered);
});

// ДОДАТКОВО - Сортування
const sortSelect = document.querySelector('.sort-select');
sortSelect?.addEventListener('change', (e) => {
  const sortBy = e.target.value;
  const sorted = cardRenderer.sortCards(cards, sortBy, 'desc');
  container.innerHTML = cardRenderer.renderMultiple(sorted);
});
*/


/* ===== js/game/elements.js ===== */
// Steampunk Elements multipliers and damage helper (global)
(function(){
  window.ELEMENTS = ["fire","water","air","earth"];
  window.MULT = {
    fire:  { fire:1.0, water:0.5, air:1.5, earth:1.0 },
    water: { fire:1.5, water:1.0, air:1.0, earth:0.5 },
    air:   { fire:0.5, water:1.0, air:1.0, earth:1.5 },
    earth: { fire:1.0, water:1.5, air:0.5, earth:1.0 }
  };
  window.damage = function(attackerCard, defenderCard){
    const m = (window.MULT[attackerCard.element]||{})[defenderCard.element];
    const mult = typeof m === 'number' ? m : 1.0;
    const p = attackerCard.power || 0;
    const dmg = Math.round(p * mult);
    return { dmg, mult };
  };
})();


/* ===== js/game/duel_runtime.js ===== */
// Runtime duel engine for index.html usage (global functions)
(function(){
  function shuffle(arr){
    const a = arr.slice();
    for (let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }
  
  // Get IDs already on field (excluding specific slot)
  function getFieldIds(hand, excludeIdx){
    const ids = [];
    for (let i=0; i<hand.length; i++){
      if (i !== excludeIdx && hand[i]) ids.push(hand[i].id);
    }
    return ids;
  }
  
  // Draw next unique card (circular deck)
  function drawNextUnique(side, slotIdx){
    const fieldIds = getFieldIds(side.hand, slotIdx);
    const maxAttempts = side.deck.length;
    
    for (let attempt=0; attempt<maxAttempts; attempt++){
      const candidate = side.deck[side.cursor];
      side.cursor = (side.cursor + 1) % side.deck.length;
      
      if (!fieldIds.includes(candidate.id)){
        return candidate;
      }
    }
    // If no unique found (наприклад, багато дублікатів) — все одно беремо наступну карту за курсором
    const fallback = side.deck[side.cursor];
    side.cursor = (side.cursor + 1) % side.deck.length;
    return fallback;
  }
  
  // Fill initial hand with unique cards
  function fillInitialHand(side, handSize){
    side.hand = [];
    for (let i=0; i<handSize; i++){
      side.hand[i] = drawNextUnique(side, i);
    }
  }
  
  window.createDuel = function(playerDeck9, enemyDeck9){
    // Normalize decks: ensure each card object has numeric `power` based on its id/level
    const normalizeDeck = (deck) => (Array.isArray(deck) ? deck.map(d => {
      const entry = (d && typeof d === 'object') ? d : { id: d };
      const id = entry.id || entry.cardId || entry;
      const level = entry.level || 1;
      const src = (typeof getCardById === 'function') ? getCardById(id) : null;
      const calc = (src ? (window.getPower ? window.getPower(src, level) : getPower(src, level)) : (entry.power || 0));
      const power = Math.max(12, Math.round(calc || (entry.power || 0)));
      return { id, element: (src && src.element) || entry.element || 'fire', rarity: (src && src.rarity) || entry.rarity || 'common', level, power };
    }) : []);

    const normPlayerDeck = normalizeDeck(playerDeck9);
    const normEnemyDeck = normalizeDeck(enemyDeck9);

    const pHP = normPlayerDeck.reduce((s,c)=>s+(c.power||0),0);
    const eHP = normEnemyDeck.reduce((s,c)=>s+(c.power||0),0);

    const player = {
      hp: pHP,
      maxHp: pHP,
      deck: shuffle(normPlayerDeck),
      cursor: 0,
      hand: []
    };

    const enemy = {
      hp: eHP,
      maxHp: eHP,
      deck: shuffle(normEnemyDeck),
      cursor: 0,
      hand: []
    };
    
    fillInitialHand(player, 3);
    fillInitialHand(enemy, 3);
    
    return {
      turn: 1,
      player,
      enemy,
      log: [],
      lastTurn: null,
      finished: false,
      result: null
    };
  };
  window.playTurn = function(duel, playerIdx){
    if (!duel || duel.finished) return duel;
    
    // Mirror model: player card at slot i fights enemy card at slot i
    const pCard = duel.player.hand[playerIdx];
    const eCard = duel.enemy.hand[playerIdx];
    if (!pCard || !eCard) return duel;
    
    // Calculate damage both ways
    const pHit = window.damage(pCard, eCard);
    const eHit = window.damage(eCard, pCard);
    
    duel.enemy.hp = Math.max(0, duel.enemy.hp - pHit.dmg);
    duel.player.hp = Math.max(0, duel.player.hp - eHit.dmg);
    
    // Log this turn
    duel.lastTurn = {
      slotIdx: playerIdx,
      player: { cardId: pCard.id, element: pCard.element, power: pCard.power, dmg: pHit.dmg, mult: pHit.mult },
      enemy: { cardId: eCard.id, element: eCard.element, power: eCard.power, dmg: eHit.dmg, mult: eHit.mult }
    };
    duel.log.push({ turn: duel.turn, ...duel.lastTurn });
    duel.turn += 1;
    
    // Refill ONLY the played slot with unique cards
    duel.player.hand[playerIdx] = drawNextUnique(duel.player, playerIdx);
    duel.enemy.hand[playerIdx] = drawNextUnique(duel.enemy, playerIdx);
    
    // Check end condition
    if (duel.player.hp <= 0 || duel.enemy.hp <= 0){
      duel.finished = true;
      if (duel.player.hp > duel.enemy.hp) duel.result = 'win';
      else if (duel.player.hp < duel.enemy.hp) duel.result = 'lose';
      else duel.result = 'draw';
      try { console.debug('playTurn: duel finished', { result: duel.result, playerHp: duel.player.hp, enemyHp: duel.enemy.hp }); } catch(e){/* ignore */}

      // Tasks: count one duel finished (once per duel)
      try {
        if (typeof updateTasks === 'function') updateTasks('duel', 1);
        // If player won, count a win task as well
        if (duel.result === 'win' && typeof updateTasks === 'function') updateTasks('win', 1);
      } catch (e) { /* ignore task update failures */ }
    }
    
    // Keep last 10 log entries
    if (duel.log.length > 10) duel.log.splice(0, duel.log.length - 10);
    
    return duel;
  };
})();


/* ===== js/ui/components/CardView.global.js ===== */
// CardView.global — гарантирует наличие глобального `cardRenderer`
try {
  if (typeof CardRenderer !== 'undefined') {
    window.cardRenderer = window.cardRenderer || new CardRenderer();
  }
} catch (err) {
  console.warn('CardView.global init failed', err);
}


/* ===== inline script from original index.html ===== */

    // Initialize CardRenderer
    window.addEventListener('DOMContentLoaded', () => {
      window.cardRenderer = new CardRenderer();
      console.log('CardRenderer initialized');
    });
    
    // Делегований паралакс ефект для всіх карт
    function initCardParallax() {
      document.addEventListener('mousemove', (e) => {
        const card = e.target.closest('.sp-card');
        if (!card) return;
        
        // Не застосовуємо трансформацію на карту, якщо вона не в :hover
        // це запобігає конфліктам з позиціюванням дітей
        if (!card.matches(':hover')) {
          return;
        }

        const rect = card.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const x = (e.clientX - centerX) / 50;
        const y = (e.clientY - centerY) / 50;

        // Застосовуємо тільки базові трансформації, які не конфліктують з дітьми
        card.style.transform = `perspective(1000px) rotateX(${5 - y}deg) rotateY(${-2 + x}deg)`;
      });

      // Скидання трансформації при виході
      document.addEventListener('mouseleave', (e) => {
        const card = e.target.closest?.('.sp-card');
        if (card) {
          card.style.transform = '';
        }
      }, true);
    }
    
    // Ініціалізуємо паралакс після DOMContentLoaded
    window.addEventListener('DOMContentLoaded', () => {
      initCardParallax();
    });

    // LocalStorage management
    const storage = {
      get(key, defaultValue = null) {
        try {
          const item = localStorage.getItem(key);
          return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
          console.error(`Error reading localStorage (${key}):`, error);
          return defaultValue;
        }
      },
      set(key, value) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (error) {
          console.error(`Error writing localStorage (${key}):`, error);
          return false;
        }
      }
    };

    /* =========================================================
       PATCH: HUD XP updater (bar only)
       - Заповнення: profile.xp / xpNeededForLevel(profile.level)
       - Без будь-яких надписів/лейблів
       ========================================================= */
    function updateHudXp(profile) {
      try {
        const fill = document.getElementById('top-xp-bar');
        if (!fill || !profile) return;

        const lvl = Math.max(1, Number(profile.level || 1));
        const xp = Math.max(0, Number(profile.xp || 0));

        let need = window.getXpForLevel ? window.getXpForLevel(lvl) : 200;
        need = Math.max(1, need);

        const pct = Math.max(0, Math.min(100, Math.round((xp / need) * 100)));
        fill.style.width = pct + '%';

        // для доступності: без видимого тексту, але з aria
        fill.setAttribute('aria-label', `XP ${pct}%`);
      } catch (e) {
        console.warn('updateHudXp failed', e);
      }
    }

    // зробити доступним глобально (бо updateUI() викликає updateHudXp(profile))
    try { window.updateHudXp = updateHudXp; } catch (e) { /* ignore */ }

    // Legacy HUD XP helper removed — use `updateHudXp(profile)` from main.js

    // expose to global for console/debugging (new API)
    try { if (typeof updateHudXp === 'function') window.updateHudXp = updateHudXp; } catch (e) { /* ignore */ }

    // User profile management
    const userProfile = {
      STORAGE_KEY: 'elem_user_profile',
      USERS_KEY: 'elem_users',
      
      // Get all registered users
      getAllUsers() {
        return storage.get(this.USERS_KEY, {});
      },
      
      // Save all users
      saveAllUsers(users) {
        return storage.set(this.USERS_KEY, users);
      },
      
      // Check if username exists
      userExists(username) {
        const users = this.getAllUsers();
        return users.hasOwnProperty(username);
      },
      
      // Register new user
      registerUser(username) {
        if (this.userExists(username)) {
          return { success: false, error: 'Це ім\'я вже зайняте' };
        }
        
        if (username.length < 3) {
          return { success: false, error: 'Ім\'я має бути не менше 3 символів' };
        }
        
        // Generate random 16 starter cards (4 per element)
        const starterIds = (window.getRandomStarterCardIds && window.getRandomStarterCardIds(16))
          || (window.getStarterCardIds && window.getStarterCardIds())
          || [];

        // Fallback to any cards if starters unavailable
        const pool = starterIds.length ? starterIds : (window.ALL_CARDS || []).map(c => c.id);

        // Shuffle ids
        const shuffled = [...pool];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const selectedIds = shuffled.slice(0, 16);
        const selectedCards = selectedIds
          .map(id => (window.getCardById ? window.getCardById(id) : null))
          .filter(Boolean);
        
        // First 9 go to deck, rest go to collection
        const deckCards = selectedCards.slice(0, 9).map(card => ({
          id: card.id,
          level: 1
        }));
        const collectionCards = selectedCards.slice(9, 16).map(card => ({
          id: card.id,
          level: 1
        }));
        
        // Initialize progress (XP) for each card
        const progress = {};
        selectedCards.forEach(card => {
          progress[card.id] = { level: 1, xp: 0 };
        });
        
        // Initialize inventory: count of each card
        const inventory = {};
        selectedCards.forEach(card => {
          inventory[card.id] = (inventory[card.id] || 0) + 1;
        });
        
        const users = this.getAllUsers();
        users[username] = {
          name: username,
          level: 1,
          xp: 0,
          bolts: 500,         // Болти 🔩 (базова валюта)
          gears: 0,           // Шестерні ⚙️ (середня валюта)
          cores: 0,           // Парові ядра ✴︎ (преміум валюта)
          wins: 0,
          losses: 0,
          gamesPlayed: 0,
          createdAt: Date.now(),
          deckCards: deckCards,
          collectionCards: collectionCards,
          progress: progress,    // XP для кожної карти
          inventory: inventory   // кількість копій
        };
        
        this.saveAllUsers(users);
        return { success: true, profile: users[username] };
      },
      
      // Login user
      loginUser(username) {
        // Special-case: if someone attempts to login as the admin test user,
        // create the admin profile automatically with full currencies.
        if (!this.userExists(username)) {
          if (username === 'delta5977525') {
            const users = this.getAllUsers();
            const now = Date.now();
            // Build starter pool similar to registerUser()
            const starterIds = (window.getRandomStarterCardIds && window.getRandomStarterCardIds(16))
              || (window.getStarterCardIds && window.getStarterCardIds())
              || [];
            const pool = starterIds.length ? starterIds : (window.ALL_CARDS || []).map(c => c.id);
            const shuffled = [...pool];
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            const selectedIds = shuffled.slice(0, 16);
            const selectedCards = selectedIds
              .map(id => (window.getCardById ? window.getCardById(id) : null))
              .filter(Boolean);

            const deckCards = selectedCards.slice(0, 9).map(card => ({ id: card.id, level: 1 }));
            const collectionCards = selectedCards.slice(9, 16).map(card => ({ id: card.id, level: 1 }));

            const progress = {};
            selectedCards.forEach(card => {
              progress[card.id] = { level: 1, xp: 0 };
            });

            const inventory = {};
            selectedCards.forEach(card => {
              inventory[card.id] = (inventory[card.id] || 0) + 1;
            });

            const profile = {
              name: username,
              level: 1,
              xp: 0,
              bolts: 9999,
              gears: 9999,
              cores: 9999,
              wins: 0,
              losses: 0,
              gamesPlayed: 0,
              createdAt: now,
              deckCards: deckCards,
              collectionCards: collectionCards,
              progress: progress,
              inventory: inventory,
              tasks: {},
              completedTasks: [],
              tasksResetAt: now
            };
            users[username] = profile;
            this.saveAllUsers(users);
            storage.set(this.STORAGE_KEY, profile);
            return { success: true, profile };
          }
          return { success: false, error: 'Користувача не знайдено' };
        }

        const users = this.getAllUsers();
        const profile = users[username];
        storage.set(this.STORAGE_KEY, profile);
        return { success: true, profile: profile };
      },
      
      // Get current logged in profile
      getCurrentUser() {
        return storage.get(this.STORAGE_KEY);
      },
      
      // Check if user is logged in
      isLoggedIn() {
        return this.getCurrentUser() !== null;
      },
      
      // Logout
      logout() {
        storage.set('currentUser', null);
        localStorage.removeItem(this.STORAGE_KEY);
      },
      
      // Update current user profile
      updateCurrentUser(updates) {
        const profile = this.getCurrentUser();
        if (!profile) return false;
        
        Object.assign(profile, updates);
        storage.set(this.STORAGE_KEY, profile);
        
        // Also update in users list
        const users = this.getAllUsers();
        if (users[profile.name]) {
          users[profile.name] = profile;
          this.saveAllUsers(users);
        }
        
        return profile;
      },
      
      getProfile() {
        return this.getCurrentUser();
      },
      
      saveProfile(profile) {
        return this.updateCurrentUser(profile);
      },

      autoAddToDeck(profile, cardEntry) {
        if (!profile || !cardEntry) {
          return { added: false, replaced: false, replacedPower: null };
        }

        if (!profile.deckCards) profile.deckCards = [];

        // Ensure we work with a proper card instance (with uid and cardId).
        // Use global `createCardInstance` when available; otherwise fall back
        // to a minimal inline creator so code can run before `js/main.js` loads.
        function _makeInstance(input) {
          // input may be an id or an object
          const entry = (input && typeof input === 'object') ? input : { id: input };
          if (typeof window !== 'undefined' && typeof window.createCardInstance === 'function') {
            try {
              return window.createCardInstance(entry.id || entry.cardId || entry, {
                level: entry.level || 1,
                xp: entry.xp || 0,
                power: entry.power || 0
              });
            } catch (e) {
              // fallback to minimal instance below
            }
          }
          const _gen = (typeof window !== 'undefined' && typeof window.genUID === 'function') ? window.genUID : function(p){ return (p||'c') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,10); };
          return {
            uid: entry.uid || _gen('card'),
            cardId: entry.cardId || entry.id,
            level: entry.level || 1,
            xp: entry.xp || 0,
            power: entry.power || 0
          };
        }

        const inst = _makeInstance(cardEntry || (cardEntry && (cardEntry.id || cardEntry.cardId)));

        // Prevent duplicate cardId in deck
        if (profile.deckCards.some(dc => (dc.cardId || dc.id) === inst.cardId)) {
          return { added: false, replaced: false, replacedPower: null };
        }

        const cardObj = window.getCardById && window.getCardById(inst.cardId);
        const cardPower = window.getPower
          ? window.getPower(cardObj, inst.level || 1)
          : (cardObj ? (cardObj.basePower || inst.power || 0) : (inst.power || 0));

        if (profile.deckCards.length < 9) {
          profile.deckCards.push(inst);
          return { added: true, replaced: false, replacedPower: null };
        }

        let weakestIdx = -1;
        let weakestPower = Infinity;

        profile.deckCards.forEach((dc, idx) => {
          const dcObj = window.getCardById && window.getCardById(dc.cardId || dc.id);
          const pwr = window.getPower
            ? window.getPower(dcObj, dc.level || 1)
            : (dcObj ? (dcObj.basePower || dc.power || 0) : (dc.power || 0));

          if (pwr < weakestPower) {
            weakestPower = pwr;
            weakestIdx = idx;
          }
        });

        if (weakestIdx >= 0 && cardPower > weakestPower) {
          profile.deckCards[weakestIdx] = inst;
          return { added: false, replaced: true, replacedPower: weakestPower };
        }

        return { added: false, replaced: false, replacedPower: null };
      },
      
      // Compact number formatter: 1500 -> 1.5k; always uses 'k' for >=1000
      formatCompact(number) {
        const n = Number(number) || 0;
        const neg = n < 0;
        const abs = Math.abs(n);
        if (abs < 1000) return String(n);
        let v = abs / 1000;
        // show one decimal for values < 10k, integer otherwise
        let out;
        if (v < 10) {
          out = Math.round(v * 10) / 10; // one decimal
        } else {
          out = Math.round(v); // integer
        }
        // strip trailing .0
        out = String(out).replace(/\.0$/, '');
        return (neg ? '-' : '') + out + 'k';
      },

      updateUI() {
        const profile = this.getCurrentUser();
        if (!profile) return;
        
        // Update level
        const levelSpan = document.querySelector('.level span');
        if (levelSpan) {
          levelSpan.textContent = profile.level;
        }
        
        // Update currencies on HOME PAGE
        const homeBolts = document.getElementById('home-bolts');
        const homeGears = document.getElementById('home-gears');
        const homeCores = document.getElementById('home-cores');
        
        if (homeBolts) homeBolts.textContent = this.formatCompact(profile.bolts || 0);
        if (homeGears) homeGears.textContent = this.formatCompact(profile.gears || 0);
        if (homeCores) homeCores.textContent = this.formatCompact(profile.cores || 0);
        
        // Update currencies on DECK PAGE
        const boltVal = document.getElementById('deck-bolts');
        const gearVal = document.getElementById('deck-gears');
        const coreVal = document.getElementById('deck-cores');
        
        if (boltVal) boltVal.textContent = this.formatCompact(profile.bolts || 0);
        if (gearVal) gearVal.textContent = this.formatCompact(profile.gears || 0);
        if (coreVal) coreVal.textContent = this.formatCompact(profile.cores || 0);
        
        // Update HUD XP (use centralized updateHudXp)
        try {
          if (typeof updateHudXp === 'function') updateHudXp(profile);
        } catch (e) {
          console.warn('updateHudXp failed', e);
        }
        
        // Update deck power on home screen (use duel-ready deck calculation so UI matches duel)
        try {
          let totalPower = 0;
          if (typeof navigation !== 'undefined' && typeof navigation.buildDuelDeckFromProfile === 'function' && typeof navigation.calcDeckPower === 'function') {
            const battleDeck = navigation.buildDuelDeckFromProfile(profile);
            totalPower = navigation.calcDeckPower(battleDeck);
          } else if (profile.deckCards && profile.deckCards.length > 0) {
            profile.deckCards.forEach(dc => {
              const card = window.getCardById && window.getCardById(dc.cardId || dc.id);
              if (card) {
                const prog = window.getProgress ? window.getProgress(profile, dc.cardId || dc.id) : { level: dc.level || 1, xp: 0 };
                const level = (prog && prog.level) ? prog.level : (dc.level || 1);
                const power = window.getPower ? window.getPower(card, level) : (typeof getPower === 'function' ? getPower(card, level) : 0);
                totalPower += power || 0;
              }
            });
          }
          const deckPowerHome = document.getElementById('deck-power-home');
          if (deckPowerHome) deckPowerHome.textContent = this.formatCompact ? this.formatCompact(totalPower) : String(totalPower);
        } catch (e) {
          console.warn('Failed to compute deck power for home', e);
        }
        
        // Update username in portrait
        const portrait = document.querySelector('.portrait');
        if (portrait) {
          portrait.title = profile.name;
        }
      }
    };

    // Auth UI management
    const authUI = {
      overlay: null,
      
      init() {
        this.overlay = document.getElementById('authOverlay');
        
        // Tab switching
        document.querySelectorAll('.auth-tab').forEach(tab => {
          tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            this.switchTab(tabName);
          });
        });
        
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleLogin();
        });
        
        // Register form
        document.getElementById('registerForm').addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleRegister();
        });
        
        // Check if already logged in
        if (userProfile.isLoggedIn()) {
          this.hideAuth();
        } else {
          this.showAuth();
        }
      },
      
      switchTab(tabName) {
        // Update tabs
        document.querySelectorAll('.auth-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.tab === tabName);
        });
        
        // Update forms
        document.querySelectorAll('.auth-form').forEach(f => {
          f.classList.toggle('active', f.id === tabName + 'Form');
        });
        
        // Clear errors
        this.hideError('login');
        this.hideError('register');
      },
      
      handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        
        if (!username) {
          this.showError('login', 'Введіть ім\'я користувача');
          return;
        }
        
        const result = userProfile.loginUser(username);
        
        if (result.success) {
          console.log('Login successful:', result.profile);
          this.hideAuth();
          userProfile.updateUI();
          if (typeof taskEvent === 'function') taskEvent('login', 1);
        } else {
          this.showError('login', result.error);
        }
      },
      
      handleRegister() {
        const username = document.getElementById('registerUsername').value.trim();
        
        if (!username) {
          this.showError('register', 'Введіть ім\'я користувача');
          return;
        }
        
        const result = userProfile.registerUser(username);
        
        if (result.success) {
          console.log('Registration successful:', result.profile);
          // Auto-login after registration
          userProfile.loginUser(username);
          this.hideAuth();
          userProfile.updateUI();
          if (typeof taskEvent === 'function') taskEvent('login', 1);
        } else {
          this.showError('register', result.error);
        }
      },
      
      showError(formType, message) {
        const errorEl = document.getElementById(formType + 'Error');
        if (errorEl) {
          errorEl.textContent = message;
          errorEl.classList.add('show');
        }
      },
      
      hideError(formType) {
        const errorEl = document.getElementById(formType + 'Error');
        if (errorEl) {
          errorEl.classList.remove('show');
        }
      },
      
      showAuth() {
        if (this.overlay) {
          this.overlay.style.display = 'flex';
          setTimeout(() => {
            this.overlay.classList.remove('hidden');
          }, 10);
        }
      },
      
      hideAuth() {
        if (this.overlay) {
          this.overlay.classList.add('hidden');
        }
      }
    };

    // Page navigation system
    const navigation = {
        // ========== BAG SYSTEM ========== 
        loadBagCards() {
          const profile = userProfile.getProfile();
          if (!profile) return;
          // В сумці — лише ті карти з collectionCards, яких немає в deckCards
          let deckIds = new Set((profile.deckCards || []).map(c => c.id));
          const bagCards = (profile.collectionCards || []).filter(c => !deckIds.has(c.id));
          const container = document.getElementById('bag-cards-list');
          if (!container) return;
          if (bagCards.length === 0) {
            container.innerHTML = '<div class="no-bag-cards">Немає карт у сумці</div>';
            return;
          }
          const elementEmojis = {
            fire: '🔥',
            water: '💧',
            air: '♨️',
            earth: '🍃'
          };
          container.innerHTML = bagCards.map(card => {
            const cardData = getCardById(card.id);
            if (!cardData) return '';
            const emoji = elementEmojis[cardData.element] || '⚙';
            return `
              <div class="bag-card-item" data-card-id="${card.id}">
                <span class="bag-card-emoji">${emoji}</span>
                <span class="bag-card-name">${cardData.name}</span>
                <span class="bag-card-status">Знайдено</span>
              </div>
            `;
          }).join('');
        },
        // ========== END BAG SYSTEM ========== 
          // Отримати карти з сумки (які не в колоді)
          getBagCards(profile) {
            if (!profile) return [];
            let deckIds = new Set((profile.deckCards || []).map(c => c.id));
            // Повертаємо тільки ті карти з collectionCards, яких немає в deckCards
            return (profile.collectionCards || []).filter(c => !deckIds.has(c.id));
          },
      currentPage: 'home',
      
      showPage(pageId) {
        // Remove active class from all pages
        document.querySelectorAll('.page').forEach(page => {
          page.classList.remove('active');
        });
        
        // Add active class to target page
        const targetPage = document.getElementById(`page-${pageId}`);
        if (targetPage) {
          targetPage.classList.add('active');
          this.currentPage = pageId;
          
          // Update profile stats if on profile page
          if (pageId === 'profile') {
            this.updateProfilePage();
          }
          
          // Load deck cards if on deck page
          if (pageId === 'deck') {
            this.loadDeckCards();
          }
          
          // Load collection cards if on collections page
          if (pageId === 'collections') {
            this.loadCollectionCards();
          }
          
          // Load shop if on shop page
          if (pageId === 'shop') {
            this.loadShop();
          }

          // Initialize duels UI
          if (pageId === 'duels') {
            this.initDuelsPage();
          }

          // Load tasks
          if (pageId === 'tasks') {
            const profile = userProfile.getProfile();
            if (profile) maybeResetTasks(profile);
            renderTasks();
          }
        }
      },
      
      updateProfilePage() {
        const profile = userProfile.getProfile();
        document.getElementById('profile-level').textContent = profile.level;
        document.getElementById('profile-wins').textContent = profile.wins;
        document.getElementById('profile-losses').textContent = profile.losses;
        document.getElementById('profile-games').textContent = profile.gamesPlayed;
        this.updateXP(profile);
      },

      updateXP(profile) {
        const currentXp = profile.xp;
        const level = profile.level;
        const xpMax = getXpForLevel(level);

        const percent = Math.min(100, (currentXp / xpMax) * 100);

        // Текст
        const xpText = document.getElementById("xp-text");
        if (xpText) {
          xpText.textContent = `${currentXp} / ${xpMax}`;
        }

        // Шкала в профілі
        const xpFill = document.getElementById("xp-bar-fill");
        if (xpFill) {
          xpFill.style.width = percent + "%";
        }

        // Верхня шкала (ВАЖЛИВО)
        const topXpBar = document.getElementById("top-xp-bar");
        if (topXpBar) {
          topXpBar.style.width = percent + "%";
        }
      },

      

      // ========== UPGRADE SYSTEM ==========
      
      // Build inventory from deck + collection
      getInventory(profile) {
        const inventory = {};
        
        // Count cards from both deck and collection
        [...profile.deckCards, ...profile.collectionCards].forEach(userCard => {
          inventory[userCard.id] = (inventory[userCard.id] || 0) + 1;
        });
        
        return inventory;
      },

      // Get count of extra copies available for upgrade
      getExtraCopies(inventory, cardId) {
        const total = inventory[cardId] || 0;
        return Math.max(0, total - 1); // -1 because one copy is in deck
      },

      // Get cost to upgrade from current level to next
      getUpgradeCost(level) {
        return level; // lvl 1->2 costs 1, lvl 2->3 costs 2, etc
      },

      // Check if a deck card can be upgraded
      canUpgradeCard(deckItem, inventory) {
        const cost = this.getUpgradeCost(deckItem.level);
        const extra = this.getExtraCopies(inventory, deckItem.id);
        return extra >= cost;
      },

      // Check if deck has any upgradable cards
      hasAnyUpgradable(deck, inventory) {
        return deck.some(item => this.canUpgradeCard(item, inventory));
      },

      // Check if a target card can be guaranteed to level up by burning owned weaker cards
      canGuaranteedLevelByBurning(profile, targetCardId) {
        if (!profile || !targetCardId) return false;
        // get current progress
          const prog = window.getProgress ? window.getProgress(profile, targetCardId) : (profile.progress && profile.progress[targetCardId]) || { level: 1, xp: 0 };
        const need = window.xpNeed ? window.xpNeed(prog.level) : this.xpNeededForLevel(prog.level);
        const remaining = Math.max(0, need - (prog.xp || 0));
        if (remaining <= 0) return true;

        const targetCard = window.getCardById ? window.getCardById(targetCardId) : null;
        if (!targetCard) return false;

          const deckIds = new Set((profile.deckCards || []).map(d => d.id));
          // If target card is in deck, never show guarantee indicator
          if (deckIds.has(targetCardId)) return false;

        // Sum available XP from collection entries (excluding deck copies)
        let totalXp = 0;
        if (Array.isArray(profile.collectionCards)) {
          for (let i = 0; i < profile.collectionCards.length; i++) {
            const entry = profile.collectionCards[i];
            if (!entry || !entry.id) continue;
            if (entry.id === targetCardId) continue;
            if (deckIds.has(entry.id)) continue;
            const c = window.getCardById ? window.getCardById(entry.id) : null;
            if (!c || c.element !== targetCard.element) continue;
            const lvl = entry.level || 1;
            const gain = window.xpValue ? window.xpValue(lvl) : (c.basePower || 10);
            totalXp += gain;
            if (totalXp >= remaining) return true;
          }
        }

        // Sum available XP from inventory counters (assume level 1 for inventory entries)
        const inv = profile.inventory || {};
        for (const id in inv) {
          if (!Object.prototype.hasOwnProperty.call(inv, id)) continue;
          const count = inv[id] || 0;
          if (count <= 0) continue;
          if (id === targetCardId) continue;
          if (deckIds.has(id)) continue;
          const c = window.getCardById ? window.getCardById(id) : null;
          if (!c || c.element !== targetCard.element) continue;
          const gain = window.xpValue ? window.xpValue(1) : (c.basePower || 10);
          totalXp += gain * count;
          if (totalXp >= remaining) return true;
        }

        return false;
      },

      // Perform upgrade on a deck card
      performUpgrade(deckItem, inventory, profile) {
        const cost = this.getUpgradeCost(deckItem.level);
        const extra = this.getExtraCopies(inventory, deckItem.id);

        if (extra < cost) return false;

        // Remove used copies from collection
        let toRemove = cost;
        for (let i = profile.collectionCards.length - 1; i >= 0 && toRemove > 0; i--) {
          if (profile.collectionCards[i].id === deckItem.id) {
            profile.collectionCards.splice(i, 1);
            toRemove--;
          }
        }

        // Increase level
        deckItem.level += 1;

        // Save profile
        userProfile.updateCurrentUser(profile);

        return true;
      },

      // ========== END UPGRADE SYSTEM ==========

      // ========== SHOP SYSTEM ==========
      
      // Shop products catalog
      getShopProducts() {
        return {
          offers: [
            {
              sku: 'offer_elements',
              title: 'Колекція елементалів',
              description: 'Всі чотири карти з колекції «Елементалі»',
              icon: '🔥',
              price: { currency: 'gears', amount: 20 },
              contents: { cards: 4 },
              limited: true
            }
          ],
          packs: [],
          singleCards: [
            {
              sku: 'card_legendary',
              title: 'Легендарна карта',
              description: 'Гарантована легендарна карта',
              icon: '⚡',
              price: { currency: 'gears', amount: 150 },
              contents: { cards: 1 },
              chance: { text: '40% шанс міфічної', class: '' }
            },
            {
              sku: 'card_epic',
              title: 'Епічна карта',
              description: 'Гарантована епічна карта',
              icon: '💜',
              price: { currency: 'gears', amount: 50 },
              contents: { cards: 1 },
              chance: { text: '30% шанс міфічної', class: 'rare' }
            },
            {
              sku: 'card_uncommon',
              title: 'Незвичайна карта',
              description: 'Гарантована незвичайна карта',
              icon: '💚',
              price: { currency: 'bolts', amount: 500 },
              contents: { cards: 1 },
              chance: { text: '15% шанс епічної', class: 'uncommon' }
            }
          ]
        };
      },

      loadShop() {
        const products = this.getShopProducts();
        this.renderNewShopItems('offers-container', products.offers, true);
        this.renderNewShopItems('single-cards-container', products.singleCards, false, true);
      },

      renderNewShopItems(containerId, items, isLimited = false, hasChance = false) {
        const container = document.getElementById(containerId);
        if (!container) {
          console.warn(`Container not found: ${containerId}`);
          return;
        }

        const profile = userProfile.getProfile();
        container.innerHTML = '';

        console.log(`Rendering ${items.length} items to ${containerId}`);

        items.forEach(item => {
          // Check if this is a one-time purchase that was already bought
          if (item.sku === 'offer_elements' && profile && profile.purchasedOffers && profile.purchasedOffers.includes('offer_elements')) {
            console.log(`Skipping already purchased: ${item.sku}`);
            return; // Skip rendering this item
          }

          const card = document.createElement('div');
          card.className = 'shop-item-card';

          const currencyEmojis = {
            bolts: '🔩',
            gears: '⚙️',
            cores: '✴︎'
          };
          const currencyIcon = currencyEmojis[item.price.currency] || '?';
          
          const chanceHTML = hasChance && item.chance 
            ? `<div class="shop-item-chance ${item.chance.class}">${item.chance.text}</div>`
            : '';

          card.innerHTML = `
            <div class="shop-item-icon">${item.icon}</div>
            <div class="shop-item-content">
              <div class="shop-item-name">${item.title}</div>
              <div class="shop-item-desc">${item.description}</div>
              ${chanceHTML}
            </div>
            <div class="shop-item-action">
              <div class="shop-item-price">${currencyIcon} ${item.price.amount}</div>
              <button class="shop-buy-button" data-sku="${item.sku}">
                Купити
              </button>
            </div>
          `;

          container.appendChild(card);
        });

        // Add click handlers
        container.querySelectorAll('.shop-buy-button').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const sku = btn.dataset.sku;
            console.log('Buying product:', sku);
            navigation.buyProduct(sku);
          });
        });
      },

      loadShopCards(elementFilter = 'all') {
        const profile = userProfile.getProfile();
        if (!profile) return;

        const container = document.getElementById('cards-container');
        if (!container) return;

        container.innerHTML = '';

        // Get all cards
        let allCards = window.ALL_CARDS || [];
        
        // Filter by element
        const filteredCards = elementFilter === 'all' 
          ? allCards 
          : allCards.filter(c => c.element === elementFilter);

        // Display cards with prices (use cardRenderer/createCardView if available)
        filteredCards.forEach(card => {
          const cardDiv = document.createElement('div');
          cardDiv.className = 'product-card';

          const displayPower = window.getPower ? window.getPower(card, 1) : (card.basePower || card.power || 0);
          // Price based on rarity/power
          const prices = {
            gears: Math.max(1, Math.ceil(displayPower * 2)),
            bolts: Math.max(1, Math.ceil(displayPower / 1.5)),
            cores: Math.max(1, Math.ceil(displayPower / 3))
          };

          // Render visual: prefer cardRenderer, then createCardView, fallback to element emoji
          let visualHtml = '';
          if (window.cardRenderer && typeof window.cardRenderer.render === 'function') {
            try {
              visualHtml = window.cardRenderer.render({ ...card, power: displayPower });
            } catch (err) {
              console.warn('cardRenderer.render failed for shop card', card.id, err);
              visualHtml = '';
            }
          }
          if (!visualHtml && window.createCardView) {
            try {
              const el = window.createCardView(card);
              visualHtml = el ? el.outerHTML : '';
            } catch (err) {
              console.warn('createCardView failed for shop card', card.id, err);
            }
          }
          if (!visualHtml) {
            const elementEmoji = this.getElementEmoji(card.element);
            visualHtml = `<div class="product-icon">${elementEmoji}</div>`;
          } else {
            // wrap visual into container matching product-icon slot
            visualHtml = `<div class="product-icon">${visualHtml}</div>`;
          }

          cardDiv.innerHTML = `
            <div class="product-header">
              ${visualHtml}
              <div class="product-info">
                <div class="product-title">${card.name}</div>
                <div class="product-desc">Сила: ${displayPower}</div>
              </div>
            </div>
            <div class="product-footer">
              <div style="display: flex; gap: 8px; flex-direction: column; width: 100%;">
                <button class="product-buy-btn" data-card-id="${card.id}" data-currency="gears" data-price="${prices.gears}" title="Шестерні">
                  🔧 ${prices.gears}
                </button>
                <button class="product-buy-btn" data-card-id="${card.id}" data-currency="bolts" data-price="${prices.bolts}" title="Болти">
                  ⚙️ ${prices.bolts}
                </button>
                <button class="product-buy-btn" data-card-id="${card.id}" data-currency="cores" data-price="${prices.cores}" title="Парові ядра">
                  🔥 ${prices.cores}
                </button>
              </div>
            </div>
          `;

          container.appendChild(cardDiv);
        });

        // Add click handlers for card purchase
        container.querySelectorAll('.product-buy-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const cardId = btn.dataset.cardId;
            const currency = btn.dataset.currency;
            const price = parseInt(btn.dataset.price);
            this.buyCard(cardId, currency, price);
          });
        });
      },

      buyCard(cardId, currency, price) {
        const profile = this.getProfile();
        if (!profile) return;

        // Check balance using Currency System
        if (!window.CurrencySystem.canAfford(profile, currency, price)) {
          const currencyName = window.CurrencySystem.getCurrencyNameGenitive(currency);
          alert(`Недостатньо ${currencyName}! Потрібно ${price}`);
          return;
        }

        const card = window.getCardById(cardId);
        if (!card) return;

        // Deduct currency using Currency System
        window.CurrencySystem.deduct(profile, currency, price);

        // Add card to collection
        if (!profile.collectionCards) {
          profile.collectionCards = [];
        }
        const newCardEntry = { id: card.id, level: 1 };
        profile.collectionCards.push(newCardEntry);

        // Авто-додавання в колоду: якщо менше 9 карт – додаємо;
        // інакше замінюємо найслабшу карту, якщо нова сильніша
        userProfile.autoAddToDeck(profile, newCardEntry);

        // Додати в inventory (для прокачки)
        if (!profile.inventory) {
          profile.inventory = {};
        }
        profile.inventory[card.id] = (profile.inventory[card.id] || 0) + 1;

        // Ініціалізувати прогрес карти
        const prog = window.getProgress ? window.getProgress(profile, card.id) : null;

        // Save profile (includes collection + deck changes)
        this.saveProfile(profile);

        // Update UI
        this.loadDeckCards(); // This will update topbar

        // Show success message
        const currencyEmojis = {
          gears: '⚙️',
          bolts: '🔩',
          cores: '✴︎'
        };
        alert(`✅ ${card.name} куплено за ${price} ${currencyEmojis[currency]}!`);

        // Reload cards
        this.loadShopCards(this.currentCardFilter || 'all');
      },

      renderProducts(containerId, products) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        products.forEach(product => {
          const card = document.createElement('div');
          card.className = 'product-card';

          const currencyEmojis = {
            bolts: '🔩',
            gears: '⚙️',
            cores: '✴︎'
          };
          const currencyIcon = currencyEmojis[product.price.currency] || '?';
          const badgeHTML = product.badge 
            ? `<div class="product-badge ${product.badge.class}">${product.badge.text}</div>` 
            : '';
          const bonusHTML = product.bonus 
            ? `<div class="product-bonus">${product.bonus}</div>` 
            : '';

          card.innerHTML = `
            ${badgeHTML}
            <div class="product-header">
              <div class="product-icon">${product.icon}</div>
              <div class="product-info">
                <div class="product-title">${product.title}</div>
                <div class="product-desc">${product.description}</div>
                ${bonusHTML}
              </div>
            </div>
            <div class="product-footer">
              <div class="product-price">
                <span class="currency-icon">${currencyIcon}</span>
                <span>${product.price.amount}</span>
              </div>
              <button class="product-buy-btn" data-sku="${product.sku}">Купити</button>
            </div>
          `;

          container.appendChild(card);
        });

        // Add click handlers
        container.querySelectorAll('.product-buy-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const sku = btn.dataset.sku;
            this.buyProduct(sku);
          });
        });
      },

      canAfford(product) {
        const profile = this.getProfile();
        if (!profile) return false;

        const currency = product.price.currency;
        return profile[currency] >= product.price.amount;
      },

      buyProduct(sku) {
        console.log('[BUY] Starting purchase for SKU:', sku);
        const profile = userProfile.getProfile();
        if (!profile) {
          console.error('[BUY] No profile found!');
          return;
        }
        console.log('[BUY] Profile loaded:', profile);

        const allProducts = this.getShopProducts();
        const product = [...allProducts.offers, ...allProducts.singleCards]
          .find(p => p.sku === sku);

        if (!product) {
          console.error('[BUY] Product not found:', sku);
          alert('Товар не знайдено!');
          return;
        }

        // КРОК 1: Перевірка можливості покупки
        const canAfford = this.canAfford(profile, product.price);
        if (!canAfford) {
          console.warn('[BUY] Cannot afford. Need:', product.price.amount, 'Have:', profile[product.price.currency]);
          const currencyNames = {
            bolts: 'болтів',
            gears: 'шестерень',
            cores: 'парових ядер'
          };
          const currencyName = currencyNames[product.price.currency] || 'валюти';
          alert(`Недостатньо ${currencyName}! Потрібно ${product.price.amount}`);
          return;
        }

        // КРОК 2: Списання валюти
        const currency = product.price.currency;
        profile[currency] -= product.price.amount;
        console.log('[BUY] Currency deducted. New balance:', profile[currency]);

        // КРОК 3: Видача нагород (карти або валюта)
        const rewards = [];

        if (product.contents.cards) {
          console.log('[BUY] Granting pack of', product.contents.cards, 'cards');
          // Mark SKU so grantPack can apply product-specific drop options
          profile._lastPurchasedSku = sku;
          const cards = this.grantPack(profile, product.contents.cards);
          // cleanup helper flag
          delete profile._lastPurchasedSku;
          rewards.push(...cards);
        }

        // Видача інших нагород (гарний бонус)
        if (product.contents.gears) {
          profile.gears = (profile.gears || 0) + product.contents.gears;
          if (typeof taskEvent === 'function') taskEvent('gears', product.contents.gears);
        }
        if (product.contents.cores) {
          profile.cores = (profile.cores || 0) + product.contents.cores;
        }
        if (product.contents.bolts) {
          profile.bolts = (profile.bolts || 0) + product.contents.bolts;
        }

        // КРОК 4: Позначити одноразові товари як куплені
        if (sku === 'offer_elements') {
          if (!profile.purchasedOffers) {
            profile.purchasedOffers = [];
          }
          profile.purchasedOffers.push(sku);
        }

        // КРОК 5: Збереження профілю
        userProfile.updateCurrentUser(profile);
        console.log('[BUY] Profile saved');

        // КРОК 6: Оновлення UI
        userProfile.updateUI();
        console.log('[BUY] UI updated');

        // КРОК 7: Перезавантажити магазин (приховати одноразові товари)
        if (sku === 'offer_elements') {
          this.loadShop();
        }

        // КРОК 8: Показ модалки з нагородами
        console.log('[BUY] Purchase complete! Rewards:', rewards.length, 'cards');
        if (rewards.length > 0) {
          this.showPackModal(rewards);
        } else {
          alert(`✅ Покупка успішна!`);
        }
      },

      // Функція для перевірки можливості покупки
      canAfford(profile, price) {
        const { currency, amount } = price;
        return (profile[currency] ?? 0) >= amount;
      },

      grantPack(profile, count) {
        let allCards = window.ALL_CARDS || [];
        const rewards = [];

        // Ініціалізувати інвентар якщо не існує
        if (!profile.inventory) {
          profile.inventory = {};
        }
        if (!profile.collectionCards) {
          profile.collectionCards = [];
        }

        for (let i = 0; i < count; i++) {
          let card = null;
          const sku = profile._lastPurchasedSku || '';

          // РІЗНІ ТИПИ ПАКІВ З РІЗНИМИ ОБМЕЖЕННЯМИ
          if (sku === 'card_uncommon') {
            // "Незвичайна карта" - 500 болтів
            // ОБМЕЖЕННЯ: Тільки R1-R4 (без легендарних/міфічних)
            const rarityRoll = Math.random() * 100;
            let targetRarity;
            
            if (rarityRoll < 60) {
              targetRarity = 'common';       // 60% - Звичайна (R1)
            } else if (rarityRoll < 75) {
              targetRarity = 'uncommon';     // 15% - Незвичайна (R2)
            } else if (rarityRoll < 90) {
              targetRarity = 'rare';         // 15% - Рідкісна (R3)
            } else {
              targetRarity = 'epic';         // 10% - Епічна (R4)
            }
            
            // Фільтруємо карти тільки з дозволеними рідкостями
            const allowedRarities = ['common', 'uncommon', 'rare', 'epic'];
            const candidates = allCards.filter(c => 
              allowedRarities.includes(c.rarity) && c.rarity === targetRarity
            );
            
            if (candidates.length > 0) {
              card = candidates[Math.floor(Math.random() * candidates.length)];
              console.log(`[GRANTPACK] ${sku}: ${targetRarity} - ${card.name}`);
            } else {
              // Резервний варіант: будь-яка карта R1-R4
              const fallback = allCards.filter(c => allowedRarities.includes(c.rarity));
              card = fallback[Math.floor(Math.random() * fallback.length)];
              console.log(`[GRANTPACK] ${sku}: Fallback ${card.rarity} - ${card.name}`);
            }
            
          } else if (sku === 'card_epic') {
            // "Епічна карта" - 50 шестерень
            // ОБМЕЖЕННЯ: R4-R6 з шансами 50%/30%/20%
            const rarityRoll = Math.random() * 100;
            let targetRarity;
            
            if (rarityRoll < 50) {
              targetRarity = 'epic';       // 50% - Епічна (R4)
            } else if (rarityRoll < 80) {
              targetRarity = 'legendary';  // 30% - Легендарна (R5)
            } else {
              targetRarity = 'mythic';     // 20% - Міфічна (R6)
            }
            
            // Фільтруємо карти тільки з дозволеними рідкостями
            const allowedRarities = ['epic', 'legendary', 'mythic'];
            const candidates = allCards.filter(c => 
              allowedRarities.includes(c.rarity) && c.rarity === targetRarity
            );
            
            if (candidates.length > 0) {
              card = candidates[Math.floor(Math.random() * candidates.length)];
              console.log(`[GRANTPACK] ${sku}: ${targetRarity} - ${card.name}`);
            } else {
              // Якщо немає карт цієї рідкості, беремо будь-яку з дозволених
              const fallback = allCards.filter(c => allowedRarities.includes(c.rarity));
              card = fallback[Math.floor(Math.random() * fallback.length)];
              console.log(`[GRANTPACK] ${sku}: Fallback ${card.rarity} - ${card.name}`);
            }
            
          } else if (sku === 'card_legendary') {
            // "Легендарна карта" - 150 шестерень
            // ОБМЕЖЕННЯ: Гарантовано легендарна (R5) або міфічна (R6)
            const allowedRarities = ['legendary', 'mythic'];
            
            // 80% шанс на R5, 20% на R6
            const isMythic = Math.random() < 0.2;
            const targetRarity = isMythic ? 'mythic' : 'legendary';
            
            const candidates = allCards.filter(c => c.rarity === targetRarity);
            if (candidates.length > 0) {
              card = candidates[Math.floor(Math.random() * candidates.length)];
              console.log(`[GRANTPACK] ${sku}: ${targetRarity} - ${card.name}`);
            } else {
              // Якщо немає міфічних, беремо легендарну, і навпаки
              const fallback = allCards.filter(c => allowedRarities.includes(c.rarity));
              card = fallback[Math.floor(Math.random() * fallback.length)];
              console.log(`[GRANTPACK] ${sku}: Fallback ${card.rarity} - ${card.name}`);
            }
            
          } else if (sku === 'offer_elements') {
            // "Колекція елементалів" - 20 шестерень
            // ОБМЕЖЕННЯ: Тільки R1-R4 (без легендарних/міфічних)
            const allowedRarities = ['common', 'uncommon', 'rare', 'epic'];
            
            // Для наборів - рівномірний розподіл
            const rarityRoll = Math.random() * 100;
            let targetRarity;
            
            if (rarityRoll < 25) {
              targetRarity = 'common'; // 25% - Звичайна
            } else if (rarityRoll < 50) {
              targetRarity = 'uncommon'; // 25% - Незвичайна
            } else if (rarityRoll < 75) {
              targetRarity = 'rare'; // 25% - Рідкісна
            } else {
              targetRarity = 'epic'; // 25% - Епічна
            }
            
            const candidates = allCards.filter(c => c.rarity === targetRarity);
            if (candidates.length > 0) {
              card = candidates[Math.floor(Math.random() * candidates.length)];
              console.log(`[GRANTPACK] ${sku}: ${targetRarity} - ${card.name}`);
            } else {
              const fallback = allCards.filter(c => allowedRarities.includes(c.rarity));
              card = fallback[Math.floor(Math.random() * fallback.length)];
              console.log(`[GRANTPACK] ${sku}: Fallback ${card.rarity} - ${card.name}`);
            }
            
          } else {
            // Для інших товарів (якщо використовується dropSystem)
            if (window.dropSystem && typeof window.dropSystem.dropCardWithOptions === 'function') {
              let opts = {};
              
              // Налаштування для різних SKU
              if (sku && sku.startsWith('card_')) {
                opts = { maxRarity: 'epic' }; // За замовчуванням - без легендарних
              }
              
              const res = window.dropSystem.dropCardWithOptions(
                profile, 
                allCards, 
                window.STARTER_CARDS || [], 
                profile.pityCounters || {noLegendary:0, noMythic:0}, 
                opts
              );
              card = res.card;
              profile.pityCounters = res.pityCounters;
              console.log(`[GRANTPACK] ${sku}: DropSystem ${card.rarity} - ${card.name}`);
            } else {
              // Fallback: випадкова карта з обмеженнями
              const allowedRarities = ['common', 'uncommon', 'rare', 'epic'];
              const fallback = allCards.filter(c => allowedRarities.includes(c.rarity));
              card = fallback[Math.floor(Math.random() * fallback.length)];
              console.log(`[GRANTPACK] ${sku}: Fallback ${card.rarity} - ${card.name}`);
            }
          }

          const newEntry = { id: card.id, level: 1 };

          // ДОДАТИ В КОЛЕКЦІЮ
          profile.collectionCards.push(newEntry);
          userProfile.autoAddToDeck(profile, newEntry);

          // ДОДАТИ В ІНВЕНТАР (для прокачки)
          profile.inventory[card.id] = (profile.inventory[card.id] ?? 0) + 1;

          // ЗБЕРЕГТИ ДЛЯ ПОКАЗУ В МОДАЛЦІ
          rewards.push(card);
        }

        return rewards;
      },

      showPackModal(rewards) {
        const modal = document.getElementById('pack-modal');
        const rewardsContainer = document.getElementById('pack-rewards');
        if (!modal || !rewardsContainer) return;
        rewardsContainer.innerHTML = '';

        // Render rewards: prefer createCardView, then cardRenderer, otherwise fallback HTML
        rewards.forEach(card => {
          const wrapper = document.createElement('div');
          wrapper.className = 'pack-card-wrapper';

          let visualAppended = false;
          if (window.createCardView) {
            try {
              const cardEl = window.createCardView(card);
              if (cardEl) {
                wrapper.appendChild(cardEl);
                visualAppended = true;
              }
            } catch (err) {
              console.warn('createCardView failed in pack modal', err);
            }
          }

          if (!visualAppended && window.cardRenderer && typeof window.cardRenderer.render === 'function') {
            try {
              const html = window.cardRenderer.render(card);
              const frag = document.createElement('div');
              frag.innerHTML = html;
              // append first node
              if (frag.firstElementChild) wrapper.appendChild(frag.firstElementChild);
              visualAppended = true;
            } catch (err) {
              console.warn('cardRenderer.render failed in pack modal', err);
            }
          }

          if (!visualAppended) {
            // Minimal fallback visual
            const el = document.createElement('div');
            el.className = 'sp-card pack-fallback-card ' + (card.element || '');
            el.innerHTML = `
              <div class="corner-gear">${card.element || ''}</div>
              <div class="power-plate"><div class="power-value">${card.basePower || card.power || ''}</div></div>
            `;
            wrapper.appendChild(el);
          }

          // Info under card
          const info = document.createElement('div');
          info.className = 'pack-card-info';
          const nameDiv = document.createElement('div');
          nameDiv.className = 'pack-card-name';
          nameDiv.textContent = card.name || '';
          info.appendChild(nameDiv);
          const elDiv = document.createElement('div');
          elDiv.className = 'pack-card-element';
          let elementName = card.element;
          if (window.ELEMENT_INFO && window.ELEMENT_INFO[card.element] && window.ELEMENT_INFO[card.element].name) {
            elementName = window.ELEMENT_INFO[card.element].name;
          }
          elDiv.textContent = elementName || '';
          info.appendChild(elDiv);

          wrapper.appendChild(info);
          rewardsContainer.appendChild(wrapper);
        });
        modal.classList.add('active');
      },

      closePackModal() {
        const modal = document.getElementById('pack-modal');
        if (modal) {
          modal.classList.remove('active');
        }
      },

      // ========== END SHOP SYSTEM ==========

      loadDeckCards() {
        // Оновити дані користувача на топбарі
        const profile = userProfile.getProfile();
        if (!profile) {
          console.error('No user profile found');
          return;
        }

        const boltsEl = document.getElementById('deck-bolts');
        const gearsEl = document.getElementById('deck-gears');
        const coresEl = document.getElementById('deck-cores');
        
        if (boltsEl) boltsEl.textContent = this.formatCompact ? this.formatCompact(profile.bolts || 0) : String(profile.bolts || 0);
        if (gearsEl) gearsEl.textContent = this.formatCompact ? this.formatCompact(profile.gears || 0) : String(profile.gears || 0);
        if (coresEl) coresEl.textContent = this.formatCompact ? this.formatCompact(profile.cores || 0) : String(profile.cores || 0);

        // Ініціалізувати карти якщо їх немає (для старих користувачів)
        if (!profile.deckCards || !profile.collectionCards) {
          console.log('Initializing cards for existing user...');
          const selectedCards = getRandomCards(16);
          profile.deckCards = selectedCards.slice(0, 9).map(card => ({
            id: card.id,
            level: 1
          }));
          profile.collectionCards = selectedCards.slice(9, 16).map(card => ({
            id: card.id,
            level: 1
          }));
          userProfile.updateCurrentUser(profile);
        }

        // Міграція старих користувачів: додати progress і inventory
        if (!profile.progress) {
          console.log('Migrating profile: adding progress...');
          profile.progress = {};
          const allCards = profile.deckCards.concat(profile.collectionCards || []);
          allCards.forEach(dc => {
            const cid = dc && (dc.cardId || dc.id);
            if (cid) {
              profile.progress[cid] = { level: dc.level || 1, xp: 0 };
            }
          });
        }

        if (!profile.inventory) {
          console.log('Migrating profile: adding inventory...');
          profile.inventory = {};
          const allCards = profile.deckCards.concat(profile.collectionCards || []);
          allCards.forEach(dc => {
            const cid = dc && (dc.cardId || dc.id);
            if (cid) {
              profile.inventory[cid] = (profile.inventory[cid] || 0) + 1;
            }
          });
        }

        // Вибрати карти з колоди (підтримка старого формату {id} і нового {cardId, uid})
        const deckCardIds = (profile.deckCards || [])
          .map(dc => (dc && (dc.cardId || dc.id)) ? (dc.cardId || dc.id) : null)
          .filter(Boolean);

        const deckCards = deckCardIds
          .map(cardId => getCardById(cardId))
          .filter(Boolean);
        
        // Перевірка чи карти знайдені
        if (deckCards.length === 0) {
          console.error('No cards found! Check if card scripts are loaded.');
          document.getElementById('deckGrid').innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Помилка завантаження карт</p>';
          return;
        }
        
        console.log('Loading deck cards:', deckCards.length, 'cards found');
        console.log('First card:', deckCards[0]);
        
        // Рендеринг карт — створюємо пари {card, level, originalIndex}, сортуємо за зростанням потужності
        const deckGrid = document.getElementById('deckGrid');
        if (deckGrid) {
          const deckPairs = deckCards.map((card, index) => {
            const dc = (profile.deckCards && profile.deckCards[index]) ? profile.deckCards[index] : null;
            const lvl = (dc && dc.level) ? dc.level : 1;
            return { card, level: lvl, originalIndex: index };
          });

          // Функція отримання потужності з урахуванням рівня
          const getCardPower = (c, lvl) => {
            try { return (window.getPower ? window.getPower(c, lvl) : getPower(c, lvl)) || 0; }
            catch (e) { return 0; }
          };

          // Sort descending: strongest first
          deckPairs.sort((a, b) => {
            const pa = getCardPower(a.card, a.level);
            const pb = getCardPower(b.card, b.level);
            if (pa === pb) return (b.card.id || '').localeCompare(a.card.id || '');
            return pb - pa;
          });

          const cardsHTML = deckPairs.map(p => this.renderDeckCard(p.card, p.level, p.originalIndex)).join('');

          console.log('Generated HTML length:', cardsHTML.length);
          deckGrid.innerHTML = cardsHTML;
          console.log('Cards rendered to grid (sorted ascending by power)');
          // Ініціалізація паралаксу для карт після рендеру
          initCardParallax();

          // Оновити силу колоди (з урахуванням сортування)
          let totalPower = 0;
          deckPairs.forEach((p) => {
            totalPower += getCardPower(p.card, p.level);
          });
          const powerDisplay = document.getElementById('deck-power-value');
          if (powerDisplay) powerDisplay.textContent = totalPower;

          // Прикріпити обробники подій з урахуванням оригінальних індексів
          const profileForUpgrade = userProfile.getProfile();
          const inventory = this.getInventory(profileForUpgrade);

          const hintEl = document.getElementById('deck-hint');
          if (hintEl) {
            if (this.hasAnyUpgradable(profileForUpgrade.deckCards, inventory)) {
              hintEl.classList.add('hot');
            } else {
              hintEl.classList.remove('hot');
            }
          }

          document.querySelectorAll('#deckGrid .sp-card').forEach((cardEl) => {
            const origAttr = cardEl.getAttribute('data-original-index');
            let originalIndex = origAttr ? parseInt(origAttr, 10) : -1;
            let deckItem = (originalIndex >= 0 && Array.isArray(profileForUpgrade.deckCards)) ? profileForUpgrade.deckCards[originalIndex] : undefined;

            // Fallback: try to resolve deckItem by card-id if originalIndex is invalid
            if (!deckItem) {
              const cardIdAttr = cardEl.getAttribute('data-card-id') || cardEl.getAttribute('data-id');
              if (cardIdAttr && Array.isArray(profileForUpgrade.deckCards)) {
                const foundIndex = profileForUpgrade.deckCards.findIndex(c => c && String(c.id) === String(cardIdAttr));
                if (foundIndex >= 0) {
                  deckItem = profileForUpgrade.deckCards[foundIndex];
                  originalIndex = foundIndex;
                }
              }
            }

            const canUpgrade = deckItem ? this.canUpgradeCard(deckItem, inventory) : false;

            cardEl.addEventListener('click', (e) => {
              e.preventDefault();
              const cardId = deckItem ? deckItem.id : cardEl.getAttribute('data-card-id') || cardEl.getAttribute('data-id');
              this.showCardDetails(cardId, true, originalIndex);
            });
          });
        }
        
        // Оновити силу колоди (вираховуємо так, як у дуелі, щоб відображення збігалося)
        try {
          let totalPower = 0;
          if (typeof navigation !== 'undefined' && typeof navigation.buildDuelDeckFromProfile === 'function' && typeof navigation.calcDeckPower === 'function') {
            const battleDeck = navigation.buildDuelDeckFromProfile(profile);
            totalPower = navigation.calcDeckPower(battleDeck);
          } else {
            deckCards.forEach((card) => {
              const prog = window.getProgress ? window.getProgress(profile, card.id) : { level: 1, xp: 0 };
              const cardLevel = prog.level;
              totalPower += window.getPower ? window.getPower(card, cardLevel) : getPower(card, cardLevel);
            });
          }
          const powerDisplay = document.getElementById('deck-power-value');
          if (powerDisplay) powerDisplay.textContent = totalPower;
        } catch (e) {
          console.warn('Failed to compute deck power for deck page', e);
        }
        
        // Прикріпити обробники подій
        const profileForUpgrade = userProfile.getProfile();
        const inventory = this.getInventory(profileForUpgrade);
        
        // Оновити стан hint-у
        const hintEl = document.getElementById('deck-hint');
        if (hintEl) {
          if (this.hasAnyUpgradable(profileForUpgrade.deckCards, inventory)) {
            hintEl.classList.add('hot');
          } else {
            hintEl.classList.remove('hot');
          }
        }
        
        // NOTE: event handlers for deck cards are attached above using sorted `deckPairs`
        // (we avoid attaching duplicate handlers here to prevent index mismatch bugs)
      },

      renderDeckCard(cardData, level = 1, originalIndex = -1) {
        const profile = userProfile.getProfile();
        const inventory = this.getInventory(profile);
        const prog = window.getProgress ? window.getProgress(profile, cardData.id) : { level: level, xp: 0 };
        const displayLevel = prog.level || level;
        const displayPower = window.getPower ? window.getPower(cardData, displayLevel) : getPower(cardData, displayLevel);
        const canUpgrade = this.canUpgradeCard({ id: cardData.id, level: displayLevel }, inventory);
        const canAutoLevel = canUpgrade && this.canGuaranteedLevelByBurning(profile, cardData.id);
        
        // Використовуємо CardRenderer якщо доступний
          if (window.cardRenderer) {
          // Передаємо атаку як актуальну силу, щоб рендер показував прокачку
          const boostedCard = { 
            ...cardData, 
            attack: displayPower,
            power: displayPower,
            stats: { ...(cardData.stats || {}), power: displayPower }
          };
          let html = window.cardRenderer.render(boostedCard, { level: displayLevel, power: displayPower, showUpgrade: canAutoLevel, interactive: true });
          return html;
        }

        // Fallback рендеринг - однаковий шаблон як CardRenderer
        const {
          id = 'unknown',
          element = 'fire',
          rarity = 'R1',
          basePower = 0,
          attack = displayPower
        } = cardData;

        const rarityNames = {
          'R1': 'ЗВИЧАЙНА',
          'R2': 'НЕЗВИЧАЙНА',
          'R3': 'РІДКІСНА',
          'R4': 'ЕПІЧНА',
          'R5': 'ЛЕГЕНДАРНА',
          'R6': 'МІФІЧНА'
        };

        const rarityBadge = rarityNames[rarity] || 'ЗВИЧАЙНА';
        const shownPower = attack || basePower;

        const elementIcons = {
          fire: `<div class="element-emoji fire-emoji">🔥</div>`,
          water: `<div class="element-emoji water-emoji">💧</div>`,
          air: `<div class="element-emoji air-emoji">💨</div>`,
          earth: `<div class="element-emoji earth-emoji">🍃</div>`
        };

        const elementIcon = elementIcons[element] || elementIcons.fire;

        return `
          <div class="sp-card ${element} ${rarity} ${canUpgrade ? 'upgradable' : ''}" 
               data-id="${id}"
               data-card-id="${id}"
               data-original-index="${originalIndex}"
               data-element="${element}"
               data-rarity="${rarity}"
               data-power="${shownPower}"
               data-attack="${attack}">
            <!-- ДЕКОРАТИВНІ ЛІНІЇ -->
            <div class="decor-line line-top"></div>
            <div class="decor-line line-bottom"></div>
            <!-- БЕЙДЖ РІДКОСТІ -->
            <div class="rarity-badge">${rarityBadge}</div>
            <!-- ВЕЛИКА ДЕТАЛЬНА ШЕСТЕРНЯ -->
            <div class="corner-gear">
              <div class="gear-inner">
                ${elementIcon}
              </div>
            </div>
            <!-- ПЛАШКА СИЛИ внизу -->
            <div class="power-plate">
              <div class="power-value">${shownPower}</div>
            </div>
            ${canAutoLevel ? '<div class="upgrade-arrow">▲</div>' : ''}
          </div>
        `;
      },

      // Оновлення сили карти в DOM після прокачки
      refreshCardPowerInDeck(cardId) {
        const profile = userProfile.getProfile();
        const cardData = window.getCardById(cardId);
        if (!cardData) return;

        const prog = window.getProgress ? window.getProgress(profile, cardId) : { level: 1, xp: 0 };
        const newPower = window.getPower ? window.getPower(cardData, prog.level) : cardData.basePower;

        // Оновити силу в DOM
        const powerEl = document.querySelector(
          `.sp-card[data-card-id="${cardId}"] .power-value`
        );
        if (powerEl) {
          powerEl.textContent = String(newPower);
        }

        // Оновити атрибути data-power та data-attack
        const cardEl = document.querySelector(`.sp-card[data-card-id="${cardId}"]`);
        if (cardEl) {
          cardEl.setAttribute('data-power', newPower);
          cardEl.setAttribute('data-attack', newPower);
        }

        // Оновити загальну силу колоди
        this.loadDeckCards();
      },

      loadCollectionCards() {
        const profile = userProfile.getProfile();
        if (!profile) {
          console.error('No profile found');
          return;
        }

        // Знайдені карти (ID): з колекції та колоди
        let foundIds = new Set([
          ...((profile.collectionCards || []).map(c => c.id)),
          ...((profile.deckCards || []).map(c => c.id))
        ]);

        // Все карты по элементам
        let allCards = window.ALL_CARDS || [];
        const elements = ['fire', 'water', 'air', 'earth'];
        const elementNames = {
          fire: 'Вогняна стихія',
          water: 'Водяна стихія',
          air: 'Повітряна стихія',
          earth: 'Земляна стихія'
        };

        elements.forEach(element => {
          const grid = document.getElementById(element + '-collection');
          if (!grid) return;
          const cards = allCards.filter(card => card.element === element);
          let foundCount = 0;
          grid.innerHTML = cards.map(card => {
            const found = foundIds.has(card.id);
            if (found) foundCount++;
            return `
              <div class="collection-card-item${found ? ' found' : ' not-found'}">
                <span class="collection-card-name">${card.name}</span>
                <span class="collection-card-status">${found ? 'Знайдено' : 'Не знайдено'}</span>
              </div>
            `;
          }).join('');
          // Обновить прогресс
          const progress = document.getElementById(element + '-progress');
          if (progress) progress.textContent = `${foundCount}/${cards.length} карт`;
        });
      },

      // ========== CARD DETAILS PAGE ==========

      showCardDetails(cardId, fromDeck = false, deckIndex = -1) {
        const profile = userProfile.getProfile();
        const cardData = getCardById(cardId);

        if (!cardData) {
          console.error('Card not found:', cardId);
          return;
        }

        // Визначити рівень за прогресом (прокачка)
        const prog = window.getProgress ? window.getProgress(profile, cardId) : { level: 1, xp: 0 };
        const cardLevel = prog.level;
        const actualPower = window.getPower ? window.getPower(cardData, cardLevel) : Math.round(cardData.basePower * Math.pow(cardData.upgradeMult, cardLevel - 1));

        // Рендерити основну інформацію про карту
        this.renderCardDetails(cardData, cardLevel, actualPower, deckIndex);

        // Знайдені карти (ID): з колекції та колоди
        const foundIds = new Set([
          ...((profile.collectionCards || []).map(c => c.id)),
          ...((profile.deckCards || []).map(c => c.id))
        ]);
        // Знайти всі карти цієї стихії (з бази даних)
        const allCards = window.ALL_CARDS || window.CARDS_COMMON || [];
        const sameElementCards = allCards.filter(c => c.element === cardData.element);
        // Визначити силу цільової карти через getPower (з урахуванням рівня прогресу)
        const targetPower = window.getPower ? (window.getPower(cardData, cardLevel)) : (cardData.basePower || cardData.power || 0);
        const deckIds = new Set((profile.deckCards || []).map(c => c.id));
        // Всі слабші карти цієї стихії, які знайдені у профілі, але НЕ в колоді
        const weakerCards = sameElementCards.filter(c => {
          if (!c || !c.id) return false;
          if (!foundIds.has(c.id)) return false;
          if (deckIds.has(c.id)) return false;
          // вычислим силу кандидата (используем getPower если есть и учитываем его прогресс)
          const candProg = window.getProgress ? window.getProgress(profile, c.id) : { level: 1, xp: 0 };
          const candPower = window.getPower ? window.getPower(c, candProg.level) : (c.basePower || c.power || 0);
          return candPower < targetPower && c.id !== cardId;
        });

        // Показ/скрытие заголовка и списка слабших карт
        const weakerHeader = document.getElementById('weaker-cards-header');
        const weakerList = document.getElementById('weaker-cards-list');
        if (weakerCards.length > 0) {
          if (weakerHeader) weakerHeader.style.display = '';
          if (weakerList) weakerList.style.display = '';
          this.renderWeakerCards(weakerCards, cardId, profile);
        } else {
          if (weakerHeader) weakerHeader.style.display = 'none';
          if (weakerList) {
            weakerList.style.display = 'none';
            weakerList.innerHTML = '';
          }
        }

        // === ПРОСТА ВІЗУАЛІЗАЦІЯ ПРОКАЧКИ ===
        // Покажемо простий XP-бар або викличемо внешнюю отрисовку, якщо доступна
        const cardMain = document.getElementById('card-main-info');
        const xpBar = cardMain ? cardMain.querySelector('.xp-bar') : null;
        if (window.renderUpgradeBar) {
          window.renderUpgradeBar(profile, cardId);
        } else if (xpBar) {
          const need = this.xpNeededForLevel(prog.level || 1) || 100;
          xpBar.style.width = `${Math.min(100, Math.round(((prog.xp || 0) / need) * 100))}%`;
        }
        // Обновити кнопку "Назад"
        const backBtn = document.getElementById('card-details-back');
        if (backBtn) {
          backBtn.onclick = (e) => {
            e.preventDefault();
            if (fromDeck) {
              this.showPage('deck');
            } else {
              this.showPage('collections');
            }
          };
        }

        // Показати сторінку
        this.showPage('card-details');
      },
      renderCardDetails(cardData, level, power, deckIndex) {
        const mainDisplay = document.getElementById('card-main-info');
        if (!mainDisplay) return;

        // Визуальный блок карточки — используем cardRenderer или createCardView, иначе fallback
        let visualHtml = '';
        if (window.cardRenderer && typeof window.cardRenderer.render === 'function') {
          // Передаем power & level через opts, чтобы рендерер использовал актуальную силу
          visualHtml = window.cardRenderer.render({ ...cardData }, { level, power });
        } else if (window.createCardView) {
          try {
            // Если createCardView умеет читать поле power в объекте — прокинем его
            const el = window.createCardView({ ...cardData, power, level });
            visualHtml = el ? el.outerHTML : '';
          } catch (err) {
            console.warn('createCardView failed', err);
            visualHtml = '';
          }
        }

        if (!visualHtml) {
          // Простой fallback визуал
          const elem = cardData.element || '';
          const shownPower = power || cardData.basePower || 0;
          visualHtml = `
            <div class="sp-card large ${elem}">
              <div class="corner-gear">${elem}</div>
              <div class="power-plate"><div class="power-value">${shownPower}</div></div>
              <div class="card-name">${cardData.name || ''}</div>
            </div>`;
        }

        // Инфо справа: имя, стихия, редкость, уровень
        const prog = (userProfile.getProfile && window.getProgress) ? window.getProgress(userProfile.getProfile(), cardData.id) : { level: level || 1, xp: 0 };
        const levelText = `LV ${prog.level || level || 1}`;
        const need = this.xpNeededForLevel(prog.level || 1) || 100;
        const xpText = `${prog.xp || 0} / ${need} XP`;

        mainDisplay.innerHTML = `
          <div style="display:flex; gap:14px; align-items:flex-start;">
            <div class="card-visual-area">${visualHtml}</div>
            <div class="card-meta" style="flex:1">
              <div class="card-meta-name" style="font-size:18px; font-weight:700; margin-bottom:6px">${cardData.name || ''}</div>
              <div class="card-meta-row">Стихія: <strong>${(cardData.element || '').toUpperCase()}</strong></div>
              <div class="card-meta-row">Рідкість: <strong>${cardData.rarity || ''}</strong></div>
              <div class="card-meta-row" style="margin-top:8px">Рівень: <span id="cu-level-inner">${levelText}</span></div>
              <div class="card-meta-row">XP: <span id="cu-xp-text-inner">${xpText}</span></div>
            </div>
          </div>`;

        // Обновляем глобальную панель прокачки в секции деталей
        const cuLevel = document.getElementById('cu-level');
        const cuXpText = document.getElementById('cu-xp-text');
        const cuXpFill = document.getElementById('cu-xp-fill');
        if (cuLevel) cuLevel.textContent = levelText;
        if (cuXpText) cuXpText.textContent = xpText;
        if (cuXpFill) cuXpFill.style.width = `${Math.min(100, Math.round(((prog.xp || 0) / need) * 100))}%`;

        // Настройка кнопок действий
        const addBtn = document.getElementById('card-add-to-deck-btn');
        const removeBtn = document.getElementById('card-remove-btn');
        const upgradeBtn = document.getElementById('card-upgrade-btn');

        if (addBtn) {
          addBtn.onclick = (e) => {
            e.preventDefault();
            const profile = userProfile.getProfile();
            const res = userProfile.autoAddToDeck(profile, { id: cardData.id, level: prog.level || 1 });
            if (res.added || res.replaced) {
              userProfile.updateCurrentUser(profile);
              this.loadDeckCards();
              this.loadCollectionCards();
              alert('Карта додана в колоду');
            } else {
              alert('Не вдалося додати карту в колоду');
            }
          };
        }

        if (removeBtn) {
          removeBtn.onclick = (e) => {
            e.preventDefault();
            const profile = userProfile.getProfile();
            // Удаляем карту из коллекции и/или из колоды
            if (profile.collectionCards) {
              for (let i = profile.collectionCards.length - 1; i >= 0; i--) {
                if (profile.collectionCards[i].id === cardData.id) {
                  profile.collectionCards.splice(i, 1);
                  break;
                }
              }
            }
            if (profile.deckCards) {
              for (let i = profile.deckCards.length - 1; i >= 0; i--) {
                if (profile.deckCards[i].id === cardData.id) {
                  profile.deckCards.splice(i, 1);
                  break;
                }
              }
            }
            userProfile.updateCurrentUser(profile);
            this.loadDeckCards();
            this.loadCollectionCards();
            this.showPage('collections');
          };
        }

        // Кнопка прокачки удалена — ничего не делаем
        try {
          const upgradeBtnEl = document.getElementById('card-upgrade-btn');
          if (upgradeBtnEl) {
            upgradeBtnEl.style.display = 'none';
            upgradeBtnEl.onclick = null;
          }
          const cuBtn = document.getElementById('cu-upgrade-btn');
          if (cuBtn) cuBtn.remove();
        } catch (err) {
          console.warn('upgrade button cleanup failed', err);
        }
      },

        // Рендер списка слабших карт: плитки с визуалом (использует cardRenderer, если доступен)
        renderWeakerCards(weakerCards, targetCardId, profile) {
          const list = document.getElementById('weaker-cards-list');
          if (!list) return;
          const targetCard = window.getCardById ? window.getCardById(targetCardId) : null;

          // Создаём сетку
          const tiles = weakerCards.map(c => {
            const card = (c && c.id && window.getCardById) ? window.getCardById(c.id) : c;
            if (!card) return '';

            // Процентный показатель: сколько XP даст спалення этой карты относительно нужного XP для следующего уровня
            const progTarget = (profile && profile.progress && profile.progress[targetCardId]) ? profile.progress[targetCardId] : { level: 1, xp: 0 };
            const need = this.xpNeededForLevel(progTarget.level) || 100;
            const cardPower = card.basePower || card.power || 0;
            const xpGain = cardPower || 10;
            const pct = Math.max(0, Math.min(100, Math.round((xpGain / need) * 100)));

            // Рендер через cardRenderer если доступен
            let cardHtml = '';
            if (window.cardRenderer && typeof window.cardRenderer.render === 'function') {
              cardHtml = window.cardRenderer.render({ ...card, power: cardPower });
            } else if (window.createCardView) {
              const el = window.createCardView(card);
              cardHtml = el ? el.outerHTML : '';
            } else {
              // fallback минимальный визуал
              cardHtml = `
                <div class="sp-card ${card.element || ''}">
                  <div class="corner-gear">${card.element || ''}</div>
                  <div class="power-plate"><div class="power-value">${cardPower}</div></div>
                  <div class="card-name">${card.name}</div>
                </div>`;
            }

            return `
              <div class="weaker-card-tile" data-card-id="${card.id}">
                <div class="weaker-card-visual">${cardHtml}</div>
                <div class="weaker-card-footer">
                  <div class="weaker-card-power">${cardPower}</div>
                  <div class="weaker-card-pct">+${pct}%</div>
                </div>
              </div>`;
          }).join('');

          list.innerHTML = `<div class="weaker-grid">${tiles}</div>`;

          // Добавляем обработчик клика на плитку: просто нажимаешь на карту — она сгорает
          list.querySelectorAll('.weaker-card-tile').forEach(tile => {
            tile.addEventListener('click', (e) => {
              const srcId = tile.dataset.cardId;
              if (!srcId) return;
              const result = this.burnCardForXP(profile, srcId, targetCardId);
              if (result && result.success) {
                // Удаляем плитку из DOM
                tile.remove();
                userProfile.updateCurrentUser(profile);
                // Обновляем списки
                this.loadCollectionCards();
                this.loadDeckCards();
                // Обновим детали если мы на странице картки
                if (this.currentPage === 'card-details') {
                  this.renderCardDetails(window.getCardById(targetCardId), result.newLevel, result.newPower || 0, -1);
                  if (window.renderUpgradeBar) window.renderUpgradeBar(profile, targetCardId);
                }
                // Без alert'а — карточка исчезла и прогресс обновлён
              } else {
                console.warn(result && result.error ? result.error : 'Не вдалося спалити карту');
              }
            });
          });
        },

        // Сжечь карту из коллекции/інвентаря ради XP целевой карты (без подтверждений)
        burnCardForXP(profile, sourceCardId, targetCardId) {
          if (!profile || !sourceCardId || !targetCardId) return { success: false, error: 'Невірні параметри' };

          // Найти и удалить одну копию из collectionCards (предпочтительно из коллекции, а не из колоды)
          let removed = false;
          let removedFromInventory = false;
          if (Array.isArray(profile.collectionCards)) {
            for (let i = profile.collectionCards.length - 1; i >= 0; i--) {
              if (profile.collectionCards[i].id === sourceCardId) {
                profile.collectionCards.splice(i, 1);
                removed = true;
                break;
              }
            }
          }

          // Если не найдено в коллекции, попробуем удалить из инвентаря напрямую (inventory счетчик)
          if (!removed && profile.inventory && profile.inventory[sourceCardId] > 0) {
            profile.inventory[sourceCardId] = Math.max(0, profile.inventory[sourceCardId] - 1);
            removed = true;
            removedFromInventory = true;
          }

          if (!removed) return { success: false, error: 'Копія карти не знайдена для спалення' };

          // Определяем XP-гив (используем силу карты как базовый XP)
          const srcCard = window.getCardById ? window.getCardById(sourceCardId) : null;
          const tgtCard = window.getCardById ? window.getCardById(targetCardId) : null;
          const xpGain = srcCard ? (srcCard.basePower || srcCard.power || 10) : 10;

          // Убедимся, что структура progress есть
          if (!profile.progress) profile.progress = {};
          if (!profile.progress[targetCardId]) profile.progress[targetCardId] = { level: 1, xp: 0 };

          // Добавляем XP используя глобальную систему (если доступна), чтобы избежать рассинхрона
          if (window.addXp && window.getProgress) {
            window.addXp(profile, targetCardId, xpGain);
            const prog = window.getProgress(profile, targetCardId);
            var newLevel = prog.level || 1;
            var leveled = true; // неважно точно число — мы вернём факт успеха
          } else {
            // fallback: локальная обработка (устаревшая логика)
            profile.progress[targetCardId].xp = (profile.progress[targetCardId].xp || 0) + xpGain;
            let leveledLocal = false;
            let newLevelLocal = profile.progress[targetCardId].level || 1;
            while (profile.progress[targetCardId].xp >= this.xpNeededForLevel(newLevelLocal)) {
              profile.progress[targetCardId].xp -= this.xpNeededForLevel(newLevelLocal);
              newLevelLocal += 1;
              leveledLocal = true;
            }
            profile.progress[targetCardId].level = newLevelLocal;
            var newLevel = newLevelLocal;
            var leveled = leveledLocal;
          }

          // Если карта была удалена из коллекции, не трогаем inventory; если удалена из inventory, уже уменьшили выше

          // Синхронизировать уровень в записи колоды, если карта там присутствует
          if (Array.isArray(profile.deckCards)) {
            for (let i = 0; i < profile.deckCards.length; i++) {
              if (profile.deckCards[i] && profile.deckCards[i].id === targetCardId) {
                profile.deckCards[i].level = newLevel;
                break;
              }
            }
          }

          // Сохранение выполняется вызывающей стороной
          const newPower = tgtCard ? (window.getPower ? window.getPower(tgtCard, newLevel) : (tgtCard.basePower || 0)) : null;

          return { success: true, leveled, newLevel, newPower };
        },

      // ========== DUELS (MVP) ==========
      
      // ========== DUELS (MVP) ========== 
      updatePlayerMultiplierPreview() {
        if (!window.CURRENT_DUEL) return;
        const duel = window.CURRENT_DUEL;
        const container = document.getElementById('duelMultipliers');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Create 3 multiplier badges for 3 slots
        for (let i = 0; i < 3; i++) {
          const pCard = duel.player.hand[i];
          const eCard = duel.enemy.hand[i];
          
          if (!pCard || !eCard) {
            container.innerHTML += '<div class="mult-badge" style="opacity:0.3"><span class="mult-text">—</span></div>';
            continue;
          }
          
          const mult = (window.MULT[pCard.element]?.[eCard.element]) ?? 1;
          const multClass = mult > 1 ? 'mult-good' : mult < 1 ? 'mult-bad' : 'mult-neutral';
          const multText = mult === 1 ? '× 1' : `× ${mult.toFixed(1)}`;
          
          container.innerHTML += `
            <div class="mult-badge ${multClass}">
              <span class="swords"></span>
              <span class="mult-text">${multText}</span>
            </div>
          `;
        }
      },
      
      initDuelsPage() {
        const btn = document.getElementById('duel-start-btn');
        if (btn) {
          btn.addEventListener('click', () => {
            startDuelSearchAnimation(() => {
              navigation.startRandomDuel();
            });
          });
        }
        // Clear UI and show searching state
        const enemyHpEl = document.getElementById('enemyHp');
        const playerHpEl = document.getElementById('playerHp');
        const enemyHandEl = document.getElementById('enemyHand');
        const playerHandEl = document.getElementById('playerHand');
        const duelLogEl = document.getElementById('duelLog');
        // update both legacy text nodes and new HUD elements
        if (enemyHpEl) enemyHpEl.textContent = '0/0';
        if (playerHpEl) playerHpEl.textContent = '0/0';
        const enemyHpText = document.getElementById('enemyHpText');
        const playerHpText = document.getElementById('playerHpText');
        const enemyHpBar = document.getElementById('enemyHpBar');
        const playerHpBar = document.getElementById('playerHpBar');
        if (enemyHpText) enemyHpText.textContent = '0/0';
        if (playerHpText) playerHpText.textContent = '0/0';
        if (enemyHpBar) enemyHpBar.style.width = '0%';
        if (playerHpBar) playerHpBar.style.width = '0%';
        if (enemyHandEl) enemyHandEl.innerHTML = '';
        if (playerHandEl) playerHandEl.innerHTML = '';
        if (duelLogEl) duelLogEl.innerHTML = 'Пошук ворога...';

        // Автоматично починаємо пошук/запуск дуелі
        setTimeout(() => {
          startDuelSearchAnimation(() => {
            navigation.startRandomDuel();
          });
        }, 250);
      },

      buildDuelDeckFromProfile(profile) {
        // Використовуємо level з progress для розрахунку сили в дуелі
        return profile.deckCards.map(dc => {
          const card = getCardById(dc.cardId || dc.id);
          const prog = window.getProgress ? window.getProgress(profile, dc.cardId || dc.id) : { level: 1, xp: 0 };
          const cardLevel = prog.level;
          const power = window.getPower ? window.getPower(card, cardLevel) : Math.round(card.basePower * Math.pow(card.upgradeMult, cardLevel - 1));
          return { id: card.id, element: card.element, rarity: card.rarity, power };
        });
      },

      calcDeckPower(deck) {
        return deck.reduce((s, c) => s + (c.power || 0), 0);
      },

      // Генерация адаптивной колоды противника: HP врага ≈ HP игрока ±20
      generateAdaptiveEnemyDeck(playerDeck9, playerHP) {
        const calcPower = (card, level = 1) => {
          if (window.getPower) return window.getPower(card, level);
          return card.attack || card.basePower || 0;
        };

        // Целевое значение — HP игрока ±20
        const offset = Math.floor(Math.random() * 41) - 20; // -20..+20
        const targetTotal = Math.max(0, playerHP + offset);
        console.log('generateAdaptiveEnemyDeck: playerHP=', playerHP, 'offset=', offset, 'targetTotal=', targetTotal);

        // pool: если мало карт - используем ALL_CARDS
        const allCards = window.ALL_CARDS || window.CARDS_COMMON || [];
        let pool = allCards.slice().filter(c => !(String(c.id).startsWith('S')));
        if (pool.length < 9) pool = allCards.slice();

        const cardPower = c => calcPower(c, 1) || 0;

        // Ensure pool items have numeric `power` field (buildEnemyCardPool expects that)
        // и минимум силы карты 12
        const poolWithPower = pool.map(c => Object.assign({}, c, { power: Math.max(12, cardPower(c)) }));

        // Use buildEnemyCardPool to select cards close to targetTotal
        const { cards: selected, totalPower: baseTotal } = buildEnemyCardPool(targetTotal, poolWithPower, 9);

        // Fill if not enough
        if (selected.length < 9) {
          // If pool selection returned too few, fill with lowest-power cards from poolWithPower
          const extras = poolWithPower.filter(c => !selected.includes(c)).slice(0, 9 - selected.length);
          selected.push(...extras.map(e => ({ id: e.id, element: e.element, rarity: e.rarity, power: Math.max(12, e.power) })));
        }

        // Level-up selected cards to approach targetTotal
        const enriched = selected.map(c => ({ src: c, level: 1, power: Math.max(12, (c && typeof c.power === 'number') ? c.power : cardPower(c)) }));
        let selectedSum = enriched.reduce((s, e) => s + e.power, 0);
        let attempts = 0;
        const maxAttempts = 500;
        while (selectedSum < targetTotal && attempts < maxAttempts) {
          let bestIdx = -1;
          let bestGain = 0;
          for (let i = 0; i < enriched.length; i++) {
            const e = enriched[i];
            const nextLevel = Math.min((e.level || 1) + 1, 20);
            const nextPower = calcPower(e.src, nextLevel) || e.power;
            const gain = nextPower - e.power;
            if (gain > bestGain) { bestGain = gain; bestIdx = i; }
          }
          if (bestIdx === -1 || bestGain <= 0) break;
          enriched[bestIdx].level = Math.min((enriched[bestIdx].level || 1) + 1, 20);
          enriched[bestIdx].power = calcPower(enriched[bestIdx].src, enriched[bestIdx].level) || enriched[bestIdx].power;
          selectedSum = enriched.reduce((s, e) => s + e.power, 0);
          attempts++;
        }

        // Ensure total power does not exceed playerHP + 20
        let totalPower = enriched.reduce((s, e) => s + e.power, 0);
        if (totalPower > playerHP + 20) {
          // Sort by power descending and reduce levels
          enriched.sort((a, b) => b.power - a.power);
          for (let i = 0; i < enriched.length && totalPower > playerHP + 20; i++) {
            const e = enriched[i];
            const minPower = calcPower(e.src, 1);
            if (e.power > minPower) {
              e.level = Math.max(1, e.level - 1);
              e.power = calcPower(e.src, e.level);
              totalPower = enriched.reduce((s, e) => s + e.power, 0);
            }
          }
        }

        // Map to lightweight enemy objects compatible with legacy duel
        const enemyDeck9 = enriched.map(e => ({ id: e.src.id, element: e.src.element, rarity: e.src.rarity, power: Math.max(12, Math.round(e.power || 12)) }));
        console.log('enemyDeck9 length=', enemyDeck9.length, 'totalPower=', enriched.reduce((s, e) => s + e.power, 0));
        return enemyDeck9;
      },

      getXpForLevel(level) {
        return Math.floor(100 * Math.pow(level, 1.35));
      },

      xpNeededForLevel(level) {
        return this.getXpForLevel(level);
      },

      pendingDuel: null,

      createCardNode(card, isPlayer, slotIdx) {
        const elementIcons = {
          fire: '<div class="element-emoji fire-emoji">🔥</div>',
          water: '<div class="element-emoji water-emoji">💧</div>',
          air: '<div class="element-emoji air-emoji">💨</div>',
          earth: '<div class="element-emoji earth-emoji">🍃</div>'
        };
        const elementIcon = elementIcons[card.element] || elementIcons.fire;
        const el = document.createElement('div');
        el.className = `sp-card ${card.element} ${card.rarity || 'common'}`;
        el.dataset.rarity = card.rarity || 'common';
        if (slotIdx !== undefined) el.dataset.slot = slotIdx;
        // Use card's own power if present, fallback to calculation by id/level
        let displayPower = 0;
        try {
          if (card && typeof card.power === 'number' && !isNaN(card.power)) displayPower = Math.round(card.power);
          else {
            const src = (card && card.id) ? (window.getCardById ? window.getCardById(card.id) : getCardById(card.id)) : null;
            const lvl = (card && card.level) ? card.level : 1;
            displayPower = src ? (window.getPower ? window.getPower(src, lvl) : getPower(src, lvl)) : (card && card.basePower ? card.basePower : 12);
          }
        } catch (e) { displayPower = (card && card.power) || 12; }

        el.innerHTML = `
          <div class="corner-gear">
            ${elementIcon}
          </div>
          <div class="power-plate"><div class="power-value">${displayPower}</div></div>
        `;
        return el;
      },

      startRandomDuel() {
        const profile = userProfile.getProfile();
        if (!profile || !profile.deckCards || profile.deckCards.length < 9) {
          alert('Колода неповна. Потрібно 9 карт.');
          return;
        }
        const playerDeck9 = this.buildDuelDeckFromProfile(profile);
        // HP игрока = сумма силы 9 карт
        const playerHP = playerDeck9.reduce((s, c) => s + (c.power || 0), 0);

        // Генерируем колоду противника через новый генератор, привязанный к реальной силе игрока
        const enemyObj = (typeof generateEnemyForDuel === 'function') ? generateEnemyForDuel() : { deck: [], power: 0 };
        // make a safe shallow copy of deck objects to avoid accidental shared references
        const enemyDeck9 = (enemyObj.deck || enemyObj.deckCards || []).map(c => Object.assign({}, c));
        let enemyPower = capEnemyPowerRelative(enemyObj.power || 0, playerHP);
        try { console.debug('startRandomDuel -> generated enemy deck powers', enemyDeck9.map(d => d.power)); } catch(e) {}

        // Зберігаємо pending
        this.pendingDuel = { playerDeck9, enemyDeck9, playerPower: playerHP, enemyPower };
        // Автоматичний пошук/початок бою — міні-таймаут для відчуття пошуку
        const logEl = document.getElementById('duelLog');
        if (logEl) logEl.textContent = 'Противник знайдений — готуємось...';
        setTimeout(() => {
          window.CURRENT_DUEL = window.createDuel(this.pendingDuel.playerDeck9, this.pendingDuel.enemyDeck9);
          this.renderDuel();
        }, 700);
      },

      showPreDuelDialog() {
        const modal = document.getElementById('duel-pre-modal');
        if (!modal || !this.pendingDuel) return;
        const profile = userProfile.getProfile();
        const enemyNameEl = document.getElementById('duel-pre-name');
        const enemyPowerEl = document.getElementById('duel-pre-power');
        const playerPowerEl = document.getElementById('duel-pre-player-power');

        // Генеруємо ім'я ворога
        const names = ['Lucky Harry','Steam Witch','Rust Baron','Copper Shade','Gearmancer','Brass Vex','Coal Phantom'];
        const picked = names[Math.floor(Math.random()*names.length)];
        this.pendingDuel.enemyName = picked;

        if (enemyNameEl) enemyNameEl.textContent = picked;
        if (enemyPowerEl) enemyPowerEl.textContent = capEnemyPowerRelative(
          this.pendingDuel.enemyPower,
          this.pendingDuel.playerPower
        );
        if (playerPowerEl) playerPowerEl.textContent = this.pendingDuel.playerPower;

        modal.classList.add('active');

        const attackBtn = document.getElementById('duel-pre-attack');
        const rerollBtn = document.getElementById('duel-pre-reroll');
        if (attackBtn) {
          attackBtn.onclick = () => {
            modal.classList.remove('active');
            window.CURRENT_DUEL = window.createDuel(this.pendingDuel.playerDeck9, this.pendingDuel.enemyDeck9);
            this.renderDuel();
          };
        }
        if (rerollBtn) {
          rerollBtn.onclick = () => {
            modal.classList.remove('active');
            startDuelSearchAnimation(() => {
              navigation.startRandomDuel();
            });
          };
        }
      },

      renderDuel() {
        const duel = window.CURRENT_DUEL;
        if (!duel) return;

        // Update legacy text nodes if present
        const legacyEnemyHp = document.getElementById('enemyHp');
        const legacyPlayerHp = document.getElementById('playerHp');
        if (legacyEnemyHp) legacyEnemyHp.textContent = `${duel.enemy.hp}/${duel.enemy.maxHp}`;
        if (legacyPlayerHp) legacyPlayerHp.textContent = `${duel.player.hp}/${duel.player.maxHp}`;

        // Update new HUD bars and labels
        const enemyHpText = document.getElementById('enemyHpText');
        const playerHpText = document.getElementById('playerHpText');
        const enemyHpBar = document.getElementById('enemyHpBar');
        const playerHpBar = document.getElementById('playerHpBar');
        if (enemyHpText) enemyHpText.textContent = `${duel.enemy.hp}/${duel.enemy.maxHp}`;
        if (playerHpText) playerHpText.textContent = `${duel.player.hp}/${duel.player.maxHp}`;
        if (enemyHpBar) {
          const pct = Math.max(0, Math.min(100, Math.round((duel.enemy.hp / Math.max(1, duel.enemy.maxHp)) * 100)));
          enemyHpBar.style.width = pct + '%';
        }
        if (playerHpBar) {
          const pctP = Math.max(0, Math.min(100, Math.round((duel.player.hp / Math.max(1, duel.player.maxHp)) * 100)));
          playerHpBar.style.width = pctP + '%';
        }

        const enemyPowerEl = document.getElementById('enemyPower');
        const playerPowerEl = document.getElementById('playerPower');
        if (enemyPowerEl) enemyPowerEl.textContent = formatCompact(duel.enemy.maxHp);
        if (playerPowerEl) playerPowerEl.textContent = formatCompact(duel.player.maxHp);

        const enemyHandEl  = document.getElementById('enemyHand');
        const playerHandEl = document.getElementById('playerHand');
        enemyHandEl.innerHTML = '';
        playerHandEl.innerHTML = '';

        // Render enemy hand (no interactions)
        duel.enemy.hand.forEach((c, idx) => {
          const node = this.createCardNode(c, false, idx);
          enemyHandEl.appendChild(node);
        });

        // Diagnostic: ensure per-card powers sum to enemy maxHp
        try {
          const enemySum = duel.enemy.hand.reduce((s, cc) => s + (cc.power || 0), 0);
          if (enemySum !== duel.enemy.maxHp) {
            console.warn('ENEMY POWER MISMATCH', { enemySum, maxHp: duel.enemy.maxHp, hand: duel.enemy.hand });
          }
        } catch (e) {}

        // Render player hand (click to play)
        duel.player.hand.forEach((c, idx) => {
          const node = this.createCardNode(c, true, idx);
          node.addEventListener('click', () => {
            if (duel.finished || duelAnimLock) return;

            const attackerEl = node;
            const defenderEl = enemyHandEl.children[idx];

            // damage = сила удару (візьми з твоєї формули)
            const dmg = window.damage(c, duel.enemy.hand[idx]).dmg;

            animateOriginalFlyHit(attackerEl, defenderEl, dmg, () => {
              window.CURRENT_DUEL = window.playTurn(duel, idx);
              this.renderDuel();
              try { console.debug('renderDuel: after playTurn', { finished: window.CURRENT_DUEL.finished, result: window.CURRENT_DUEL.result, playerHp: window.CURRENT_DUEL.player.hp, enemyHp: window.CURRENT_DUEL.enemy.hp }); } catch(e){}
              if (window.CURRENT_DUEL.finished) {
                this.showDuelResult(window.CURRENT_DUEL);
              }
            });
          });
          playerHandEl.appendChild(node);
        });

        const logEl = document.getElementById('duelLog');
        logEl.innerHTML = duel.log.map(r => `Хід ${r.turn}: Ви(${r.player.element}) ${formatCompact(r.player.dmg)} ×${r.player.mult} ↔ Ворог(${r.enemy.element}) ${formatCompact(r.enemy.dmg)} ×${r.enemy.mult}`).join('<br>');
        
        this.updatePlayerMultiplierPreview();
      },

      showDuelResult(duel) {
        const profile = userProfile.getProfile();
        if (!profile) return;

        const modal = document.getElementById('duel-result-modal');
        const titleEl = document.getElementById('duel-result-title');
        const subtitleEl = document.getElementById('duel-result-subtitle');
        const rewardsEl = document.getElementById('duel-result-rewards');
        const winsInfoEl = document.getElementById('duel-wins-info');
        const summaryHpEl = document.getElementById('duel-summary-player-hp');
        const battleCardsEl = document.getElementById('duel-battle-cards');

        if (!modal) return;

        // Визначити результат за HP (якщо HP гравця 0 - поразка, якщо ворога 0 - перемога)
        let result = duel.result;
        if (duel.player.hp === 0 && duel.enemy.hp > 0) {
          result = 'lose';
        } else if (duel.enemy.hp === 0 && duel.player.hp > 0) {
          result = 'win';
        }

        updateTasks("duel");

        let xpGain = 0;
        let boltsGain = 0;

        // Helper: exponential bolts reward based on player level
        const boltsReward = (base, growth, level) => {
          const L = Math.max(1, Number(level) || 1);
          return Math.round(base * Math.pow(growth, L - 1));
        };
        let dropInfo = '';

        if (result === 'win') {
          titleEl.textContent = '🏆 ПЕРЕМОГА';
          xpGain = Math.round(80 * Math.pow(1.08, (profile.level||1)-1));
          boltsGain = boltsReward(55, 1.12, profile.level);
          profile.wins = (profile.wins || 0) + 1;
          updateTasks("win");
          // Система дропа карт з урахуванням рідкості
          if (window.dropSystem && window.dropSystem.shouldDrop('win')) {
            // Ініціалізація pity лічильників
            profile.pityCounters = profile.pityCounters || { noLegendary: 0, noMythic: 0 };
            
            const allCards = window.ALL_CARDS || [];
            const starterCards = window.STARTER_CARDS || [];
            
            const dropResult = window.dropSystem.dropCard(
              profile,
              allCards,
              starterCards,
              profile.pityCounters
            );
            
            if (dropResult.card) {
              const card = dropResult.card;
              
              // Оновити pity лічильники
              profile.pityCounters = dropResult.pityCounters;
              
              // Додати карту в колекцію
              profile.collectionCards = profile.collectionCards || [];
              const newEntry = { id: card.id, level: 1 };
              profile.collectionCards.push(newEntry);
              userProfile.autoAddToDeck(profile, newEntry);

              // Оновити інвентар
              profile.inventory = profile.inventory || {};
              profile.inventory[card.id] = (profile.inventory[card.id] || 0) + 1;
              
              // Показати інформацію про дроп
              const rarityNames = { R1: 'звичайна', R2: 'незвичайна', R3: 'рідкісна', R4: 'епічна', R5: 'легендарна', R6: 'міфічна' };
              const rarityName = rarityNames[card.rarity] || card.rarity;
              const sourceInfo = dropResult.fromStarterPool ? ' (стартова)' : '';
              dropInfo = ` + ${rarityName} карта ${card.id}${sourceInfo}`;
            }
          }
        } else if (result === 'lose') {
          titleEl.textContent = '💀 ПОРАЗКА';
          xpGain = Math.round(30 * Math.pow(1.05, (profile.level||1)-1));
          boltsGain = boltsReward(12, 1.08, profile.level);
          profile.losses = (profile.losses || 0) + 1;
          
          // Менший шанс дропа при поразці (10%)
          if (window.dropSystem && window.dropSystem.shouldDrop('lose')) {
            profile.pityCounters = profile.pityCounters || { noLegendary: 0, noMythic: 0 };
            
            const allCards = window.ALL_CARDS || [];
            const starterCards = window.STARTER_CARDS || [];
            
            const dropResult = window.dropSystem.dropCard(
              profile,
              allCards,
              starterCards,
              profile.pityCounters
            );
            
            if (dropResult.card) {
              const card = dropResult.card;
              profile.pityCounters = dropResult.pityCounters;
              
              profile.collectionCards = profile.collectionCards || [];
              const newEntry = { id: card.id, level: 1 };
              profile.collectionCards.push(newEntry);
              userProfile.autoAddToDeck(profile, newEntry);

              profile.inventory = profile.inventory || {};
              profile.inventory[card.id] = (profile.inventory[card.id] || 0) + 1;
              
              const rarityNames = { R1: 'звичайна', R2: 'незвичайна', R3: 'рідкісна', R4: 'епічна', R5: 'легендарна', R6: 'міфічна' };
              const rarityName = rarityNames[card.rarity] || card.rarity;
              const sourceInfo = dropResult.fromStarterPool ? ' (стартова)' : '';
              dropInfo = ` + ${rarityName} карта ${card.id}${sourceInfo}`;
            }
          }
        } else {
          titleEl.textContent = '⚖️ НІЧИЯ';
          xpGain = Math.round(45 * Math.pow(1.06, (profile.level||1)-1));
          boltsGain = boltsReward(28, 1.10, profile.level);
          
          // Середній шанс дропа при нічиї (20%)
          if (window.dropSystem && window.dropSystem.shouldDrop('draw')) {
            profile.pityCounters = profile.pityCounters || { noLegendary: 0, noMythic: 0 };
            
            const allCards = window.ALL_CARDS || [];
            const starterCards = window.STARTER_CARDS || [];
            
            const dropResult = window.dropSystem.dropCard(
              profile,
              allCards,
              starterCards,
              profile.pityCounters
            );
            
            if (dropResult.card) {
              const card = dropResult.card;
              profile.pityCounters = dropResult.pityCounters;
              
              profile.collectionCards = profile.collectionCards || [];
              const newEntry = { id: card.id, level: 1 };
              profile.collectionCards.push(newEntry);
              userProfile.autoAddToDeck(profile, newEntry);

              profile.inventory = profile.inventory || {};
              profile.inventory[card.id] = (profile.inventory[card.id] || 0) + 1;
              
              const rarityNames = { R1: 'звичайна', R2: 'незвичайна', R3: 'рідкісна', R4: 'епічна', R5: 'легендарна', R6: 'міфічна' };
              const rarityName = rarityNames[card.rarity] || card.rarity;
              const sourceInfo = dropResult.fromStarterPool ? ' (стартова)' : '';
              dropInfo = ` + ${rarityName} карта ${card.id}${sourceInfo}`;
            }
          }
        }

        subtitleEl.textContent = 'Ви отримали:';

        // Оновити профіль
        profile.xp = (profile.xp || 0) + xpGain;
        // Ensure level is numeric to avoid string/undefined edge cases
        profile.level = Number(profile.level) || 1;
        profile.bolts = (profile.bolts || 0) + boltsGain;
        profile.gamesPlayed = (profile.gamesPlayed || 0) + 1;

        // Перевірити рівень (шестерні нараховуються лише при підвищенні рівня)
        let leveled = 0;
        let gearsGained = 0;
        // Diagnostic: log initial values to help debug failed level-ups
        try {
          const needInitial = this.xpNeededForLevel(profile.level || 1);
          console.debug('Level check start:', { level: profile.level, xp: profile.xp, needInitial });
        } catch (e) {
          console.warn('xpNeededForLevel threw', e);
        }

        while (profile.xp >= this.xpNeededForLevel(profile.level || 1)) {
          const need = this.xpNeededForLevel(profile.level || 1);
          console.debug('Leveling: before subtract', { level: profile.level, xp: profile.xp, need });
          profile.xp -= need;
          // Збільшуємо рівень
          profile.level = Number(profile.level) + 1;
          console.info('Leveled up to', profile.level);
          // Нараховуємо шестерні за цей рівень (логіка: додаємо кількість шестерень рівня)
          const gearForThisLevel = profile.level;
          profile.gears = (profile.gears || 0) + gearForThisLevel;
          gearsGained += gearForThisLevel;
          leveled += 1;
        }

        userProfile.updateCurrentUser(profile);
        userProfile.updateUI();
        this.updateXP(profile);

        if (gearsGained > 0 && typeof taskEvent === 'function') {
          try { taskEvent('gears', gearsGained); } catch (e) { console.warn('taskEvent failed', e); }
        }

        // Показати лише те, що отримано у бою: XP, болти, дроп, та шестерні (якщо були отримані через рівень)
        const parts = [];
        if (xpGain > 0) parts.push(`XP: +${this.formatCompact ? this.formatCompact(xpGain) : xpGain}`);
        if (boltsGain > 0) parts.push(`🔩 +${this.formatCompact ? this.formatCompact(boltsGain) : boltsGain}`);
        if (gearsGained > 0) parts.push(`⚙️ +${gearsGained}`);
        if (dropInfo) parts.push(dropInfo.trim());
        rewardsEl.textContent = parts.join('  •  ') || 'Нічого не отримано';
        winsInfoEl.textContent = `Побід в дуелях: 🏆 ${formatCompact(profile.wins || 0)}`;
        summaryHpEl.textContent = duel.player.hp;

        // Показати підсумки бою з картами
        const elementEmojis = {
          fire: '🔥',
          water: '💧',
          air: '💨',
          earth: '🍃'
        };

        battleCardsEl.innerHTML = duel.log.map(log => {
          const pEmoji = elementEmojis[log.player.element] || elementEmojis.fire;
          const eEmoji = elementEmojis[log.enemy.element] || elementEmojis.fire;
          return `
            <div class="duel-battle-card-row">
              <div class="duel-battle-card-player">
                <div class="duel-battle-card-icon" style="--elem: var(--${log.player.element})">
                  <span class="element-emoji">${pEmoji}</span>
                </div>
                <span class="duel-battle-card-dmg">${log.player.dmg}</span>
              </div>
              <span class="duel-battle-vs">⚔</span>
              <div class="duel-battle-card-enemy">
                <span class="duel-battle-card-dmg">${log.enemy.dmg}</span>
                <div class="duel-battle-card-icon" style="--elem: var(--${log.enemy.element})">
                  <span class="element-emoji">${eEmoji}</span>
                </div>
              </div>
            </div>
          `;
        }).join('');

        modal.classList.add('active');
      },

      closeDuelResult() {
        const modal = document.getElementById('duel-result-modal');
        if (modal) {
          modal.classList.remove('active');
          // Перезапустити дуель
          startDuelSearchAnimation(() => {
            navigation.startRandomDuel();
          });
        }
      }
    };

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', () => {
      // Меню "Сумка"
      document.getElementById('menu-bag-btn')?.addEventListener('click', () => navigation.showPage('bag'));
      document.getElementById('bag-back-btn')?.addEventListener('click', () => navigation.showPage('home'));
      // Initialize auth UI
      authUI.init();
      
      // Update UI with profile data if logged in
      if (userProfile.isLoggedIn()) {
        userProfile.updateUI();
        const profile = userProfile.getProfile();
        if (profile) maybeResetTasks(profile);
        console.log('User profile loaded:', userProfile.getCurrentUser());
      }
      
      // Navigation handlers for tiles
      document.querySelectorAll('[data-page]').forEach(element => {
        element.addEventListener('click', (e) => {
          e.preventDefault();
          const pageId = element.dataset.page;
          navigation.showPage(pageId);
        });
      });
      
      // Bottom nav handlers
      const navButtons = {
        'nav-home': 'home',
        'nav-profile': 'profile',
        'nav-guild': 'guild'
      };
      
      document.querySelectorAll('.navbtn').forEach(btn => {
        btn.addEventListener('click', () => {
          // Update active state
          document.querySelectorAll('.navbtn').forEach(x => x.classList.remove('active'));
          btn.classList.add('active');
          
          // Navigate to page
          const pageId = navButtons[btn.id];
          if (pageId) {
            navigation.showPage(pageId);
          }
        });
      });
      
      // Logout button handler
      document.querySelector('.logout-btn')?.addEventListener('click', () => {
        if (confirm('Ви впевнені, що хочете вийти?')) {
          userProfile.logout();
          location.reload();
        }
      });
      
      // Shop tab handlers
      document.querySelectorAll('.shop-tab').forEach(tab => {
        tab.addEventListener('click', function() {
          // Update active tab
          document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
          this.classList.add('active');
          
          // Show corresponding content
          const tabId = this.dataset.tab;
          document.querySelectorAll('.shop-tab-content').forEach(content => {
            content.classList.remove('active');
          });
          document.getElementById(`shop-tab-${tabId}`)?.classList.add('active');
        });
      });

      // Card filter handlers
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          // Update active state
          document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          
          // Load filtered cards
          const element = this.dataset.element;
          navigation.currentCardFilter = element;
          navigation.loadShopCards(element);
        });
      });

      // Pack modal close handler
      document.getElementById('pack-modal-close')?.addEventListener('click', () => {
        navigation.closePackModal();
      });

      

      // Click outside modal to close
      document.getElementById('pack-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'pack-modal') {
          navigation.closePackModal();
        }
      });

      // Duel result modal close handler
      document.getElementById('duel-result-close')?.addEventListener('click', () => {
        navigation.closeDuelResult();
      });

      // Click outside duel modal to close
      document.getElementById('duel-result-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'duel-result-modal') {
          navigation.closeDuelResult();
        }
      });
    });

    window.getXpForLevel = navigation.getXpForLevel;

function renderTasks() {
  if (typeof renderTasksV2 === 'function') return renderTasksV2();
  const root = document.getElementById("tasks-list");
  if (!root) return;

  const profile = userProfile.getProfile();
  if (!profile) return;

  ensureTasksState(profile);

  root.innerHTML = "";

  TASKS.forEach(task => {
    const progress = profile.tasks[task.id] || 0;
    const done = profile.completedTasks.includes(task.id);
    const percent = Math.min(100, (progress / task.target) * 100);

    const el = document.createElement("div");
    el.className = "task-card" + (done ? " task-done" : "");

    const xp = task.reward?.xp || 0;
    const gears = task.reward?.gears || 0;

    el.innerHTML = `
      <div class="task-top">
        <span>${task.title}</span>
        <span>${progress}/${task.target}</span>
      </div>
      <div class="task-desc">${task.desc}</div>
      <div class="task-bar">
        <div class="task-bar-fill" style="width:${percent}%"></div>
      </div>
      <div class="task-reward">
        Нагорода: ${xp} XP${gears ? ` + ${gears} ⚙️` : ""}
      </div>
    `;

    root.appendChild(el);
  });
}

function updateTasks(type, amount = 1) {
  if (typeof taskEvent === 'function') {
    try { taskEvent(type, amount); } catch (e) { console.warn('taskEvent delegate failed', e); }
    return;
  }
  const profile = userProfile.getProfile();
  if (!profile) return;

  ensureTasksState(profile);

  TASKS.forEach(task => {
    if (task.type !== type) return;
    if (profile.completedTasks.includes(task.id)) return;

    profile.tasks[task.id] = (profile.tasks[task.id] || 0) + 1;

    if (profile.tasks[task.id] >= task.target) {
      profile.completedTasks.push(task.id);

      profile.xp = (profile.xp || 0) + (task.reward?.xp || 0);
        const _g = (task.reward?.gears || 0);
        profile.gears = (profile.gears || 0) + _g;
        if (_g > 0 && typeof taskEvent === 'function') taskEvent('gears', _g);

      userProfile.updateCurrentUser(profile);
      userProfile.updateUI();
      if (typeof navigation !== 'undefined' && typeof navigation.updateXP === 'function') {
        navigation.updateXP(profile);
      } else if (typeof window !== 'undefined' && typeof window.updateXP === 'function') {
        window.updateXP(profile);
      }
    }
  });

  renderTasks();
}

    // Accordion (removed since we're using page navigation now)

    // Tiles (removed since we're using page navigation now)

  

// =========================================================
// DUEL SEARCH ANIMATION LOGIC
// =========================================================

let duelSearchTimer = null;
let duelDotsTimer = null;

function startDuelSearchAnimation(onFinish) {
  const overlay = document.getElementById('duelSearchOverlay');
  const textEl = document.getElementById('duelSearchText');
  if (!overlay || !textEl) return;

  overlay.classList.remove('hidden');

  let dots = 0;
  duelDotsTimer = setInterval(() => {
    dots = (dots + 1) % 4;
    textEl.textContent = 'Пошук суперника' + '.'.repeat(dots);
  }, 400);

  const duration = 2000 + Math.random() * 2000;

  duelSearchTimer = setTimeout(() => {
    stopDuelSearchAnimation();
    if (typeof onFinish === 'function') onFinish();
  }, duration);
}

function stopDuelSearchAnimation() {
  const overlay = document.getElementById('duelSearchOverlay');
  if (overlay) overlay.classList.add('hidden');

  if (duelDotsTimer) {
    clearInterval(duelDotsTimer);
    duelDotsTimer = null;
  }
  if (duelSearchTimer) {
    clearTimeout(duelSearchTimer);
    duelSearchTimer = null;
  }
}

// =========================================================
// ANTI-SPAM LOCK (during animations)
// =========================================================
// =========================================================
// GLOBAL NUMBER FORMATTER (k for >=1000)
// =========================================================
function formatCompact(number) {
  const n = Number(number) || 0;
  const neg = n < 0;
  const abs = Math.abs(n);
  if (abs < 1000) return String(n);
  let v = abs / 1000;
  // show one decimal for values < 10k, integer otherwise
  let out;
  if (v < 10) {
    out = Math.round(v * 10) / 10; // one decimal
  } else {
    out = Math.round(v); // integer
  }
  // strip trailing .0
  out = String(out).replace(/\.0$/, '');
  return (neg ? '-' : '') + out + 'к';
}

let duelAnimationLocked = false;

function lockDuelActions() {
  duelAnimationLocked = true;
}

function unlockDuelActions() {
  duelAnimationLocked = false;
}

/* ---------- Damage number ---------- */
function spawnDamageNumber(targetEl, value) {
  const num = document.createElement('div');
  num.className = 'damage-number';
  num.textContent = `-${formatCompact(value)}`;

  const rect = targetEl.getBoundingClientRect();
  const arena = document.querySelector('.duel-arena') || document.body;

  num.style.left = rect.left + rect.width / 2 - 14 + 'px';
  num.style.top  = rect.top + rect.height / 2 - 20 + 'px';

  arena.appendChild(num);
  setTimeout(() => num.remove(), 1000);
}

/* ---------- Element FX ---------- */
function spawnElementEffect(targetEl, element) {
  const fx = document.createElement('div');
  fx.className = `element-effect ${element}-effect`;

  const rect = targetEl.getBoundingClientRect();
  const arena = document.querySelector('.duel-arena') || document.body;

  fx.style.left = rect.left + rect.width / 2 - 30 + 'px';
  fx.style.top  = rect.top + rect.height / 2 - 30 + 'px';

  arena.appendChild(fx);
  setTimeout(() => fx.remove(), 800);
}

/* ---------- MAIN ATTACK ANIMATION ---------- */
function animateCardAttack(attackerEl, defenderEl, cardData, damage, onDone) {
  if (duelAnimationLocked) return;
  if (!attackerEl || !defenderEl) return;

  lockDuelActions();

  // attacker animation
  attackerEl.classList.add('card-attacking');

  // defender reaction
  defenderEl.classList.add('card-hit', 'card-shake');

  // visual effects
  spawnDamageNumber(defenderEl, damage);
  spawnElementEffect(defenderEl, cardData.element);

  // cleanup (duration = cardAttack 0.8s)
  setTimeout(() => {
    attackerEl.classList.remove('card-attacking');
    defenderEl.classList.remove('card-hit', 'card-shake');

    unlockDuelActions();
    if (typeof onDone === 'function') onDone();
  }, 800);
}

/* =========================================================
   DUEL: card flies & hits (damage-scaled) + anti-spam lock
   ========================================================= */

let duelAnimLock = false;

function setDuelAnimLock(v){
  duelAnimLock = !!v;
  document.body.classList.toggle('duel-anim-lock', duelAnimLock);
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function rectCenter(r){
  return { x: r.left + r.width/2, y: r.top + r.height/2 };
}

function spawnHitFlash(x, y, intensity01){
  const size = 70 + Math.round(70 * intensity01); // 70..140
  const el = document.createElement('div');
  el.className = 'duel-hit-flash';
  el.style.width = size + 'px';
  el.style.height = size + 'px';
  el.style.left = (x - size/2) + 'px';
  el.style.top  = (y - size/2) + 'px';
  el.style.animation = `hitFlash ${260 + Math.round(140 * intensity01)}ms ease-out forwards`;
  el.style.filter = `brightness(${1.0 + 0.6 * intensity01})`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 600);
}

function animateOriginalFlyHit(attackerEl, defenderEl, damage, onDone){
  if (duelAnimLock) return;
  if (!attackerEl || !defenderEl) return;

  setDuelAnimLock(true);

  const arena = document.querySelector('.duel-arena');
  if (!arena) {
    setDuelAnimLock(false);
    return;
  }

  // --- 1. Зберігаємо стан ---
  const aRect = attackerEl.getBoundingClientRect();
  const dRect = defenderEl.getBoundingClientRect();
  const arenaRect = arena.getBoundingClientRect();

  const startX = aRect.left - arenaRect.left;
  const startY = aRect.top  - arenaRect.top;

  const endX = dRect.left + dRect.width / 2 - arenaRect.left - aRect.width / 2;
  const endY = dRect.top  + dRect.height / 2 - arenaRect.top  - aRect.height / 2;

  const originalStyle = {
    position: attackerEl.style.position,
    left: attackerEl.style.left,
    top: attackerEl.style.top,
    zIndex: attackerEl.style.zIndex,
    transition: attackerEl.style.transition
  };

  // --- 2. Placeholder (щоб layout не схлопнувся) ---
  const placeholder = document.createElement('div');
  placeholder.style.width = aRect.width + 'px';
  placeholder.style.height = aRect.height + 'px';
  attackerEl.parentNode.insertBefore(placeholder, attackerEl);

  // --- 3. Вириваємо карту ---
  attackerEl.classList.add('attacking');
  attackerEl.style.position = 'absolute';
  attackerEl.style.left = startX + 'px';
  attackerEl.style.top  = startY + 'px';
  attackerEl.style.zIndex = '6000';
  arena.appendChild(attackerEl);

  attackerEl.getBoundingClientRect(); // reflow

  // --- 4. Політ ---
  attackerEl.style.transition = 'left 299ms cubic-bezier(.2,.9,.2,1), top 299ms cubic-bezier(.2,.9,.2,1), transform 299ms ease';
  attackerEl.style.transform = 'scale(1.08)';
  attackerEl.style.left = endX + 'px';
  attackerEl.style.top  = (endY - 20) + 'px';

  setTimeout(() => {
    // --- 5. УДАР ---
    defenderEl.classList.add('duel-hit');
    attackerEl.style.transition = 'top 138ms ease-out, transform 138ms ease-out';
    attackerEl.style.top = (endY + 12) + 'px';
    attackerEl.style.transform = 'scale(0.96)';
  }, 299);

  setTimeout(() => {
    defenderEl.classList.remove('duel-hit');

    // --- 6. ПОВЕРНЕННЯ ---
    attackerEl.style.transition = 'left 253ms ease-in, top 253ms ease-in, transform 253ms ease-in';
    attackerEl.style.left = startX + 'px';
    attackerEl.style.top  = startY + 'px';
    attackerEl.style.transform = 'scale(1)';
  }, 437);

  setTimeout(() => {
    // --- 7. Відновлення ---
    attackerEl.classList.remove('attacking');
    attackerEl.style.position = originalStyle.position;
    attackerEl.style.left = originalStyle.left;
    attackerEl.style.top = originalStyle.top;
    attackerEl.style.zIndex = originalStyle.zIndex;
    attackerEl.style.transition = originalStyle.transition;

    placeholder.replaceWith(attackerEl);
    setDuelAnimLock(false);

    if (typeof onDone === 'function') onDone();
  }, 690);
}

// ===== PERF PATCH v1 (mobile) =====
(function () {
  // 1) RAF-batched DOM writes
  const textQueue = new Map(); // el -> string
  const classQueue = []; // [el, className, enabled]
  let rafPending = false;

  function flushUI() {
    rafPending = false;

    // text updates
    for (const [el, val] of textQueue) {
      if (el && el.textContent !== val) el.textContent = val;
    }
    textQueue.clear();

    // class toggles
    for (let i = 0; i < classQueue.length; i++) {
      const [el, cls, on] = classQueue[i];
      if (!el) continue;
      el.classList.toggle(cls, !!on);
    }
    classQueue.length = 0;
  }

  function scheduleFlush() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(flushUI);
  }

  // API to use in your code
  window.uiSetText = function (selectorOrEl, value) {
    const el =
      typeof selectorOrEl === "string"
        ? document.querySelector(selectorOrEl)
        : selectorOrEl;

    if (!el) return;
    textQueue.set(el, String(value));
    scheduleFlush();
  };

  window.uiToggleClass = function (selectorOrEl, className, enabled) {
    const el =
      typeof selectorOrEl === "string"
        ? document.querySelector(selectorOrEl)
        : selectorOrEl;

    if (!el) return;
    classQueue.push([el, className, enabled]);
    scheduleFlush();
  };

  // 2) One UI interval for timers/progress (instead of many setInterval)
  // Call window.uiTickCallbacks.add(fn) to run fn every 250ms
  const callbacks = new Set();
  window.uiTickCallbacks = callbacks;

  setInterval(() => {
    // Run lightweight callbacks only (no full re-render)
    callbacks.forEach((fn) => {
      try { fn(); } catch (e) {}
    });
  }, 250);

  // 3) Debounced save (avoid localStorage freezes)
  let saveTimer = null;
  window.debouncedSaveProfile = function (saveFn, delay = 800) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try { saveFn(); } catch (e) {}
    }, delay);
  };

  // 4) Prefer passive listeners for touch/scroll
  // (doesn't change your code; just helper if you add listeners)
  window.addPassive = function (el, event, handler) {
    el.addEventListener(event, handler, { passive: true });
  };
})();

/* ===== Click delegation helper (optional) =====
   Usage: mark actionable buttons with data-action and optional data-id.
   Example: <button data-action="upgradeCard" data-id="123">Upgrade</button>
*/
(function () {
  const root = document.body;
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    try {
      if (action === 'takeTaskReward' && window.takeTaskReward) window.takeTaskReward(id);
      else if (action === 'upgradeCard' && window.upgradeCard) window.upgradeCard(id);
      else if (action === 'buyItem' && window.buyItem) window.buyItem(id);
      // add more routes as needed
    } catch (e) {
      // swallow errors to avoid breaking global handler
    }
  }, { passive: true });
})();
