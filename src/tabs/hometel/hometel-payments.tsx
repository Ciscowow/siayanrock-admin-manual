import { useState } from 'react'
import { ChevronDown, CircleDollarSign, Mail, Search, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatCurrency, formatDate, statusKind } from '../shared'
import { StatusBadge } from '../StatusBadge'
import type { Booking, PaymentStatus, PaymentTransaction, RoomChangeRecord } from '../types'
import './css/hometel-payments.css'

export function PaymentsPage({ bookings, roomChanges, query, setQuery, statusFilter, setStatusFilter, onMarkCreditReturned, onReturnOverpayment, onInvoiceSent, creditReturnSavingId, creditStatusError }: {
  bookings: Booking[]
  roomChanges: RoomChangeRecord[]
  query: string
  setQuery: (value: string) => void
  statusFilter: string
  setStatusFilter: (value: string) => void
  onMarkCreditReturned: (changeId: string) => Promise<boolean>
  onReturnOverpayment: (booking: Booking) => Promise<boolean>
  onInvoiceSent: (bookingIds: string[], sentAt: string) => void
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
      const { data, error } = await supabase.functions.invoke('send-booking-invoice', {
        body: { bookingIds },
      })

      if (error) {
        console.error('Unable to send booking invoice:', error)
        setInvoiceFeedback({ bookingId: guestKey, message: 'Invoice could not be sent. Check the email function and Resend configuration.', isError: true })
        return
      }

      if (typeof data?.trackingError === 'string') {
        console.error('Invoice email was sent, but sent status could not be recorded:', data.trackingError)
        setInvoiceFeedback({ bookingId: guestKey, message: 'Email sent successfully, but its sent status could not be saved. Please check the invoice_sent_at migration and refresh.', isError: true })
        return
      }
      if (typeof data?.sentAt !== 'string') {
        console.error('Invoice function returned success without a sent timestamp:', data)
        setInvoiceFeedback({ bookingId: guestKey, message: 'Email sent, but the function did not confirm invoice tracking. Refresh and verify before retrying.', isError: true })
        return
      }
      onInvoiceSent(bookingIds, data.sentAt)
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

  return <div className="payments-page">
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
        <table><thead><tr><th>Guest</th><th>Bookings</th><th>Transactions</th><th>Net received</th><th>Payment status</th><th>Invoice</th><th /></tr></thead>
          <tbody>{visibleGuestGroups.map(({ key, guest, transactions }) => {
            const bookingsById = new Map(transactions.map((transaction) => [transaction.booking.id, transaction.booking]))
            const bookingRecords = Array.from(bookingsById.values())
            const bookingIds = new Set(bookingRecords.map((booking) => booking.id))
            const guestNet = transactions.reduce((sum, transaction) => sum + transaction.displayAmount, 0)
            const paymentStatus = getGuestPaymentStatus(transactions)
            const lastInvoiceSentAt = bookingRecords
              .map((booking) => booking.invoiceSentAt)
              .filter((sentAt): sentAt is string => Boolean(sentAt))
              .sort((left, right) => right.localeCompare(left))[0]
            const bookingStatusCounts = bookingRecords.reduce((counts, booking) => {
              counts.set(booking.payment, (counts.get(booking.payment) ?? 0) + 1)
              return counts
            }, new Map<PaymentStatus, number>())
            return <tr key={key}>
              <td><div className="guest-cell"><div className="avatar" style={{ background: guest.color }}>{guest.initials}</div><div><strong>{guest.guest}</strong><span>{guest.email || guest.phone || guest.guestId}</span></div></div></td>
              <td>{bookingIds.size}</td><td>{transactions.filter((transaction) => !transaction.isStatusOnly).length}</td>
              <td><strong className={guestNet < 0 ? 'credit-amount' : undefined}>{formatCurrency(guestNet)}</strong></td>
              <td><div className="payment-pill-cell payment-status-pill">
                <StatusBadge kind={paymentStatus === 'Returned' ? 'warning' : statusKind(paymentStatus)}>{paymentStatus}</StatusBadge>
                {paymentStatus === 'Mixed' && <span className="payment-status-summary">{Array.from(bookingStatusCounts, ([status, count]) => `${count} ${status.toLowerCase()}`).join(' · ')}</span>}
              </div>
              </td>
              <td><div className="payment-pill-cell payment-invoice-pill">
                {lastInvoiceSentAt
                  ? <><StatusBadge kind="success">Sent</StatusBadge><span className="payment-status-summary">{formatDate(lastInvoiceSentAt)}</span></>
                  : <StatusBadge kind="neutral">Not sent</StatusBadge>}
              </div></td>
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
  </div>
}
