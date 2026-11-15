import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, Clock3, LogIn, MoreVertical, Pencil, Search, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatCurrency, formatDate, hasSpecialRequest, statusKind, toDateKey } from '../shared'
import { StatusBadge } from '../StatusBadge'
import type { AirportTransferVehicleType, Booking, BookingStatus, Guest, GuestAssignment, NewBookingValues, PaymentStatus, Room } from '../types'
import './css/hometel-bookings.css'

export function BookingsPage({ bookings, loadError, query, setQuery, statusFilter, setStatusFilter, specialRequestsOnly, setSpecialRequestsOnly, onStatusChange, onManagePayment, onEditBooking, onDeleteBooking, onSpecialRequestNoted, onCreateBooking }: { bookings: Booking[]; loadError: string; query: string; setQuery: (v: string) => void; statusFilter: string; setStatusFilter: (v: string) => void; specialRequestsOnly: boolean; setSpecialRequestsOnly: (value: boolean) => void; onStatusChange: (b: Booking, status: BookingStatus) => Promise<boolean>; onManagePayment: (b: Booking) => void; onEditBooking: (booking: Booking) => void; onDeleteBooking: (booking: Booking) => void; onSpecialRequestNoted: (booking: Booking, noted: boolean) => Promise<string | null>; onCreateBooking: () => void }) {
  const [view, setView] = useState<'all' | 'calendar'>('all')
  const [todayDate] = useState(() => toDateKey(new Date()))
  const [selectedDate, setSelectedDate] = useState(todayDate)
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [monthPickerYear, setMonthPickerYear] = useState(() => Number(todayDate.slice(0, 4)))
  const monthPickerRef = useRef<HTMLDivElement>(null)
  const monthPickerButtonRef = useRef<HTMLButtonElement>(null)
  const [weekStart, setWeekStart] = useState(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (date.getDay() + 6) % 7)
    return date
  })
  const changeWeek = (offset: number) => {
    const nextSelectedDate = new Date(`${selectedDate}T00:00:00`)
    nextSelectedDate.setDate(nextSelectedDate.getDate() + offset * 7)
    const nextWeekStart = new Date(weekStart)
    nextWeekStart.setDate(nextWeekStart.getDate() + offset * 7)
    setSelectedDate(toDateKey(nextSelectedDate))
    setWeekStart(nextWeekStart)
  }
  const goToToday = () => {
    const date = new Date(`${todayDate}T00:00:00`)
    const firstDayOfWeek = new Date(date)
    firstDayOfWeek.setDate(firstDayOfWeek.getDate() - (firstDayOfWeek.getDay() + 6) % 7)
    setSelectedDate(todayDate)
    setWeekStart(firstDayOfWeek)
  }
  const changeMonth = (month: string) => {
    if (!month) return
    const firstOfMonth = new Date(`${month}-01T00:00:00`)
    const firstWeekStart = new Date(firstOfMonth)
    firstWeekStart.setDate(firstWeekStart.getDate() - (firstWeekStart.getDay() + 6) % 7)
    setSelectedDate(toDateKey(firstOfMonth))
    setWeekStart(firstWeekStart)
  }
  useEffect(() => {
    if (!monthPickerOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !monthPickerRef.current?.contains(event.target)) setMonthPickerOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMonthPickerOpen(false)
        monthPickerButtonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [monthPickerOpen])
  const monthLabel = new Date(`${selectedDate.slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
  const monthNames = Array.from({ length: 12 }, (_, index) =>
    new Date(2024, index, 1).toLocaleDateString('en-PH', { month: 'long' }),
  )
  const weekDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    return date
  })
  const matchesFilters = (booking: Booking) => {
    const matchesQuery = `${booking.guest} ${booking.id} ${booking.room}`.toLowerCase().includes(query.trim().toLowerCase())
    const matchesStatus = statusFilter === 'All statuses' || booking.status === statusFilter
    const matchesSpecialRequests = !specialRequestsOnly || hasSpecialRequest(booking) && !booking.specialRequestNoted
    return matchesQuery && matchesStatus && matchesSpecialRequests
  }
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
    bookings: month.bookings.filter(matchesFilters),
  })).filter((month) => month.bookings.length > 0)
  const visibleBookingCount = visibleMonthGroups.reduce((total, month) => total + month.bookings.length, 0)
  const dateBookings = bookings.filter((booking) =>
    booking.checkIn === selectedDate && matchesFilters(booking),
  ).sort((left, right) => left.checkIn.localeCompare(right.checkIn) || right.createdAt.localeCompare(left.createdAt))
  const renderBooking = (booking: Booking) => {
    const checkInDay = String(Number(booking.checkIn.slice(8, 10)))
    return <section className="booking-account-group" key={booking.id}>
      <div className="booking-account-summary">
        <span className="booking-account-day" aria-label={`Check-in day ${checkInDay}`}>{checkInDay}</span>
        <div className="booking-account-field booking-account-person">
          <span className="booking-account-label">Guest Name</span>
          <span className="booking-account-value booking-account-guest">
            <strong>{booking.guest}</strong>
            {(booking.email || booking.phone) && <small>{booking.email || booking.phone}</small>}
          </span>
        </div>
        <div className="booking-account-field">
          <span className="booking-account-label">Room</span>
          <span className="booking-account-value">{booking.room}</span>
        </div>
        <div className="booking-account-field">
          <span className="booking-account-label">Stay dates</span>
          <div className="booking-account-value booking-stay-dates">
            <span><small>Check-in</small>{formatDate(booking.checkIn)}</span>
            <span><small>Check-out</small>{formatDate(booking.checkOut)}</span>
          </div>
        </div>
        <div className="booking-account-field">
          <span className="booking-account-label">Guests</span>
          <span className="booking-account-value">{booking.guests}</span>
        </div>
        <div className="booking-account-field">
          <span className="booking-account-label">Total</span>
          <span className="booking-account-value booking-account-total"><strong>{formatCurrency(booking.amount)}</strong></span>
        </div>
        <div className="booking-account-field">
          <span className="booking-account-label">Status</span>
          <div className="booking-account-value"><BookingStatusPill booking={booking} onChange={onStatusChange} /></div>
        </div>
        <div className="booking-account-field">
          <span className="booking-account-label">Payment</span>
          <div className="booking-account-value">
            <button type="button" className="badge-action booking-account-payment" title="Manage booking payments" aria-label={`Manage payments for ${booking.guest}: ${booking.payment}`} onClick={() => onManagePayment(booking)}>
              <StatusBadge kind={statusKind(booking.payment)}>{booking.payment}</StatusBadge>
            </button>
          </div>
        </div>
        <BookingAccountMenu booking={booking} onEdit={() => onEditBooking(booking)} onDelete={() => onDeleteBooking(booking)} />
      </div>
      {hasSpecialRequest(booking) && <BookingSpecialRequest booking={booking} onNotedChange={onSpecialRequestNoted} />}
    </section>
  }

  return <>
    <div className="page-heading"><div><p className="eyebrow">Hometel</p><h1>Bookings</h1><p className="subtitle">Manage reservations, guests, and stay details.</p></div><button className="button button-primary" onClick={onCreateBooking}><CalendarDays size={17} /> New booking</button></div>
    <section className="card bookings-card">
      <div className="booking-view-tabs" aria-label="Booking view">
        <button type="button" className={view === 'all' ? 'active' : ''} aria-pressed={view === 'all'} onClick={() => setView('all')}>All</button>
        <button type="button" className={view === 'calendar' ? 'active' : ''} aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>Calendar</button>
      </div>
      {view === 'calendar' && <div className="booking-calendar">
        <div className="booking-calendar-heading">
          <div className="booking-calendar-month-picker" ref={monthPickerRef}>
            <button
              ref={monthPickerButtonRef}
              type="button"
              className="booking-calendar-month-trigger"
              aria-haspopup="dialog"
              aria-expanded={monthPickerOpen}
              onClick={() => {
                setMonthPickerYear(Number(selectedDate.slice(0, 4)))
                setMonthPickerOpen((open) => !open)
              }}
            >
              <strong>{monthLabel}</strong>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {monthPickerOpen && <div className="booking-month-picker-popover" role="dialog" aria-label="Choose month and year">
              <div className="booking-month-picker-year">
                <button type="button" className="icon-button" aria-label="Previous year" onClick={() => setMonthPickerYear((year) => year - 1)}><ChevronLeft size={17} /></button>
                <strong>{monthPickerYear}</strong>
                <button type="button" className="icon-button" aria-label="Next year" onClick={() => setMonthPickerYear((year) => year + 1)}><ChevronRight size={17} /></button>
              </div>
              <div className="booking-month-picker-grid">
                {monthNames.map((name, index) => {
                  const month = String(index + 1).padStart(2, '0')
                  const isSelectedMonth = selectedDate.slice(0, 7) === `${monthPickerYear}-${month}`
                  return <button key={month} type="button" className={isSelectedMonth ? 'active' : ''} aria-pressed={isSelectedMonth} onClick={() => {
                    changeMonth(`${monthPickerYear}-${month}`)
                    setMonthPickerOpen(false)
                  }}>{name}</button>
                })}
              </div>
            </div>}
          </div>
          <div className="booking-calendar-navigation">
            <button type="button" className="booking-calendar-today" onClick={goToToday}>Today</button>
            <button type="button" className="icon-button" aria-label="Previous week" onClick={() => changeWeek(-1)}><ChevronLeft size={18} /></button>
            <button type="button" className="icon-button" aria-label="Next week" onClick={() => changeWeek(1)}><ChevronRight size={18} /></button>
          </div>
        </div>
        <div className="booking-calendar-dates" aria-label="Dates in the current week">
          {weekDates.map((date) => {
            const dateKey = toDateKey(date)
            const isToday = todayDate === dateKey
            const classes = [selectedDate === dateKey ? 'active' : '', isToday ? 'today' : ''].filter(Boolean).join(' ')
            return <button key={dateKey} type="button" className={classes} aria-label={`${date.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}${isToday ? ', today' : ''}`} aria-pressed={selectedDate === dateKey} onClick={() => setSelectedDate(dateKey)}>
              <span>{date.toLocaleDateString('en-PH', { weekday: 'short' })}</span>
              <strong>{date.getDate()}</strong>
            </button>
          })}
        </div>
      </div>}
      <div className="filter-bar">
        <div className="search-box"><Search size={17} /><input placeholder="Search by guest, booking ID, or room..." value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <label className="select-wrap filter-select"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All statuses</option><option>Confirmed</option><option>Pending</option><option>Checked in</option><option>Completed</option><option>Cancelled</option></select><ChevronDown size={14} /></label>
        {specialRequestsOnly && <button className="filter-button" onClick={() => setSpecialRequestsOnly(false)}>Special requests only <X size={14} /></button>}
      </div>
      <div className="table-toolbar"><span><strong>{view === 'all' ? visibleBookingCount : dateBookings.length}</strong> bookings{view === 'calendar' ? ` on ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}` : ''}</span></div>
      <div className="booking-account-list">
        {loadError && <div className="booking-load-error" role="alert">{loadError}</div>}
        {view === 'all' && visibleMonthGroups.map((month) => <section className="booking-month-group" key={month.key}>
          <h2 className="booking-month-heading">{month.label}</h2>
          <BookingAccountColumns />
          <div className="booking-month-bookings">{month.bookings.map(renderBooking)}</div>
        </section>)}
        {view === 'calendar' && dateBookings.length > 0 && <div className="booking-account-calendar-group">
          <BookingAccountColumns />
          {dateBookings.map(renderBooking)}
        </div>}
        {!loadError && (view === 'all' ? visibleBookingCount : dateBookings.length) === 0 && <div className="empty-state"><Search size={25} /><strong>No bookings found</strong><span>{view === 'calendar' ? 'There are no bookings staying on this date.' : 'Try adjusting your search or filters.'}</span></div>}
      </div>
    </section>
  </>
}

function BookingAccountColumns() {
  return <div className="booking-account-columns" aria-hidden="true">
    <span />
    <span>Guest Name</span>
    <span>Room</span>
    <span>Stay dates</span>
    <span>Guests</span>
    <span>Total</span>
    <span>Status</span>
    <span>Payment</span>
    <span />
  </div>
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
  const totalPrice = (selectedRoom?.rate ?? 0) * nights + booking.airportTransferPrice
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
        <div><p className="eyebrow">Booking details</p><h2 id="edit-booking-title">{booking.guest}'s booking</h2></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close edit booking" disabled={saving}><X size={19} /></button>
      </header>
      <form className="assignment-form" onSubmit={submit}>
        <label>Room
          <select value={roomId} onChange={(event) => setRoomId(event.target.value)} required disabled={saving}>
            {availableRooms.length === 0 && <option value="">No available room matches these dates and guest count</option>}
            {availableRooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {formatCurrency(room.rate)}/night · up to {room.capacity}</option>)}
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
        <div className="assignment-total"><span>{selectedRoom ? `${formatCurrency(selectedRoom.rate)} per room × ${nights} night${nights === 1 ? '' : 's'}${booking.airportTransferPrice > 0 ? ` + ${formatCurrency(booking.airportTransferPrice)} airport transfer` : ''} · Updated total` : 'Updated total'}</span><strong>{formatCurrency(totalPrice)}</strong></div>
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

function BookingAccountMenu({ booking, onEdit, onDelete }: {
  booking: Booking
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const menuId = `booking-actions-${booking.id}`

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popoverRef.current) return
    const triggerRect = triggerRef.current.getBoundingClientRect()
    const menuRect = popoverRef.current.getBoundingClientRect()
    const edgePadding = 8
    const top = triggerRect.bottom + menuRect.height <= window.innerHeight - edgePadding
      ? triggerRect.bottom + 4
      : Math.max(edgePadding, triggerRect.top - menuRect.height - 4)
    const left = Math.max(edgePadding, Math.min(triggerRect.right - menuRect.width, window.innerWidth - menuRect.width - edgePadding))
    setMenuPosition({ top, left })
  }, [open])

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target) && !popoverRef.current?.contains(event.target)) setOpen(false)
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

  return <div className="booking-account-menu" ref={menuRef}>
    <button
      ref={triggerRef}
      type="button"
      className="booking-account-menu-trigger"
      aria-label={`Actions for ${booking.guest}'s booking`}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      onClick={() => setOpen((current) => !current)}
    >
      <MoreVertical size={19} />
    </button>
    {open && createPortal(<div ref={popoverRef} className="booking-account-menu-items" id={menuId} role="menu" aria-label={`Booking actions for ${booking.guest}`} style={{ top: menuPosition.top, left: menuPosition.left }}>
      <button type="button" role="menuitem" onClick={() => { setOpen(false); onEdit() }}><Pencil size={14} /> Edit</button>
      <button type="button" role="menuitem" className="booking-account-menu-delete" onClick={() => { setOpen(false); onDelete() }}><Trash2 size={14} /> Delete</button>
    </div>, document.body)}
  </div>
}

export function BookingTable({ bookings, onStatusChange, onManagePayment, compact = false, hideGuest = false }: { bookings: Booking[]; onStatusChange: (b: Booking, status: BookingStatus) => Promise<boolean>; onManagePayment: (b: Booking) => void; compact?: boolean; hideGuest?: boolean }) {
  return <div className={`table-scroll booking-table-scroll ${compact ? 'table-compact' : ''}`}><table><thead><tr>{!hideGuest && <th>Guest Name</th>}<th>Room</th><th>Stay dates</th><th>Guests</th><th>Total</th><th>Status</th><th>Payment</th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id}>{!hideGuest && <td><div className="guest-cell"><div className="avatar" style={{ background: booking.color }}>{booking.initials}</div><div><strong>{booking.guest}</strong><span>{booking.id}</span></div></div></td>}<td>{booking.room}</td><td><div className="booking-stay-dates"><span><small>Check-in</small>{formatDate(booking.checkIn)}</span><span><small>Check-out</small>{formatDate(booking.checkOut)}</span></div></td><td>{booking.guests}</td><td><strong>{formatCurrency(booking.amount)}</strong><span className="table-subtext">{formatCurrency(booking.paid)} paid</span></td><td><BookingStatusPill booking={booking} onChange={onStatusChange} /></td><td><button type="button" className="badge-action booking-payment-action" title="Manage booking payments" aria-label={`Manage payments for ${booking.guest}: ${booking.payment}`} onClick={() => onManagePayment(booking)}><StatusBadge kind={statusKind(booking.payment)}>{booking.payment}</StatusBadge></button></td></tr>)}</tbody></table>{bookings.length === 0 && <div className="empty-state"><Search size={25} /><strong>No bookings found</strong><span>Try adjusting your search or filters.</span></div>}</div>
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
  const StatusIcon = booking.status === 'Pending'
    ? Clock3
    : booking.status === 'Confirmed'
      ? CheckCircle2
      : booking.status === 'Checked in'
        ? LogIn
        : booking.status === 'Completed'
          ? Check
          : X

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
      <StatusIcon size={14} aria-hidden="true" />
      <span>{booking.status}</span>
      <ChevronDown size={12} aria-hidden="true" />
    </button>
    {open && createPortal(<div ref={menuRef} className="booking-status-menu" id={menuId} role="group" aria-label={`Booking status options for ${booking.guest}`} style={menuPosition}>
      {(['Pending', 'Confirmed', 'Checked in', 'Completed', 'Cancelled'] as BookingStatus[]).map((status) => (
        <button
          key={status}
          type="button"
          className={`booking-status-option badge-${statusKind(status)} ${status === booking.status ? 'is-current' : ''}`}
          aria-pressed={status === booking.status}
          disabled={saving}
          onClick={() => void handleChange(status)}
        >
          {status === 'Pending' ? <Clock3 size={15} aria-hidden="true" />
            : status === 'Confirmed' ? <CheckCircle2 size={15} aria-hidden="true" />
              : status === 'Checked in' ? <LogIn size={15} aria-hidden="true" />
                : status === 'Completed' ? <Check size={15} aria-hidden="true" />
                  : <X size={15} aria-hidden="true" />}
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
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="booking-drawer-title" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <div><p className="eyebrow">Booking {booking.id}</p><h2 id="booking-drawer-title">{booking.guest}</h2></div>
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
              <div><span>Airport transfer</span><strong>{booking.airportTransferVehicleType ? `${booking.airportTransferVehicleType === 'van' ? 'Van' : 'Tricycle'} · ${formatCurrency(booking.airportTransferPrice)}` : 'Not requested'}</strong></div>
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
            {availableRooms.length === 0 ? <option value="">No rooms available for these dates</option> : availableRooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {formatCurrency(room.rate)}/night · up to {room.capacity}</option>)}
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
  const [airportTransferVehicleType, setAirportTransferVehicleType] = useState<AirportTransferVehicleType | null>(null)
  const [transferRates, setTransferRates] = useState<Record<AirportTransferVehicleType, number> | null>(null)
  const [transferRatesLoading, setTransferRatesLoading] = useState(true)
  const [transferRatesError, setTransferRatesError] = useState('')
  useEffect(() => {
    let isMounted = true
    const loadTransferRates = async () => {
      const { data, error } = await supabase.from('transfer_rates').select('vehicle_type, price')
      if (error) {
        console.error('Unable to load airport transfer prices for booking:', error)
        if (isMounted) {
          setTransferRatesError(`Unable to load airport transfer prices: ${error.message}`)
          setTransferRatesLoading(false)
        }
        return
      }

      const rates = new Map<string, number>()
      data.forEach((rate) => {
        const vehicleType = String(rate.vehicle_type).trim().toLowerCase()
        if (!rates.has(vehicleType) || rate.vehicle_type === vehicleType) {
          rates.set(vehicleType, Number(rate.price))
        }
      })
      const van = rates.get('van')
      const tricycle = rates.get('tricycle')
      if (van === undefined || tricycle === undefined || !Number.isFinite(Number(van)) || !Number.isFinite(Number(tricycle)) || Number(van) < 0 || Number(tricycle) < 0) {
        if (isMounted) {
          setTransferRatesError('Set valid Van and Tricycle prices in Hometel > Rates before offering airport transfers.')
          setTransferRatesLoading(false)
        }
        return
      }

      if (isMounted) {
        setTransferRates({ van: Number(van), tricycle: Number(tricycle) })
        setTransferRatesLoading(false)
      }
    }

    void loadTransferRates()
    return () => { isMounted = false }
  }, [])
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
  const transferPrice = airportTransferVehicleType && transferRates
    ? transferRates[airportTransferVehicleType]
    : 0
  const totalPrice = (selectedRoom?.rate ?? 0) * nights + transferPrice
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
      airportTransferVehicleType,
      airportTransferPrice: transferPrice,
    })
  }

  return <div className="assignment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="assignment-dialog card" role="dialog" aria-modal="true" aria-labelledby="new-booking-title">
      <header className="assignment-header">
        <div><p className="eyebrow">Hometel reservation</p><h2 id="new-booking-title">Create a booking</h2></div>
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
            {availableRooms.length === 0 ? <option value="">No rooms available for these dates</option> : availableRooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {formatCurrency(room.rate)}/night · up to {room.capacity}</option>)}
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
        <label className="airport-transfer-option">
          <input type="checkbox" checked={airportTransferVehicleType !== null} onChange={(event) => setAirportTransferVehicleType(event.target.checked ? 'van' : null)} disabled={saving || transferRatesLoading || !transferRates} />
          <span>Guest will avail of airport transfer</span>
        </label>
        {transferRatesLoading && <p className="room-change-note" role="status">Loading airport transfer prices…</p>}
        {transferRatesError && <p className="payment-error" role="alert">{transferRatesError}</p>}
        {airportTransferVehicleType && transferRates && <label>Airport transfer vehicle
          <select value={airportTransferVehicleType} onChange={(event) => {
            const vehicleType = event.target.value
            if (vehicleType === 'van' || vehicleType === 'tricycle') setAirportTransferVehicleType(vehicleType)
          }} disabled={saving}>
            <option value="van">Van · {formatCurrency(transferRates.van)}</option>
            <option value="tricycle">Tricycle · {formatCurrency(transferRates.tricycle)}</option>
          </select>
        </label>}
        <label><span className="assignment-label-title">Special requests <span>(optional)</span></span>
          <textarea rows={3} value={specialRequests} onChange={(event) => setSpecialRequests(event.target.value)} disabled={saving} />
        </label>
        <div className="assignment-total"><span>{airportTransferVehicleType ? `Room stay + ${airportTransferVehicleType} airport transfer` : 'Booking total'}</span><strong>{formatCurrency(totalPrice)}</strong></div>
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
  const newTotal = (selectedRoom?.rate ?? 0) * nights + (booking?.airportTransferPrice ?? 0)
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
              {availableRooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {formatCurrency(room.rate)}/night · up to {room.capacity}</option>)}
            </select>
          </label>
          <div className="assignment-total"><span>{selectedRoom ? `${formatCurrency(selectedRoom.rate)} per room × ${nights} night${nights === 1 ? '' : 's'}${booking.airportTransferPrice > 0 ? ` + ${formatCurrency(booking.airportTransferPrice)} airport transfer` : ''} · Updated total` : 'Current booking total'}</span><strong>{formatCurrency(displayedTotal)}</strong></div>
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
