import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { API_BASE, fetchJson, jsonHeaders, setAuthToken } from '../api'
import '../App.css'

export default function SignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '',
    username: '',
    name: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setStatus('Creating account...')
    try {
      const data = await fetchJson(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(form),
      })
      setAuthToken(data.token)
      setStatus('Success')
      navigate('/app')
    } catch (err) {
      setError(err.message || 'Signup failed')
      setStatus('')
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Create account</h2>
        <p className="muted">Start designing with memory.</p>
        <div className="field">
          <label htmlFor="signupEmail">Email</label>
          <input
            id="signupEmail"
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="signupUsername">Username</label>
          <input
            id="signupUsername"
            value={form.username}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, username: event.target.value }))
            }
            required
          />
        </div>
        <div className="field">
          <label htmlFor="signupName">Name</label>
          <input
            id="signupName"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="signupPassword">Password</label>
          <input
            id="signupPassword"
            type="password"
            value={form.password}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, password: event.target.value }))
            }
            required
          />
        </div>
        {error && <p className="error">{error}</p>}
        {status && <p className="muted">{status}</p>}
        <button type="submit">Sign up</button>
        <p className="muted">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  )
}
