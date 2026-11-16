import { useEffect, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, BedDouble, CalendarDays, ChevronDown, CircleDollarSign, FileText, Mail, MoreHorizontal, X } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, statusKind } from '../shared'
import { StatusBadge } from '../StatusBadge'
import type { Booking, MetricPopup } from '../types'
import { BookingTable } from './hometel-bookings'
import './css/hometel-overview.css'

type ChartPoint = { day: string; value: number }
type HometelOverviewProps = { dataLoading: boolean; invoiceSentGuests: Set<string>; monthRevenue: number; todayCheckIns: number; todayCheckOuts: number; openMetricPopup: (kind: 'occupancy' | 'revenue' | 'check-ins' | 'check-outs' | 'invoices') => void; range: string; setRange: (value: string) => void; chartData: ChartPoint[]; revenueChartData: ChartPoint[]; bookingsInRange: number; revenueInRange: number; pendingBookings: Booking[]; paymentAttentionBookings: Booking[]; creditItemsDueCount: number; specialRequestBookings: Booking[]; setStatusFilter: (value: string) => void; nav: (label: string, group?: 'hometel' | 'tours') => void; setPaymentStatusFilter: (value: string) => void; setQuery: (value: string) => void; setSpecialRequestsOnly: (value: boolean) => void; bookings: Booking[]; onStatusChange: (booking: Booking, status: import('../types').BookingStatus) => Promise<boolean>; onManagePayment: (booking: Booking) => void }

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

function AttentionPopupSection({ icon, title, bookings, detailFor, onOpen, extraItem }: {
  icon: React.ReactNode
  title: string
  bookings: Booking[]
  detailFor: (booking: Booking) => string
  onOpen: () => void
  extraItem?: { title: string; detail: string; count: number }
}) {
  if (bookings.length === 0 && !extraItem) return null
  return <section className="attention-popup-section">
    <header><h3>{icon}{title} <span>{bookings.length + (extraItem?.count ?? 0)}</span></h3><button className="text-button" onClick={onOpen}>Open <ArrowUpRight size={13} /></button></header>
    <div className="attention-popup-list">
      {bookings.map((booking) => <article className="attention-popup-entry" key={`${title}-${booking.id}`}>
        <div><strong>{booking.guest}</strong><span>{booking.room} · {booking.dates}</span></div>
        <p>{detailFor(booking)}</p>
      </article>)}
      {extraItem && <article className="attention-popup-entry"><div><strong>{extraItem.title}</strong><span>{extraItem.detail}</span></div><b>{extraItem.count}</b></article>}
    </div>
  </section>
}

export default function HometelOverview({dataLoading,invoiceSentGuests,monthRevenue,todayCheckIns,todayCheckOuts,openMetricPopup,range,setRange,chartData,revenueChartData,bookingsInRange,revenueInRange,pendingBookings,paymentAttentionBookings,creditItemsDueCount,specialRequestBookings,setStatusFilter,nav,setPaymentStatusFilter,setQuery,setSpecialRequestsOnly,bookings,onStatusChange,onManagePayment}: HometelOverviewProps) {
  const [chartView, setChartView] = useState<'bookings' | 'revenue'>('bookings')
  const [attentionPopupOpen, setAttentionPopupOpen] = useState(false)
  const isRevenueView = chartView === 'revenue'
  const activeChartData = isRevenueView ? revenueChartData : chartData
  const activeChartTotal = isRevenueView ? revenueInRange : bookingsInRange
  const chartColor = isRevenueView ? '#438a6c' : '#c77d52'
  const chartFillId = isRevenueView ? 'revenueFill' : 'bookingFill'
  const chartLabel = isRevenueView ? 'Payments received' : 'Bookings'
  const partialPaymentCount = paymentAttentionBookings.filter((booking) => booking.payment === 'Partial').length
  const unpaidPaymentCount = paymentAttentionBookings.filter((booking) => booking.payment === 'Unpaid').length
  const overpaidPaymentCount = paymentAttentionBookings.filter((booking) => booking.payment === 'Overpaid').length
  const paymentIssueDetails = [
    partialPaymentCount > 0 ? `${partialPaymentCount} partial` : null,
    unpaidPaymentCount > 0 ? `${unpaidPaymentCount} unpaid` : null,
    overpaidPaymentCount > 0 ? `${overpaidPaymentCount} overpaid` : null,
    creditItemsDueCount > 0 ? `${creditItemsDueCount} refunds due` : null,
  ].filter((detail): detail is string => detail !== null).join(' · ')
  const paymentIssueCount = paymentAttentionBookings.length + creditItemsDueCount
  const attentionCount = pendingBookings.length + paymentIssueCount + specialRequestBookings.length

  useEffect(() => {
    if (!attentionPopupOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAttentionPopupOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [attentionPopupOpen])

  return <>
<div className="page-heading">
                <div><h1>Overview <span>✦</span></h1><p className="subtitle">Here’s what’s happening across your Hometel and Tours today.</p></div>
              </div>
              <section className="metric-grid">
                <MetricCard label="Guests invoiced" value={dataLoading ? '—' : String(invoiceSentGuests.size)} icon={<Mail size={19} />} color="mint" onClick={() => openMetricPopup('invoices')} />
                <MetricCard label="Revenue this month" value={dataLoading ? '—' : formatCurrency(monthRevenue)} icon={<CircleDollarSign size={19} />} color="lavender" onClick={() => openMetricPopup('revenue')} />
                <MetricCard label="Today’s check-ins" value={dataLoading ? '—' : String(todayCheckIns)} icon={<ArrowDownRight size={19} />} color="peach" onClick={() => openMetricPopup('check-ins')} />
                <MetricCard label="Today’s check-outs" value={dataLoading ? '—' : String(todayCheckOuts)} icon={<ArrowUpRight size={19} />} color="yellow" onClick={() => openMetricPopup('check-outs')} />
              </section>
              <div className="dashboard-grid">
                <section className="card chart-card">
                  <div className="card-heading chart-card-heading">
                    <div><h2>{isRevenueView ? 'Revenue overview' : 'Booking overview'}</h2><p>{isRevenueView ? 'Payments received over time' : 'Bookings created over time'}</p></div>
                    <div className="chart-controls">
                      <div className="chart-view-toggle" role="group" aria-label="Chart overview">
                        <button type="button" className={!isRevenueView ? 'active' : ''} aria-pressed={!isRevenueView} onClick={() => setChartView('bookings')}>Bookings</button>
                        <button type="button" className={isRevenueView ? 'active' : ''} aria-pressed={isRevenueView} onClick={() => setChartView('revenue')}>Revenue</button>
                      </div>
                      <label className="select-wrap"><select value={range} onChange={(e) => setRange(e.target.value)}><option>Last 7 days</option><option>Last month</option><option>Last year</option></select><ChevronDown size={14} /></label>
                    </div>
                  </div>
                  <div className="chart-legend"><span className={`legend-dot ${isRevenueView ? 'revenue-dot' : ''}`} /> {chartLabel} <strong>{dataLoading ? '—' : isRevenueView ? formatCurrency(activeChartTotal) : activeChartTotal}</strong></div>
                  <div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={activeChartData} margin={{ top: 10, right: 4, left: -24, bottom: 0 }}><defs><linearGradient id="bookingFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d69b77" stopOpacity={0.3} /><stop offset="100%" stopColor="#d69b77" stopOpacity={0.02} /></linearGradient><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#438a6c" stopOpacity={0.28} /><stop offset="100%" stopColor="#438a6c" stopOpacity={0.02} /></linearGradient></defs><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#9b9690', fontSize: 9 }} interval="preserveStartEnd" /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#9b9690', fontSize: 9 }} allowDecimals={isRevenueView} domain={isRevenueView ? ['auto', 'auto'] : [0, (max: number) => Math.max(max, 1)]} tickFormatter={(value: number) => isRevenueView ? `₱${value.toLocaleString('en-PH')}` : String(value)} /><Tooltip contentStyle={{ border: '1px solid #eee9e2', borderRadius: 10, boxShadow: '0 4px 15px #33291c12', fontSize: 10 }} formatter={(value) => isRevenueView ? formatCurrency(Number(value)) : value} /><Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2.5} fill={`url(#${chartFillId})`} /></AreaChart></ResponsiveContainer></div>
                </section>
                <section className="card action-card">
                  <div className="card-heading"><div><h2>Needs your attention</h2><p>Items that need action today</p></div><button className="more-button" aria-label="More options"><MoreHorizontal size={18} /></button></div>
                  {(dataLoading || pendingBookings.length > 0) && <AttentionItem icon={<CalendarDays size={16} />} title="Pending bookings" detail={`${pendingBookings.length} awaiting confirmation`} count={dataLoading ? '—' : String(pendingBookings.length)} onClick={() => { setStatusFilter('Pending'); nav('Bookings') }} />}
                  {(dataLoading || paymentIssueCount > 0) && <AttentionItem icon={<CircleDollarSign size={16} />} title="Payment issues" detail={dataLoading ? 'Loading payment issues…' : paymentIssueDetails} count={dataLoading ? '—' : String(paymentIssueCount)} onClick={() => { setPaymentStatusFilter('All statuses'); nav('Payments') }} />}
                  {(dataLoading || specialRequestBookings.length > 0) && <AttentionItem icon={<FileText size={16} />} title="Special requests" detail={`${specialRequestBookings.length} bookings need request review`} count={dataLoading ? '—' : String(specialRequestBookings.length)} onClick={() => { setQuery(''); setStatusFilter('All statuses'); setSpecialRequestsOnly(true); nav('Bookings') }} />}
                  {!dataLoading && attentionCount === 0 && <p className="attention-empty">No items need attention right now.</p>}
                  {(dataLoading || attentionCount > 0) && <button className="text-button" onClick={() => setAttentionPopupOpen(true)}>View all items <ArrowUpRight size={14} /></button>}
                </section>
              </div>
              <section className="card recent-card">
                <div className="card-heading"><div><h2>Recent bookings</h2><p>Latest activity from your property</p></div><button className="text-button" onClick={() => nav('Bookings')}>View all bookings <ArrowUpRight size={14} /></button></div>
                <BookingTable bookings={bookings.slice(0, 4)} onStatusChange={onStatusChange} onManagePayment={onManagePayment} compact />
              </section>
              {attentionPopupOpen && <div className="metric-popup-backdrop" onMouseDown={(event) => {
                if (event.target === event.currentTarget) setAttentionPopupOpen(false)
              }}>
                <section className="metric-popup card attention-popup" role="dialog" aria-modal="true" aria-labelledby="attention-popup-title">
                  <header className="metric-popup-header">
                    <div><p className="eyebrow">Needs your attention</p><h2 id="attention-popup-title">All items</h2><p className="subtitle">{dataLoading ? 'Loading attention items…' : `${attentionCount} ${attentionCount === 1 ? 'item needs' : 'items need'} action.`}</p></div>
                    <button className="icon-button" type="button" onClick={() => setAttentionPopupOpen(false)} aria-label="Close attention items"><X size={19} /></button>
                  </header>
                  <div className="metric-popup-content attention-popup-content">
                    {dataLoading ? <p className="attention-popup-loading" role="status">Loading attention items…</p> : <>
                      <AttentionPopupSection icon={<CalendarDays size={16} />} title="Pending bookings" bookings={pendingBookings} detailFor={() => 'Awaiting confirmation'} onOpen={() => { setAttentionPopupOpen(false); setStatusFilter('Pending'); nav('Bookings') }} />
                      <AttentionPopupSection icon={<CircleDollarSign size={16} />} title="Payment issues" bookings={paymentAttentionBookings} detailFor={(booking) => booking.payment} extraItem={creditItemsDueCount > 0 ? { title: 'Refunds due', detail: `${creditItemsDueCount} refunds awaiting processing`, count: creditItemsDueCount } : undefined} onOpen={() => { setAttentionPopupOpen(false); setPaymentStatusFilter('All statuses'); nav('Payments') }} />
                      <AttentionPopupSection icon={<FileText size={16} />} title="Special requests" bookings={specialRequestBookings} detailFor={(booking) => booking.request} onOpen={() => { setAttentionPopupOpen(false); setQuery(''); setStatusFilter('All statuses'); setSpecialRequestsOnly(true); nav('Bookings') }} />
                    </>}
                  </div>
                  <footer className="metric-popup-footer"><button className="button button-secondary" type="button" onClick={() => setAttentionPopupOpen(false)}>Close</button></footer>
                </section>
              </div>}
</> }
