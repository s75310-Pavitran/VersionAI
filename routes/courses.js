// routes/courses.js  — Business Logic Layer
const express  = require('express');
const router   = express.Router();
const Course   = require('../models/Course');
const User     = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// ─── GET /api/courses/all  — browse published courses (student/public) ───
router.get('/all', async (req, res) => {
  try {
    const courses = await Course.find({ isPublished: true })
      .populate('instructor', 'name email')
      .sort({ createdAt: -1 });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/courses/admin/all  — all courses regardless of status (admin) ─
router.get('/admin/all', protect, authorize('admin'), async (req, res) => {
  try {
    const courses = await Course.find()
      .populate('instructor', 'name email')
      .sort({ createdAt: -1 });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/courses/my  — instructor's own courses ─────────────────────
router.get('/my', protect, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const courses = await Course.find({ instructor: req.user.id })
      .populate('enrolledStudents', 'name email')
      .sort({ createdAt: -1 });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/courses/:id  — single course detail ────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('instructor', 'name email')
      .populate('enrolledStudents', 'name email');
    if (!course) return res.status(404).json({ message: 'Course not found.' });
    res.json(course);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/courses/add  — instructor creates course ──────────────────
router.post('/add', protect, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const { title, description, category, modules } = req.body;
    const course = new Course({
      title, description, category,
      instructor: req.user.id,
      modules: modules || [],
    });
    await course.save();

    // Track on instructor's profile
    await User.findByIdAndUpdate(req.user.id, {
      $push: { createdCourses: course._id }
    });

    res.status(201).json({ message: 'Course created.', course });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/courses/:id  — instructor edits own course ─────────────────
router.put('/:id', protect, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found.' });

    // Instructor can only edit their own; admin can edit any
    if (req.user.role !== 'admin' && course.instructor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not your course.' });
    }

    const updates = req.body;
    Object.assign(course, updates);
    await course.save();
    res.json({ message: 'Course updated.', course });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/courses/:id/publish  — toggle publish status ─────────────
router.patch('/:id/publish', protect, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found.' });

    if (req.user.role !== 'admin' && course.instructor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not your course.' });
    }

    course.isPublished = !course.isPublished;
    await course.save();
    res.json({ message: `Course ${course.isPublished ? 'published' : 'unpublished'}.`, course });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/courses/:id  — admin or course owner deletes ────────────
router.delete('/:id', protect, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found.' });

    if (req.user.role !== 'admin' && course.instructor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not your course.' });
    }

    await course.deleteOne();
    res.json({ message: 'Course deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  STUDENT: Enrollment
// ══════════════════════════════════════════════════════════════════════════

// POST /api/courses/:id/enroll
router.post('/:id/enroll', protect, authorize('student'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found.' });
    if (!course.isPublished) return res.status(400).json({ message: 'Course is not available.' });

    if (course.enrolledStudents.includes(req.user.id)) {
      return res.status(409).json({ message: 'Already enrolled.' });
    }

    course.enrolledStudents.push(req.user.id);
    await course.save();

    await User.findByIdAndUpdate(req.user.id, {
      $push: { enrolledCourses: course._id }
    });

    res.json({ message: 'Enrolled successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/courses/student/my-courses  — student's enrolled courses
router.get('/student/my-courses', protect, authorize('student'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'enrolledCourses',
      populate: { path: 'instructor', select: 'name' }
    });
    res.json(user.enrolledCourses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  STUDENT: Assignment Submission
// ══════════════════════════════════════════════════════════════════════════

// POST /api/courses/:courseId/assignments/:assignmentId/submit
router.post('/:courseId/assignments/:assignmentId/submit', protect, authorize('student'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ message: 'Course not found.' });

    const assignment = course.assignments.id(req.params.assignmentId);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found.' });

    const { fileUrl } = req.body; // Cloudinary URL from frontend upload

    // Check if already submitted
    const existing = assignment.submissions.find(
      s => s.student.toString() === req.user.id
    );
    if (existing) {
      existing.fileUrl = fileUrl;
      existing.submittedAt = new Date();
    } else {
      assignment.submissions.push({ student: req.user.id, fileUrl });
    }

    await course.save();
    res.json({ message: 'Assignment submitted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  INSTRUCTOR: Assignment & Grading Management
// ══════════════════════════════════════════════════════════════════════════

// POST /api/courses/:id/assignments  — create assignment
router.post('/:id/assignments', protect, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found.' });

    if (req.user.role !== 'admin' && course.instructor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not your course.' });
    }

    const { title, description, dueDate } = req.body;
    course.assignments.push({ title, description, dueDate });
    await course.save();
    res.json({ message: 'Assignment created.', course });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/courses/:courseId/assignments/:assignmentId/grade/:studentId  — grade a submission
router.patch(
  '/:courseId/assignments/:assignmentId/grade/:studentId',
  protect,
  authorize('instructor', 'admin'),
  async (req, res) => {
    try {
      const course = await Course.findById(req.params.courseId);
      if (!course) return res.status(404).json({ message: 'Course not found.' });

      if (req.user.role !== 'admin' && course.instructor.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not your course.' });
      }

      const assignment = course.assignments.id(req.params.assignmentId);
      const submission = assignment.submissions.find(
        s => s.student.toString() === req.params.studentId
      );
      if (!submission) return res.status(404).json({ message: 'Submission not found.' });

      submission.grade    = req.body.grade;
      submission.feedback = req.body.feedback || '';
      await course.save();
      res.json({ message: 'Grade saved.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/courses/:id/quizzes  — instructor creates quiz
router.post('/:id/quizzes', protect, authorize('instructor', 'admin'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found.' });

    if (req.user.role !== 'admin' && course.instructor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not your course.' });
    }

    course.quizzes.push(req.body); // { title, questions: [{question, options, answer}] }
    await course.save();
    res.json({ message: 'Quiz created.', course });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  ADMIN: Course-level management
// ══════════════════════════════════════════════════════════════════════════

// PATCH /api/courses/admin/:id/force-publish
router.patch('/admin/:id/force-publish', protect, authorize('admin'), async (req, res) => {
  try {
    const { isPublished } = req.body;
    const course = await Course.findByIdAndUpdate(
      req.params.id, { isPublished }, { new: true }
    );
    res.json({ message: 'Course status updated.', course });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;