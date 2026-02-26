# Rails API (port 3000). FRONTEND_URL so post-login redirect goes to Vite.
web: cd backend && FRONTEND_URL=http://localhost:5173 bin/rails server -p 3000
# Vite dev server (port 5173). Proxies /api and /auth to Rails.
frontend: USE_RAILS_BACKEND=true yarn dev
# Solid Queue worker for collect/generate jobs.
jobs: cd backend && bin/jobs
