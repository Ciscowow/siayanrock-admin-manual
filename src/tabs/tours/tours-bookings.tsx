import { Plane } from 'lucide-react'
import './css/tours-bookings.css'

export function ToursBookingsTab() {
  return <div className="page-content-inner">
    <div className="page-heading">
      <div><p className="eyebrow">Tours workspace</p><h1>Bookings</h1><p className="subtitle">Tour reservations will appear here.</p></div>
    </div>
    <section className="card tour-empty-card">
      <div className="placeholder-icon"><Plane size={25} /></div>
      <h2>Tours data is not connected yet</h2>
      <p>Hometel data remains separate from Tours. Add tour-specific tables to Supabase to display tour data here.</p>
    </section>
  </div>
}
