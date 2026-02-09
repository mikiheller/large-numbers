/**
 * App: mode switch (Sandbox / Quests), mute, init.
 */

(function () {
  const sandboxPanel = document.getElementById('sandbox');
  const questsPanel = document.getElementById('quests');
  const modeBtns = document.querySelectorAll('.mode-btn');
  const muteBtn = document.querySelector('.mute-btn');

  function setMode(mode) {
    sandboxPanel.classList.toggle('active', mode === 'sandbox');
    questsPanel.classList.toggle('active', mode === 'quests');
    modeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  muteBtn.addEventListener('click', () => {
    setMuted(!isMuted());
    muteBtn.classList.toggle('muted', isMuted());
    muteBtn.textContent = isMuted() ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-label', isMuted() ? 'Unmute' : 'Mute sound');
  });

  setMode('sandbox');
  sandbox.init();
  quests.init();
})();
