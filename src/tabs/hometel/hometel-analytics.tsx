import { useMemo, useState } from 'react'
import { BedDouble, CalendarDays, CircleDollarSign, PackageCheck, Tags, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, toDateKey } from '../shared'
import type { Booking } from '../types'
import './css/hometel-analytics.css'

type AnalyticsRange = 'Last 30 days' | 'Last 12 months'
type RevenuePoint = {
  key: string
  label: string
  roomRevenue: number
  tourPackageRevenue: number
  tourPromoRevenue: number
  transferRevenue: number
}
type BookingAnalytics = {
  bookings: Booking[]
  revenue: { room: number; tourPackage: number; tourPromo: number; transfer: number; total: number }
  roomNights: number
  packageBookings: Booking[]
  promoBookings: Booking[]
  transferBookings: Booking[]
  revenueByPeriod: RevenuePoint[]
  rooms: { id: string; name: string; revenue: number; bookings: number; nights: number }[]
}

const includedStatuses = new Set(['Confirmed', 'Checked in', 'Completed'])

function stayNights(booking: Booking) {
  const checkIn = new Date(`${booking.checkIn.slice(0, 10)}T00:00:00`)
  const checkOut = new Date(`${booking.checkOut.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) return 0
  return Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000))
}

function roomRevenue(booking: Booking) {
  return Math.max(0, booking.amount -
    (booking.tourPromoPrice ?? 0) -
    (booking.tourPackagePrice ?? 0) -
    booking.airportTransferPrice)
}

function uniqueGuestCount(bookings: Booking[]) {
  return new Set(bookings.map((booking) => booking.guestId).filter(Boolean)).size
}

function getRangeStart(range: AnalyticsRange, today: Date) {
  if (range === 'Last 12 months') return new Date(today.getFullYear(), today.getMonth() - 11, 1)
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)
}

function buildPeriods(range: AnalyticsRange, today: Date): RevenuePoint[] {
  const start = getRangeStart(range, today)
  const periodCount = range === 'Last 12 months' ? 12 : 30
  return Array.from({ length: periodCount }, (_, index) => {
    const date = range === 'Last 12 months'
      ? new Date(start.getFullYear(), start.getMonth() + index, 1)
      : new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    const key = range === 'Last 12 months'
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      : toDateKey(date)
    const label = range === 'Last 12 months'
      ? date.toLocaleDateString('en-PH', { month: 'short', year: '2-digit' })
      : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    return { key, label, roomRevenue: 0, tourPackageRevenue: 0, tourPromoRevenue: 0, transferRevenue: 0 }
  })
}

function getAnalytics(bookings: Booking[], range: AnalyticsRange): BookingAnalytics {
  const today = new Date()
  const todayKey = toDateKey(today)
  const startKey = toDateKey(getRangeStart(range, today))
  const inRange = bookings.filter((booking) => {
    const checkIn = booking.checkIn.slice(0, 10)
    return includedStatuses.has(booking.status) && checkIn >= startKey && checkIn <= todayKey
  })
  const packageBookings = inRange.filter((booking) => booking.tourPackagePrice != null)
  const promoBookings = inRange.filter((booking) => booking.tourPromoId != null || booking.tourPromoPrice != null)
  const transferBookings = inRange.filter((booking) => booking.airportTransferPrice > 0 || booking.airportTransferVehicleType != null)
  const periods = buildPeriods(range, today)
  const periodIndex = new Map(periods.map((point, index) => [point.key, index]))
  const roomMap = new Map<string, { id: string; name: string; revenue: number; bookings: number; nights: number }>()
  const revenue = { room: 0, tourPackage: 0, tourPromo: 0, transfer: 0, total: 0 }
  let roomNights = 0

  inRange.forEach((booking) => {
    const checkIn = booking.checkIn.slice(0, 10)
    const key = range === 'Last 12 months' ? checkIn.slice(0, 7) : checkIn
    const pointIndex = periodIndex.get(key)
    const bookingRoomRevenue = roomRevenue(booking)
    const packageRevenue = booking.tourPackagePrice ?? 0
    const promoRevenue = booking.tourPromoPrice ?? 0
    const transferRevenue = booking.airportTransferPrice
    const nights = stayNights(booking)

    revenue.room += bookingRoomRevenue
    revenue.tourPackage += packageRevenue
    revenue.tourPromo += promoRevenue
    revenue.transfer += transferRevenue
    revenue.total += booking.amount
    roomNights += nights

    if (pointIndex !== undefined) {
      periods[pointIndex].roomRevenue += bookingRoomRevenue
      periods[pointIndex].tourPackageRevenue += packageRevenue
      periods[pointIndex].tourPromoRevenue += promoRevenue
      periods[pointIndex].transferRevenue += transferRevenue
    }

    const room = roomMap.get(String(booking.roomId)) ?? { id: String(booking.roomId), name: booking.room, revenue: 0, bookings: 0, nights: 0 }
    room.revenue += bookingRoomRevenue
    room.bookings += 1
    room.nights += nights
    roomMap.set(String(booking.roomId), room)
  })

  return {
    bookings: inRange,
    revenue,
    roomNights,
    packageBookings,
    promoBookings,
    transferBookings,
    revenueByPeriod: periods,
    rooms: [...roomMap.values()].sort((left, right) => right.revenue - left.revenue).slice(0, 5),
  }
}

function AnalyticsMetric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <article className="card analytics-metric">
    <div className="analytics-metric-icon">{icon}</div>
    <div className="analytics-metric-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
  </article>
}

export function AnalyticsPage({ bookings, dataLoading, loadError }: { bookings: Booking[]; dataLoading: boolean; loadError: string }) {
  const [range, setRange] = useState<AnalyticsRange>('Last 12 months')
  const analytics = useMemo(() => getAnalytics(bookings, range), [bookings, range])
  const topRoomRevenue = Math.max(...analytics.rooms.map((room) => room.revenue), 0)
  const packageParticipants = analytics.packageBookings.reduce((total, booking) => total + booking.guests, 0)
  const promoParticipants = analytics.promoBookings.reduce((total, booking) => total + booking.guests, 0)
  const transferRevenueCount = analytics.transferBookings.length

  return <section className="analytics-page">
    <div className="page-heading analytics-heading">
      <div>
        <p className="eyebrow">Hometel</p>
        <h1>Analytics</h1>
        <p className="subtitle">Room performance and guest add-ons, grouped by check-in date.</p>
      </div>
      <label className="analytics-range">Reporting period
        <select value={range} onChange={(event) => setRange(event.target.value as AnalyticsRange)}>
          <option>Last 30 days</option>
          <option>Last 12 months</option>
        </select>
      </label>
    </div>

    {loadError && <p className="analytics-error" role="alert">Analytics may be incomplete: {loadError}</p>}

    <div className="analytics-metric-grid metric-grid" >
      <AnalyticsMetric icon={<CircleDollarSign size={19} />} label="Room revenue" value={dataLoading ? '—' : formatCurrency(analytics.revenue.room)} detail={`${analytics.roomNights.toLocaleString('en-PH')} room nights`} />
      <AnalyticsMetric icon={<BedDouble size={19} />} label="Bookings in period" value={dataLoading ? '—' : analytics.bookings.length.toLocaleString('en-PH')} detail={`${formatCurrency(analytics.revenue.total)} total booking value`} />
      <AnalyticsMetric icon={<PackageCheck size={19} />} label="Tour package guests" value={dataLoading ? '—' : uniqueGuestCount(analytics.packageBookings).toLocaleString('en-PH')} detail={`${packageParticipants.toLocaleString('en-PH')} guest places · ${analytics.packageBookings.length} bookings`} />
      <AnalyticsMetric icon={<Tags size={19} />} label="Tour promo guests" value={dataLoading ? '—' : uniqueGuestCount(analytics.promoBookings).toLocaleString('en-PH')} detail={`${promoParticipants.toLocaleString('en-PH')} guest places · ${analytics.promoBookings.length} bookings`} />
    </div>

    <section className="card analytics-chart-card" aria-labelledby="analytics-revenue-title">
      <header className="card-heading">
        <div><h2 id="analytics-revenue-title">Revenue by stay</h2><p>Room stays and add-on sales, based on the check-in date.</p></div>
      </header>
      {dataLoading ? <p className="analytics-chart-message" role="status">Loading booking analytics…</p>
        : analytics.bookings.length === 0 ? <p className="analytics-chart-message">No eligible bookings in this period.</p>
          : <div className="analytics-revenue-chart" role="img" aria-label="Revenue chart grouped by room, tour package, tour promo, and airport transfer">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.revenueByPeriod} margin={{ top: 10, right: 12, left: 8, bottom: 4 }}>
                <CartesianGrid stroke="#eee9e2" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8c857d', fontSize: 11 }} minTickGap={18} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8c857d', fontSize: 11 }} tickFormatter={(value: number) => `₱${value.toLocaleString('en-PH')}`} width={74} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="roomRevenue" name="Room revenue" fill="#bb7047" radius={[2, 2, 0, 0]} />
                <Bar dataKey="tourPackageRevenue" name="Tour packages" fill="#688b70" radius={[2, 2, 0, 0]} />
                <Bar dataKey="tourPromoRevenue" name="Tour promos" fill="#8a78a6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="transferRevenue" name="Transfers" fill="#d2a44e" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>}
    </section>

    <div className="analytics-detail-grid metric-grid">
      <section className="card analytics-detail-card" aria-labelledby="analytics-rooms-title">
        <header className="card-heading"><div><h2 id="analytics-rooms-title">Top rooms</h2><p>Ranked by room-only revenue.</p></div></header>
        {dataLoading ? <p className="analytics-chart-message" role="status">Loading room performance…</p>
          : analytics.rooms.length === 0 || topRoomRevenue === 0 ? <p className="analytics-chart-message">No room revenue to rank for this period.</p>
            : <ol className="analytics-room-list">{analytics.rooms.map((room) => (
              <li key={room.id}>
                <div className="analytics-room-row"><strong>{room.name}</strong><span>{formatCurrency(room.revenue)}</span></div>
                <div className="analytics-room-track" aria-hidden="true"><span style={{ width: `${Math.max(4, room.revenue / topRoomRevenue * 100)}%` }} /></div>
                <small>{room.bookings} bookings · {room.nights} room nights</small>
              </li>
            ))}</ol>}
      </section>

      <section className="card analytics-detail-card" aria-labelledby="analytics-addons-title">
        <header className="card-heading"><div><h2 id="analytics-addons-title">Guest add-ons</h2><p>Sales and participation during this period.</p></div></header>
        <div className="analytics-addon-list">
          <article><span className="analytics-addon-icon package"><PackageCheck size={16} /></span><div><strong>Tour packages</strong><small>{analytics.packageBookings.length} bookings · {packageParticipants} guest places</small></div><b>{formatCurrency(analytics.revenue.tourPackage)}</b></article>
          <article><span className="analytics-addon-icon promo"><Tags size={16} /></span><div><strong>Tour promos</strong><small>{analytics.promoBookings.length} bookings · {promoParticipants} guest places</small></div><b>{formatCurrency(analytics.revenue.tourPromo)}</b></article>
          <article><span className="analytics-addon-icon transfer"><Users size={16} /></span><div><strong>Airport transfers</strong><small>{transferRevenueCount} bookings</small></div><b>{formatCurrency(analytics.revenue.transfer)}</b></article>
          <div className="analytics-addon-total"><span>Total add-on sales</span><strong>{formatCurrency(analytics.revenue.tourPackage + analytics.revenue.tourPromo + analytics.revenue.transfer)}</strong></div>
        </div>
      </section>
    </div>
    <p className="analytics-footnote">Shows booked value, not payments collected, grouped by check-in date. Includes confirmed, checked-in, and completed bookings; pending and cancelled bookings are excluded. Room revenue excludes tour promos, tour packages, and airport transfers.</p>
  </section>
}
