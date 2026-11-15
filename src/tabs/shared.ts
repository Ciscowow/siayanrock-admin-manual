import { BedDouble, CalendarDays, CircleDollarSign, Home, Plane, Tags, Users } from 'lucide-react'
import type { Booking, Room, SupabaseRoom } from './types'

export const hasSpecialRequest = (booking: Booking) => {
  const request = booking.request.trim()
  return request.length > 0 && request.toLowerCase() !== 'no special requests.'
}

export const mapSupabaseRoom = (record: SupabaseRoom): Room => ({
  id: String(record.id),
  roomNumber: record.room_number?.trim() || String(record.id),
  name: record.room_name ?? `Room ${record.room_number ?? record.id}`,
  type: record.room_type ?? 'Standard',
  status: record.occupancy_status === 'occupied' ? 'occupied' : 'vacant',
  isActive: record.is_active !== false,
  isUnderMaintenance: record.maintenance_status === true,
  maintenanceNote: record.maintenance_note ?? '',
  guest: '',
  rate: Number(record.room_price ?? 0),
  capacity: Number(record.max_guests ?? record.base_guests ?? 2),
  notes: record.description ?? '',
})

export const hometelItems = [
  { label: 'Overview', icon: Home, count: undefined },
  { label: 'Bookings', icon: CalendarDays, count: undefined },
  { label: 'Rooms', icon: BedDouble, count: undefined },
  { label: 'Rates', icon: Tags, count: undefined },
  { label: 'Guests', icon: Users, count: undefined },
  { label: 'Payments', icon: CircleDollarSign, count: undefined },
]

export const tourItems = [
  { label: 'Overview', icon: Plane, count: undefined },
  { label: 'Bookings', icon: CalendarDays, count: undefined },
  { label: 'Payments', icon: CircleDollarSign, count: undefined },
]

export function formatCurrency(value: number) {
  return `₱${value.toLocaleString('en-PH')}`
}

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function formatDate(value: string | null) {
  if (!value) return 'Date unavailable'
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(value: string | null) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function statusKind(status: string) {
  return status === 'Confirmed' || status === 'Paid' ? 'success' : status === 'Pending' || status === 'Partial' || status === 'Overpaid' || status === 'Refund due' ? 'warning' : status === 'Checked in' ? 'info' : status === 'Unpaid' || status === 'Cancelled' ? 'danger' : 'neutral'
}
