# Architecture Notes

This document answers four important design questions in plain language.  
The current system is intentionally simple and runs on a single machine.  
Below is how you would evolve it as it grows.

---

## 1. How would you scale this system to 100 000 users?

**The bottlenecks you would hit first**

| Bottleneck | Why it hurts at scale |
|---|---|
| Single Express process | One Node process can only handle so many concurrent requests |
| Single MongoDB instance | Reads and writes pile up on one machine |
| LLM calls per request | Every `/analyze` call is a slow, expensive network round-trip |

**What you would change, step by step**

1. **Run multiple backend copies** behind a load balancer (e.g. Nginx or AWS ALB).  
   Node is single-threaded, so four copies on a four-core machine already gives you 4× throughput.

2. **Use a managed MongoDB cluster** (MongoDB Atlas) with read replicas.  
   Direct read-heavy queries (get entries, get insights) to replica nodes so the primary only handles writes.

3. **Add a cache layer** (Redis or in-memory) in front of the insights endpoint.  
   Insights don't need to be recalculated on every request — recalculate once per minute per user.

4. **Move LLM analysis to a background job queue** (e.g. BullMQ).  
   The client submits text, gets a job ID immediately, and polls for the result.  
   This prevents slow LLM responses from blocking the whole server.

5. **Use a CDN** (Cloudflare, AWS CloudFront) to serve the React build files so the Node server never handles static assets.

---

## 2. How would you reduce LLM cost?

LLM calls are the most expensive part of this system.  
Here are four practical ways to bring the cost down:

**a) Use the cheapest model that is good enough**  
Claude Haiku costs roughly 25× less than Claude Opus for the same token count.  
For simple emotion analysis, Haiku is more than sufficient.

**b) Keep prompts short**  
Every token you send costs money.  
The current prompt is already brief — avoid adding extra instructions or examples.

**c) Cache results** *(see section 3 below)*  
If two users write similar entries, you only pay for one LLM call.

**d) Batch analysis**  
Instead of analysing every entry the moment it is saved, wait and analyse 10 entries together in one API call.  
This can cut per-entry cost significantly because the model overhead is shared.

**e) Only call the LLM on demand**  
The current design calls the LLM only when the user explicitly clicks "Analyse" — not on every save.  
Keep it that way and you avoid surprise bills.

---

## 3. How would you cache repeated analysis?

**The idea**  
If two entries have the same (or very similar) text, the LLM will return the same result.  
There is no point paying for the same call twice.

**Simple approach — hash-based cache**

```
User submits text
  → compute SHA-256 hash of the text
  → look up hash in a cache table (MongoDB collection or Redis)
  → if found: return the cached result  (free, instant)
  → if not found: call the LLM, store result with the hash  (costs money, ~1 s)
```

In MongoDB you would add a collection like this:

```js
// collection: analysis_cache
{
  textHash:  "abc123...",   
  result:    { emotion, keywords, summary },
  createdAt: Date,
  expiresAt: Date          
}
```

A MongoDB TTL index automatically removes entries older than, say, 30 days so the cache does not grow forever.

**Approximate similarity (advanced)**  
For near-duplicate text (small typos, extra spaces) you could store an embedding vector and do a vector similarity search.  
That is more complex — only worth adding once the simple hash cache is in place and you can see how often it misses.

---

## 4. How would you protect sensitive journal data?

Journal entries are personal and potentially sensitive.  
Here are the layers of protection you would add:

**a) Encrypt data at rest**  
Use MongoDB Atlas with encryption-at-rest enabled (one checkbox).  
On self-hosted MongoDB, use encrypted volumes (AWS EBS, Linux LUKS).

**b) Encrypt data in transit**  
Serve the API over HTTPS (free certificate via Let's Encrypt / AWS ACM).  
Never run the API on plain HTTP in production.

**c) Add user authentication**  
Right now anyone who knows a `userId` string can read that user's entries.  
Add JWT-based login so entries are tied to a verified account, not just a string.

**d) Do not log entry text**  
Logging frameworks sometimes capture request bodies.  
Make sure your logger is configured to redact or skip the `text` field.

**e) Limit data retention**  
Add a MongoDB TTL index on `createdAt` so old entries are automatically deleted after a user-configurable period (e.g. 1 year).  
Less stored data = less risk if a breach ever happens.

**f) Rate limiting**  
Add `express-rate-limit` on the `/api/journal` routes to prevent someone from scraping all entries or spamming LLM calls.

```js
// Example — add to server.js
const rateLimit = require("express-rate-limit");
app.use("/api/", rateLimit({ windowMs: 60_000, max: 60 }));
```

---

## Summary Table

| Concern | Simple fix now | Proper fix at scale |
|---|---|---|
| Scale to 100k users | Single server is fine up to ~5k | Multiple servers + load balancer + replica MongoDB |
| LLM cost | Use Haiku, analyze on demand | Add caching + batching |
| Repeated analysis | Nothing (always calls LLM) | Hash-based cache in MongoDB/Redis |
| Data protection | HTTPS + don't log text | Auth (JWT) + encryption at rest + rate limiting |
