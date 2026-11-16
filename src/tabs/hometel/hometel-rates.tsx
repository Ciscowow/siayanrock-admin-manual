import { useEffect, useState } from 'react'
import { Bike, CarFront, Check } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import './css/hometel-rates.css'

type TourPromo = {
  id: number | null
  max_pax: number
  nights: number
  price_with_lunch: string
  price_without_lunch: string
}

export function RatesPage() {
  const [tourPromos, setTourPromos] = useState<TourPromo[]>([])
  const [savedTourPromos, setSavedTourPromos] = useState<TourPromo[] | null>(null)
  const [tourPromosLoading, setTourPromosLoading] = useState(true)
  const [tourPromosSaving, setTourPromosSaving] = useState(false)
  const [tourPromosError, setTourPromosError] = useState('')
  const [transferPrices, setTransferPrices] = useState({ van: '', tricycle: '' })
  const [savedTransferPrices, setSavedTransferPrices] = useState<{ van: string; tricycle: string } | null>(null)
  const [transferPricesLoading, setTransferPricesLoading] = useState(true)
  const [transferPricesSaving, setTransferPricesSaving] = useState(false)
  const [transferPricesError, setTransferPricesError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadTourPromos = async () => {
      const { data, error: loadError } = await supabase
        .from('tour_promos')
        .select('*')
        .order('nights', { ascending: true })

      if (loadError) {
        console.error('Unable to load tour promos:', loadError)
        if (isMounted) {
          setTourPromosError(`Unable to load tour promos: ${loadError.message}`)
          setTourPromosLoading(false)
        }
        return
      }

      if (!isMounted) return

      const loadedPromos = (data ?? []).map((promo) => ({
        id: promo.id ?? null,
        max_pax: Number(promo.max_pax),
        nights: Number(promo.nights),
        price_with_lunch: String(promo.price_with_lunch ?? ''),
        price_without_lunch: String(promo.price_without_lunch ?? ''),
      }))

      setTourPromos(loadedPromos)
      setSavedTourPromos(loadedPromos)
      setTourPromosLoading(false)
    }

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

    void loadTourPromos()
    void loadTransferPrices()
    return () => { isMounted = false }
  }, [])

  const updateTourPromoRow = (nights: number, field: 'price_with_lunch' | 'price_without_lunch', value: string) => {
    setTourPromos((current) => current.map((promo) => promo.nights === nights ? { ...promo, [field]: value } : promo))
    setTourPromosError('')
  }

  const tourPromosChanged = savedTourPromos !== null && JSON.stringify(tourPromos) !== JSON.stringify(savedTourPromos)
  const tourPromosValid = tourPromos.every((promo) => promo.price_with_lunch.trim() !== '' && Number.isFinite(Number(promo.price_with_lunch)) && Number(promo.price_with_lunch) >= 0 && promo.price_without_lunch.trim() !== '' && Number.isFinite(Number(promo.price_without_lunch)) && Number(promo.price_without_lunch) >= 0)

  const saveTourPromos = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!savedTourPromos || !tourPromosValid) return

    setTourPromosSaving(true)
    setTourPromosError('')

    const { error: saveError } = await supabase.from('tour_promos').upsert(
      tourPromos.map((promo) => ({
        id: promo.id ?? undefined,
        max_pax: 2,
        nights: promo.nights,
        price_with_lunch: Number(promo.price_with_lunch),
        price_without_lunch: Number(promo.price_without_lunch),
        active: true,
      })),
      { onConflict: 'max_pax,nights' },
    )

    if (saveError) {
      console.error('Unable to save tour promos:', saveError)
      setTourPromosError(`Unable to save tour promos: ${saveError.message}`)
      setTourPromosSaving(false)
      return
    }

    setSavedTourPromos(tourPromos.map((promo) => ({ ...promo })))
    setTourPromosSaving(false)
  }

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
    <div className="page-heading"><div><p className="eyebrow">Hometel</p><h1>Rates</h1><p className="subtitle">Manage tour promos and airport transfer prices.</p></div></div>

    <section className="card tour-promos-card" aria-labelledby="tour-promos-title">
      <header>
        <p className="eyebrow">Tour promos</p>
        <h2 id="tour-promos-title">2 pax package rates</h2>
      </header>
      <form onSubmit={saveTourPromos}>
        <div className="tour-promo-table">
          <div className="tour-promo-header-row">
            <div>Duration</div>
            <div>With lunch</div>
            <div>W/o lunch</div>
          </div>

          {tourPromos.map((promo) => (
            <div key={promo.nights} className="tour-promo-row">
              <div className="tour-promo-duration">
                <span>{promo.nights === 2 ? '3D2N' : promo.nights === 3 ? '4D3N' : promo.nights === 4 ? '5D4N' : '6D5N'}</span>
                <small>{promo.nights} night{promo.nights > 1 ? 's' : ''}</small>
              </div>

              <label className="tour-promo-cell">
                <span className="tour-promo-currency" aria-hidden="true">₱</span>
                <input aria-label={`${promo.nights} nights with lunch price`} type="number" min="0" step="0.01" value={promo.price_with_lunch} disabled={tourPromosLoading || !savedTourPromos || tourPromosSaving} onChange={(event) => updateTourPromoRow(promo.nights, 'price_with_lunch', event.target.value)} />
              </label>

              <label className="tour-promo-cell">
                <span className="tour-promo-currency" aria-hidden="true">₱</span>
                <input aria-label={`${promo.nights} nights without lunch price`} type="number" min="0" step="0.01" value={promo.price_without_lunch} disabled={tourPromosLoading || !savedTourPromos || tourPromosSaving} onChange={(event) => updateTourPromoRow(promo.nights, 'price_without_lunch', event.target.value)} />
              </label>
            </div>
          ))}
        </div>
        {tourPromosError && <p className="transfer-prices-error" role="alert">{tourPromosError}</p>}
        <footer>
          <span role="status">{tourPromosLoading ? 'Loading promos…' : tourPromosChanged ? 'Unsaved changes' : 'No unsaved changes'}</span>
          <button className="button button-secondary" type="submit" disabled={tourPromosLoading || !savedTourPromos || !tourPromosChanged || !tourPromosValid || tourPromosSaving}>
            <Check size={16} /> {tourPromosSaving ? 'Saving…' : 'Save promos'}
          </button>
        </footer>
      </form>
    </section>

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
