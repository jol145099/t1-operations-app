export type ServiceCategory =
  | '小時單'
  | '保底單'
  | '體驗單'
  | '教學單'
  | '勇敢者'
  | '女陪單'
  | '娛樂單'
  | '跑刀'
  | '撞車'
  | '撞紅'
  | '撞子彈'
  | '代解任務'
  | '實名'
  | '賽季3x3'
  | '調畫質'
  | '代儲'
  | '其他（訂製單）'

export type Secrecy = '機密' | '絕密'
export type Rank = 'B' | 'A' | 'S' | 'SR'
export type HourlyMode = '單陪' | '雙陪'

export const SERVICE_GROUPS: { label: string; items: ServiceCategory[] }[] = [
  { label: '護航陪玩', items: ['小時單', '保底單', '體驗單', '教學單', '勇敢者'] },
  { label: '女陪單', items: ['女陪單'] },
  { label: '娛樂單', items: ['娛樂單'] },
  { label: '跑刀撞車', items: ['跑刀', '撞車', '撞紅', '撞子彈'] },
  { label: '其他服務', items: ['代解任務', '實名', '賽季3x3', '調畫質', '代儲', '其他（訂製單）'] }
]

export const HOURLY_PRICE: Record<Secrecy, Record<Rank, number>> = {
  機密: { B: 300, A: 400, S: 500, SR: 700 },
  絕密: { B: 380, A: 550, S: 750, SR: 1000 }
}

export const GUARANTEE_PRICE: Record<Secrecy, Record<'1000w' | '3000w' | '5000w', number>> = {
  機密: { '1000w': 900, '3000w': 2500, '5000w': 3800 },
  絕密: { '1000w': 1100, '3000w': 3100, '5000w': 4900 }
}

export const FEMALE_TECH_PRICE: Record<Secrecy, Record<Rank, number>> = {
  機密: { B: 630, A: 740, S: 850, SR: 1070 },
  絕密: { B: 800, A: 980, S: 1200, SR: 1480 }
}

export const FEMALE_PURE_PRICE: Record<Secrecy, Record<'單陪' | '雙陪', number>> = {
  機密: { 單陪: 360, 雙陪: 590 },
  絕密: { 單陪: 440, 雙陪: 740 }
}

export const RUN_KNIFE_PRICE: Record<'1000w' | '5000w' | '1e', number> = {
  '1000w': 216,
  '5000w': 1080,
  '1e': 2160
}

export const COLLISION_PRICE: Record<'1000w' | '1500w' | '3000w' | '5000w' | '1e', number> = {
  '1000w': 216,
  '1500w': 425,
  '3000w': 850,
  '5000w': 1415,
  '1e': 2830
}

export const ENTERTAINMENT_OPTIONS = {
  賭紅單: [
    { label: '出1紅', price: 580 },
    { label: '出2紅', price: 1100 },
    { label: '單局出2紅', price: 1400 },
    { label: '出大紅', price: 2100 }
  ],
  家豪單: [{ label: '家豪單', price: 1588 }],
  小小巨人單: [
    { label: '小巨人', price: 5268 },
    { label: '迷你巨人', price: 2245 },
    { label: '自訂', price: 0 }
  ],
  賭約單: [
    { label: '賭油', price: 4680 },
    { label: '賭福利設備', price: 6100 },
    { label: '其他', price: 0 }
  ],
  環遊航天: [
    { label: '2處', price: 1888 },
    { label: '3處', price: 3628 },
    { label: '4處', price: 5518 },
    { label: '5處', price: 7688 },
    { label: '6處', price: 11188 },
    { label: '7處', price: 15828 }
  ]
} as const

export type EntertainmentType = keyof typeof ENTERTAINMENT_OPTIONS

export const TOPUP_OPTIONS = [
  { label: '60 三角幣', customer: 50, rmb: 6 },
  { label: '320 三角幣', customer: 180, rmb: 30 },
  { label: '750 三角幣', customer: 380, rmb: 68 },
  { label: '1480 三角幣', customer: 680, rmb: 128 },
  { label: '3950 三角幣', customer: 1750, rmb: 328 },
  { label: '8100 三角幣', customer: 3400, rmb: 648 },
  { label: '6元禮包', customer: 50, rmb: 6 },
  { label: '18元禮包', customer: 120, rmb: 18 }
] as const

export function ceilMoney(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.ceil(value)
}

export function defaultDispatchRate(category: ServiceCategory) {
  if (category === '體驗單') return 0.025
  if (category === '撞子彈') return 0.03
  if (category === '調畫質' || category === '代儲') return 0
  return 0.05
}

export function hourlyPricing(secrecy: Secrecy, hours: number, ranks: Rank[], mode: HourlyMode) {
  const singleMultiplier = mode === '單陪' ? 1.2 : 1
  const bases = ranks.map((rank) => HOURLY_PRICE[secrecy][rank])
  return {
    total: ceilMoney(bases.reduce((sum, price) => sum + price, 0) * hours * singleMultiplier),
    pays: bases.map((price) => ceilMoney(price * hours * singleMultiplier * 0.8))
  }
}

export function guaranteePricing(secrecy: Secrecy, tier: '1000w' | '3000w' | '5000w') {
  const total = GUARANTEE_PRICE[secrecy][tier]
  return { total, pays: [ceilMoney((total / 2) * 0.8), ceilMoney((total / 2) * 0.8)] }
}

export function trialPricing(period: '每日' | '每週') {
  const total = period === '每日' ? 598 : 999
  return { total, pays: [ceilMoney((total / 2) * 0.9), ceilMoney((total / 2) * 0.9)] }
}

export function teachingPricing(hours: number) {
  const total = ceilMoney(500 * hours)
  return { total, pays: [ceilMoney(total * 0.8)] }
}

export function bravePricing() {
  const total = 3680
  return { total, pays: [ceilMoney((total / 2) * 0.8), ceilMoney((total / 2) * 0.8)] }
}

export function femaleTechPricing(secrecy: Secrecy, rank: Rank, hours: number) {
  const total = ceilMoney(FEMALE_TECH_PRICE[secrecy][rank] * hours)
  const femaleBase = secrecy === '機密' ? 295 : 370
  return {
    total,
    pays: [
      ceilMoney(femaleBase * hours * 0.8),
      ceilMoney(HOURLY_PRICE[secrecy][rank] * 1.1 * hours * 0.8)
    ]
  }
}

export function femalePurePricing(secrecy: Secrecy, mode: '單陪' | '雙陪', hours: number) {
  const total = ceilMoney(FEMALE_PURE_PRICE[secrecy][mode] * hours)
  const count = mode === '單陪' ? 1 : 2
  const pay = ceilMoney((total / count) * 0.8)
  return { total, pays: Array.from({ length: count }, () => pay) }
}

export function entertainmentPricing(total: number) {
  const safeTotal = ceilMoney(Math.max(0, total))
  const pay = ceilMoney((safeTotal / 2) * 0.8)
  return { total: safeTotal, pays: [pay, pay] }
}

export function shouldRequirePlayers(category: ServiceCategory) {
  return ['小時單', '保底單', '體驗單', '教學單', '勇敢者', '女陪單', '娛樂單'].includes(category)
}

export function selfOrderDiscountAllowed(category: ServiceCategory) {
  return !['實名', '調畫質', '代儲'].includes(category)
}
