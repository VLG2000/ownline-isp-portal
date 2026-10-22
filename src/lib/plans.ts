// Plans on offer. Shared by the service API and the dashboard.
export const PLANS = {
  basic: { name: "Basic 25", downMbps: 25, upMbps: 5, priceAud: 55 },
  standard: { name: "Standard 100", downMbps: 100, upMbps: 20, priceAud: 75 },
  fast: { name: "Fast 500", downMbps: 500, upMbps: 50, priceAud: 95 },
} as const;
export type PlanId = keyof typeof PLANS;
export type Plan = (typeof PLANS)[PlanId];
