/** Original synthetic fixture. No external services, real data or network. */
export function evaluateRequest({ estimatedAmount, offersReceived, isEmergency }) {
  if (!Number.isFinite(estimatedAmount) || estimatedAmount <= 0) {
    return { status: 'INVALID', reason: 'AMOUNT_INVALID' };
  }
  if (!Number.isInteger(offersReceived) || offersReceived < 0) {
    return { status: 'INVALID', reason: 'OFFERS_INVALID' };
  }
  if (estimatedAmount >= 100000 && offersReceived < 2) {
    return { status: 'REVIEW', reason: 'LARGE_REQUEST_INSUFFICIENT_OFFERS' };
  }
  if (isEmergency) {
    return { status: 'REVIEW', reason: 'EMERGENCY_REQUIRES_REVIEW' };
  }
  return { status: 'READY_FOR_HUMAN', reason: 'DOCUMENTS_READY' };
}
