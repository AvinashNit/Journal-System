require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const journalRoutes = require("./routes/journal");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/journal_db";

// middleware
app.use(cors());
app.use(express.json());

//Routes 

app.use("/api/journal", journalRoutes);

//check if server is running or not
app.get("/", (req, res) => {
  res.json({ message: "Journal API is running!" });
});

// connect to mongodb, then start server 
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB:", MONGO_URI);
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
