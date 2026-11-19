import { getCustomerPayments, getCustomerPurchases } from '../actions/customerRecords'
import { AccountEmpty, AccountError, AccountHeader, AccountSection } from '../components/account/AccountStates'
import { Sticker, type StickerRowData } from '../components/forms/RequestForm'
import { formatCents, formatDate, formatDateTime, statusLabel, statusTone, type CustomerPayment, type CustomerPurchase } from '../lib/accountRecords'

const DEAL_STATUS: Record<string, string> = {
  submitted: 'En revisión',
  approved: 'Aprobada',
  financed: 'Financiado',
  delivered: 'Entregado',
  cancelled: 'Cancelada',
}

function purchaseRows(deal: CustomerPurchase): StickerRowData[] {
  return [
    ...(deal.vehicle?.stockNumber ? [{ label: 'Stock', value: deal.vehicle.stockNumber }] : []),
    ...(deal.vehicle?.vin ? [{ label: 'Chasis (VIN)', value: deal.vehicle.vin }] : []),
    ...(deal.saleDate ? [{ label: 'Fecha de venta', value: formatDate(deal.saleDate, deal.timezone) }] : []),
    { label: 'Precio del vehículo', value: formatCents(deal.vehiclePriceCents) },
    ...(deal.tradeInValueCents ? [{ label: 'Valor del usado', value: formatCents(deal.tradeInValueCents) }] : []),
    ...(deal.taxAmountCents ? [{ label: 'Impuestos', value: formatCents(deal.taxAmountCents) }] : []),
    ...(deal.totalPriceCents != null ? [{ label: 'Total', value: formatCents(deal.totalPriceCents), strong: true }] : []),
    ...(deal.downPaymentCents ? [{ label: 'Anticipo', value: formatCents(deal.downPaymentCents) }] : []),
    ...(deal.financingAmountCents ? [{ label: 'Financiado', value: formatCents(deal.financingAmountCents) }] : []),
    ...(deal.monthlyPaymentCents ? [{ label: 'Cuota mensual', value: formatCents(deal.monthlyPaymentCents) }] : []),
    ...(deal.loanTerm ? [{ label: 'Plazo', value: `${deal.loanTerm} mo` }] : []),
    ...(deal.apr != null && deal.financingAmountCents ? [{ label: 'TNA', value: `${Number(deal.apr).toFixed(2)}%` }] : []),
  ]
}

function PaymentList({ payments }: { payments: CustomerPayment[] }) {
  return (
    <ul className="border-t" style={{ borderColor: 'var(--sf-rule)' }}>
      {payments.map((payment) => (
        <li key={payment.id} className="grid gap-x-6 gap-y-1 border-b py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline" style={{ borderColor: 'var(--sf-rule)' }}>
          <div className="min-w-0">
            <p className="sf-title-line">
              <span className="sf-dot" data-tone={statusTone(payment.status)} aria-hidden="true" />
              <span className="sf-heading">{payment.label || (payment.sourceType === 'service' ? 'Pago de taller' : 'Pago del vehículo')}</span>
              <span className="sf-muted text-[length:var(--sf-text-sm)]">{statusLabel(payment.status)}</span>
            </p>
            <p className="sf-muted mt-1 pl-4 text-[length:var(--sf-text-sm)]">{formatDateTime(payment.createdAt, payment.timezone)}</p>
          </div>
          <div className="pl-4 sm:pl-0 sm:text-right">
            <p className="sf-price">{formatCents(payment.amountCents, payment.currency)}</p>
            {payment.refundedCents > 0 && (
              <p className="sf-muted text-[length:var(--sf-text-sm)]">Refunded {formatCents(payment.refundedCents, payment.currency)}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export async function AccountVehiclesPage() {
  const [purchases, payments] = await Promise.all([getCustomerPurchases(), getCustomerPayments()])

  return (
    <section className="pb-24">
      <AccountHeader title="Mis vehículos" />

      <AccountSection title="Compras">
        {purchases === null ? (
          <AccountError title="No pudimos cargar las compras." retryHref="/account/vehicles" />
        ) : purchases.length === 0 ? (
          <AccountEmpty>Todavía no hay compras.</AccountEmpty>
        ) : (
          <div className="space-y-[var(--sf-space-xl)]">
            {purchases.map((deal) => (
              <article key={deal.id} className="space-y-4">
                <h3 className="sf-title-line flex-wrap">
                  <span className="sf-dot" data-tone={statusTone(deal.status)} aria-hidden="true" />
                  <span className="sf-heading text-[length:var(--sf-text-lg)]">{deal.vehicle?.label || 'Vehicle purchase'}</span>
                  <span className="sf-muted text-[length:var(--sf-text-sm)]">{DEAL_STATUS[deal.status] || statusLabel(deal.status)}</span>
                </h3>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Sticker title="Compra" meta={formatDate(deal.createdAt, deal.timezone)} rows={purchaseRows(deal)} />
                  <div className="space-y-4">
                    {deal.deliveries.length === 0 ? (
                      <div className="sf-well p-4">
                        <p className="sf-muted text-[length:var(--sf-text-sm)]">Entrega sin agendar.</p>
                      </div>
                    ) : deal.deliveries.map((delivery) => (
                      <div key={delivery.id} className="sf-well space-y-3 p-4">
                        <p className="sf-title-line">
                          <span className="sf-dot" data-tone={statusTone(delivery.status)} aria-hidden="true" />
                          <span className="sf-heading">Entrega</span>
                          <span className="sf-muted text-[length:var(--sf-text-sm)]">{statusLabel(delivery.status)}</span>
                        </p>
                        {delivery.appointmentAt && (
                          <p className="pl-4 text-[length:var(--sf-text-sm)]">
                            <span className="sf-muted">Turno </span>
                            <span className="sf-figure">{formatDateTime(delivery.appointmentAt, deal.timezone)}</span>
                          </p>
                        )}
                        <div className="pl-4">
                          <p className="sf-label">Pendientes nuestros</p>
                          {delivery.weOweItems.length === 0 ? (
                            <p className="sf-muted text-[length:var(--sf-text-sm)]">Ninguno</p>
                          ) : (
                            <ul className="space-y-2">
                              {delivery.weOweItems.map((item) => (
                                <li key={item.id} className="text-[length:var(--sf-text-sm)]">
                                  <span className="sf-title-line">
                                    <span className="sf-dot" data-tone={statusTone(item.status)} aria-hidden="true" />
                                    <span>{item.description}</span>
                                  </span>
                                  <span className="sf-muted block pl-4">
                                    {statusLabel(item.status)}
                                    {item.status === 'open' ? ` · Promised ${formatDate(item.promisedAt, deal.timezone)}` : ''}
                                    {item.fulfilledAt ? ` · ${formatDate(item.fulfilledAt, deal.timezone)}` : ''}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </AccountSection>

      <AccountSection title="Pagos">
        {payments === null ? (
          <AccountError title="No pudimos cargar los pagos." retryHref="/account/vehicles" />
        ) : payments.length === 0 ? (
          <AccountEmpty>Todavía no hay pagos.</AccountEmpty>
        ) : (
          <PaymentList payments={payments} />
        )}
      </AccountSection>
    </section>
  )
}
