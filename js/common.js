'use strict';
/* ---------- Gemeinsame Tisch-Bausteine: Chip-Auswahl & Chip-Stapel ---------- */
const Chips = (() => {
  const LIST = [
    { v: 10, c: '#2f7bff' }, { v: 25, c: '#1fbf6a' }, { v: 100, c: '#2a2238' },
    { v: 500, c: '#9b3dff' }, { v: 1000, c: '#f0a412' },
  ];
  const label = v => v >= 1000 ? (v / 1000).toString().replace('.', U.dec()) + 'K' : String(v);
  const colorFor = amount => { let c = LIST[0].c; for (const x of LIST) if (amount >= x.v) c = x.c; return c; };

  // Auswahl-Leiste: ein Chip ist aktiv, Klick auf ein Feld setzt ihn
  function rack(container, onChange, initial = 1) {
    let sel = LIST[initial].v;
    container.innerHTML = '';
    LIST.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip chip-btn selectable'; b.dataset.v = c.v;
      b.style.setProperty('--c', c.c); b.setAttribute('aria-label', `Chip ${c.v}`);
      b.innerHTML = `<span>${label(c.v)}</span>`;
      b.addEventListener('click', () => { Sfx.init(); Sfx.chip(); sel = c.v; update(); onChange && onChange(sel); });
      container.appendChild(b);
    });
    function update() { $$('.chip-btn', container).forEach(b => b.classList.toggle('on', +b.dataset.v === sel)); }
    update();
    return { get value() { return sel; }, update };
  }

  // Kleiner Chip mit Betrag (z. B. auf einem Roulettefeld)
  function marker(amount) {
    const d = document.createElement('span');
    d.className = 'chip mini-bet'; d.style.setProperty('--c', colorFor(amount));
    d.innerHTML = `<span>${label(amount)}</span>`;
    return d;
  }

  function fly(fromEl, toEl, amount) {
    if (U.reducedMotion || !fromEl || !toEl) return;
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    const f = document.createElement('span');
    f.className = 'chip flying'; f.style.setProperty('--c', colorFor(amount));
    f.innerHTML = `<span>${label(amount)}</span>`;
    const size = 40;
    Object.assign(f.style, { left: (a.left + a.width / 2 - size / 2) + 'px', top: (a.top + a.height / 2 - size / 2) + 'px', width: size + 'px', height: size + 'px' });
    document.body.appendChild(f);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    f.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px,${dy - 24}px) scale(1.05)`, offset: 0.7 }, { transform: `translate(${dx}px,${dy}px) scale(.6)` }],
      { duration: 360, easing: 'cubic-bezier(.3,.7,.3,1)' }).onfinish = () => f.remove();
  }

  return { LIST, label, colorFor, rack, marker, fly };
})();

/* Einsatz-Stepper (−/+) für Spiele mit fester Einsatzliste */
function BetStepper(minusEl, valEl, plusEl, list, startIdx, onChange) {
  let i = startIdx;
  const upd = (silent = false) => { valEl.textContent = U.fmt(list[i]); minusEl.disabled = i === 0 || lock; plusEl.disabled = i === list.length - 1 || lock; if (!silent && onChange) onChange(list[i]); };
  let lock = false;
  minusEl.addEventListener('click', () => { Sfx.init(); Sfx.click(); i = Math.max(0, i - 1); upd(); });
  plusEl.addEventListener('click', () => { Sfx.init(); Sfx.click(); i = Math.min(list.length - 1, i + 1); upd(); });
  upd(true);
  return { get value() { return list[i]; }, set locked(v) { lock = v; upd(true); } };
}
