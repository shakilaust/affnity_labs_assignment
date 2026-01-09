import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { API_BASE, fetchJson, jsonHeaders, setAuthToken } from '../api'
import '../App.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const redirectTo = location.state?.from?.pathname || '/app'

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setStatus('Signing in...')
    try {
      const data = await fetchJson(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(form),
      })
      setAuthToken(data.token)
      setStatus('Success')
      navigate(redirectTo)
    } catch (err) {
      setError(err.message || 'Login failed')
      setStatus('')
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Welcome back</h2>
        <p className="muted">Log in to access your design workspace.</p>
        <div className="field">
          <label htmlFor="loginEmail">Email</label>
          <input
            id="loginEmail"
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="loginPassword">Password</label>
          <input
            id="loginPassword"
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            required
          />
        </div>
        {error && <p className="error">{error}</p>}
        {status && <p className="muted">{status}</p>}
        <button type="submit">Log in</button>
        <p className="muted">
          Need an account? <Link to="/signup">Create one</Link>
        </p>
      </form>
    </div>
  )
}
