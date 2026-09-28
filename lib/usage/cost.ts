/**
 * What an event costs to run, estimated from its usage with the rates in the
 * retention handoff (docs/handoff-retention-backups.md, "What it costs per
 * event"), as published on 28 Sep 2026. A lifetime figure: storage is counted
 * for the full 12 months in Supabase and 13 in R2 (the copy outlives the
 * original by 30 days). Pure, so it can be tested.
 */

export const RATES = {
  audPerUsd: 1.5,
  supabaseGbMonthUsd: 0.0213,
  r2GbMonthUsd: 0.015,
  faceCallUsd: 0.001,
  /** Supabase egress past the included quota; only thumbnails and previews come from Supabase now. */
  supabaseEgressGbUsd: 0.09,
  /** Previews are about 5% on top of an original (0.5 MB on 10 MB). */
  previewShare: 0.05,
  /** One photo viewed in the gallery moves about this much from Supabase. */
  viewMb: 0.5,
  stripePercent: 0.017,
  stripeFixedAud: 0.3,
  supabaseMonths: 12,
  r2Months: 13,
} as const;

export type UsageForCost = {
  originalBytes: number;
  backedUpBytes: number;
  faceCalls: number;
  views: number;
  /** A$ actually paid for the event, after promotion codes. */
  paidAud: number;
};

export type CostEstimate = {
  storageAud: number;
  backupAud: number;
  faceAud: number;
  egressAud: number;
  stripeAud: number;
  totalAud: number;
  /** Share of the price left after costs; null for events that paid nothing. */
  margin: number | null;
};

const GB = 1024 ** 3;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function estimateCost(usage: UsageForCost): CostEstimate {
  const r = RATES;
  const storedGb = (usage.originalBytes * (1 + r.previewShare)) / GB;
  const backedUpGb = (usage.backedUpBytes * (1 + r.previewShare)) / GB;
  const storageAud = storedGb * r.supabaseGbMonthUsd * r.supabaseMonths * r.audPerUsd;
  const backupAud = backedUpGb * r.r2GbMonthUsd * r.r2Months * r.audPerUsd;
  const faceAud = usage.faceCalls * r.faceCallUsd * r.audPerUsd;
  const egressAud = ((usage.views * r.viewMb) / 1024) * r.supabaseEgressGbUsd * r.audPerUsd;
  const stripeAud = usage.paidAud > 0 ? usage.paidAud * r.stripePercent + r.stripeFixedAud : 0;
  const totalAud = storageAud + backupAud + faceAud + egressAud + stripeAud;
  return {
    storageAud: round(storageAud),
    backupAud: round(backupAud),
    faceAud: round(faceAud),
    egressAud: round(egressAud),
    stripeAud: round(stripeAud),
    totalAud: round(totalAud),
    margin: usage.paidAud > 0 ? Math.round(((usage.paidAud - totalAud) / usage.paidAud) * 1000) / 1000 : null,
  };
}
