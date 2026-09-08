/* Main dashboard app: Now + Schedule tabs, service worker + update banner. */

let DATA = null;
let selectedDate = null;

function renderMeta() {
  const el = document.getElementById('meta-line');
  if (!DATA) return;
  const m = DATA.meta;
  el.innerHTML = `<span class="dot"></span> Updated ${esc(m.updated || '?')} · v${esc(m.version || '?')}`;
}

function renderNowTab() {
  const now = new Date();
  const timeline = buildGlobalTimeline(DATA);
  const { current, next } = findNowAndNext(timeline, now);
  const root = document.getElementById('now-root');
  root.innerHTML = '';

  if (current) {
    const card = document.createElement('div');
    card.className = 'now-card current';
    const minsLeft = fmtDuration(new Date(current.end) - now);
    card.innerHTML = `
      <div class="label">You're in</div>
      <div class="activity">${esc(current.activity || '(untitled)')}</div>
      <div class="meta">📍 ${esc(current.location || '')}</div>
      <div class="countdown">${minsLeft} left</div>
    `;
    const others = othersList(current);
    if (others.length) {
      const o = document.createElement('div');
      o.className = 'others';
      o.textContent = '👥 ' + others.join(', ');
      card.appendChild(o);
    }
    if (current.notes) {
      const n = document.createElement('div');
      n.className = 'notes';
      n.textContent = current.notes;
      card.appendChild(n);
    }
    root.appendChild(card);
  } else {
    const card = document.createElement('div');
    card.className = 'now-card';
    card.innerHTML = `<div class="label">Right now</div><div class="activity">Nothing on your schedule</div>`;
    root.appendChild(card);
  }

  if (next) {
    const dayLbl = next.dayDate === toLocalISODate(now) ? 'today' : dayLabel(next.dayDate).dow + ' ' + dayLabel(next.dayDate).dnum;
    const card = document.createElement('div');
    card.className = 'now-card';
    const mins = fmtDuration(new Date(next.start) - now);
    card.innerHTML = `
      <div class="label">Next up · ${esc(dayLbl)}</div>
      <div class="activity">${esc(next.activity || '(untitled)')}</div>
      <div class="meta">📍 ${esc(next.location || '')} · ${fmtTime(next.start)}${next.end ? ' – ' + fmtTime(next.end) : ''}</div>
      <div class="countdown">in ${mins}</div>
    `;
    const others = othersList(next);
    if (others.length) {
      const o = document.createElement('div');
      o.className = 'others';
      o.textContent = '👥 ' + others.join(', ');
      card.appendChild(o);
    }
    root.appendChild(card);
  } else {
    const card = document.createElement('div');
    card.className = 'now-card';
    card.innerHTML = `<div class="label">Next up</div><div class="activity">Nothing else on the schedule you've got.</div>`;
    root.appendChild(card);
  }
}

function renderScheduleTab() {
  const now = new Date();
  if (!selectedDate) {
    const todayStr = toLocalISODate(now);
    const exact = DATA.days.find(d => d.date === todayStr);
    if (exact) {
      selectedDate = todayStr;
    } else {
      const future = DATA.days.find(d => d.date > todayStr);
      selectedDate = future ? future.date : DATA.days[DATA.days.length - 1].date;
    }
  }
  renderDayChips(document.getElementById('day-chips'), DATA, selectedDate, now, (date) => {
    selectedDate = date;
    renderScheduleTab();
  });
  renderScheduleDay(document.getElementById('schedule-root'), DATA, selectedDate, now, { showNowLine: true });
}

function renderAll() {
  renderMeta();
  renderNowTab();
  renderScheduleTab();
}

function switchTab(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelectorAll('nav.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
}

function initTabs() {
  document.querySelectorAll('nav.tabbar button').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });
}

function initInfoModal() {
  const meta = document.getElementById('meta-line');
  const modal = document.getElementById('info-modal');
  meta.addEventListener('click', () => {
    if (!DATA) return;
    const m = DATA.meta;
    document.getElementById('info-updated').textContent = m.updated || '?';
    document.getElementById('info-version').textContent = m.version || '?';
    document.getElementById('info-source').textContent = m.source_file || '?';
    document.getElementById('info-generated').textContent = new Date(m.generated_at).toLocaleString();
    document.getElementById('info-tokens').textContent =
      'Bryant + ' + (m.dept_tokens || []).join(', ') + ' + shows: ' + (m.show_tokens || []).join(', ');
    document.getElementById('info-notes').textContent = m.notes || '';
    modal.classList.add('show');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('close')) modal.classList.remove('show');
  });
}

async function loadData() {
  const res = await fetch('./data.json', { cache: 'no-store' });
  DATA = await res.json();
}

function tick() {
  if (DATA) {
    renderNowTab();
    // Re-render the schedule day too, so the NOW divider / countdowns stay live.
    renderScheduleDay(document.getElementById('schedule-root'), DATA, selectedDate, new Date(), { showNowLine: true });
  }
}

async function init() {
  initTabs();
  initInfoModal();
  await loadData();
  renderAll();
  setInterval(tick, 30000);
}

init();

/* ---------- Service worker + update banner ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            document.getElementById('update-banner').classList.add('show');
          }
        });
      });
    });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  document.getElementById('update-banner').addEventListener('click', () => {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg && reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  });
}
