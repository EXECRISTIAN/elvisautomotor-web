/** "9 a 13 h sin cita (por la tarde, solo con cita asignada)" en dos líneas cortas: Sin cita / Con cita. */
export function WeekdayHours({ value, align = 'start' }: { value: string; align?: 'start' | 'end' }) {
  if (!/sin cita/i.test(value)) return <>{value}</>
  return (
    <span className={`inline-flex flex-col gap-1 ${align === 'end' ? 'items-end' : 'items-start'}`}>
      <span>Sin cita: {value.split(/\s*sin cita/i)[0].trim()}</span>
      <span>Con cita: por la tarde, solo con cita asignada</span>
    </span>
  )
}
