export const INCLUDED_GUEST_COUNT = 2
export const ADDITIONAL_GUEST_NIGHTLY_RATE = 600

export const calculateInvoicePricing = (
  roomStayAmount: number,
  guestCount: number,
  nights: number,
) => {
  const additionalGuestCount = Math.max(0, guestCount - INCLUDED_GUEST_COUNT)
  const additionalGuestCharge = additionalGuestCount * nights * ADDITIONAL_GUEST_NIGHTLY_RATE

  return {
    roomStayAmount,
    additionalGuestCount,
    additionalGuestNightlyRate: ADDITIONAL_GUEST_NIGHTLY_RATE,
    additionalGuestCharge,
    total: roomStayAmount + additionalGuestCharge,
  }
}
