/* Shared rendering logic used by both the main dashboard and the family share page. */

function pad2(n) { return String(n).padStart(2, '0'); }

function toLocalISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtDuration(ms) {
  if (ms < 0) ms = 0;
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const DOW_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function dayLabel(dateStr) {
  // dateStr as YYYY-MM-DD, construct as local date (noon to avoid TZ edge issues)
  const d = new Date(dateStr + 'T12:00:00');
  return { dow: DOW_LABELS[d.getDay()], dnum: d.getDate() };
}

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function othersList(call) {
  const names = [...(call.staff || []), ...(call.cast || [])]
    .filter(n => n && n.toUpperCase() !== 'N/A' && n.toUpperCase() !== 'TBD');
  const seen = new Set();
  const uniq = [];
  for (const n of names) {
    const k = n.toLowerCase();
    if (!seen.has(k)) { seen.add(k); uniq.push(n); }
  }
  return uniq;
}

function buildGlobalTimeline(data) {
  // Flatten every time_ok call across every day into one chronologically sorted list.
  const all = [];
  for (const day of data.days) {
    for (const call of day.calls) {
      if (call.time_ok && call.start) {
        all.push({ ...call, dayDate: day.date });
      }
    }
  }
  all.sort((a, b) => a.start.localeCompare(b.start));
  return all;
}

function findNowAndNext(timeline, now) {
  // Compare as real Date instants (both the naive schedule strings and "now" are
  // local time), never as raw ISO strings — toISOString() re-bases to UTC and
  // silently breaks these comparisons whenever the device isn't on UTC itself.
  const nowMs = now.getTime();
  let current = null;
  let next = null;
  for (const c of timeline) {
    const startMs = new Date(c.start).getTime();
    const endMs = c.end ? new Date(c.end).getTime() : null;
    if (startMs <= nowMs && endMs !== null && nowMs < endMs) {
      current = c;
    }
    if (!next && startMs > nowMs) {
      next = c;
    }
  }
  return { current, next };
}

function renderNotesToggle(container, notesText, idPrefix) {
  if (!notesText) return;
  const short = notesText.length <= 100;
  const wrap = document.createElement('div');
  if (short) {
    const n = document.createElement('div');
    n.className = 'notes show';
    n.textContent = notesText;
    wrap.appendChild(n);
  } else {
    const btn = document.createElement('span');
    btn.className = 'notes-toggle';
    btn.textContent = 'Tech / costume notes ▾';
    const n = document.createElement('div');
    n.className = 'notes';
    n.textContent = notesText;
    btn.addEventListener('click', () => {
      const showing = n.classList.toggle('show');
      btn.textContent = showing ? 'Tech / costume notes ▴' : 'Tech / costume notes ▾';
    });
    wrap.appendChild(btn);
    wrap.appendChild(n);
  }
  container.appendChild(wrap);
}

function renderCallRow(call, opts) {
  opts = opts || {};
  const row = document.createElement('div');
  row.className = 'call-row' + (opts.inProgress ? ' in-progress' : '');

  const timeLine = document.createElement('div');
  const timeText = call.time_ok
    ? (call.end ? `${fmtTime(call.start)} – ${fmtTime(call.end)}` : fmtTime(call.start))
    : (call.time_raw || '');
  timeLine.className = 'time';
  timeLine.textContent = timeText;
  if (opts.inProgress) {
    const b = document.createElement('span');
    b.className = 'badge';
    b.textContent = opts.badgeText || 'NOW';
    timeLine.appendChild(b);
  }
  row.appendChild(timeLine);

  const act = document.createElement('div');
  act.className = 'activity';
  act.textContent = call.activity || '(untitled)';
  row.appendChild(act);

  if (call.location) {
    const loc = document.createElement('div');
    loc.className = 'loc';
    loc.textContent = '📍 ' + call.location;
    row.appendChild(loc);
  }

  const others = othersList(call);
  if (others.length) {
    const o = document.createElement('div');
    o.className = 'others';
    o.textContent = '👥 ' + others.join(', ');
    row.appendChild(o);
  }

  renderNotesToggle(row, call.notes, call.id);

  return row;
}

function renderMealRow(meal) {
  const row = document.createElement('div');
  row.className = 'meal-row';
  const t = document.createElement('span');
  t.className = 'time';
  t.textContent = meal.end ? `${fmtTime(meal.start)}–${fmtTime(meal.end)}` : fmtTime(meal.start);
  const l = document.createElement('span');
  l.textContent = '🍽 ' + meal.label.replace(/\s+/g, ' ');
  row.appendChild(t);
  row.appendChild(l);
  return row;
}

function renderNowDivider(text) {
  const div = document.createElement('div');
  div.className = 'now-divider';
  div.textContent = text || 'NOW';
  return div;
}

function renderScheduleDay(container, data, dateStr, now, opts) {
  opts = opts || {};
  container.innerHTML = '';
  const day = data.days.find(d => d.date === dateStr);
  if (!day) {
    const e = document.createElement('div');
    e.className = 'empty-state';
    e.innerHTML = '<div class="big">—</div>No schedule loaded for this day.';
    container.appendChild(e);
    return;
  }

  const todayStr = toLocalISODate(now);
  const isToday = dateStr === todayStr;
  const isPast = dateStr < todayStr;

  const okCalls = day.calls.filter(c => c.time_ok && c.start);
  const flaggedCalls = day.calls.filter(c => !c.time_ok);

  // Merge calls + meals into one sorted timeline for display.
  const items = [
    ...okCalls.map(c => ({ type: 'call', start: c.start, data: c })),
    ...day.meals.filter(m => m.start).map(m => ({ type: 'meal', start: m.start, data: m })),
  ].sort((a, b) => a.start.localeCompare(b.start));

  if (items.length === 0) {
    const e = document.createElement('div');
    e.className = 'empty-state';
    e.innerHTML = '<div class="big">🌙</div>No calls of yours found for this day.';
    container.appendChild(e);
  } else {
    // Always compare as real Date instants, not raw ISO strings (see findNowAndNext).
    const nowMs = now.getTime();
    let dividerPlaced = false;

    if (!opts.showNowLine) {
      // Not showing a now-line at all (used rarely); just list everything.
      for (const it of items) {
        container.appendChild(it.type === 'call' ? renderCallRow(it.data) : renderMealRow(it.data));
      }
    } else if (!isToday) {
      if (isPast) {
        for (const it of items) {
          container.appendChild(it.type === 'call' ? renderCallRow(it.data) : renderMealRow(it.data));
        }
        container.appendChild(renderNowDivider('NOW — this day has passed'));
      } else {
        container.appendChild(renderNowDivider('NOW — this day is upcoming'));
        for (const it of items) {
          container.appendChild(it.type === 'call' ? renderCallRow(it.data) : renderMealRow(it.data));
        }
      }
    } else {
      // isToday: find placement.
      for (const it of items) {
        const c = it.data;
        const startMs = new Date(c.start).getTime();
        const endMs = c.end ? new Date(c.end).getTime() : null;
        const inProgress = it.type === 'call' && startMs <= nowMs && endMs !== null && nowMs < endMs;

        if (!dividerPlaced && startMs > nowMs) {
          const mins = fmtDuration(startMs - nowMs);
          container.appendChild(renderNowDivider(`NOW — ${mins} until next`));
          dividerPlaced = true;
        }

        if (inProgress) {
          const minsLeft = fmtDuration(endMs - nowMs);
          container.appendChild(renderNowDivider(`NOW — ${minsLeft} left in this block`));
          container.appendChild(renderCallRow(c, { inProgress: true, badgeText: minsLeft + ' left' }));
          dividerPlaced = true;
        } else {
          container.appendChild(it.type === 'call' ? renderCallRow(c) : renderMealRow(c));
        }
      }
      if (!dividerPlaced) {
        container.appendChild(renderNowDivider('NOW — nothing else for you today'));
      }
    }
  }

  if (flaggedCalls.length) {
    const h = document.createElement('h2');
    h.className = 'section-title';
    h.textContent = 'Needs your read — time unclear';
    container.appendChild(h);
    for (const c of flaggedCalls) {
      const f = document.createElement('div');
      f.className = 'flag-row';
      const lbl = document.createElement('div');
      lbl.className = 'flag-label';
      lbl.textContent = '⚠ Could not parse a time for this row';
      f.appendChild(lbl);
      const rt = document.createElement('div');
      rt.className = 'raw-time';
      rt.textContent = 'Sheet said: "' + (c.time_raw || '(blank)') + '"';
      f.appendChild(rt);
      const act = document.createElement('div');
      act.className = 'activity';
      act.textContent = c.activity || '(untitled)';
      f.appendChild(act);
      if (c.location) {
        const loc = document.createElement('div');
        loc.className = 'loc';
        loc.textContent = '📍 ' + c.location;
        f.appendChild(loc);
      }
      container.appendChild(f);
    }
  }
}

function renderDayChips(container, data, selectedDate, now, onSelect) {
  container.innerHTML = '';
  const todayStr = toLocalISODate(now);
  for (const day of data.days) {
    const chip = document.createElement('button');
    const lbl = dayLabel(day.date);
    const empty = day.calls.filter(c => c.time_ok).length === 0 && day.calls.length === 0;
    chip.className = 'day-chip'
      + (day.date === todayStr ? ' today' : '')
      + (day.date === selectedDate ? ' selected' : '')
      + (empty ? ' empty' : '');
    chip.innerHTML = `<span class="dow">${lbl.dow}</span><span class="dnum">${lbl.dnum}</span>`;
    chip.addEventListener('click', () => onSelect(day.date));
    container.appendChild(chip);
  }
}
