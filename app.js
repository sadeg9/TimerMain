// ---------------- Firebase ----------------
const firebaseConfig = {
  apiKey: "AIzaSyAPRz1u4IY72v3SGtvlU0MNbCbNo_rVGmI",
  authDomain: "timerdata-29980.firebaseapp.com",
  projectId: "timerdata-29980",
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ---------------- Elements ----------------
const loginBtn = document.getElementById("loginBtn");
const clockEl = document.getElementById("clock");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const classSelect = document.getElementById("classSelect");
const manageClassesBtn = document.getElementById("manageClassesBtn");
const classModal = document.getElementById("classModal");
const addClassBtn = document.getElementById("addClassBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const classNameInput = document.getElementById("classNameInput");
const classTagInput = document.getElementById("classTagInput");
const classList = document.getElementById("classList");
const tasksDiv = document.getElementById("tasks");

// Text stats
const statTotalHours = document.getElementById("statTotalHours");
const statTopClass = document.getElementById("statTopClass");
const statTopTag = document.getElementById("statTopTag");
const statLongestSession = document.getElementById("statLongestSession");
const statAverageSession = document.getElementById("statAverageSession");
const statLastClass = document.getElementById("statLastClass");

// Charts
let pieChart = null;
let barChart = null;
let lineChart = null;



// ---------------- Auth ----------------
loginBtn.onclick = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider);
};

auth.onAuthStateChanged(user => {
  if (user) {
      loginBtn.textContent = "Signed In";
      loginBtn.disabled = true;
      loadEntries();
  } else {
      loginBtn.textContent = "Sign in";
      loginBtn.disabled = false;
  }
});

// ---------------- Timer ----------------
let startTime = null;
let interval = null;

function format(ms) {
  const t = Math.floor(ms / 1000);
  const h = String(Math.floor(t / 3600)).padStart(2, "0");
  const m = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
  const s = String(t % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

startBtn.onclick = () => {
  if (!classSelect.value || interval) return;
  startTime = Date.now();
  interval = setInterval(() => {
      clockEl.textContent = format(Date.now() - startTime);
  }, 1000);
};

stopBtn.onclick = async () => {
  if (!startTime || !classSelect.value) return;
  clearInterval(interval);
  interval = null;

  const elapsedSeconds = (Date.now() - startTime) / 1000;
  clockEl.textContent = "00:00:00";
  startTime = null;

  const classes = getClasses();
  const selectedClass = classes[classSelect.value];
  const user = auth.currentUser;
  if (!user) return;

  await db.collection("entries").add({
      uid: user.uid,
      className: selectedClass.name,
      tag: selectedClass.tag,
      seconds: elapsedSeconds,
      timestamp: new Date(),
  });

  loadEntries();
};

// ---------------- Classes ----------------
function getClasses() {
  return JSON.parse(localStorage.getItem("classes") || "[]");
}

function saveClasses(classes) {
  localStorage.setItem("classes", JSON.stringify(classes));
}

function loadClasses() {
  const classes = getClasses();
  classSelect.innerHTML = `<option value="">Select class</option>`;
  classList.innerHTML = "";

  classes.forEach((c, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `${c.name} (${c.tag})`;
      classSelect.appendChild(opt);

      const div = document.createElement("div");
      div.innerHTML = `${c.name} (${c.tag}) <button onclick="deleteClass(${i})">✕</button>`;
      classList.appendChild(div);
  });
}

addClassBtn.onclick = () => {
  const name = classNameInput.value.trim();
  const tag = classTagInput.value.trim();
  if (!name || !tag) return;

  const classes = getClasses();
  classes.push({ name, tag });
  saveClasses(classes);
  loadClasses();
};

window.deleteClass = i => {
  const classes = getClasses();
  classes.splice(i, 1);
  saveClasses(classes);
  loadClasses();
};

manageClassesBtn.onclick = () => classModal.classList.remove("hidden");
closeModalBtn.onclick = () => classModal.classList.add("hidden");

loadClasses();

// ---------------- Helpers ----------------
function getTopKey(obj) {
  let max = 0, top = "—";
  for (const k in obj) if (obj[k] > max) { max = obj[k]; top = k; }
  return top;
}

// --- Local date key helper ---
function getLocalDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------------- Load Entries + Stats ----------------
async function loadEntries() {
  const user = auth.currentUser;
  if (!user) return;

  const snapshot = await db
      .collection("entries")
      .where("uid", "==", user.uid)
      .orderBy("timestamp", "desc")
      .limit(100)
      .get();

  tasksDiv.innerHTML = "";

  const tagTotals = {};
  const classTotals = {};
  let totalSeconds = 0;
  let longest = 0;
  let shortest = Infinity;
  let count = 0;
  let lastClass = "—";
  let cumulative = 0;
  const cumulativeData = [];

  const entries = snapshot.docs.map(doc => doc.data());

  entries.slice(0, 7).forEach(e => {
      const d = e.timestamp.toDate();
      tasksDiv.innerHTML += `<div>${d.toLocaleString()} — ${e.className} (${e.tag}): ${(e.seconds / 3600).toFixed(2)}h</div>`;
  });

  entries.forEach((e, i) => {
      totalSeconds += e.seconds;
      count++;
      longest = Math.max(longest, e.seconds);
      shortest = Math.min(shortest, e.seconds);

      tagTotals[e.tag] = (tagTotals[e.tag] || 0) + e.seconds;
      classTotals[e.className] = (classTotals[e.className] || 0) + e.seconds;

      if (i === 0) lastClass = e.className;

      cumulative += e.seconds;
      cumulativeData.push(cumulative / 3600);
  });

  statTotalHours.textContent = (totalSeconds / 3600).toFixed(2);
  statTopClass.textContent = getTopKey(classTotals);
  statTopTag.textContent = getTopKey(tagTotals);
  statLongestSession.textContent = `${(longest / 3600).toFixed(2)}h`;
  statAverageSession.textContent = `${(totalSeconds / count / 3600).toFixed(2)}h`;
  statLastClass.textContent = lastClass;

  const summaryList = document.querySelector(".text-stats");
  if (!document.getElementById("statTotalSessions")) {
      const li1 = document.createElement("li");
      li1.innerHTML = `Total Sessions: <span id="statTotalSessions">${count}</span>`;
      summaryList.appendChild(li1);

      const li2 = document.createElement("li");
      li2.innerHTML = `Shortest Session: <span id="statShortestSession">${(shortest / 3600).toFixed(2)}h</span>`;
      summaryList.appendChild(li2);
  } else {
      document.getElementById("statTotalSessions").textContent = count;
      document.getElementById("statShortestSession").textContent = (shortest / 3600).toFixed(2);
  }

  renderPieChart(tagTotals);
  renderBarChart(classTotals);
  renderLineChart(cumulativeData);

  updateCalendarHeatMap(entries);
}

// ---------------- Charts ----------------
Chart.defaults.color = "#9ca3af";
Chart.defaults.font.family =
  'system-ui, -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.plugins.tooltip.backgroundColor = "#111218";
Chart.defaults.plugins.tooltip.borderWidth = 0;
Chart.defaults.plugins.tooltip.titleColor = "#e5e7eb";
Chart.defaults.plugins.tooltip.bodyColor = "#c7c7d1";
Chart.defaults.plugins.tooltip.padding = 8;

// Pie chart
function renderPieChart(tagTotals) {
  const ctx = document.getElementById("pieChart");
  if (!ctx) return;

  const labels = Object.keys(tagTotals);
  const data = Object.values(tagTotals).map(v => v / 3600);

  if (pieChart) {
      pieChart.data.labels = labels;
      pieChart.data.datasets[0].data = data;
      pieChart.update();
      return;
  }

  pieChart = new Chart(ctx, {
      type: "pie",
      data: {
          labels,
          datasets: [{
              data,
              backgroundColor: [
                  "rgba(69, 178, 230,0.45)",
                  "rgba(69, 77, 230,0.45)",
                  "rgba(69, 129, 230,0.45)",
                  "rgba(69, 229, 230,0.45)",
                  "rgba(110, 64, 230,0.45)",
              ],
              borderWidth: 0,
              hoverOffset: 6
          }]
      },
      options: { plugins: { legend: { position: "bottom", labels: { color: "#9ca3af" } } } }
  });
}

// Bar chart (top 5 only)
function renderBarChart(classTotals) {
  const ctx = document.getElementById("barChart");
  if (!ctx) return;

  const sorted = Object.entries(classTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

  const labels = sorted.map(([name]) => name);
  const data = sorted.map(([, seconds]) => seconds / 3600);

  if (barChart) {
      barChart.data.labels = labels;
      barChart.data.datasets[0].data = data;
      barChart.update();
      return;
  }

  barChart = new Chart(ctx, {
      type: "bar",
      data: {
          labels,
          datasets: [{ data, backgroundColor: "rgba(69, 178, 230,.45)", borderWidth: 0, borderRadius: 6 }]
      },
      options: {
          plugins: { legend: { display: false } },
          scales: {
              x: { grid: { display: false }, border: { display: false }, ticks: { color: "#6b7280" } },
              y: { grid: { color: "rgba(255,255,255,.04)" }, border: { display: false }, ticks: { color: "#6b7280" } }
          }
      }
  });
}

// Line chart
function renderLineChart(cumulativeData) {
  const ctx = document.getElementById("lineChart");
  if (!ctx) return;

  if (lineChart) {
      lineChart.data.labels = cumulativeData.map((_, i) => i + 1);
      lineChart.data.datasets[0].data = cumulativeData;
      lineChart.update();
      return;
  }

  lineChart = new Chart(ctx, {
      type: "line",
      data: { labels: cumulativeData.map((_, i) => i + 1), datasets: [{ data: cumulativeData, borderColor: "rgba(69, 229, 230.45)", borderWidth: 2, tension: 0.35, pointRadius: 0, fill: false }] },
      options: {
          plugins: { legend: { display: false } },
          scales: {
              x: { grid: { display: false }, border: { display: false }, ticks: { color: "#6b7280" } },
              y: { grid: { color: "rgba(255,255,255,.04)" }, border: { display: false }, ticks: { color: "#6b7280" } }
          }
      }
  });
}

// ---------------- Calendar ----------------
const calendarGrid = document.getElementById("calendarGrid");
const calendarMonths = document.getElementById("calendarMonths");
let calendarDays = []; // store divs for reuse

// Calendar tooltip
const calendarTooltip = document.createElement("div");
calendarTooltip.style.position = "absolute";
calendarTooltip.style.background = "#111218";
calendarTooltip.style.color = "#fff";
calendarTooltip.style.padding = "4px 8px";
calendarTooltip.style.borderRadius = "4px";
calendarTooltip.style.fontSize = "12px";
calendarTooltip.style.pointerEvents = "none";
calendarTooltip.style.opacity = "0";
calendarTooltip.style.transition = "opacity 0.15s";
calendarTooltip.style.zIndex = "1000";
document.body.appendChild(calendarTooltip);

// Helper: local YYYY-MM-DD key
function getLocalDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

// Convert hex to RGB
function hexToRgb(hex) {
    hex = hex.replace(/^#/, "");
    if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
    const bigint = parseInt(hex, 16);
    return [ (bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255 ];
}

// Lerp between two RGB colors
function lerpColor(base, target, t) {
    return base.map((v, i) => Math.round(v + (target[i] - v) * t));
}

// ---- Configurable colors ----
const baseRGB = [31, 32, 42];       // dark square base
const maxPinkHex = "#EA114F";       // max intensity overlay
const maxPinkRGB = hexToRgb(maxPinkHex);

// Generate calendar grid
function generateCalendarGrid(days = 365) {
    if (calendarDays.length) return;

    calendarGrid.innerHTML = "";
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (days - 1));
    const firstDayOfWeek = startDate.getDay();
    const totalCols = Math.ceil((days + firstDayOfWeek) / 7);

    for (let col = 0; col < totalCols; col++) {
        for (let row = 0; row < 7; row++) {
            const dayOffset = col * 7 + row - firstDayOfWeek;
            const div = document.createElement("div");
            div.classList.add("day");

            if (dayOffset >= 0 && dayOffset < days) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + dayOffset);
                div.dataset.date = getLocalDateKey(date);
                div.title = `${date.toDateString()} — 0h`;
                div.style.backgroundColor = `rgb(${baseRGB.join(",")})`;
            } else {
                div.style.visibility = "hidden";
            }

            calendarDays.push(div);
            calendarGrid.appendChild(div);
        }
    }

    generateMonthLabels(startDate, days, firstDayOfWeek);
    attachCalendarTooltips();
}

// Generate month labels
function generateMonthLabels(startDate, days, firstDayOfWeek) {
    calendarMonths.innerHTML = "";
    let lastMonth = null;
    const firstDay = new Date(startDate);

    for (let i = 0; i < days; i++) {
        const date = new Date(firstDay);
        date.setDate(firstDay.getDate() + i);
        const month = date.toLocaleString("default", { month: "short" });

        if (month !== lastMonth) {
            const dayOffset = i + firstDayOfWeek;
            const col = Math.floor(dayOffset / 7) + 1;
            const div = document.createElement("div");
            div.textContent = month;
            div.style.gridColumnStart = col;
            calendarMonths.appendChild(div);
            lastMonth = month;
        }
    }
}

// Update calendar heatmap
function updateCalendarHeatMap(entries) {
    const dayTotals = {};
    entries.forEach(e => {
        const day = getLocalDateKey(e.timestamp.toDate());
        dayTotals[day] = (dayTotals[day] || 0) + e.seconds;
    });

    const maxSeconds = Math.max(...Object.values(dayTotals), 0);

    calendarDays.forEach(div => {
        const day = div.dataset.date;
        if (!day) return;

        const seconds = dayTotals[day] || 0;
        const hours = (seconds / 3600).toFixed(2);

        const [y, m, d] = day.split("-");
        const localDate = new Date(y, m - 1, d);
        div.title = `${localDate.toDateString()} — ${hours}h`;

        // intensity 0 → 1
        const t = maxSeconds > 0 ? seconds / maxSeconds : 0;
        const rgb = lerpColor(baseRGB, maxPinkRGB, t);
        div.style.backgroundColor = `rgb(${rgb.join(",")})`;
    });
}

// Attach tooltips
function attachCalendarTooltips() {
    calendarDays.forEach(day => {
        day.addEventListener("mousemove", e => {
            calendarTooltip.textContent = day.title;
            calendarTooltip.style.left = e.pageX + 10 + "px";
            calendarTooltip.style.top = e.pageY + 10 + "px";
            calendarTooltip.style.opacity = "1";
        });
        day.addEventListener("mouseleave", () => {
            calendarTooltip.style.opacity = "0";
        });
    });
}

// Initialize calendar
generateCalendarGrid(365);
