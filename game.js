(function () {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const PLAYER_SPEED = 280;
  const PLAYER_SIZE = 14;
  const PICKUP_BASE_RADIUS = 20;
  const SHIP_ZONE = { x: W / 2 - 70, y: H - 90, w: 140, h: 70 };
  const PLAYER_START = { x: W / 2, y: H - 110 };

  const DENOMINATIONS = [1, 10, 100, 1000, 10000, 100000];

  // Ghost enemy
  const GHOST_SPEED = 160;
  const GHOST_SIZE = 22;
  const GHOST_HIT_COOLDOWN = 1.5; // seconds of invincibility after being hit

  // Ghost variants — each has an image and a music track
  const GHOST_NAMES = ['echo', 'j3vu', 'daisy09', 'tiptoe', 'pbbv'];
  const ghostVariants = GHOST_NAMES.map(name => {
    const img = new Image();
    img.src = name + '.webp';
    const music = new Audio(name + '.mp3');
    music.loop = true;
    music.volume = 0.4;
    return { name, img, music };
  });
  let currentGhostVariant = null;
  let lastGhostName = null; // prevent same ghost twice in a row

  let ghost = null; // { x, y, vx, vy, wobblePhase }
  let ghostHitCooldown = 0; // countdown timer

  // Generate a random target for each mission
  function generateTarget(missionNum) {
    if (missionNum === 1) {
      // First mission: start around 200-500
      return Math.floor(Math.random() * 300) + 200;
    }
    // Each subsequent mission: previous target * (2.5 to 4.0)
    const multiplier = 2.5 + Math.random() * 1.5;
    const raw = Math.round(lastTarget * multiplier);
    return raw;
  }

  let missionIndex = 0;
  let lastTarget = 0;
  let target = 0;
  let fuel = 0; // Collected fuel total
  let player = { x: PLAYER_START.x, y: PLAYER_START.y, angle: 0 };
  let pickups = [];
  let keys = {};
  let canLaunch = false;
  let launchPressed = false;
  let missionCompleteUntil = 0;
  let particles = [];
  let collected = []; // Array of {value: number, id: number} - ALL collected items
  let missionState = 'intro'; // 'intro', 'playing'
  let quizAnswer = '';
  let quizHint = '';
  let landingMessage = '';

  const missionLabelEl = document.getElementById('missionLabel');
  const missionSubtitleEl = document.getElementById('missionSubtitle');
  const shipMsg = document.getElementById('shipMsg');
  const introOverlay = document.getElementById('introOverlay');
  const introMissionNum = document.getElementById('introMissionNum');
  const introNumber = document.getElementById('introNumber');
  const introInput = document.getElementById('introInput');
  const introHint = document.getElementById('introHint');
  const introEnter = document.querySelector('.intro-enter');
  const introHelpBtn = document.getElementById('introHelpBtn');
  const helpModal = document.getElementById('helpModal');
  const helpWords = document.getElementById('helpWords');
  const helpBoxes = document.getElementById('helpBoxes');
  const helpLabels = document.getElementById('helpLabels');
  const helpCheckBtn = document.getElementById('helpCheckBtn');
  const helpResult = document.getElementById('helpResult');

  // Big grouped chunks (thousands and above)
  const BIG_GROUPS = [
    { name: 'billions',  divisor: 1000000000 },
    { name: 'millions',  divisor: 1000000 },
    { name: 'thousands', divisor: 1000 },
  ];

  function getHelpSlots(n) {
    // Returns array of { name, answer, type:'big'|'small' }
    // Big fat boxes for thousands/millions/billions, small per-digit for hundreds/tens/ones
    const slots = [];
    let remaining = n;

    for (const g of BIG_GROUPS) {
      const val = Math.floor(remaining / g.divisor);
      remaining = remaining % g.divisor;
      if (val > 0) {
        slots.push({ name: g.name, answer: val.toString(), type: 'big' });
      }
    }

    // Now remaining is 0-999 — split into individual hundreds, tens, ones
    const h = Math.floor(remaining / 100);
    const t = Math.floor((remaining % 100) / 10);
    const o = remaining % 10;

    // Only show digits starting from the first non-zero, but always show ones
    let started = (slots.length === 0); // if no big groups, always show from hundreds
    if (h > 0 || started) { slots.push({ name: 'hundreds', answer: h.toString(), type: 'small' }); started = true; }
    if (t > 0 || started) { slots.push({ name: 'tens', answer: t.toString(), type: 'small' }); started = true; }
    slots.push({ name: 'ones', answer: o.toString(), type: 'small' });

    return slots;
  }

  function openHelpModal() {
    const slots = getHelpSlots(target);
    
    helpWords.textContent = numberToWords(target);
    helpBoxes.innerHTML = '';
    helpLabels.innerHTML = '';
    helpResult.textContent = '';
    
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.className = 'help-box';
      input.dataset.idx = i;
      input.dataset.answer = s.answer;
      input.placeholder = '?';

      if (s.type === 'big') {
        input.classList.add('help-box-fat');
        input.maxLength = 3;
      } else {
        input.classList.add('help-box-small');
        input.maxLength = 1;
      }

      // Auto-advance (skip comma separators)
      input.addEventListener('input', function () {
        input.classList.remove('correct', 'wrong');
        const maxLen = s.type === 'small' ? 1 : s.answer.length;
        if (input.value.length >= maxLen && i < slots.length - 1) {
          // Find next input element (skip commas)
          const allInputs = helpBoxes.querySelectorAll('.help-box');
          const myIdx = Array.from(allInputs).indexOf(input);
          if (myIdx >= 0 && myIdx < allInputs.length - 1) {
            allInputs[myIdx + 1].focus();
          }
        }
      });
      // Backspace on empty moves to previous box (skip commas)
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && input.value === '' && i > 0) {
          e.preventDefault();
          const allInputs = helpBoxes.querySelectorAll('.help-box');
          const myIdx = Array.from(allInputs).indexOf(input);
          if (myIdx > 0) {
            allInputs[myIdx - 1].focus();
          }
        }
      });
      helpBoxes.appendChild(input);
      
      // Label
      const label = document.createElement('div');
      label.className = 'help-label';
      if (s.type === 'big') {
        label.classList.add('help-label-fat');
      } else {
        label.classList.add('help-label-small');
      }
      label.textContent = s.name;
      helpLabels.appendChild(label);

      // Add comma separator after each big group (before the next slot)
      if (s.type === 'big' && i < slots.length - 1) {
        const commaBox = document.createElement('span');
        commaBox.className = 'help-comma';
        commaBox.textContent = ',';
        helpBoxes.appendChild(commaBox);

        const commaLabel = document.createElement('div');
        commaLabel.className = 'help-comma-label';
        helpLabels.appendChild(commaLabel);
      }
    }
    
    helpModal.hidden = false;
    helpBoxes.children[0].focus();
  }

  function checkHelpBoxes() {
    const boxes = helpBoxes.querySelectorAll('.help-box');
    let allCorrect = true;
    
    boxes.forEach(box => {
      const val = box.value.trim();
      if (val === box.dataset.answer) {
        box.classList.remove('wrong');
        box.classList.add('correct');
      } else {
        box.classList.remove('correct');
        box.classList.add('wrong');
        allCorrect = false;
      }
    });
    
    if (allCorrect) {
      helpResult.textContent = `That's right! It's ${formatNum(target)}`;
      // Auto-fill the main input and close after a moment
      setTimeout(() => {
        introInput.value = target.toString();
        helpModal.hidden = true;
        introInput.focus();
      }, 1500);
    }
  }

  introHelpBtn.addEventListener('click', openHelpModal);
  helpCheckBtn.addEventListener('click', checkHelpBoxes);

  // Allow Enter in help boxes to check
  document.addEventListener('keydown', function (e) {
    if (!helpModal.hidden && e.key === 'Enter') {
      e.preventDefault();
      checkHelpBoxes();
    }
  });

  // Return all denominations needed to represent any digit of the target
  function getDenomsForTarget(t) {
    const list = [];
    for (let d = 100000; d >= 1; d /= 10) {
      if (t >= d) list.push(d);
    }
    // Always include 1 so we can represent any number exactly
    if (!list.includes(1)) list.push(1);
    return list;
  }

  function spawnPickups() {
    pickups = [];
    const denoms = getDenomsForTarget(target);
    
    // Decompose target digit-by-digit into exact pickups needed
    // e.g. 23,512 -> 10000x2 + 1000x3 + 100x5 + 10x1 + 1x2
    const needed = [];
    let remaining = target;
    for (const d of denoms) {
      const digitCount = Math.floor(remaining / d);
      if (digitCount > 0) {
        needed.push({ value: d, count: digitCount });
        remaining -= digitCount * d;
      }
    }
    // Safety: if anything left, add as 1s
    if (remaining > 0) {
      const ones = needed.find(n => n.value === 1);
      if (ones) ones.count += remaining;
      else needed.push({ value: 1, count: remaining });
    }
    
    // If too few pickups, break some larger ones into smaller denominations
    let totalNeeded = needed.reduce((s, n) => s + n.count, 0);
    while (totalNeeded < 6) {
      // Find the largest denomination with count > 0 that can be broken down
      const breakable = needed.filter(n => n.value >= 10 && n.count > 0);
      if (breakable.length === 0) break;
      const big = breakable[0]; // largest first (denoms sorted desc)
      const smallerVal = big.value / 10;
      big.count--;
      const smaller = needed.find(n => n.value === smallerVal);
      if (smaller) smaller.count += 10;
      else needed.push({ value: smallerVal, count: 10 });
      totalNeeded = needed.reduce((s, n) => s + n.count, 0);
    }
    
    // Cap 1s at 9 max to avoid flooding the screen
    const onesEntry = needed.find(n => n.value === 1);
    if (onesEntry && onesEntry.count > 9) onesEntry.count = 9;
    
    const padding = 50;
    const safeTop = padding;
    const safeBottom = SHIP_ZONE.y - 40;
    const safeLeft = padding;
    const safeRight = PANEL_X - 20; // Leave room for collected pane
    const areaW = safeRight - safeLeft;
    const areaH = safeBottom - safeTop;
    const minGap = 20;

    // Helper to try placing a pickup
    function tryPlace(value, required) {
      let attempts = 0;
      let x, y;
      let placed = false;
      do {
        x = safeLeft + Math.random() * areaW;
        y = safeTop + Math.random() * areaH;
        attempts++;
        const ok = !pickups.some(p => {
          const r1 = pickupRadius(value);
          const r2 = pickupRadius(p.value);
          return dist(x, y, p.x, p.y) < r1 + r2 + minGap;
        });
        if (ok) { placed = true; break; }
      } while (attempts < 80);
      
      // Required pickups ALWAYS get placed (with reduced gap if needed)
      if (!placed && required) {
        attempts = 0;
        do {
          x = safeLeft + Math.random() * areaW;
          y = safeTop + Math.random() * areaH;
          attempts++;
          const ok = !pickups.some(p => {
            const r1 = pickupRadius(value);
            const r2 = pickupRadius(p.value);
            return dist(x, y, p.x, p.y) < r1 + r2; // no extra gap, just no full overlap
          });
          if (ok) { placed = true; break; }
        } while (attempts < 80);
        
        // Last resort: just place it somewhere
        if (!placed) placed = true;
      }
      
      if (placed) {
        pickups.push({ x, y, value, id: Math.random() });
      }
      return placed;
    }

    // 1) Spawn NEEDED pickups first — these are always placed
    for (const { value, count } of needed) {
      for (let i = 0; i < count; i++) {
        tryPlace(value, true);
      }
    }
    
    // 2) Spawn distractors — these are skippable
    const avgRadius = 28;
    const cellSize = (avgRadius * 2) + minGap;
    const maxPickups = Math.floor((areaW / cellSize) * (areaH / cellSize) * 0.7);
    const neededTotal = needed.reduce((s, n) => s + n.count, 0);
    const roomForExtras = Math.max(0, maxPickups - neededTotal);
    const desiredExtras = Math.min(roomForExtras, Math.max(3, Math.floor(neededTotal * 0.3)));
    
    for (let i = 0; i < desiredExtras; i++) {
      const d = denoms[Math.floor(Math.random() * denoms.length)];
      tryPlace(d, false);
    }
  }

  function pickGhostVariant() {
    // Pick a random ghost, but never the same one twice in a row
    const available = ghostVariants.filter(v => v.name !== lastGhostName);
    const pick = available[Math.floor(Math.random() * available.length)];
    lastGhostName = pick.name;
    return pick;
  }

  function spawnGhost() {
    // Stop any currently playing ghost music
    if (currentGhostVariant) {
      currentGhostVariant.music.pause();
    }

    // Pick a new random ghost variant
    currentGhostVariant = pickGhostVariant();

    // Spawn ghost at a random position, away from the player
    const padding = 60;
    const safeTop = padding;
    const safeBottom = SHIP_ZONE.y - 40;
    const safeLeft = padding;
    const safeRight = PANEL_X - 20;

    let x, y;
    let attempts = 0;
    do {
      x = safeLeft + Math.random() * (safeRight - safeLeft);
      y = safeTop + Math.random() * (safeBottom - safeTop);
      attempts++;
    } while (dist(x, y, player.x, player.y) < 150 && attempts < 50);

    // Random direction
    const angle = Math.random() * Math.PI * 2;
    ghost = {
      x: x,
      y: y,
      vx: Math.cos(angle) * GHOST_SPEED,
      vy: Math.sin(angle) * GHOST_SPEED,
      wobblePhase: Math.random() * Math.PI * 2,
    };
    ghostHitCooldown = 0;
  }

  function isInShipZone(x, y) {
    return x >= SHIP_ZONE.x && x <= SHIP_ZONE.x + SHIP_ZONE.w &&
           y >= SHIP_ZONE.y && y <= SHIP_ZONE.y + SHIP_ZONE.h;
  }

  function pickupRadius(value) {
    const log = Math.log10(Math.max(value, 1));
    return PICKUP_BASE_RADIUS + log * 6;
  }

  function dist(ax, ay, bx, by) {
    return Math.hypot(bx - ax, by - ay);
  }

  function startMission() {
    missionIndex++;
    target = generateTarget(missionIndex);
    lastTarget = target;
    fuel = 0;
    collected = [];
    player.x = PLAYER_START.x;
    player.y = PLAYER_START.y;
    player.angle = -Math.PI / 2;
    pickups = []; // Clear pickups - will spawn after quiz
    ghost = null;
    ghostHitCooldown = 0;
    if (currentGhostVariant) {
      currentGhostVariant.music.pause();
    }
    canLaunch = false;
    launchPressed = false;
    // Hide HUD text during intro (don't spoil the answer)
    missionLabelEl.style.visibility = 'hidden';
    missionSubtitleEl.style.visibility = 'hidden';
    shipMsg.hidden = true;
    document.getElementById('shipZoneLabel').style.visibility = 'hidden';
    missionState = 'intro';
    quizAnswer = '';
    quizHint = '';
    // Show HTML intro overlay
    introOverlay.hidden = false;
    introMissionNum.textContent = `Mission ${missionIndex}`;
    introNumber.textContent = numberToWords(target);
    introInput.value = '';
    introInput.classList.remove('wrong');
    introHelpBtn.classList.remove('glow');
    introHint.textContent = '';
    helpModal.hidden = true;
    setTimeout(() => introInput.focus(), 100);
  }

  function numberToWords(n) {
    if (n === 0) return 'zero';
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    
    function convertHundreds(num) {
      if (num === 0) return '';
      if (num < 20) return ones[num];
      if (num < 100) {
        const t = Math.floor(num / 10);
        const o = num % 10;
        return tens[t] + (o > 0 ? '-' + ones[o] : '');
      }
      const h = Math.floor(num / 100);
      const rem = num % 100;
      return ones[h] + ' hundred' + (rem > 0 ? ' ' + convertHundreds(rem) : '');
    }
    
    if (n < 1000) return convertHundreds(n);
    
    if (n < 1000000) {
      const th = Math.floor(n / 1000);
      const rem = n % 1000;
      return convertHundreds(th) + ' thousand' + (rem > 0 ? ' ' + convertHundreds(rem) : '');
    }
    
    const mil = Math.floor(n / 1000000);
    const rem = n % 1000000;
    return convertHundreds(mil) + ' million' + (rem > 0 ? ' ' + numberToWords(rem) : '');
  }

  function formatNum(n) {
    return n.toLocaleString();
  }
  
  function formatNumWithWords(n) {
    return formatNum(n) + ' (' + numberToWords(n) + ')';
  }

  function completeMission() {
    missionState = 'intro';
    startMission();
  }
  
  function checkQuizAnswer() {
    const cleaned = quizAnswer.replace(/[,\s]/g, '');
    const targetStr = target.toString();
    
    if (cleaned === targetStr) {
      // Correct! Hide intro, reveal HUD, start mission
      introOverlay.hidden = true;
      missionLabelEl.textContent = `Mission ${missionIndex}`;
      missionSubtitleEl.textContent = `Collect ${formatNum(target)} fuel`;
      missionLabelEl.style.visibility = '';
      missionSubtitleEl.style.visibility = '';
      document.getElementById('shipZoneLabel').style.visibility = '';
      missionState = 'playing';
      spawnPickups();
      spawnGhost();
      currentGhostVariant.music.currentTime = 0;
      currentGhostVariant.music.play().catch(() => {});
    } else {
      // Wrong - flash red and light up help button
      introInput.classList.add('wrong');
      introHelpBtn.classList.add('glow');
      setTimeout(() => introInput.classList.remove('wrong'), 800);
    }
  }

  // Auto-format intro input with commas as you type
  introInput.addEventListener('input', function () {
    // Strip non-digits, format with commas, preserve cursor position
    const raw = introInput.value.replace(/[^0-9]/g, '');
    if (raw === '') { introInput.value = ''; return; }
    const formatted = Number(raw).toLocaleString();
    // Figure out where cursor should go after reformatting
    const selEnd = introInput.selectionEnd;
    const commasBefore = (introInput.value.slice(0, selEnd).match(/,/g) || []).length;
    introInput.value = formatted;
    const commasAfter = (formatted.slice(0, selEnd).match(/,/g) || []).length;
    const newPos = selEnd + (commasAfter - commasBefore);
    introInput.setSelectionRange(newPos, newPos);
  });

  // Handle ENTER on intro input
  introInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      quizAnswer = introInput.value;
      checkQuizAnswer();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (missionState === 'intro') {
      return; // Let the HTML input handle it
    }
    
    const k = e.key.toLowerCase();
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) {
      e.preventDefault();
      keys[k] = true;
    }
    if ((e.key === ' ' || e.key === 'e') && canLaunch) {
      e.preventDefault();
      launchPressed = true;
    }
  });

  document.addEventListener('keyup', function (e) {
    const k = e.key.toLowerCase();
    keys[k] = false;
  });

  // Helper: group collected items by denomination
  function getCollectedGroups() {
    const groups = {};
    for (const item of collected) {
      groups[item.value] = (groups[item.value] || 0) + 1;
    }
    // Sort by denomination descending
    return Object.entries(groups)
      .map(([val, count]) => ({ value: Number(val), count }))
      .sort((a, b) => b.value - a.value);
  }

  const PANEL_W = 220;
  const PANEL_X = W - PANEL_W;

  // Mouse click handling for collected items minus buttons
  canvas.addEventListener('click', function (e) {
    if (missionState !== 'playing') return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const rowHeight = 44;
    const startY = 60;
    const groups = getCollectedGroups();
    
    if (x >= PANEL_X && x <= W) {
      for (let i = 0; i < groups.length; i++) {
        const rowY = startY + i * rowHeight;
        // Minus button position
        const btnX = PANEL_X + PANEL_W - 22;
        const btnY = rowY + rowHeight / 2;
        const btnR = 12;
        
        if (x >= btnX - btnR && x <= btnX + btnR &&
            y >= btnY - btnR && y <= btnY + btnR) {
          // Remove one of this denomination
          const idx = collected.findIndex(c => c.value === groups[i].value);
          if (idx !== -1) {
            fuel -= groups[i].value;
            collected.splice(idx, 1);
            
            // Spawn it back into the play area
            const padding = 50;
            const safeTop = padding;
            const safeBottom = SHIP_ZONE.y - 40;
            const safeLeft = padding;
            const safeRight = PANEL_X - 20;
            
            pickups.push({
              x: safeLeft + Math.random() * (safeRight - safeLeft),
              y: safeTop + Math.random() * (safeBottom - safeTop),
              value: groups[i].value,
              id: Math.random(),
            });
          }
          break;
        }
      }
    }
  });

  let lastTime = 0;
  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // Only update game logic when playing
    if (missionState === 'playing') {
      let dx = 0, dy = 0;
      if (keys['w'] || keys['arrowup']) dy -= 1;
      if (keys['s'] || keys['arrowdown']) dy += 1;
      if (keys['a'] || keys['arrowleft']) dx -= 1;
      if (keys['d'] || keys['arrowright']) dx += 1;

      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
        player.x += dx * PLAYER_SPEED * dt;
        player.y += dy * PLAYER_SPEED * dt;
        player.angle = Math.atan2(dy, dx) + Math.PI / 2;
        player.x = Math.max(PLAYER_SIZE, Math.min(W - PLAYER_SIZE, player.x));
        player.y = Math.max(PLAYER_SIZE, Math.min(H - PLAYER_SIZE, player.y));
      }

      for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        const r = pickupRadius(p.value);
        if (dist(player.x, player.y, p.x, p.y) < PLAYER_SIZE + r) {
          // Always collect - move to collected pane
          fuel += p.value;
          collected.push({ value: p.value, id: Math.random() });
          collected.sort((a, b) => b.value - a.value); // Largest to smallest
          
          // Create collection particles
          for (let j = 0; j < 8; j++) {
            const angle = (Math.PI * 2 * j) / 8;
            particles.push({
              x: p.x,
              y: p.y,
              vx: Math.cos(angle) * 80,
              vy: Math.sin(angle) * 80,
              life: 0.5,
              maxLife: 0.5,
              size: 3 + Math.random() * 3,
              hue: p.value >= 1000 ? 45 : p.value >= 100 ? 38 : 28,
            });
          }
          pickups.splice(i, 1);
        }
      }

      const inShipZone = isInShipZone(player.x, player.y);
      if (inShipZone) {
        const diff = fuel - target;
        if (diff === 0) {
          canLaunch = true;
          shipMsg.textContent = 'Perfect! Press SPACE or E to launch!';
          shipMsg.style.color = '';
          shipMsg.hidden = false;
        } else {
          canLaunch = false;
          shipMsg.textContent = 'Not ready!';
          shipMsg.style.color = '#ff6666';
          shipMsg.hidden = false;
        }
      } else {
        shipMsg.hidden = true;
        canLaunch = false;
      }
      
      if (canLaunch && launchPressed) {
        missionCompleteUntil = now + 1800;
        launchPressed = false;
      }
      if (missionCompleteUntil > 0 && now >= missionCompleteUntil) {
        missionCompleteUntil = 0;
        completeMission();
      }

      // Update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const part = particles[i];
        part.x += part.vx * dt;
        part.y += part.vy * dt;
        part.life -= dt;
        if (part.life <= 0) {
          particles.splice(i, 1);
        }
      }

      // Update ghost
      if (ghost) {
        const padding = 60;
        const safeTop = padding;
        const safeBottom = SHIP_ZONE.y - 40;
        const safeLeft = padding;
        const safeRight = PANEL_X - 20;

        // Wobble: slight sine-wave drift perpendicular to travel direction
        ghost.wobblePhase += dt * 3;
        const wobbleStrength = 40;
        const wobbleX = Math.cos(ghost.wobblePhase) * wobbleStrength * dt;
        const wobbleY = Math.sin(ghost.wobblePhase * 0.7) * wobbleStrength * dt;

        ghost.x += ghost.vx * dt + wobbleX;
        ghost.y += ghost.vy * dt + wobbleY;

        // Bounce off boundaries
        if (ghost.x < safeLeft) { ghost.x = safeLeft; ghost.vx = Math.abs(ghost.vx); }
        if (ghost.x > safeRight) { ghost.x = safeRight; ghost.vx = -Math.abs(ghost.vx); }
        if (ghost.y < safeTop) { ghost.y = safeTop; ghost.vy = Math.abs(ghost.vy); }
        if (ghost.y > safeBottom) { ghost.y = safeBottom; ghost.vy = -Math.abs(ghost.vy); }

        // Occasionally change direction slightly for unpredictability
        if (Math.random() < 0.5 * dt) {
          const turnAngle = (Math.random() - 0.5) * Math.PI * 0.5;
          const speed = Math.hypot(ghost.vx, ghost.vy);
          const angle = Math.atan2(ghost.vy, ghost.vx) + turnAngle;
          ghost.vx = Math.cos(angle) * speed;
          ghost.vy = Math.sin(angle) * speed;
        }

        // Ghost-player collision
        if (ghostHitCooldown > 0) {
          ghostHitCooldown -= dt;
        } else if (dist(player.x, player.y, ghost.x, ghost.y) < PLAYER_SIZE + GHOST_SIZE) {
          // Player touched the ghost! Drop a collected fuel item
          if (collected.length > 0) {
            // Pick a random collected item to drop
            const dropIdx = Math.floor(Math.random() * collected.length);
            const dropped = collected[dropIdx];
            fuel -= dropped.value;
            collected.splice(dropIdx, 1);

            // Spawn it back at a random position on the board
            const rx = safeLeft + Math.random() * (safeRight - safeLeft);
            const ry = safeTop + Math.random() * (safeBottom - safeTop);
            pickups.push({ x: rx, y: ry, value: dropped.value, id: Math.random() });

            // Spooky hit particles (purple/ghostly)
            for (let j = 0; j < 10; j++) {
              const angle = (Math.PI * 2 * j) / 10;
              particles.push({
                x: player.x,
                y: player.y,
                vx: Math.cos(angle) * 100,
                vy: Math.sin(angle) * 100,
                life: 0.6,
                maxLife: 0.6,
                size: 4 + Math.random() * 3,
                hue: 270, // purple/ghostly
              });
            }
          }
          ghostHitCooldown = GHOST_HIT_COOLDOWN;
        }
      }
    }

    draw(now);
    requestAnimationFrame(loop);
  }

  function draw(now) {
    const t = now / 1000;
    
    // Intro screen is now HTML overlay — skip canvas drawing
    if (missionState === 'intro') {
      ctx.fillStyle = '#050810';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    
    // Normal gameplay
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.06)';
    ctx.lineWidth = 1;
    const gridStep = 60;
    for (let x = 0; x <= W; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Planet: arc just at bottom (purple theme)
    const planetArcHeight = 80;
    const planetStartY = H - planetArcHeight;
    
    // Fill below arc
    ctx.fillStyle = '#2d1a3a';
    ctx.fillRect(0, planetStartY, W, planetArcHeight);
    
    // Arc curve (top edge of planet)
    const arcRadius = W * 0.8;
    const arcCenterY = planetStartY + arcRadius * 0.3;
    
    ctx.strokeStyle = 'rgba(150, 100, 200, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W / 2, arcCenterY, arcRadius, Math.PI + 0.2, -0.2);
    ctx.stroke();
    
    // Subtle fill above arc
    ctx.fillStyle = 'rgba(45, 28, 58, 0.3)';
    ctx.beginPath();
    ctx.arc(W / 2, arcCenterY, arcRadius, Math.PI + 0.2, -0.2);
    ctx.lineTo(W, planetStartY);
    ctx.lineTo(0, planetStartY);
    ctx.closePath();
    ctx.fill();
    
    // Landing pad (on the planet, where you need to land)
    const padCx = SHIP_ZONE.x + SHIP_ZONE.w / 2;
    const padCy = SHIP_ZONE.y + SHIP_ZONE.h / 2;
    const padW = SHIP_ZONE.w;
    const padH = 28;
    
    ctx.save();
    ctx.translate(padCx, padCy);
    
    // Pad base (flat platform)
    const padGlow = canLaunch ? 0.5 + 0.5 * Math.sin(t * 4) : 0.2;
    ctx.fillStyle = 'rgba(40, 55, 70, 0.95)';
    ctx.strokeStyle = `rgba(0, 245, 255, ${0.3 + padGlow * 0.4})`;
    ctx.lineWidth = canLaunch ? 3 : 2;
    ctx.shadowColor = canLaunch ? 'rgba(0, 245, 255, 0.5)' : 'transparent';
    ctx.shadowBlur = canLaunch ? 12 : 0;
    const r = 8;
    ctx.beginPath();
    ctx.moveTo(-padW / 2 + r, -padH / 2);
    ctx.lineTo(padW / 2 - r, -padH / 2);
    ctx.arc(padW / 2 - r, -padH / 2 + r, r, -Math.PI / 2, 0);
    ctx.lineTo(padW / 2, padH / 2 - r);
    ctx.arc(padW / 2 - r, padH / 2 - r, r, 0, Math.PI / 2);
    ctx.lineTo(-padW / 2 + r, padH / 2);
    ctx.arc(-padW / 2 + r, padH / 2 - r, r, Math.PI / 2, Math.PI);
    ctx.lineTo(-padW / 2, -padH / 2 + r);
    ctx.arc(-padW / 2 + r, -padH / 2 + r, r, Math.PI, Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Pad markings (H pattern / target)
    ctx.strokeStyle = `rgba(0, 245, 255, ${0.4 + padGlow * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-padW / 4, 0);
    ctx.lineTo(padW / 4, 0);
    ctx.moveTo(0, -padH / 4);
    ctx.lineTo(0, padH / 4);
    ctx.stroke();
    
    ctx.restore();

    // Pickups with pulsing glow
    ctx.font = '600 18px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of pickups) {
      const r = pickupRadius(p.value);
      const glow = 0.6 + 0.4 * Math.sin(t * 2 + p.id);
      const pulse = 1 + 0.1 * Math.sin(t * 3 + p.id);
      const hue = p.value >= 1000 ? 45 : p.value >= 100 ? 38 : 28;
      const alpha = 0.5 + 0.3 * glow;
      
      // Outer glow ring
      ctx.shadowColor = `hsla(${hue}, 100%, 60%, ${alpha * 0.5})`;
      ctx.shadowBlur = 20 + 8 * glow;
      ctx.fillStyle = `hsla(${hue}, 95%, 55%, 0.3)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * pulse * 1.3, 0, Math.PI * 2);
      ctx.fill();
      
      // Main orb
      ctx.shadowColor = `hsla(${hue}, 100%, 60%, ${alpha})`;
      ctx.shadowBlur = 12 + 4 * glow;
      ctx.fillStyle = `hsla(${hue}, 95%, 55%, 0.95)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * pulse, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner highlight
      ctx.shadowBlur = 0;
      ctx.fillStyle = `hsla(${hue}, 100%, 75%, 0.4)`;
      ctx.beginPath();
      ctx.arc(p.x - r * 0.3, p.y - r * 0.3, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      
      // Number text (Exo 2 for readability, sized to fit the circle)
      ctx.fillStyle = '#0a0e1a';
      const label = formatNum(p.value);
      const fontSize = Math.max(12, Math.min(24, Math.floor(r * 1.4 / Math.max(label.length * 0.55, 1))));
      ctx.font = `700 ${fontSize}px "Exo 2", sans-serif`;
      ctx.fillText(label, p.x, p.y);
    }
    
    // Ghost
    if (ghost && currentGhostVariant && currentGhostVariant.img.complete) {
      const ghostAlpha = ghostHitCooldown > 0
        ? 0.3 + 0.3 * Math.sin(t * 15) // flicker when player is invincible
        : 0.85;
      const bobY = Math.sin(t * 2.5 + ghost.wobblePhase) * 5;
      const drawSize = GHOST_SIZE * 2.5;

      ctx.save();
      ctx.globalAlpha = ghostAlpha;
      ctx.shadowColor = 'rgba(180, 100, 255, 0.7)';
      ctx.shadowBlur = 18 + 6 * Math.sin(t * 3);

      ctx.drawImage(
        currentGhostVariant.img,
        ghost.x - drawSize / 2,
        ghost.y - drawSize / 2 + bobY,
        drawSize,
        drawSize
      );

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Particles
    for (const part of particles) {
      const alpha = part.life / part.maxLife;
      if (part.hue === 0) {
        // Red "can't collect" particles
        ctx.fillStyle = `rgba(255, 50, 50, ${alpha})`;
      } else {
        ctx.fillStyle = `hsla(${part.hue}, 100%, 60%, ${alpha})`;
      }
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Player rocket (flying around, lands on pad)
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    
    ctx.fillStyle = '#00f5ff';
    ctx.shadowColor = 'rgba(0, 245, 255, 0.7)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -PLAYER_SIZE);
    ctx.lineTo(PLAYER_SIZE * 0.7, PLAYER_SIZE * 0.8);
    ctx.lineTo(0, PLAYER_SIZE * 0.4);
    ctx.lineTo(-PLAYER_SIZE * 0.7, PLAYER_SIZE * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Nose highlight
    ctx.fillStyle = 'rgba(255, 176, 32, 0.6)';
    ctx.beginPath();
    ctx.moveTo(0, -PLAYER_SIZE);
    ctx.lineTo(PLAYER_SIZE * 0.25, PLAYER_SIZE * 0.2);
    ctx.lineTo(-PLAYER_SIZE * 0.25, PLAYER_SIZE * 0.2);
    ctx.closePath();
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.restore();

    // Collected items pane (right side, grouped by denomination)
    const rowHeight = 44;
    
    // Background panel
    ctx.fillStyle = 'rgba(20, 60, 40, 0.9)';
    ctx.strokeStyle = 'rgba(50, 200, 100, 0.6)';
    ctx.lineWidth = 2;
    ctx.fillRect(PANEL_X, 0, PANEL_W, H);
    ctx.strokeRect(PANEL_X, 0, PANEL_W, H);
    
    // Have / Need labels
    const haveColor = fuel === target ? 'rgba(50, 200, 100, 0.9)' : fuel > target ? 'rgba(255, 100, 100, 0.9)' : 'rgba(255, 255, 255, 0.9)';
    ctx.font = '700 16px "Exo 2", sans-serif';
    
    // "Have: X"
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('Have:', PANEL_X + 10, 22);
    ctx.fillStyle = haveColor;
    ctx.textAlign = 'right';
    ctx.fillText(formatNum(fuel), PANEL_X + PANEL_W - 10, 22);
    
    // "Need: X"
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('Need:', PANEL_X + 10, 42);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.textAlign = 'right';
    ctx.fillText(formatNum(target), PANEL_X + PANEL_W - 10, 42);
    
    // Separator line
    ctx.strokeStyle = 'rgba(50, 200, 100, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PANEL_X + 10, 52);
    ctx.lineTo(PANEL_X + PANEL_W - 10, 52);
    ctx.stroke();
    
    // Grouped denomination rows
    const groups = getCollectedGroups();
    const startY = 55;
    
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const rowY = startY + i * rowHeight;
      const centerY = rowY + rowHeight / 2;
      
      // Row background on hover area
      ctx.fillStyle = 'rgba(50, 200, 100, 0.08)';
      ctx.fillRect(PANEL_X + 4, rowY + 2, PANEL_W - 8, rowHeight - 4);
      
      // Columnar layout: "100 × 1 = 100" with aligned columns
      const font = '700 17px "Exo 2", sans-serif';
      ctx.font = font;
      
      // Column positions (right-aligned denomination, center ×, right-aligned count, center =, right-aligned subtotal)
      const colDenom = PANEL_X + 62;   // right edge of denomination
      const colX     = PANEL_X + 72;   // ×
      const colCount = PANEL_X + 86;   // count
      const colEq    = PANEL_X + 100;  // =
      const colTotal = PANEL_X + PANEL_W - 40; // right edge of subtotal
      
      // Denomination (right-aligned)
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillText(formatNum(g.value), colDenom, centerY + 1);
      
      // × count (both green)
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(50, 200, 100, 0.8)';
      ctx.fillText('×', colX, centerY + 1);
      ctx.fillText(`${g.count}`, colCount, centerY + 1);
      
      // = subtotal (right-aligned)
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText('=', colEq, centerY + 1);
      ctx.textAlign = 'right';
      ctx.fillText(formatNum(g.value * g.count), colTotal, centerY + 1);
      
      // Minus button (return one)
      const btnX = PANEL_X + PANEL_W - 22;
      const btnY = centerY;
      const btnR = 12;
      
      ctx.fillStyle = 'rgba(255, 100, 100, 0.6)';
      ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Minus symbol
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(btnX - 5, btnY);
      ctx.lineTo(btnX + 5, btnY);
      ctx.stroke();
    }
    
    // If nothing collected yet, show hint
    if (groups.length === 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '400 12px "Exo 2", sans-serif';
      ctx.fillText('Fly into', PANEL_X + PANEL_W / 2, H / 2 - 10);
      ctx.fillText('fuel to collect', PANEL_X + PANEL_W / 2, H / 2 + 10);
    }

    // Mission complete overlay
    if (missionCompleteUntil > 0) {
      const fade = Math.min(1, (missionCompleteUntil - now) / 400);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.6 * fade})`;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = `rgba(255, 176, 32, ${fade})`;
      ctx.font = '800 53px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(255, 176, 32, 0.8)';
      ctx.shadowBlur = 24;
      ctx.fillText('Mission complete!', W / 2, H / 2);
      ctx.shadowBlur = 0;
    }
  }

  startMission();
  requestAnimationFrame(loop);
})();
