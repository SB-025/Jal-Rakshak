# Jal Rakshak Deployment Guide (Netlify + Render)

This project is fully prepared for Git push, with separate production deployment configurations for:
- **Frontend (Vite + React SPA)**: Deployed on **Netlify**
- **Backend (FastAPI + Python)**: Deployed on **Render**

---

## 1. Git Push (GitHub)

The Git repository has been initialized with sensitive files (`.env`, `node_modules`, `.venv`, `dist`, build caches) safely ignored in `.gitignore`.

Run the following commands in your terminal:

```bash
# 1. Stage all clean source files and deployment configs
git add .

# 2. Create the initial commit
git commit -m "Prepare Jal Rakshak for deployment on Netlify and Render"

# 3. Create a new repository on GitHub (e.g. https://github.com/<your-username>/jal-rakshak)
# Then link your remote and push to main:
git branch -M main
git remote add origin https://github.com/<your-username>/jal-rakshak.git
git push -u origin main
```

---

## 2. Backend Deployment on Render

### Method A: Blueprint Deployment (Fastest)
1. Go to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** > **Blueprint**.
3. Connect your GitHub repository.
4. Render will automatically detect [`render.yaml`](file:///c:/Jal%20Rakshak/render.yaml) and configure the web service.
5. Fill in the required environment variables:
   - `MONGODB_URI`: Your MongoDB Atlas connection URI (`mongodb+srv://...`)
   - `LOGIN_USERNAME`: Your admin login username (e.g. `niox`)
   - `LOGIN_PASSWORD_HASH`: Your salted PBKDF2-SHA256 password hash
   - `CORS_ORIGINS`: Your Netlify URL (e.g. `https://your-site.netlify.app`) and localhost (`http://localhost:5173`)
   - `OLLAMA_API_KEY`: (Optional) Your Ollama cloud API key
6. Click **Apply**.

### Method B: Manual Web Service Setup
1. On [Render](https://dashboard.render.com/), click **New +** > **Web Service**.
2. Connect your GitHub repository.
3. Configure settings:
   - **Name**: `jal-rakshak-backend`
   - **Language / Runtime**: `Python 3`
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/health`
4. Add the following **Environment Variables**:
   | Variable | Value | Description |
   |---|---|---|
   | `PYTHON_VERSION` | `3.11.9` | Recommended Python version on Render |
   | `MONGODB_URI` | `mongodb+srv://...` | MongoDB connection string |
   | `MONGODB_DB` | `jal_rakshak` | Database name |
   | `LOGIN_USERNAME` | `niox` | Username |
   | `LOGIN_PASSWORD_HASH` | `<your-hash>` | Salted PBKDF2-SHA256 hash |
   | `JWT_SECRET` | `<32+ char random string>` | Secret token key |
   | `CORS_ORIGINS` | `https://<your-netlify-app>.netlify.app,http://localhost:5173` | Allowed frontend origins |
   | `MOTOR_STATE_TTL_SECONDS` | `300` | Device status timeout |
   | `OLLAMA_API_KEY` | `<optional>` | Ollama AI API key |
   | `OLLAMA_MODEL` | `gemma4:31b` | Ollama model identifier |
5. Click **Create Web Service**.
6. Once deployed, copy your Render service URL (e.g., `https://jal-rakshak-backend.onrender.com`).

---

## 3. Frontend Deployment on Netlify

1. Go to your [Netlify Dashboard](https://app.netlify.com/).
2. Click **Add new site** > **Import an existing project**.
3. Select **GitHub** and authorize access to your repository.
4. Netlify will automatically detect [`netlify.toml`](file:///c:/Jal%20Rakshak/netlify.toml). Verify settings:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist` (or `frontend/dist`)
5. Click **Add environment variables**:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://<your-backend-service>.onrender.com` |
6. Click **Deploy Site**.
7. Once published, your frontend will be live at `https://<your-site>.netlify.app`.

---

## 4. Final Sync (CORS)

Make sure the backend allows requests from your Netlify domain:
1. In the **Render Dashboard**, open your `jal-rakshak-backend` service.
2. Go to **Environment**.
3. Update `CORS_ORIGINS` to include your exact Netlify domain:
   ```
   https://<your-site>.netlify.app,http://localhost:5173
   ```
4. Save and let Render redeploy.
