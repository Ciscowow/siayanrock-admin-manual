import { Plane } from 'lucide-react'
import './css/tours-payments.css'

export function ToursPaymentsTab() {
  return <div className="page-content-inner">
    <div className="page-heading">
      <div><p className="eyebrow">Tours workspace</p><h1>Payments</h1><p className="subtitle">Payments for tour reservations will appear here.</p></div>
    </div>
    <section className="card tour-empty-card">
      <div className="placeholder-icon"><Plane size={25} /></div>
      <h2>Tours data is not connected yet</h2>
      <p>Hometel data remains separate from Tours. Add tour-specific tables to Supabase to display tour data here.</p>
    </section>
  </div>
}
