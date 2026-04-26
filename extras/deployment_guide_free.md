# Zero-Cost Production Deployment Guide

Deploying an application with an AI pipeline, heavy browser scrapers (Playwright), and local LaTeX engines (`pdflatex`) is notoriously difficult on free tiers. However, using the architecture we just established, you can deploy the complete platform for absolutely **$0.00**.

Here is the exact battle plan, divided into four steps.

---

### Phase 1: The AI Brain (Groq Cloud)
Ollama is amazing for local development, but cloud VMs with GPUs cost significant money. We will bypass this using Groq's free tier.

1. Go to [Groq Console](https://console.groq.com/keys) and create a free account.
2. Generate an API Key (it will start with `gsk_...`).
3. Save this key. Your backend will use `llama-3.1-8b-instant` on their hardware for free.

---

### Phase 2: The Database (Neon.tech)
We need a free, high-performance PostgreSQL database to simulate what your local Docker container was doing.

1. Go to [Neon.tech](https://neon.tech/) and create a free account.
2. Create a new project and select Postgres 15+.
3. Neon will immediately give you a connection string. It looks like this:
   `postgresql://username:password@ep-cool-cloud-123.pooler.neon.tech/neondb?sslmode=require`
4. Replace the start of the string from `postgresql://` to `postgresql+asyncpg://` (since our backend uses the async SQLAlchemy driver).
5. Save this `DATABASE_URL`.

---

### Phase 3: The Backend Server (Render.com)
Because we need both Python (FastAPI/Playwright) and System Binaries (`pdflatex`) installed concurrently, we cannot use basic serverless functions. We must deploy a Docker container. **I have already written the `Dockerfile` and placed it in your project root.**

1. Push your entire project to a free **GitHub repository**.
2. Go to [Render](https://render.com/) and create a free account.
3. Click **New +** -> **Web Service**.
4. Connect your GitHub account and select your repository.
5. In the server configuration:
   - **Environment**: Select `Docker`. (Render will automatically detect the `Dockerfile` I just made for you).
   - **Instance Type**: Select the `Free` tier.
6. Scroll down to **Environment Variables** and add the following keys:
   - `DATABASE_URL`: *(Your modified Neon.tech string from Phase 2)*
   - `LLM_PROVIDER`: `groq`
   - `GROQ_API_KEY`: *(Your key from Phase 1)*
   - `SECRET_KEY`: *(Generate a random long string for your JWT tokens)*
7. Click **Create Web Service**. 
   *(Note: The first build will take 5-10 minutes as it installs LaTeX and Playwright Chromium).*
8. Once live, Render will give you a backend URL (e.g., `https://resume-api-123.onrender.com`).

> **The Free Tier Catch:** Render spins down free containers after 15 minutes of inactivity. When you visit your site after a break, the very *first* action (like logging in) might take 45 seconds while the server "wakes up". Subsequent actions will be lightning fast.

---

### Phase 4: The Frontend UI (Vercel)
Finally, we host the Next.js React application. Vercel integrates natively with Next.js and has the best free tier in the world.

1. Ensure your backend URL from Render is updated in your frontend code anywhere it says `http://localhost:8000` (You might want to do a final global find/replace in your Next.js code to change `http://localhost:8000` to `process.env.NEXT_PUBLIC_API_URL`).
2. Go to [Vercel](https://vercel.com/) and create a free account.
3. Click **Add New...** -> **Project**.
4. Connect the same GitHub repository.
5. Set the **Root Directory** to `frontend/` (Important! Don't leave it at the project root).
6. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_API_URL`: *(Your live Render.com backend URL)*
7. Click **Deploy**.

### You are now Live! 🚀
- Your URL is publicly accessible.
- Authentication hashes securely into the Neon Postgres DB.
- PDFs compile flawlessly in your Render Docker container.
- AI dynamically generates content using Groq's free endpoint.
