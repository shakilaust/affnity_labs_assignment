import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    const fetchHealth = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/health')
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`)
        }
        const data = await response.json()
        if (isMounted) {
          setStatus(data.status ?? 'unknown')
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unknown error')
          setStatus('error')
        }
      }
    }

    fetchHealth()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="app">
      <h1>Interior Design Agent Memory System</h1>
      <p className="subtitle">Backend health check</p>
      <div className="status-card">
        {status === 'loading' && <span>Loading...</span>}
        {status === 'error' && <span className="error">Error: {error}</span>}
        {status !== 'loading' && status !== 'error' && (
          <span className="ok">Status: {status}</span>
        )}
      </div>
    </div>
  )
}

export default App
