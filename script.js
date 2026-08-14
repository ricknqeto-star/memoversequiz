/* ============================================================
   CONFIG
   ============================================================ */
const HOUSES = [
  { id: 'white',  name: 'White House',  prefix: 'W', bg: 'bg-white',   text: 'text-slate-800', headerBg: 'bg-slate-200', scoreBg: 'bg-slate-700', scoreText: 'text-white' },
  { id: 'green',  name: 'Green House',  prefix: 'G', bg: 'bg-[#22c55e]', text: 'text-white',   headerBg: 'bg-green-600', scoreBg: 'bg-slate-800', scoreText: 'text-white' },
  { id: 'yellow', name: 'Yellow House', prefix: 'Y', bg: 'bg-[#eab308]', text: 'text-slate-900', headerBg: 'bg-yellow-500', scoreBg: 'bg-slate-800', scoreText: 'text-yellow-300' },
  { id: 'red',    name: 'Red House',    prefix: 'R', bg: 'bg-[#ef4444]', text: 'text-white',   headerBg: 'bg-red-600',  scoreBg: 'bg-slate-800', scoreText: 'text-red-300' }
];

/* ============================================================
   STATE + LOCAL STORAGE
   ============================================================ */
const STORAGE_KEY = 'bibleQuizScoreboard';

const state = {
  scores: {},
  active: {},
  firstCorrectClaimed: {},
  seatCorrects: {},
  seatsPerHouse: 4,
  displayOrder: {}          // lower number = higher place (used only for ranking)
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      state.scores              = data.scores || {};
      state.firstCorrectClaimed = data.firstCorrectClaimed || {};
      state.seatCorrects        = data.seatCorrects || {};
      state.seatsPerHouse       = data.seatsPerHouse || 4;
      state.displayOrder        = data.displayOrder || {};
    }
  } catch (e) {
    console.warn('Could not load saved state', e);
  }

  HOUSES.forEach(h => {
    if (state.scores[h.id] === undefined) state.scores[h.id] = 0;
    if (state.firstCorrectClaimed[h.id] === undefined) state.firstCorrectClaimed[h.id] = false;
    if (!state.seatCorrects[h.id]) {
      state.seatCorrects[h.id] = {};
      for (let i = 1; i <= state.seatsPerHouse; i++) state.seatCorrects[h.id][i] = 0;
    }
    state.active[h.id] = true;
  });
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      scores: state.scores,
      firstCorrectClaimed: state.firstCorrectClaimed,
      seatCorrects: state.seatCorrects,
      seatsPerHouse: state.seatsPerHouse,
      displayOrder: state.displayOrder
    }));
  } catch (e) {
    console.warn('Could not save state', e);
  }
}

function resetGame() {
  if (!confirm('Are you sure you want to reset the entire game? All scores will be lost.')) return;

  HOUSES.forEach(h => {
    state.scores[h.id] = 0;
    state.firstCorrectClaimed[h.id] = false;
    state.seatCorrects[h.id] = {};
    for (let i = 1; i <= state.seatsPerHouse; i++) state.seatCorrects[h.id][i] = 0;
  });
  state.displayOrder = {};

  localStorage.removeItem(STORAGE_KEY);
  saveState();
  renderScoreboard();
}

/* ============================================================
   DOM
   ============================================================ */
const scoreboardEl    = document.getElementById('scoreboard');
const togglesEl       = document.getElementById('house-toggles');
const modalEl         = document.getElementById('modal');
const leaderboardEl   = document.getElementById('leaderboard-list');
const scoresBtn       = document.getElementById('scores-btn');
const closeModalBtn   = document.getElementById('close-modal');
const resetBtn        = document.getElementById('reset-btn');

const quizoutModal    = document.getElementById('quizout-modal');
const quizoutMessage  = document.getElementById('quizout-message');
const quizoutOk       = document.getElementById('quizout-ok');

const tbModal         = document.getElementById('tiebreaker-modal');
const tbHousesEl      = document.getElementById('tb-houses');
const tbQuestionLabel = document.getElementById('tb-question-label');
const tbScoresEl      = document.getElementById('tb-scores');
const closeTbBtn      = document.getElementById('close-tiebreaker');

const settingsBtn     = document.getElementById('settings-btn');
const settingsModal   = document.getElementById('settings-modal');
const closeSettings   = document.getElementById('close-settings');
const seatsSelect     = document.getElementById('seats-select');
const saveSettingsBtn = document.getElementById('save-settings');

const timerBtn        = document.getElementById('timer-btn');
const timerDisplay    = document.getElementById('timer-display');
const timer5Btn       = document.getElementById('timer5-btn');
const timer5Display   = document.getElementById('timer5-display');

/* ============================================================
   SOUND
   ============================================================ */
function playBeep({ frequency = 880, duration = 0.15, type = 'sine', volume = 0.3 } = {}) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function playStartSound()  { playBeep({ frequency: 1046, duration: 0.12, type: 'sine', volume: 0.35 }); }
function playTimeoutSound() {
  playBeep({ frequency: 440, duration: 0.25, type: 'square', volume: 0.4 });
  setTimeout(() => playBeep({ frequency: 330, duration: 0.4, type: 'square', volume: 0.4 }), 280);
}
function playCongratsSound() {
  [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
    setTimeout(() => playBeep({ frequency: freq, duration: 0.22, type: 'sine', volume: 0.28 }), i * 140);
  });
}

/* ============================================================
   TIMER
   ============================================================ */
let timerInterval = null, timer5Interval = null;
let remaining = 25, remaining5 = 5;
const TIMER_DURATION = 25, TIMER5_DURATION = 5;

function updateTimerDisplay()  { timerDisplay.textContent = remaining; }
function updateTimer5Display() { timer5Display.textContent = remaining5; }

function stopTimer(reset = true) {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  timerBtn.classList.remove('timer-running', 'bg-amber-600', 'text-white', 'border-amber-300');
  timerBtn.classList.add('bg-slate-700', 'text-amber-300', 'border-amber-500/60');
  if (reset) { remaining = TIMER_DURATION; updateTimerDisplay(); }
}

function stopTimer5(reset = true) {
  if (timer5Interval) { clearInterval(timer5Interval); timer5Interval = null; }
  timer5Btn.classList.remove('timer-running', 'bg-sky-600', 'text-white', 'border-sky-300');
  timer5Btn.classList.add('bg-slate-700', 'text-sky-300', 'border-sky-500/60');
  if (reset) { remaining5 = TIMER5_DURATION; updateTimer5Display(); }
}

function startTimer() {
  if (timerInterval) { stopTimer(true); return; }
  stopTimer5(true);
  remaining = TIMER_DURATION;
  updateTimerDisplay();
  playStartSound();
  timerBtn.classList.add('timer-running', 'bg-amber-600', 'text-white', 'border-amber-300');
  timerBtn.classList.remove('bg-slate-700', 'text-amber-300', 'border-amber-500/60');

  timerInterval = setInterval(() => {
    remaining--;
    updateTimerDisplay();
    if (remaining <= 0) {
      stopTimer(false);
      playTimeoutSound();
      timerDisplay.textContent = '0';
      setTimeout(() => { remaining = TIMER_DURATION; updateTimerDisplay(); }, 800);
    }
  }, 1000);
}

function startTimer5() {
  if (timer5Interval) { stopTimer5(true); return; }
  stopTimer(true);
  remaining5 = TIMER5_DURATION;
  updateTimer5Display();
  playStartSound();
  timer5Btn.classList.add('timer-running', 'bg-sky-600', 'text-white', 'border-sky-300');
  timer5Btn.classList.remove('bg-slate-700', 'text-sky-300', 'border-sky-500/60');

  timer5Interval = setInterval(() => {
    remaining5--;
    updateTimer5Display();
    if (remaining5 <= 0) {
      stopTimer5(false);
      playTimeoutSound();
      timer5Display.textContent = '0';
      setTimeout(() => { remaining5 = TIMER5_DURATION; updateTimer5Display(); startTimer(); }, 600);
    }
  }, 1000);
}

timerBtn.addEventListener('click', startTimer);
timer5Btn.addEventListener('click', startTimer5);

/* ============================================================
   RENDER TOGGLES
   ============================================================ */
function renderToggles() {
  togglesEl.innerHTML = '';
  HOUSES.forEach(h => {
    const label = document.createElement('label');
    label.className = 'flex items-center gap-2 cursor-pointer select-none';
    label.innerHTML = `
      <input type="checkbox" data-house="${h.id}" class="w-5 h-5 rounded accent-emerald-500" ${state.active[h.id] ? 'checked' : ''}>
      <span class="font-medium">${h.name}</span>
    `;
    togglesEl.appendChild(label);
  });

  togglesEl.querySelectorAll('input').forEach(cb => {
    cb.addEventListener('change', e => {
      state.active[e.target.dataset.house] = e.target.checked;
      renderScoreboard();
    });
  });
}

/* ============================================================
   RENDER SCOREBOARD
   ============================================================ */
function renderScoreboard() {
  const activeHouses = HOUSES.filter(h => state.active[h.id]);
  scoreboardEl.innerHTML = '';

  if (activeHouses.length === 0) {
    scoreboardEl.innerHTML = `<div class="flex-1 flex items-center justify-center text-slate-400 text-xl">Select at least one house above</div>`;
    return;
  }

  activeHouses.forEach(h => {
    const col = document.createElement('div');
    col.className = `flex-1 min-w-[210px] max-w-sm mx-auto ${h.bg} ${h.text} rounded-2xl shadow-xl flex flex-col overflow-hidden`;
    col.dataset.house = h.id;

    let answerRows = '';
    for (let i = 1; i <= state.seatsPerHouse; i++) {
      answerRows += `
        <div class="answer-row">
          <span class="answer-label">${h.prefix}${i}</span>
          <div class="answer-btns">
            <button class="btn-correct" data-house="${h.id}" data-seat="${i}" data-action="correct">Correct</button>
            <button class="btn-incorrect" data-house="${h.id}" data-seat="${i}" data-action="incorrect">Incorrect</button>
          </div>
        </div>`;
    }

    col.innerHTML = `
      <div class="${h.headerBg} py-3 text-center font-bold text-lg tracking-wide shadow-inner">${h.name}</div>
      <div class="flex items-center justify-center pt-6 pb-2">
        <div id="score-${h.id}" class="digital-score text-6xl sm:text-7xl md:text-8xl ${h.scoreBg} ${h.scoreText} px-6 py-3 rounded-2xl shadow-inner min-w-[3.8ch] text-center">
          ${state.scores[h.id]}
        </div>
      </div>
      <div class="answer-list">${answerRows}</div>
    `;
    scoreboardEl.appendChild(col);
  });

  scoreboardEl.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      handleScore(btn.dataset.house, parseInt(btn.dataset.seat, 10), btn.dataset.action);
    });
  });
}

/* ============================================================
   SCORING + QUIZ OUT
   ============================================================ */
function handleScore(houseId, seat, action) {
  let delta = 0;

  if (action === 'correct') {
    if (!state.firstCorrectClaimed[houseId]) {
      delta = 20;
      state.firstCorrectClaimed[houseId] = true;
    } else {
      delta = 10;
    }
    state.seatCorrects[houseId][seat] = (state.seatCorrects[houseId][seat] || 0) + 1;
    if (state.seatCorrects[houseId][seat] >= 4) showQuizOut(houseId, seat);
  } else {
    delta = -10;
  }

  state.scores[houseId] += delta;
  saveState();

  const el = document.getElementById(`score-${houseId}`);
  if (el) {
    el.textContent = state.scores[houseId];
    el.classList.remove('score-pop');
    void el.offsetWidth;
    el.classList.add('score-pop');
  }
}

function showQuizOut(houseId, seat) {
  const house = HOUSES.find(h => h.id === houseId);
  quizoutMessage.textContent = `Congratulations! Seat ${house.prefix}${seat} has QUIZED OUT!`;
  quizoutModal.classList.remove('hidden');
  quizoutModal.classList.add('flex');
  playCongratsSound();

  const onOk = () => {
    state.seatCorrects[houseId][seat] = 0;
    saveState();
    quizoutModal.classList.add('hidden');
    quizoutModal.classList.remove('flex');
    quizoutOk.removeEventListener('click', onOk);
  };
  quizoutOk.addEventListener('click', onOk);
}

/* ============================================================
   LEADERBOARD + TIEBREAKER
   ============================================================ */
let tbState = null;

function showLeaderboard() {
  // Sort: higher score first, then lower displayOrder (better rank)
  const ranked = HOUSES
    .filter(h => state.active[h.id])
    .map(h => ({
      ...h,
      score: state.scores[h.id],
      order: state.displayOrder[h.id] ?? 9999
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.order - b.order;
    });

  const medals = ['🥇', '🥈', '🥉', '4️⃣'];

  // Group by score to detect remaining ties
  const groups = [];
  let i = 0;
  while (i < ranked.length) {
    const score = ranked[i].score;
    const group = ranked.filter(h => h.score === score);
    groups.push(group);
    i += group.length;
  }

  let html = '';
  let place = 0;

  groups.forEach(group => {
    // Only show Tiebreaker button if the group is still unresolved
    // (they all have the same displayOrder or no order yet)
    const orders = group.map(h => state.displayOrder[h.id] ?? 9999);
    const stillTied = group.length > 1 && new Set(orders).size === 1;

    group.forEach((h, idx) => {
      const medal = medals[place] || (place + 1);
      html += `
        <div class="flex items-center justify-between p-3 rounded-xl
                    ${place === 0 && !stillTied ? 'bg-amber-100 border-2 border-amber-400' : 'bg-slate-100'}">
          <div class="flex items-center gap-3">
            <span class="text-2xl">${medal}</span>
            <span class="font-semibold text-lg">${h.name}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="font-bold text-xl tabular-nums">${h.score}</span>
            ${stillTied && idx === 0 ? `
              <button class="tb-btn" data-tied='${JSON.stringify(group.map(g => g.id))}'>
                Tiebreaker
              </button>
            ` : ''}
          </div>
        </div>`;
    });
    place += group.length;
  });

  leaderboardEl.innerHTML = html || '<p class="text-center text-slate-500">No houses selected</p>';

  leaderboardEl.querySelectorAll('.tb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      startTiebreaker(JSON.parse(btn.dataset.tied));
    });
  });

  modalEl.classList.remove('hidden');
  modalEl.classList.add('flex');
}

function hideModal() {
  modalEl.classList.add('hidden');
  modalEl.classList.remove('flex');
}

/* ============================================================
   TIEBREAKER (Correct +10 / Incorrect -10)
   ============================================================ */
function startTiebreaker(tiedIds) {
  tbState = {
    houses: tiedIds.map(id => HOUSES.find(h => h.id === id)),
    points: {},
    question: 1
  };
  tiedIds.forEach(id => tbState.points[id] = 0);

  hideModal();
  renderTiebreaker();
  tbModal.classList.remove('hidden');
  tbModal.classList.add('flex');
}

function renderTiebreaker() {
  tbQuestionLabel.textContent = `Question ${tbState.question} of 3`;

  tbHousesEl.innerHTML = tbState.houses.map(h => `
    <div class="flex items-center justify-between p-3 rounded-xl bg-slate-100 gap-3">
      <span class="font-semibold text-lg">${h.name}</span>
      <div class="flex gap-2">
        <button class="btn-correct tb-action" data-house="${h.id}" data-pts="10">Correct</button>
        <button class="btn-incorrect tb-action" data-house="${h.id}" data-pts="-10">Incorrect</button>
      </div>
    </div>
  `).join('');

  tbScoresEl.innerHTML = tbState.houses.map(h =>
    `${h.name}: <strong>${tbState.points[h.id]}</strong>`
  ).join(' &nbsp;|&nbsp; ');

  tbHousesEl.querySelectorAll('.tb-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const houseId = btn.dataset.house;
      const pts = parseInt(btn.dataset.pts, 10);
      tbState.points[houseId] += pts;

      if (tbState.question >= 3) {
        finishTiebreaker();
      } else {
        tbState.question++;
        renderTiebreaker();
      }
    });
  });
}

function finishTiebreaker() {
  // Sort the tied houses by their temporary tiebreaker points
  const sorted = [...tbState.houses].sort((a, b) => {
    return tbState.points[b.id] - tbState.points[a.id];
  });

  // Assign sequential displayOrder so the winner gets the higher position
  // Lower number = better place
  sorted.forEach((h, idx) => {
    state.displayOrder[h.id] = idx;
  });

  saveState();          // persist the new ranking order

  tbModal.classList.add('hidden');
  tbModal.classList.remove('flex');
  tbState = null;

  // Refresh the leaderboard – button is now gone and positions are updated
  showLeaderboard();
}

/* ============================================================
   SETTINGS
   ============================================================ */
function openSettings() {
  seatsSelect.value = state.seatsPerHouse;
  settingsModal.classList.remove('hidden');
  settingsModal.classList.add('flex');
}

function closeSettingsModal() {
  settingsModal.classList.add('hidden');
  settingsModal.classList.remove('flex');
}

function saveSettings() {
  const newSeats = parseInt(seatsSelect.value, 10);
  if (newSeats === state.seatsPerHouse) {
    closeSettingsModal();
    return;
  }

  if (!confirm(`Changing seats to ${newSeats} will reset all scores. Continue?`)) return;

  state.seatsPerHouse = newSeats;
  HOUSES.forEach(h => {
    state.scores[h.id] = 0;
    state.firstCorrectClaimed[h.id] = false;
    state.seatCorrects[h.id] = {};
    for (let i = 1; i <= newSeats; i++) state.seatCorrects[h.id][i] = 0;
  });
  state.displayOrder = {};

  saveState();
  renderScoreboard();
  closeSettingsModal();
}

/* ============================================================
   EVENT LISTENERS
   ============================================================ */
scoresBtn.addEventListener('click', showLeaderboard);
closeModalBtn.addEventListener('click', hideModal);
resetBtn.addEventListener('click', resetGame);
closeTbBtn.addEventListener('click', () => {
  tbModal.classList.add('hidden');
  tbModal.classList.remove('flex');
  tbState = null;
});

settingsBtn.addEventListener('click', openSettings);
closeSettings.addEventListener('click', closeSettingsModal);
saveSettingsBtn.addEventListener('click', saveSettings);

modalEl.addEventListener('click', e => { if (e.target === modalEl) hideModal(); });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    hideModal();
    quizoutModal.classList.add('hidden');
    quizoutModal.classList.remove('flex');
    tbModal.classList.add('hidden');
    tbModal.classList.remove('flex');
    closeSettingsModal();
  }
});

/* ============================================================
   INIT
   ============================================================ */
loadState();
renderToggles();
renderScoreboard();