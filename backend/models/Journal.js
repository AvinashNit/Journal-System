const mongoose = require("mongoose");

// Simple schema
const journalSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    trim: true,
  },
  ambience: {
    type: String,
    required: true,
    enum: ["forest", "ocean", "mountain"],
  },
  text: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Journal", journalSchema);
