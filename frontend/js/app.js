let currentUser = null;
let studentData = null;
let allCourses = [];

// --- Toast & Theme ---
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => el.classList.add("hidden"), 4200);
}

document.getElementById("theme-toggle").addEventListener("click", () => {
  const html = document.documentElement;
  const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  document.getElementById("theme-label").textContent = next === "dark" ? "Light" : "Dark";
});

// --- Bubbles Transition Navigation ---
// Replace navigateTo() with this:
function navigateTo(view) {
  sessionStorage.setItem("uni_view", view);
  const bubbles = document.getElementById("bubbles");
  bubbles.classList.add("covering");

  setTimeout(() => {
    renderView(view);
  }, 460);

  setTimeout(() => {
    bubbles.classList.remove("covering");
  }, 960);
}

function updateNav() {
  const linksEl = document.getElementById("nav-links");
  const logoutBtn = document.getElementById("logout-btn");

  if (!currentUser) {
    logoutBtn.classList.add("hidden");
    linksEl.innerHTML = `
      <ul>
        <li onclick="navigateTo('landing')">Overview</li>
        <li onclick="navigateTo('auth')">Student / Admin Portal</li>
      </ul>`;
    return;
  }

  logoutBtn.classList.remove("hidden");
  if (currentUser.role === "admin") {
    linksEl.innerHTML = `
      <ul>
        <li onclick="navigateTo('admin')">Admin Console</li>
        <li onclick="navigateTo('catalog')">Course Catalog</li>
      </ul>`;
  } else {
    linksEl.innerHTML = `
      <ul>
        <li onclick="navigateTo('dashboard')">My Dashboard & Schedule</li>
        <li onclick="navigateTo('catalog')">Browse Courses</li>
      </ul>`;
  }
}

function logout() {
  api.clearToken();
  currentUser = null;
  updateNav();
  navigateTo("landing");
  showToast("Signed out.");
}

// --- Views ---
function renderView(view) {
  const app = document.getElementById("app");

  if (view === "landing") {
    app.innerHTML = `
      <section class="typed-message-page">
        <div class="typed-message-wrapper">
          <p class="editorial-serif" style="color: var(--accent); font-size: 20px; margin-bottom: 12px;">
            Fall 2026 Academic Registration
          </p>
          <h1 class="message">Register Smarter.<br/>Zero Time Conflicts.</h1>
          <p class="hero-sub">
            Real-time seat tracking, automated prerequisite & credit-hour validation, instant waitlists, and interactive weekly timetables.
          </p>
          <button class="hero-cta" onclick="navigateTo('${currentUser ? (currentUser.role === 'admin' ? 'admin' : 'dashboard') : 'auth'}')">
            <span>${currentUser ? "Open Workspace" : "Enter Registration Portal"}</span>
            <span class="material-symbols-outlined">arrow_outward</span>
          </button>
        </div>
      </section>`;

    if (window.gsap && window.SplitText) {
      const split = new SplitText(".message", { type: "lines,words" });
      gsap.fromTo(split.words, { yPercent: 80, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.12, ease: "circ.out" });
    }
    return;
  }

  if (view === "auth") {
    app.innerHTML = `
      <div class="auth-stage">
        <div class="auth-card">
          <input type="checkbox" id="toggle" class="toggle" />
          <div class="card-bg card-bg-1"></div>
          <div class="card-bg card-bg-2"></div>

          <div class="switch login">
            <label for="toggle">New Student? Sign up <span class="material-symbols-outlined" style="font-size:18px">arrow_forward</span></label>
          </div>
          <div class="switch register">
            <label for="toggle">Have an account? Login <span class="material-symbols-outlined" style="font-size:18px">arrow_forward</span></label>
          </div>

          <div class="form-box login">
            <form onsubmit="handleLogin(event)">
              <h3>Portal Sign In</h3>
              <input class="input-field" id="login-email" type="email" placeholder="University Email" required />
              <input class="input-field" id="login-pass" type="password" placeholder="Password" required />
              <button class="btn-primary" type="submit">Sign In</button>
              <div class="demo-pills">
                <button type="button" onclick="fillDemo('mohamed@uni.edu','student123')">Student Demo</button>
                <button type="button" onclick="fillDemo('omar@uni.edu','student123')">Banned Demo</button>
                <button type="button" onclick="fillDemo('admin@uni.edu','admin123')">Admin Demo</button>
              </div>
            </form>
          </div>

          <div class="form-box register">
            <form onsubmit="handleRegister(event)">
              <h3>Student Sign Up</h3>
              <input class="input-field" id="reg-sid" type="text" placeholder="Student ID (e.g. 2026099)" required />
              <input class="input-field" id="reg-name" type="text" placeholder="Full Name" required />
              <input class="input-field" id="reg-email" type="email" placeholder="Email Address" required />
              <input class="input-field" id="reg-pass" type="password" placeholder="Create Password" required />
              <button class="btn-primary" type="submit">Create Account</button>
            </form>
          </div>
        </div>
      </div>`;
    return;
  }

  if (view === "dashboard") return renderStudentDashboard();
  if (view === "catalog") return renderCatalog();
  if (view === "admin") return renderAdminDashboard();
}

function fillDemo(email, pass) {
  document.getElementById("login-email").value = email;
  document.getElementById("login-pass").value = pass;
}

async function handleLogin(e) {
  e.preventDefault();
  try {
    const res = await api.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.getElementById("login-email").value,
        password: document.getElementById("login-pass").value,
      }),
    });
    api.setToken(res.token);
    currentUser = res.user;
    updateNav();
    showToast(`Welcome back, ${currentUser.full_name}`);
    navigateTo(currentUser.role === "admin" ? "admin" : "dashboard");
  } catch (err) {
    showToast(err.message || "Login failed.");
  }
}

async function handleRegister(e) {
  e.preventDefault();
  try {
    const res = await api.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        student_id: document.getElementById("reg-sid").value,
        full_name: document.getElementById("reg-name").value,
        email: document.getElementById("reg-email").value,
        password: document.getElementById("reg-pass").value,
      }),
    });
    api.setToken(res.token);
    currentUser = res.user;
    updateNav();
    showToast("Account created! Welcome to NEXUS.EDU.");
    navigateTo("dashboard");
  } catch (err) {
    showToast(err.message || "Registration failed.");
  }
}

// =========================================
// STUDENT DASHBOARD & WEEKLY TIMETABLE
// =========================================
async function renderStudentDashboard() {
  const app = document.getElementById("app");
  studentData = await api.request("/student/profile");
  const { profile, schedule, waitlist, completed } = studentData;

  const holdBanner = profile.is_banned
    ? `<div style="background: var(--accent-glow); border: 1px solid var(--accent); padding: 16px 20px; border-radius: 18px; margin-bottom: 24px;">
         <strong>ACCOUNT HOLD ACTIVE:</strong> ${profile.ban_reason}
       </div>`
    : "";

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu"];
  const timeSlots = ["09:00", "10:00", "11:00", "13:00", "15:00"];

  const timetableRows = timeSlots
    .map((slot) => {
      const cells = days
        .map((day) => {
          const match = schedule.find((c) => c.schedule_days.includes(day) && c.start_time === slot);
          if (!match) return `<td style="color: var(--text-muted)">—</td>`;
          return `<td class="slot-filled">
                    <strong>${match.course_code}</strong><br/>
                    <span style="font-size:11px">${match.start_time}–${match.end_time} &bull; ${match.room}</span>
                  </td>`;
        })
        .join("");
      return `<tr><th>${slot}</th>${cells}</tr>`;
    })
    .join("");

  app.innerHTML = `
    <div class="container">
      ${holdBanner}
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:24px;">
        <div>
          <h1 style="margin:0">${profile.full_name}</h1>
          <p style="margin:4px 0 0; color:var(--text-muted)">ID: ${profile.student_id} &bull; ${profile.email}</p>
        </div>
        <button class="hero-cta" style="padding:12px 24px; font-size:14px;" onclick="navigateTo('catalog')">+ Browse Courses</button>
      </div>

      <div class="stats-grid">
        <div class="stat-box"><div class="label">Cumulative GPA</div><div class="value"><em>${profile.gpa.toFixed(2)}</em> / 4.0</div></div>
        <div class="stat-box"><div class="label">Registered Load</div><div class="value"><em>${profile.current_registered_credits}</em> / ${profile.max_credit_limit} hrs</div></div>
        <div class="stat-box"><div class="label">Completed Credits</div><div class="value">${profile.completed_credits} hrs</div></div>
        <div class="stat-box"><div class="label">Remaining to Degree</div><div class="value">${profile.remaining_credits} hrs</div></div>
      </div>

      <h2>Weekly Timetable</h2>
      <div class="timetable-wrap">
        <table class="timetable">
          <thead><tr><th>Time</th>${days.map((d) => `<th>${d}</th>`).join("")}</tr></thead>
          <tbody>${timetableRows}</tbody>
        </table>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:24px; margin-top:32px;">
        <div>
          <h2>Registered Courses (${schedule.length})</h2>
          ${schedule.length === 0 ? `<p style="color:var(--text-muted)">No active enrollments.</p>` : schedule.map((c) => `
            <div class="course-card" style="margin-bottom:12px;">
              <div>
                <span class="course-code-pill">${c.course_code} &bull; ${c.credit_hours} CR</span>
                <h4>${c.title}</h4>
                <div class="course-meta">${c.instructor} &bull; ${c.schedule_days.join(", ")} ${c.start_time}-${c.end_time}</div>
              </div>
              <button class="icon-pill" style="border-color:var(--accent); color:var(--accent);" onclick="dropCourse(${c.id})">Drop Course</button>
            </div>`).join("")}
        </div>

        <div>
          <h2>Active Waitlists (${waitlist.length}) & Completed (${completed.length})</h2>
          ${waitlist.map((w) => `
            <div class="course-card" style="margin-bottom:12px;">
              <div>
                <span class="course-code-pill">WAITLIST #${w.position}</span>
                <h4>${w.course_code}: ${w.title}</h4>
              </div>
              <button class="icon-pill" onclick="leaveWaitlist(${w.id})">Leave Waitlist</button>
            </div>`).join("")}
          ${completed.map((cc) => `
            <div class="stat-box" style="margin-bottom:10px; padding:14px 18px; display:flex; justify-content:space-between;">
              <span><strong>${cc.course_code}</strong> — ${cc.title}</span>
              <span style="color:var(--accent); font-weight:800;">Grade: ${cc.grade}</span>
            </div>`).join("")}
        </div>
      </div>
    </div>`;
}

// =========================================
// COURSE CATALOG (ACCORDION + SEARCH/FILTER + CARDS)
// =========================================
async function renderCatalog() {
  const app = document.getElementById("app");
  allCourses = await api.request("/courses");
  if (currentUser.role === "student") {
    studentData = await api.request("/student/profile");
  }

  const featured = allCourses.slice(0, 5);

  app.innerHTML = `
    <div class="container">
      <h1 style="margin:0 0 8px;">Fall 2026 Course Catalog</h1>
      <p style="color:var(--text-muted); margin:0 0 20px;">Featured Department Highlights</p>

      <!-- Image Accordion Spotlight -->
      <div class="image-accordion" id="featured-accordion">
        ${featured.map((c, idx) => `
          <div class="image-accordion-item ${idx === 0 ? "active" : ""}" onclick="activateAccordion(this)">
            <img src="${c.image_url}" alt="${c.title}" />
            <div class="content">
              <div>
                <h2>${c.course_code}</h2>
                <p>${c.title}</p>
              </div>
              <button class="icon-pill" onclick="event.stopPropagation(); openCourseModal(${c.id})">Details</button>
            </div>
          </div>`).join("")}
      </div>

      <!-- Search & Filter Controls -->
      <div class="filter-bar">
        <input id="search-input" type="text" placeholder="Search by code, title, or instructor..." oninput="filterCatalog()" />
        <select id="day-filter" onchange="filterCatalog()">
          <option value="">All Days</option>
          <option value="Sun">Sunday</option>
          <option value="Mon">Monday</option>
          <option value="Tue">Tuesday</option>
          <option value="Wed">Wednesday</option>
          <option value="Thu">Thursday</option>
        </select>
        <select id="avail-filter" onchange="filterCatalog()">
          <option value="">All Seats</option>
          <option value="true">Open Seats Only</option>
        </select>
      </div>

      <div class="courses-grid" id="catalog-grid"></div>
    </div>`;

  filterCatalog();
}

function activateAccordion(el) {
  document.querySelectorAll(".image-accordion-item").forEach((item) => item.classList.remove("active"));
  el.classList.add("active");
}

async function filterCatalog() {
  const search = document.getElementById("search-input").value;
  const day = document.getElementById("day-filter").value;
  const available = document.getElementById("avail-filter").value;

  const params = new URLSearchParams({ search, day, available });
  const list = await api.request(`/courses?${params.toString()}`);

  const enrolledIds = new Set((studentData?.schedule || []).map((c) => c.id));
  const waitlistIds = new Set((studentData?.waitlist || []).map((c) => c.id));
  const completedCodes = new Set((studentData?.completed || []).map((c) => c.course_code));

  document.getElementById("catalog-grid").innerHTML = list
    .map((c) => {
      const isFull = c.enrolled_count >= c.capacity;
      let actionBtn = "";

      if (currentUser.role === "student") {
        if (completedCodes.has(c.course_code)) {
          actionBtn = `<span class="seat-badge">Completed</span>`;
        } else if (enrolledIds.has(c.id)) {
          actionBtn = `<button class="icon-pill" style="border-color:var(--accent); color:var(--accent);" onclick="dropCourse(${c.id})">Drop</button>`;
        } else if (waitlistIds.has(c.id)) {
          actionBtn = `<button class="icon-pill" onclick="leaveWaitlist(${c.id})">Leave Waitlist</button>`;
        } else if (isFull) {
          actionBtn = `<button class="btn-primary" style="padding:0 16px; height:38px;" onclick="joinWaitlist(${c.id})">Join Waitlist</button>`;
        } else {
          actionBtn = `<button class="btn-primary" style="padding:0 16px; height:38px;" onclick="registerCourse(${c.id})">Register</button>`;
        }
      }

      return `
        <div class="course-card">
          <div>
            <span class="course-code-pill">${c.course_code} &bull; ${c.credit_hours} Credits</span>
            <h4>${c.title}</h4>
            <div class="course-meta">${c.instructor} &bull; ${c.room}</div>
          </div>
          <div>
            <div class="course-details-row">
              <span>${c.schedule_days.join(" / ")}</span>
              <strong>${c.start_time} – ${c.end_time}</strong>
            </div>
            <div class="card-footer">
              <span class="seat-badge ${isFull ? "full" : ""}">
                ${c.enrolled_count}/${c.capacity} Seats ${c.waitlist_count ? `(${c.waitlist_count} WL)` : ""}
              </span>
              <div style="display:flex; gap:8px;">
                <button class="icon-pill" onclick="openCourseModal(${c.id})">Info</button>
                ${actionBtn}
              </div>
            </div>
          </div>
        </div>`;
    })
    .join("");
}

async function openCourseModal(id) {
  const c = await api.request(`/courses/${id}`);
  const root = document.getElementById("modal-root");
  root.classList.remove("hidden");
  root.innerHTML = `
    <div class="modal-card" onclick="event.stopPropagation()">
      <span class="course-code-pill">${c.course_code} &bull; ${c.semester}</span>
      <h2 style="margin:6px 0 8px;">${c.title}</h2>
      <p style="color:var(--text-secondary); line-height:1.6;">${c.description}</p>
      <div class="course-details-row" style="margin-top:18px;">
        <span>Instructor: <strong>${c.instructor}</strong></span>
        <span>Credits: <strong>${c.credit_hours} hrs</strong></span>
      </div>
      <div class="course-details-row" style="border-top:0; padding-top:0;">
        <span>Schedule: <strong>${c.schedule_days.join(", ")} (${c.start_time}-${c.end_time})</strong></span>
        <span>Room: <strong>${c.room}</strong></span>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="seat-badge">${c.enrolled_count}/${c.capacity} Enrolled &bull; ${c.waitlist_count} Waitlisted</span>
        <button class="btn-primary" style="padding:0 24px;" onclick="document.getElementById('modal-root').classList.add('hidden')">Close</button>
      </div>
    </div>`;
}

function closeModal(e) {
  if (e.target.id === "modal-root") e.target.classList.add("hidden");
}

// --- Student Actions ---
async function registerCourse(courseId) {
  try {
    const res = await api.request("/enrollments/register", {
      method: "POST",
      body: JSON.stringify({ courseId }),
    });
    showToast(res.message);
    renderCatalog();
  } catch (err) {
    showToast(err.message);
  }
}

async function dropCourse(courseId) {
  try {
    const res = await api.request(`/enrollments/${courseId}`, { method: "DELETE" });
    showToast(res.auto_promoted ? `${res.message} (Waitlist promoted: ${res.auto_promoted})` : res.message);
    const activeMenu = document.querySelector("#app h1")?.textContent.includes("Catalog");
    activeMenu ? renderCatalog() : renderStudentDashboard();
  } catch (err) {
    showToast(err.message);
  }
}

async function joinWaitlist(courseId) {
  try {
    const res = await api.request(`/waitlist/${courseId}`, { method: "POST" });
    showToast(res.message);
    renderCatalog();
  } catch (err) {
    showToast(err.message);
  }
}

async function leaveWaitlist(courseId) {
  try {
    const res = await api.request(`/waitlist/${courseId}`, { method: "DELETE" });
    showToast(res.message);
    const activeMenu = document.querySelector("#app h1")?.textContent.includes("Catalog");
    activeMenu ? renderCatalog() : renderStudentDashboard();
  } catch (err) {
    showToast(err.message);
  }
}

// =========================================
// ADMIN DASHBOARD (CRUD, OVERRIDE, HOLDS)
// =========================================
async function renderAdminDashboard() {
  const app = document.getElementById("app");
  const [courses, students] = await Promise.all([
    api.request("/courses"),
    api.request("/admin/students"),
  ]);

  app.innerHTML = `
    <div class="container">
      <h1>Administrator Command Center</h1>

      <!-- Add Course & Force Override Grid -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap:24px; margin-bottom:36px;">
        <form class="stat-box" onsubmit="adminCreateCourse(event)" style="display:flex; flex-direction:column; gap:10px;">
          <h3 style="margin:0 0 6px;">+ Add New Course</h3>
          <div style="display:flex; gap:8px;">
            <input class="input-field" id="ac-code" placeholder="Code (CS405)" required />
            <input class="input-field" id="ac-credits" type="number" placeholder="Credits (3)" required />
            <input class="input-field" id="ac-cap" type="number" placeholder="Cap (30)" required />
          </div>
          <input class="input-field" id="ac-title" placeholder="Course Title" required />
          <input class="input-field" id="ac-inst" placeholder="Instructor Name" required />
          <div style="display:flex; gap:8px;">
            <input class="input-field" id="ac-days" placeholder="Days: Mon,Wed" required />
            <input class="input-field" id="ac-start" type="time" value="11:00" required />
            <input class="input-field" id="ac-end" type="time" value="12:30" required />
          </div>
          <input class="input-field" id="ac-room" placeholder="Room (Lab A-102)" required />
          <button class="btn-primary" type="submit">Publish Course</button>
        </form>

        <form class="stat-box" onsubmit="adminForceOverride(event)" style="display:flex; flex-direction:column; gap:12px;">
          <h3 style="margin:0 0 6px;">Force Enrollment Override</h3>
          <p style="margin:0; font-size:13px; color:var(--text-muted);">Bypass seat capacity limits to enroll a student directly into a full section.</p>
          <input class="input-field" id="ov-sid" placeholder="Student ID (e.g. 2026001)" required />
          <input class="input-field" id="ov-code" placeholder="Course Code (e.g. AI305)" required />
          <button class="btn-primary" type="submit">Execute Capacity Override</button>
        </form>
      </div>

      <!-- Course Capacity & Cascade Delete Management -->
      <h2>Manage Courses (${courses.length})</h2>
      <div class="timetable-wrap" style="margin-bottom:36px;">
        <table class="timetable">
          <thead><tr><th>Code</th><th>Title</th><th>Schedule</th><th>Enrolled / Cap</th><th>Actions</th></tr></thead>
          <tbody>
            ${courses.map((c) => `
              <tr>
                <td><strong>${c.course_code}</strong></td>
                <td style="text-align:left">${c.title}</td>
                <td>${c.schedule_days.join("/")} ${c.start_time}-${c.end_time}</td>
                <td>${c.enrolled_count} / <strong>${c.capacity}</strong></td>
                <td style="display:flex; gap:6px; justify-content:center;">
                  <button class="icon-pill" onclick="adminAdjustCap(${c.id}, ${c.capacity + 5})">+5 Seats</button>
                  <button class="icon-pill" style="border-color:var(--accent); color:var(--accent);" onclick="adminDeleteCourse(${c.id})">Delete</button>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>

      <!-- Student Records & Hold/Ban Management -->
      <h2>Student Records & Academic Holds (${students.length})</h2>
      <div class="courses-grid">
        ${students.map((s) => `
          <div class="course-card">
            <div>
              <span class="course-code-pill">${s.student_id} &bull; GPA ${s.gpa.toFixed(2)}</span>
              <h4>${s.full_name}</h4>
              <div class="course-meta">${s.email} &bull; Enrolled: ${s.enrolled_courses.map((ec) => ec.course_code).join(", ") || "None"}</div>
              ${s.is_banned ? `<p style="color:var(--accent); font-size:13px;"><strong>HOLD:</strong> ${s.ban_reason}</p>` : ""}
            </div>
            <button class="btn-primary" style="background:${s.is_banned ? "#333333" : "var(--accent)"}" onclick="adminToggleHold(${s.id}, ${s.is_banned ? 0 : 1})">
              ${s.is_banned ? "Lift Academic Hold" : "Apply Hold / Ban"}
            </button>
          </div>`).join("")}
      </div>
    </div>`;
}

async function adminCreateCourse(e) {
  e.preventDefault();
  try {
    await api.request("/admin/courses", {
      method: "POST",
      body: JSON.stringify({
        course_code: document.getElementById("ac-code").value,
        title: document.getElementById("ac-title").value,
        instructor: document.getElementById("ac-inst").value,
        credit_hours: document.getElementById("ac-credits").value,
        capacity: document.getElementById("ac-cap").value,
        schedule_days: document.getElementById("ac-days").value.split(",").map((d) => d.trim()),
        start_time: document.getElementById("ac-start").value,
        end_time: document.getElementById("ac-end").value,
        room: document.getElementById("ac-room").value,
      }),
    });
    showToast("Course created.");
    renderAdminDashboard();
  } catch (err) {
    showToast(err.message);
  }
}

async function adminAdjustCap(id, newCap) {
  await api.request(`/admin/courses/${id}`, {
    method: "PUT",
    body: JSON.stringify({ capacity: newCap }),
  });
  showToast(`Capacity updated to ${newCap}.`);
  renderAdminDashboard();
}

async function adminDeleteCourse(id) {
  await api.request(`/admin/courses/${id}`, { method: "DELETE" });
  showToast("Course deleted & cascaded from all student schedules/waitlists.");
  renderAdminDashboard();
}

async function adminForceOverride(e) {
  e.preventDefault();
  try {
    const res = await api.request("/admin/enrollments/override", {
      method: "POST",
      body: JSON.stringify({
        student_id_code: document.getElementById("ov-sid").value,
        course_code: document.getElementById("ov-code").value,
      }),
    });
    showToast(res.message);
    renderAdminDashboard();
  } catch (err) {
    showToast(err.message);
  }
}

async function adminToggleHold(studentId, banState) {
  const reason = banState ? prompt("Enter hold/ban reason:", "Academic / Bursar Hold") : null;
  if (banState && reason === null) return;
  await api.request(`/admin/students/${studentId}/hold`, {
    method: "PATCH",
    body: JSON.stringify({ is_banned: Boolean(banState), ban_reason: reason }),
  });
  showToast(banState ? "Hold applied." : "Hold lifted.");
  renderAdminDashboard();
}

// --- Boot ---
(async function init() {
  if (api.getToken()) {
    try {
      currentUser = await api.request("/auth/me");
    } catch {
      api.clearToken();
    }
  }
  updateNav();

  const savedView = sessionStorage.getItem("uni_view");
  if (currentUser && savedView && savedView !== "auth") {
    renderView(savedView);
  } else {
    renderView("landing");
  }
})();