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

// Calendar
const calendarGrid = document.getElementById("calendarGrid");
const calendarMonths = document.getElementById("calendarMonths");

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
  for (const k in obj) {
    if (obj[k] > max) {
      max = obj[k];
      top = k;
    }
  }
  return top;
}

// ✅ LOCAL DATE KEY (CRITICAL FIX)
function toLocalDateKey(date) {
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

  snapshot.forEach((doc, i) => {
    const e = doc.data();
    const d = e.timestamp.toDate();

    tasksDiv.innerHTML += `<div>${d.toLocaleString()} — ${e.className} (${e.tag}): ${(e.seconds / 3600).toFixed(2)}h</div>`;

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

  renderPieChart(tagTotals);
  renderBarChart(classTotals);
  renderLineChart(cumulativeData);

  const entries = snapshot.docs.map(doc => doc.data());
  updateCalendarHeatMap(entries);
}

// ---------------- Charts ----------------
function renderPieChart(tagTotals) {
  const ctx = document.getElementById("pieChart");
  if (!ctx) return;
  if (pieChart) pieChart.destroy();

  pieChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(tagTotals),
      datasets: [{
        data: Object.values(tagTotals).map(v => v / 3600),
        backgroundColor: ["#64748b", "#475569", "#334155", "#1e293b"],
        borderWidth: 0,
      }],
    },
    options: {
      plugins: { legend: { position: "bottom", labels: { color: "#cbd5e1" } } }
    },
  });
}

function renderBarChart(classTotals) {
  const ctx = document.getElementById("barChart");
  if (!ctx) return;
  if (barChart) barChart.destroy();

  const sorted = Object.entries(classTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map(e => e[0]),
      datasets: [{
        data: sorted.map(e => e[1] / 3600),
        backgroundColor: "#475569",
        borderWidth: 0,
      }],
    },
    options: { plugins: { legend: { display: false } } },
  });
}

function renderLineChart(cumulativeData) {
  const ctx = document.getElementById("lineChart");
  if (!ctx) return;
  if (lineChart) lineChart.destroy();

  lineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: cumulativeData.map((_, i) => i + 1),
      datasets: [{
        data: cumulativeData,
        borderColor: "#64748b",
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
      }],
    },
    options: { plugins: { legend: { display: false } } },
  });
}

// ---------------- Calendar Heatmap ----------------
function generateCalendarGrid(days = 365) {
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
        div.dataset.date = toLocalDateKey(date);
        div.title = `${date.toDateString()} — 0h`;
      } else {
        div.style.visibility = "hidden";
      }

      calendarGrid.appendChild(div);
    }
  }

  generateMonthLabels(startDate, days, firstDayOfWeek);
}

function generateMonthLabels(startDate, days, firstDayOfWeek) {
  calendarMonths.innerHTML = "";
  let lastMonth = null;

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const month = date.toLocaleString("default", { month: "short" });

    if (month !== lastMonth) {
      const col = Math.floor((i + firstDayOfWeek) / 7) + 1;
      const div = document.createElement("div");
      div.textContent = month;
      div.style.gridColumnStart = col;
      calendarMonths.appendChild(div);
      lastMonth = month;
    }
  }
}

function updateCalendarHeatMap(entries) {
  const dayTotals = {};

  entries.forEach(e => {
    const day = toLocalDateKey(e.timestamp.toDate());
    dayTotals[day] = (dayTotals[day] || 0) + e.seconds;
  });

  const maxSeconds = Math.max(...Object.values(dayTotals), 0);

  document.querySelectorAll("#calendarGrid .day").forEach(div => {
    const day = div.dataset.date;
    if (!day) return;

    const seconds = dayTotals[day] || 0;
    const hours = (seconds / 3600).toFixed(2);
    div.title = `${new Date(day).toDateString()} — ${hours}h`;

    div.style.backgroundColor =
      seconds === 0
        ? "rgba(90,90,90,.1)"
        : `rgba(100,116,139,${0.3 + 0.7 * (seconds / maxSeconds)})`;
  });
}

// ---------------- Init ----------------
generateCalendarGrid(365);
