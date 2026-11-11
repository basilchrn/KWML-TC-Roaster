/**
 * ==============================================================================
 * kwml-TC-roaster Application Engine (All 5 Features Implemented)
 * ==============================================================================
 */

// PASTE YOUR DEPLOYED WEB APP URL HERE:
const ROSTER_API_URL = "https://script.google.com/macros/s/AKfycbykN4mMJGGLj4TMPjIsWRV0LOybogm_-d7k3uBIyICSpy3TOtw-A8byAhPak_tSJq7l/exec";
const CACHE_KEY = "kwml_tc_roaster_cache_v3";

let appData = null;
let indvCalDate = new Date();
let termCalDate = new Date();
let currentMonday = new Date();
let selectedTC = "";
let selectedTerminal = "";
let activeContactFilter = 'ALL';
let expandedFacilities = new Set();

// 5-Character Name Cropper with '..'
function fmtName(name) {
  if (!name) return "";
  const cleaned = String(name).trim();
  return cleaned.length > 5 ? cleaned.slice(0, 5) + ".." : cleaned;
}

// 16 Standard Terminals + Ancillary Offices
const ORDERED_TERMINALS = [
  "HIGHCOURT", "VYTILLA", "SOUTH CHITTOOR", "FORT KOCHI", "KAKKANAD", 
  "VYPIN", "BOLGATTY", "CHERANALLOOR", "ELOOR", "MULAVUKAD NORTH", 
  "MATTANCHERRY", "W. ISLAND", "OCC", "AFC", "NIGHT", "MAINTENANCE"
];

const ANCILLARY_OFFICES = [
  "OCC OFFICE", "HEAD OFFICE", "CSL, OCC/OTHER TERMINALS"
];

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
  "NIGHT":           { text: "#818cf8", bg: "rgba(129, 140, 248, 0.20)", border: "rgba(129, 140, 248, 0.50)", abbr: "NYT" },
  "MAINTENANCE":     { text: "#cbd5e1", bg: "rgba(203, 213, 225, 0.20)", border: "rgba(203, 213, 225, 0.50)", abbr: "MNT" },
  "OCC OFFICE":      { text: "#94a3b8", bg: "rgba(148, 163, 184, 0.20)", border: "rgba(148, 163, 184, 0.50)", abbr: "OFH" },
  "HEAD OFFICE":     { text: "#94a3b8", bg: "rgba(148, 163, 184, 0.20)", border: "rgba(148, 163, 184, 0.50)", abbr: "HO" }
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

// Lifecycle Init
document.addEventListener("DOMContentLoaded", () => {
  loadCachedDataFirst();
  fetchRosterData();
});

function loadCachedDataFirst() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      if (data && data.status === "success") {
        appData = data;
        alignAnchors();
        populateClusters();
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
    populateClusters();
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

// Populate Clustered Selection Bars
function populateClusters() {
  if (!appData || !appData.metadata) return;

  // 1. TC Clustered Bar
  const tcBar = document.getElementById("tcClusterBar");
  tcBar.innerHTML = "";
  const validIndividuals = (appData.metadata.individuals || []).filter(name => {
    const s = String(name).trim();
    return s && !s.startsWith("#") && s.toLowerCase() !== "null";
  });

  if (!selectedTC && validIndividuals.length > 0) {
    selectedTC = validIndividuals[0];
  }

  validIndividuals.forEach(name => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `cluster-chip ${name === selectedTC ? 'chip-active' : ''}`;
    chip.textContent = fmtName(name);
    chip.title = name;
    chip.onclick = () => {
      selectedTC = name;
      document.querySelectorAll("#tcClusterBar .cluster-chip").forEach(c => c.classList.remove("chip-active"));
      chip.classList.add("chip-active");
      renderIndividualCalendar();
    };
    tcBar.appendChild(chip);
  });

  // 2. Terminal Clustered Bar
  const termBar = document.getElementById("termClusterBar");
  termBar.innerHTML = "";
  const validTerminals = (appData.metadata.terminals || []).filter(t => t.name && !t.name.startsWith("#"));

  if (!selectedTerminal && validTerminals.length > 0) {
    selectedTerminal = validTerminals[0].name;
  }

  validTerminals.forEach(t => {
    const theme = getTerminalTheme(t.name);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `terminal-chip-tag ${t.name === selectedTerminal ? 'chip-active' : ''}`;
    chip.style.backgroundColor = theme.bg;
    chip.style.color = theme.text;
    chip.style.borderColor = theme.border;
    chip.textContent = `${t.abbr}`;
    chip.title = t.name;
    chip.onclick = () => {
      selectedTerminal = t.name;
      document.querySelectorAll("#termClusterBar .terminal-chip-tag").forEach(c => c.classList.remove("chip-active"));
      chip.classList.add("chip-active");
      renderTerminalCalendar();
    };
    termBar.appendChild(chip);
  });

  renderIndividualCalendar();
  renderTerminalCalendar();
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
  const person = selectedTC;
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
  document.getElementById("indvMonthTitle").textContent = `${person} (${monthNames[month]} ${year})`;

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
  const term = selectedTerminal;
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

// 3. WEEKLY ROSTER MATRIX GRID (Rows: All 16 Terminals + Offices, Cols: Dates)
function changeWeek(delta) {
  currentMonday.setDate(currentMonday.getDate() + (delta * 7));
  renderWeeklyCalendar();
}

function jumpToCurrentWeek() {
  currentMonday = getWeekMonday(new Date());
  renderWeeklyCalendar();
}

function renderWeeklyCalendar() {
  const container = document.getElementById("weeklyMatrixContainer");
  const rangeLabel = document.getElementById("weeklyRangeLabel");
  container.innerHTML = "";

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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

  // Build Matrix Table
  const table = document.createElement("table");
  table.className = "roster-matrix-table";

  // Header Row
  let theadHtml = `
    <thead>
      <tr>
        <th class="sticky-term-col">Terminal / Station</th>
  `;
  weekDays.forEach(d => {
    const isToday = d.isoStr === todayIso;
    theadHtml += `
      <th class="${isToday ? 'matrix-header-active' : ''}">
        <div class="matrix-header-day">${d.dayName}</div>
        <div class="matrix-header-date">${d.displayShort}</div>
      </th>
    `;
  });
  theadHtml += `</tr></thead>`;
  table.innerHTML = theadHtml;

  const tbody = document.createElement("tbody");

  // Helper to render a row for a terminal or category
  function renderMatrixRow(stationName, isOff = false, isLeave = false) {
    const tr = document.createElement("tr");
    const theme = isOff ? { text: "#94a3b8", bg: "rgba(71, 85, 105, 0.2)", border: "rgba(71, 85, 105, 0.4)", abbr: "WO" }
                : (isLeave ? { text: "#fb7185", bg: "rgba(190, 18, 60, 0.25)", border: "rgba(190, 18, 60, 0.4)", abbr: "LV" }
                : getTerminalTheme(stationName));

    let rowHtml = `
      <td class="sticky-term-col">
        <div class="matrix-row-station">
          <span class="matrix-station-title" style="color:${theme.text};">${stationName}</span>
          <span class="matrix-station-badge" style="background:${theme.bg}; color:${theme.text}; border-color:${theme.border};">${theme.abbr}</span>
        </div>
      </td>
    `;

    weekDays.forEach(d => {
      // Find matching assignments
      const matches = (appData.assignments || []).filter(a => {
        if (a.date !== d.dateStr) return false;
        if (isOff) return a.isOff || ["O", "WO"].includes(a.slot.toUpperCase());
        if (isLeave) return a.isLeave && !a.isOff;
        return a.terminal.toUpperCase() === stationName.toUpperCase();
      });

      let cellHtml = `<div class="matrix-cell-content">`;
      if (matches.length > 0) {
        matches.sort((a, b) => (a.slot > b.slot ? 1 : -1));
        matches.forEach(item => {
          const shortName = fmtName(item.person);
          const badgeClass = item.isOff ? 'badge-wo' : (item.slot === 'EL' ? 'badge-lop' : (item.isLeave ? 'badge-maroon' : ''));
          const inlineStyle = !badgeClass ? `background:${theme.bg}; color:${theme.text}; border-color:${theme.border};` : '';

          cellHtml += `
            <div class="matrix-person-entry ${badgeClass}" style="${inlineStyle}" title="${item.person} (${item.slot})">
              <strong>${item.slot}</strong>
              <span class="name">${shortName}</span>
            </div>
          `;
        });
      } else {
        cellHtml += `<span style="color:rgba(255,255,255,0.06); font-size:0.6rem;">-</span>`;
      }
      cellHtml += `</div>`;

      rowHtml += `<td>${cellHtml}</td>`;
    });

    tr.innerHTML = rowHtml;
    return tr;
  }

  // Section 1: Passenger Terminals (All 16 Stations)
  const sec1 = document.createElement("tr");
  sec1.className = "matrix-section-divider";
  sec1.innerHTML = `<td colspan="8">🚢 Passenger Water Metro Terminals</td>`;
  tbody.appendChild(sec1);

  ORDERED_TERMINALS.forEach(termName => {
    tbody.appendChild(renderMatrixRow(termName));
  });

  // Section 2: Ancillary & Operational Offices
  const sec2 = document.createElement("tr");
  sec2.className = "matrix-section-divider";
  sec2.innerHTML = `<td colspan="8">🏢 Ancillary & Administrative Offices</td>`;
  tbody.appendChild(sec2);

  ANCILLARY_OFFICES.forEach(offName => {
    tbody.appendChild(renderMatrixRow(offName));
  });

  // Section 3: Staff Rest & Leaves
  const sec3 = document.createElement("tr");
  sec3.className = "matrix-section-divider";
  sec3.innerHTML = `<td colspan="8">🛌 Rest Days & Leave Logs</td>`;
  tbody.appendChild(sec3);

  tbody.appendChild(renderMatrixRow("WEEKLY OFF", true, false));
  tbody.appendChild(renderMatrixRow("LEAVES & C-OFF", false, true));

  table.appendChild(tbody);
  container.appendChild(table);
}

// 4. QUICK SEARCH & TODAY MODAL SYSTEM
function openTodayModal() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const todayStr = `${d}-${m}-${y}`;

  openSearchResultModal(`Roster for Today (${todayStr})`, (appData.assignments || []).filter(a => a.date === todayStr));
}

function handleHeroSearch(q) {
  const query = (q || "").trim().toLowerCase();
  if (!query || query.length < 2) return;

  const matches = (appData.assignments || []).filter(a => 
    a.person.toLowerCase().includes(query) || 
    a.terminal.toLowerCase().includes(query) ||
    a.slot.toLowerCase() === query
  );

  openSearchResultModal(`Search Results for "${q}"`, matches);
}

function openSearchResultModal(title, results) {
  const overlay = document.getElementById("searchModalOverlay");
  const titleEl = document.getElementById("searchModalTitle");
  const bodyEl = document.getElementById("searchModalBody");

  titleEl.textContent = title;
  bodyEl.innerHTML = "";

  if (results.length === 0) {
    bodyEl.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted);">No records found.</div>`;
  } else {
    results.forEach(r => {
      const theme = getTerminalTheme(r.terminal);
      const row = document.createElement("div");
      row.className = "detail-row";
      row.style.marginBottom = "6px";
      row.innerHTML = `
        <div>
          <strong>${r.person}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${r.date} (${r.day})</div>
        </div>
        <div style="text-align:right;">
          <span class="cal-badge-2line" style="width:auto; padding:2px 8px; background:${theme.bg}; color:${theme.text}; border-color:${theme.border};">
            ${r.slot} • ${theme.abbr}
          </span>
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">${r.terminal}</div>
        </div>
      `;
      bodyEl.appendChild(row);
    });
  }

  overlay.classList.add("is-active");
}

function closeSearchModal() {
  document.getElementById("searchModalOverlay").classList.remove("is-active");
}

// 5. CONTACTS DIRECTORY
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
      if (d.cug) {
        fieldsHtml += `
          <div class="field-row">
            <span class="field-label">CUG</span>
            <a href="tel:${d.cug}" class="phone-link">📞 ${d.cug}</a>
          </div>
        `;
      }
      if (d.email) {
        fieldsHtml += `
          <div class="field-row">
            <span class="field-label">EMAIL</span>
            <a href="mailto:${d.email}" class="email-link">✉️ ${d.email}</a>
          </div>
        `;
      }
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
