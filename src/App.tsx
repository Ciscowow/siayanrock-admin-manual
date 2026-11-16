import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, CalendarDays, CircleDollarSign, Menu, CheckCheck, X } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabaseClient'
import { formatCurrency, formatDate, formatDateTime, hasSpecialRequest, hometelItems, mapSupabaseRoom, toDateKey, tourItems } from './tabs/shared'
import type { AirportTransferVehicleType, Booking, BookingStatus, DashboardNotification, Guest, GuestAssignment, MetricDetail, MetricPopup, NewBookingValues, Room, RoomChangeRecord, RoomEditValues, SupabaseBooking } from './tabs/types'
import HometelOverview, { MetricPopupDialog } from './tabs/hometel/hometel-overview'
import { BookingsPage, BookingDrawer, BookingActionDialog, DeleteBookingDialog, EditBookingDialog, NewBookingDialog, GuestAssignmentDialog, RoomChangeDialog } from './tabs/hometel/hometel-bookings'
import { RoomsPage } from './tabs/hometel/hometel-rooms'
import { RatesPage } from './tabs/hometel/hometel-rates'
import { GuestsPage } from './tabs/hometel/hometel-guests'
import { PaymentsPage } from './tabs/hometel/hometel-payments'
import { ToursOverviewTab } from './tabs/tours/tours-overview'
import { ToursBookingsTab } from './tabs/tours/tours-bookings'
import { ToursPaymentsTab } from './tabs/tours/tours-payments'
import { AccountIndicator } from './AccountIndicator'
import AdminSignIn from './AdminSignIn'
import './App.css'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    let isMounted = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return
      setSession(nextSession)
      setAuthError('')
      setAuthLoading(false)
    })

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return
      if (error) {
        console.error('Unable to retrieve the admin session:', error)
        setAuthError(`Unable to check your sign-in status: ${error.message}`)
      } else {
        setSession(data.session)
      }
      setAuthLoading(false)
    }).catch((error: unknown) => {
      if (!isMounted) return
      console.error('Unable to retrieve the admin session:', error)
      setAuthError('Unable to check your sign-in status. Check your connection and reload.')
      setAuthLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.error('Admin sign-in failed:', error)
      return error.message
    }
    return null
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Admin sign-out failed:', error)
      return `Unable to sign out: ${error.message}`
    }
    return null
  }

  if (authLoading) {
    return <div className="auth-loading" role="status">Checking admin session…</div>
  }
  if (authError && !session) {
    return <div className="auth-loading auth-error" role="alert">{authError}</div>
  }
  if (!session) return <AdminSignIn onSignIn={signIn} />

  return <DashboardApp userEmail={session.user.email ?? ''} onSignOut={signOut} />
}

function DashboardApp({ userEmail, onSignOut }: { userEmail: string; onSignOut: () => Promise<string | null> }) {
  const [activeNav, setActiveNav] = useState('Overview')
  const [activeGroup, setActiveGroup] = useState<'hometel' | 'tours'>('hometel')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [bookingsLoadError, setBookingsLoadError] = useState('')
  const [roomChanges, setRoomChanges] = useState<RoomChangeRecord[]>([])
  const [roomChangeSetupError, setRoomChangeSetupError] = useState('')
  const [dataLoading, setDataLoading] = useState(true)
  const [roomStatusError, setRoomStatusError] = useState('')
  const [updatingRoomId, setUpdatingRoomId] = useState<string | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [bookingPaymentOpen, setBookingPaymentOpen] = useState(false)
  const [notifications, setNotifications] = useState<DashboardNotification[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [toastNotification, setToastNotification] = useState<Omit<DashboardNotification, 'read'> | null>(null)
  const [newBookingOpen, setNewBookingOpen] = useState(false)
  const [newBookingError, setNewBookingError] = useState('')
  const [newBookingSaving, setNewBookingSaving] = useState(false)
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null)
  const [editBookingError, setEditBookingError] = useState('')
  const [editBookingSaving, setEditBookingSaving] = useState(false)
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null)
  const [bookingDeleteError, setBookingDeleteError] = useState('')
  const [bookingDeleteSaving, setBookingDeleteSaving] = useState(false)
  const [assigningGuest, setAssigningGuest] = useState<Guest | null>(null)
  const [changingGuestRoom, setChangingGuestRoom] = useState<Guest | null>(null)
  const [assignmentError, setAssignmentError] = useState('')
  const [assignmentSaving, setAssignmentSaving] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [creditStatusError, setCreditStatusError] = useState('')
  const [creditReturnSavingId, setCreditReturnSavingId] = useState<string | null>(null)
  const [guestDeleteSavingId, setGuestDeleteSavingId] = useState<string | null>(null)
  const [guestDeleteError, setGuestDeleteError] = useState('')
  const [metricPopup, setMetricPopup] = useState<MetricPopup | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [specialRequestsOnly, setSpecialRequestsOnly] = useState(false)
  const [paymentQuery, setPaymentQuery] = useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All statuses')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [range, setRange] = useState('This month')

  const roomsRef = useRef(rooms)
  const guestsRef = useRef(guests)
  const bookingsRef = useRef(bookings)
  const notificationIdsRef = useRef(new Set<string>())
  const toastTimeoutRef = useRef<number | null>(null)
  useEffect(() => { roomsRef.current = rooms }, [rooms])
  useEffect(() => { guestsRef.current = guests }, [guests])
  useEffect(() => { bookingsRef.current = bookings }, [bookings])

  const pushNotification = useCallback((notification: Omit<DashboardNotification, 'read'>) => {
    if (notificationIdsRef.current.has(notification.id)) return
    notificationIdsRef.current.add(notification.id)
    if (notificationIdsRef.current.size > 40) {
      const oldestId = notificationIdsRef.current.values().next().value
      if (oldestId) notificationIdsRef.current.delete(oldestId)
    }
    setNotifications((items) => [{ ...notification, read: false }, ...items].slice(0, 40))
    setToastNotification(notification)
    if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = window.setTimeout(() => setToastNotification(null), 7000)
  }, [])

  useEffect(() => () => {
    if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current)
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadBookings = async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, guests(full_name, email, phone), rooms(room_name, room_number), payments(id, amount, payment_status, paid_at, payment_method, payment_type), booking_room_changes(credit_amount, credit_returned)')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Unable to load bookings from Supabase:', error)
        if (isMounted) setBookingsLoadError(`Could not load bookings: ${error.message}`)
        return
      }

      if (isMounted && data) {
        const mappedBookings: Booking[] = data.map((record: SupabaseBooking) => {
          const guest = Array.isArray(record.guests) ? record.guests[0] : record.guests
          const room = Array.isArray(record.rooms) ? record.rooms[0] : record.rooms
          const payments = Array.isArray(record.payments) ? record.payments : []
          const paymentRows = payments
          const paymentsReceived = paymentRows
            .filter((payment) => payment.payment_status?.toLowerCase() === 'paid')
            .reduce((total, payment) => total + Number(payment.amount ?? 0), 0)
          const creditsReturned = (Array.isArray(record.booking_room_changes) ? record.booking_room_changes : [])
            .filter((change) => change.credit_returned)
            .reduce((total, change) => total + Number(change.credit_amount ?? 0), 0)
          const paid = Math.max(0, paymentsReceived - creditsReturned)
          const amount = Number(record.total_price ?? 0)
          const initials = String(guest?.full_name ?? 'Guest')
            .split(/\s+/)
            .filter(Boolean)
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
          const status = String(record.status ?? 'Pending').toLowerCase()

          return {
            id: String(record.id),
            guestId: String(record.guest_id),
            guest: guest?.full_name ?? 'Guest',
            initials,
            room: room?.room_name ?? `Room ${record.room_id}`,
            roomId: Number(record.room_id),
            dates: `${record.check_in} – ${record.check_out}`,
            checkIn: record.check_in,
            checkOut: record.check_out,
            createdAt: record.created_at,
            guests: Number(record.num_of_guests ?? 0),
            amount,
            paid,
            invoiceSentAt: record.invoice_sent_at ?? null,
            payments: paymentRows
              .map((payment) => ({ id: payment.id, amount: Number(payment.amount), paidAt: payment.paid_at, method: payment.payment_method ?? '—', type: payment.payment_type ?? 'payment', status: payment.payment_status ?? 'pending' })),
            status: status === 'completed' ? 'Completed' : status === 'confirmed' || status === 'reserved' ? 'Confirmed' : status === 'checked_in' ? 'Checked in' : status === 'cancelled' ? 'Cancelled' : 'Pending',
            payment: paid > amount ? 'Overpaid' : amount > 0 && paid === amount ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid',
            color: '#e4c3aa',
            email: guest?.email ?? '',
            phone: guest?.phone ?? '',
            request: record.special_requests ?? 'No special requests.',
            specialRequestNoted: Boolean(record.special_requests_noted),
            airportTransferVehicleType: record.airport_transfer_vehicle_type ?? null,
            airportTransferPrice: Number(record.airport_transfer_price ?? 0),
            tourPromoId: record.tour_promo_id ?? null,
            tourPromoPrice: record.tour_promo_price === null || record.tour_promo_price === undefined ? null : Number(record.tour_promo_price),
            tourPromoWithLunch: record.tour_promo_with_lunch ?? null,
          }
        })

        setBookings(mappedBookings)
        setBookingsLoadError('')
      }
    }

    const loadRooms = async () => {
      const { data, error } = await supabase.from('rooms').select('id, room_number, room_name, room_type, room_price, max_guests, base_guests, is_active, occupancy_status, maintenance_status, maintenance_note, description').order('id', { ascending: true })

      if (error) {
        console.error('Unable to load rooms from Supabase:', error)
        return
      }

      if (isMounted && data) {
        setRooms(data.map(mapSupabaseRoom))
      }
    }

    const loadGuests = async () => {
      const { data, error } = await supabase.from('guests').select('*').order('created_at', { ascending: false })

      if (error) {
        console.error('Unable to load guests from Supabase:', error)
        return
      }

      if (isMounted && data) {
        setGuests(data as Guest[])
      }
    }

    const loadRoomChanges = async () => {
      const { data, error } = await supabase
        .from('booking_room_changes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Unable to load room change notes from Supabase:', error)
        setRoomChangeSetupError('Room-change credit tracking is not set up in Supabase yet. Run the booking room change migration, then refresh.')
        return
      }

      if (isMounted && data) {
        setRoomChanges(data as RoomChangeRecord[])
        setRoomChangeSetupError('')
      }
    }

    Promise.all([loadBookings(), loadRooms(), loadGuests(), loadRoomChanges()])
      .catch((error: unknown) => console.error('Unable to load dashboard data:', error))
      .finally(() => {
        if (isMounted) setDataLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, (payload) => {
        const booking = payload.new as {
          id?: string
          guest_id?: string
          room_id?: number
          check_in?: string
          check_out?: string
          num_of_guests?: number
          total_price?: number | string
          status?: string
          special_requests?: string | null
          special_requests_noted?: boolean | null
          airport_transfer_vehicle_type?: AirportTransferVehicleType | null
          airport_transfer_price?: number | string | null
          tour_promo_id?: number | null
          tour_promo_price?: number | string | null
          tour_promo_with_lunch?: boolean | null
          created_at?: string
        }
        if (!booking.id) return
        const bookingId = booking.id

        void (async () => {
          let guestName = 'Guest'
          let guestEmail = ''
          let guestPhone = ''
          if (booking.guest_id) {
            const { data, error } = await supabase.from('guests').select('full_name, email, phone').eq('id', booking.guest_id).maybeSingle()
            if (error) console.error('Unable to load guest for booking notification:', error)
            else if (data) {
              guestName = data.full_name
              guestEmail = data.email ?? ''
              guestPhone = data.phone ?? ''
            }
          }
          const room = roomsRef.current.find((item) => Number(item.id) === booking.room_id)
          const roomName = room?.name ?? `Room ${booking.room_id ?? '—'}`
          const stay = booking.check_in && booking.check_out
            ? `${formatDate(booking.check_in)} – ${formatDate(booking.check_out)}`
            : 'Stay dates unavailable'
          const status = String(booking.status ?? 'pending').toLowerCase()
          const liveBooking: Booking = {
            id: bookingId,
            guestId: booking.guest_id ?? '',
            guest: guestName,
            initials: guestName.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
            room: roomName,
            roomId: Number(booking.room_id ?? 0),
            dates: `${booking.check_in ?? ''} – ${booking.check_out ?? ''}`,
            checkIn: booking.check_in ?? '',
            checkOut: booking.check_out ?? '',
            createdAt: booking.created_at ?? new Date().toISOString(),
            guests: Number(booking.num_of_guests ?? 0),
            amount: Number(booking.total_price ?? 0),
            paid: 0,
            payments: [],
            status: status === 'confirmed' || status === 'reserved' ? 'Confirmed' : status === 'checked_in' ? 'Checked in' : status === 'completed' ? 'Completed' : status === 'cancelled' ? 'Cancelled' : 'Pending',
            payment: 'Unpaid',
            color: '#e4c3aa',
            email: guestEmail,
            phone: guestPhone,
            request: booking.special_requests ?? 'No special requests.',
            specialRequestNoted: Boolean(booking.special_requests_noted),
            airportTransferVehicleType: booking.airport_transfer_vehicle_type ?? null,
            airportTransferPrice: Number(booking.airport_transfer_price ?? 0),
            tourPromoId: booking.tour_promo_id ?? null,
            tourPromoPrice: booking.tour_promo_price === null || booking.tour_promo_price === undefined ? null : Number(booking.tour_promo_price),
            tourPromoWithLunch: booking.tour_promo_with_lunch ?? null,
          }
          setBookings((items) => items.some((item) => item.id === liveBooking.id) ? items : [liveBooking, ...items])
          pushNotification({
            id: `booking:${bookingId}:created`,
            title: 'New booking received',
            detail: `${guestName} · ${roomName} · ${stay}`,
            createdAt: new Date().toISOString(),
            category: 'booking',
            relatedId: bookingId,
          })
        })()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings' }, (payload) => {
        const previous = payload.old as { id?: string; status?: string }
        const booking = payload.new as { id?: string; status?: string; guest_id?: string; room_id?: number }
        if (!booking.id || !booking.status) return
        const bookingId = booking.id
        const currentBooking = bookingsRef.current.find((item) => item.id === bookingId)
        const previousStatus = previous.status ?? currentBooking?.status.toLowerCase().replace(' ', '_')
        if (previousStatus === booking.status.toLowerCase()) return
        const guestName = guestsRef.current.find((guest) => guest.id === booking.guest_id)?.full_name ?? `Booking ${bookingId}`
        const roomName = roomsRef.current.find((room) => Number(room.id) === booking.room_id)?.name
        const updatedStatus = booking.status.toLowerCase()
        const mappedStatus: BookingStatus = updatedStatus === 'confirmed' || updatedStatus === 'reserved' ? 'Confirmed' : updatedStatus === 'checked_in' ? 'Checked in' : updatedStatus === 'completed' ? 'Completed' : updatedStatus === 'cancelled' ? 'Cancelled' : 'Pending'
        setBookings((items) => items.map((item) => item.id === bookingId ? { ...item, status: mappedStatus } : item))
        setSelectedBooking((item) => item?.id === bookingId ? { ...item, status: mappedStatus } : item)
        pushNotification({
          id: `booking:${bookingId}:status:${booking.status}`,
          title: 'Booking status updated',
          detail: `${guestName}${roomName ? ` · ${roomName}` : ''} · ${mappedStatus}`,
          createdAt: new Date().toISOString(),
          category: 'booking',
          relatedId: bookingId,
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payments' }, (payload) => {
        const payment = payload.new as {
          id?: string
          booking_id?: string
          amount?: number | string
          payment_type?: string
          payment_status?: string
          paid_at?: string | null
          payment_method?: string | null
        }
        if (!payment.id || !payment.booking_id) return
        const transaction = {
          id: String(payment.id),
          amount: Number(payment.amount ?? 0),
          paidAt: typeof payment.paid_at === 'string' ? payment.paid_at : null,
          method: payment.payment_method ?? '—',
          type: payment.payment_type ?? 'payment',
          status: payment.payment_status ?? 'pending',
        }
        const updateBookingPayment = (booking: Booking) => {
          if (booking.id !== payment.booking_id || booking.payments.some((item) => item.id === transaction.id)) return booking
          const payments = [...booking.payments, transaction]
          const paid = booking.paid + (transaction.status.toLowerCase() === 'paid' ? transaction.amount : 0)
          return {
            ...booking,
            payments,
            paid,
            payment: paid > booking.amount ? 'Overpaid' as const : paid === booking.amount && booking.amount > 0 ? 'Paid' as const : paid > 0 ? 'Partial' as const : 'Unpaid' as const,
          }
        }
        setBookings((items) => items.map(updateBookingPayment))
        setSelectedBooking((item) => item ? updateBookingPayment(item) : item)
        pushNotification({
          id: `payment:${payment.id}:${payment.payment_status ?? 'created'}`,
          title: 'Payment transaction recorded',
          detail: `${bookingsRef.current.find((item) => item.id === payment.booking_id)?.guest ?? `Booking ${payment.booking_id}`} · ${formatCurrency(Number(payment.amount ?? 0))} · ${payment.payment_type ?? 'payment'} (${payment.payment_status ?? 'pending'})`,
          createdAt: transaction.paidAt ?? new Date().toISOString(),
          category: 'payment',
          relatedId: payment.booking_id,
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payments' }, (payload) => {
        const payment = payload.new as {
          id?: string
          booking_id?: string
          amount?: number | string
          payment_type?: string
          payment_status?: string
          paid_at?: string | null
          payment_method?: string | null
        }
        if (!payment.id || !payment.booking_id || !payment.payment_status) return
        const transactionId = String(payment.id)
        const transactionStatus = payment.payment_status
        const transactionAmount = Number(payment.amount ?? 0)
        const transaction = {
          id: transactionId,
          amount: transactionAmount,
          paidAt: payment.paid_at ?? null,
          method: payment.payment_method ?? '—',
          type: payment.payment_type ?? 'payment',
          status: transactionStatus,
        }
        const existingBooking = bookingsRef.current.find((booking) => booking.id === payment.booking_id)
        const existingPayment = existingBooking?.payments.find((item) => item.id === transactionId)
        if (existingPayment?.status.toLowerCase() === transactionStatus.toLowerCase()) return

        const applyTransactionUpdate = (booking: Booking) => {
          if (booking.id !== payment.booking_id) return booking
          const previousPaidAmount = existingPayment?.status.toLowerCase() === 'paid' ? existingPayment.amount : 0
          const nextPaidAmount = transactionStatus.toLowerCase() === 'paid' ? transactionAmount : 0
          const paid = Math.max(0, booking.paid - previousPaidAmount + nextPaidAmount)
          const payments = existingPayment
            ? booking.payments.map((item) => item.id === transactionId ? transaction : item)
            : [...booking.payments, transaction]
          return {
            ...booking,
            payments,
            paid,
            payment: paid > booking.amount ? 'Overpaid' as const : paid === booking.amount && booking.amount > 0 ? 'Paid' as const : paid > 0 ? 'Partial' as const : 'Unpaid' as const,
          }
        }
        setBookings((items) => items.map(applyTransactionUpdate))
        setSelectedBooking((item) => item ? applyTransactionUpdate(item) : item)
        pushNotification({
          id: `payment:${transactionId}:${transactionStatus}`,
          title: 'Payment transaction updated',
          detail: `${existingBooking?.guest ?? `Booking ${payment.booking_id}`} · ${formatCurrency(transactionAmount)} · ${transactionStatus}`,
          createdAt: transaction.paidAt ?? new Date().toISOString(),
          category: 'payment',
          relatedId: payment.booking_id,
        })
      })
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Supabase Realtime notifications are unavailable:', error ?? status)
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [pushNotification])

  const today = new Date()
  const todayKey = toDateKey(today)
  const sidebarDate = today.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const activeRooms = rooms.filter((room) => room.isActive)
  const occupiedRoomIds = new Set([
    ...rooms.filter((room) => room.isActive && room.status === 'occupied').map((room) => Number(room.id)),
    ...bookings
    .filter((booking) =>
      (booking.status === 'Confirmed' || booking.status === 'Checked in') &&
      booking.checkIn <= todayKey &&
      booking.checkOut > todayKey,
    )
    .map((booking) => booking.roomId),
  ])
  const monthRevenue = bookings.reduce((total, booking) => total + booking.payments
    .filter((payment) => payment.status.toLowerCase() === 'paid' && payment.paidAt?.startsWith(monthKey))
    .reduce((sum, payment) => sum + payment.amount, 0), 0) - roomChanges
      .filter((change) => change.credit_returned && change.credit_returned_at?.startsWith(monthKey))
      .reduce((sum, change) => sum + change.credit_amount, 0)
  const todayCheckIns = bookings.filter((booking) =>
    booking.checkIn === todayKey && booking.status !== 'Cancelled' && booking.status !== 'Completed',
  ).length
  const todayCheckOuts = bookings.filter((booking) =>
    booking.checkOut === todayKey && booking.status !== 'Cancelled',
  ).length
  const todaysOccupancyBookings = bookings.filter((booking) =>
    (booking.status === 'Confirmed' || booking.status === 'Checked in') &&
    booking.checkIn <= todayKey &&
    booking.checkOut > todayKey,
  )
  const occupiedRoomDetails: MetricDetail[] = activeRooms
    .filter((room) => occupiedRoomIds.has(Number(room.id)))
    .map((room) => {
      const booking = todaysOccupancyBookings.find((item) => item.roomId === Number(room.id))
      return booking
        ? { booking, room, detail: `${formatDate(booking.checkIn)} – ${formatDate(booking.checkOut)}` }
        : { room, detail: 'Manually set occupied' }
    })
  const todayCheckInBookings = bookings.filter((booking) =>
    booking.checkIn === todayKey && booking.status !== 'Cancelled' && booking.status !== 'Completed',
  )
  const todayCheckOutBookings = bookings.filter((booking) =>
    booking.checkOut === todayKey && booking.status !== 'Cancelled',
  )
  const monthPaymentEntries: MetricDetail[] = [
    ...bookings.flatMap((booking) =>
    booking.payments
      .filter((payment) => payment.status.toLowerCase() === 'paid' && payment.paidAt?.startsWith(monthKey))
      .map((payment) => ({ booking, detail: `Paid ${formatDate(payment.paidAt)}`, amount: payment.amount })),
    ),
    ...roomChanges
      .filter((change) => change.credit_returned && change.credit_returned_at?.startsWith(monthKey))
      .flatMap((change) => {
        const booking = bookings.find((item) => item.id === change.booking_id)
        return booking ? [{
          booking,
          detail: `Credit returned ${formatDate(change.credit_returned_at)}`,
          amount: -change.credit_amount,
          statusOverride: 'Returned',
        }] : []
      }),
  ]
  const invoiceSentBookings = bookings.filter((booking) => Boolean(booking.invoiceSentAt))
  const invoiceSentGuests = new Set(invoiceSentBookings.map((booking) => booking.guestId))
  const openMetricPopup = (kind: 'occupancy' | 'revenue' | 'check-ins' | 'check-outs' | 'invoices') => {
    const popup: MetricPopup = kind === 'invoices'
      ? {
          title: 'Invoices sent',
          description: `${invoiceSentGuests.size} guest${invoiceSentGuests.size === 1 ? '' : 's'} have received invoices for ${invoiceSentBookings.length} booking${invoiceSentBookings.length === 1 ? '' : 's'}.`,
          entries: invoiceSentBookings.map((booking) => ({
            booking,
            detail: `Sent ${formatDateTime(booking.invoiceSentAt ?? null)}`,
            statusOverride: 'Sent',
          })),
        }
      : kind === 'occupancy'
      ? {
          title: 'Occupied rooms',
          description: `${occupiedRoomIds.size} of ${activeRooms.length} active rooms are occupied today.`,
          entries: occupiedRoomDetails,
        }
      : kind === 'revenue'
        ? {
            title: 'Revenue this month',
            description: `Paid transactions recorded in ${today.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}.`,
            entries: monthPaymentEntries,
          }
        : kind === 'check-ins'
          ? {
              title: 'Today’s check-ins',
              description: `${todayCheckInBookings.length} booking${todayCheckInBookings.length === 1 ? '' : 's'} checking in today.`,
              entries: todayCheckInBookings.map((booking) => ({ booking, detail: `${booking.guests} guest${booking.guests === 1 ? '' : 's'}` })),
            }
          : {
              title: 'Today’s check-outs',
              description: `${todayCheckOutBookings.length} booking${todayCheckOutBookings.length === 1 ? '' : 's'} checking out today.`,
              entries: todayCheckOutBookings.map((booking) => ({ booking, detail: `${booking.guests} guest${booking.guests === 1 ? '' : 's'}` })),
            }
    setMetricPopup(popup)
  }
  const pendingBookings = bookings.filter((booking) => booking.status === 'Pending')
  const bookingsWithCreditsDue = new Set(roomChanges.filter((change) => change.credit_amount > 0 && !change.credit_returned).map((change) => change.booking_id))
  const paymentAttentionBookings = bookings.filter((booking) =>
    booking.status !== 'Cancelled' &&
    (booking.payment !== 'Paid' || bookingsWithCreditsDue.has(booking.id)),
  )
  const creditItemsDueCount = roomChanges.filter((change) => change.credit_amount > 0 && !change.credit_returned).length
  const specialRequestBookings = bookings.filter((booking) =>
    booking.status !== 'Cancelled' &&
    booking.status !== 'Completed' &&
    hasSpecialRequest(booking) &&
    !booking.specialRequestNoted,
  )
  const currentChartDate = new Date(`${todayKey}T00:00:00`)
  const chartPeriods = range === 'This year'
    ? Array.from({ length: currentChartDate.getMonth() + 1 }, (_, month) => {
        const date = new Date(currentChartDate.getFullYear(), month, 1)
        return {
          key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
          label: date.toLocaleDateString('en-US', { month: 'short' }),
        }
      })
    : (() => {
        const start = range === 'This week'
          ? new Date(currentChartDate.getFullYear(), currentChartDate.getMonth(), currentChartDate.getDate() - ((currentChartDate.getDay() + 6) % 7))
          : new Date(currentChartDate.getFullYear(), currentChartDate.getMonth(), 1)
        const periodCount = Math.floor((currentChartDate.getTime() - start.getTime()) / 86_400_000) + 1
        return Array.from({ length: periodCount }, (_, index) => {
          const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
          return { key: toDateKey(date), label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
        })
      })()
  const periodKeyFor = (value: string) => range === 'This year' ? value.slice(0, 7) : value.slice(0, 10)
  const bookingCounts = new Map<string, number>()
  bookings.forEach((booking) => {
    const key = periodKeyFor(booking.createdAt)
    bookingCounts.set(key, (bookingCounts.get(key) ?? 0) + 1)
  })
  const chartData = chartPeriods.map(({ key, label }) => ({ day: label, value: bookingCounts.get(key) ?? 0 }))
  const bookingsInRange = chartData.reduce((total, item) => total + item.value, 0)
  const revenueByPeriod = new Map<string, number>()
  bookings.forEach((booking) => booking.payments.forEach((payment) => {
    if (payment.status.toLowerCase() !== 'paid' || !payment.paidAt) return
    const key = periodKeyFor(payment.paidAt)
    revenueByPeriod.set(key, (revenueByPeriod.get(key) ?? 0) + payment.amount)
  }))
  roomChanges.forEach((change) => {
    if (!change.credit_returned || !change.credit_returned_at) return
    const key = periodKeyFor(change.credit_returned_at)
    revenueByPeriod.set(key, (revenueByPeriod.get(key) ?? 0) - change.credit_amount)
  })
  const revenueChartData = chartPeriods.map(({ key, label }) => ({ day: label, value: revenueByPeriod.get(key) ?? 0 }))
  const revenueInRange = revenueChartData.reduce((total, item) => total + item.value, 0)

  const updateBookingStatus = (status: BookingStatus) => {
    if (!selectedBooking) return
    setBookings((items) => items.map((item) => item.id === selectedBooking.id ? { ...item, status } : item))
    setSelectedBooking({ ...selectedBooking, status })
  }

  const saveBookingStatus = async (booking: Booking, status: BookingStatus) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: status.toLowerCase().replace(' ', '_') })
      .eq('id', booking.id)

    if (error) {
      console.error('Unable to update booking status:', error)
      return false
    }

    setBookings((items) => items.map((item) => item.id === booking.id ? { ...item, status } : item))
    setSelectedBooking((item) => item?.id === booking.id ? { ...item, status } : item)
    return true
  }

  const addBookingPayment = async (amount: number, method: string) => {
    if (!selectedBooking) return false
    const remaining = selectedBooking.amount - selectedBooking.paid
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
      setPaymentError('Enter an amount greater than ₱0 and no more than the remaining balance.')
      return false
    }

    setPaymentError('')
    setPaymentSaving(true)
    const paymentType = selectedBooking.paid === 0
      ? amount >= remaining ? 'full' : 'downpayment'
      : 'balance'
    const paidAt = new Date().toISOString()
    const { data: paymentRecord, error } = await supabase.from('payments').insert({
      booking_id: selectedBooking.id,
      amount,
      payment_type: paymentType,
      payment_method: method,
      payment_status: 'paid',
      paid_at: paidAt,
    }).select('id').single()

    if (error) {
      console.error('Unable to record booking payment:', error)
      setPaymentError(`Could not record payment: ${error.message}`)
      setPaymentSaving(false)
      return false
    }
    if (!paymentRecord) {
      setPaymentError('Payment was submitted, but no transaction record was returned. Refresh and verify before retrying.')
      setPaymentSaving(false)
      return false
    }

    const paid = selectedBooking.paid + amount
    const updatedBooking: Booking = {
      ...selectedBooking,
      paid,
      payment: paid > selectedBooking.amount ? 'Overpaid' : paid === selectedBooking.amount ? 'Paid' : 'Partial',
      status: selectedBooking.status === 'Pending' ? 'Confirmed' : selectedBooking.status,
      payments: [...selectedBooking.payments, { id: String(paymentRecord.id), amount, paidAt, method, type: paymentType, status: 'paid' }],
    }
    setBookings((items) => items.map((item) => item.id === updatedBooking.id ? updatedBooking : item))
    setSelectedBooking(updatedBooking)
    pushNotification({
      id: `payment:${paymentRecord.id}:paid`,
      title: 'Payment transaction recorded',
      detail: `${selectedBooking.guest} · ${formatCurrency(amount)} · ${paymentType}`,
      createdAt: paidAt,
      category: 'payment',
      relatedId: selectedBooking.id,
    })
    setPaymentSaving(false)
    return true
  }

  const assignGuestToRoom = async (guest: Guest, assignment: GuestAssignment) => {
    setAssignmentError('')
    const room = rooms.find((item) => Number(item.id) === assignment.roomId)
    if (!room || !room.isActive) {
      setAssignmentError('Choose an active room.')
      return false
    }
    if (assignment.checkIn < toDateKey(new Date()) || assignment.checkOut <= assignment.checkIn) {
      setAssignmentError('Choose a valid stay: check-in cannot be in the past and check-out must be after check-in.')
      return false
    }
    if (assignment.guestCount < 1 || assignment.guestCount > room.capacity) {
      setAssignmentError(`This room allows up to ${room.capacity} guests.`)
      return false
    }
    const hasConflict = bookings.some((booking) =>
      booking.roomId === assignment.roomId &&
      booking.status !== 'Cancelled' &&
      booking.status !== 'Completed' &&
      booking.checkIn < assignment.checkOut &&
      booking.checkOut > assignment.checkIn,
    )
    const includesToday = assignment.checkIn <= toDateKey(new Date()) && assignment.checkOut > toDateKey(new Date())
    if (hasConflict || includesToday && room.status === 'occupied') {
      setAssignmentError('That room is already occupied or booked for part of those dates. Select another room or stay period.')
      return false
    }

    setAssignmentSaving(true)
    const nights = Math.round((new Date(`${assignment.checkOut}T00:00:00`).getTime() - new Date(`${assignment.checkIn}T00:00:00`).getTime()) / 86_400_000)
    const totalPrice = room.rate * nights
    const { data, error } = await supabase.from('bookings').insert({
      room_id: assignment.roomId,
      guest_id: guest.id,
      check_in: assignment.checkIn,
      check_out: assignment.checkOut,
      num_of_guests: assignment.guestCount,
      total_price: totalPrice,
      downpayment_amount: 0,
      status: 'confirmed',
      payment_status: 'unpaid',
    }).select('id, created_at').single()

    if (error) {
      console.error('Unable to assign guest to room:', error)
      setAssignmentError(`Could not create booking: ${error.message}`)
      setAssignmentSaving(false)
      return false
    }
    if (!data) {
      setAssignmentError('The booking could not be confirmed by the database. Please refresh and check before retrying.')
      setAssignmentSaving(false)
      return false
    }

    const booking: Booking = {
      id: String(data.id),
      guestId: guest.id,
      guest: guest.full_name,
      initials: guest.full_name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      room: room.name,
      roomId: assignment.roomId,
      dates: `${assignment.checkIn} – ${assignment.checkOut}`,
      checkIn: assignment.checkIn,
      checkOut: assignment.checkOut,
      createdAt: data.created_at ?? new Date().toISOString(),
      guests: assignment.guestCount,
      amount: totalPrice,
      paid: 0,
      payments: [],
      status: 'Confirmed',
      payment: 'Unpaid',
      color: '#e4c3aa',
      email: guest.email ?? '',
      phone: guest.phone ?? '',
      request: 'No special requests.',
      specialRequestNoted: false,
      airportTransferVehicleType: null,
      airportTransferPrice: 0,
    }
    setBookings((items) => [booking, ...items])
    pushNotification({
      id: `booking:${booking.id}:created`,
      title: 'Booking created',
      detail: `${booking.guest} · ${booking.room} · ${formatDate(booking.checkIn)} – ${formatDate(booking.checkOut)}`,
      createdAt: booking.createdAt,
      category: 'booking',
      relatedId: booking.id,
    })
    setAssigningGuest(null)
    setAssignmentSaving(false)
    return true
  }

  const createNewBooking = async (values: NewBookingValues) => {
    setNewBookingError('')
    if (!values.fullName.trim()) {
      setNewBookingError('Enter the guest’s name.')
      return
    }
    const room = rooms.find((item) => Number(item.id) === values.roomId)
    const today = toDateKey(new Date())
    if (!room || !room.isActive || room.isUnderMaintenance) {
      setNewBookingError('Choose an active room that is not under maintenance.')
      return
    }
    if (values.checkIn < today || values.checkOut <= values.checkIn) {
      setNewBookingError('Choose a valid stay: check-in cannot be in the past and check-out must be after check-in.')
      return
    }
    if (!Number.isInteger(values.guestCount) || values.guestCount < 1 || values.guestCount > room.capacity) {
      setNewBookingError(`This room allows up to ${room.capacity} guests.`)
      return
    }
    const hasConflict = bookings.some((booking) =>
      booking.roomId === values.roomId &&
      booking.status !== 'Cancelled' &&
      booking.status !== 'Completed' &&
      booking.checkIn < values.checkOut &&
      booking.checkOut > values.checkIn,
    )
    const includesToday = values.checkIn <= today && values.checkOut > today
    if (hasConflict || includesToday && room.status === 'occupied') {
      setNewBookingError('That room is already occupied or booked for part of those dates. Select another room or stay period.')
      return
    }

    const nights = Math.round((new Date(`${values.checkOut}T00:00:00`).getTime() - new Date(`${values.checkIn}T00:00:00`).getTime()) / 86_400_000)
    setNewBookingSaving(true)
    let airportTransferPrice = 0
    let tourPromoId: number | null = null
    let tourPromoPrice: number | null = null
    let tourPromoWithLunch: boolean | null = null
    if (values.airportTransferVehicleType) {
      const { data: transferRate, error: transferRateError } = await supabase
        .from('transfer_rates')
        .select('price')
        .eq('vehicle_type', values.airportTransferVehicleType)
        .maybeSingle()
      if (transferRateError) {
        console.error('Unable to verify airport transfer price for booking:', transferRateError)
        setNewBookingError(`Unable to verify airport transfer price: ${transferRateError.message}`)
        setNewBookingSaving(false)
        return
      }
      if (!transferRate || !Number.isFinite(Number(transferRate.price)) || Number(transferRate.price) < 0) {
        setNewBookingError('The selected airport transfer has no valid price. Update Hometel > Rates and try again.')
        setNewBookingSaving(false)
        return
      }
      if (Number(transferRate.price) !== values.airportTransferPrice) {
        setNewBookingError('Airport transfer prices changed. Close and reopen the booking form to refresh the rates.')
        setNewBookingSaving(false)
        return
      }
      airportTransferPrice = Number(transferRate.price)
    }

    if (values.tourPromo) {
      if (values.guestCount !== 2) {
        setNewBookingError('Tour promos are available for bookings of exactly 2 guests.')
        setNewBookingSaving(false)
        return
      }

      const { data: promo, error: promoError } = await supabase
        .from('tour_promos')
        .select('id, max_pax, nights, price_with_lunch, price_without_lunch, starts_on, ends_on, active')
        .eq('id', values.tourPromo.id)
        .eq('active', true)
        .eq('max_pax', 2)
        .eq('nights', nights)
        .maybeSingle()

      if (promoError) {
        console.error('Unable to verify tour promo for booking:', promoError)
        setNewBookingError(`Unable to verify tour promo: ${promoError.message}`)
        setNewBookingSaving(false)
        return
      }

      const promoPrice = promo
        ? Number(values.tourPromo.withLunch ? promo.price_with_lunch : promo.price_without_lunch)
        : Number.NaN
      if (!promo || promo.starts_on && values.checkIn < promo.starts_on || promo.ends_on && values.checkIn > promo.ends_on || !Number.isFinite(promoPrice) || promoPrice < 0) {
        setNewBookingError('The selected tour promo is no longer available for these stay dates. Refresh the booking form and try again.')
        setNewBookingSaving(false)
        return
      }
      if (promoPrice !== values.tourPromo.price) {
        setNewBookingError('Tour promo prices changed. Close and reopen the booking form to refresh the rates.')
        setNewBookingSaving(false)
        return
      }

      tourPromoId = Number(promo.id)
      tourPromoPrice = promoPrice
      tourPromoWithLunch = values.tourPromo.withLunch
    }

    const email = values.email.trim()
    const phone = values.phone.trim()
    const normalizedEmail = email.toLowerCase()
    const normalizedPhone = phone.replace(/\D/g, '')
    let guest = guests.find((item) =>
      normalizedEmail && item.email?.trim().toLowerCase() === normalizedEmail,
    ) ?? (normalizedPhone
      ? guests.find((item) => item.phone?.replace(/\D/g, '') === normalizedPhone)
      : undefined)
    let createdGuest = false

    if (!guest) {
      const { data, error } = await supabase.from('guests').insert({
        full_name: values.fullName.trim(),
        email: email || null,
        phone: phone || null,
      }).select('*').single()

      if (error) {
        console.error('Unable to create guest for booking:', error)
        setNewBookingError(`Could not save guest details: ${error.message}`)
        setNewBookingSaving(false)
        return
      }
      if (!data) {
        setNewBookingError('Guest details were not returned by the database. Please refresh before trying again.')
        setNewBookingSaving(false)
        return
      }
      const savedGuest = data as Guest
      guest = savedGuest
      createdGuest = true
      setGuests((items) => [savedGuest, ...items])
    }

    const totalPrice = (tourPromoPrice ?? room.rate * nights) + airportTransferPrice
    const { data, error } = await supabase.from('bookings').insert({
      room_id: values.roomId,
      guest_id: guest.id,
      check_in: values.checkIn,
      check_out: values.checkOut,
      num_of_guests: values.guestCount,
      total_price: totalPrice,
      downpayment_amount: 0,
      status: values.status,
      payment_status: 'unpaid',
      special_requests: values.specialRequests.trim() || null,
      airport_transfer_vehicle_type: values.airportTransferVehicleType,
      airport_transfer_price: airportTransferPrice,
      tour_promo_id: tourPromoId,
      tour_promo_price: tourPromoPrice,
      tour_promo_with_lunch: tourPromoWithLunch,
    }).select('id, created_at').single()

    if (error) {
      console.error('Unable to create booking:', error)
      setNewBookingError(createdGuest
        ? `Guest details were saved, but the booking could not be created: ${error.message}`
        : `Could not create booking: ${error.message}`)
      setNewBookingSaving(false)
      return
    }
    if (!data) {
      setNewBookingError('The booking was not returned by the database. Please refresh and check before trying again.')
      setNewBookingSaving(false)
      return
    }

    const initials = guest.full_name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
    const booking: Booking = {
      id: String(data.id),
      guestId: guest.id,
      guest: guest.full_name,
      initials,
      room: room.name,
      roomId: values.roomId,
      dates: `${values.checkIn} – ${values.checkOut}`,
      checkIn: values.checkIn,
      checkOut: values.checkOut,
      createdAt: data.created_at ?? new Date().toISOString(),
      guests: values.guestCount,
      amount: totalPrice,
      paid: 0,
      payments: [],
      status: values.status === 'confirmed' ? 'Confirmed' : 'Pending',
      payment: 'Unpaid',
      color: '#e4c3aa',
      email: guest.email ?? '',
      phone: guest.phone ?? '',
      request: values.specialRequests.trim() || 'No special requests.',
      specialRequestNoted: false,
      airportTransferVehicleType: values.airportTransferVehicleType,
      airportTransferPrice,
      tourPromoId,
      tourPromoPrice,
      tourPromoWithLunch,
    }
    setBookings((items) => [booking, ...items])
    pushNotification({
      id: `booking:${booking.id}:created`,
      title: 'Booking created',
      detail: `${booking.guest} · ${booking.room} · ${formatDate(booking.checkIn)} – ${formatDate(booking.checkOut)}`,
      createdAt: booking.createdAt,
      category: 'booking',
      relatedId: booking.id,
    })
    setQuery('')
    setStatusFilter('All statuses')
    setSpecialRequestsOnly(false)
    setNewBookingOpen(false)
    setNewBookingSaving(false)
    nav('Bookings')
  }

  const updateBookingDetails = async (booking: Booking, assignment: GuestAssignment) => {
    setEditBookingError('')
    const room = rooms.find((item) => Number(item.id) === assignment.roomId)
    if (!room || !room.isActive || room.isUnderMaintenance) {
      setEditBookingError('Choose an active room that is not under maintenance.')
      return false
    }
    const today = toDateKey(new Date())
    if (assignment.checkOut <= assignment.checkIn) {
      setEditBookingError('Choose a valid stay: check-out must be after check-in.')
      return false
    }
    if (!Number.isInteger(assignment.guestCount) || assignment.guestCount < 1 || assignment.guestCount > room.capacity) {
      setEditBookingError(`This room allows up to ${room.capacity} guests.`)
      return false
    }
    const hasConflict = bookings.some((otherBooking) =>
      otherBooking.id !== booking.id &&
      otherBooking.roomId === assignment.roomId &&
      otherBooking.status !== 'Cancelled' &&
      otherBooking.status !== 'Completed' &&
      otherBooking.checkIn < assignment.checkOut &&
      otherBooking.checkOut > assignment.checkIn,
    )
    const includesToday = assignment.checkIn <= today && assignment.checkOut > today
    if (hasConflict || assignment.roomId !== booking.roomId && includesToday && room.status === 'occupied') {
      setEditBookingError('That room is already occupied or booked for part of those dates. Select another room or stay period.')
      return false
    }

    setEditBookingSaving(true)
    const nights = Math.round((new Date(`${assignment.checkOut}T00:00:00`).getTime() - new Date(`${assignment.checkIn}T00:00:00`).getTime()) / 86_400_000)
    const tourPromoPrice = booking.tourPromoPrice != null &&
      assignment.guestCount === 2 &&
      assignment.checkIn === booking.checkIn &&
      assignment.checkOut === booking.checkOut
      ? booking.tourPromoPrice
      : null
    const keepTourPromo = tourPromoPrice !== null
    const totalPrice = (tourPromoPrice ?? room.rate * nights) + booking.airportTransferPrice
    const paymentStatus = booking.paid > totalPrice
      ? 'overpaid'
      : totalPrice > 0 && booking.paid >= totalPrice
        ? 'paid'
        : booking.paid > 0
          ? 'partial'
          : 'unpaid'
    const specialRequests = assignment.specialRequests?.trim() ?? ''
    const specialRequestNoted = Boolean(
      booking.specialRequestNoted &&
      specialRequests === (booking.request === 'No special requests.' ? '' : booking.request),
    )
    const { data, error } = await supabase.from('bookings').update({
      room_id: assignment.roomId,
      check_in: assignment.checkIn,
      check_out: assignment.checkOut,
      num_of_guests: assignment.guestCount,
      total_price: totalPrice,
      tour_promo_id: keepTourPromo ? booking.tourPromoId ?? null : null,
      tour_promo_price: tourPromoPrice,
      tour_promo_with_lunch: keepTourPromo ? booking.tourPromoWithLunch ?? null : null,
      payment_status: paymentStatus,
      special_requests: specialRequests || null,
      special_requests_noted: specialRequestNoted,
    }).eq('id', booking.id).select('id').maybeSingle()

    if (error) {
      console.error('Unable to update booking details:', error)
      setEditBookingError(`Could not update booking: ${error.message}`)
      setEditBookingSaving(false)
      return false
    }
    if (!data) {
      setEditBookingError('The booking update was not confirmed by the database. Refresh and check before retrying.')
      setEditBookingSaving(false)
      return false
    }

    const updatedBooking: Booking = {
      ...booking,
      room: room.name,
      roomId: assignment.roomId,
      dates: `${assignment.checkIn} – ${assignment.checkOut}`,
      checkIn: assignment.checkIn,
      checkOut: assignment.checkOut,
      guests: assignment.guestCount,
      amount: totalPrice,
      tourPromoId: keepTourPromo ? booking.tourPromoId ?? null : null,
      tourPromoPrice,
      tourPromoWithLunch: keepTourPromo ? booking.tourPromoWithLunch ?? null : null,
      request: specialRequests || 'No special requests.',
      specialRequestNoted,
      payment: paymentStatus === 'overpaid' ? 'Overpaid' : paymentStatus === 'paid' ? 'Paid' : paymentStatus === 'partial' ? 'Partial' : 'Unpaid',
    }
    setBookings((items) => items.map((item) => item.id === booking.id ? updatedBooking : item))
    setBookingToEdit(null)
    setEditBookingSaving(false)
    return true
  }

  const setBookingSpecialRequestNoted = async (booking: Booking, noted: boolean) => {
    if (noted && !hasSpecialRequest(booking)) return 'Add a special request before marking it as noted.'
    const { data, error } = await supabase
      .from('bookings')
      .update({ special_requests_noted: noted })
      .eq('id', booking.id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Unable to update special request noted status:', error)
      if (error.code === '42703' || error.code === 'PGRST204' || error.message.includes('special_requests_noted')) {
        return 'Apply supabase/migrations/20261008220000_track_special_request_acknowledgement.sql in Supabase, then refresh.'
      }
      if (error.code === '42501' || error.message.toLowerCase().includes('row-level security')) {
        return 'Supabase denied this update. Check the bookings table UPDATE permissions.'
      }
      return `Could not save noted status: ${error.message}`
    }
    if (!data) {
      console.error('Special request noted status update was not confirmed:', booking.id)
      return 'Supabase did not update this booking. Verify it still exists and that the bookings UPDATE policy allows this signed-in admin to change it.'
    }

    setBookings((items) => items.map((item) => item.id === booking.id
      ? { ...item, specialRequestNoted: noted }
      : item))
    return null
  }

  const deleteBookingAndHistory = async () => {
    if (!bookingToDelete) return
    const booking = bookingToDelete
    setBookingDeleteError('')
    setBookingDeleteSaving(true)
    const { data, error } = await supabase.rpc('delete_booking_with_history', {
      p_booking_id: booking.id,
    })

    if (error) {
      console.error('Unable to delete booking and related history:', error)
      setBookingDeleteError(error.message.includes('delete_booking_with_history')
        ? 'Apply the booking deletion migration in Supabase, then try again.'
        : `Could not delete booking: ${error.message}`)
      setBookingDeleteSaving(false)
      return
    }
    if (data !== booking.id) {
      setBookingDeleteError('The booking was not deleted. Refresh the booking list before trying again.')
      setBookingDeleteSaving(false)
      return
    }

    setBookings((items) => items.filter((item) => item.id !== booking.id))
    setRoomChanges((items) => items.filter((item) => item.booking_id !== booking.id))
    setSelectedBooking((item) => item?.id === booking.id ? null : item)
    setBookingToDelete(null)
    setBookingDeleteSaving(false)
  }

  const changeGuestRoom = async (booking: Booking, roomId: number, note: string) => {
    setAssignmentError('')
    const room = rooms.find((item) => Number(item.id) === roomId)
    if (!room || !room.isActive) {
      setAssignmentError('Choose an active room.')
      return false
    }
    if (booking.guests > room.capacity) {
      setAssignmentError(`This room allows up to ${room.capacity} guests; this booking has ${booking.guests}.`)
      return false
    }
    const conflicts = bookings.some((item) =>
      item.id !== booking.id &&
      item.roomId === roomId &&
      item.status !== 'Cancelled' &&
      item.status !== 'Completed' &&
      item.checkIn < booking.checkOut &&
      item.checkOut > booking.checkIn,
    )
    const today = toDateKey(new Date())
    const includesToday = booking.checkIn <= today && booking.checkOut > today
    if (conflicts || roomId !== booking.roomId && includesToday && room.status === 'occupied') {
      setAssignmentError('That room is already occupied or booked during this stay. Select another room.')
      return false
    }

    setAssignmentSaving(true)
    const nights = Math.round((new Date(`${booking.checkOut}T00:00:00`).getTime() - new Date(`${booking.checkIn}T00:00:00`).getTime()) / 86_400_000)
    const totalPrice = room.rate * nights + booking.airportTransferPrice
    const { data, error } = await supabase.rpc('change_booking_room', {
      p_booking_id: booking.id,
      p_new_room_id: roomId,
      p_new_total: totalPrice,
      p_note: note,
    })

    if (error) {
      console.error('Unable to change booking room:', error)
      setAssignmentError(`Could not change room: ${error.message}`)
      setAssignmentSaving(false)
      return false
    }
    if (typeof data !== 'string') {
      setAssignmentError('The room change was not confirmed by the database. Refresh and verify the booking before retrying.')
      setAssignmentSaving(false)
      return false
    }

    const changeRecord: RoomChangeRecord = {
      id: data,
      booking_id: booking.id,
      previous_room_id: booking.roomId,
      new_room_id: roomId,
      previous_total: booking.amount,
      new_total: totalPrice,
      paid_at_change: booking.paid,
      credit_amount: Math.max(0, booking.paid - totalPrice),
      credit_returned: false,
      credit_returned_at: null,
      note: note.trim() || `Room changed from ${booking.room} to ${room.name}.`,
      created_at: new Date().toISOString(),
    }
    setRoomChanges((items) => [changeRecord, ...items])
    setBookings((items) => items.map((item) => item.id === booking.id
      ? {
          ...item,
          roomId,
          room: room.name,
          amount: totalPrice,
          payment: item.paid > totalPrice ? 'Overpaid' : totalPrice > 0 && item.paid === totalPrice ? 'Paid' : item.paid > 0 ? 'Partial' : 'Unpaid',
        }
      : item))
    setChangingGuestRoom(null)
    setAssignmentSaving(false)
    return true
  }

  const markRoomChangeCreditReturned = async (changeId: string) => {
    setCreditStatusError('')
    setCreditReturnSavingId(changeId)
    const returnedAt = new Date().toISOString()
    const { data, error } = await supabase
      .from('booking_room_changes')
      .update({ credit_returned: true, credit_returned_at: returnedAt })
      .eq('id', changeId)
      .eq('credit_returned', false)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Unable to mark room change credit as returned:', error)
      setCreditStatusError(`Could not update credit return status: ${error.message}`)
      setCreditReturnSavingId(null)
      return false
    }
    if (!data) {
      setCreditStatusError('Credit return status was not updated. Refresh and check the note before retrying.')
      setCreditReturnSavingId(null)
      return false
    }

    setRoomChanges((items) => items.map((item) => item.id === changeId
      ? { ...item, credit_returned: true, credit_returned_at: returnedAt }
      : item))
    const roomChange = roomChanges.find((item) => item.id === changeId)
    if (roomChange) {
      setBookings((items) => items.map((booking) => {
        if (booking.id !== roomChange.booking_id) return booking
        const paid = Math.max(0, booking.paid - roomChange.credit_amount)
        return {
          ...booking,
          paid,
          payment: paid > booking.amount ? 'Overpaid' : booking.amount > 0 && paid === booking.amount ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid',
        }
      }))
    }
    setCreditReturnSavingId(null)
    return true
  }

  const returnBookingOverpayment = async (booking: Booking) => {
    setCreditStatusError('')
    setCreditReturnSavingId(booking.id)
    const { data, error } = await supabase.rpc('return_booking_overpayment', {
      p_booking_id: booking.id,
    })

    if (error) {
      console.error('Unable to return booking overpayment:', error)
      setCreditStatusError(`Could not return overpayment: ${error.message}`)
      setCreditReturnSavingId(null)
      return false
    }
    if (typeof data !== 'string') {
      setCreditStatusError('No overpayment was returned. Refresh the booking and verify its balance before retrying.')
      setCreditReturnSavingId(null)
      return false
    }

    const overpayment = Math.max(0, booking.paid - booking.amount)
    const returnedAt = new Date().toISOString()
    const creditRecord: RoomChangeRecord = {
      id: data,
      booking_id: booking.id,
      previous_room_id: booking.roomId,
      new_room_id: booking.roomId,
      previous_total: booking.amount,
      new_total: booking.amount,
      paid_at_change: booking.paid,
      credit_amount: overpayment,
      credit_returned: true,
      credit_returned_at: returnedAt,
      note: 'Overpayment returned to guest.',
      created_at: returnedAt,
    }
    setRoomChanges((items) => [creditRecord, ...items])
    setBookings((items) => items.map((item) => item.id === booking.id
      ? { ...item, paid: item.amount, payment: 'Paid' }
      : item))
    setCreditReturnSavingId(null)
    return true
  }

  const deleteGuestAndHistory = async (guest: Guest) => {
    setGuestDeleteError('')
    setGuestDeleteSavingId(guest.id)
    const { data, error } = await supabase.rpc('delete_guest_with_history', {
      p_guest_id: guest.id,
    })

    if (error) {
      console.error('Unable to delete guest and related booking history:', error)
      setGuestDeleteError(`Could not delete guest: ${error.message}`)
      setGuestDeleteSavingId(null)
      return false
    }
    if (data !== guest.id) {
      setGuestDeleteError('The guest was not deleted. Refresh the guest list before trying again.')
      setGuestDeleteSavingId(null)
      return false
    }

    setGuests((items) => items.filter((item) => item.id !== guest.id))
    setBookings((items) => items.filter((item) => item.guestId !== guest.id))
    setRoomChanges((items) => items.filter((item) => !bookings.some((booking) => booking.id === item.booking_id && booking.guestId === guest.id)))
    setSelectedBooking((booking) => booking?.guestId === guest.id ? null : booking)
    setGuestDeleteSavingId(null)
    return true
  }

  const updateRoomDetails = async (room: Room, values: RoomEditValues) => {
    setRoomStatusError('')
    const rate = Number(values.rate)
    const capacity = Number(values.capacity)
    if (!values.name.trim() || !values.type.trim() || !Number.isFinite(rate) || rate < 0 || !Number.isInteger(capacity) || capacity < 1) {
      setRoomStatusError('Enter a room name and type, a valid nightly rate, and a whole-number guest capacity of at least one.')
      return false
    }
    const overCapacityBookings = bookings.filter((booking) =>
      booking.roomId === Number(room.id) &&
      booking.status !== 'Cancelled' &&
      booking.status !== 'Completed' &&
      booking.guests > capacity,
    )
    if (overCapacityBookings.length > 0) {
      setRoomStatusError(`Guest capacity cannot be reduced below ${Math.max(...overCapacityBookings.map((booking) => booking.guests))}; existing bookings exceed that limit.`)
      return false
    }
    setUpdatingRoomId(room.id)
    const { error } = await supabase
      .from('rooms')
      .update({
        room_name: values.name.trim(),
        room_type: values.type.trim(),
        room_price: rate,
        max_guests: capacity,
        description: values.notes.trim() || null,
      })
      .eq('id', Number(room.id))

    if (error) {
      console.error('Unable to update room details:', error)
      setRoomStatusError(`Could not update room ${room.name}: ${error.message}`)
      setUpdatingRoomId(null)
      return false
    }

    setRooms((items) => items.map((item) => item.id === room.id
      ? {
        ...item,
        name: values.name.trim(),
        type: values.type.trim(),
        rate,
        capacity,
        notes: values.notes.trim(),
      }
      : item))
    setBookings((items) => items.map((booking) =>
      booking.roomId === Number(room.id) ? { ...booking, room: values.name.trim() } : booking))
    setSelectedBooking((booking) =>
      booking?.roomId === Number(room.id) ? { ...booking, room: values.name.trim() } : booking)
    setUpdatingRoomId(null)
    return true
  }

  const setRoomMaintenance = async (room: Room, enabled: boolean, note: string) => {
    setRoomStatusError('')
    setUpdatingRoomId(room.id)
    const { error } = await supabase.rpc('set_room_maintenance', {
      p_room_id: Number(room.id),
      p_maintenance: enabled,
      p_note: enabled ? note.trim() || null : null,
    })

    if (error) {
      console.error('Unable to update room maintenance status:', error)
      const missingMaintenanceColumn = error.message.includes('maintenance_status') || error.message.includes('maintenance_note')
      const missingMaintenanceFunction = error.message.includes('set_room_maintenance') || error.code === 'PGRST202'
      const rowLevelSecurityDenied = error.code === '42501' || error.message.toLowerCase().includes('row-level security')
      setRoomStatusError(missingMaintenanceColumn || missingMaintenanceFunction
        ? 'The room maintenance database update is missing. Run supabase/migrations/20261001170000_set_room_maintenance_rpc.sql in the Supabase SQL Editor, then refresh.'
        : rowLevelSecurityDenied
          ? 'Supabase still blocks direct maintenance updates. Run supabase/migrations/20261001170000_set_room_maintenance_rpc.sql in the Supabase SQL Editor, then refresh.'
          : `Could not update maintenance for ${room.name}: ${error.message}`)
      setUpdatingRoomId(null)
      return false
    }

    setRooms((items) => items.map((item) => item.id === room.id
      ? { ...item, isActive: !enabled, isUnderMaintenance: enabled, maintenanceNote: enabled ? note.trim() : '' }
      : item))
    setUpdatingRoomId(null)
    return true
  }

  const nav = (label: string, group: 'hometel' | 'tours' = 'hometel') => {
    setActiveNav(label)
    setActiveGroup(group)
    setMobileMenu(false)
  }

  const openNotification = (notification: DashboardNotification | Omit<DashboardNotification, 'read'>) => {
    setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read: true } : item))
    setNotificationsOpen(false)
    setToastNotification(null)
    if (notification.category === 'booking') {
      setQuery(notification.relatedId)
      setStatusFilter('All statuses')
      setSpecialRequestsOnly(false)
      const booking = bookingsRef.current.find((entry) => entry.id === notification.relatedId)
      if (booking) setSelectedBooking(booking)
      nav('Bookings')
    } else {
      setPaymentQuery(notification.relatedId)
      setPaymentStatusFilter('All statuses')
      nav('Payments')
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? '' : 'sidebar-collapsed'} ${mobileMenu ? 'sidebar-mobile-open' : ''}`}>
        <div className="brand">
          <button
            className="brand-logo-button"
            type="button"
            onClick={() => setSidebarOpen((isOpen) => !isOpen)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <img className="brand-mark" src="/siayanrock-logo.jpg" alt="" />
          </button>
          {sidebarOpen && <div><strong>Siayanrock Is.</strong><small>ADMIN</small></div>}
        </div>
        <div className="workspace-label">{sidebarOpen && 'HOMETEL'}</div>
        <nav className="nav-list" aria-label="Main navigation">
          {hometelItems.map(({ label, icon: Icon, count }) => (
            <button key={`hometel-${label}`} className={`nav-item ${activeNav === label && activeGroup === 'hometel' ? 'active' : ''}`} onClick={() => nav(label, 'hometel')} title={label}>
              <Icon size={sidebarOpen ? 19 : 22} strokeWidth={activeNav === label ? 2.3 : 1.8} /><span>{sidebarOpen && label}</span>{sidebarOpen && count && <em>{count}</em>}
            </button>
          ))}
          {sidebarOpen && <div className="workspace-label nav-section-label">TOURS</div>}
          {tourItems.map(({ label, icon: Icon, count }) => (
            <button key={`tours-${label}`} className={`nav-item ${activeNav === label && activeGroup === 'tours' ? 'active' : ''}`} onClick={() => nav(label, 'tours')} title={label}>
              <Icon size={sidebarOpen ? 19 : 22} strokeWidth={activeNav === label ? 2.3 : 1.8} /><span>{sidebarOpen && label}</span>{sidebarOpen && count && <em>{count}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-date" title={today.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}>
          {sidebarOpen && <span>{sidebarDate}</span>}
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu-button icon-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Open menu"><Menu size={21} /></button>
          <div className="breadcrumb"><span>{activeGroup === 'hometel' ? 'Hometel' : 'Tours'}</span><span className="slash">/</span><strong>{activeNav}</strong></div>
          <div className="topbar-actions">
            <div className="notification-container">
              <button
                className="icon-button notification-button"
                onClick={() => setNotificationsOpen((open) => !open)}
                aria-label={`Notifications${notifications.filter((item) => !item.read).length ? `, ${notifications.filter((item) => !item.read).length} unread` : ''}`}
                aria-expanded={notificationsOpen}
                aria-haspopup="true"
              >
                <Bell size={19} />
                {notifications.some((item) => !item.read) && <span className="notification-count">{Math.min(notifications.filter((item) => !item.read).length, 99)}</span>}
              </button>
              {notificationsOpen && <section className="notification-panel" aria-label="Notifications">
                <header className="notification-panel-header">
                  <div><strong>Notifications</strong><span>{notifications.filter((item) => !item.read).length} unread</span></div>
                  <button className="notification-mark-read" onClick={() => setNotifications((items) => items.map((item) => ({ ...item, read: true })))} disabled={!notifications.some((item) => !item.read)}>
                    <CheckCheck size={14} /> Mark all read
                  </button>
                </header>
                {notifications.length === 0
                  ? <div className="notification-empty"><Bell size={20} /><strong>You’re all caught up</strong><span>New bookings and payment transactions will appear here.</span></div>
                  : <div className="notification-list">{notifications.map((item) => (
                    <button
                      key={item.id}
                      className={`notification-item ${item.read ? '' : 'is-unread'}`}
                      onClick={() => openNotification(item)}
                    >
                      <span className={`notification-item-icon ${item.category === 'booking' ? 'booking-notification' : 'payment-notification'}`}>
                        {item.category === 'booking' ? <CalendarDays size={16} /> : <CircleDollarSign size={16} />}
                      </span>
                      <span className="notification-item-copy"><strong>{item.title}</strong><span>{item.detail}</span><small>{new Date(item.createdAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></span>
                      {!item.read && <span className="notification-unread-dot" />}
                    </button>
                  ))}</div>}
              </section>}
            </div>
            <AccountIndicator userEmail={userEmail} onSignOut={onSignOut} />
          </div>
          {toastNotification && <div className="notification-toast" role="status">
            <button className="notification-toast-open" onClick={() => openNotification(toastNotification)}>
              <span className={`notification-item-icon ${toastNotification.category === 'booking' ? 'booking-notification' : 'payment-notification'}`}>
                {toastNotification.category === 'booking' ? <CalendarDays size={16} /> : <CircleDollarSign size={16} />}
              </span>
              <span><strong>{toastNotification.title}</strong><small>{toastNotification.detail}</small></span>
            </button>
            <button className="notification-toast-close" onClick={() => setToastNotification(null)} aria-label="Dismiss notification"><X size={15} /></button>
          </div>}
        </header>

        <div className="page-content">
          {activeGroup === 'tours' ? (activeNav === 'Bookings' ? <ToursBookingsTab /> : activeNav === 'Payments' ? <ToursPaymentsTab /> : <ToursOverviewTab />) : activeNav === 'Overview' ? (
            <HometelOverview dataLoading={dataLoading} invoiceSentGuests={invoiceSentGuests} monthRevenue={monthRevenue} todayCheckIns={todayCheckIns} todayCheckOuts={todayCheckOuts} openMetricPopup={openMetricPopup} range={range} setRange={setRange} chartData={chartData} revenueChartData={revenueChartData} bookingsInRange={bookingsInRange} revenueInRange={revenueInRange} pendingBookings={pendingBookings} paymentAttentionBookings={paymentAttentionBookings} creditItemsDueCount={creditItemsDueCount} specialRequestBookings={specialRequestBookings} setStatusFilter={setStatusFilter} nav={nav} setPaymentStatusFilter={setPaymentStatusFilter} setQuery={setQuery} setSpecialRequestsOnly={setSpecialRequestsOnly} bookings={bookings} onStatusChange={saveBookingStatus} onManagePayment={(booking) => { setSelectedBooking(booking); setBookingPaymentOpen(true); setPaymentError('') }} />
          ) : activeNav === 'Bookings' ? (
            <BookingsPage bookings={bookings} loadError={bookingsLoadError} query={query} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} specialRequestsOnly={specialRequestsOnly} setSpecialRequestsOnly={setSpecialRequestsOnly} onStatusChange={saveBookingStatus} onManagePayment={(booking) => { setSelectedBooking(booking); setBookingPaymentOpen(true); setPaymentError('') }} onEditBooking={(booking) => { setEditBookingError(''); setBookingToEdit(booking) }} onDeleteBooking={(booking) => { setBookingDeleteError(''); setBookingToDelete(booking) }} onSpecialRequestNoted={setBookingSpecialRequestNoted} onCreateBooking={() => { setNewBookingError(''); setNewBookingOpen(true) }} />
          ) : activeNav === 'Rooms' ? (
            <RoomsPage rooms={rooms} bookings={bookings} occupiedRoomIds={occupiedRoomIds} dataLoading={dataLoading} query={query} setQuery={setQuery} onUpdateRoom={updateRoomDetails} onSetMaintenance={setRoomMaintenance} updatingRoomId={updatingRoomId} error={roomStatusError} />
          ) : activeNav === 'Rates' ? (
            <RatesPage />
          ) : activeNav === 'Guests' ? (
            <GuestsPage guests={guests} bookings={bookings} query={query} setQuery={setQuery} onDeleteGuest={deleteGuestAndHistory} deleteSavingId={guestDeleteSavingId} deleteError={guestDeleteError} />
          ) : activeNav === 'Payments' ? (
            <PaymentsPage bookings={bookings} roomChanges={roomChanges} query={paymentQuery} setQuery={setPaymentQuery} statusFilter={paymentStatusFilter} setStatusFilter={setPaymentStatusFilter} onMarkCreditReturned={markRoomChangeCreditReturned} onReturnOverpayment={returnBookingOverpayment} onInvoiceSent={(bookingIds, sentAt) => { setBookings((items) => items.map((booking) => bookingIds.includes(booking.id) ? { ...booking, invoiceSentAt: sentAt } : booking)); setSelectedBooking((booking) => booking && bookingIds.includes(booking.id) ? { ...booking, invoiceSentAt: sentAt } : booking) }} creditReturnSavingId={creditReturnSavingId} creditStatusError={creditStatusError} />
          ) : <div className="empty-state"><strong>Tab not found</strong></div>}
        </div>
      </main>

      {selectedBooking && bookingPaymentOpen ? <BookingActionDialog
        booking={selectedBooking}
        onClose={() => { if (!paymentSaving) { setBookingPaymentOpen(false); setSelectedBooking(null); setPaymentError('') } }}
        onAddPayment={addBookingPayment}
        paymentError={paymentError}
        paymentSaving={paymentSaving}
      /> : selectedBooking && <BookingDrawer booking={selectedBooking} onClose={() => { setSelectedBooking(null); setPaymentError('') }} onStatusChange={updateBookingStatus} onAddPayment={addBookingPayment} paymentError={paymentError} paymentSaving={paymentSaving} />}
      {bookingToEdit && <EditBookingDialog
        booking={bookingToEdit}
        rooms={rooms}
        bookings={bookings}
        error={editBookingError}
        saving={editBookingSaving}
        onClose={() => { if (!editBookingSaving) setBookingToEdit(null) }}
        onSave={updateBookingDetails}
      />}
      {bookingToDelete && <DeleteBookingDialog
        booking={bookingToDelete}
        error={bookingDeleteError}
        saving={bookingDeleteSaving}
        onClose={() => { if (!bookingDeleteSaving) setBookingToDelete(null) }}
        onConfirm={() => void deleteBookingAndHistory()}
      />}
      {newBookingOpen && <NewBookingDialog rooms={rooms} guests={guests} bookings={bookings} error={newBookingError} saving={newBookingSaving} onClose={() => { if (!newBookingSaving) setNewBookingOpen(false) }} onCreate={createNewBooking} />}
      {assigningGuest && <GuestAssignmentDialog guest={assigningGuest} rooms={rooms} bookings={bookings} error={assignmentError} saving={assignmentSaving} onClose={() => { if (!assignmentSaving) setAssigningGuest(null) }} onAssign={(assignment) => assignGuestToRoom(assigningGuest, assignment)} />}
      {changingGuestRoom && <RoomChangeDialog
        guest={changingGuestRoom}
        rooms={rooms}
        bookings={bookings.filter((booking) => booking.guestId === changingGuestRoom.id && booking.status !== 'Cancelled' && booking.status !== 'Completed' && booking.checkOut > toDateKey(new Date()))}
        setupError={roomChangeSetupError}
        error={assignmentError}
        saving={assignmentSaving}
        onClose={() => { if (!assignmentSaving) setChangingGuestRoom(null) }}
        onChangeRoom={changeGuestRoom}
      />}
      {metricPopup && <MetricPopupDialog popup={metricPopup} loading={dataLoading} onClose={() => setMetricPopup(null)} />}
    </div>
  )
}

export default App
