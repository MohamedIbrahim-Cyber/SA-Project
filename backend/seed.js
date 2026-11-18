const bcrypt = require("bcryptjs");
const db = require("./db");

console.log("Seeding database...");

// Clear existing records
db.exec(`
  DELETE FROM waitlists;
  DELETE FROM enrollments;
  DELETE FROM completed_courses;
  DELETE FROM courses;
  DELETE FROM users;
  DELETE FROM sqlite_sequence;
`);

const hash = (pw) => bcrypt.hashSync(pw, 10);

// 1. Seed Users (1 Admin + 3 Test Students)
const insertUser = db.prepare(`
  INSERT INTO users (student_id, full_name, email, password_hash, role, gpa, completed_credits, max_credit_limit, is_banned, ban_reason)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

insertUser.run("ADMIN-01", "Dr. Evelyn Vance", "admin@uni.edu", hash("admin123"), "admin", 0, 0, 0, 0, null);
insertUser.run("2026001", "Mohamed Taha", "mohamed@uni.edu", hash("student123"), "student", 3.72, 72, 18, 0, null);
insertUser.run("2026002", "Sara Mansour", "sara@uni.edu", hash("student123"), "student", 3.45, 96, 15, 0, null);
insertUser.run("2026003", "Omar Khaled", "omar@uni.edu", hash("student123"), "student", 2.10, 45, 12, 1, "Unpaid tuition balance — contact Bursar Office.");

// 2. Seed 10 Courses (Includes time conflicts, completed prerequisites, and 1 full course)
const insertCourse = db.prepare(`
  INSERT INTO courses (course_code, title, description, instructor, semester, credit_hours, capacity, enrolled_count, schedule_days, start_time, end_time, room, image_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const courses = [
  ["CS101", "Intro to Computer Science", "Foundations of algorithmic thinking, memory models, and structured programming.", "Dr. Alan Grant", "Fall 2026", 3, 40, 28, '["Mon","Wed"]', "09:00", "10:30", "Hall B-101", "https://images.pexels.com/photos/546819/pexels-photo-546819.jpeg?auto=compress&cs=tinysrgb&w=1200"],
  ["CS201", "Data Structures & Algorithms", "Trees, graphs, dynamic programming, and asymptotic complexity analysis.", "Dr. Sarah Connor", "Fall 2026", 4, 35, 31, '["Mon","Wed"]', "10:00", "11:30", "Lab C-204", "https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=1200"],
  ["AI305", "Neural Networks & Deep Learning", "Backpropagation, CNNs, Transformers, and PyTorch model optimization.", "Dr. Andrew Ng", "Fall 2026", 4, 25, 25, '["Tue","Thu"]', "11:00", "12:30", "AI Center 402", "https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=1200"],
  ["SE310", "Software Engineering", "Agile workflows, REST architecture, automated testing, and CI/CD pipelines.", "Prof. Ada Lovelace", "Fall 2026", 3, 30, 19, '["Mon","Wed"]', "10:00", "11:30", "Hall A-301", "https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=1200"],
  ["DB220", "Database Management Systems", "Relational algebra, SQL indexing, ACID transactions, and query tuning.", "Dr. Edgar Codd", "Fall 2026", 3, 35, 22, '["Tue","Thu"]', "09:00", "10:30", "Room B-205", "https://images.pexels.com/photos/1181244/pexels-photo-1181244.jpeg?auto=compress&cs=tinysrgb&w=1200"],
  ["OS302", "Operating Systems", "Process scheduling, virtual memory, concurrency locks, and file systems.", "Prof. Linus Torvalds", "Fall 2026", 4, 30, 14, '["Sun","Tue"]', "13:00", "14:30", "Lab D-102", "https://images.pexels.com/photos/577585/pexels-photo-577585.jpeg?auto=compress&cs=tinysrgb&w=1200"],
  ["NET240", "Computer Networks", "TCP/IP stack, routing protocols, DNS, TLS encryption, and socket programming.", "Dr. Vint Cerf", "Fall 2026", 3, 30, 27, '["Mon","Wed"]', "13:00", "14:30", "Room A-108", "https://images.pexels.com/photos/2881229/pexels-photo-2881229.jpeg?auto=compress&cs=tinysrgb&w=1200"],
  ["SEC401", "Cybersecurity & Cryptography", "Symmetric/asymmetric ciphers, zero-trust architecture, and penetration testing.", "Dr. Bruce Schneier", "Fall 2026", 3, 25, 18, '["Wed","Thu"]', "15:00", "16:30", "SecLab 309", "https://images.pexels.com/photos/60504/security-protection-anti-virus-software-60504.jpeg?auto=compress&cs=tinysrgb&w=1200"],
  ["MATH210", "Linear Algebra for AI", "Eigenvalues, SVD, vector spaces, and matrix calculus for machine learning.", "Dr. Gilbert Strang", "Fall 2026", 3, 45, 33, '["Sun","Tue"]', "09:00", "10:30", "Hall M-101", "https://images.pexels.com/photos/3729557/pexels-photo-3729557.jpeg?auto=compress&cs=tinysrgb&w=1200"],
  ["UX215", "Human-Computer Interaction", "Cognitive ergonomics, accessibility (WCAG), prototyping, and usability testing.", "Prof. Don Norman", "Fall 2026", 3, 30, 12, '["Thu"]', "13:00", "16:00", "Design Studio 12", "https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=1200"]
];

courses.forEach((c) => insertCourse.run(...c));

// 3. Seed Completed Courses & Active Enrollments for Mohamed (user id = 2)
db.prepare("INSERT INTO completed_courses (student_id, course_id, grade, semester_completed) VALUES (?, ?, ?, ?)").run(2, 1, "A", "Spring 2026"); // CS101 already passed
db.prepare("INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)").run(2, 2); // CS201 (Mon/Wed 10:00-11:30 -> conflicts with SE310!)
db.prepare("INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)").run(2, 5); // DB220 (Tue/Thu 09:00-10:30)

// Seed Sara (user id = 3) near her 15-credit limit (already enrolled in 12 credits)
db.prepare("INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)").run(3, 2); // 4 cr
db.prepare("INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)").run(3, 6); // 4 cr
db.prepare("INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)").run(3, 7); // 3 cr (Total = 11/15)

console.log("Seed complete. Test accounts:");
console.log("  Admin   -> admin@uni.edu / admin123");
console.log("  Student -> mohamed@uni.edu / student123 (Normal, CS101 passed, CS201+DB220 enrolled)");
console.log("  Student -> sara@uni.edu / student123 (11/15 credits used)");
console.log("  Student -> omar@uni.edu / student123 (Banned / On Hold)");