import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  BedDouble,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  DoorOpen,
  Ellipsis,
  FileText,
  Home,
  Menu,
  Mail,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plane,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from './lib/supabaseClient'
import './App.css'

type BookingStatus = 'Confirmed' | 'Pending' | 'Checked in' | 'Completed' | 'Cancelled'
type PaymentStatus = 'Paid' | 'Partial' | 'Unpaid' | 'Overpaid'

type Booking = {
  id: string
  guestId: string
  guest: string
  initials: string
  room: string
  roomId: number
  dates: string
  checkIn: string
  checkOut: string
  createdAt: string
  guests: number
  amount: number
  paid: number
  payments: { amount: number; paidAt: string | null; method: string; type: string; status: string }[]
  status: BookingStatus
  payment: PaymentStatus
  color: string
  email: string
  phone: string
  request: string
}

type Room = {
  id: string
  name: string
  type: string
  status: 'occupied' | 'vacant'
  isActive: boolean
  guest: string
  rate: number
  capacity: number
  notes: string
}

type Guest = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  created_at: string
}

type SupabaseBooking = {
  id: string
  guest_id: string
  room_id: number
  check_in: string
  check_out: string
  num_of_guests: number
  total_price: number | string
  created_at: string
  status: string
  payment_status: string | null
  special_requests: string | null
  guests: { full_name: string; email: string | null; phone: string | null } | null
  rooms: { room_name: string; room_number: string | null } | null
  payments: { amount: number | string; payment_status: string | null; paid_at: string | null; payment_method: string | null; payment_type: string | null }[] | null
  booking_room_changes: { credit_amount: number | string; credit_returned: boolean | null }[] | null
}

type SupabaseRoom = {
  id: number
  room_name: string | null
  room_number: string | null
  room_type: string | null
  room_price: number | string | null
  max_guests: number | null
  base_guests: number | null
  is_active: boolean | null
  occupancy_status: 'occupied' | 'vacant' | null
  description: string | null
}

type MetricDetail = {
  booking?: Booking
  room?: Room
  detail: string
  amount?: number
  statusOverride?: string
}

type MetricPopup = {
  title: string
  description: string
  entries: MetricDetail[]
}

type GuestAssignment = {
  roomId: number
  checkIn: string
  checkOut: string
  guestCount: number
}

type RoomChangeRecord = {
  id: string
  booking_id: string
  previous_room_id: number
  new_room_id: number
  previous_total: number
  new_total: number
  paid_at_change: number
  credit_amount: number
  credit_returned: boolean
  credit_returned_at: string | null
  note: string
  created_at: string
}

type PaymentTransaction = {
  id: string
  booking: Booking
  amount: number
  displayAmount: number
  paidAt: string | null
  occurredAt: string | null
  method: string
  type: string
  transaction: string
  transactionStatus: string
  isCreditReturn: boolean
  isStatusOnly: boolean
}

const mapSupabaseRoom = (record: SupabaseRoom): Room => ({
  id: String(record.id),
  name: record.room_name ?? `Room ${record.room_number ?? record.id}`,
  type: record.room_type ?? 'Standard',
  status: record.occupancy_status === 'occupied' ? 'occupied' : 'vacant',
  isActive: record.is_active !== false,
  guest: '',
  rate: Number(record.room_price ?? 0),
  capacity: Number(record.max_guests ?? record.base_guests ?? 2),
  notes: record.description ?? '',
})

const hometelItems = [
  { label: 'Overview', icon: Home, count: undefined },
  { label: 'Bookings', icon: CalendarDays, count: undefined },
  { label: 'Rooms', icon: BedDouble, count: undefined },
  { label: 'Guests', icon: Users, count: undefined },
  { label: 'Payments', icon: CircleDollarSign, count: undefined },
]

const tourItems = [
  { label: 'Overview', icon: Plane, count: undefined },
  { label: 'Bookings', icon: CalendarDays, count: undefined },
  { label: 'Payments', icon: CircleDollarSign, count: undefined },
]

function formatCurrency(value: number) {
  return `₱${value.toLocaleString('en-PH')}`
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(value: string | null) {
  if (!value) return 'Date unavailable'
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ children, kind = 'neutral' }: { children: React.ReactNode; kind?: string }) {
  return <span className={`badge badge-${kind.toLowerCase().replace(' ', '-')}`}><span className="badge-dot" />{children}</span>
}

function statusKind(status: string) {
  return status === 'Confirmed' || status === 'Paid' ? 'success' : status === 'Pending' || status === 'Partial' || status === 'Overpaid' || status === 'Refund due' ? 'warning' : status === 'Checked in' ? 'info' : status === 'Unpaid' || status === 'Cancelled' ? 'danger' : 'neutral'
}

function App() {
  const [activeNav, setActiveNav] = useState('Overview')
  const [activeGroup, setActiveGroup] = useState<'hometel' | 'tours'>('hometel')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [roomChanges, setRoomChanges] = useState<RoomChangeRecord[]>([])
  const [roomChangeSetupError, setRoomChangeSetupError] = useState('')
  const [dataLoading, setDataLoading] = useState(true)
  const [roomStatusError, setRoomStatusError] = useState('')
  const [updatingRoomId, setUpdatingRoomId] = useState<string | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
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
  const [paymentQuery, setPaymentQuery] = useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All statuses')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [range, setRange] = useState('Last 30 days')

  useEffect(() => {
    let isMounted = true

    const loadBookings = async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, guests(full_name, email, phone), rooms(room_name, room_number), payments(amount, payment_status, paid_at, payment_method, payment_type), booking_room_changes(credit_amount, credit_returned)')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Unable to load bookings from Supabase:', error)
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
            payments: paymentRows
              .map((payment) => ({ amount: Number(payment.amount), paidAt: payment.paid_at, method: payment.payment_method ?? '—', type: payment.payment_type ?? 'payment', status: payment.payment_status ?? 'pending' })),
            status: status === 'completed' ? 'Completed' : status === 'confirmed' || status === 'reserved' ? 'Confirmed' : status === 'checked_in' ? 'Checked in' : status === 'cancelled' ? 'Cancelled' : 'Pending',
            payment: paid > amount ? 'Overpaid' : amount > 0 && paid === amount ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid',
            color: '#e4c3aa',
            email: guest?.email ?? '',
            phone: guest?.phone ?? '',
            request: record.special_requests ?? 'No special requests.',
          }
        })

        setBookings(mappedBookings)
      }
    }

    const loadRooms = async () => {
      const { data, error } = await supabase.from('rooms').select('*').order('id', { ascending: true })

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

  const today = new Date()
  const todayKey = toDateKey(today)
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
  const openMetricPopup = (kind: 'occupancy' | 'revenue' | 'check-ins' | 'check-outs') => {
    const popup: MetricPopup = kind === 'occupancy'
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
  const vacantRoomCount = Math.max(0, activeRooms.length - occupiedRoomIds.size)
  const rangeDays = range === 'Last 7 days'
    ? 7
    : range === 'This year'
      ? Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / 86_400_000) + 1
      : 30
  const chartData = useMemo(() => {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - rangeDays + 1)
    return Array.from({ length: rangeDays }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
      const day = toDateKey(date)
      return {
        day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: bookings.filter((booking) => booking.createdAt.slice(0, 10) === day).length,
      }
    })
  }, [bookings, rangeDays, today.getFullYear(), today.getMonth(), today.getDate()])
  const bookingsInRange = chartData.reduce((total, item) => total + item.value, 0)

  const updateBookingStatus = (status: BookingStatus) => {
    if (!selectedBooking) return
    setBookings((items) => items.map((item) => item.id === selectedBooking.id ? { ...item, status } : item))
    setSelectedBooking({ ...selectedBooking, status })
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
    const { error } = await supabase.from('payments').insert({
      booking_id: selectedBooking.id,
      amount,
      payment_type: paymentType,
      payment_method: method,
      payment_status: 'paid',
      paid_at: paidAt,
    })

    if (error) {
      console.error('Unable to record booking payment:', error)
      setPaymentError(`Could not record payment: ${error.message}`)
      setPaymentSaving(false)
      return false
    }

    const paid = selectedBooking.paid + amount
    const updatedBooking: Booking = {
      ...selectedBooking,
      paid,
      payment: paid > selectedBooking.amount ? 'Overpaid' : paid === selectedBooking.amount ? 'Paid' : 'Partial',
      status: selectedBooking.status === 'Pending' ? 'Confirmed' : selectedBooking.status,
      payments: [...selectedBooking.payments, { amount, paidAt, method, type: paymentType, status: 'paid' }],
    }
    setBookings((items) => items.map((item) => item.id === updatedBooking.id ? updatedBooking : item))
    setSelectedBooking(updatedBooking)
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
    }
    setBookings((items) => [booking, ...items])
    setAssigningGuest(null)
    setAssignmentSaving(false)
    return true
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
    const totalPrice = room.rate * nights
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

  const setRoomStatus = async (room: Room, status: Room['status']) => {
    setRoomStatusError('')
    setUpdatingRoomId(room.id)
    const { error } = await supabase
      .from('rooms')
      .update({ occupancy_status: status })
      .eq('id', Number(room.id))

    if (error) {
      console.error('Unable to update room occupancy status:', error)
      setRoomStatusError(error.message.includes('occupancy_status')
        ? 'Run the room occupancy SQL migration in Supabase, then try again.'
        : `Could not update room ${room.name}: ${error.message}`)
      setUpdatingRoomId(null)
      return
    }

    setRooms((items) => items.map((item) => item.id === room.id ? { ...item, status } : item))
    setUpdatingRoomId(null)
  }

  const nav = (label: string, group: 'hometel' | 'tours' = 'hometel') => {
    setActiveNav(label)
    setActiveGroup(group)
    setMobileMenu(false)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? '' : 'sidebar-collapsed'} ${mobileMenu ? 'sidebar-mobile-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">S</div>
          {sidebarOpen && <div><strong>SiayanRock</strong><small>ADMIN</small></div>}
          <button className="icon-button sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>
        <div className="workspace-label">{sidebarOpen && 'HOMETEL'}</div>
        <nav className="nav-list" aria-label="Main navigation">
          {hometelItems.map(({ label, icon: Icon, count }) => (
            <button key={`hometel-${label}`} className={`nav-item ${activeNav === label && activeGroup === 'hometel' ? 'active' : ''}`} onClick={() => nav(label, 'hometel')} title={label}>
              <Icon size={19} strokeWidth={activeNav === label ? 2.3 : 1.8} /><span>{sidebarOpen && label}</span>{sidebarOpen && count && <em>{count}</em>}
            </button>
          ))}
          {sidebarOpen && <div className="workspace-label nav-section-label">TOURS</div>}
          {tourItems.map(({ label, icon: Icon, count }) => (
            <button key={`tours-${label}`} className={`nav-item ${activeNav === label && activeGroup === 'tours' ? 'active' : ''}`} onClick={() => nav(label, 'tours')} title={label}>
              <Icon size={19} strokeWidth={activeNav === label ? 2.3 : 1.8} /><span>{sidebarOpen && label}</span>{sidebarOpen && count && <em>{count}</em>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu-button icon-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Open menu"><Menu size={21} /></button>
          <div className="breadcrumb"><span>{activeGroup === 'hometel' ? 'Hometel' : 'Tours'}</span><span className="slash">/</span><strong>{activeNav}</strong></div>
          <div className="topbar-actions">
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={19} /><span /></button>
          </div>
        </header>

        <div className="page-content">
          {activeGroup === 'tours' ? (
            <ToursWorkspacePage title={activeNav} />
          ) : activeNav === 'Overview' ? (
            <>
              <div className="page-heading">
                <div><p className="eyebrow">{today.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p><h1>Overview <span>✦</span></h1><p className="subtitle">Here’s what’s happening across your Hometel and tour operations today.</p></div>
                <button className="button button-primary" onClick={() => nav('Bookings')}><CalendarDays size={17} /> New booking</button>
              </div>
              <section className="metric-grid">
                <MetricCard label="Room occupancy" value={dataLoading ? '—' : `${occupiedRoomIds.size} out of ${activeRooms.length}`} detail="Active rooms occupied today" icon={<DoorOpen size={19} />} color="mint" onClick={() => openMetricPopup('occupancy')} />
                <MetricCard label="Revenue this month" value={dataLoading ? '—' : formatCurrency(monthRevenue)} detail="Paid transactions minus returned credits" icon={<CircleDollarSign size={19} />} color="lavender" onClick={() => openMetricPopup('revenue')} />
                <MetricCard label="Today’s check-ins" value={dataLoading ? '—' : String(todayCheckIns)} detail="Bookings checking in today" icon={<ArrowDownRight size={19} />} color="peach" onClick={() => openMetricPopup('check-ins')} />
                <MetricCard label="Today’s check-outs" value={dataLoading ? '—' : String(todayCheckOuts)} detail="Bookings checking out today" icon={<ArrowUpRight size={19} />} color="yellow" onClick={() => openMetricPopup('check-outs')} />
              </section>
              <div className="dashboard-grid">
                <section className="card chart-card">
                  <div className="card-heading"><div><h2>Booking overview</h2><p>Bookings created over time</p></div><label className="select-wrap"><select value={range} onChange={(e) => setRange(e.target.value)}><option>Last 30 days</option><option>Last 7 days</option><option>This year</option></select><ChevronDown size={14} /></label></div>
                  <div className="chart-legend"><span className="legend-dot" /> Bookings <strong>{dataLoading ? '—' : bookingsInRange}</strong></div>
                  <div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 4, left: -24, bottom: 0 }}><defs><linearGradient id="bookingFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d69b77" stopOpacity={0.3} /><stop offset="100%" stopColor="#d69b77" stopOpacity={0.02} /></linearGradient></defs><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#9b9690', fontSize: 11 }} interval="preserveStartEnd" /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#9b9690', fontSize: 11 }} allowDecimals={false} domain={[0, (max: number) => Math.max(max, 1)]} /><Tooltip contentStyle={{ border: '1px solid #eee9e2', borderRadius: 10, boxShadow: '0 4px 15px #33291c12', fontSize: 12 }} /><Area type="monotone" dataKey="value" stroke="#c77d52" strokeWidth={2.5} fill="url(#bookingFill)" /></AreaChart></ResponsiveContainer></div>
                </section>
                <section className="card action-card">
                  <div className="card-heading"><div><h2>Needs your attention</h2><p>Items that need action today</p></div><button className="more-button" aria-label="More options"><MoreHorizontal size={18} /></button></div>
                  <AttentionItem icon={<CalendarDays size={16} />} title="Pending bookings" detail={`${pendingBookings.length} awaiting confirmation`} count={dataLoading ? '—' : String(pendingBookings.length)} onClick={() => { setStatusFilter('Pending'); nav('Bookings') }} />
                  <AttentionItem icon={<CircleDollarSign size={16} />} title="Payment issues" detail={`${paymentAttentionBookings.filter((booking) => booking.payment === 'Partial').length} partial · ${paymentAttentionBookings.filter((booking) => booking.payment === 'Unpaid').length} unpaid · ${paymentAttentionBookings.filter((booking) => booking.payment === 'Overpaid').length} overpaid · ${creditItemsDueCount} refunds due`} count={dataLoading ? '—' : String(paymentAttentionBookings.length + creditItemsDueCount)} onClick={() => { setPaymentStatusFilter('All statuses'); nav('Payments') }} />
                  <AttentionItem icon={<BedDouble size={16} />} title="Vacant rooms" detail={`${vacantRoomCount} active rooms not occupied`} count={dataLoading ? '—' : String(vacantRoomCount)} onClick={() => nav('Rooms')} />
                  <button className="text-button" onClick={() => nav('Bookings')}>View all items <ArrowUpRight size={14} /></button>
                </section>
              </div>
              <section className="card recent-card">
                <div className="card-heading"><div><h2>Recent bookings</h2><p>Latest activity from your property</p></div><button className="text-button" onClick={() => nav('Bookings')}>View all bookings <ArrowUpRight size={14} /></button></div>
                <BookingTable bookings={bookings.slice(0, 4)} onSelect={setSelectedBooking} compact />
              </section>
            </>
          ) : activeNav === 'Bookings' ? (
            <BookingsPage bookings={bookings} query={query} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onSelect={setSelectedBooking} />
          ) : activeNav === 'Rooms' ? (
            <RoomsPage rooms={rooms} bookings={bookings} occupiedRoomIds={occupiedRoomIds} dataLoading={dataLoading} query={query} setQuery={setQuery} onSetStatus={setRoomStatus} updatingRoomId={updatingRoomId} error={roomStatusError} />
          ) : activeNav === 'Guests' ? (
            <GuestsPage guests={guests} bookings={bookings} query={query} setQuery={setQuery} onAssign={(guest) => { setAssignmentError(''); setAssigningGuest(guest) }} onChangeRoom={(guest) => { setAssignmentError(''); setChangingGuestRoom(guest) }} onDeleteGuest={deleteGuestAndHistory} deleteSavingId={guestDeleteSavingId} deleteError={guestDeleteError} />
          ) : activeNav === 'Payments' ? (
            <PaymentsPage
              bookings={bookings}
              roomChanges={roomChanges}
              query={paymentQuery}
              setQuery={setPaymentQuery}
              statusFilter={paymentStatusFilter}
              setStatusFilter={setPaymentStatusFilter}
              onMarkCreditReturned={markRoomChangeCreditReturned}
              onReturnOverpayment={returnBookingOverpayment}
              creditReturnSavingId={creditReturnSavingId}
              creditStatusError={creditStatusError}
            />
          ) : (
            <PlaceholderPage title={activeNav} onBack={() => nav('Overview')} />
          )}
        </div>
      </main>

      {selectedBooking && <BookingDrawer booking={selectedBooking} onClose={() => { setSelectedBooking(null); setPaymentError('') }} onStatusChange={updateBookingStatus} onAddPayment={addBookingPayment} paymentError={paymentError} paymentSaving={paymentSaving} />}
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

function MetricCard({ label, value, detail, icon, color, onClick }: { label: string; value: string; detail: string; icon: React.ReactNode; color: string; onClick: () => void }) {
  return <button className="card metric-card" onClick={onClick} aria-label={`${label}: ${value}. View details`}><div className={`metric-icon ${color}`}>{icon}</div><p>{label}</p><div className="metric-value">{value}</div><div className="metric-change">{detail}</div><span className="metric-hint">View details <ArrowUpRight size={12} /></span></button>
}

function MetricPopupDialog({ popup, loading, onClose }: { popup: MetricPopup; loading: boolean; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return <div className="metric-popup-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose()
  }}>
    <section className="metric-popup card" role="dialog" aria-modal="true" aria-labelledby="metric-popup-title">
      <header className="metric-popup-header">
        <div><p className="eyebrow">Overview details</p><h2 id="metric-popup-title">{popup.title}</h2><p className="subtitle">{popup.description}</p></div>
      </header>
      <div className="metric-popup-content">
        {loading ? <div className="empty-state"><strong>Loading details…</strong></div> : popup.entries.length === 0 ? (
          <div className="empty-state"><CalendarDays size={25} /><strong>No booked rooms to show</strong><span>There are no matching records for this metric.</span></div>
        ) : popup.entries.map(({ booking, room, detail, amount, statusOverride }, index) => (
          <article className="metric-popup-entry" key={`${booking?.id ?? room?.id}-${detail}-${index}`}>
            <div className="metric-popup-room"><BedDouble size={17} /><div><strong>{booking?.room ?? room?.name}</strong><span>{booking ? `${booking.guest} · ${booking.id}` : 'Manually set occupied'}</span></div></div>
            <div className="metric-popup-meta"><span>{detail}</span>{amount !== undefined && <strong className={amount < 0 ? 'credit-amount' : undefined}>{amount < 0 ? '−' : ''}{formatCurrency(Math.abs(amount))}</strong>}</div>
            <StatusBadge kind={statusOverride ? 'warning' : popup.title === 'Revenue this month' ? 'success' : booking ? statusKind(booking.status) : 'info'}>
              {statusOverride ?? (popup.title === 'Revenue this month' ? 'Paid' : booking ? booking.status : 'Occupied')}
            </StatusBadge>
          </article>
        ))}
      </div>
      <footer className="metric-popup-footer"><button className="button button-secondary" onClick={onClose}>Close</button></footer>
    </section>
  </div>
}

function AttentionItem({ icon, title, detail, count, onClick }: { icon: React.ReactNode; title: string; detail: string; count: string; onClick: () => void }) {
  return <button className="attention-item" onClick={onClick}><div className="attention-icon">{icon}</div><div className="attention-copy"><strong>{title}</strong><span>{detail}</span></div><b>{count}</b><ArrowUpRight size={15} className="attention-arrow" /></button>
}

function BookingsPage({ bookings, query, setQuery, statusFilter, setStatusFilter, onSelect }: { bookings: Booking[]; query: string; setQuery: (v: string) => void; statusFilter: string; setStatusFilter: (v: string) => void; onSelect: (b: Booking) => void }) {
  const [expandedGuestKeys, setExpandedGuestKeys] = useState<Set<string>>(new Set())
  const monthGroups = useMemo(() => {
    const months = new Map<string, Map<string, { key: string; guest: Booking; bookings: Booking[] }>>()
    bookings.forEach((booking) => {
      const monthKey = booking.checkIn.slice(0, 7)
      const normalizedEmail = booking.email.trim().toLowerCase()
      const normalizedPhone = booking.phone.replace(/\D/g, '')
      const identityKey = normalizedEmail
        ? `email:${normalizedEmail}`
        : normalizedPhone
          ? `phone:${normalizedPhone}`
          : `guest:${booking.guestId}`
      const guestKey = `${monthKey}:${identityKey}`
      const guestsInMonth = months.get(monthKey) ?? new Map<string, { key: string; guest: Booking; bookings: Booking[] }>()
      const guestGroup = guestsInMonth.get(identityKey) ?? { key: guestKey, guest: booking, bookings: [] }
      guestGroup.bookings.push(booking)
      guestsInMonth.set(identityKey, guestGroup)
      months.set(monthKey, guestsInMonth)
    })

    return Array.from(months, ([monthKey, guestsInMonth]) => ({
      key: monthKey,
      label: new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }),
      guests: Array.from(guestsInMonth.values())
        .map((group) => ({
          ...group,
          bookings: group.bookings.sort((left, right) =>
            left.checkIn.localeCompare(right.checkIn) || right.createdAt.localeCompare(left.createdAt)),
        }))
        .sort((left, right) => left.bookings[0].checkIn.localeCompare(right.bookings[0].checkIn)),
    })).sort((left, right) => left.key.localeCompare(right.key))
  }, [bookings])
  const visibleMonthGroups = monthGroups.map((month) => ({
    ...month,
    guests: month.guests.filter(({ bookings: guestBookings }) => guestBookings.some((booking) => {
      const matchesQuery = `${booking.guest} ${booking.id} ${booking.room}`.toLowerCase().includes(query.trim().toLowerCase())
      const matchesStatus = statusFilter === 'All statuses' || booking.status === statusFilter
      return matchesQuery && matchesStatus
    })),
  })).filter((month) => month.guests.length > 0)
  const visibleGuestGroups = visibleMonthGroups.flatMap((month) => month.guests)
  const visibleBookingCount = visibleGuestGroups.reduce((total, group) => total + group.bookings.length, 0)
  const toggleGuest = (guestKey: string) => {
    setExpandedGuestKeys((current) => {
      const next = new Set(current)
      if (next.has(guestKey)) next.delete(guestKey)
      else next.add(guestKey)
      return next
    })
  }

    return <>
    <div className="page-heading"><div><p className="eyebrow">Hometel</p><h1>Bookings</h1><p className="subtitle">Manage reservations, guests, and stay details.</p></div><button className="button button-primary"><CalendarDays size={17} /> New booking</button></div>
    <section className="card bookings-card">
      <div className="filter-bar">
        <div className="search-box"><Search size={17} /><input placeholder="Search by guest, booking ID, or room..." value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <label className="select-wrap filter-select"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All statuses</option><option>Confirmed</option><option>Pending</option><option>Checked in</option><option>Completed</option><option>Cancelled</option></select><ChevronDown size={14} /></label>
      </div>
      <div className="table-toolbar"><span><strong>{visibleBookingCount}</strong> bookings · <strong>{visibleGuestGroups.length}</strong> guest accounts</span><button className="icon-button"><Ellipsis size={18} /></button></div>
      <div className="booking-account-list">
        {visibleMonthGroups.map((month) => <section className="booking-month-group" key={month.key}>
          <h2 className="booking-month-heading">{month.label}</h2>
          <div className="booking-month-guests">{month.guests.map(({ key, guest, bookings: guestBookings }) => {
            const expanded = expandedGuestKeys.has(key)
            const checkInDay = String(Number(guestBookings[0].checkIn.slice(8, 10)))
            return <section className="booking-account-group" key={key}>
              <button className="booking-account-summary" aria-expanded={expanded} onClick={() => toggleGuest(key)}>
                <span className={`booking-account-chevron ${expanded ? 'is-expanded' : ''}`}><ChevronDown size={16} /></span>
                <span className="booking-account-day" aria-label={`Check-in day ${checkInDay}`}>{checkInDay}</span>
                <span className="booking-account-person"><strong>{guest.guest}</strong><small>{guest.email || guest.phone || guest.guestId}</small></span>
                <span className="booking-account-count"><strong>{guestBookings.length}</strong><small>{guestBookings.length === 1 ? 'booking' : 'bookings'}</small></span>
              </button>
              {expanded && <div className="booking-account-details"><BookingTable bookings={guestBookings} onSelect={onSelect} hideGuest /></div>}
            </section>
          })}</div>
        </section>)}
        {visibleGuestGroups.length === 0 && <div className="empty-state"><Search size={25} /><strong>No bookings found</strong><span>Try adjusting your search or filters.</span></div>}
      </div>
    </section>
  </>
}

function BookingTable({ bookings, onSelect, compact = false, hideGuest = false }: { bookings: Booking[]; onSelect: (b: Booking) => void; compact?: boolean; hideGuest?: boolean }) {
  return <div className={`table-scroll ${compact ? 'table-compact' : ''}`}><table><thead><tr>{!hideGuest && <th>Guest</th>}<th>Room</th><th>Stay dates</th><th>Guests</th><th>Total</th><th>Status</th><th>Payment</th><th /></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id} onClick={() => onSelect(booking)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onSelect(booking)}>{!hideGuest && <td><div className="guest-cell"><div className="avatar" style={{ background: booking.color }}>{booking.initials}</div><div><strong>{booking.guest}</strong><span>{booking.id}</span></div></div></td>}<td>{booking.room}</td><td><div className="booking-stay-dates"><span><small>Check-in</small>{formatDate(booking.checkIn)}</span><span><small>Check-out</small>{formatDate(booking.checkOut)}</span></div></td><td>{booking.guests}</td><td><strong>{formatCurrency(booking.amount)}</strong><span className="table-subtext">{formatCurrency(booking.paid)} paid</span></td><td><StatusBadge kind={statusKind(booking.status)}>{booking.status}</StatusBadge></td><td><StatusBadge kind={statusKind(booking.payment)}>{booking.payment}</StatusBadge></td><td><button className="row-more" aria-label={`Actions for ${booking.guest}`} onClick={(e) => { e.stopPropagation(); onSelect(booking) }}><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table>{bookings.length === 0 && <div className="empty-state"><Search size={25} /><strong>No bookings found</strong><span>Try adjusting your search or filters.</span></div>}</div>
}

function BookingDrawer({ booking, onClose, onStatusChange, onAddPayment, paymentError, paymentSaving }: {
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

function GuestsPage({ guests, bookings, query, setQuery, onAssign, onChangeRoom, onDeleteGuest, deleteSavingId, deleteError }: {
  guests: Guest[]
  bookings: Booking[]
  query: string
  setQuery: (value: string) => void
  onAssign: (guest: Guest) => void
  onChangeRoom: (guest: Guest) => void
  onDeleteGuest: (guest: Guest) => Promise<boolean>
  deleteSavingId: string | null
  deleteError: string
}) {
  const [guestToDelete, setGuestToDelete] = useState<Guest | null>(null)
  const filteredGuests = guests.filter((guest) => `${guest.full_name} ${guest.email ?? ''} ${guest.phone ?? ''}`.toLowerCase().includes(query.toLowerCase()))

  const today = toDateKey(new Date())
  const guestBookings = guestToDelete ? bookings.filter((booking) => booking.guestId === guestToDelete.id) : []
  const guestPaymentCount = guestBookings.reduce((count, booking) => count + booking.payments.length, 0)
  const confirmDelete = async () => {
    if (guestToDelete && await onDeleteGuest(guestToDelete)) setGuestToDelete(null)
  }

  return <>
    <div className="page-heading"><div><p className="eyebrow">Hometel</p><h1>Guests</h1><p className="subtitle">Review customer details and stay history.</p></div><button className="button button-primary"><Users size={17} /> Add guest</button></div>
    <section className="card bookings-card">
      <div className="filter-bar"><div className="search-box"><Search size={17} /><input placeholder="Search guests or email..." value={query} onChange={(e) => setQuery(e.target.value)} /></div></div>
      <div className="table-toolbar"><span><strong>{filteredGuests.length}</strong> guests</span></div>
      <div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{filteredGuests.map((guest) => {
        const hasActiveBooking = bookings.some((booking) => booking.guestId === guest.id && booking.status !== 'Cancelled' && booking.status !== 'Completed' && booking.checkOut > today)
        const deleting = deleteSavingId === guest.id
        return <tr key={guest.id}>
          <td><div className="guest-cell"><div className="avatar" style={{ background: '#e5d0b9' }}>{guest.full_name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><div><strong>{guest.full_name}</strong><span>{guest.id}</span></div></div></td>
          <td>{guest.email ?? '—'}</td>
          <td>{guest.phone ?? '—'}</td>
          <td>{new Date(guest.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
          <td><div className="guest-room-actions">
            <button className="button button-secondary guest-assign-button" onClick={() => onAssign(guest)}><BedDouble size={14} /> Assign room</button>
            {hasActiveBooking && <button className="button button-secondary guest-assign-button" onClick={() => onChangeRoom(guest)}><DoorOpen size={14} /> Change room</button>}
            <button className="button button-secondary guest-delete-button" onClick={() => setGuestToDelete(guest)} disabled={Boolean(deleteSavingId)} aria-label={`Delete ${guest.full_name}`}><Trash2 size={14} /> Delete guest</button>
            {deleting && <span className="guest-delete-progress">Deleting…</span>}
          </div></td>
        </tr>
      })}</tbody></table>
      {filteredGuests.length === 0 && <div className="empty-state"><Users size={25} /><strong>No guests found</strong><span>Try adjusting your search or add a guest record.</span></div>}
      </div>
    </section>
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

function GuestAssignmentDialog({ guest, rooms, bookings, error, saving, onClose, onAssign }: {
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

function RoomChangeDialog({ guest, rooms, bookings, setupError, error, saving, onClose, onChangeRoom }: {
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

function PaymentsPage({ bookings, roomChanges, query, setQuery, statusFilter, setStatusFilter, onMarkCreditReturned, onReturnOverpayment, creditReturnSavingId, creditStatusError }: {
  bookings: Booking[]
  roomChanges: RoomChangeRecord[]
  query: string
  setQuery: (value: string) => void
  statusFilter: string
  setStatusFilter: (value: string) => void
  onMarkCreditReturned: (changeId: string) => Promise<boolean>
  onReturnOverpayment: (booking: Booking) => Promise<boolean>
  creditReturnSavingId: string | null
  creditStatusError: string
}) {
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null)
  const [overpaymentGuestId, setOverpaymentGuestId] = useState<string | null>(null)
  const [invoiceSendingId, setInvoiceSendingId] = useState<string | null>(null)
  const [invoiceFeedback, setInvoiceFeedback] = useState<{ bookingId: string; message: string; isError: boolean } | null>(null)
  const methodLabel = (method: string) => method.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
  const typeLabel = (type: string) => type.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
  const sendInvoice = async (selectedBookings: Booking[], guestKey: string) => {
    const bookingIds = selectedBookings.map((booking) => booking.id)
    setInvoiceSendingId(guestKey)
    setInvoiceFeedback(null)
    try {
      const { error } = await supabase.functions.invoke('send-booking-invoice', {
        body: { bookingIds },
      })

      if (error) {
        console.error('Unable to send booking invoice:', error)
        setInvoiceFeedback({ bookingId: guestKey, message: 'Invoice could not be sent. Check the email function and Resend configuration.', isError: true })
        return
      }

      setInvoiceFeedback({ bookingId: guestKey, message: `Invoice${selectedBookings.length === 1 ? '' : 's'} covering ${selectedBookings.length} booking${selectedBookings.length === 1 ? '' : 's'} sent to ${selectedBookings[0].email}.`, isError: false })
    } catch (error) {
      console.error('Unable to send booking invoice:', error)
      setInvoiceFeedback({ bookingId: guestKey, message: 'Invoice could not be sent. Check your connection and try again.', isError: true })
    } finally {
      setInvoiceSendingId(null)
    }
  }
  const payments: PaymentTransaction[] = [
    ...bookings.flatMap((booking) => booking.payments.map((payment, index) => ({
      ...payment,
      booking,
      id: `${booking.id}-${payment.paidAt ?? 'payment'}-${index}`,
      occurredAt: payment.paidAt,
      transaction: typeLabel(payment.type),
      transactionStatus: booking.payment,
      displayAmount: payment.status.toLowerCase() === 'paid' ? payment.amount : 0,
      isCreditReturn: false,
      isStatusOnly: false,
    }))),
    ...bookings
      .filter((booking) => booking.payments.length === 0)
      .map((booking) => ({
        booking,
        id: `${booking.id}-no-payment`,
        amount: 0,
        displayAmount: 0,
        paidAt: null,
        occurredAt: null,
        method: '—',
        type: 'booking_status',
        transaction: 'No payment recorded',
        transactionStatus: booking.payment,
        isCreditReturn: false,
        isStatusOnly: true,
      })),
    ...roomChanges
      .filter((change) => change.credit_amount > 0)
      .flatMap((change) => {
        const booking = bookings.find((item) => item.id === change.booking_id)
        return booking ? [{
          booking,
          id: change.id,
          amount: change.credit_amount,
          displayAmount: change.credit_returned ? -change.credit_amount : 0,
          paidAt: change.credit_returned_at,
          occurredAt: change.credit_returned_at ?? change.created_at,
          method: '—',
          type: 'credit_return',
          status: change.credit_returned ? 'returned' : 'due',
          transaction: change.credit_returned ? 'Refund returned' : 'Refund due',
          transactionStatus: change.credit_returned ? 'Returned' : 'Refund due',
          isCreditReturn: true,
          isStatusOnly: false,
        }] : []
      }),
  ]
  const filteredPayments = payments.filter((payment) => {
    const matchesQuery = `${payment.booking.guest} ${payment.booking.id} ${payment.booking.room} ${payment.method} ${payment.type}`
      .toLowerCase()
      .includes(query.toLowerCase())
    return matchesQuery
  })
  const guestGroups = Array.from(filteredPayments.reduce((groups, payment) => {
    const email = payment.booking.email.trim().toLowerCase()
    const phone = payment.booking.phone.replace(/\D/g, '')
    const personKey = email
      ? `email:${email}`
      : phone
        ? `phone:${phone}`
        : `guest:${payment.booking.guestId}`
    const current = groups.get(personKey) ?? { key: personKey, guest: payment.booking, transactions: [] as PaymentTransaction[] }
    current.transactions.push(payment)
    groups.set(personKey, current)
    return groups
  }, new Map<string, { key: string; guest: Booking; transactions: PaymentTransaction[] }>()).values())
  guestGroups.forEach((group) => group.transactions.sort((left, right) => {
    const leftTime = left.occurredAt ? new Date(left.occurredAt).getTime() : 0
    const rightTime = right.occurredAt ? new Date(right.occurredAt).getTime() : 0
    return leftTime - rightTime
  }))
  const getGuestPaymentStatus = (transactions: PaymentTransaction[]): PaymentStatus | 'Returned' | 'Refund due' | 'Mixed' => {
    const bookingStatuses = new Set(transactions.map((transaction) => transaction.booking.payment))
    if (bookingStatuses.size > 1) return 'Mixed'
    if (transactions.every((transaction) => transaction.isCreditReturn)) {
      return transactions.every((transaction) => transaction.transactionStatus === 'Returned') ? 'Returned' : 'Refund due'
    }
    return bookingStatuses.values().next().value ?? 'Unpaid'
  }
  const visibleGuestGroups = guestGroups.filter(({ transactions }) => {
    const guestStatus = getGuestPaymentStatus(transactions)
    return statusFilter === 'All statuses' ||
      guestStatus === statusFilter ||
      (statusFilter === 'Refund due' && transactions.some((transaction) => transaction.transactionStatus === 'Refund due')) ||
      (statusFilter === 'Returned' && transactions.some((transaction) => transaction.transactionStatus === 'Returned'))
  })
  const selectedGuest = guestGroups.find((group) => group.key === selectedGuestId)
  const selectedBookingGroups = selectedGuest
    ? Array.from(selectedGuest.transactions.reduce((groups, transaction) => {
      const bookingId = transaction.booking.id
      const group = groups.get(bookingId) ?? { booking: transaction.booking, transactions: [] }
      group.transactions.push(transaction)
      groups.set(bookingId, group)
      return groups
    }, new Map<string, { booking: Booking; transactions: PaymentTransaction[] }>()).values())
      .sort((left, right) => right.booking.createdAt.localeCompare(left.booking.createdAt))
    : []
  const overpaymentGuest = guestGroups.find((group) => group.key === overpaymentGuestId)
  const overpaymentBookings = overpaymentGuest
    ? Array.from(new Map(overpaymentGuest.transactions
      .filter((transaction) => !transaction.isCreditReturn && transaction.booking.payment === 'Overpaid')
      .map((transaction) => [transaction.booking.id, transaction.booking])).values())
    : []
  const formatTransactionDateTime = (value: string | null) => {
    if (!value) return 'Date unavailable'
    const date = new Date(value)
    return Number.isNaN(date.getTime())
      ? 'Date unavailable'
      : date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  }
  const submitOverpaymentReturn = async (booking: Booking) => {
    const returned = await onReturnOverpayment(booking)
    if (returned) setOverpaymentGuestId(null)
  }
  const visibleTransactions = visibleGuestGroups.flatMap((group) => group.transactions)
  const netReceived = visibleTransactions.reduce((sum, payment) => sum + payment.displayAmount, 0)

  return <>
    <div className="page-heading">
      <div><p className="eyebrow">Hometel</p><h1>Payments</h1><p className="subtitle">Review payment transactions recorded against bookings.</p></div>
    </div>
    <section className="card bookings-card">
      <div className="filter-bar">
        <div className="search-box"><Search size={17} /><input placeholder="Search guest, booking, method..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <label className="select-wrap filter-select"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Paid</option><option>Partial</option><option>Unpaid</option><option>Overpaid</option><option>Refund due</option><option>Returned</option><option>Mixed</option></select><ChevronDown size={14} /></label>
      </div>
      <div className="table-toolbar"><span><strong>{visibleGuestGroups.length}</strong> guests · {visibleTransactions.filter((payment) => !payment.isStatusOnly).length} transactions</span><span>{formatCurrency(netReceived)} net received</span></div>
      {creditStatusError && <p className="payment-error" role="alert">{creditStatusError}</p>}
      <div className="table-scroll">
        <table><thead><tr><th>Guest</th><th>Bookings</th><th>Transactions</th><th>Net received</th><th>Payment status</th><th /></tr></thead>
          <tbody>{visibleGuestGroups.map(({ key, guest, transactions }) => {
            const bookingsById = new Map(transactions.map((transaction) => [transaction.booking.id, transaction.booking]))
            const bookingRecords = Array.from(bookingsById.values())
            const bookingIds = new Set(bookingRecords.map((booking) => booking.id))
            const guestNet = transactions.reduce((sum, transaction) => sum + transaction.displayAmount, 0)
            const paymentStatus = getGuestPaymentStatus(transactions)
            const bookingStatusCounts = bookingRecords.reduce((counts, booking) => {
              counts.set(booking.payment, (counts.get(booking.payment) ?? 0) + 1)
              return counts
            }, new Map<PaymentStatus, number>())
            return <tr key={key}>
              <td><div className="guest-cell"><div className="avatar" style={{ background: guest.color }}>{guest.initials}</div><div><strong>{guest.guest}</strong><span>{guest.email || guest.phone || guest.guestId}</span></div></div></td>
              <td>{bookingIds.size}</td><td>{transactions.filter((transaction) => !transaction.isStatusOnly).length}</td>
              <td><strong className={guestNet < 0 ? 'credit-amount' : undefined}>{formatCurrency(guestNet)}</strong></td>
              <td><StatusBadge kind={paymentStatus === 'Returned' ? 'warning' : statusKind(paymentStatus)}>{paymentStatus}</StatusBadge>
                {paymentStatus === 'Mixed' && <span className="payment-status-summary">{Array.from(bookingStatusCounts, ([status, count]) => `${count} ${status.toLowerCase()}`).join(' · ')}</span>}
              </td>
              <td><div className="payment-row-actions">
                <button className="button button-secondary payment-view-button" onClick={() => setSelectedGuestId(key)}>View transactions</button>
                {transactions.filter((transaction) => transaction.isCreditReturn && transaction.transactionStatus === 'Refund due').map((transaction) => <button className="button button-secondary payment-view-button refund-due-action" key={transaction.id} disabled={Boolean(creditReturnSavingId)} title={`Mark ${formatCurrency(transaction.amount)} refund returned for ${transaction.booking.room}`} onClick={() => onMarkCreditReturned(transaction.id)}>{creditReturnSavingId === transaction.id ? 'Updating…' : `Mark ${formatCurrency(transaction.amount)} refunded`}</button>)}
                {transactions.some((transaction) => !transaction.isCreditReturn && transaction.booking.payment === 'Overpaid') && <button className="button button-secondary payment-view-button" onClick={() => setOverpaymentGuestId(key)}>Return overpayment</button>}
              </div></td>
            </tr>
          })}</tbody>
        </table>
        {visibleGuestGroups.length === 0 && <div className="empty-state"><CircleDollarSign size={25} /><strong>{bookings.length === 0 ? 'No bookings found' : 'No payments match these filters'}</strong><span>{bookings.length === 0 ? 'Bookings and their payment records will appear here.' : 'Try another search or status filter.'}</span></div>}
      </div>
    </section>
    {selectedGuest && <div className="assignment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedGuestId(null) }}>
      <section className="payment-transactions-dialog card" role="dialog" aria-modal="true" aria-labelledby="guest-transactions-title">
        <header className="assignment-header">
          <div><p className="eyebrow">Guest transactions</p><h2 id="guest-transactions-title">{selectedGuest.guest.guest}</h2><p className="subtitle">{selectedBookingGroups.length} booking(s) · {selectedGuest.transactions.filter((transaction) => !transaction.isStatusOnly).length} transactions</p></div>
          <button className="icon-button" onClick={() => setSelectedGuestId(null)} aria-label="Close transactions"><X size={19} /></button>
        </header>
        <div className="payment-transactions-list">
          {selectedBookingGroups.map(({ booking, transactions }) => <section className="payment-booking-group" key={booking.id}>
            <header className="payment-booking-group-header">
              <div><strong>{booking.room}</strong><span>{booking.dates} · Booking {booking.id}</span></div>
              <StatusBadge kind={statusKind(booking.payment)}>{booking.payment}</StatusBadge>
              <div className="payment-booking-totals"><span>{formatCurrency(booking.paid)} paid</span><strong>of {formatCurrency(booking.amount)}</strong></div>
            </header>
            <div className="payment-booking-transactions">
              {transactions.map((transaction) => <article className="payment-transaction-item" key={transaction.id}>
                <div className="payment-transaction-heading"><div><strong>{transaction.transaction}</strong></div>{!transaction.isStatusOnly && <strong className={transaction.isCreditReturn ? 'credit-amount' : undefined}>{transaction.isCreditReturn ? '−' : ''}{formatCurrency(transaction.amount)}</strong>}</div>
                <div className="payment-transaction-meta"><span>{transaction.isStatusOnly ? 'No transaction available' : transaction.isCreditReturn ? transaction.transaction : methodLabel(transaction.method)}</span><span>{transaction.isCreditReturn && transaction.transactionStatus === 'Refund due' ? 'Not returned yet' : formatTransactionDateTime(transaction.occurredAt)}</span><StatusBadge kind={transaction.isCreditReturn ? 'warning' : statusKind(transaction.booking.payment)}>{transaction.transactionStatus}</StatusBadge></div>
              </article>)}
            </div>
          </section>)}
        </div>
        <footer className="assignment-actions payment-invoice-footer">
          <button className="button button-primary" onClick={() => void sendInvoice(selectedBookingGroups.map(({ booking }) => booking), selectedGuest.key)} disabled={!selectedGuest.guest.email.trim() || Boolean(invoiceSendingId)}>
            <Mail size={15} />{invoiceSendingId === selectedGuest.key ? 'Sending…' : 'Email invoice'}
          </button>
        </footer>
        {selectedBookingGroups.some(({ booking }) => !booking.email.trim()) && <p className="payment-error" role="status">Invoices are disabled for bookings without a guest email on file.</p>}
        {invoiceFeedback?.bookingId === selectedGuest.key && <p className={invoiceFeedback.isError ? 'payment-error' : 'payment-success'} role={invoiceFeedback.isError ? 'alert' : 'status'}>{invoiceFeedback.message}</p>}
      </section>
    </div>}
    {overpaymentGuest && <div className="assignment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !creditReturnSavingId) setOverpaymentGuestId(null) }}>
      <section className="payment-transactions-dialog card" role="dialog" aria-modal="true" aria-labelledby="return-overpayment-title">
        <header className="assignment-header">
          <div><p className="eyebrow">Overpayment return</p><h2 id="return-overpayment-title">{overpaymentGuest.guest.guest}</h2><p className="subtitle">Confirm the excess amount to return for the selected booking.</p></div>
          <button className="icon-button" onClick={() => setOverpaymentGuestId(null)} aria-label="Close overpayment return" disabled={Boolean(creditReturnSavingId)}><X size={19} /></button>
        </header>
        <div className="payment-transactions-list">
          {overpaymentBookings.map((booking) => <article className="payment-transaction-item" key={booking.id}>
            <div className="payment-transaction-heading"><div><strong>{booking.room}</strong><span>{booking.id} · Total {formatCurrency(booking.amount)}</span></div><strong className="credit-amount">{formatCurrency(booking.paid - booking.amount)}</strong></div>
            <div className="payment-transaction-meta"><span>{formatCurrency(booking.paid)} paid</span><span>Excess to return</span><StatusBadge kind="warning">Overpaid</StatusBadge></div>
          </article>)}
          {overpaymentBookings.length === 0 && <div className="empty-state"><strong>No overpayment remains</strong><span>Refresh the payment records and check the current booking balance.</span></div>}
        </div>
        {creditStatusError && <p className="payment-error" role="alert">{creditStatusError}</p>}
        {overpaymentBookings.length > 0 && <footer className="assignment-actions">
          {overpaymentBookings.map((booking) => <button className="button button-primary credit-return-button" key={booking.id} disabled={Boolean(creditReturnSavingId)} onClick={() => submitOverpaymentReturn(booking)}>{creditReturnSavingId === booking.id ? 'Returning…' : `Confirm return ${formatCurrency(booking.paid - booking.amount)}`}</button>)}
        </footer>}
      </section>
    </div>}
  </>
}

function RoomsPage({ rooms, bookings, occupiedRoomIds, dataLoading, query, setQuery, onSetStatus, updatingRoomId, error }: { rooms: Room[]; bookings: Booking[]; occupiedRoomIds: Set<number>; dataLoading: boolean; query: string; setQuery: (value: string) => void; onSetStatus: (room: Room, status: Room['status']) => void; updatingRoomId: string | null; error: string }) {
  const todayKey = toDateKey(new Date())
  const getCurrentBooking = (room: Room) => bookings.find((booking) =>
    booking.roomId === Number(room.id) &&
    (booking.status === 'Confirmed' || booking.status === 'Checked in') &&
    booking.checkIn <= todayKey &&
    booking.checkOut > todayKey,
  )
  const filteredRooms = rooms
    .filter((room) => `${room.id} ${room.name} ${getCurrentBooking(room)?.guest ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    .sort((left, right) => {
      const leftOccupied = occupiedRoomIds.has(Number(left.id))
      const rightOccupied = occupiedRoomIds.has(Number(right.id))
      return Number(leftOccupied) - Number(rightOccupied) || left.name.localeCompare(right.name)
    })
  const occupied = rooms.filter((room) => room.isActive && occupiedRoomIds.has(Number(room.id))).length
  const vacant = rooms.filter((room) => room.isActive && !occupiedRoomIds.has(Number(room.id))).length

  return <><div className="page-heading"><div><p className="eyebrow">Hometel</p><h1>Rooms</h1><p className="subtitle">Check room occupancy details.</p></div></div><div className="room-summary room-summary-two"><div><span className="summary-dot occupied-dot" /><strong>{dataLoading ? '—' : occupied}</strong><span>Occupied</span></div><div><span className="summary-dot available-dot" /><strong>{dataLoading ? '—' : vacant}</strong><span>Vacant</span></div></div><section className="card rooms-card"><div className="filter-bar"><div className="search-box"><Search size={17} /><input placeholder="Search rooms or guests..." value={query} onChange={(e) => setQuery(e.target.value)} /></div><button className="filter-button"><FileText size={16} /> Filter status <ChevronDown size={14} /></button></div>{error && <div className="room-status-error" role="alert">{error}</div>}<div className="room-grid">{filteredRooms.map((room) => { const currentBooking = getCurrentBooking(room); const isOccupied = occupiedRoomIds.has(Number(room.id)); const status = dataLoading ? 'checking' : isOccupied ? 'occupied' : 'vacant'; const isUpdating = updatingRoomId === room.id; return <article className={`room-tile ${isOccupied ? 'room-tile-occupied' : ''}`} key={room.id}><div className="room-image"><BedDouble size={28} /><span className={`room-status status-${status}`}>{status}</span><button className="room-menu" aria-label={`More actions for room ${room.id}`} disabled={dataLoading}><MoreHorizontal size={17} /></button></div><div className="room-tile-body"><div className="room-title"><div><span className="room-number">Room {room.id}</span><h2>{room.name}</h2></div><span className="room-type">{room.type}</span></div><div className="room-meta"><span><Users size={13} /> Up to {room.capacity}</span><strong>{formatCurrency(room.rate)} <small>/ night</small></strong></div>{currentBooking ? <div className="current-guest"><div className="avatar avatar-small">{currentBooking.initials}</div><span><small>Current guest</small>{currentBooking.guest}</span></div> : <div className="room-available"><Check size={14} /> {dataLoading ? 'Checking reservations…' : status === 'vacant' ? 'Vacant' : 'Occupied'}</div>}<div className="room-actions"><button className="button button-secondary" disabled={dataLoading || isUpdating || Boolean(currentBooking)} title={currentBooking ? 'A current booking keeps this room occupied.' : dataLoading ? 'Checking current bookings.' : undefined} onClick={() => onSetStatus(room, isOccupied ? 'vacant' : 'occupied')}>{dataLoading ? 'Checking bookings…' : isUpdating ? 'Saving…' : currentBooking ? 'Occupied by booking' : isOccupied ? 'Set vacant' : 'Set occupied'}</button></div></div></article> })}</div>{filteredRooms.length === 0 && <div className="empty-state"><BedDouble size={25} /><strong>No rooms found</strong><span>Try a different room number or guest name.</span></div>}</section></>
}

function PlaceholderPage({ title, onBack }: { title: string; onBack: () => void }) {
  return <div className="placeholder-page"><div className="placeholder-icon"><CircleDollarSign size={25} /></div><p className="eyebrow">Hometel workspace</p><h1>{title}</h1><p className="subtitle">This module is ready for your property data. Use Overview to see today’s operations.</p><button className="button button-secondary" onClick={onBack}>Back to overview</button></div>
}

function ToursWorkspacePage({ title }: { title: string }) {
  const descriptions: Record<string, string> = {
    Overview: 'Tour activity and performance will appear here.',
    Bookings: 'Tour reservations will appear here.',
    Payments: 'Payments for tour reservations will appear here.',
  }

  return <div className="page-content-inner">
    <div className="page-heading">
      <div><p className="eyebrow">Tours workspace</p><h1>{title}</h1><p className="subtitle">{descriptions[title] ?? `${title} for Tours.`}</p></div>
    </div>
    <section className="card tour-empty-card">
      <div className="placeholder-icon"><Plane size={25} /></div>
      <h2>Tours data is not connected yet</h2>
      <p>Hometel rooms, bookings, and payments are kept separate and won’t be shown in Tours. Add tour-specific tables to Supabase to display tour data here.</p>
    </section>
  </div>
}

export default App
