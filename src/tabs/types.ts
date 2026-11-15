export type BookingStatus = 'Confirmed' | 'Pending' | 'Checked in' | 'Completed' | 'Cancelled'
export type PaymentStatus = 'Paid' | 'Partial' | 'Unpaid' | 'Overpaid'
export type AirportTransferVehicleType = 'van' | 'tricycle'

export type Booking = {
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
  invoiceSentAt?: string | null
  payments: { id?: string; amount: number; paidAt: string | null; method: string; type: string; status: string }[]
  status: BookingStatus
  payment: PaymentStatus
  color: string
  email: string
  phone: string
  request: string
  specialRequestNoted: boolean
  airportTransferVehicleType: AirportTransferVehicleType | null
  airportTransferPrice: number
}

export type Room = {
  id: string
  roomNumber: string
  name: string
  type: string
  status: 'occupied' | 'vacant'
  isActive: boolean
  isUnderMaintenance: boolean
  maintenanceNote: string
  guest: string
  rate: number
  capacity: number
  notes: string
}

export type Guest = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  created_at: string
}

export type SupabaseBooking = {
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
  invoice_sent_at?: string | null
  special_requests: string | null
  special_requests_noted?: boolean | null
  airport_transfer_vehicle_type?: AirportTransferVehicleType | null
  airport_transfer_price?: number | string | null
  guests: { full_name: string; email: string | null; phone: string | null } | null
  rooms: { room_name: string; room_number: string | null } | null
  payments: { id?: string; amount: number | string; payment_status: string | null; paid_at: string | null; payment_method: string | null; payment_type: string | null }[] | null
  booking_room_changes: { credit_amount: number | string; credit_returned: boolean | null }[] | null
}

export type SupabaseRoom = {
  id: number
  room_name: string | null
  room_number: string | null
  room_type: string | null
  room_price: number | string | null
  max_guests: number | null
  base_guests: number | null
  is_active: boolean | null
  occupancy_status: 'occupied' | 'vacant' | null
  maintenance_status: boolean | null
  maintenance_note: string | null
  description: string | null
}

export type RoomEditValues = {
  name: string
  type: string
  rate: string
  capacity: string
  notes: string
}

export type MetricDetail = {
  booking?: Booking
  room?: Room
  detail: string
  amount?: number
  statusOverride?: string
}

export type MetricPopup = {
  title: string
  description: string
  entries: MetricDetail[]
}

export type DashboardNotification = {
  id: string
  title: string
  detail: string
  createdAt: string
  category: 'booking' | 'payment'
  relatedId: string
  read: boolean
}

export type GuestAssignment = {
  roomId: number
  checkIn: string
  checkOut: string
  guestCount: number
  specialRequests?: string
  specialRequestNoted?: boolean
}

export type NewBookingValues = {
  fullName: string
  email: string
  phone: string
  roomId: number
  checkIn: string
  checkOut: string
  guestCount: number
  specialRequests: string
  status: 'pending' | 'confirmed'
  airportTransferVehicleType: AirportTransferVehicleType | null
  airportTransferPrice: number
}

export type RoomChangeRecord = {
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

export type PaymentTransaction = {
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
