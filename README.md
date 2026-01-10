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
4. Sign up / log in:
   - `http://localhost:5173/signup`
   - `http://localhost:5173/login`
5. App shell:
   - `http://localhost:5173/app`
6. Demo setup:
   - Use the “Demo Setup” button in the sidebar

### Notes
- CORS is enabled for `http://localhost:5173`.
- Copy `.env.example` to `.env` (optional) to override Django settings.
- If migrations fail due to a user model change, delete `backend/db.sqlite3` and rerun migrations.

### Quick QA checklist
- Click “Demo Setup” in the sidebar.
- Open the Bedroom project and confirm 5 option cards with images are visible.
- Refresh the page and confirm images still render under the assistant message.
