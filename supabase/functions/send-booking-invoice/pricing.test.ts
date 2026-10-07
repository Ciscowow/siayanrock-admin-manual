import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateInvoicePricing } from './pricing.ts'

test('separates the room stay and three additional guests for a five-guest, two-night stay', () => {
  const pricing = calculateInvoicePricing(2700 * 2, 5, 2)

  assert.equal(pricing.roomStayAmount, 5400)
  assert.equal(pricing.additionalGuestCount, 3)
  assert.equal(pricing.additionalGuestNightlyRate, 600)
  assert.equal(pricing.additionalGuestCharge, 3600)
  assert.equal(pricing.total, 9000)
})

test('does not add a charge when the booking has two or fewer guests', () => {
  assert.equal(calculateInvoicePricing(8000, 2, 3).additionalGuestCharge, 0)
  assert.equal(calculateInvoicePricing(8000, 1, 3).total, 8000)
})
