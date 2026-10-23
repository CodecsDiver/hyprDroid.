import { HeartTapLedger } from '@/domain/heartSync'
import { serverNow } from './live'

const ledger = new HeartTapLedger()

/** Records my heart tap; true when the partner tapped within the sync window. */
export function recordMyHeartTap(): boolean {
  return ledger.recordMine(serverNow())
}

/** Records the partner's tap (by its server timestamp); true when it lines up with mine. */
export function recordPartnerHeartTap(atMs: number): boolean {
  return ledger.recordPartner(atMs)
}
