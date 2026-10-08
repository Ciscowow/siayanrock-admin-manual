import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Check, ChevronDown, CircleDollarSign, Pencil, Search, Trash2, X } from 'lucide-react'
import { formatCurrency, formatDate, hasSpecialRequest, statusKind, toDateKey } from '../shared'
import { StatusBadge } from '../StatusBadge'
import type { Booking, BookingStatus, Guest, GuestAssignment, NewBookingValues, PaymentStatus, Room } from '../types'
import './css/hometel-bookings.css'

export function BookingsPage({ bookings, loadError, query, setQuery, statusFilter, setStatusFilter, specialRequestsOnly, setSpecialRequestsOnly, onStatusChange, onManagePayment, onEditBooking, onDeleteBooking, onSpecialRequestNoted, onCreateBooking }: { bookings: Booking[]; loadError: string; query: string; setQuery: (v: string) => void; statusFilter: string; setStatusFilter: (v: string) => void; specialRequestsOnly: boolean; setSpecialRequestsOnly: (value: boolean) => void; onStatusChange: (b: Booking, status: BookingStatus) => Promise<boolean>; onManagePayment: (b: Booking) => void; onEditBooking: (booking: Booking) => void; onDeleteBooking: (booking: Booking) => void; onSpecialRequestNoted: (booking: Booking, noted: boolean) => Promise<string | null>; onCreateBooking: () => void }) {
  const monthGroups = useMemo(() => {
    const months = new Map<string, Booking[]>()
    bookings.forEach((booking) => {
      const monthKey = booking.checkIn.slice(0, 7)
      const monthBookings = months.get(monthKey) ?? []
      monthBookings.push(booking)
      months.set(monthKey, monthBookings)
    })

    return Array.from(months, ([monthKey, monthBookings]) => ({
      key: monthKey,
      label: new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }),
      bookings: monthBookings.sort((left, right) =>
        left.checkIn.localeCompare(right.checkIn) || right.createdAt.localeCompare(left.createdAt)),
    })).sort((left, right) => left.key.localeCompare(right.key))
  }, [bookings])
  const visibleMonthGroups = monthGroups.map((month) => ({
    ...month,
    bookings: month.bookings.filter((booking) => {
      const matchesQuery = `${booking.guest} ${booking.id} ${booking.room}`.toLowerCase().includes(query.trim().toLowerCase())
      const matchesStatus = statusFilter === 'All statuses' || booking.status === statusFilter
      const matchesSpecialRequests = !specialRequestsOnly || hasSpecialRequest(booking) && !booking.specialRequestNoted
      return matchesQuery && matchesStatus && matchesSpecialRequests
    }),
  })).filter((month) => month.bookings.length > 0)
  const visibleBookingCount = visibleMonthGroups.reduce((total, month) => total + month.bookings.length, 0)

    return <>
    <div className="page-heading"><div><p className="eyebrow">Hometel</p><h1>Bookings</h1><p className="subtitle">Manage reservations, guests, and stay details.</p></div><button className="button button-primary" onClick={onCreateBooking}><CalendarDays size={17} /> New booking</button></div>
    <section className="card bookings-card">
      <div className="filter-bar">
        <div className="search-box"><Search size={17} /><input placeholder="Search by guest, booking ID, or room..." value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <label className="select-wrap filter-select"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All statuses</option><option>Confirmed</option><option>Pending</option><option>Checked in</option><option>Completed</option><option>Cancelled</option></select><ChevronDown size={14} /></label>
        {specialRequestsOnly && <button className="filter-button" onClick={() => setSpecialRequestsOnly(false)}>Special requests only <X size={14} /></button>}
      </div>
      <div className="table-toolbar"><span><strong>{visibleBookingCount}</strong> bookings</span></div>
      <div className="booking-account-list">
        {loadError && <div className="booking-load-error" role="alert">{loadError}</div>}
        {visibleMonthGroups.map((month) => <section className="booking-month-group" key={month.key}>
          <h2 className="booking-month-heading">{month.label}</h2>
          <div className="booking-month-bookings">{month.bookings.map((booking) => {
            const checkInDay = String(Number(booking.checkIn.slice(8, 10)))
            return <section className="booking-account-group" key={booking.id}>
              <div className="booking-account-summary">
                <span className="booking-account-day" aria-label={`Check-in day ${checkInDay}`}>{checkInDay}</span>
                <span className="booking-account-person"><strong>{booking.guest}</strong><small>{booking.email || booking.phone || booking.guestId}</small></span>
                <div className="booking-account-actions">
                  <button className="button button-secondary booking-edit-button" type="button" onClick={() => onEditBooking(booking)}><Pencil size={14} /> Edit</button>
                  <button className="button button-danger booking-delete-button" type="button" onClick={() => onDeleteBooking(booking)} aria-label={`Delete booking for ${booking.guest}`}><Trash2 size={14} /> Delete</button>
                </div>
              </div>
              <div className="booking-account-details"><BookingTable bookings={[booking]} onStatusChange={onStatusChange} onManagePayment={onManagePayment} hideGuest /></div>
              {hasSpecialRequest(booking) && <BookingSpecialRequest booking={booking} onNotedChange={onSpecialRequestNoted} />}
            </section>
          })}</div>
        </section>)}
        {!loadError && visibleBookingCount === 0 && <div className="empty-state"><Search size={25} /><strong>No bookings found</strong><span>Try adjusting your search or filters.</span></div>}
      </div>
    </section>
  </>
}

export function DeleteBookingDialog({ booking, error, saving, onClose, onConfirm }: {
  booking: Booking
  error: string
  saving: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return <div className="assignment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="assignment-dialog card booking-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-booking-title" aria-describedby="delete-booking-consequence">
      <header className="assignment-header">
        <div><p className="eyebrow">Permanent deletion</p><h2 id="delete-booking-title">Delete this booking?</h2></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close delete booking confirmation" disabled={saving}><X size={19} /></button>
      </header>
      <div className="assignment-form">
        <p id="delete-booking-consequence" className="booking-delete-consequence">
          This permanently deletes {booking.guest}’s booking for {booking.room}, including its {booking.payments.length} payment record(s) and associated room-change history. This action cannot be undone.
        </p>
        {error && <p className="payment-error" role="alert">{error}</p>}
        <footer className="assignment-actions">
          <button className="button button-secondary" type="button" onClick={onClose} disabled={saving}>Keep booking</button>
          <button className="button button-danger" type="button" onClick={onConfirm} disabled={saving}>{saving ? 'Deleting booking…' : 'Delete booking'}</button>
        </footer>
      </div>
    </section>
  </div>
}

export function EditBookingDialog({ booking, rooms, bookings, error, saving, onClose, onSave }: {
  booking: Booking
  rooms: Room[]
  bookings: Booking[]
  error: string
  saving: boolean
  onClose: () => void
  onSave: (booking: Booking, assignment: GuestAssignment) => Promise<boolean>
}) {
  const [roomId, setRoomId] = useState(String(booking.roomId))
  const [checkIn, setCheckIn] = useState(booking.checkIn)
  const [checkOut, setCheckOut] = useState(booking.checkOut)
  const [guestCount, setGuestCount] = useState(String(booking.guests))
  const [specialRequests, setSpecialRequests] = useState(booking.request === 'No special requests.' ? '' : booking.request)
  const availableRooms = rooms.filter((room) => {
    if (!room.isActive || room.isUnderMaintenance || Number(guestCount) > room.capacity) return false
    return !bookings.some((otherBooking) =>
      otherBooking.id !== booking.id &&
      otherBooking.roomId === Number(room.id) &&
      otherBooking.status !== 'Cancelled' &&
      otherBooking.status !== 'Completed' &&
      otherBooking.checkIn < checkOut &&
      otherBooking.checkOut > checkIn,
    )
  })
  const selectedRoom = availableRooms.find((room) => room.id === roomId)
  const nights = Math.max(0, Math.round((new Date(`${checkOut}T00:00:00`).getTime() - new Date(`${checkIn}T00:00:00`).getTime()) / 86_400_000))
  const totalPrice = (selectedRoom?.rate ?? 0) * nights
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedRoom || nights < 1) return
    await onSave(booking, {
      roomId: Number(roomId),
      checkIn,
      checkOut,
      guestCount: Number(guestCount),
      specialRequests: specialRequests.trim(),
    })
  }

  return <div className="assignment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="assignment-dialog card" role="dialog" aria-modal="true" aria-labelledby="edit-booking-title">
      <header className="assignment-header">
        <div><p className="eyebrow">Booking details</p><h2 id="edit-booking-title">Edit {booking.guest}'s booking</h2><p className="subtitle">Update room, stay dates, and guest count.</p></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close edit booking" disabled={saving}><X size={19} /></button>
      </header>
      <form className="assignment-form" onSubmit={submit}>
        <label>Room
          <select value={roomId} onChange={(event) => setRoomId(event.target.value)} required disabled={saving}>
            {availableRooms.length === 0 && <option value="">No available room matches these dates and guest count</option>}
            {availableRooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.type} · {formatCurrency(room.rate)}/night · up to {room.capacity}</option>)}
          </select>
        </label>
        <div className="assignment-date-row">
          <label>Check-in<input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} required disabled={saving} /></label>
          <label>Check-out<input type="date" value={checkOut} min={checkIn || undefined} onChange={(event) => setCheckOut(event.target.value)} required disabled={saving} /></label>
        </div>
        <label>Number of guests
          <input type="number" min="1" max={selectedRoom?.capacity ?? undefined} value={guestCount} onChange={(event) => setGuestCount(event.target.value)} required disabled={saving || !selectedRoom} />
        </label>
        <label>Special request / notes
          <textarea rows={3} value={specialRequests} onChange={(event) => setSpecialRequests(event.target.value)} placeholder="Add requests or notes for this booking (optional)." disabled={saving} />
        </label>
        <div className="assignment-total"><span>{selectedRoom ? `${formatCurrency(selectedRoom.rate)} per room × ${nights} night${nights === 1 ? '' : 's'} · Updated total` : 'Updated total'}</span><strong>{formatCurrency(totalPrice)}</strong></div>
        {!selectedRoom && <p className="payment-error" role="status">No available room matches these dates and guest count.</p>}
        {error && <p className="payment-error" role="alert">{error}</p>}
        <footer className="assignment-actions">
          <button className="button button-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="button button-primary" type="submit" disabled={saving || !selectedRoom || nights < 1 || Number(guestCount) < 1 || Number(guestCount) > (selectedRoom?.capacity ?? 0)}>{saving ? 'Saving booking…' : 'Save changes'}</button>
        </footer>
      </form>
    </section>
  </div>
}

function BookingSpecialRequest({ booking, onNotedChange }: {
  booking: Booking
  onNotedChange: (booking: Booking, noted: boolean) => Promise<string | null>
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const handleChange = async (noted: boolean) => {
    setSaving(true)
    setError('')
    const saveError = await onNotedChange(booking, noted)
    if (saveError) setError(saveError)
    setSaving(false)
  }

  return <div className="booking-special-request">
    <div className="booking-special-request-copy"><strong>Special request</strong><span>{booking.request}</span></div>
    <label className="booking-special-request-toggle">
      <input type="checkbox" checked={booking.specialRequestNoted} onChange={(event) => void handleChange(event.target.checked)} disabled={saving} />
      <span>{saving ? 'Saving…' : 'Noted'}</span>
    </label>
    {error && <small className="booking-special-request-error" role="alert">{error}</small>}
  </div>
}

export function BookingTable({ bookings, onStatusChange, onManagePayment, compact = false, hideGuest = false }: { bookings: Booking[]; onStatusChange: (b: Booking, status: BookingStatus) => Promise<boolean>; onManagePayment: (b: Booking) => void; compact?: boolean; hideGuest?: boolean }) {
  return <div className={`table-scroll booking-table-scroll ${compact ? 'table-compact' : ''}`}><table><thead><tr>{!hideGuest && <th>Guest</th>}<th>Room</th><th>Stay dates</th><th>Guests</th><th>Total</th><th>Status</th><th>Payment</th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id}>{!hideGuest && <td><div className="guest-cell"><div className="avatar" style={{ background: booking.color }}>{booking.initials}</div><div><strong>{booking.guest}</strong><span>{booking.id}</span></div></div></td>}<td>{booking.room}</td><td><div className="booking-stay-dates"><span><small>Check-in</small>{formatDate(booking.checkIn)}</span><span><small>Check-out</small>{formatDate(booking.checkOut)}</span></div></td><td>{booking.guests}</td><td><strong>{formatCurrency(booking.amount)}</strong><span className="table-subtext">{formatCurrency(booking.paid)} paid</span></td><td><BookingStatusPill booking={booking} onChange={onStatusChange} /></td><td><button type="button" className="badge-action booking-payment-action" title="Manage booking payments" aria-label={`Manage payments for ${booking.guest}: ${booking.payment}`} onClick={() => onManagePayment(booking)}><StatusBadge kind={statusKind(booking.payment)}>{booking.payment}</StatusBadge></button></td></tr>)}</tbody></table>{bookings.length === 0 && <div className="empty-state"><Search size={25} /><strong>No bookings found</strong><span>Try adjusting your search or filters.</span></div>}</div>
}

function BookingStatusPill({ booking, onChange }: { booking: Booking; onChange: (booking: Booking, status: BookingStatus) => Promise<boolean> }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const controlRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = `booking-status-menu-${booking.id}`

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return
    const triggerRect = triggerRef.current.getBoundingClientRect()
    const menuRect = menuRef.current.getBoundingClientRect()
    const edgePadding = 8
    const belowTop = triggerRect.bottom + 6
    const top = belowTop + menuRect.height <= window.innerHeight - edgePadding
      ? belowTop
      : Math.max(edgePadding, triggerRect.top - menuRect.height - 6)
    const left = Math.max(edgePadding, Math.min(triggerRect.left, window.innerWidth - menuRect.width - edgePadding))
    setMenuPosition({ top, left })
  }, [open])

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !controlRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    const closeOnViewportChange = () => setOpen(false)
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', closeOnViewportChange)
    window.addEventListener('scroll', closeOnViewportChange, true)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', closeOnViewportChange)
      window.removeEventListener('scroll', closeOnViewportChange, true)
    }
  }, [open])

  const handleChange = async (nextStatus: BookingStatus) => {
    if (nextStatus === booking.status) return
    setOpen(false)
    triggerRef.current?.focus()
    setSaving(true)
    setError('')
    const saved = await onChange(booking, nextStatus)
    if (!saved) setError('Status could not be saved.')
    setSaving(false)
  }

  return <div className="booking-status-control" ref={controlRef}>
    <button
      ref={triggerRef}
      type="button"
      className={`badge-status-select badge-${statusKind(booking.status)}`}
      title="Change booking status"
      aria-label={`Change status for ${booking.guest}: ${booking.status}`}
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      onClick={() => setOpen((current) => !current)}
      disabled={saving}
    >
      <span>{booking.status}</span>
      <ChevronDown size={12} aria-hidden="true" />
    </button>
    {open && createPortal(<div ref={menuRef} className="booking-status-menu" id={menuId} role="group" aria-label={`Booking status options for ${booking.guest}`} style={menuPosition}>
      {(['Pending', 'Confirmed', 'Checked in', 'Completed', 'Cancelled'] as BookingStatus[]).map((status) => (
        <button
          key={status}
          type="button"
          className={`booking-status-option ${status === booking.status ? 'is-current' : ''}`}
          aria-pressed={status === booking.status}
          disabled={saving}
          onClick={() => void handleChange(status)}
        >
          <span>{status}</span>
        </button>
      ))}
    </div>, document.body)}
    {error && <small className="booking-status-error" role="alert">{error}</small>}
  </div>
}

export function BookingActionDialog({ booking, onClose, onAddPayment, paymentError, paymentSaving }: {
  booking: Booking
  onClose: () => void
  onAddPayment: (amount: number, method: string) => Promise<boolean>
  paymentError: string
  paymentSaving: boolean
}) {
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const remaining = Math.max(0, booking.amount - booking.paid)
  const amount = Number(paymentAmount)
  const submitPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (await onAddPayment(amount, paymentMethod)) setPaymentAmount('')
  }
  const title = 'Manage booking payments'
  const paymentTypeLabel = (type: string) => ({
    full: 'Full payment',
    downpayment: 'Down payment',
    balance: 'Balance payment',
  }[type.toLowerCase()] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()))
  const paymentMethodLabel = (method: string) => ({
    bank_transfer: 'Bank transfer',
    gcash: 'GCash',
    cash: 'Cash',
  }[method.toLowerCase()] ?? method.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()))

  return <div className="booking-payment-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !paymentSaving) onClose()
  }}>
    <aside className="booking-payment-drawer" role="dialog" aria-modal="true" aria-labelledby="booking-action-title">
      <header className="assignment-header">
        <div><p className="eyebrow">{booking.guest}</p><h2 id="booking-action-title">{title}</h2></div>
        <button className="icon-button" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`} disabled={paymentSaving}><X size={19} /></button>
      </header>
      <div className="booking-payment-dialog-content">
          <div className="booking-payment-summary">
            <div><span>Booking total</span><strong>{formatCurrency(booking.amount)}</strong></div>
            <div><span>Paid</span><strong>{formatCurrency(booking.paid)}</strong></div>
            <div><span>Remaining</span><strong>{formatCurrency(remaining)}</strong></div>
          </div>
          <form className="assignment-form" onSubmit={submitPayment}>
            <label>Payment amount
              <input aria-label="Payment amount" type="number" min="0.01" max={remaining} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} required disabled={remaining <= 0 || paymentSaving} />
            </label>
            <label>Payment method
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} disabled={paymentSaving}>
                <option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="gcash">GCash</option>
              </select>
            </label>
            {paymentError && <p className="payment-error" role="alert">{paymentError}</p>}
            <button className="button button-primary button-full" type="submit" disabled={remaining <= 0 || booking.status === 'Cancelled' || paymentSaving}>
              <CircleDollarSign size={16} /> {paymentSaving ? 'Recording payment…' : remaining <= 0 ? 'Fully paid' : 'Record payment'}
            </button>
          </form>
          <div className="payment-history">
            <div className="booking-payment-history-heading"><h4>Payment history</h4><span>{booking.payments.length}</span></div>
            {booking.payments.length > 0 ? <div className="booking-payment-history-list">{booking.payments.map((payment, index) => <div className="booking-payment-history-row" key={payment.id ?? `${payment.paidAt ?? 'payment'}-${index}`}>
              <div className="booking-payment-history-detail">
                <strong>{paymentTypeLabel(payment.type)}</strong>
                <span>{paymentMethodLabel(payment.method)}{payment.paidAt ? ` · ${new Date(payment.paidAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}</span>
              </div>
              <strong className="booking-payment-history-amount">{formatCurrency(payment.amount)}</strong>
            </div>)}</div> : <span className="booking-payment-empty">No payments recorded yet.</span>}
          </div>
      </div>
    </aside>
  </div>
}

export function BookingDrawer({ booking, onClose, onStatusChange, onAddPayment, paymentError, paymentSaving }: {
  booking: Booking
  onClose: () => void
  onStatusChange: (status: BookingStatus) => void
  onAddPayment: (amount: number, method: string) => Promise<boolean>
  paymentError: string
  paymentSaving: boolean
}) {
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const remaining = Math.max(0, booking.amount - booking.paid)
  const overpayment = Math.max(0, booking.paid - booking.amount)
  const parsedPayment = Number(paymentAmount)
  const projectedPayment = booking.paid + parsedPayment
  const paymentPreview = parsedPayment > 0 && parsedPayment <= remaining
    ? projectedPayment >= booking.amount ? 'Fully paid' : 'Partially paid'
    : null

  const submitPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const saved = await onAddPayment(parsedPayment, paymentMethod)
    if (saved) setPaymentAmount('')
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <div><p className="eyebrow">Booking {booking.id}</p><h2>{booking.guest}</h2></div>
          <button className="icon-button close-button" onClick={onClose} aria-label="Close booking details"><X size={20} /></button>
        </div>
        <div className="drawer-body">
          <div className="drawer-status-row"><StatusBadge kind={statusKind(booking.status)}>{booking.status}</StatusBadge><span>Booked {formatDate(booking.createdAt)}</span></div>
          <div className="detail-section">
            <h3>Stay details</h3>
            <div className="detail-grid">
              <div><span>Room</span><strong>{booking.room}</strong></div>
              <div><span>Guests</span><strong>{booking.guests} guests</strong></div>
              <div><span>Check-in</span><strong>{formatDate(booking.checkIn)}</strong></div>
              <div><span>Check-out</span><strong>{formatDate(booking.checkOut)}</strong></div>
            </div>
          </div>
          <div className="detail-section">
            <h3>Payment summary</h3>
            <div className="payment-summary">
              <div><span>Total price</span><strong>{formatCurrency(booking.amount)}</strong></div>
              <div><span>Paid to date</span><strong className="paid-text">{formatCurrency(booking.paid)}</strong></div>
              <div><span>Payment status</span><StatusBadge kind={statusKind(booking.payment)}>{booking.payment}</StatusBadge></div>
              <div className="summary-total"><span>Remaining balance</span><strong>{formatCurrency(remaining)}</strong></div>
              {overpayment > 0 && <div><span>Overpayment</span><strong className="credit-amount">{formatCurrency(overpayment)}</strong></div>}
              <div className="progress-bar"><span style={{ width: `${booking.amount > 0 ? Math.min(100, (booking.paid / booking.amount) * 100) : 0}%` }} /></div>
            </div>
            <form className="payment-entry" onSubmit={submitPayment}>
              <h4>Record a payment</h4>
              <label><span>Amount</span>
                <div className="payment-input"><input aria-label="Payment amount" type="number" min="0.01" max={remaining} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} required disabled={remaining <= 0 || paymentSaving} /></div>
              </label>
              <label><span>Method</span>
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} disabled={paymentSaving}>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="gcash">GCash</option>
                </select>
              </label>
              {paymentPreview && <p className="payment-preview">This payment will make the booking <strong>{paymentPreview.toLowerCase()}</strong>.</p>}
              {paymentError && <p className="payment-error" role="alert">{paymentError}</p>}
              <button className="button button-primary button-full" type="submit" disabled={remaining <= 0 || booking.status === 'Cancelled' || paymentSaving}>
                <CircleDollarSign size={16} /> {paymentSaving ? 'Recording payment…' : remaining <= 0 ? 'Fully paid' : 'Add payment'}
              </button>
            </form>
            {booking.payments.length > 0 && <div className="payment-history">
              <h4>Payment history</h4>
              {booking.payments.map((payment, index) => <div className="payment-history-row" key={`${payment.paidAt ?? 'payment'}-${index}`}>
                <span>{payment.type} · {payment.method}{payment.paidAt ? ` · ${new Date(payment.paidAt).toLocaleDateString('en-PH')}` : ''}</span>
                <strong>{formatCurrency(payment.amount)}</strong>
              </div>)}
            </div>}
          </div>
          <div className="detail-section">
            <h3>Guest information</h3>
            <div className="guest-detail"><div className="avatar" style={{ background: booking.color }}>{booking.initials}</div><div><strong>{booking.guest}</strong><span>{booking.email}</span><span>{booking.phone}</span></div></div>
          </div>
          <div className="detail-section"><h3>Special requests</h3><p className="request-box">{booking.request}</p></div>
        </div>
        <div className="drawer-footer">
          <span>Update status</span>
          <label className="select-wrap"><select value={booking.status} onChange={(event) => onStatusChange(event.target.value as BookingStatus)}><option>Pending</option><option>Confirmed</option><option>Checked in</option><option>Completed</option><option>Cancelled</option></select><ChevronDown size={14} /></label>
          <button className="button button-primary button-full" onClick={onClose}><Check size={16} /> Save changes</button>
        </div>
      </aside>
    </div>
  )
}

export function GuestAssignmentDialog({ guest, rooms, bookings, error, saving, onClose, onAssign }: {
  guest: Guest
  rooms: Room[]
  bookings: Booking[]
  error: string
  saving: boolean
  onClose: () => void
  onAssign: (assignment: GuestAssignment) => Promise<boolean>
}) {
  const today = toDateKey(new Date())
  const tomorrow = toDateKey(new Date(Date.now() + 86_400_000))
  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(tomorrow)
  const [roomId, setRoomId] = useState('')
  const [guestCount, setGuestCount] = useState('1')
  const availableRooms = rooms.filter((room) => {
    if (!room.isActive) return false
    const conflicts = bookings.some((booking) =>
      booking.roomId === Number(room.id) &&
      booking.status !== 'Cancelled' &&
      booking.status !== 'Completed' &&
      booking.checkIn < checkOut &&
      booking.checkOut > checkIn,
    )
    const includesToday = checkIn <= today && checkOut > today
    return !conflicts && !(includesToday && room.status === 'occupied')
  })

  useEffect(() => {
    setRoomId((currentRoomId) =>
      availableRooms.some((room) => room.id === currentRoomId)
        ? currentRoomId
        : availableRooms[0]?.id ?? '',
    )
  }, [availableRooms])

  const selectedRoom = availableRooms.find((room) => room.id === roomId)
  const nights = Math.max(0, Math.round((new Date(`${checkOut}T00:00:00`).getTime() - new Date(`${checkIn}T00:00:00`).getTime()) / 86_400_000))
  const totalPrice = (selectedRoom?.rate ?? 0) * nights
  const submitAssignment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedRoom) return
    await onAssign({ roomId: Number(roomId), checkIn, checkOut, guestCount: Number(guestCount) })
  }

  return <div className="assignment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="assignment-dialog card" role="dialog" aria-modal="true" aria-labelledby="assignment-title">
      <header className="assignment-header">
        <div><p className="eyebrow">Guest room assignment</p><h2 id="assignment-title">{guest.full_name}</h2><p className="subtitle">Create a booking for this guest.</p></div>
        <button className="icon-button" onClick={onClose} aria-label="Close assignment" disabled={saving}><X size={19} /></button>
      </header>
      <form className="assignment-form" onSubmit={submitAssignment}>
        <label>Room
          <select value={roomId} onChange={(event) => setRoomId(event.target.value)} required disabled={saving || availableRooms.length === 0}>
            {availableRooms.length === 0 ? <option value="">No rooms available for these dates</option> : availableRooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.type} · {formatCurrency(room.rate)}/night · up to {room.capacity}</option>)}
          </select>
        </label>
        <div className="assignment-date-row">
          <label>Check-in<input type="date" value={checkIn} min={today} onChange={(event) => setCheckIn(event.target.value)} required disabled={saving} /></label>
          <label>Check-out<input type="date" value={checkOut} min={checkIn || today} onChange={(event) => setCheckOut(event.target.value)} required disabled={saving} /></label>
        </div>
        <label>Number of guests
          <input type="number" min="1" max={selectedRoom?.capacity ?? undefined} value={guestCount} onChange={(event) => setGuestCount(event.target.value)} required disabled={saving || !selectedRoom} />
        </label>
        <p className="room-change-note">Room rate is per room per night. Guest count affects capacity only, not the room price.</p>
        <div className="assignment-total"><span>{selectedRoom ? `${formatCurrency(selectedRoom.rate)} per room × ${nights} night${nights === 1 ? '' : 's'} · Estimated total` : 'Estimated total'}</span><strong>{formatCurrency(totalPrice)}</strong></div>
        {!selectedRoom && <p className="payment-error" role="status">No active room is available for the selected stay dates.</p>}
        {error && <p className="payment-error" role="alert">{error}</p>}
        <footer className="assignment-actions">
          <button className="button button-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="button button-primary" type="submit" disabled={saving || !selectedRoom || nights < 1 || Number(guestCount) > (selectedRoom?.capacity ?? 0)}>{saving ? 'Creating booking…' : 'Assign room'}</button>
        </footer>
      </form>
    </section>
  </div>
}

export function NewBookingDialog({ rooms, guests, bookings, error, saving, onClose, onCreate }: {
  rooms: Room[]
  guests: Guest[]
  bookings: Booking[]
  error: string
  saving: boolean
  onClose: () => void
  onCreate: (values: NewBookingValues) => Promise<void>
}) {
  const today = toDateKey(new Date())
  const tomorrow = toDateKey(new Date(Date.now() + 86_400_000))
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(tomorrow)
  const [roomId, setRoomId] = useState('')
  const [guestCount, setGuestCount] = useState('1')
  const [specialRequests, setSpecialRequests] = useState('')
  const [status, setStatus] = useState<'pending' | 'confirmed'>('confirmed')
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedPhone = phone.replace(/\D/g, '')
  const matchingGuest = guests.find((guest) =>
    normalizedEmail && guest.email?.trim().toLowerCase() === normalizedEmail,
  ) ?? (normalizedPhone
    ? guests.find((guest) => guest.phone?.replace(/\D/g, '') === normalizedPhone)
    : undefined)
  const availableRooms = rooms.filter((room) => {
    if (!room.isActive || room.isUnderMaintenance) return false
    const conflict = bookings.some((booking) =>
      booking.roomId === Number(room.id) &&
      booking.status !== 'Cancelled' &&
      booking.status !== 'Completed' &&
      booking.checkIn < checkOut &&
      booking.checkOut > checkIn,
    )
    const includesToday = checkIn <= today && checkOut > today
    return !conflict && !(includesToday && room.status === 'occupied')
  })

  useEffect(() => {
    setRoomId((currentRoomId) =>
      availableRooms.some((room) => room.id === currentRoomId)
        ? currentRoomId
        : availableRooms[0]?.id ?? '',
    )
  }, [availableRooms])

  const selectedRoom = availableRooms.find((room) => room.id === roomId)
  const nights = Math.max(0, Math.round((new Date(`${checkOut}T00:00:00`).getTime() - new Date(`${checkIn}T00:00:00`).getTime()) / 86_400_000))
  const totalPrice = (selectedRoom?.rate ?? 0) * nights
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedRoom) return
    void onCreate({
      fullName,
      email,
      phone,
      roomId: Number(roomId),
      checkIn,
      checkOut,
      guestCount: Number(guestCount),
      specialRequests,
      status,
    })
  }

  return <div className="assignment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="assignment-dialog card" role="dialog" aria-modal="true" aria-labelledby="new-booking-title">
      <header className="assignment-header">
        <div><p className="eyebrow">Hometel reservation</p><h2 id="new-booking-title">Create a booking</h2><p className="subtitle">Add guest details and reserve an available room.</p></div>
        <button className="icon-button" onClick={onClose} aria-label="Close new booking" disabled={saving}><X size={19} /></button>
      </header>
      <form className="assignment-form" onSubmit={submit}>
        <label>Guest name
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required disabled={saving} />
        </label>
        <div className="assignment-date-row">
          <label>Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" disabled={saving} />
          </label>
          <label>Phone
            <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" disabled={saving} />
          </label>
        </div>
        {matchingGuest && <p className="room-change-note">Existing guest record will be used: <strong>{matchingGuest.full_name}</strong>.</p>}
        <label>Room
          <select value={roomId} onChange={(event) => setRoomId(event.target.value)} required disabled={saving || availableRooms.length === 0}>
            {availableRooms.length === 0 ? <option value="">No rooms available for these dates</option> : availableRooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.type} · {formatCurrency(room.rate)}/night · up to {room.capacity}</option>)}
          </select>
        </label>
        <div className="assignment-date-row">
          <label>Check-in
            <input type="date" value={checkIn} min={today} onChange={(event) => setCheckIn(event.target.value)} required disabled={saving} />
          </label>
          <label>Check-out
            <input type="date" value={checkOut} min={checkIn || today} onChange={(event) => setCheckOut(event.target.value)} required disabled={saving} />
          </label>
        </div>
        <div className="assignment-date-row">
          <label>Number of guests
            <input type="number" min="1" max={selectedRoom?.capacity ?? undefined} value={guestCount} onChange={(event) => setGuestCount(event.target.value)} required disabled={saving || !selectedRoom} />
          </label>
          <label>Booking status
            <select value={status} onChange={(event) => {
              const nextStatus = event.target.value
              if (nextStatus === 'pending' || nextStatus === 'confirmed') setStatus(nextStatus)
            }} disabled={saving}>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
            </select>
          </label>
        </div>
        <label><span className="assignment-label-title">Special requests <span>(optional)</span></span>
          <textarea rows={3} value={specialRequests} onChange={(event) => setSpecialRequests(event.target.value)} disabled={saving} />
        </label>
        <div className="assignment-total"><span>Booking total</span><strong>{formatCurrency(totalPrice)}</strong></div>
        {!selectedRoom && <p className="payment-error" role="status">No active room is available for the selected stay dates.</p>}
        {error && <p className="payment-error" role="alert">{error}</p>}
        <footer className="assignment-actions">
          <button className="button button-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="button button-primary" type="submit" disabled={saving || !selectedRoom || nights < 1 || Number(guestCount) > (selectedRoom?.capacity ?? 0)}>{saving ? 'Creating booking…' : 'Create booking'}</button>
        </footer>
      </form>
    </section>
  </div>
}

export function RoomChangeDialog({ guest, rooms, bookings, setupError, error, saving, onClose, onChangeRoom }: {
  guest: Guest
  rooms: Room[]
  bookings: Booking[]
  setupError: string
  error: string
  saving: boolean
  onClose: () => void
  onChangeRoom: (booking: Booking, roomId: number, note: string) => Promise<boolean>
}) {
  const today = toDateKey(new Date())
  const [bookingId, setBookingId] = useState(bookings[0]?.id ?? '')
  const [roomId, setRoomId] = useState('')
  const [note, setNote] = useState('')
  const booking = bookings.find((item) => item.id === bookingId) ?? bookings[0]
  const availableRooms = rooms.filter((room) => {
    if (!room.isActive || !booking || room.id === String(booking.roomId) || booking.guests > room.capacity) return false
    const conflicts = bookings.some((item) =>
      item.id !== booking.id &&
      item.roomId === Number(room.id) &&
      item.checkIn < booking.checkOut &&
      item.checkOut > booking.checkIn,
    )
    const includesToday = booking.checkIn <= today && booking.checkOut > today
    return !conflicts && !(includesToday && room.status === 'occupied')
  })

  useEffect(() => {
    setRoomId((currentRoomId) => availableRooms.some((room) => room.id === currentRoomId) ? currentRoomId : '')
  }, [availableRooms])

  const selectedRoom = availableRooms.find((room) => room.id === roomId)
  const nights = booking
    ? Math.max(0, Math.round((new Date(`${booking.checkOut}T00:00:00`).getTime() - new Date(`${booking.checkIn}T00:00:00`).getTime()) / 86_400_000))
    : 0
  const newTotal = (selectedRoom?.rate ?? 0) * nights
  const displayedTotal = booking ? selectedRoom ? newTotal : booking.amount : 0
  const displayedBalance = booking ? Math.max(0, displayedTotal - booking.paid) : 0
  const displayedOverpayment = booking ? Math.max(0, booking.paid - displayedTotal) : 0
  const displayedPaymentStatus: PaymentStatus = booking && booking.paid > displayedTotal
    ? 'Overpaid'
    : booking && displayedTotal > 0 && booking.paid >= displayedTotal
      ? 'Paid'
    : booking && booking.paid > 0
      ? 'Partial'
      : 'Unpaid'
  const submitChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (booking && selectedRoom) {
      const saved = await onChangeRoom(booking, Number(selectedRoom.id), note)
      if (saved) setNote('')
    }
  }

  return <div className="assignment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="assignment-dialog card" role="dialog" aria-modal="true" aria-labelledby="room-change-title">
      <header className="assignment-header">
        <div><p className="eyebrow">Guest room change</p><h2 id="room-change-title">{guest.full_name}</h2><p className="subtitle">Move an active or upcoming booking to another available room.</p></div>
        <button className="icon-button" onClick={onClose} aria-label="Close room change" disabled={saving}><X size={19} /></button>
      </header>
      <form className="assignment-form" onSubmit={submitChange}>
        <label>Booking
          <select value={booking?.id ?? ''} onChange={(event) => { setBookingId(event.target.value); setRoomId('') }} disabled={saving || bookings.length === 0}>
            {bookings.map((item) => <option key={item.id} value={item.id}>{item.room} · {formatDate(item.checkIn)} – {formatDate(item.checkOut)}</option>)}
          </select>
        </label>
        {booking && <>
          <div className="room-change-current"><span>Current room</span><strong>{booking.room}</strong><span>{booking.guests} guest{booking.guests === 1 ? '' : 's'} · {nights} night{nights === 1 ? '' : 's'}</span></div>
          <label>New room
            <select value={roomId} onChange={(event) => setRoomId(event.target.value)} required disabled={saving || availableRooms.length === 0}>
              <option value="">{availableRooms.length === 0 ? 'No other room available for these dates' : 'Select an available room'}</option>
              {availableRooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.type} · {formatCurrency(room.rate)}/night · up to {room.capacity}</option>)}
            </select>
          </label>
          <div className="assignment-total"><span>{selectedRoom ? `${formatCurrency(selectedRoom.rate)} per room × ${nights} night${nights === 1 ? '' : 's'} · Updated total` : 'Current booking total'}</span><strong>{formatCurrency(displayedTotal)}</strong></div>
          <div className="room-change-payment">
            <div><span>Previously paid</span><strong>{formatCurrency(booking.paid)}</strong></div>
            <div><span>Remaining balance</span><strong>{formatCurrency(displayedBalance)}</strong></div>
            {displayedOverpayment > 0 && <div><span>Overpayment</span><strong className="credit-amount">{formatCurrency(displayedOverpayment)}</strong></div>}
            <div><span>Payment status</span><StatusBadge kind={statusKind(displayedPaymentStatus)}>{displayedPaymentStatus}</StatusBadge></div>
          </div>
          <p className="room-change-note">Room rate is per room per night; guest count does not change the price. Existing payments remain attached to this booking.</p>
          {selectedRoom && booking.paid > newTotal && <div className="room-change-credit-preview"><span>Credit to return</span><strong>{formatCurrency(booking.paid - newTotal)}</strong></div>}
          <label>Room-change note (optional)
            <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a reason or details for this room change." disabled={saving} />
          </label>
        </>}
        {setupError && <p className="payment-error" role="alert">{setupError}</p>}
        {bookings.length === 0 && <p className="payment-error" role="status">This guest has no active or upcoming booking to change.</p>}
        {bookings.length > 0 && availableRooms.length === 0 && <p className="payment-error" role="status">No other active room is available for this booking’s dates and guest count.</p>}
        {error && <p className="payment-error" role="alert">{error}</p>}
        <footer className="assignment-actions">
          <button className="button button-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="button button-primary" type="submit" disabled={saving || Boolean(setupError) || !booking || !selectedRoom}>{saving ? 'Changing room…' : 'Confirm room change'}</button>
        </footer>
      </form>
    </section>
  </div>
}
