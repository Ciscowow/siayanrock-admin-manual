import { useEffect, useId, useRef, useState } from 'react'
import { LogIn, LogOut, UserRound } from 'lucide-react'
import './AccountIndicator.css'

type AccountIndicatorProps = {
  userEmail?: string
  onSignOut?: () => Promise<string | null>
  onLogin?: () => void
}

export function AccountIndicator({ userEmail, onSignOut, onLogin }: AccountIndicatorProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const signedIn = Boolean(onSignOut)
  const initials = userEmail?.split('@')[0].slice(0, 2).toUpperCase()

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const handleAccountAction = async () => {
    setError('')
    if (!onSignOut) {
      onLogin?.()
      setOpen(false)
      return
    }
    setSaving(true)
    try {
      const signOutError = await onSignOut()
      if (signOutError) setError(signOutError)
      else setOpen(false)
    } catch (signOutFailure) {
      console.error('Admin sign-out request failed:', signOutFailure)
      setError('Unable to sign out. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="account-indicator" ref={containerRef}>
    <button
      ref={triggerRef}
      className="account-indicator-trigger"
      type="button"
      aria-label={userEmail ? `Account for ${userEmail}` : 'Account'}
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      aria-haspopup="true"
      onClick={() => setOpen((current) => !current)}
    >
      {initials || <UserRound size={19} aria-hidden="true" />}
    </button>
    {open && <div className="account-indicator-menu" id={menuId} role="group" aria-label="Account options">
      {signedIn && <span className="account-indicator-email">{userEmail || 'Admin account'}</span>}
      {error && <span className="account-indicator-error" role="alert">{error}</span>}
      <button type="button" className="account-indicator-action" onClick={() => void handleAccountAction()} disabled={saving}>
        {signedIn ? <LogOut size={16} aria-hidden="true" /> : <LogIn size={16} aria-hidden="true" />}
        <span>{saving ? 'Signing out…' : signedIn ? 'Sign out' : 'Log in'}</span>
      </button>
    </div>}
  </div>
}
