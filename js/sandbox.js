/**
 * Sandbox mode: bins, +/–, total display, zoom slider, jump buttons, celebrations.
 */

(function () {
  const model = createModel();
  const MILESTONES = [
    { value: 1000, label: 'THOUSANDS!', icon: '🧊' },
    { value: 10000, label: 'TEN THOUSANDS!', icon: '📦' },
    { value: 100000, label: 'HUNDRED THOUSANDS!', icon: '🛒' },
    { value: 1000000, label: 'You made a MILLION!', icon: '🏰' },
  ];
  let selectedUnitKey = null;
  let lastTotalForCelebration = 0;
  let reachedMilestones = new Set();

  const el = {
    totalDisplay: document.getElementById('total-display'),
    binsRow: document.getElementById('bins-row'),
    selectedUnitLabel: document.getElementById('selected-unit-label'),
    btnPlus: document.getElementById('btn-plus'),
    btnMinus: document.getElementById('btn-minus'),
    zoomSlider: document.getElementById('zoom-slider'),
    celebration: document.getElementById('celebration'),
  };

  function renderTotal() {
    const total = model.computeTotal();
    el.totalDisplay.textContent = total.toLocaleString('en-US');
    checkMilestone(total);
  }

  function checkMilestone(total) {
    for (const m of MILESTONES) {
      if (total >= m.value && !reachedMilestones.has(m.value)) {
        reachedMilestones.add(m.value);
        showCelebration(m.label, m.icon);
        playCelebrationSound();
        break;
      }
    }
    lastTotalForCelebration = total;
  }

  function showCelebration(text, icon) {
    el.celebration.classList.remove('hidden');
    el.celebration.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'celebration-inner';
    inner.innerHTML = `<span style="font-size:3rem">${icon}</span><br/>${text}`;
    el.celebration.appendChild(inner);
    // Confetti-like dots
    for (let i = 0; i < 20; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + '%';
      c.style.top = '10%';
      c.style.background = ['#c45c26', '#2e7d32', '#4A90D9', '#E65100'][i % 4];
      c.style.animationDelay = Math.random() * 0.5 + 's';
      el.celebration.appendChild(c);
    }
    const dismiss = () => {
      el.celebration.classList.add('hidden');
      el.celebration.innerHTML = '';
      el.celebration.removeEventListener('click', dismiss);
    };
    setTimeout(() => el.celebration.addEventListener('click', dismiss), 500);
    setTimeout(dismiss, 3500);
  }

  function renderBins() {
    const counts = model.getCounts();
    el.binsRow.innerHTML = '';
    model.UNITS.forEach(u => {
      const bin = document.createElement('button');
      bin.type = 'button';
      bin.className = 'bin' + (selectedUnitKey === u.key ? ' selected' : '');
      bin.dataset.unit = u.key;
      bin.setAttribute('aria-label', `${u.name} bin, ${counts[u.key]} ${u.name}s`);
      bin.innerHTML = `
        <span class="bin-icon" style="color:${u.color}">${u.icon}</span>
        <span class="bin-count">${counts[u.key]}</span>
        <span class="bin-label">×${u.value}</span>
      `;
      bin.addEventListener('click', () => selectBin(u.key));
      el.binsRow.appendChild(bin);
    });
  }

  function selectBin(unitKey) {
    selectedUnitKey = unitKey;
    const u = model.UNITS.find(x => x.key === unitKey);
    el.selectedUnitLabel.textContent = u ? u.name : 'Pick a bin';
    renderBins();
  }

  function updateFromModel() {
    renderTotal();
    renderBins();
    const total = model.computeTotal();
    const logTotal = total === 0 ? 0 : Math.max(1, Math.log10(total));
    const maxLog = 6;
    el.zoomSlider.value = Math.min(1000000, total);
  }

  function onAdd() {
    if (!selectedUnitKey) return;
    const before = model.getCounts();
    model.add(selectedUnitKey);
    const after = model.getCounts();
    const traded = model.UNITS.some(u => after[u.key] < before[u.key] && u.key !== selectedUnitKey);
    if (traded) playTradeUpSound();
    else playAddSound();
    updateFromModel();
  }

  function onSubtract() {
    if (!selectedUnitKey) return;
    const before = model.getCounts();
    const hadBorrow = model.getCounts()[selectedUnitKey] === 0 && model.computeTotal() > 0;
    model.subtract(selectedUnitKey);
    if (hadBorrow) playBreakDownSound();
    else playAddSound();
    updateFromModel();
  }

  function onSliderInput() {
    const v = Number(el.zoomSlider.value);
    model.setTotal(v);
    updateFromModel();
  }

  function onJump(value) {
    const n = Number(value);
    model.setTotal(n);
    el.zoomSlider.value = n;
    updateFromModel();
    checkMilestone(model.computeTotal());
  }

  function onTotalTap() {
    const total = model.computeTotal();
    speak(formatNumberForSpeech(total));
  }

  function wire() {
    model.UNITS.forEach(u => {
      const bin = el.binsRow.querySelector(`[data-unit="${u.key}"]`);
      if (bin) bin.addEventListener('click', () => selectBin(u.key));
    });
    el.btnPlus.addEventListener('click', onAdd);
    el.btnMinus.addEventListener('click', onSubtract);
    el.zoomSlider.addEventListener('input', onSliderInput);
    el.totalDisplay.addEventListener('click', onTotalTap);
    document.querySelectorAll('.jump-btn').forEach(btn => {
      btn.addEventListener('click', () => onJump(btn.dataset.value));
    });
  }

  function init() {
    wire();
    updateFromModel();
  }

  window.sandbox = {
    init,
    getModel: () => model,
    updateFromModel,
    resetMilestones: () => { reachedMilestones.clear(); },
  };
})();
