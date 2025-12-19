import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    console.log('Supabase client OK', supabase)
  }, [])

  return (
    <div className="app-container">
      <header className="hero-section">
        <div className="container">
          <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 'var(--header-height)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', background: 'linear-gradient(to right, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              CFO Diagnosis
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '0.875rem', color: '#22c55e' }}>● Supabase connected</span>
              <button className="btn">Sign In</button>
            </div>
          </nav>

          <main style={{ marginTop: 'var(--spacing-xl)', textAlign: 'center' }}>
            <h1 style={{ fontSize: '3.5rem', fontWeight: '800', marginBottom: 'var(--spacing-lg)', lineHeight: 1.1 }}>
              Financial Maturity <br />
              <span style={{ color: 'var(--primary-color)' }}>Diagnosis Tool</span>
            </h1>
            <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto var(--spacing-xl)' }}>
              Evaluate your finance function's capabilities with our advanced scoring engine.
              Deterministic, configurable, and insightful.
            </p>

            <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => setCount(c => c + 1)}>
                Get Started ({count})
              </button>
              <button className="btn" style={{ border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                Learn More
              </button>
            </div>
          </main>
        </div>
      </header>
    </div>
  )
}

export default App
