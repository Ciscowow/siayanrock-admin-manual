import { useEffect } from 'react'
import { ArrowDownRight, ArrowUpRight, BedDouble, CalendarDays, ChevronDown, CircleDollarSign, FileText, Mail, MoreHorizontal } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, statusKind } from '../shared'
import { StatusBadge } from '../StatusBadge'
import type { Booking, MetricPopup } from '../types'
import { BookingTable } from './hometel-bookings'
import './css/hometel-overview.css'

type HometelOverviewProps = { today: Date; dataLoading: boolean; invoiceSentGuests: Set<string>; monthRevenue: number; todayCheckIns: number; todayCheckOuts: number; openMetricPopup: (kind: 'occupancy' | 'revenue' | 'check-ins' | 'check-outs' | 'invoices') => void; range: string; setRange: (value: string) => void; chartData: { day: string; value: number }[]; bookingsInRange: number; pendingBookings: Booking[]; paymentAttentionBookings: Booking[]; creditItemsDueCount: number; specialRequestBookings: Booking[]; setStatusFilter: (value: string) => void; nav: (label: string, group?: 'hometel' | 'tours') => void; setPaymentStatusFilter: (value: string) => void; setQuery: (value: string) => void; setSpecialRequestsOnly: (value: boolean) => void; bookings: Booking[]; onStatusChange: (booking: Booking, status: import('../types').BookingStatus) => Promise<boolean>; onManagePayment: (booking: Booking) => void }

export function MetricCard({ label, value, icon, color, onClick }: { label: string; value: string; icon: React.ReactNode; color: string; onClick: () => void }) {
  return <button className="card metric-card" onClick={onClick} aria-label={`${label}: ${value}. View details`}><div className={`metric-icon ${color}`}>{icon}</div><p>{label}</p><div className="metric-value">{value}</div><span className="metric-hint">View details <ArrowUpRight size={12} /></span></button>
}

export function MetricPopupDialog({ popup, loading, onClose }: { popup: MetricPopup; loading: boolean; onClose: () => void }) {
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
          <div className="empty-state"><CalendarDays size={25} /><strong>No records to show</strong><span>There are no matching records for this metric.</span></div>
        ) : popup.entries.map(({ booking, room, detail, amount, statusOverride }, index) => (
          <article className="metric-popup-entry" key={`${booking?.id ?? room?.id}-${detail}-${index}`}>
            <div className="metric-popup-room"><BedDouble size={17} /><div><strong>{booking?.room ?? room?.name}</strong><span>{booking ? `${booking.guest} · ${booking.id}` : 'Manually set occupied'}</span></div></div>
            <div className="metric-popup-meta"><span>{detail}</span>{amount !== undefined && <strong className={amount < 0 ? 'credit-amount' : undefined}>{amount < 0 ? '−' : ''}{formatCurrency(Math.abs(amount))}</strong>}</div>
            <StatusBadge kind={statusOverride === 'Sent' || popup.title === 'Revenue this month' ? 'success' : statusOverride ? 'warning' : booking ? statusKind(booking.status) : 'info'}>
              {statusOverride ?? (popup.title === 'Revenue this month' ? 'Paid' : booking ? booking.status : 'Occupied')}
            </StatusBadge>
          </article>
        ))}
      </div>
      <footer className="metric-popup-footer"><button className="button button-secondary" onClick={onClose}>Close</button></footer>
    </section>
  </div>
}

export function AttentionItem({ icon, title, detail, count, onClick }: { icon: React.ReactNode; title: string; detail: string; count: string; onClick: () => void }) {
  return <button className="attention-item" onClick={onClick}><div className="attention-icon">{icon}</div><div className="attention-copy"><strong>{title}</strong><span>{detail}</span></div><b>{count}</b><ArrowUpRight size={15} className="attention-arrow" /></button>
}

export default function HometelOverview({today,dataLoading,invoiceSentGuests,monthRevenue,todayCheckIns,todayCheckOuts,openMetricPopup,range,setRange,chartData,bookingsInRange,pendingBookings,paymentAttentionBookings,creditItemsDueCount,specialRequestBookings,setStatusFilter,nav,setPaymentStatusFilter,setQuery,setSpecialRequestsOnly,bookings,onStatusChange,onManagePayment}: HometelOverviewProps) { return <>
<div className="page-heading">
                <div><p className="eyebrow">{today.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p><h1>Overview <span>✦</span></h1><p className="subtitle">Here’s what’s happening across your Hometel and tour operations today.</p></div>
              </div>
              <section className="metric-grid">
                <MetricCard label="Guests invoiced" value={dataLoading ? '—' : String(invoiceSentGuests.size)} icon={<Mail size={19} />} color="mint" onClick={() => openMetricPopup('invoices')} />
                <MetricCard label="Revenue this month" value={dataLoading ? '—' : formatCurrency(monthRevenue)} icon={<CircleDollarSign size={19} />} color="lavender" onClick={() => openMetricPopup('revenue')} />
                <MetricCard label="Today’s check-ins" value={dataLoading ? '—' : String(todayCheckIns)} icon={<ArrowDownRight size={19} />} color="peach" onClick={() => openMetricPopup('check-ins')} />
                <MetricCard label="Today’s check-outs" value={dataLoading ? '—' : String(todayCheckOuts)} icon={<ArrowUpRight size={19} />} color="yellow" onClick={() => openMetricPopup('check-outs')} />
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
                  <AttentionItem icon={<FileText size={16} />} title="Special requests" detail={`${specialRequestBookings.length} bookings need request review`} count={dataLoading ? '—' : String(specialRequestBookings.length)} onClick={() => { setQuery(''); setStatusFilter('All statuses'); setSpecialRequestsOnly(true); nav('Bookings') }} />
                  <button className="text-button" onClick={() => nav('Bookings')}>View all items <ArrowUpRight size={14} /></button>
                </section>
              </div>
              <section className="card recent-card">
                <div className="card-heading"><div><h2>Recent bookings</h2><p>Latest activity from your property</p></div><button className="text-button" onClick={() => nav('Bookings')}>View all bookings <ArrowUpRight size={14} /></button></div>
                <BookingTable bookings={bookings.slice(0, 4)} onStatusChange={onStatusChange} onManagePayment={onManagePayment} compact />
              </section>
</> }
