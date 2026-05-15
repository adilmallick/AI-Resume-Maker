# Career Vault — Admin Panel

A fully standalone, zero-dependency admin interface for the Career Vault FastAPI backend.

## Structure

```
admin-panel/
├── index.html   # Single-page app shell
├── style.css    # Dark glassmorphism design system
└── app.js       # All API calls & UI logic
```

## How to Open

**Option A — VS Code Live Server (recommended)**
1. Install the "Live Server" extension in VS Code
2. Right-click `index.html` → **Open with Live Server**
3. Panel opens at `http://localhost:5500`

**Option B — Python simple server**
```bash
cd admin-panel
python3 -m http.server 5500
# Open http://localhost:5500
```

## Authentication

| Field | Value |
|-------|-------|
| API Base URL | `http://localhost:8000` |
| Admin Secret | Value of `ADMIN_SECRET` in `.env` (default: `career_vault_admin_2025`) |

The secret is sent as the `X-Admin-Secret` header with every request.
**Change the secret** in `.env` before deploying to production.

## Features

| Feature | Details |
|---------|---------|
| **Dashboard** | Live stats: users, active/inactive, experiences, projects, skills, applications, resumes |
| **System Health** | Pings `/health` to show LLM provider & model |
| **User List** | Table with search, Active / Inactive filter tabs |
| **User Detail Modal** | Profile, location, summary, credential counts |
| **Toggle Active** | One-click activate / deactivate any account |
| **AI Credits** | Edit & save credit balance per user |
| **Job Applications** | View all applications per user with resume status |
| **Delete User** | Permanently removes user + all cascade data |

## Backend Endpoints Added

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/stats` | Platform-wide statistics |
| GET | `/admin/users` | All users with summary counts |
| GET | `/admin/users/{id}` | Single user full detail |
| PATCH | `/admin/users/{id}/toggle-active` | Activate / deactivate |
| PATCH | `/admin/users/{id}/credits` | Update AI credits |
| GET | `/admin/users/{id}/applications` | User's job applications |
| DELETE | `/admin/users/{id}` | Permanently delete user |

All endpoints require `X-Admin-Secret: <your_secret>` header.
