import { useEffect, useState } from 'react'
import { Bike, CarFront, Check } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import './css/hometel-rates.css'

export function RatesPage() {
  const [transferPrices, setTransferPrices] = useState({ van: '', tricycle: '' })
  const [savedTransferPrices, setSavedTransferPrices] = useState<{ van: string; tricycle: string } | null>(null)
  const [transferPricesLoading, setTransferPricesLoading] = useState(true)
  const [transferPricesSaving, setTransferPricesSaving] = useState(false)
  const [transferPricesError, setTransferPricesError] = useState('')

  useEffect(() => {
    let isMounted = true
    const loadTransferPrices = async () => {
      const { data, error: loadError } = await supabase
        .from('transfer_rates')
        .select('vehicle_type, price')

      if (loadError) {
        console.error('Unable to load airport transfer prices:', loadError)
        if (isMounted) {
          setTransferPricesError(`Unable to load airport transfer prices: ${loadError.message}`)
          setTransferPricesLoading(false)
        }
        return
      }

      if (!isMounted) return
      const rates = new Map<string, string>()
      data.forEach((rate) => {
        const vehicleType = String(rate.vehicle_type).trim().toLowerCase()
        if (!rates.has(vehicleType) || rate.vehicle_type === vehicleType) {
          rates.set(vehicleType, String(rate.price))
        }
      })
      const loadedPrices = {
        van: rates.get('van') ?? '',
        tricycle: rates.get('tricycle') ?? '',
      }
      if (!loadedPrices.van || !loadedPrices.tricycle) {
        setTransferPricesError('The transfer_rates table needs one row each for vehicle_type "van" and "tricycle", with a price for each.')
        setTransferPricesLoading(false)
        return
      }

      setTransferPrices(loadedPrices)
      setSavedTransferPrices(loadedPrices)
      setTransferPricesLoading(false)
    }

    void loadTransferPrices()
    return () => { isMounted = false }
  }, [])

  const transferPricesChanged = savedTransferPrices !== null &&
    (transferPrices.van !== savedTransferPrices.van || transferPrices.tricycle !== savedTransferPrices.tricycle)
  const transferPricesValid = [transferPrices.van, transferPrices.tricycle]
    .every((price) => price.trim() !== '' && Number.isFinite(Number(price)) && Number(price) >= 0)
  const saveTransferPrices = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!savedTransferPrices || !transferPricesValid) return

    setTransferPricesSaving(true)
    setTransferPricesError('')
    const { error: saveError } = await supabase.from('transfer_rates').upsert([
      { vehicle_type: 'van', price: Number(transferPrices.van) },
      { vehicle_type: 'tricycle', price: Number(transferPrices.tricycle) },
    ], { onConflict: 'vehicle_type' })

    if (saveError) {
      console.error('Unable to save airport transfer prices:', saveError)
      setTransferPricesError(`Unable to save airport transfer prices: ${saveError.message}`)
      setTransferPricesSaving(false)
      return
    }

    setSavedTransferPrices({ ...transferPrices })
    setTransferPricesSaving(false)
  }

  return <>
    <div className="page-heading"><div><p className="eyebrow">Hometel</p><h1>Rates</h1><p className="subtitle">Manage airport transfer prices.</p></div></div>
    <section className="card transfer-prices-card" aria-labelledby="transfer-prices-title">
      <header>
        <p className="eyebrow">Settings</p>
        <h2 id="transfer-prices-title">Airport transfer prices</h2>
      </header>
      <form onSubmit={saveTransferPrices}>
        <div className="transfer-price-rows">
          <label className="transfer-price-row">
            <CarFront size={20} aria-hidden="true" />
            <span>Van</span>
            <span className="transfer-price-currency" aria-hidden="true">₱</span>
            <input aria-label="Van price in Philippine pesos" type="number" min="0" step="0.01" value={transferPrices.van} disabled={transferPricesLoading || !savedTransferPrices || transferPricesSaving} onChange={(event) => {
              setTransferPrices({ ...transferPrices, van: event.target.value })
              setTransferPricesError('')
            }} />
          </label>
          <label className="transfer-price-row">
            <Bike size={20} aria-hidden="true" />
            <span>Tricycle</span>
            <span className="transfer-price-currency" aria-hidden="true">₱</span>
            <input aria-label="Tricycle price in Philippine pesos" type="number" min="0" step="0.01" value={transferPrices.tricycle} disabled={transferPricesLoading || !savedTransferPrices || transferPricesSaving} onChange={(event) => {
              setTransferPrices({ ...transferPrices, tricycle: event.target.value })
              setTransferPricesError('')
            }} />
          </label>
        </div>
        {transferPricesError && <p className="transfer-prices-error" role="alert">{transferPricesError}</p>}
        <footer>
          <span role="status">{transferPricesLoading ? 'Loading prices…' : transferPricesChanged ? 'Unsaved changes' : 'No unsaved changes'}</span>
          <button className="button button-secondary" type="submit" disabled={transferPricesLoading || !savedTransferPrices || !transferPricesChanged || !transferPricesValid || transferPricesSaving}>
            <Check size={16} /> {transferPricesSaving ? 'Saving…' : 'Save prices'}
          </button>
        </footer>
      </form>
    </section>
  </>
}
