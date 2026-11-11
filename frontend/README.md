# ATS Resume Analyzer — Frontend

React.js (Create React App) + Material UI. Tagline: **Analyze. Optimize. Apply.**

## Requirements
- Node.js 18 or newer
- npm 9 or newer

## Setup
```bash
cd frontend
npm install
copy .env.example .env      # Windows (use `cp` on macOS/Linux)
npm start
```
The app runs at http://localhost:3000.

## Environment variables
| Variable | Purpose |
|---|---|
| `REACT_APP_API_BASE_URL` | FastAPI base URL including `/api/v1` (default `http://localhost:8000/api/v1`) |
| `REACT_APP_APP_NAME` | Display name |

Never put API keys or secrets in frontend env files. Anything prefixed `REACT_APP_` is public in the built bundle.

## Scripts
- `npm start` — dev server
- `npm test` — unit tests
- `npm run build` — production build

## Structure
```
src/
  components/   layout/ (PublicNavbar, DashboardLayout, Footer), common/
  context/      AuthContext, NotificationContext
  pages/        landing/, auth/, DashboardPage, ComingSoonPage, NotFoundPage
  routes/       ProtectedRoute, PublicOnlyRoute (+ tests)
  services/     apiClient (axios + token refresh), authService, dashboardService
  config.js     routes and constants
  theme.js      MUI theme
```

## Backend API contract assumed by the frontend
Success: `{ "success": true, "data": {...}, "meta": { "total": 0 } }`
Error: `{ "success": false, "error": { "code": "...", "message": "..." } }`

| Endpoint | Expected behavior |
|---|---|
| `POST /auth/register` | Creates user, sends verification email |
| `POST /auth/login` | Returns `data: { accessToken, user }` and sets httpOnly refresh cookie |
| `POST /auth/refresh` | Reads refresh cookie, returns `data: { accessToken }` |
| `POST /auth/logout` | Clears the refresh cookie |
| `GET /auth/me` | Returns the current user |
| `POST /auth/forgot-password` | Body `{ email }`, always responds generically |
| `POST /auth/reset-password` | Body `{ token, newPassword }` |
| `POST /auth/verify-email` | Body `{ token }` (**not in the original endpoint list; to be added**) |
| `GET /resumes`, `GET /analyses` | Paginated with `page`, `pageSize`, return `meta.total` |

The backend must enable CORS for `http://localhost:3000` with credentials allowed.

## Auth design
Access tokens are held in memory only. The refresh token is an httpOnly cookie managed by the backend. On page load the app calls `/auth/refresh` to restore the session.

## Progress
- [x] Phase 1: project setup, theme, routing, API client
- [x] Phase 2 (frontend): landing, register, login, forgot/reset password, email verification, protected routes, dashboard shell
- [ ] Phase 3: resume management
- [ ] Phase 4: job descriptions
- [ ] Phase 5: analysis workflow and report
- [ ] Phase 6: optimizer
- [ ] Phase 7: editor and export
- [ ] Phase 8: history and settings
- [ ] Phase 9: end-to-end tests and deployment
