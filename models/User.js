// models/User.js  — Data Layer
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ['student', 'instructor', 'admin'], default: 'student' },
  isActive: { type: Boolean, default: true },

  // Student-specific: courses they enrolled in
  enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],

  // Instructor-specific: courses they own
  createdCourses:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);