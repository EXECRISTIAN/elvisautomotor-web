import { AlertTriangle, CheckCircle2, CircleHelp, MinusCircle } from 'lucide-react'
import { USED_REPORT_TEXT_FIELDS, acLabel, debtLabel, finesLabel, gncLabel } from '@/features/lib/vehicleSpecs'

type Tone = 'ok' | 'warn' | 'info' | 'neutral'
type Report = Record<string, string | number>

const toneColor: Record<Tone, string> = {
  ok: 'var(--sf-ok, #3fb37f)',
  warn: 'var(--sf-warn, #e0a23a)',
  info: 'var(--sf-accent)',
  neutral: 'var(--sf-ink-3)',
}

function ToneIcon({ tone }: { tone: Tone }) {
  const props = { className: 'size-5 shrink-0', style: { color: toneColor[tone] }, 'aria-hidden': true as const }
  if (tone === 'ok') return <CheckCircle2 {...props} />
  if (tone === 'warn') return <AlertTriangle {...props} />
  if (tone === 'info') return <CircleHelp {...props} />
  return <MinusCircle {...props} />
}

function summary(report: Report) {
  const rows: Array<{ label: string; value: string; tone: Tone; notes?: string }> = []
  const text = (key: string) => (typeof report[key] === 'string' ? (report[key] as string).trim() : '')
  if (report.usedDebt) rows.push({ label: 'Deuda', value: debtLabel(String(report.usedDebt)), tone: report.usedDebt === 'sin_deuda' ? 'ok' : report.usedDebt === 'con_deuda' ? 'warn' : 'info', notes: text('usedDebtNotes') })
  if (report.usedFines) rows.push({ label: 'Infracciones', value: finesLabel(String(report.usedFines)), tone: report.usedFines === 'sin_infracciones' ? 'ok' : report.usedFines === 'con_infracciones' ? 'warn' : 'info', notes: text('usedFinesNotes') })
  if (report.usedGnc) rows.push({ label: 'GNC', value: gncLabel(String(report.usedGnc)), tone: report.usedGnc === 'si' ? 'info' : 'neutral', notes: text('usedGncNotes') })
  if (report.usedAc) rows.push({ label: 'Aire acondicionado', value: acLabel(String(report.usedAc)), tone: report.usedAc === 'funciona' ? 'ok' : report.usedAc === 'no_funciona' ? 'warn' : 'neutral', notes: text('usedAcNotes') })
  if (typeof report.usedTireLifePct === 'number') {
    const pct = report.usedTireLifePct
    rows.push({ label: 'Cubiertas', value: `${pct} % de vida útil`, tone: pct >= 60 ? 'ok' : pct >= 35 ? 'info' : 'warn' })
  }
  return rows
}

/** Informe del estado de un usado. Se muestra solo si hay datos cargados. */
export function UsedReport({ report }: { report?: Report | null }) {
  if (!report) return null
  const rows = summary(report)
  const details = USED_REPORT_TEXT_FIELDS.map(([key, label]) => ({ key, label, text: typeof report[key] === 'string' ? (report[key] as string).trim() : '' })).filter((row) => row.text)
  if (!rows.length && !details.length) return null
  const tire = typeof report.usedTireLifePct === 'number' ? Math.max(0, Math.min(100, report.usedTireLifePct)) : null

  return (
    <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--sf-rule)' }} aria-labelledby="vdp-used-report">
      <h2 id="vdp-used-report" className="sf-caps text-[0.875rem] font-medium">Estado del usado</h2>
      <p className="sf-muted mt-2 text-[length:var(--sf-text-sm)]">Informe de la agencia. Puedes revisarlo en persona antes de decidir.</p>

      {rows.length > 0 && (
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.label} className="flex min-h-14 items-start gap-3 rounded-[var(--sf-radius-md)] border p-3" style={{ borderColor: 'var(--sf-rule)' }}>
              <ToneIcon tone={row.tone} />
              <div className="min-w-0">
                <p className="text-[length:var(--sf-text-xs)] uppercase tracking-[0.06em]" style={{ color: 'var(--sf-ink-3)' }}>{row.label}</p>
                <p className="font-semibold">{row.value}</p>
                {row.notes && <p className="sf-muted mt-0.5 text-[length:var(--sf-text-sm)]">{row.notes}</p>}
                {row.label === 'Cubiertas' && tire !== null && (
                  <div className="mt-2 h-1.5 w-full max-w-48 overflow-hidden rounded-full" style={{ background: 'var(--sf-rule)' }} role="img" aria-label={`${tire} % de vida útil`}>
                    <div className="h-full rounded-full" style={{ width: `${tire}%`, background: toneColor[row.tone] }} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {details.length > 0 && (
        <dl className="mt-6 divide-y" style={{ borderColor: 'var(--sf-rule)' }}>
          {details.map((row) => (
            <div key={row.key} className="grid gap-1 py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4" style={{ borderColor: 'var(--sf-rule)' }}>
              <dt className="font-semibold">{row.label}</dt>
              <dd className="sf-muted whitespace-pre-line">{row.text}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
