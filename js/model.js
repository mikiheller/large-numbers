/**
 * Place value model for "Zoom the Number"
 * Units: 1, 10, 100, 1K, 10K, 100K, 1M (Pebble → Castle)
 * Bins stay 0–9; auto-trade up, auto-borrow down.
 */

const UNITS = [
  { key: '1',     value: 1,       name: 'Pebble',  short: '1',    icon: '🪨', color: '#8B7355' },
  { key: '10',    value: 10,      name: 'Stick',   short: '10',   icon: '📏', color: '#D2B48C' },
  { key: '100',   value: 100,     name: 'Tile',    short: '100',  icon: '🟫', color: '#8B4513' },
  { key: '1000',  value: 1000,    name: 'Cube',    short: '1K',   icon: '🧊', color: '#4A90D9' },
  { key: '10000', value: 10000,   name: 'Chest',   short: '10K',  icon: '📦', color: '#2E7D32' },
  { key: '100000', value: 100000, name: 'Cart',    short: '100K', icon: '🛒', color: '#E65100' },
  { key: '1000000', value: 1000000, name: 'Castle', short: '1M',  icon: '🏰', color: '#6A1B9A' },
];

function createModel() {
  const counts = {};
  UNITS.forEach(u => { counts[u.key] = 0; });

  function computeTotal() {
    return UNITS.reduce((sum, u) => sum + counts[u.key] * u.value, 0);
  }

  /** Trade up: 10 of unit i → 1 of unit i+1. Repeat until no bin has ≥10. */
  function normalize() {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < UNITS.length - 1; i++) {
        const u = UNITS[i];
        while (counts[u.key] >= 10) {
          counts[u.key] -= 10;
          counts[UNITS[i + 1].key] += 1;
          changed = true;
        }
      }
    }
  }

  /** Add one of a unit, then normalize. */
  function add(unitKey) {
    if (!unitKey || counts[unitKey] === undefined) return false;
    counts[unitKey] += 1;
    normalize();
    return true;
  }

  /** Subtract one from unit; if not enough, borrow from next higher unit. */
  function subtract(unitKey) {
    if (!unitKey || counts[unitKey] === undefined) return false;
    const total = computeTotal();
    if (total === 0) return false;

    if (counts[unitKey] > 0) {
      counts[unitKey] -= 1;
      return true;
    }
    // Borrow: find smallest higher unit with count > 0, break 1 into 10 of next lower.
    const idx = UNITS.findIndex(u => u.key === unitKey);
    for (let i = idx + 1; i < UNITS.length; i++) {
      if (counts[UNITS[i].key] > 0) {
        counts[UNITS[i].key] -= 1;
        for (let j = i - 1; j >= idx; j--) counts[UNITS[j].key] += 9; // 10 - 1 we already "use"
        counts[unitKey] += 9; // then subtract 1
        counts[unitKey] -= 1;
        normalize();
        return true;
      }
    }
    return false;
  }

  /** Set total by greedy compression from largest to smallest. Bins 0–9. */
  function setTotal(n) {
    let rest = Math.max(0, Math.floor(Number(n)));
    UNITS.forEach(u => { counts[u.key] = 0; });
    for (let i = UNITS.length - 1; i >= 0; i--) {
      const u = UNITS[i];
      const q = Math.floor(rest / u.value);
      counts[u.key] = Math.min(9, q);
      rest -= counts[u.key] * u.value;
    }
    // Put remainder in smallest unit (should be < 10)
    if (rest > 0) counts['1'] = Math.min(9, (counts['1'] || 0) + rest);
    normalize();
  }

  function getCounts() {
    return { ...counts };
  }

  function setCounts(newCounts) {
    UNITS.forEach(u => {
      if (newCounts[u.key] !== undefined) counts[u.key] = Math.max(0, Math.min(9, Math.floor(newCounts[u.key])));
    });
    normalize();
  }

  return {
    UNITS,
    getCounts,
    setCounts,
    computeTotal,
    add,
    subtract,
    setTotal,
    normalize,
  };
}
