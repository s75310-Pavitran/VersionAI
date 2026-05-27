// models/Course.js  — Data Layer
const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema({
  title:     { type: String, required: true },
  content:   { type: String },
  order:     { type: Number, default: 0 },
});

const assignmentSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String },
  dueDate:     { type: Date },
  submissions: [{
    student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fileUrl:    { type: String },          // Cloudinary URL
    submittedAt:{ type: Date, default: Date.now },
    grade:      { type: Number, default: null },
    feedback:   { type: String, default: '' },
  }],
});

const quizSchema = new mongoose.Schema({
  title:     { type: String, required: true },
  questions: [{
    question: String,
    options:  [String],
    answer:   String,
  }],
});

const courseSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, required: true },
  category:    { type: String, default: 'General' },
  instructor:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isPublished: { type: Boolean, default: false },

  // FR-CM-05: Admin can archive a course for policy violations (soft remove)
  isArchived:    { type: Boolean, default: false },
  archiveReason: { type: String, default: '' },
  archivedAt:    { type: Date, default: null },

  modules:     [moduleSchema],
  assignments: [assignmentSchema],
  quizzes:     [quizSchema],

  // Students enrolled
  enrolledStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

module.exports = mongoose.model('Course', courseSchema);