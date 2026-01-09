## Interior Design Agent Memory System (Scaffold)

### Backend (Django)
1. Activate the existing virtualenv:
   - `source .env/bin/activate`
2. Install dependencies:
   - `pip install -r backend/requirements.txt`
3. Run migrations and start server:
   - `python backend/manage.py migrate`
   - `python backend/manage.py runserver`
4. Health check:
   - `GET http://localhost:8000/api/health`

### Frontend (React + Vite)
1. Install dependencies:
   - `cd frontend`
   - `npm install`
2. Start dev server:
   - `npm run dev`
3. Visit:
   - `http://localhost:5173`

### Notes
- CORS is enabled for `http://localhost:5173`.
- Copy `.env.example` to `.env` (optional) to override Django settings.
