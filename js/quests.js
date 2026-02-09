/**
 * Quests: Build it, Biggest with N pieces, Which is bigger? + 15 levels.
 */

(function () {
  const model = createModel();
  const QUEST_LEVELS = [
    { type: 'build', target: 30 },
    { type: 'build', target: 120 },
    { type: 'build', target: 500 },
    { type: 'build', target: 1000 },
    { type: 'compare', left: 900, right: 1000 },
    { type: 'build', target: 2000 },
    { type: 'build', target: 10000 },
    { type: 'compare', left: 9000, right: 10000 },
    { type: 'biggest', pieces: 3 },
    { type: 'build', target: 20000 },
    { type: 'build', target: 100000 },
    { type: 'compare', left: 99000, right: 100000 },
    { type: 'biggest', pieces: 5 },
    { type: 'build', target: 1000000 },
    { type: 'build', target: 1000000, hint: 'Try 10 Chests (100K each)!' },
  ];

  let currentLevel = 0;
  let stars = [];
  let compareChosen = null;
  let biggestPiecesUsed = 0;
  let biggestCounts = {};

  const el = {
    questProgress: document.getElementById('quest-progress'),
    questStars: document.getElementById('quest-stars'),
    questPrompt: document.getElementById('quest-prompt'),
    questArea: document.getElementById('quest-area'),
    questFeedback: document.getElementById('quest-feedback'),
    questFeedbackText: document.getElementById('quest-feedback-text'),
    questNextBtn: document.getElementById('quest-next-btn'),
    questCelebration: document.getElementById('quest-celebration'),
  };

  function getLevel() {
    return QUEST_LEVELS[currentLevel] || null;
  }

  function speakPrompt(text) {
    speak(text);
  }

  function renderStars() {
    el.questStars.innerHTML = QUEST_LEVELS.map((_, i) =>
      `<span class="star ${stars[i] ? 'earned' : ''}" aria-hidden="true">⭐</span>`
    ).join('');
  }

  function setTotalAndRender(n) {
    model.setTotal(n);
    renderQuestArea();
  }

  function renderQuestArea() {
    const level = getLevel();
    if (!level) return;

    el.questArea.innerHTML = '';

    if (level.type === 'build') {
      renderBuildQuest();
    } else if (level.type === 'compare') {
      renderCompareQuest();
    } else if (level.type === 'biggest') {
      renderBiggestQuest();
    }
  }

  function renderBuildQuest() {
    const level = getLevel();
    const counts = model.getCounts();

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexWrap = 'wrap';
    wrap.style.justifyContent = 'center';
    wrap.style.gap = '12px';
    model.UNITS.forEach(u => {
      const cell = document.createElement('div');
      cell.style.textAlign = 'center';
      cell.innerHTML = `
        <div class="bin" style="margin:0 auto 6px;pointer-events:none">
          <span class="bin-icon" style="color:${u.color}">${u.icon}</span>
          <span class="bin-count">${counts[u.key]}</span>
        </div>
        <div style="display:flex;justify-content:center;gap:4px">
          <button type="button" class="big-btn minus" style="width:44px;height:44px;font-size:1.4rem" data-unit="${u.key}" aria-label="Remove ${u.name}">−</button>
          <button type="button" class="big-btn plus" style="width:44px;height:44px;font-size:1.4rem" data-unit="${u.key}" aria-label="Add ${u.name}">+</button>
        </div>
      `;
      const countEl = cell.querySelector('.bin-count');
      cell.querySelector('.plus').addEventListener('click', () => {
        model.add(u.key);
        countEl.textContent = model.getCounts()[u.key];
        updateBuildTotalLine();
        checkBuildSuccess();
      });
      cell.querySelector('.minus').addEventListener('click', () => {
        model.subtract(u.key);
        countEl.textContent = model.getCounts()[u.key];
        updateBuildTotalLine();
        checkBuildSuccess();
      });
      wrap.appendChild(cell);
    });
    el.questArea.appendChild(wrap);

    const totalLine = document.createElement('p');
    totalLine.className = 'quest-total-line';
    totalLine.style.textAlign = 'center';
    totalLine.style.fontSize = '1.4rem';
    totalLine.style.fontWeight = '700';
    totalLine.style.marginTop = '12px';
    totalLine.textContent = `Total: ${model.computeTotal().toLocaleString()}`;
    el.questArea.appendChild(totalLine);

    if (level.hint) {
      const hint = document.createElement('p');
      hint.className = 'quest-hint';
      hint.style.textAlign = 'center';
      hint.style.color = '#666';
      hint.style.marginTop = '8px';
      hint.textContent = level.hint;
      el.questArea.appendChild(hint);
    }
  }

  function updateBuildTotalLine() {
    const line = el.questArea.querySelector('.quest-total-line');
    if (line) line.textContent = `Total: ${model.computeTotal().toLocaleString()}`;
  }

  function checkBuildSuccess() {
    const level = getLevel();
    if (level.type !== 'build') return;
    if (model.computeTotal() === level.target) {
      stars[currentLevel] = true;
      playSuccessSound();
      speak(`Nice! That's ${level.target.toLocaleString()}.`);
      el.questFeedbackText.textContent = `Nice! That's ${level.target.toLocaleString()}.`;
      el.questFeedback.classList.remove('hidden');
    }
  }

  function renderCompareQuest() {
    const level = getLevel();
    compareChosen = null;
    const left = level.left;
    const right = level.right;

    const container = document.createElement('div');
    container.className = 'compare-piles';
    const leftPile = document.createElement('button');
    leftPile.type = 'button';
    leftPile.className = 'compare-pile';
    leftPile.innerHTML = `
      <div class="pile-total">${left.toLocaleString()}</div>
      <div class="pile-blocks">(blocks)</div>
    `;
    const rightPile = document.createElement('button');
    rightPile.type = 'button';
    rightPile.className = 'compare-pile';
    rightPile.innerHTML = `
      <div class="pile-total">${right.toLocaleString()}</div>
      <div class="pile-blocks">(blocks)</div>
    `;

    const correctSide = right > left ? 'right' : 'left';
    function choose(side) {
      if (compareChosen !== null) return;
      compareChosen = side;
      const correct = (side === 'right' && right > left) || (side === 'left' && left > right);
      if (correct) {
        leftPile.classList.toggle('correct', left >= right);
        rightPile.classList.toggle('correct', right >= left);
        leftPile.classList.toggle('wrong', left < right);
        rightPile.classList.toggle('wrong', right < left);
        stars[currentLevel] = true;
        playSuccessSound();
        speak(`Yes! ${Math.max(left, right).toLocaleString()} is bigger.`);
        el.questFeedbackText.textContent = `Yes! ${Math.max(left, right).toLocaleString()} is bigger.`;
        el.questFeedback.classList.remove('hidden');
      } else {
        speak('Try again. Which number is bigger?');
      }
    }
    leftPile.addEventListener('click', () => choose('left'));
    rightPile.addEventListener('click', () => choose('right'));

    container.appendChild(leftPile);
    container.appendChild(rightPile);
    el.questArea.appendChild(container);
  }

  function renderBiggestQuest() {
    const level = getLevel();
    biggestPiecesUsed = 0;
    biggestCounts = {};
    model.UNITS.forEach(u => { biggestCounts[u.key] = 0; });

    function computeBiggestTotal() {
      return model.UNITS.reduce((sum, u) => sum + biggestCounts[u.key] * u.value, 0);
    }

    const piecesLine = document.createElement('p');
    piecesLine.className = 'pieces-remaining';
    piecesLine.textContent = `Pieces left: ${level.pieces}`;
    el.questArea.appendChild(piecesLine);

    const totalLine = document.createElement('p');
    totalLine.style.textAlign = 'center';
    totalLine.style.fontSize = '1.4rem';
    totalLine.style.fontWeight = '700';
    totalLine.style.marginTop = '12px';
    totalLine.textContent = 'Total: 0';
    el.questArea.appendChild(totalLine);

    const wrap = document.createElement('div');
    wrap.className = 'quest-jump-buttons';
    model.UNITS.forEach(u => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'jump-btn';
      btn.textContent = `Add ${u.icon} ${u.name}`;
      btn.dataset.unit = u.key;
      btn.addEventListener('click', () => {
        if (biggestPiecesUsed >= level.pieces) return;
        biggestCounts[u.key]++;
        biggestPiecesUsed++;
        piecesLine.textContent = `Pieces left: ${level.pieces - biggestPiecesUsed}`;
        totalLine.textContent = `Total: ${computeBiggestTotal().toLocaleString()}`;
        if (biggestPiecesUsed >= level.pieces) {
          stars[currentLevel] = true;
          playSuccessSound();
          const total = computeBiggestTotal();
          speak(`You made ${total.toLocaleString()}!`);
          el.questFeedbackText.textContent = `You made ${total.toLocaleString()}! Great job.`;
          el.questFeedback.classList.remove('hidden');
        }
      });
      wrap.appendChild(btn);
    });
    el.questArea.appendChild(wrap);
  }

  function showPrompt(level) {
    if (level.type === 'build') {
      const text = `Build ${level.target.toLocaleString()}.`;
      el.questPrompt.textContent = text;
      speakPrompt(text);
    } else if (level.type === 'compare') {
      const text = 'Which is bigger?';
      el.questPrompt.textContent = text;
      speakPrompt(text);
    } else if (level.type === 'biggest') {
      const text = `You can place ${level.pieces} blocks total. Make the biggest number you can!`;
      el.questPrompt.textContent = text;
      speakPrompt(text);
    }
  }

  function startLevel() {
    const level = getLevel();
    if (!level) return;
    el.questFeedback.classList.add('hidden');
    el.questProgress.textContent = `${currentLevel + 1} / ${QUEST_LEVELS.length}`;
    renderStars();
    if (level.type === 'build') model.setTotal(0);
    showPrompt(level);
    renderQuestArea();
  }

  function nextQuest() {
    currentLevel++;
    if (currentLevel >= QUEST_LEVELS.length) {
      currentLevel = 0;
    }
    startLevel();
  }

  el.questNextBtn.addEventListener('click', nextQuest);

  function init() {
    stars = QUEST_LEVELS.map(() => false);
    currentLevel = 0;
    startLevel();
  }

  window.quests = {
    init,
    startLevel,
  };
})();
