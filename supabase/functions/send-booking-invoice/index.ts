import { createClient } from 'npm:@supabase/supabase-js@2'
import { calculateInvoicePricing } from './pricing.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Booking = {
  id: string
  guest_id: string
  room_id: number
  check_in: string
  check_out: string
  num_of_guests: number
  airport_transfer_price: number | string | null
  tour_promo_price: number | string | null
  tour_promo_with_lunch: boolean | null
}

type Guest = { id: string; full_name: string | null; email: string | null }
type Room = {
  id: number
  room_name: string | null
  room_number: string | null
  room_price: number | string | null
}
type Payment = {
  booking_id: string
  amount: number | string
  payment_status: string | null
  paid_at: string | null
  payment_method: string | null
  payment_type: string | null
}
type RoomChange = {
  booking_id: string
  credit_amount: number | string
  credit_returned: boolean | null
  credit_returned_at: string | null
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!)

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)

const formatDate = (value: string | null) => {
  if (!value) return 'Date not recorded'
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-PH', {
      timeZone: 'UTC',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  let body: { bookingIds?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'A valid JSON request is required.' }, 400)
  }

  const bookingIds = Array.isArray(body.bookingIds) ? [...new Set(body.bookingIds)] : []
  const isUuid = (value: unknown): value is string =>
    typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  if (bookingIds.length === 0 || bookingIds.length > 20 || !bookingIds.every(isUuid)) {
    return jsonResponse({ error: 'Provide between one and twenty valid booking IDs.' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !fromEmail) {
    console.error('Invoice email secrets are not fully configured.')
    return jsonResponse({ error: 'Invoice email is not configured.' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: bookingData, error: bookingError } = await supabase
    .from('bookings')
    .select('id, guest_id, room_id, check_in, check_out, num_of_guests, airport_transfer_price, tour_promo_price, tour_promo_with_lunch')
    .in('id', bookingIds)

  if (bookingError) {
    console.error('Unable to load bookings for invoice:', bookingError)
    return jsonResponse({ error: 'Unable to load these bookings.' }, 500)
  }
  const bookings = (bookingData ?? []) as Booking[]
  if (bookings.length !== bookingIds.length) return jsonResponse({ error: 'One or more bookings were not found.' }, 404)

  const guestIds = [...new Set(bookings.map((booking) => booking.guest_id))]
  const roomIds = [...new Set(bookings.map((booking) => booking.room_id))]
  const [guestsResult, roomsResult, paymentsResult, roomChangesResult] = await Promise.all([
    supabase.from('guests').select('id, full_name, email').in('id', guestIds),
    supabase.from('rooms').select('id, room_name, room_number, room_price').in('id', roomIds),
    supabase.from('payments')
      .select('booking_id, amount, payment_status, paid_at, payment_method, payment_type')
      .in('booking_id', bookingIds)
      .order('paid_at', { ascending: true }),
    supabase.from('booking_room_changes')
      .select('booking_id, credit_amount, credit_returned, credit_returned_at')
      .in('booking_id', bookingIds),
  ])

  if (guestsResult.error || roomsResult.error || paymentsResult.error || roomChangesResult.error) {
    console.error('Unable to load invoice details:', guestsResult.error ?? roomsResult.error ?? paymentsResult.error ?? roomChangesResult.error)
    return jsonResponse({ error: 'Unable to load the complete invoice details.' }, 500)
  }

  const guests = (guestsResult.data ?? []) as Guest[]
  const rooms = (roomsResult.data ?? []) as Room[]
  const payments = (paymentsResult.data ?? []) as Payment[]
  const roomChanges = (roomChangesResult.data ?? []) as RoomChange[]
  const bookingGuests = bookings.map((booking) => guests.find((guest) => guest.id === booking.guest_id))
  const recipientEmails = new Set(bookingGuests.map((guest) => guest?.email?.trim().toLowerCase()).filter(Boolean))
  if (bookingGuests.some((guest) => !guest?.email?.trim()) || recipientEmails.size !== 1) {
    return jsonResponse({ error: 'All selected bookings must have the same guest email address on file.' }, 422)
  }

  const recipient = bookingGuests[0]!.email!.trim()
  const guestName = bookingGuests[0]!.full_name?.trim() || 'Guest'
  const bookingRoomRates = new Map<number, number>()
  for (const booking of bookings) {
    const room = rooms.find((item) => item.id === booking.room_id)
    const roomRate = Number(room?.room_price)
    if (!room || room.room_price === null || !Number.isFinite(roomRate) || roomRate < 0) {
      console.error('A booking has no valid room rate for invoice calculation:', booking.id)
      return jsonResponse({ error: 'One or more room rates are invalid or unavailable.' }, 422)
    }
    bookingRoomRates.set(booking.room_id, roomRate)
  }
  const statements = bookings.map((booking) => {
    const totalNights = Math.max(0, Math.round(
      (Date.parse(`${booking.check_out.slice(0, 10)}T00:00:00Z`) - Date.parse(`${booking.check_in.slice(0, 10)}T00:00:00Z`)) / 86_400_000,
    ))
    const hasTourPromo = booking.tour_promo_price !== null && booking.tour_promo_price !== undefined
    const tourPromoPrice = hasTourPromo ? Number(booking.tour_promo_price) : 0
    const airportTransferPrice = Number(booking.airport_transfer_price ?? 0)
    if (hasTourPromo && (!Number.isFinite(tourPromoPrice) || tourPromoPrice < 0 || !Number.isFinite(airportTransferPrice) || airportTransferPrice < 0)) {
      console.error('A booking has invalid tour promo pricing:', booking.id)
      return jsonResponse({ error: 'One or more tour promo prices are invalid.' }, 422)
    }
    const roomStayAmount = hasTourPromo ? tourPromoPrice : bookingRoomRates.get(booking.room_id)! * totalNights
    const pricing = hasTourPromo
      ? {
        total: tourPromoPrice + airportTransferPrice,
        additionalGuestCount: 0,
        additionalGuestNightlyRate: 0,
        additionalGuestCharge: 0,
      }
      : calculateInvoicePricing(roomStayAmount, booking.num_of_guests, totalNights)
    const { total, additionalGuestCount, additionalGuestNightlyRate, additionalGuestCharge } = pricing
    const bookingPayments = payments.filter((payment) => payment.booking_id === booking.id)
    const returnedChanges = roomChanges.filter((change) => change.booking_id === booking.id)
    const paymentTotal = bookingPayments
      .filter((payment) => payment.payment_status?.toLowerCase() === 'paid')
      .reduce((sum, payment) => sum + Number(payment.amount), 0)
    const returnedTotal = returnedChanges
      .filter((change) => change.credit_returned)
      .reduce((sum, change) => sum + Number(change.credit_amount), 0)
    const netPaid = Math.max(0, paymentTotal - returnedTotal)
    const balanceDue = Math.max(0, total - netPaid)
    const overpayment = Math.max(0, netPaid - total)
    const room = rooms.find((item) => item.id === booking.room_id)
    const roomName = room?.room_name?.trim() || `Room ${booking.room_id}`
    const roomLabel = room?.room_number ? `${roomName} (${room.room_number})` : roomName
    const averageNightlyRate = bookingRoomRates.get(booking.room_id)!
    const promoDescription = `Tour package for 2 · ${booking.tour_promo_with_lunch ? 'with lunch' : 'without lunch'}`
    const rows = bookingPayments.map((payment) => {
      const status = payment.payment_status?.replaceAll('_', ' ') || 'pending'
      const details = [payment.payment_type?.replaceAll('_', ' '), payment.payment_method?.replaceAll('_', ' ')]
        .filter(Boolean)
        .join(' · ')
      return {
        date: formatDate(payment.paid_at),
        description: details || 'Payment',
        status,
        amount: Number(payment.amount),
        refund: false,
      }
    })
    returnedChanges.filter((change) => change.credit_returned).forEach((change) => rows.push({
      date: formatDate(change.credit_returned_at),
      description: 'Refund returned',
      status: 'Returned',
      amount: Number(change.credit_amount),
      refund: true,
    }))
    const rowsHtml = rows.length
      ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:12px 0 18px">
          <thead><tr style="text-align:left;color:#92877c;font-size:11px;letter-spacing:.5px;text-transform:uppercase">
            <th style="padding:10px 8px;border-bottom:1px solid #eee8df;font-weight:600">Payment activity</th>
            <th style="padding:10px 8px;border-bottom:1px solid #eee8df;text-align:right;font-weight:600">Amount</th>
          </tr></thead>
          <tbody>${rows.map((row) => `<tr>
            <td style="padding:11px 8px;border-bottom:1px solid #f2eee8">
              <strong style="display:block;color:#463a31;font-size:13px;font-weight:600">${escapeHtml(row.description)}</strong>
              <span style="display:block;margin-top:4px;color:#92877c;font-size:11px">${escapeHtml(row.date)} · ${escapeHtml(row.status)}</span>
            </td>
            <td style="padding:11px 8px;border-bottom:1px solid #f2eee8;text-align:right;color:${row.refund ? '#a85f4b' : '#463a31'};font-size:13px;font-weight:600;white-space:nowrap">${row.refund ? '−' : ''}${formatCurrency(row.amount)}</td>
          </tr>`).join('')}</tbody>
        </table>`
      : ''
    const outstandingLabel = overpayment > 0 ? 'Overpayment to return' : 'Balance due'
    const outstanding = overpayment || balanceDue
    const stay = `${formatDate(booking.check_in)} – ${formatDate(booking.check_out)}`
    const paymentStatus = overpayment > 0 ? 'Overpaid' : netPaid >= total ? 'Paid' : netPaid > 0 ? 'Partially paid' : 'Unpaid'
    const statusColor = paymentStatus === 'Paid' ? '#347a5b' : '#a56824'
    const statusBackground = paymentStatus === 'Paid' ? '#e8f3ed' : '#fbf1df'
    const balanceColor = overpayment > 0 ? '#a85f4b' : '#51483f'
    return {
      booking,
      total,
      netPaid,
      balanceDue,
      overpayment,
      roomLabel,
      stay,
      outstandingLabel,
      outstanding,
      text: [
        `Booking ${booking.id}`,
        `Room: ${roomLabel}`,
        `Stay: ${stay}`,
        hasTourPromo
          ? `${promoDescription}: ${formatCurrency(tourPromoPrice)}`
          : `Room stay: ${totalNights} night${totalNights === 1 ? '' : 's'} × ${formatCurrency(averageNightlyRate)} average per night = ${formatCurrency(roomStayAmount)}`,
        ...(!hasTourPromo ? [`Additional guest charge: ${additionalGuestCount} additional guest${additionalGuestCount === 1 ? '' : 's'} × ${formatCurrency(additionalGuestNightlyRate)} per guest per night × ${totalNights} night${totalNights === 1 ? '' : 's'} = ${formatCurrency(additionalGuestCharge)}`] : []),
        ...(hasTourPromo && airportTransferPrice > 0 ? [`Airport transfer: ${formatCurrency(airportTransferPrice)}`] : []),
        `Guests: ${booking.num_of_guests}`,
        `Total: ${formatCurrency(total)}`,
        `${outstandingLabel}: ${formatCurrency(outstanding)}`,
      ].join('\n'),
      html: `<table role="presentation" style="width:100%;border-collapse:collapse;margin-top:18px">
        <tr>
          <td style="padding:15px 8px 11px;border-bottom:1px solid #eee9e2">
            <strong style="display:block;color:#332d27;font-family:Georgia,serif;font-size:18px;font-weight:600">${escapeHtml(roomLabel)}</strong>
            <span style="display:block;margin-top:5px;color:#8c857d;font-size:11px">Booking ${escapeHtml(booking.id)} · ${booking.num_of_guests} ${booking.num_of_guests === 1 ? 'guest' : 'guests'}</span>
            <span style="display:block;margin-top:4px;color:#8c857d;font-size:11px">${escapeHtml(formatDate(booking.check_in))} – ${escapeHtml(formatDate(booking.check_out))}</span>
          </td>
          <td style="padding:15px 8px 11px;border-bottom:1px solid #eee9e2;text-align:right;vertical-align:top;white-space:nowrap">
            <span style="display:inline-block;padding:5px 9px;border-radius:20px;background:${statusBackground};color:${statusColor};font-size:10px;font-weight:700">${paymentStatus}</span>
          </td>
        </tr>
        ${rowsHtml ? `<tr><td colspan="2" style="padding:4px 8px 0">${rowsHtml}</td></tr>` : ''}
        <tr><td colspan="2" style="padding:0 8px 8px">
          <table role="presentation" style="width:100%;border-collapse:collapse;border-top:2px solid #51483f;border-bottom:2px solid #51483f">
            <tr><td style="padding:10px 7px;color:#8c857d;font-size:12px">${hasTourPromo ? escapeHtml(promoDescription) : `Room stay · ${totalNights} nights · avg. ${formatCurrency(averageNightlyRate)}/night`}</td><td style="padding:10px 7px;text-align:right;color:#51483f;font-size:12px">${formatCurrency(roomStayAmount)}</td></tr>
            ${hasTourPromo && airportTransferPrice > 0 ? `<tr><td style="padding:8px 7px;color:#8c857d;font-size:12px">Airport transfer</td><td style="padding:8px 7px;text-align:right;color:#51483f;font-size:12px">${formatCurrency(airportTransferPrice)}</td></tr>` : ''}
            ${!hasTourPromo ? `<tr><td style="padding:8px 7px;color:#8c857d;font-size:12px">Additional guest charge · ${additionalGuestCount} guest${additionalGuestCount === 1 ? '' : 's'} × ${formatCurrency(additionalGuestNightlyRate)} per guest per night × ${totalNights} night${totalNights === 1 ? '' : 's'}</td><td style="padding:8px 7px;text-align:right;color:#51483f;font-size:12px">${formatCurrency(additionalGuestCharge)}</td></tr>` : ''}
            <tr><td style="padding:10px 7px;color:#8c857d;font-size:12px">Booking total</td><td style="padding:10px 7px;text-align:right;color:#51483f;font-size:12px">${formatCurrency(total)}</td></tr>
            <tr><td style="padding:10px 7px;color:#332d27;font-size:13px;font-weight:700">${outstandingLabel}</td><td style="padding:10px 7px;text-align:right;color:${balanceColor};font-size:15px;font-weight:700">${formatCurrency(outstanding)}</td></tr>
          </table>
        </td></tr>
      </table>`,
    }
  })
  const combinedTotal = statements.reduce((sum, statement) => sum + statement.total, 0)
  const combinedBalance = statements.reduce((sum, statement) => sum + statement.balanceDue, 0)
  const combinedOverpayment = statements.reduce((sum, statement) => sum + statement.overpayment, 0)
  const invoiceSubject = bookings.length === 1 ? `SiayanRock booking invoice · ${bookings[0].id}` : `SiayanRock invoice · ${bookings.length} bookings`
  const invoiceDate = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date())
  const text = [
    `SiayanRock booking invoice${bookings.length === 1 ? '' : 's'}`,
    `Guest: ${guestName}`,
    '',
    ...statements.map((statement) => statement.text),
    '',
    `Combined total: ${formatCurrency(combinedTotal)}`,
    `Combined balance due: ${formatCurrency(combinedBalance)}`,
    ...(combinedOverpayment > 0 ? [`Combined overpayment to return: ${formatCurrency(combinedOverpayment)}`] : []),
    '',
    'Thank you for choosing SiayanRock.',
  ].join('\n\n')
  const html = `<!doctype html>
  <html lang="en">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>SiayanRock booking invoice</title></head>
    <body style="margin:0;padding:0;background:#f3f1ed;color:#332d27;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased">
      <table role="presentation" style="width:100%;border-collapse:collapse;background:#f3f1ed">
        <tr><td align="center" style="padding:28px 12px">
          <table role="presentation" style="width:100%;max-width:560px;border-collapse:collapse">
            <tr><td align="center" style="padding:0 0 18px">
              <table role="presentation" style="border-collapse:collapse"><tr>
                <td align="center" valign="middle" style="width:42px;height:42px;border-radius:50%;background:#bb7047;color:#fff;font-family:Georgia,serif;font-size:25px;font-weight:600">S</td>
              </tr></table>
              <div style="margin-top:9px;color:#51483f;font-family:Georgia,serif;font-size:16px;font-weight:600;letter-spacing:.2px">SiayanRock</div>
              <div style="margin-top:3px;color:#8c857d;font-size:9px;font-weight:700;letter-spacing:1.8px">HOMETEL</div>
            </td></tr>
            <tr><td style="padding:30px 34px 26px;border:1px solid #eae6df;border-radius:14px;background:#fff">
              <h1 style="margin:0;text-align:center;color:#332d27;font-family:Arial,Helvetica,sans-serif;font-size:25px;line-height:1.3;font-weight:500">${bookings.length === 1 ? 'Thank you for your booking' : 'Your booking statement'}</h1>
              <h2 style="margin:17px 0 0;text-align:center;color:#51483f;font-family:Georgia,serif;font-size:20px;font-weight:600">${bookings.length === 1 ? 'Your invoice' : `${bookings.length} bookings`}</h2>
              <p style="margin:10px 0 0;text-align:center;color:#8c857d;font-size:12px">${escapeHtml(invoiceDate)}</p>
              <p style="margin:17px 0 8px;color:#51483f;font-size:13px;line-height:1.6">Hello ${escapeHtml(guestName)},</p>
              <p style="margin:0;color:#8c857d;font-size:12px;line-height:1.6">${bookings.length === 1 ? 'Here is your booking and payment summary.' : 'Here are the details and payment history for your stays.'}</p>
              <table role="presentation" style="width:100%;margin-top:12px;border-collapse:collapse">
                <tr><td style="padding:0">${statements.map((statement) => statement.html).join('')}</td></tr>
              </table>
              ${bookings.length > 1 ? `<table role="presentation" style="width:100%;margin-top:22px;border-collapse:collapse;border-top:2px solid #51483f;border-bottom:2px solid #51483f">
                <tr><td colspan="2" style="padding:13px 7px 9px;color:#995b39;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Combined summary</td></tr>
                <tr><td style="padding:8px 7px;color:#8c857d;font-size:12px">Total for all bookings</td><td style="padding:8px 7px;text-align:right;color:#51483f;font-size:12px;font-weight:600">${formatCurrency(combinedTotal)}</td></tr>
                ${combinedBalance > 0 ? `<tr><td style="padding:9px 7px;color:#332d27;font-size:12px;font-weight:700">Combined balance due</td><td style="padding:9px 7px;text-align:right;color:#51483f;font-size:14px;font-weight:700">${formatCurrency(combinedBalance)}</td></tr>` : ''}
                ${combinedOverpayment > 0 ? `<tr><td style="padding:9px 7px;color:#332d27;font-size:12px;font-weight:700">Overpayments to return</td><td style="padding:9px 7px;text-align:right;color:#a85f4b;font-size:14px;font-weight:700">${formatCurrency(combinedOverpayment)}</td></tr>` : ''}
              </table>` : ''}
              <h2 style="margin:25px 0 12px;text-align:center;color:#51483f;font-family:Georgia,serif;font-size:18px;font-weight:600">Your details</h2>
              <table role="presentation" style="width:100%;border-collapse:collapse">
                <tr><td style="width:34%;padding:10px 7px;border-top:1px solid #eee9e2;color:#8c857d;font-size:11px;vertical-align:top">Guest</td><td style="padding:10px 7px;border-top:1px solid #eee9e2;color:#51483f;font-size:12px;font-weight:600">${escapeHtml(guestName)}</td></tr>
                <tr><td style="width:34%;padding:10px 7px;border-top:1px solid #eee9e2;color:#8c857d;font-size:11px;vertical-align:top">Email</td><td style="padding:10px 7px;border-top:1px solid #eee9e2;color:#51483f;font-size:12px;word-break:break-word">${escapeHtml(recipient)}</td></tr>
                ${bookings.length === 1 ? `<tr><td style="width:34%;padding:10px 7px;border-top:1px solid #eee9e2;color:#8c857d;font-size:11px;vertical-align:top">Stay</td><td style="padding:10px 7px;border-top:1px solid #eee9e2;color:#51483f;font-size:12px">${escapeHtml(statements[0].roomLabel)}<br>${escapeHtml(statements[0].stay)}</td></tr>` : ''}
              </table>
              <p style="margin:19px 0 0;color:#6f675f;font-size:11px;line-height:1.65">Need help with this invoice? Please contact the SiayanRock team and include your booking reference.</p>
            </td></tr>
            <tr><td align="center" style="padding:17px 18px 0;color:#8c857d;font-size:10px;line-height:1.6">
              Thank you for choosing SiayanRock.<br>
              <span style="color:#aaa29a">This statement was sent to you about your booking${bookings.length === 1 ? '' : 's'}.</span>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`

  let resendResponse: Response
  try {
    resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromEmail, to: [recipient], subject: invoiceSubject, html, text }),
    })
  } catch (error) {
    console.error('Unable to reach Resend:', error)
    return jsonResponse({ error: 'Unable to reach Resend. Check the function network configuration.' }, 502)
  }

  if (!resendResponse.ok) {
    console.error('Resend rejected the booking invoice:', resendResponse.status, await resendResponse.text())
    return jsonResponse({ error: 'Resend could not deliver the invoice. Check the sender domain and API key.' }, 502)
  }

  const sentAt = new Date().toISOString()
  const { error: trackingError } = await supabase
    .from('bookings')
    .update({ invoice_sent_at: sentAt })
    .in('id', bookingIds)

  if (trackingError) {
    console.error('Invoice email was sent, but booking invoice timestamps could not be saved:', trackingError)
    return jsonResponse({
      success: true,
      email: recipient,
      bookingCount: bookings.length,
      trackingError: trackingError.message,
    })
  }

  return jsonResponse({ success: true, email: recipient, bookingCount: bookings.length, sentAt })
})
