import { useRef, useState, type FormEvent } from 'react'
import { LockKeyhole } from 'lucide-react'
import { AccountIndicator } from './AccountIndicator'
import './AdminSignIn.css'

export default function AdminSignIn({ onSignIn }: { onSignIn: (email: string, password: string) => Promise<string | null> }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const emailInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const signInError = await onSignIn(email.trim(), password)
      if (signInError) setError(signInError)
    } catch (signInFailure) {
      console.error('Admin sign-in request failed:', signInFailure)
      setError('Unable to sign in. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="admin-sign-in-page">
      <div className="admin-sign-in-account"><AccountIndicator onLogin={() => emailInputRef.current?.focus()} /></div>
      <section className="admin-sign-in-card">
        <img src="/siayanrock-logo.jpg" alt="SiayanRock" />
        <p className="eyebrow">SiayanRock Admin</p>
        <h1>Welcome back</h1>
        <p className="admin-sign-in-description">Sign in with your administrator account to continue.</p>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="admin-email">Email address</label>
          <input
            id="admin-email"
            ref={emailInputRef}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error && <p className="admin-sign-in-error" role="alert">{error}</p>}
          <button className="button button-primary admin-sign-in-submit" type="submit" disabled={submitting}>
            <LockKeyhole size={16} />{submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="admin-sign-in-note">Admin accounts are provisioned by the site owner.</p>
      </section>
    </main>
  )
}
