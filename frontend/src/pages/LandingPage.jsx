import { Link } from 'react-router-dom'
import '../App.css'

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-hero">
        <div>
          <p className="eyebrow">Interior Design Agent with Memory</p>
          <h1>Design experiences that remember every room.</h1>
          <p className="hero-subtitle">
            A guided demo that tracks project history, learns preferences, and keeps
            style consistent across spaces.
          </p>
          <div className="cta-row">
            <Link className="button" to="/signup">
              Sign up
            </Link>
            <Link className="button ghost" to="/login">
              Log in
            </Link>
          </div>
        </div>
        <div className="landing-card">
          <h3>Why this matters</h3>
          <ul>
            <li>Project memory that captures every decision.</li>
            <li>Design versions you can compare and refine.</li>
            <li>Consistent style across bedroom, living room, office.</li>
          </ul>
        </div>
      </header>
    </div>
  )
}
