export const API_BASE = 'http://localhost:8000/api'

export const getAuthToken = () => window.localStorage.getItem('auth_token')

export const setAuthToken = (token) => {
  window.localStorage.setItem('auth_token', token)
}

export const clearAuthToken = () => {
  window.localStorage.removeItem('auth_token')
}

export const jsonHeaders = { 'Content-Type': 'application/json' }

export async function fetchJson(url, options = {}) {
  const token = getAuthToken()
  const headers = {
    ...(options.headers || {}),
  }
  if (token) {
    headers.Authorization = `Token ${token}`
  }
  const response = await fetch(url, { ...options, headers })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed: ${response.status}`)
  }
  return response.json()
}
