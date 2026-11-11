/**
 * ==============================================================================
 * kwml-TC-roaster Application Engine (Modular Frontend Logic)
 * ==============================================================================
 */

// PASTE YOUR GOOGLE APPS SCRIPT EXEC URL HERE:
const ROSTER_API_URL = "https://script.google.com/macros/s/AKfycbz_YOUR_DEPLOYED_WEBAPP_ID/exec";
const CACHE_KEY = "kwml_tc_roaster_cache_v2";

let appData = null;
let indvCalDate = new Date();
let termCalDate = new Date();
let currentMonday = new Date();
let activeContactFilter = 'ALL';
let expandedFacilities = new Set();
let highlightNameQuery = "";

// 5-Character Name Cropper with '..'
function fmtName(name) {
  if (!name) return "";
  const cleaned = String(name).trim();
  return cleaned.length > 5 ? cleaned.slice(0, 5) + ".." : cleaned;
}

// 16-Terminal Distinct Palette Engine
const TERMINAL_PALETTE = {
  "HIGHCOURT":       { text: "#38bdf8", bg: "rgba(56, 189, 248, 0.20)", border: "rgba(56, 189, 248, 0.50)", abbr: "HC" },
  "VYTILLA":         { text: "#fb923c", bg: "rgba(251, 146, 60, 0.20)", border: "rgba(251, 146, 60, 0.50)", abbr: "VYT" },
  "SOUTH CHITTOOR":  { text: "#4ade80", bg: "rgba(74, 222, 128, 0.20)", border: "rgba(74, 222, 128, 0.50)", abbr: "SC" },
  "FORT KOCHI":      { text: "#f472b6", bg: "rgba(244, 114, 182, 0.20)", border: "rgba(244, 114, 182, 0.50)", abbr: "FK" },
  "KAKKANAD":        { text: "#a78bfa", bg: "rgba(167, 139, 250, 0.20)", border: "rgba(167, 139, 250, 0.50)", abbr: "KKD" },
  "VYPIN":           { text: "#facc15", bg: "rgba(250, 204, 21, 0.20)", border: "rgba(250, 204, 21, 0.50)", abbr: "VYP" },
  "BOLGATTY":        { text: "#2dd4bf", bg: "rgba(45, 212, 191, 0.20)", border: "rgba(45, 212, 191, 0.50)", abbr: "BGY" },
  "CHERANALLOOR":    { text: "#e879f9", bg: "rgba(232, 121, 249, 0.20)", border: "rgba(232, 121, 249, 0.50)", abbr: "CHR" },
  "ELOOR":           { text: "#818cf8", bg: "rgba(129, 140, 248, 0.20)", border: "rgba(129, 140, 248, 0.50)", abbr: "ELR" },
  "MULAVUKAD NORTH": { text: "#fb7185", bg: "rgba(251, 113, 133, 0.20)", border: "rgba(251, 113, 133, 0.50)", abbr: "MN" },
  "MATTANCHERRY":    { text: "#fdba74", bg: "rgba(253, 186, 116, 0.20)", border: "rgba(253, 186, 116, 0.50)", abbr: "MAT" },
  "W. ISLAND":       { text: "#34d399", bg: "rgba(52, 211, 153, 0.20)", border: "rgba(52, 211, 153, 0.50)", abbr: "WIL" },
  "OCC":             { text: "#60a5fa", bg: "rgba(96, 165, 250, 0.20)", border: "rgba(96, 165, 250, 0.50)", abbr: "OCC" },
  "AFC":             { text: "#c084fc", bg: "rgba(192, 132, 252, 0.20)", border: "rgba(192, 132, 252, 0.50)", abbr: "AFC" },
  "MAINTENANCE":     { text: "#cbd5e1", bg: "rgba(203, 213, 225, 0.20)", border: "rgba(203, 213, 225, 0.50)", abbr: "MNT" },
  "OCC OFFICE":      { text: "#94a3b8", bg: "rgba(148, 163, 184, 0.20)", border: "rgba(148, 163, 184, 0.50)", abbr: "OFH" }
};

function getTerminalTheme(terminalName) {
  if (!terminalName) return { text: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)", border: "rgba(148, 163, 184, 0.35)", abbr: "TRM" };
  const raw = String(terminalName).trim().toUpperCase();
  for (const [key, val] of Object.entries(TERMINAL_PALETTE)) {
    if (raw.includes(key) || raw === val.abbr) return val;
  }
  return { text: "#38bdf8", bg: "rgba(56, 189, 248, 0.15)", border: "rgba(56, 189, 248, 0.35)", abbr: raw.slice(0, 3) };
}

function toIso(dStr) {
  if (!dStr) return "";
  const p = dStr.split("-");
  return p.length === 3 ? (p[0].length === 4 ? `${p[0]}-${p[1]}-${p[2]}` : `${p[2]}-${p[1]}-${p[0]}`) : dStr;
}

function getWeekMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

// Lifecycle Bootloader
document.addEventListener("DOMContentLoaded", () => {
  renderLegend();
  loadCachedDataFirst();
  fetchRosterData();
});

function renderLegend() {
  const bar = document.getElementById("terminalLegendBar");
  bar.innerHTML = `<span style="font-size:0.68rem; font-weight:800; color:var(--text-muted); margin-right:4px; flex-shrink:0;">TERMINALS:</span>`;
  Object.entries(TERMINAL_PALETTE).slice(0, 12).forEach(([name, c]) => {
    bar.innerHTML += `
      <div class="legend-tag" style="background:${c.bg}; color:${c.text}; border-color:${c.border};">
        <span class="legend-dot" style="background:${c.text};"></span>
        ${c.abbr}
      </div>
    `;
  });
}

function loadCachedDataFirst() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      if (data && data.status === "success") {
        appData = data;
        alignAnchors();
        populateDropdowns();
        renderContactsDirectory();
        document.getElementById("loadingState").style.display = "none";
        switchView("individual");
      }
    }
  } catch (err) {
    console.warn("Cache hydration skipped:", err);
  }
}

async function fetchRosterData() {
  const loadingEl = document.getElementById("loadingState");
  const errorEl = document.getElementById("errorState");

  if (!appData) loadingEl.style.display = "block";
  errorEl.style.display = "none";

  try {
    const res = await fetch(ROSTER_API_URL, { method: "GET", redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (data.status !== "success") throw new Error(data.message || "Unable to read roster");

    appData = data;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) {}

    alignAnchors();
    populateDropdowns();
    renderContactsDirectory();
    loadingEl.style.display = "none";

    const activeView = document.querySelector(".view-content.active");
    if (!activeView) switchView("individual");
    else if (activeView.id === "view-calendar") renderWeeklyCalendar();
  } catch (err) {
    console.error(err);
    if (!appData) {
      loadingEl.style.display = "none";
      document.getElementById("errorMessage").textContent = `⚠️ Sync Error: ${err.message}`;
      errorEl.style.display = "block";
    }
  }
}

function alignAnchors() {
  if (!appData || !appData.metadata || !appData.metadata.dates || appData.metadata.dates.length === 0) return;

  const today = new Date();
  const availableIsos = appData.metadata.dates.map(d => toIso(d.date));
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // If today exists in roster, center on current live date; otherwise fallback to first sheet date
  if (availableIsos.includes(todayIso)) {
    indvCalDate = new Date(today.getFullYear(), today.getMonth(), 1);
    termCalDate = new Date(today.getFullYear(), today.getMonth(), 1);
    currentMonday = getWeekMonday(today);
  } else {
    const p = availableIsos[0].split("-");
    const firstDateObj = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
    indvCalDate = new Date(firstDateObj.getFullYear(), firstDateObj.getMonth(), 1);
    termCalDate = new Date(firstDateObj.getFullYear(), firstDateObj.getMonth(), 1);
    currentMonday = getWeekMonday(firstDateObj);
  }
}

function populateDropdowns() {
  if (!appData || !appData.metadata) return;

  const tcSelect = document.getElementById("tcSelect");
  tcSelect.innerHTML = '<option value="">-- Choose Controller --</option>';
  const validIndividuals = (appData.metadata.individuals || []).filter(name => {
    const s = String(name).trim();
    return s && !s.startsWith("#") && s.toLowerCase() !== "null";
  });

  validIndividuals.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    tcSelect.appendChild(opt);
  });

  const termSelect = document.getElementById("termSelect");
  termSelect.innerHTML = '<option value="">-- Choose Terminal --</option>';
  (appData.metadata.terminals || []).filter(t => t.name && !t.name.startsWith("#")).forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.name;
    opt.textContent = `${t.name} (${t.abbr})${t.isControlRoom ? ' [CR]' : ''}`;
    termSelect.appendChild(opt);
  });
}

function switchView(viewName) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".mobile-nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".view-content").forEach(v => v.classList.remove("active"));

  const activeDesktopBtn = Array.from(document.querySelectorAll(".tab-btn")).find(b => b.textContent.toLowerCase().includes(viewName));
  if (activeDesktopBtn) activeDesktopBtn.classList.add("active");

  const mobBtn = document.getElementById(`mob-nav-${viewName}`);
  if (mobBtn) mobBtn.classList.add("active");

  const viewEl = document.getElementById(`view-${viewName}`);
  if (viewEl) viewEl.classList.add("active");

  if (viewName === "calendar") renderWeeklyCalendar();
  if (viewName === "contacts") renderContactsDirectory();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function changeMonth(type, delta) {
  if (type === 'indv') {
    indvCalDate.setMonth(indvCalDate.getMonth() + delta);
    renderIndividualCalendar();
  } else {
    termCalDate.setMonth(termCalDate.getMonth() + delta);
    renderTerminalCalendar();
  }
}

// 1. INDIVIDUAL VIEW
function renderIndividualCalendar() {
  const person = document.getElementById("tcSelect").value;
  const metrics = document.getElementById("indvMetrics");
  const calCard = document.getElementById("indvCalendarCard");
  const grid = document.getElementById("indvCalGrid");
  const detailCard = document.getElementById("indvDetailCard");

  if (!person) {
    metrics.style.display = "none";
    calCard.style.display = "none";
    detailCard.style.display = "none";
    return;
  }

  const records = (appData.assignments || []).filter(a => {
    const p = String(a.person || "").trim();
    return p.toUpperCase() === person.toUpperCase() && !p.startsWith("#");
  });

  const dateMap = new Map();
  let morning = 0, general = 0, evening = 0, offs = 0, leaves = 0;

  records.forEach(r => {
    const iso = toIso(r.date);
    dateMap.set(iso, r);
    const slot = String(r.slot || "").toUpperCase();

    if (r.isOff || slot === "O" || slot === "WO") offs++;
    else if (r.isLeave || slot === "EL" || slot === "L" || slot === "CO" || slot === "RH") leaves++;
    else {
      if (r.shiftType === "Morning" || ["A", "A1", "A2"].includes(slot)) morning++;
      else if (r.shiftType === "General" || slot === "G") general++;
      else if (r.shiftType === "Evening" || ["B", "B1", "B2"].includes(slot)) evening++;
    }
  });

  document.getElementById("statMorningCount").textContent = morning;
  document.getElementById("statGeneralCount").textContent = general;
  document.getElementById("statEveningCount").textContent = evening;
  document.getElementById("statOffCount").textContent = offs;
  document.getElementById("statLeaveCount").textContent = leaves;
  metrics.style.display = "grid";

  const year = indvCalDate.getFullYear();
  const month = indvCalDate.getMonth();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  document.getElementById("indvMonthTitle").textContent = `${fmtName(person)} (${monthNames[month]} ${year})`;

  grid.innerHTML = "";
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevTotal = new Date(year, month, 0).getDate();

  for (let i = firstDay - 1; i >= 0; i--) {
    const cell = document.createElement("div");
    cell.className = "cal-day other-month";
    cell.innerHTML = `<span class="day-number">${prevTotal - i}</span>`;
    grid.appendChild(cell);
  }

  for (let d = 1; d <= totalDays; d++) {
    const mStr = String(month + 1).padStart(2, "0");
    const dStr = String(d).padStart(2, "0");
    const iso = `${year}-${mStr}-${dStr}`;

    const cell = document.createElement("div");
    cell.className = "cal-day";
    cell.innerHTML = `<span class="day-number">${d}</span>`;

    const record = dateMap.get(iso);
    if (record) {
      cell.classList.add("has-data");
      const slot = String(record.slot || "").toUpperCase();
      const theme = getTerminalTheme(record.terminal);

      let badgeHtml = "";
      if (record.isOff || slot === "O" || slot === "WO") {
        badgeHtml = `<div class="cal-badge-2line badge-wo"><span class="badge-line-shift">OFF</span><span class="badge-line-term">Rest</span></div>`;
      } else if (slot === "EL") {
        badgeHtml = `<div class="cal-badge-2line badge-lop"><span class="badge-line-shift">EL</span><span class="badge-line-term">LOP</span></div>`;
      } else if (record.isLeave) {
        badgeHtml = `<div class="cal-badge-2line badge-maroon"><span class="badge-line-shift">${slot}</span><span class="badge-line-term">Leave</span></div>`;
      } else {
        badgeHtml = `
          <div class="cal-badge-2line" style="background:${theme.bg}; color:${theme.text}; border-color:${theme.border};">
            <span class="badge-line-shift">${slot}</span>
            <span class="badge-line-term">${theme.abbr}</span>
          </div>
        `;
      }

      cell.innerHTML += badgeHtml;
      cell.addEventListener("click", () => {
        document.querySelectorAll("#indvCalGrid .cal-day").forEach(c => c.classList.remove("is-selected"));
        cell.classList.add("is-selected");
        inspectIndividualDay(record, theme);
      });
    } else {
      cell.classList.add("no-data");
    }
    grid.appendChild(cell);
  }

  calCard.style.display = "block";
}

function inspectIndividualDay(r, theme) {
  const card = document.getElementById("indvDetailCard");
  const title = document.getElementById("indvDetailDate");
  const badge = document.getElementById("indvDetailBadge");
  const body = document.getElementById("indvDetailBody");

  title.textContent = `${r.date} (${r.day})`;
  badge.textContent = `${r.slot} • ${theme.abbr}`;
  badge.style.background = theme.bg;
  badge.style.color = theme.text;
  badge.style.borderColor = theme.border;

  body.innerHTML = `
    <div class="detail-row"><span>Terminal</span><strong style="color:${theme.text};">${r.terminal} (${theme.abbr})</strong></div>
    <div class="detail-row"><span>Shift Slot</span><code>${r.slot} (${r.shiftType})</code></div>
    <div class="detail-row"><span>Classification</span><strong>${r.isOff ? "Weekly Off" : (r.isLeave ? "Leave" : "Operational")}</strong></div>
    ${r.isControlRoom ? `<div class="detail-row"><span>Facility</span><span class="badge-cr">Control Room</span></div>` : ''}
  `;
  card.style.display = "block";
}

// 2. TERMINAL VIEW
function renderTerminalCalendar() {
  const term = document.getElementById("termSelect").value;
  const calCard = document.getElementById("termCalendarCard");
  const grid = document.getElementById("termCalGrid");
  const detailCard = document.getElementById("termDetailCard");

  if (!term) {
    calCard.style.display = "none";
    detailCard.style.display = "none";
    return;
  }

  const theme = getTerminalTheme(term);
  const records = (appData.assignments || []).filter(a => {
    const t = String(a.terminal || "").trim();
    return t.toUpperCase() === term.toUpperCase() && !String(a.person || "").startsWith("#");
  });

  const dateMap = new Map();
  records.forEach(r => {
    const iso = toIso(r.date);
    if (!dateMap.has(iso)) dateMap.set(iso, []);
    dateMap.get(iso).push(r);
  });

  const year = termCalDate.getFullYear();
  const month = termCalDate.getMonth();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  document.getElementById("termMonthTitle").innerHTML = `<span style="color:${theme.text};">●</span> ${term} (${theme.abbr}) — ${monthNames[month]} ${year}`;

  grid.innerHTML = "";
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevTotal = new Date(year, month, 0).getDate();

  for (let i = firstDay - 1; i >= 0; i--) {
    const cell = document.createElement("div");
    cell.className = "cal-day other-month";
    cell.innerHTML = `<span class="day-number">${prevTotal - i}</span>`;
    grid.appendChild(cell);
  }

  for (let d = 1; d <= totalDays; d++) {
    const mStr = String(month + 1).padStart(2, "0");
    const dStr = String(d).padStart(2, "0");
    const iso = `${year}-${mStr}-${dStr}`;

    const cell = document.createElement("div");
    cell.className = "cal-day";
    cell.innerHTML = `<span class="day-number">${d}</span>`;

    const list = dateMap.get(iso);
    if (list && list.length > 0) {
      cell.classList.add("has-data");

      list.sort((a, b) => {
        const order = { "Morning": 1, "General": 2, "Evening": 3, "Other": 4 };
        return (order[a.shiftType] || 4) - (order[b.shiftType] || 4);
      });

      let rowsHtml = `<div class="term-shift-stack">`;
      list.forEach(pObj => {
        const displayName = fmtName(pObj.person);
        rowsHtml += `
          <div class="term-person-badge-row" style="background:${theme.bg}; color:${theme.text}; border-color:${theme.border};" title="${pObj.person} (${pObj.slot})">
            <strong>${pObj.slot}</strong>
            <span class="name">${displayName}</span>
          </div>
        `;
      });
      rowsHtml += `</div>`;
      cell.innerHTML += rowsHtml;

      cell.addEventListener("click", () => {
        document.querySelectorAll("#termCalGrid .cal-day").forEach(c => c.classList.remove("is-selected"));
        cell.classList.add("is-selected");
        inspectTerminalDay(list, term, theme);
      });
    } else {
      cell.classList.add("no-data");
    }
    grid.appendChild(cell);
  }

  calCard.style.display = "block";
}

function inspectTerminalDay(list, term, theme) {
  const card = document.getElementById("termDetailCard");
  const title = document.getElementById("termDetailDate");
  const sub = document.getElementById("termDetailSub");
  const body = document.getElementById("termDetailBody");

  const dObj = list[0];
  title.textContent = `${dObj.date} (${dObj.day})`;
  sub.textContent = `${term} Rostered Staff (${list.length})`;

  body.innerHTML = "";
  list.forEach(item => {
    const row = document.createElement("div");
    row.className = "detail-row";
    row.innerHTML = `
      <div><strong>${item.person}</strong></div>
      <span class="cal-badge-2line" style="width:auto; padding: 2px 8px; background:${theme.bg}; color:${theme.text}; border-color:${theme.border};">
        ${item.shiftType}: Slot ${item.slot}
      </span>
    `;
    body.appendChild(row);
  });

  card.style.display = "block";
}

// 3. 7-DAY WEEKLY CALENDAR WITH SEARCH HIGHLIGHTING
function changeWeek(delta) {
  currentMonday.setDate(currentMonday.getDate() + (delta * 7));
  renderWeeklyCalendar();
}

function jumpToCurrentWeek() {
  currentMonday = getWeekMonday(new Date());
  renderWeeklyCalendar();
}

function setWeeklyHighlightQuery(val) {
  highlightNameQuery = (val || "").trim().toLowerCase();
  renderWeeklyCalendar();
}

function renderWeeklyCalendar() {
  const board = document.getElementById("weeklyBoardGrid");
  const rangeLabel = document.getElementById("weeklyRangeLabel");
  board.innerHTML = "";

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() + i);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dt = String(d.getDate()).padStart(2, "0");

    weekDays.push({
      dateObj: d,
      dateStr: `${dt}-${m}-${y}`,
      isoStr: `${y}-${m}-${dt}`,
      dayName: daysOfWeek[i],
      displayShort: `${dt} ${months[d.getMonth()]}`
    });
  }

  rangeLabel.textContent = `${weekDays[0].displayShort} — ${weekDays[6].displayShort}`;

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  weekDays.forEach(dayInfo => {
    const col = document.createElement("div");
    col.className = "week-col";
    if (dayInfo.isoStr === todayIso) col.classList.add("is-today");

    const dayRecords = (appData.assignments || []).filter(a => {
      const p = String(a.person || "").trim();
      return a.date === dayInfo.dateStr && p && !p.startsWith("#") && p.toLowerCase() !== "null";
    });

    const header = document.createElement("div");
    header.className = "week-col-header";
    header.innerHTML = `
      <div class="week-dayname">${dayInfo.dayName}</div>
      <div class="week-date-row">
        <span class="week-date-num">${dayInfo.displayShort}</span>
        <span class="week-roster-pill">${dayRecords.length} Active</span>
      </div>
    `;
    col.appendChild(header);

    const content = document.createElement("div");
    content.className = "week-col-content";

    if (dayRecords.length === 0) {
      content.innerHTML = `
        <div style="text-align: center; padding: 24px 4px; color: var(--text-muted); font-size: 0.74rem;">
          No shifts scheduled
        </div>
      `;
      col.appendChild(content);
      board.appendChild(col);
      return;
    }

    const termGroups = new Map();
    const weeklyOffs = [];
    const leaves = [];

    dayRecords.forEach(r => {
      const slot = String(r.slot || "").toUpperCase();
      if (r.isOff || slot === "O" || slot === "WO") {
        weeklyOffs.push(r);
      } else if (r.isLeave || slot === "EL" || slot === "L" || slot === "CO" || slot === "RH" || slot === "HL") {
        leaves.push(r);
      } else {
        const tKey = r.terminal || "OTHER";
        if (!termGroups.has(tKey)) termGroups.set(tKey, []);
        termGroups.get(tKey).push(r);
      }
    });

    // 1. Terminals
    termGroups.forEach((assignments, termName) => {
      const theme = getTerminalTheme(termName);
      assignments.sort((a, b) => {
        const order = { "Morning": 1, "General": 2, "Evening": 3, "Other": 4 };
        return (order[a.shiftType] || 4) - (order[b.shiftType] || 4);
      });

      const tCard = document.createElement("div");
      tCard.className = "embed-term-card";

      let rowsHtml = "";
      assignments.forEach(item => {
        const slot = String(item.slot || "").toUpperCase();
        const displayName = fmtName(item.person);
        const isMatch = highlightNameQuery && item.person.toLowerCase().includes(highlightNameQuery);

        rowsHtml += `
          <div class="embed-person-row ${isMatch ? 'is-highlighted' : ''}">
            <span class="embed-person-name" title="${item.person}">${displayName}</span>
            <span class="embed-shift-badge" style="background:${theme.bg}; color:${theme.text}; border-color:${theme.border};">
              ${slot}
            </span>
          </div>
        `;
      });

      tCard.innerHTML = `
        <div class="embed-term-header" style="border-left: 3px solid ${theme.text};">
          <span class="embed-term-title" title="${termName}">${termName}</span>
          <span class="embed-term-abbr" style="background:${theme.bg}; color:${theme.text}; border-color:${theme.border};">
            ${theme.abbr}
          </span>
        </div>
        <div class="embed-term-body">
          ${rowsHtml}
        </div>
      `;
      content.appendChild(tCard);
    });

    // 2. Leaves & C-Off
    if (leaves.length > 0) {
      const lCard = document.createElement("div");
      lCard.className = "embed-cluster-card";

      let chipsHtml = "";
      leaves.forEach(l => {
        const slot = String(l.slot || "").toUpperCase();
        const isLop = slot === "EL" || slot.includes("LOP");
        const chipClass = isLop ? "chip-lop" : "chip-leave";
        const shortName = fmtName(l.person);
        chipsHtml += `
          <div class="embed-chip ${chipClass}" title="${l.person}">
            <span>${shortName}</span>
            <strong>${slot}</strong>
          </div>
        `;
      });

      lCard.innerHTML = `
        <div class="embed-cluster-header cluster-leave-header">
          <span>Leaves & C-Off</span>
          <span>${leaves.length}</span>
        </div>
        <div class="embed-cluster-body">
          ${chipsHtml}
        </div>
      `;
      content.appendChild(lCard);
    }

    // 3. Weekly Offs
    if (weeklyOffs.length > 0) {
      const offCard = document.createElement("div");
      offCard.className = "embed-cluster-card";

      let chipsHtml = "";
      weeklyOffs.forEach(o => {
        const shortName = fmtName(o.person);
        chipsHtml += `<div class="embed-chip" title="${o.person}"><span>${shortName}</span><span>WO</span></div>`;
      });

      offCard.innerHTML = `
        <div class="embed-cluster-header cluster-off-header">
          <span>Weekly Off (WO)</span>
          <span>${weeklyOffs.length}</span>
        </div>
        <div class="embed-cluster-body">
          ${chipsHtml}
        </div>
      `;
      content.appendChild(offCard);
    }

    col.appendChild(content);
    board.appendChild(col);
  });
}

// 4. COMBINED CONTACTS DIRECTORY
function setContactFilter(type) {
  activeContactFilter = type;
  document.querySelectorAll(".chip-btn").forEach(b => b.classList.remove("active"));
  const btn = document.getElementById(`chip-${type.toLowerCase()}`);
  if (btn) btn.classList.add("active");
  renderContactsDirectory();
}

function toggleFacilityCard(facilityKey) {
  if (expandedFacilities.has(facilityKey)) expandedFacilities.delete(facilityKey);
  else expandedFacilities.add(facilityKey);
  renderContactsDirectory();
}

function copyToClipboard(text, btnEl) {
  if (!navigator.clipboard) return;
  navigator.clipboard.writeText(text).then(() => {
    const originalText = btnEl.textContent;
    btnEl.textContent = "Copied!";
    btnEl.style.color = "#4ade80";
    setTimeout(() => {
      btnEl.textContent = originalText;
      btnEl.style.color = "";
    }, 1500);
  });
}

function renderContactsDirectory() {
  const container = document.getElementById("contactsContainer");
  if (!container || !appData) return;

  const q = (document.getElementById("contactSearchInput").value || "").trim().toLowerCase();
  let contacts = appData.contacts || [];

  if (activeContactFilter === "CR") {
    contacts = contacts.filter(c => c.isControlRoom || (c.location && c.location.toLowerCase().includes("control")));
  } else if (activeContactFilter === "TERM") {
    contacts = contacts.filter(c => c.isTerminal || (c.location && c.location.toLowerCase().includes("tcr")));
  } else if (activeContactFilter === "OCC") {
    contacts = contacts.filter(c => c.facility && c.facility.toUpperCase() === "OCC");
  }

  if (q) {
    contacts = contacts.filter(c =>
      (c.facility && c.facility.toLowerCase().includes(q)) ||
      (c.location && c.location.toLowerCase().includes(q)) ||
      (c.ippbx && String(c.ippbx).includes(q)) ||
      (c.cug && String(c.cug).includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  }

  container.innerHTML = "";

  if (contacts.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 10px; color: var(--text-muted); font-size: 0.85rem;">
        No contact records matching filter.
      </div>
    `;
    return;
  }

  const facilityGroups = new Map();
  contacts.forEach(c => {
    const fac = (c.facility || "OTHER").trim();
    if (!facilityGroups.has(fac)) facilityGroups.set(fac, []);
    facilityGroups.get(fac).push(c);
  });

  facilityGroups.forEach((desks, facilityName) => {
    const theme = getTerminalTheme(facilityName);
    const cardKey = facilityName.toUpperCase();
    const isExpanded = expandedFacilities.has(cardKey) || Boolean(q);

    const card = document.createElement("div");
    card.className = `facility-card ${isExpanded ? 'is-expanded' : ''}`;

    const hasControlRoom = desks.some(d => d.isControlRoom || (d.location && d.location.toLowerCase().includes("control")));

    const header = document.createElement("div");
    header.className = "facility-header";
    header.style.borderLeftColor = theme.text;
    header.onclick = () => toggleFacilityCard(cardKey);

    header.innerHTML = `
      <div class="facility-title-box">
        <span class="facility-name">${facilityName}</span>
        <span class="facility-abbr-pill" style="background:${theme.bg}; color:${theme.text}; border-color:${theme.border};">
          ${theme.abbr}
        </span>
        ${hasControlRoom ? `<span class="badge-cr">Control Room</span>` : ''}
      </div>
      <div class="facility-meta-right">
        <span class="facility-counts">${desks.length} ${desks.length === 1 ? 'Desk' : 'Desks'}</span>
        <span class="chevron-icon">▼</span>
      </div>
    `;
    card.appendChild(header);

    const panel = document.createElement("div");
    panel.className = "facility-details-panel";

    desks.forEach(d => {
      const item = document.createElement("div");
      item.className = "desk-contact-item";

      const deskIsCR = d.isControlRoom || (d.location && d.location.toLowerCase().includes("control"));
      const deskTitle = d.location || "Main Desk / Office";

      let fieldsHtml = "";

      // 1. Mobile Number
      if (d.cug) {
        fieldsHtml += `
          <div class="field-row">
            <span class="field-label">CUG</span>
            <a href="tel:${d.cug}" class="phone-link">📞 ${d.cug}</a>
          </div>
        `;
      }

      // 2. Email
      if (d.email) {
        fieldsHtml += `
          <div class="field-row">
            <span class="field-label">EMAIL</span>
            <a href="mailto:${d.email}" class="email-link">✉️ ${d.email}</a>
          </div>
        `;
      }

      // 3. IPPBX
      if (d.ippbx) {
        fieldsHtml += `
          <div class="field-row">
            <span class="field-label">IPPBX</span>
            <div class="ippbx-wrapper">
              <span class="ippbx-code">Ext: ${d.ippbx}</span>
              <button type="button" class="copy-pill-btn" onclick="copyToClipboard('${d.ippbx}', this)">Copy</button>
            </div>
          </div>
        `;
      }

      if (!fieldsHtml) {
        fieldsHtml = `<div class="field-row" style="color:var(--text-muted); font-size:0.72rem;">No direct contact registered</div>`;
      }

      item.innerHTML = `
        <div class="desk-item-header">
          <span class="desk-name">${deskTitle}</span>
          ${deskIsCR ? `<span class="badge-cr">CR Desk</span>` : ''}
        </div>
        <div class="desk-fields-stack">
          ${fieldsHtml}
        </div>
      `;
      panel.appendChild(item);
    });

    card.appendChild(panel);
    container.appendChild(card);
  });
}
