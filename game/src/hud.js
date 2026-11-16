// The DOM layer: the heads-up display (score, wave, hull, shards, dash) and the
// overlay screens — title, upgrade draft, pause, victory and game over. It only
// reads the game state and reports button presses back through callbacks.

function el(id) {
  return document.getElementById(id);
}

export function createHud(callbacks) {
  const hud = el('hud');
  const score = el('hud-score');
  const wave = el('hud-wave');
  const shards = el('hud-shards');
  const hullFill = el('hud-hull-fill');
  const hullText = el('hud-hull-text');
  const dash = el('hud-dash');
  const overlays = {
    title: el('overlay-title'),
    draft: el('overlay-draft'),
    pause: el('overlay-pause'),
    win: el('overlay-win'),
    over: el('overlay-over'),
  };
  const draftCards = el('draft-cards');
  const bestLine = el('title-best');

  el('btn-start').addEventListener('click', () => callbacks.onStart());
  el('btn-restart').addEventListener('click', () => callbacks.onRestart());
  el('btn-win-continue').addEventListener('click', () => callbacks.onContinue());
  el('btn-win-restart').addEventListener('click', () => callbacks.onRestart());
  el('btn-resume').addEventListener('click', () => callbacks.onResume());
  el('btn-pause-restart').addEventListener('click', () => callbacks.onRestart());

  let lastPhase = '';
  let lastDraftKey = '';
  let best = 0;
  try {
    best = Number(localStorage.getItem('prismbreak-best') || 0);
  } catch {
    best = 0;
  }

  function statsHtml(state) {
    const acc = state.stats.shots > 0 ? Math.min(100, Math.round((state.stats.hits / state.stats.shots) * 100)) : 0;
    const mins = Math.floor(state.stats.time / 60);
    const secs = Math.floor(state.stats.time % 60).toString().padStart(2, '0');
    return (
      `<div><span>${state.score.toLocaleString()}</span><label>SCORE</label></div>` +
      `<div><span>${state.finalWave || state.wave}</span><label>WAVE</label></div>` +
      `<div><span>${state.stats.kills}</span><label>KILLS</label></div>` +
      `<div><span>${acc}%</span><label>ACCURACY</label></div>` +
      `<div><span>${mins}:${secs}</span><label>TIME</label></div>`
    );
  }

  function sync(state) {
    score.textContent = state.score.toLocaleString();
    wave.textContent = state.wave > 0 ? String(state.wave) : '—';
    shards.textContent = String(state.shards);
    const p = state.player;
    const frac = Math.max(0, p.hull / p.maxHull);
    hullFill.style.width = `${frac * 100}%`;
    hullFill.style.background = frac < 0.3 ? '#ff5d7a' : frac < 0.6 ? '#ffb340' : '#52ffa8';
    hullText.textContent = `${Math.ceil(p.hull)} / ${p.maxHull}`;
    dash.textContent = p.dashCd <= 0 ? 'DASH READY' : 'DASH ···';
    dash.style.opacity = p.dashCd <= 0 ? '1' : '0.45';
    hud.style.visibility = state.phase === 'title' ? 'hidden' : 'visible';

    const show = {
      title: state.phase === 'title',
      draft: state.phase === 'draft',
      pause: state.phase === 'paused',
      win: state.phase === 'win',
      over: state.phase === 'over',
    };
    for (const key of Object.keys(overlays)) {
      overlays[key].style.display = show[key] ? 'flex' : 'none';
    }

    if (state.phase !== lastPhase) {
      lastPhase = state.phase;
      if (state.phase === 'over' || state.phase === 'win') {
        el('over-stats').innerHTML = statsHtml(state);
        el('win-stats').innerHTML = statsHtml(state);
        if (state.score > best) {
          best = state.score;
          try {
            localStorage.setItem('prismbreak-best', String(best));
          } catch {
            /* private mode: best score just lives for the session */
          }
        }
      }
      if (state.phase === 'title') {
        bestLine.textContent = best > 0 ? `BEST ${best.toLocaleString()}` : '';
      }
    }

    if (state.phase === 'draft') {
      const key = `${state.wave}:${state.draft.map((u) => u.id).join(',')}`;
      if (key !== lastDraftKey) {
        lastDraftKey = key;
        draftCards.innerHTML = '';
        for (const u of state.draft) {
          const level = (state.upgrades.counts[u.id] || 0) + 1;
          const card = document.createElement('button');
          card.className = 'card';
          card.innerHTML =
            `<span class="card-dot" style="background:${u.color};box-shadow:0 0 14px ${u.color}"></span>` +
            `<span class="card-name">${u.name}</span>` +
            `<span class="card-desc">${u.desc}</span>` +
            `<span class="card-level">LEVEL ${level} / ${u.max}</span>`;
          card.addEventListener('click', () => callbacks.onDraft(u.id));
          draftCards.appendChild(card);
        }
      }
    }
  }

  return { sync };
}
