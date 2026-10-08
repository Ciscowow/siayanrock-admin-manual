import { useState } from 'react'
import { Search, Trash2, Users, X } from 'lucide-react'
import { formatCurrency, formatDate, statusKind } from '../shared'
import { StatusBadge } from '../StatusBadge'
import type { Booking, Guest } from '../types'
import './css/hometel-guests.css'

export function GuestsPage({ guests, bookings, query, setQuery, onDeleteGuest, deleteSavingId, deleteError }: {
  guests: Guest[]
  bookings: Booking[]
  query: string
  setQuery: (value: string) => void
  onDeleteGuest: (guest: Guest) => Promise<boolean>
  deleteSavingId: string | null
  deleteError: string
}) {
  const [guestToDelete, setGuestToDelete] = useState<Guest | null>(null)
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)
  const filteredGuests = guests.filter((guest) => `${guest.full_name} ${guest.email ?? ''} ${guest.phone ?? ''}`.toLowerCase().includes(query.toLowerCase()))

  const guestBookings = guestToDelete ? bookings.filter((booking) => booking.guestId === guestToDelete.id) : []
  const guestPaymentCount = guestBookings.reduce((count, booking) => count + booking.payments.length, 0)
  const selectedGuestBookings = selectedGuest
    ? bookings.filter((booking) => booking.guestId === selectedGuest.id)
      .sort((left, right) => right.checkIn.localeCompare(left.checkIn))
    : []
  const confirmDelete = async () => {
    if (guestToDelete && await onDeleteGuest(guestToDelete)) setGuestToDelete(null)
  }

  return <>
    <div className="page-heading"><div><p className="eyebrow">Hometel</p><h1>Guests</h1><p className="subtitle">Review customer details and stay history.</p></div></div>
    <section className="card bookings-card">
      <div className="filter-bar"><div className="search-box"><Search size={17} /><input placeholder="Search guests or email..." value={query} onChange={(e) => setQuery(e.target.value)} /></div></div>
      <div className="table-toolbar"><span><strong>{filteredGuests.length}</strong> guests</span></div>
      <div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{filteredGuests.map((guest) => {
        const deleting = deleteSavingId === guest.id
        return <tr
            key={guest.id}
            className="guest-clickable-row"
            tabIndex={0}
            aria-label={`View ${guest.full_name}'s details`}
            onClick={() => setSelectedGuest(guest)}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setSelectedGuest(guest)
              }
            }}
          >
          <td><button type="button" className="guest-profile-trigger" onClick={() => setSelectedGuest(guest)} aria-label={`View ${guest.full_name}'s details`}><span className="avatar" style={{ background: '#e5d0b9' }}>{guest.full_name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><span className="guest-profile-trigger-copy"><strong>{guest.full_name}</strong><small>View guest details</small></span></button></td>
          <td>{guest.email ?? '—'}</td>
          <td>{guest.phone ?? '—'}</td>
          <td>{new Date(guest.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
          <td><div className="guest-room-actions">
            <button className="button button-secondary guest-delete-button" onClick={(event) => { event.stopPropagation(); setGuestToDelete(guest) }} disabled={Boolean(deleteSavingId)} aria-label={`Delete ${guest.full_name}`}><Trash2 size={14} /> Delete guest</button>
            {deleting && <span className="guest-delete-progress">Deleting…</span>}
          </div></td>
        </tr>
      })}</tbody></table>
      {filteredGuests.length === 0 && <div className="empty-state"><Users size={25} /><strong>No guests found</strong><span>Try adjusting your search or add a guest record.</span></div>}
      </div>
    </section>
    {selectedGuest && <div className="assignment-backdrop guest-profile-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedGuest(null) }}>
      <section className="assignment-dialog card guest-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="guest-profile-title">
        <header className="assignment-header">
          <div><p className="eyebrow">Guest profile</p><h2 id="guest-profile-title">{selectedGuest.full_name}</h2><p className="subtitle">Guest since {new Date(selectedGuest.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</p></div>
          <button className="icon-button" onClick={() => setSelectedGuest(null)} aria-label="Close guest profile"><X size={19} /></button>
        </header>
        <div className="guest-profile-content">
          <section className="guest-profile-info" aria-label="Contact information">
            <div><span>Email</span><strong>{selectedGuest.email || 'Not provided'}</strong></div>
            <div><span>Phone</span><strong>{selectedGuest.phone || 'Not provided'}</strong></div>
          </section>
          <section className="guest-profile-stays">
            <div className="guest-profile-section-heading"><h3>Stay history</h3><span>{selectedGuestBookings.length} {selectedGuestBookings.length === 1 ? 'booking' : 'bookings'}</span></div>
            {selectedGuestBookings.length > 0 ? selectedGuestBookings.map((booking) => <article className="guest-profile-booking" key={booking.id}>
              <header><div><strong>{booking.room}</strong><span>{formatDate(booking.checkIn)} – {formatDate(booking.checkOut)}</span></div><StatusBadge kind={statusKind(booking.status)}>{booking.status}</StatusBadge></header>
              <div className="guest-profile-booking-meta">
                <span>{booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}</span>
                <span>Total <strong>{formatCurrency(booking.amount)}</strong></span>
                <span>Paid <strong>{formatCurrency(booking.paid)}</strong></span>
              </div>
              {booking.request !== 'No special requests.' && <div className="guest-profile-request"><p><strong>Special request:</strong> {booking.request}</p><span className={`guest-request-note-status ${booking.specialRequestNoted ? 'is-noted' : ''}`}>{booking.specialRequestNoted ? 'Noted' : 'Not noted'}</span></div>}
            </article>) : <div className="guest-profile-empty">No stays recorded for this guest yet.</div>}
          </section>
          <div className="guest-profile-actions">
            <button className="button button-secondary guest-delete-button" onClick={() => { setGuestToDelete(selectedGuest); setSelectedGuest(null) }} disabled={Boolean(deleteSavingId)}><Trash2 size={14} /> Delete guest</button>
          </div>
        </div>
      </section>
    </div>}
    {guestToDelete && <div className="assignment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleteSavingId) setGuestToDelete(null) }}>
      <section className="assignment-dialog card guest-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-guest-title" aria-describedby="delete-guest-consequence">
        <header className="assignment-header">
          <div><p className="eyebrow">Permanent deletion</p><h2 id="delete-guest-title">Delete {guestToDelete.full_name}?</h2></div>
          <button className="icon-button" onClick={() => setGuestToDelete(null)} aria-label="Close delete guest confirmation" disabled={Boolean(deleteSavingId)}><X size={19} /></button>
        </header>
        <div className="assignment-form">
          <p id="delete-guest-consequence" className="guest-delete-consequence">This permanently deletes the guest and their {guestBookings.length} booking(s), {guestPaymentCount} payment transaction(s), and associated room-change credit history. Any room dates held by those bookings will become available.</p>
          {deleteError && <p className="payment-error" role="alert">{deleteError}</p>}
          <footer className="assignment-actions">
            <button className="button button-secondary" onClick={() => setGuestToDelete(null)} disabled={Boolean(deleteSavingId)}>Keep guest</button>
            <button className="button button-danger" onClick={confirmDelete} disabled={Boolean(deleteSavingId)}>{deleteSavingId === guestToDelete.id ? 'Deleting records…' : 'Delete guest and history'}</button>
          </footer>
        </div>
      </section>
    </div>}
  </>
}
