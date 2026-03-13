# 🌿 AI-Assisted Nature Journal System

A simple full-stack journaling app where users record how they felt during nature sessions (forest, ocean, mountain). An LLM analyses the emotion in each entry, and the app surfaces personal insights over time.

---

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Backend  | Node.js + Express                   |
| Frontend | React (create-react-app)            |
| Database | MongoDB (via Mongoose)              |
| AI / LLM | Google Gemini 1.5 Flash (free tier) |

---

## Project Structure

```
project-root/
├── backend/
│   ├── models/
│   │   └── Journal.js       # Mongoose schema
│   ├── routes/
│   │   └── journal.js       # All four API routes
│   ├── server.js            # Express entry point
│   ├── package.json
│   └── .env.example         # Copy to .env and fill in values
├── frontend/
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.js           # Entire React UI
│       ├── api.js           # All fetch calls to the backend
│       └── index.js         # React entry point
├── README.md
└── ARCHITECTURE.md
```

---

## Prerequisites

- **Node.js** v18 or higher — https://nodejs.org
- **MongoDB** running locally on port 27017  
  Install: https://www.mongodb.com/try/download/community  
  Start:   `mongod` (or use MongoDB Atlas — see `.env.example`)
- *(Optional)* A **Google Gemini API key** for real emotion analysis — **free, no credit card needed**.  
  Get one at https://aistudio.google.com/app/apikey (takes ~30 seconds).  
  Without a key the app still works using a built-in mock response.

---

## Installation

### 1. Clone / download the project

```bash
git clone <repo-url>
cd project-root
```

### 2. Set up the backend

```bash
cd backend
npm install

# Copy the example env file and edit it
cp .env.example .env
# Open .env and set MONGO_URI and GEMINI_API_KEY
# Get a free Gemini key at: https://aistudio.google.com/app/apikey
```

### 3. Set up the frontend

```bash
cd ../frontend
npm install
```

---

## Running the App

Open **two terminal windows**.

### Terminal 1 — Backend

```bash
cd backend
npm run dev        # uses nodemon for auto-reload
# OR
npm start          # plain node
```

You should see:
```
Connected to MongoDB: mongodb://localhost:27017/journal_db
Server running on http://localhost:5000
```

### Terminal 2 — Frontend

```bash
cd frontend
npm start
```

React opens **http://localhost:3000** automatically in your browser.

---

## API Reference

All routes are prefixed with `/api/journal`.

### POST /api/journal
Save a new journal entry.

```bash
curl -X POST http://localhost:5000/api/journal \
  -H "Content-Type: application/json" \
  -d '{"userId":"alice","ambience":"forest","text":"I felt calm today after listening to the rain."}'
```

---

### GET /api/journal/:userId
Get all entries for a user.

```bash
curl http://localhost:5000/api/journal/alice
```

---

### POST /api/journal/analyze
Analyse emotion in a piece of text using AI.

```bash
curl -X POST http://localhost:5000/api/journal/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"I felt calm today after listening to the rain."}'
```

Response:
```json
{
  "emotion": "calm",
  "keywords": ["rain", "nature", "peace"],
  "summary": "User experienced relaxation during the forest session."
}
```

---

### GET /api/journal/insights/:userId
Get computed insights for a user.

```bash
curl http://localhost:5000/api/journal/insights/alice
```

Response:
```json
{
  "totalEntries": 8,
  "topEmotion": "calm",
  "mostUsedAmbience": "forest",
  "recentKeywords": ["focus", "nature", "rain"]
}
```

---

## Using Without an API Key

If `GEMINI_API_KEY` is blank in `.env`, the `/analyze` endpoint returns a
static mock response. This lets you test the full UI flow without any API key.

To get a real free key: https://aistudio.google.com/app/apikey
