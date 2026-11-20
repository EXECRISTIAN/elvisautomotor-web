'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import {
  Attention,
  Code,
  DeskHeader,
  DeskSection,
  DeskTable,
  Figure,
  Meter,
  Notice,
  Pill,
  Readout,
  ReadoutStrip,
  Segmented,
  Status,
  Td,
  Th,
  Tr,
  type DeskTone,
} from '@/features/platform/components/desk'
import { getAnalyticsData, type AnalyticsData } from '../actions'
import { monthLabel } from '../lib/monthLabel'
import { HairlineChart } from '../components/HairlineChart'

type Area = 'sales' | 'inventory' | 'service'
type Period = '6' | '12' | 'all'

/** Same threshold the inventory list uses for an aging unit. */
const AGED_UNIT_DAYS = 60

const AREA_OPTIONS = [
  { value: 'sales', label: 'Ventas' },
  { value: 'inventory', label: 'Inventario' },
  { value: 'service', label: 'Servicio' },
] as const

const PERIOD_OPTIONS = [
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
  { value: 'all', label: 'Todos' },
] as const

const statusTone: Record<string, DeskTone> = {
  available: 'ok',
  pending: 'warn',
  hold: 'info',
  service: 'idle',
  sold: 'accent',
}

const humanize = (value: string) => value.replace(/[-_]/g, ' ').replace(/^./, letter => letter.toUpperCase())

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-3 text-[13px] text-muted-foreground">{children}</p>
}

function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-10 items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground sm:min-h-0">
      {children}
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Link>
  )
}

/** Label, count and share of the total, as a dense table. Replaces the old rounded bar rows. */
function ShareTable({
  rows,
  empty,
  labelHeading,
  countHeading = 'Count',
  extraHeading,
}: {
  rows: Array<{ key: string; label: ReactNode; value: number; extra?: ReactNode }>
  empty: string
  labelHeading: string
  countHeading?: string
  extraHeading?: string
}) {
  if (!rows.length) return <Empty>{empty}</Empty>
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1
  return (
    <DeskTable>
      <thead>
        <tr>
          <Th>{labelHeading}</Th>
          <Th align="right">{countHeading}</Th>
          {extraHeading && <Th align="right" priority={2}>{extraHeading}</Th>}
          <Th align="right" priority={2}>Compartir</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <Tr key={row.key}>
            <Td className="max-w-[14rem] truncate">{row.label}</Td>
            <Td align="right" className="w-[1%] whitespace-nowrap">
              <Figure size="sm">{row.value}</Figure>
            </Td>
            {extraHeading && <Td align="right" priority={2} className="w-[1%] whitespace-nowrap text-muted-foreground">{row.extra}</Td>}
            <Td align="right" priority={2} className="w-[1%] whitespace-nowrap">
              <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
                <Meter value={row.value / total} label="Porcentaje del total" />
                <span className="w-9 text-right tabular-nums">{Math.round((row.value / total) * 100)}%</span>
              </span>
            </Td>
          </Tr>
        ))}
      </tbody>
    </DeskTable>
  )
}

/** Month-to-date cell: the label, the windshield figure, and the prior month beside it. */
export function AnalyticsDashboardPageClient({ initialData, timeZone }: { initialData: AnalyticsData; timeZone: string }) {
  const [data, setData] = useState<AnalyticsData>(initialData)
  const [loading, setLoading] = useState(false)
  const [area, setArea] = useState<Area>('sales')
  const [period, setPeriod] = useState<Period>('12')

  const loadData = async () => {
    setLoading(true)
    setData(await getAnalyticsData())
    setLoading(false)
  }

  const { sales: salesMetrics, inventory: inventoryMetrics, service: serviceMetrics, operations, currencyCode, error } = data

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(value)
  }
  const compactCurrency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: currencyCode, notation: 'compact', maximumFractionDigits: 0 })
  const platform = `${basePath}/platform`

  const breadcrumbs = [
    { type: 'link' as const, label: 'Inicio', href: basePath },
    { type: 'page' as const, label: 'Gestión' },
    { type: 'page' as const, label: 'Estadísticas' },
  ]

  const exceptions = operations?.exceptions?.total || 0
  const NO_DATA = '-'
  const opMetrics = operations?.metrics
  // Rates over an empty set have no value; the report returns 0 or 100 for those.
  const financePenetration = opMetrics?.deliveredDeals ? `${opMetrics.financeProductPenetrationPercent || 0}%` : NO_DATA
  const laborRate = opMetrics?.service?.soldHours ? formatCurrency((opMetrics.service.effectiveLaborRateCents || 0) / 100) : NO_DATA
  const partsFillRate = serviceMetrics?.partsCommittedQuantity && opMetrics?.parts?.fillRatePercent !== undefined ? `${opMetrics.parts.fillRatePercent}%` : NO_DATA

  // Month to date comes from the operational report's delivered-by-month buckets (calendar months, UTC, as the server groups them).
  const deliveredByMonth = opMetrics?.deliveredByMonth || []
  const currentKey = operations?.generatedAt ? operations.generatedAt.slice(0, 7) : null
  const previousKey = currentKey
    ? (() => {
        const [year, month] = currentKey.split('-').map(Number)
        return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
      })()
    : null
  const mtd = deliveredByMonth.find(item => item.month === currentKey) || { month: currentKey || '', revenueCents: 0, grossCents: 0, count: 0 }
  const lastMonth = deliveredByMonth.find(item => item.month === previousKey) || null
  const lastMonthName = previousKey ? monthLabel(previousKey) : 'Last month'
  const grossChart = deliveredByMonth.map(item => ({ month: item.month, label: monthLabel(item.month), gross: item.grossCents / 100 }))

  const agedUnits = (inventoryMetrics?.agingBreakdown || []).filter(bucket => bucket.range === '61-90' || bucket.range === '90+').reduce((sum, bucket) => sum + bucket.count, 0)
  const lowStock = opMetrics?.parts?.lowStockCount ?? serviceMetrics?.lowStockParts.length ?? 0
  const watch = [
    { key: 'aged', label: `Units over ${AGED_UNIT_DAYS} days in stock`, count: agedUnits, status: 'Aged', tone: 'warn' as DeskTone, href: `${platform}/vehicles`, place: 'Inventory' },
    { key: 'parts', label: 'Repuestos en o bajo el mínimo', count: lowStock, status: 'Low stock', tone: 'warn' as DeskTone, href: `${platform}/parts`, place: 'Parts' },
    { key: 'funding', label: 'Observaciones de fondeo', count: operations?.exceptions?.funding || 0, status: 'Exception', tone: 'bad' as DeskTone, href: `${platform}/finance`, place: 'Finance' },
    { key: 'payments', label: 'Excepciones de pago', count: operations?.exceptions?.payments || 0, status: 'Exception', tone: 'bad' as DeskTone, href: `${platform}/payments`, place: 'Payments' },
    { key: 'accounting', label: 'Excepciones contables', count: operations?.exceptions?.accounting || 0, status: 'Exception', tone: 'bad' as DeskTone, href: `${platform}/accounting`, place: 'Accounting' },
  ].filter(item => item.count > 0)

  const header = (
    <DeskHeader
      title="Estadísticas"
      tone={error ? 'bad' : exceptions > 0 ? 'warn' : 'ok'}
      status={error ? 'No disponible' : exceptions > 0 ? `${exceptions} excepciones abiertas` : 'Sin excepciones abiertas'}
      meta={
        error
          ? 'No disponible'
          : operations?.generatedAt
            ? `${currentKey ? `${monthLabel(currentKey)} en lo que va del mes` : 'En lo que va del mes'} · Actualizado ${new Date(operations.generatedAt).toLocaleString('es-AR', { timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
            : undefined
      }
      actions={
        <Pill variant="plain" className="h-10 sm:h-8" onClick={loadData} disabled={loading} aria-label="Actualizar">
          <RefreshCw className={loading ? 'animate-spin' : undefined} />
          {error ? 'Retry' : 'Refresh'}
        </Pill>
      }
    />
  )

  if (error) {
    return (
      <PageContainer title="Estadísticas" header={header} breadcrumbs={breadcrumbs}>
        <div className="px-4 pb-24 md:px-6">
          <Notice tone="bad">
            <p className="font-medium">No se pudieron cargar las estadísticas</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
          </Notice>
        </div>
      </PageContainer>
    )
  }

  const allMonths = salesMetrics?.salesByMonth || []
  const months = (period === 'all' ? allMonths : allMonths.slice(-Number(period))).map(month => ({ ...month, label: monthLabel(month.month) }))
  const periodGross = grossChart.filter(item => months.some(month => month.month === item.month))
  const periodUnits = months.reduce((sum, month) => sum + month.count, 0)
  const periodRevenue = months.reduce((sum, month) => sum + month.revenue, 0)
  const slowMoving = (inventoryMetrics?.slowMoving || []).filter(v => v.daysInStock > AGED_UNIT_DAYS)
  const isCurrent = (row: { month: string }) => row.month === currentKey

  return (
    <PageContainer title="Estadísticas" header={header} breadcrumbs={breadcrumbs}>
    <div className="min-w-0 max-w-full space-y-8 overflow-x-hidden px-4 pb-24 md:px-6 [&_.recharts-responsive-container]:max-w-full">

      <section aria-labelledby="analytics-mtd" className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2 border-b border-foreground/15 pb-2">
          <h2 id="analytics-mtd" className="text-[15px] font-semibold text-foreground">
            {currentKey ? `${monthLabel(currentKey)} en lo que va del mes` : 'En lo que va del mes'}
          </h2>
          <span className="text-[12px] text-muted-foreground">Operaciones entregadas por fecha de venta</span>
        </div>
        <ReadoutStrip className="mt-3">
          <Readout
            label="Unidades entregadas"
            value={mtd.count}
            sub={lastMonth ? `${lastMonthName}: ${lastMonth.count}` : `${lastMonthName}: sin datos`}
          />
          <Readout
            label="Margen"
            value={formatCurrency(mtd.grossCents / 100)}
            sub={lastMonth ? `${lastMonthName}: ${formatCurrency(lastMonth.grossCents / 100)}` : `${lastMonthName}: sin datos`}
          />
          <Readout
            label="Margen por unidad"
            value={mtd.count ? formatCurrency(mtd.grossCents / 100 / mtd.count) : NO_DATA}
            sub={lastMonth?.count ? `${lastMonthName}: ${formatCurrency(lastMonth.grossCents / 100 / lastMonth.count)}` : undefined}
          />
          <Readout
            label="Facturación entregada"
            value={formatCurrency(mtd.revenueCents / 100)}
            sub={lastMonth ? `${lastMonthName}: ${formatCurrency(lastMonth.revenueCents / 100)}` : undefined}
          />
        </ReadoutStrip>
      </section>

      {watch.length > 0 && (
        <DeskSection id="analytics-watch" title="Requiere atención" count={watch.length}>
          <ul className="divide-y rounded-md border bg-card">
            {watch.map(item => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-2.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none sm:grid-cols-[7.5rem_minmax(0,1fr)_4rem_7rem]"
                >
                  <span className="max-sm:hidden"><Status tone={item.tone}>{item.status}</Status></span>
                  <span className="min-w-0 truncate text-[14px] font-medium text-foreground">{item.label}</span>
                  <span className="text-right"><Figure size="md" attention>{item.count}</Figure></span>
                  <span className="inline-flex items-center justify-end gap-1 text-[12px] font-medium max-sm:hidden">
                    {item.place}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </DeskSection>
      )}

      <ReadoutStrip>
        <Readout label="Penetración de financiación" value={financePenetration} sub={financePenetration === NO_DATA ? 'Sin entregas' : undefined} />
        <Readout label="Tarifa efectiva de mano de obra" value={laborRate} sub={laborRate === NO_DATA ? 'Sin horas vendidas' : undefined} />
        <Readout label="Tasa de cumplimiento de repuestos" value={partsFillRate} sub={partsFillRate === NO_DATA ? 'Sin repuestos comprometidos' : undefined} />
        <Readout
          label="Excepciones abiertas"
          value={exceptions}
          sub={`${operations?.exceptions?.accounting || 0} accounting · ${operations?.exceptions?.payments || 0} payments · ${operations?.exceptions?.funding || 0} funding`}
        />
      </ReadoutStrip>

      <Segmented label="Área de estadísticas" value={area} onChange={setArea} options={AREA_OPTIONS} />

      {area === 'sales' && (
        <div className="space-y-8">
          <DeskSection
            id="analytics-by-month"
            title="Por mes"
            actions={<Segmented label="Período" size="sm" value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />}
          >
            <div className="space-y-4">
              <p className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted-foreground">
                <span>Unidades <Figure size="sm" className="ml-1 text-foreground">{periodUnits}</Figure></span>
                <span>Facturación <Figure size="sm" className="ml-1 text-foreground">{formatCurrency(periodRevenue)}</Figure></span>
                <span>Entregado histórico <Figure size="sm" className="ml-1 text-foreground">{salesMetrics?.totalSales || 0}</Figure></span>
                <span>Margen promedio por operación <Figure size="sm" className="ml-1 text-foreground">{salesMetrics?.totalSales ? formatCurrency(salesMetrics.avgDealProfit || 0) : NO_DATA}</Figure></span>
              </p>
              {months.length ? (
                <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-3">
                  <div className="min-w-0">
                    <p className="mb-1 text-[12px] font-medium text-muted-foreground">Unidades entregadas</p>
                    <HairlineChart data={months} xKey="label" yKey="count" label="Unidades" highlight={isCurrent} yWidth={28} />
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 text-[12px] font-medium text-muted-foreground">Margen</p>
                    {periodGross.length ? (
                      <HairlineChart data={periodGross} xKey="label" yKey="gross" label="Margen" highlight={isCurrent} yWidth={52} format={value => compactCurrency.format(value)} />
                    ) : (
                      <Empty>Sin margen registrado</Empty>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 text-[12px] font-medium text-muted-foreground">Facturación</p>
                    <HairlineChart data={months} xKey="label" yKey="revenue" label="Facturación" highlight={isCurrent} yWidth={52} format={value => compactCurrency.format(value)} />
                  </div>
                </div>
              ) : (
                <Empty>Sin entregas</Empty>
              )}
            </div>
          </DeskSection>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <DeskSection id="analytics-reps" title="Vendedores" count={salesMetrics?.salesByRep.length || 0}>
              {salesMetrics?.salesByRep.length ? (
                <DeskTable>
                  <thead>
                    <tr>
                      <Th>Vendedor</Th>
                      <Th align="right">Unidades</Th>
                      <Th align="right">Facturación</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesMetrics.salesByRep.slice(0, 10).map((rep, index) => (
                      <Tr key={`${rep.name}-${index}`}>
                        <Td className="max-w-[14rem] truncate font-medium">{rep.name}</Td>
                        <Td align="right"><Figure size="sm">{rep.count}</Figure></Td>
                        <Td align="right" className="whitespace-nowrap text-muted-foreground">{formatCurrency(rep.revenue)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </DeskTable>
              ) : (
                <Empty>Sin operaciones entregadas</Empty>
              )}
            </DeskSection>

            <DeskSection id="analytics-makes" title="Ventas por marca" count={salesMetrics?.vehiclesSold.length || 0}>
              <ShareTable
                labelHeading="Make"
                countHeading="Units"
                empty="Sin operaciones entregadas"
                rows={(salesMetrics?.vehiclesSold || []).slice(0, 10).map(item => ({ key: item.make, label: item.make, value: item.count }))}
              />
            </DeskSection>
          </div>

          <DeskSection id="analytics-top-vehicles" title="Vehículos más vendidos" count={salesMetrics?.topVehicles?.length || 0}>
            {salesMetrics?.topVehicles?.length ? (
              <DeskTable>
                <thead>
                  <tr>
                    <Th>Vehículo</Th>
                    <Th align="right">Vendido</Th>
                    <Th align="right" priority={2}>Facturación</Th>
                  </tr>
                </thead>
                <tbody>
                  {salesMetrics.topVehicles.map(vehicle => (
                    <Tr key={`${vehicle.year}-${vehicle.make}-${vehicle.model}`}>
                      <Td className="max-w-[18rem] truncate font-medium">{vehicle.year} {vehicle.make} {vehicle.model}</Td>
                      <Td align="right"><Figure size="sm">{vehicle.count}</Figure></Td>
                      <Td align="right" priority={2} className="whitespace-nowrap text-muted-foreground">{formatCurrency(vehicle.revenue)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </DeskTable>
            ) : (
              <Empty>Sin ventas</Empty>
            )}
          </DeskSection>
        </div>
      )}

      {area === 'inventory' && (
        <div className="space-y-8">
          <DeskSection
            id="analytics-slow"
            title={`Over ${AGED_UNIT_DAYS} days in stock`}
            count={slowMoving.length}
            actions={<SectionLink href={`${platform}/vehicles`}>Inventario</SectionLink>}
          >
            {slowMoving.length ? (
              <DeskTable>
                <thead>
                  <tr>
                    <Th>Estado</Th>
                    <Th>Vehículo</Th>
                    <Th priority={2}>Stock n.º</Th>
                    <Th align="right" priority={2}>Precio</Th>
                    <Th align="right">Días</Th>
                  </tr>
                </thead>
                <tbody>
                  {slowMoving.map(vehicle => (
                    <Tr key={vehicle.id}>
                      <Td className="w-[1%]">
                        <Status tone={vehicle.daysInStock > 90 ? 'bad' : 'warn'}>{vehicle.daysInStock > 90 ? '90+ days' : '61-90 days'}</Status>
                      </Td>
                      <Td className="max-w-[16rem]">
                        <Link href={`${platform}/vehicles/${vehicle.id}`} className="block truncate font-medium text-foreground hover:underline">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </Link>
                        <span className="md:hidden"><Code>#{vehicle.stockNumber}</Code></span>
                      </Td>
                      <Td priority={2} className="whitespace-nowrap"><Code>#{vehicle.stockNumber}</Code></Td>
                      <Td align="right" priority={2} className="whitespace-nowrap text-muted-foreground">{formatCurrency(vehicle.price)}</Td>
                      <Td align="right" className="whitespace-nowrap"><Figure size="sm" attention>{vehicle.daysInStock}</Figure></Td>
                    </Tr>
                  ))}
                </tbody>
              </DeskTable>
            ) : (
              <Empty>No units over {AGED_UNIT_DAYS} days</Empty>
            )}
          </DeskSection>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <DeskSection id="analytics-aging" title="Antigüedad de unidades disponibles">
              {inventoryMetrics?.agingBreakdown?.length ? (
                <HairlineChart
                  data={inventoryMetrics.agingBreakdown.map(bucket => ({ ...bucket, label: `${bucket.range} days` }))}
                  xKey="label"
                  yKey="count"
                  label="Unidades"
                  yWidth={28}
                  highlight={bucket => bucket.range === '61-90' || bucket.range === '90+'}
                />
              ) : (
                <Empty>Sin vehículos</Empty>
              )}
            </DeskSection>

            <DeskSection id="analytics-status" title="Por estado" count={inventoryMetrics?.totalVehicles || 0}>
              <ShareTable
                labelHeading="Status"
                countHeading="Units"
                empty="No vehicles"
                rows={(inventoryMetrics?.vehiclesByStatus || []).map(item => ({
                  key: item.status,
                  label: <Status tone={statusTone[item.status] || 'idle'}>{humanize(item.status)}</Status>,
                  value: item.count,
                }))}
              />
            </DeskSection>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <DeskSection id="analytics-condition" title="Por condición">
              <ShareTable
                labelHeading="Condition"
                countHeading="Units"
                empty="No vehicles"
                rows={(inventoryMetrics?.vehiclesByCondition || []).map(item => ({ key: item.condition, label: humanize(item.condition), value: item.count }))}
              />
            </DeskSection>

            <ReadoutStrip className="self-start">
              <Readout label="Total de vehículos" value={inventoryMetrics?.totalVehicles || 0} />
              <Readout label="Valor del inventario" value={formatCurrency(inventoryMetrics?.totalValue || 0)} />
              <Readout
                label="Días promedio en stock"
                value={inventoryMetrics?.totalVehicles ? Math.round(inventoryMetrics.avgDaysInStock || 0) : NO_DATA}
                sub={inventoryMetrics?.avgDaysInStock && inventoryMetrics.avgDaysInStock > AGED_UNIT_DAYS ? <Attention>Antiguos</Attention> : undefined}
              />
              <Readout label="Disponible" value={inventoryMetrics?.vehiclesByStatus.find(s => s.status === 'available')?.count || 0} />
            </ReadoutStrip>
          </div>
        </div>
      )}

      {area === 'service' && (
        <div className="space-y-8">
          <ReadoutStrip>
            <Readout label="Today's appointments" value={serviceMetrics?.todayAppointments || 0} />
            <Readout label="Órdenes activas" value={serviceMetrics?.activeRepairOrders || 0} />
            <Readout label="Facturación de órdenes cerradas" value={formatCurrency(serviceMetrics?.serviceRevenue || 0)} />
            <Readout label="Promedio por orden cerrada" value={serviceMetrics?.settledRepairOrders ? formatCurrency(serviceMetrics.avgRepairOrder || 0) : NO_DATA} />
          </ReadoutStrip>

          <DeskSection
            id="analytics-low-stock"
            title="Repuestos con poco stock"
            count={serviceMetrics?.lowStockParts?.length || 0}
            actions={<SectionLink href={`${platform}/parts`}>Repuestos</SectionLink>}
          >
            {serviceMetrics?.lowStockParts?.length ? (
              <DeskTable>
                <thead>
                  <tr>
                    <Th>Repuesto n.º</Th>
                    <Th>Descripción</Th>
                    <Th align="right">En existencia</Th>
                    <Th align="right" priority={2}>Mínimo</Th>
                  </tr>
                </thead>
                <tbody>
                  {serviceMetrics.lowStockParts.map(part => (
                    <Tr key={part.id}>
                      <Td className="whitespace-nowrap">
                        <Link href={`${platform}/parts/${part.id}`} className="hover:underline"><Code className="text-foreground">#{part.partNumber}</Code></Link>
                      </Td>
                      <Td className="max-w-[16rem] truncate">{part.description}</Td>
                      <Td align="right"><Figure size="sm" attention>{part.quantity}</Figure></Td>
                      <Td align="right" priority={2} className="text-muted-foreground">{part.minimumQuantity}</Td>
                    </Tr>
                  ))}
                </tbody>
              </DeskTable>
            ) : (
              <Empty>Sin repuestos con poco stock</Empty>
            )}
          </DeskSection>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <DeskSection id="analytics-ro-status" title="Órdenes de taller por estado">
              <ShareTable
                labelHeading="Status"
                countHeading="ROs"
                extraHeading="Total"
                empty="No repair orders"
                rows={(serviceMetrics?.repairOrdersByStatus || []).map(item => ({ key: item.status, label: humanize(item.status), value: item.count, extra: formatCurrency(item.revenue) }))}
              />
            </DeskSection>

            <DeskSection id="analytics-appt-status" title="Citas por estado">
              <ShareTable
                labelHeading="Status"
                empty="No appointments"
                rows={(serviceMetrics?.appointmentsByStatus || []).map(item => ({ key: item.status, label: humanize(item.status), value: item.count }))}
              />
            </DeskSection>
          </div>

          <DeskSection id="analytics-mix" title="Mezcla de servicios">
            <ShareTable
              labelHeading="Service type"
              countHeading="Appointments"
              empty="No appointments"
              rows={(serviceMetrics?.serviceTypeBreakdown || []).map(item => ({ key: item.serviceType, label: humanize(item.serviceType), value: item.count }))}
            />
          </DeskSection>
        </div>
      )}
    </div>
    </PageContainer>
  )
}
