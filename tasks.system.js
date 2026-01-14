/* =========================================================
   TASK SYSTEM v2 — WORKING DAILY TASKS
   ========================================================= */

const TASK_RESET_MS = 12 * 60 * 60 * 1000;

/* === TASK DEFINITIONS === */
const TASK_DEFS = [
  // LOGIN
  {
    id: "login_1",
    title: "Повернення в гру",
    desc: "Увійдіть у гру",
    type: "login",
    target: 1,
    reward: { gears: 5, xp: 50 }
  },

  // WINS
  {
    id: "win_3",
    title: "Перші перемоги",
    desc: "Виграйте 3 дуелі",
    type: "win",
    target: 3,
    reward: { gears: 10, xp: 150 }
  },
  {
    id: "win_5",
    title: "Впевнений боєць",
    desc: "Виграйте 5 дуелей",
    type: "win",
    target: 5,
    reward: { gears: 20, xp: 300 }
  },
  {
    id: "win_10",
    title: "Майстер дуелей",
    desc: "Виграйте 10 дуелей",
    type: "win",
    target: 10,
    reward: { gears: 50, xp: 700 }
  },

  // GEARS EARN
  {
    id: "gears_10",
    title: "Перші шестерні",
    desc: "Отримайте 10 ⚙️",
    type: "gears",
    target: 10,
    reward: { xp: 100 }
  },
  {
    id: "gears_20",
    title: "Механік",
    desc: "Отримайте 20 ⚙️",
    type: "gears",
    target: 20,
    reward: { xp: 250 }
  },
  {
    id: "gears_50",
    title: "Інженер",
    desc: "Отримайте 50 ⚙️",
    type: "gears",
    target: 50,
    reward: { xp: 600 }
  }
];

/* === STATE === */
function initTasks(profile) {
  profile.tasks = profile.tasks || {};
  profile.tasksMeta = profile.tasksMeta || {
    claimed: {},
    resetAt: Date.now()
  };

  if (Date.now() - profile.tasksMeta.resetAt > TASK_RESET_MS) {
    profile.tasks = {};
    profile.tasksMeta.claimed = {};
    profile.tasksMeta.resetAt = Date.now();
  }
}

/* === PROGRESS UPDATE === */
function taskEvent(type, amount = 1) {
  console.log('[TASK EVENT]', type, amount);
  const profile = userProfile.getProfile();
  if (!profile) return;

  initTasks(profile);

  TASK_DEFS.forEach(t => {
    if (t.type !== type) return;
    if (profile.tasksMeta.claimed[t.id]) return;

    profile.tasks[t.id] = Math.min(
      t.target,
      (profile.tasks[t.id] || 0) + amount
    );
  });

  userProfile.updateCurrentUser(profile);
  renderTasksV2();
}

/* === CLAIM === */
function claimTask(taskId) {
  const profile = userProfile.getProfile();
  if (!profile) return;

  initTasks(profile);

  const def = TASK_DEFS.find(t => t.id === taskId);
  if (!def) return;

  if ((profile.tasks[taskId] || 0) < def.target) return;
  if (profile.tasksMeta.claimed[taskId]) return;

  profile.tasksMeta.claimed[taskId] = true;
  profile.gears = (profile.gears || 0) + (def.reward.gears || 0);
  profile.xp = (profile.xp || 0) + (def.reward.xp || 0);

  userProfile.updateCurrentUser(profile);
  userProfile.updateUI();
  renderTasksV2();
}

/* === RENDER === */
function renderTasksV2() {
  const root = document.getElementById("tasks-list");
  if (!root) return;

  const profile = userProfile.getProfile();
  if (!profile) {
    root.innerHTML = `<div class="no-tasks">Увійдіть у гру</div>`;
    return;
  }

  initTasks(profile);

  root.innerHTML = TASK_DEFS.map(t => {
    const cur = profile.tasks[t.id] || 0;
    const done = cur >= t.target;
    const claimed = profile.tasksMeta.claimed[t.id];
    const pct = Math.min(100, Math.round(cur / t.target * 100));

    return `
      <div class="task-card ${claimed ? "task-claimed" : ""}">
        <div class="task-title">${t.title}</div>
        <div class="task-desc">${t.desc}</div>

        <div class="task-bar">
          <div class="task-bar-fill" style="width:${pct}%"></div>
        </div>

        <div class="task-footer">
          <span>${cur}/${t.target}</span>
          ${
            claimed
              ? `<span class="claimed">✓ Отримано</span>`
              : done
                ? `<button class="task-claim-btn" onclick="claimTask('${t.id}')">Забрати</button>`
                : ``
          }
        </div>
      </div>
    `;
  }).join("");
}

/* === USAGE NOTES ===
 - Call `taskEvent("login", 1)` once on user login.
 - Call `taskEvent("win", 1)` on each duel win.
 - Call `taskEvent("gears", amount)` when user gains gears (pass real amount).
 - Make sure `userProfile` global provides `getProfile()`, `updateCurrentUser()` and `updateUI()`.
*/
