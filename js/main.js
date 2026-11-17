/* VOLTAJE — interacciones. Script clásico (defer) en una IIFE, sin dependencias:
   funciona también abriendo index.html desde la carpeta (file://). */
(function () {
'use strict';

const $ =(sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- 1. Cartel ABIERTO / CERRADO según la hora de Buenos Aires ---------- */
const HOURS = {          // 0 = domingo
  1: [7, 22], 2: [7, 22], 3: [7, 22], 4: [7, 22], 5: [7, 22],
  6: [9, 14],
};
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function baNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { day, hour: Number(get('hour')) + Number(get('minute')) / 60 };
}

function nextOpening({ day, hour }) {
  for (let i = 0; i < 8; i++) {
    const d = (day + i) % 7;
    const h = HOURS[d];
    if (!h) continue;
    if (i === 0 && hour >= h[0]) continue;
    const when = i === 0 ? 'hoy' : i === 1 ? 'mañana' : `el ${DAY_NAMES[d]}`;
    return `Abre ${when} a las ${h[0]}:00`;
  }
  return '';
}

function updateSign() {
  const sign = $('[data-open-sign]');
  if (!sign) return;
  const now = baNow();
  const h = HOURS[now.day];
  const open = Boolean(h && now.hour >= h[0] && now.hour < h[1]);
  sign.dataset.state = open ? 'open' : 'closed';
  $('[data-open-label]', sign).textContent = open ? 'Abierto' : 'Cerrado';
  $('[data-open-meta]', sign).textContent = open
    ? `Hasta las ${h[1]}:00`
    : nextOpening(now);
}
updateSign();
setInterval(updateSign, 60_000);

/* ---------- 2. App: tachar ejercicios ---------- */
const phone = $('.phone');
if (phone) {
  const boxes = $$('input[type="checkbox"]', phone);
  const done = $('[data-board-done]', phone);
  const bar = $('[data-board-bar]', phone);
  const msg = $('[data-board-message]', phone);
  $('[data-board-total]', phone).textContent = boxes.length;
  phone.addEventListener('change', () => {
    const n = boxes.filter((b) => b.checked).length;
    done.textContent = n;
    bar.style.setProperty('--p', n / boxes.length);
    msg.hidden = n !== boxes.length;
  });
}

/* ---------- 3. Planificador semanal ---------- */
const WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const SPLITS = {
  fuerza: {
    2: { 0: 'Sentadilla + empuje', 3: 'Peso muerto + tirón' },
    3: { 0: 'Sentadilla', 2: 'Press + dominadas', 4: 'Peso muerto' },
    4: { 0: 'Sentadilla', 1: 'Press de banca', 3: 'Peso muerto', 5: 'Press militar' },
  },
  recomp: {
    2: { 0: 'Fuerza completa', 3: 'Circuito metabólico' },
    3: { 0: 'Fuerza completa', 2: 'Intervalos', 4: 'Fuerza completa' },
    4: { 0: 'Tren inferior', 1: 'Intervalos', 3: 'Tren superior', 5: 'Circuito largo' },
  },
  volver: {
    2: { 1: 'Movilidad + técnica', 4: 'Fuerza base' },
    3: { 0: 'Movilidad', 2: 'Fuerza base', 4: 'Técnica + core' },
    4: { 0: 'Movilidad', 1: 'Fuerza base', 3: 'Técnica + core', 5: 'Fuerza base' },
  },
};
const TIMES = ['08:00', '08:00', '08:00', '08:00', '08:00', '10:00', ''];

/* Precios ficticios en ARS, por cada 4 semanas */
const PRICE_4W = {
  solo:  { 2: 85000, 3: 115000, 4: 140000 },
  grupo: { 2: 52000, 3: 68000,  4: 82000 },
};
/* Descuento por duración */
const DISCOUNT = { 4: 0, 8: 0.05, 12: 0.1 };

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const roundTo = (n, step = 500) => Math.round(n / step) * step;

const planner = $('[data-planner]');
if (planner) {
  const form = $('.planner-controls', planner);
  const week = $('[data-week]', planner);
  const price = $('[data-price]', planner);
  const label = $('[data-price-label]', planner);
  const note = $('[data-price-note]', planner);
  const cta = $('[data-plan-cta]', planner);
  const state = () => {
    const fd = new FormData(form);
    return {
      goal: fd.get('goal'),
      days: Number(fd.get('days')),
      mode: fd.get('mode'),
      weeks: Number(fd.get('weeks')),
    };
  };

  // El total se escribe al instante y hace un pequeño salto para que se note el cambio
  function showPrice(total) {
    if (price.textContent === ars.format(total)) return;
    price.textContent = ars.format(total);
    if (!reduceMotion.matches && price.animate) {
      price.animate(
        [{ opacity: 0.35, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
        { duration: 320, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      );
    }
  }

  week.innerHTML = WEEK.map((d, i) => `
    <li class="day" style="--i:${i}">
      <span class="day-name">${d}</span>
      <span class="day-slot"><span class="slot-title"></span><span class="slot-time"></span></span>
    </li>`).join('');
  const days = $$('.day', week);

  function render(animate) {
    const { goal, days: n, mode, weeks } = state();
    const split = SPLITS[goal][n];
    let k = 0;
    days.forEach((el, i) => {
      const on = i in split;
      const was = el.hasAttribute('data-on');
      el.toggleAttribute('data-on', on);
      el.toggleAttribute('data-fresh', animate && on && !was);
      if (animate && on && !was) el.style.setProperty('--i', k++);
      $('.slot-title', el).textContent = on ? split[i] : 'Descanso';
      $('.slot-time', el).textContent = on ? TIMES[i] : '';
      el.setAttribute('aria-label', `${WEEK[i]}: ${on ? split[i] : 'descanso'}`);
    });

    const blocks = weeks / 4;
    // Depende de días por semana, modalidad y duración (el objetivo solo cambia la rutina)
    const total = roundTo(PRICE_4W[mode][n] * blocks * (1 - DISCOUNT[weeks]));
    showPrice(total);

    label.textContent = `Total por ${weeks} semanas`;
    const perBlock = roundTo(total / blocks);
    const save = DISCOUNT[weeks] ? `<span class="price-save">−${DISCOUNT[weeks] * 100}%</span>` : '';
    note.innerHTML = `${n * weeks} sesiones · ${mode === 'solo' ? '1 a 1' : 'grupo de máx. 4'} · ${
      blocks > 1 ? `${ars.format(perBlock)} cada 4 semanas` : 'app incluida'}${save}`;
  }

  form.addEventListener('change', () => render(true));
  render(false);

  cta.addEventListener('click', () => {
    const { goal, days: n } = state();
    const g = $('#f-goal'); const d = $('#f-days');
    if (g) g.value = goal;
    if (d) d.value = String(n);
  });
}

/* ---------- 4. Formulario de reserva ---------- */
const booking = $('[data-booking]');
if (booking) {
  const submit = $('[data-submit]', booking);
  const ok = $('[data-booking-ok]', booking);

  const rules = {
    name: (v) => v.trim().length >= 2,
    contact: (v) => {
      const s = v.trim();
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) || s.replace(/\D/g, '').length >= 10;
    },
  };

  const check = (input) => {
    const valid = rules[input.name](input.value);
    input.setAttribute('aria-invalid', String(!valid));
    $(`#e-${input.name}`).hidden = valid;
    return valid;
  };

  Object.keys(rules).forEach((name) => {
    const input = booking.elements[name];
    input.addEventListener('blur', () => { if (input.value) check(input); });
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') check(input);
    });
  });

  booking.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputs = Object.keys(rules).map((n) => booking.elements[n]);
    const results = inputs.map(check);
    const firstBad = inputs[results.indexOf(false)];
    if (firstBad) { firstBad.focus(); return; }

    submit.setAttribute('aria-busy', 'true');
    $('.btn-label', submit).textContent = 'Enviando…';
    // Demo: acá iría el envío real (fetch a tu backend o a un servicio de formularios).
    await new Promise((r) => setTimeout(r, 900));

    $('[data-ok-name]', ok).textContent = booking.elements.name.value.trim().split(' ')[0];
    $$('.field, .field-row, [data-submit]', booking).forEach((el) => { el.hidden = true; });
    ok.hidden = false;
    ok.focus();
  });
}

/* ---------- 5. Menú móvil: cerrar al elegir un enlace ---------- */
const menu = $('#menu');
if (menu) {
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) menu.hidePopover();
  });
}

/* ---------- 6. Revelado al cargar y al bajar ---------- */
// [selector, tipo de animación, escalonar entre hermanos]
const REVEALS = [
  ['.sec-head > *', 'up', true],
  ['.split-media, .banner', 'media', false],
  ['.feature-list li', 'up', true],
  ['.tl-rail', 'line', false],
  ['.tl-weeks', 'up', false],
  ['.stages > li', 'up', true],
  ['.planner-controls > fieldset', 'up', true],
  ['.week', 'up', false],
  ['.price-row', 'up', false],
  ['.pull', 'up', false],
  ['.creds li', 'up', true],
  ['.faq details', 'up', true],
  ['.booking', 'up', false],
  ['.footer-sign', 'up', false],
  ['.footer-nav, .footer-meta, .footer-credits', 'up', true],
];
const revealed = [];
REVEALS.forEach(([sel, kind, stagger]) => {
  const groups = new Map();
  $$(sel).forEach((el) => {
    if (el.closest('.hero')) return;         // el hero ya tiene su propia entrada
    el.dataset.reveal = kind;
    if (stagger) {
      const n = groups.get(el.parentElement) || 0;
      groups.set(el.parentElement, n + 1);
      el.style.setProperty('--d', `${Math.min(n * 0.09, 0.54)}s`);
    }
    revealed.push(el);
  });
});

if (!('IntersectionObserver' in window)) {
  revealed.forEach((el) => el.classList.add('is-in'));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  revealed.forEach((el) => io.observe(el));
}

/* ---------- 7. Año del pie ---------- */
const year = $('[data-year]');
if (year) year.textContent = new Date().getFullYear();

})();
