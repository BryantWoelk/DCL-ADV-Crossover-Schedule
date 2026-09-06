/* Family share page: same schedule, read-only, silent auto-refresh (no update banner). */

let DATA = null;
let selectedDate = null;

function renderMeta() {
  const el = document.getElementById('meta-line');
  if (!DATA) return;
  const m = DATA.meta;
  el.innerHTML = `<span class="dot"></span> Updated ${esc(m.updated || '?')} · v${esc(m.version || '?')}`;
}

function render() {
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
  renderMeta();
  renderDayChips(document.getElementById('day-chips'), DATA, selectedDate, now, (date) => {
    selectedDate = date;
    render();
  });
  renderScheduleDay(document.getElementById('schedule-root'), DATA, selectedDate, now, { showNowLine: true });
}

async function loadAndRender() {
  try {
    const res = await fetch('../data.json', { cache: 'no-store' });
    DATA = await res.json();
    render();
  } catch (e) {
    // offline / no signal — keep showing whatever was last rendered
  }
}

loadAndRender();
setInterval(loadAndRender, 60000); // silent refresh, no banner
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') loadAndRender();
});
