const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "uni_reg_secret_2026";
const DEGREE_TOTAL_CREDITS = 144;

app.use(cors());
app.use(express.json());

// --- Helpers ---
const timeToMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const hasTimeConflict = (courseA, courseB) => {
  const daysA = JSON.parse(courseA.schedule_days);
  const daysB = JSON.parse(courseB.schedule_days);
  const sharedDays = daysA.filter((d) => daysB.includes(d));
  if (sharedDays.length === 0) return null;

  const startA = timeToMinutes(courseA.start_time);
  const endA = timeToMinutes(courseA.end_time);
  const startB = timeToMinutes(courseB.start_time);
  const endB = timeToMinutes(courseB.end_time);

  if (startA < endB && endA > startB) {
    return `${sharedDays.join("/")} ${courseB.start_time}-${courseB.end_time}`;
  }
  return null;
};

// Strict 5-Step Validation Engine
function validateEnrollment(userId, courseId, { skipCapacity = false } = {}) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(courseId);

  if (!user) return { ok: false, status: 404, code: "USER_NOT_FOUND", message: "Student record not found." };
  if (!course) return { ok: false, status: 404, code: "COURSE_NOT_FOUND", message: "Course not found." };

  // 1. Hold / Ban Check
  if (user.is_banned) {
    return {
      ok: false,
      status: 403,
      code: "ACCOUNT_HOLD",
      message: `Registration blocked due to active hold: ${user.ban_reason || "Contact Administration."}`,
    };
  }

  // 2. Duplicate / Completed Check
  const completed = db.prepare("SELECT * FROM completed_courses WHERE student_id = ? AND course_id = ?").get(userId, courseId);
  if (completed) {
    return {
      ok: false,
      status: 400,
      code: "ALREADY_COMPLETED",
      message: `You already completed ${course.course_code} (Grade: ${completed.grade}).`,
    };
  }

  const alreadyEnrolled = db.prepare("SELECT * FROM enrollments WHERE student_id = ? AND course_id = ?").get(userId, courseId);
  if (alreadyEnrolled) {
    return {
      ok: false,
      status: 400,
      code: "ALREADY_REGISTERED",
      message: `You are already registered in ${course.course_code}.`,
    };
  }

  // 3. Credit Hour Limit Check
  const enrolledCourses = db.prepare(`
    SELECT c.* FROM courses c
    JOIN enrollments e ON e.course_id = c.id
    WHERE e.student_id = ?
  `).all(userId);

  const currentCredits = enrolledCourses.reduce((sum, c) => sum + c.credit_hours, 0);
  if (currentCredits + course.credit_hours > user.max_credit_limit) {
    return {
      ok: false,
      status: 400,
      code: "CREDIT_LIMIT_EXCEEDED",
      message: `Credit limit exceeded (${currentCredits + course.credit_hours}/${user.max_credit_limit} hrs max).`,
    };
  }

  // 4. Time Conflict Check
  for (const existing of enrolledCourses) {
    const conflictSlot = hasTimeConflict(course, existing);
    if (conflictSlot) {
      return {
        ok: false,
        status: 400,
        code: "TIME_CONFLICT",
        message: `Time conflict with ${existing.course_code} (${existing.title}) on ${conflictSlot}.`,
      };
    }
  }

  // 5. Capacity Check
  if (!skipCapacity && course.enrolled_count >= course.capacity) {
    return {
      ok: false,
      status: 409,
      code: "COURSE_FULL",
      message: `${course.course_code} is full (${course.enrolled_count}/${course.capacity}). You can join the waitlist.`,
    };
  }

  return { ok: true, user, course };
}

// --- Auth Middleware ---
const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required." });
  }
  try {
    req.user = jwt.verify(header.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token." });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Administrator privileges required." });
  }
  next();
};

// ==========================================
// 1. AUTH ENDPOINTS
// ==========================================
app.post("/api/auth/register", (req, res) => {
  const { student_id, full_name, email, password } = req.body;
  if (!student_id || !full_name || !email || !password) {
    return res.status(400).json({ message: "All fields are required." });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (student_id, full_name, email, password_hash, role, gpa, completed_credits, max_credit_limit)
      VALUES (?, ?, ?, ?, 'student', 0.0, 0, 18)
    `).run(student_id.trim(), full_name.trim(), email.trim().toLowerCase(), hash);

    const user = db.prepare("SELECT id, student_id, full_name, email, role FROM users WHERE id = ?").get(result.lastInsertRowid);
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "12h" });
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(400).json({ message: "Student ID or Email already exists." });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get((email || "").trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ message: "Invalid email or password." });
  }
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "12h" });
  const { password_hash, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

app.get("/api/auth/me", authenticate, (req, res) => {
  const user = db.prepare("SELECT id, student_id, full_name, email, role, gpa, completed_credits, max_credit_limit, is_banned, ban_reason FROM users WHERE id = ?").get(req.user.id);
  res.json(user);
});

// ==========================================
// 2. COURSES ENDPOINTS (Browsing, Search, Filter, Details)
// ==========================================
app.get("/api/courses", authenticate, (req, res) => {
  const { search = "", day = "", available = "", credits = "" } = req.query;
  let courses = db.prepare("SELECT * FROM courses ORDER BY course_code ASC").all();

  courses = courses.map((c) => {
    const waitlistCount = db.prepare("SELECT COUNT(*) as cnt FROM waitlists WHERE course_id = ?").get(c.id).cnt;
    return {
      ...c,
      schedule_days: JSON.parse(c.schedule_days),
      waitlist_count: waitlistCount,
    };
  });

  if (search) {
    const q = search.toLowerCase();
    courses = courses.filter(
      (c) =>
        c.course_code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.instructor.toLowerCase().includes(q)
    );
  }
  if (day) {
    courses = courses.filter((c) => c.schedule_days.includes(day));
  }
  if (available === "true") {
    courses = courses.filter((c) => c.enrolled_count < c.capacity);
  }
  if (credits) {
    courses = courses.filter((c) => c.credit_hours === Number(credits));
  }

  res.json(courses);
});

app.get("/api/courses/:id", authenticate, (req, res) => {
  const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(req.params.id);
  if (!course) return res.status(404).json({ message: "Course not found." });

  const waitlistCount = db.prepare("SELECT COUNT(*) as cnt FROM waitlists WHERE course_id = ?").get(course.id).cnt;
  res.json({
    ...course,
    schedule_days: JSON.parse(course.schedule_days),
    waitlist_count: waitlistCount,
  });
});

// ==========================================
// 3. STUDENT PROFILE, ENROLLMENT, DROP & WAITLIST
// ==========================================
app.get("/api/student/profile", authenticate, (req, res) => {
  const user = db.prepare("SELECT id, student_id, full_name, email, role, gpa, completed_credits, max_credit_limit, is_banned, ban_reason FROM users WHERE id = ?").get(req.user.id);

  const schedule = db.prepare(`
    SELECT c.*, e.registered_at FROM courses c
    JOIN enrollments e ON e.course_id = c.id
    WHERE e.student_id = ?
  `).all(req.user.id).map((c) => ({ ...c, schedule_days: JSON.parse(c.schedule_days) }));

  const waitlist = db.prepare(`
    SELECT c.*, w.added_at,
      (SELECT COUNT(*) + 1 FROM waitlists w2 WHERE w2.course_id = w.course_id AND w2.id < w.id) AS position
    FROM courses c
    JOIN waitlists w ON w.course_id = c.id
    WHERE w.student_id = ?
  `).all(req.user.id).map((c) => ({ ...c, schedule_days: JSON.parse(c.schedule_days) }));

  const completed = db.prepare(`
    SELECT c.course_code, c.title, c.credit_hours, cc.grade, cc.semester_completed
    FROM completed_courses cc
    JOIN courses c ON c.id = cc.course_id
    WHERE cc.student_id = ?
  `).all(req.user.id);

  const currentRegisteredCredits = schedule.reduce((sum, c) => sum + c.credit_hours, 0);

  res.json({
    profile: {
      ...user,
      degree_total_credits: DEGREE_TOTAL_CREDITS,
      remaining_credits: Math.max(0, DEGREE_TOTAL_CREDITS - user.completed_credits),
      current_registered_credits: currentRegisteredCredits,
    },
    schedule,
    waitlist,
    completed,
  });
});

app.post("/api/enrollments/register", authenticate, (req, res) => {
  const { courseId } = req.body;
  const check = validateEnrollment(req.user.id, courseId);
  if (!check.ok) {
    return res.status(check.status).json({ code: check.code, message: check.message });
  }

  const enrollTx = db.transaction(() => {
    db.prepare("INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)").run(req.user.id, courseId);
    db.prepare("DELETE FROM waitlists WHERE student_id = ? AND course_id = ?").run(req.user.id, courseId);
    db.prepare("UPDATE courses SET enrolled_count = enrolled_count + 1 WHERE id = ?").run(courseId);
  });

  enrollTx();
  res.status(201).json({ message: `Successfully registered for ${check.course.course_code}.` });
});

app.delete("/api/enrollments/:courseId", authenticate, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (user.is_banned) {
    return res.status(403).json({ message: `Action blocked due to active hold: ${user.ban_reason}` });
  }

  const courseId = Number(req.params.courseId);
  const existing = db.prepare("SELECT * FROM enrollments WHERE student_id = ? AND course_id = ?").get(req.user.id, courseId);
  if (!existing) {
    return res.status(404).json({ message: "You are not enrolled in this course." });
  }

  let promotedStudent = null;

  const dropTx = db.transaction(() => {
    db.prepare("DELETE FROM enrollments WHERE student_id = ? AND course_id = ?").run(req.user.id, courseId);
    db.prepare("UPDATE courses SET enrolled_count = MAX(0, enrolled_count - 1) WHERE id = ?").run(courseId);

    // Auto-promote first eligible student on the waitlist
    const candidates = db.prepare("SELECT * FROM waitlists WHERE course_id = ? ORDER BY id ASC").all(courseId);
    for (const cand of candidates) {
      const check = validateEnrollment(cand.student_id, courseId);
      if (check.ok) {
        db.prepare("INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)").run(cand.student_id, courseId);
        db.prepare("DELETE FROM waitlists WHERE id = ?").run(cand.id);
        db.prepare("UPDATE courses SET enrolled_count = enrolled_count + 1 WHERE id = ?").run(courseId);
        promotedStudent = check.user.full_name;
        break;
      }
    }
  });

  dropTx();
  res.json({
    message: "Course dropped successfully.",
    auto_promoted: promotedStudent,
  });
});

app.post("/api/waitlist/:courseId", authenticate, (req, res) => {
  const courseId = Number(req.params.courseId);
  // Validate Hold, Completion, Credit Limit, and Time Conflict (skip capacity check)
  const check = validateEnrollment(req.user.id, courseId, { skipCapacity: true });
  if (!check.ok) {
    return res.status(check.status).json({ code: check.code, message: check.message });
  }

  if (check.course.enrolled_count < check.course.capacity) {
    return res.status(400).json({ message: "Seats are currently available — register directly instead." });
  }

  try {
    db.prepare("INSERT INTO waitlists (student_id, course_id) VALUES (?, ?)").run(req.user.id, courseId);
    const pos = db.prepare("SELECT COUNT(*) as cnt FROM waitlists WHERE course_id = ?").get(courseId).cnt;
    res.status(201).json({ message: `Added to waitlist for ${check.course.course_code} at position #${pos}.` });
  } catch {
    res.status(400).json({ message: "You are already on the waitlist for this course." });
  }
});

app.delete("/api/waitlist/:courseId", authenticate, (req, res) => {
  const courseId = Number(req.params.courseId);
  db.prepare("DELETE FROM waitlists WHERE student_id = ? AND course_id = ?").run(req.user.id, courseId);
  res.json({ message: "Removed from waitlist." });
});

// ==========================================
// 4. ADMIN ENDPOINTS
// ==========================================
app.post("/api/admin/courses", authenticate, requireAdmin, (req, res) => {
  const { course_code, title, description, instructor, semester, credit_hours, capacity, schedule_days, start_time, end_time, room, image_url } = req.body;
  try {
    const result = db.prepare(`
      INSERT INTO courses (course_code, title, description, instructor, semester, credit_hours, capacity, enrolled_count, schedule_days, start_time, end_time, room, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
    `).run(
      course_code.trim().toUpperCase(),
      title.trim(),
      description || "",
      instructor.trim(),
      semester || "Fall 2026",
      Number(credit_hours),
      Number(capacity),
      JSON.stringify(schedule_days),
      start_time,
      end_time,
      room.trim(),
      image_url || ""
    );
    res.status(201).json({ id: result.lastInsertRowid, message: "Course created." });
  } catch (err) {
    res.status(400).json({ message: "Course code already exists or invalid payload." });
  }
});

app.put("/api/admin/courses/:id", authenticate, requireAdmin, (req, res) => {
  const { title, description, instructor, semester, credit_hours, capacity, schedule_days, start_time, end_time, room } = req.body;
  const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(req.params.id);
  if (!course) return res.status(404).json({ message: "Course not found." });

  db.prepare(`
    UPDATE courses
    SET title = ?, description = ?, instructor = ?, semester = ?, credit_hours = ?, capacity = ?, schedule_days = ?, start_time = ?, end_time = ?, room = ?
    WHERE id = ?
  `).run(
    title ?? course.title,
    description ?? course.description,
    instructor ?? course.instructor,
    semester ?? course.semester,
    credit_hours !== undefined ? Number(credit_hours) : course.credit_hours,
    capacity !== undefined ? Number(capacity) : course.capacity,
    schedule_days ? JSON.stringify(schedule_days) : course.schedule_days,
    start_time ?? course.start_time,
    end_time ?? course.end_time,
    room ?? course.room,
    req.params.id
  );
  res.json({ message: "Course updated." });
});

// Cascading Delete (Removes course + all enrollments + all waitlists)
app.delete("/api/admin/courses/:id", authenticate, requireAdmin, (req, res) => {
  const courseId = Number(req.params.id);
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM enrollments WHERE course_id = ?").run(courseId);
    db.prepare("DELETE FROM waitlists WHERE course_id = ?").run(courseId);
    db.prepare("DELETE FROM courses WHERE id = ?").run(courseId);
  });
  tx();
  res.json({ message: "Course and all linked enrollments/waitlists deleted." });
});

// Admin Force Override Enrollment (Bypasses capacity cap)
app.post("/api/admin/enrollments/override", authenticate, requireAdmin, (req, res) => {
  const { student_id_code, course_code } = req.body;
  const student = db.prepare("SELECT * FROM users WHERE student_id = ? AND role = 'student'").get((student_id_code || "").trim());
  const course = db.prepare("SELECT * FROM courses WHERE course_code = ?").get((course_code || "").trim().toUpperCase());

  if (!student) return res.status(404).json({ message: "Student ID not found." });
  if (!course) return res.status(404).json({ message: "Course code not found." });

  const already = db.prepare("SELECT * FROM enrollments WHERE student_id = ? AND course_id = ?").get(student.id, course.id);
  if (already) return res.status(400).json({ message: "Student is already enrolled in this course." });

  const overrideTx = db.transaction(() => {
    db.prepare("INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)").run(student.id, course.id);
    db.prepare("DELETE FROM waitlists WHERE student_id = ? AND course_id = ?").run(student.id, course.id);
    db.prepare("UPDATE courses SET enrolled_count = enrolled_count + 1 WHERE id = ?").run(course.id);
  });
  overrideTx();

  res.status(201).json({
    message: `Override confirmed: ${student.full_name} enrolled into ${course.course_code} (${course.enrolled_count + 1}/${course.capacity}).`,
  });
});

// Admin View All Students & Their Enrolled Courses
app.get("/api/admin/students", authenticate, requireAdmin, (req, res) => {
  const { search = "" } = req.query;
  let students = db.prepare("SELECT id, student_id, full_name, email, gpa, completed_credits, max_credit_limit, is_banned, ban_reason FROM users WHERE role = 'student'").all();

  if (search) {
    const q = search.toLowerCase();
    students = students.filter(
      (s) => s.full_name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  }

  students = students.map((s) => {
    const courses = db.prepare(`
      SELECT c.id, c.course_code, c.title, c.credit_hours
      FROM courses c JOIN enrollments e ON e.course_id = c.id
      WHERE e.student_id = ?
    `).all(s.id);
    return { ...s, enrolled_courses: courses };
  });

  res.json(students);
});

// Admin Toggle Hold / Ban
app.patch("/api/admin/students/:id/hold", authenticate, requireAdmin, (req, res) => {
  const { is_banned, ban_reason } = req.body;
  db.prepare("UPDATE users SET is_banned = ?, ban_reason = ? WHERE id = ? AND role = 'student'").run(
    is_banned ? 1 : 0,
    is_banned ? ban_reason || "Administrative Hold" : null,
    req.params.id
  );
  res.json({ message: is_banned ? "Student hold applied." : "Student hold lifted." });
});

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));