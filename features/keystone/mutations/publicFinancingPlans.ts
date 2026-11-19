import { parseTerms } from '../../lib/financing/simulate'

/** Planes activos y vigentes de bancos activos, para el simulador público. Sin notas internas. */
export async function loadActiveFinancingPlans(context: any, now = new Date()) {
  const plans = await context.sudo().prisma.financingPlan.findMany({
    where: {
      active: true,
      bank: { is: { active: true } },
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
      ],
    },
    include: { bank: { select: { name: true, providerKey: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    take: 50,
  })
  return plans
    .map((plan: any) => ({
      id: plan.id,
      bankName: plan.bank?.name || '',
      providerKey: plan.bank?.providerKey || 'manual',
      name: plan.name,
      tnaBps: plan.tnaBps,
      teaBps: plan.teaBps ?? null,
      cftBps: plan.cftBps ?? null,
      termsMonths: parseTerms(plan.termsMonths),
      minAmountCents: plan.minAmountCents ?? null,
      maxAmountCents: plan.maxAmountCents ?? null,
      maxFinancedBps: plan.maxFinancedBps ?? null,
      amortization: plan.amortization === 'aleman' ? 'aleman' : 'frances',
      validUntil: plan.validUntil ?? null,
      extraCosts: plan.extraCosts || '',
      requirements: plan.requirements || '',
    }))
    .filter((plan: any) => plan.tnaBps != null && plan.termsMonths.length > 0)
}

export async function publicFinancingPlans(_root: unknown, _args: unknown, context: any) {
  const plans = await loadActiveFinancingPlans(context)
  return plans.map(({ providerKey: _providerKey, ...plan }: any) => plan)
}
