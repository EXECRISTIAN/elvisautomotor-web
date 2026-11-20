'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'

type Props = {
  id: string
  name?: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  required?: boolean
  /** "numeric" abre el teclado numérico en celulares y tablets. */
  inputMode?: 'text' | 'numeric'
  maxLength?: number
  /** Si es false, solo se aceptan valores de la lista. */
  allowCustom?: boolean
  emptyText?: string
  disabled?: boolean
  /** Opciones destacadas que se muestran primero ("Más populares"). */
  popular?: string[]
  allLabel?: string
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Campo con lista desplegable debajo: se puede tocar para elegir o escribir para filtrar.
 * Funciona con mouse, teclado (flechas, Enter, Escape) y pantallas táctiles.
 */
export function ComboField({ id, name, value, onChange, options, placeholder, required, inputMode = 'text', maxLength, allowCustom = true, emptyText = 'Sin coincidencias', disabled, popular, allLabel = 'Todas' }: Props) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const [manual, setManual] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)

  const text = query ?? value
  const filtered = useMemo(() => {
    const q = normalize(query ?? '')
    if (!q) return popular?.length ? [...popular, ...options] : options
    const starts = options.filter((option) => normalize(option).startsWith(q))
    const contains = options.filter((option) => !normalize(option).startsWith(q) && normalize(option).includes(q))
    return [...starts, ...contains]
  }, [options, query, popular])
  const grouped = !normalize(query ?? '') && !!popular?.length
  const popularCount = grouped ? popular!.length : 0

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) commit()
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  })

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function choose(option: string) {
    onChange(option)
    setQuery(null)
    setOpen(false)
  }

  function commit() {
    if (query !== null) {
      const typed = query.trim()
      const exact = options.find((option) => normalize(option) === normalize(typed))
      if (exact) onChange(exact)
      else if (allowCustom || !typed) onChange(typed)
      setQuery(null)
    }
    setOpen(false)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) setOpen(true)
      setActive((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && open) {
      event.preventDefault()
      if (filtered[active]) choose(filtered[active])
      else commit()
    } else if (event.key === 'Escape') {
      setQuery(null)
      setOpen(false)
    } else if (event.key === 'Tab') {
      commit()
    }
  }

  return (
    <div ref={wrap} className="relative">
      <input
        ref={input}
        id={id}
        name={name}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
        inputMode={inputMode}
        pattern={inputMode === 'numeric' ? '[0-9]*' : undefined}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="next"
        maxLength={maxLength}
        required={required}
        disabled={disabled}
        placeholder={manual ? 'Escribe el tuyo aquí' : placeholder}
        value={text}
        onFocus={() => { if (!manual) setOpen(true); setActive(0) }}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          const next = inputMode === 'numeric' ? event.target.value.replace(/\D/g, '') : event.target.value
          setQuery(next)
          setOpen(true)
          setActive(0)
        }}
        onKeyDown={onKeyDown}
        className="sf-input w-full pr-20"
      />
      <div className="absolute inset-y-0 right-1 flex items-center">
        {value && !disabled && (
          <button type="button" tabIndex={-1} aria-label="Borrar" className="grid size-10 place-items-center opacity-60 hover:opacity-100" onClick={() => { onChange(''); setQuery(''); setOpen(true); input.current?.focus() }}>
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
        <button type="button" tabIndex={-1} aria-label={open ? 'Cerrar lista' : 'Abrir lista'} disabled={disabled} className="grid size-10 place-items-center opacity-70 hover:opacity-100" onClick={() => { if (open) commit(); else { setOpen(true); input.current?.focus() } }}>
          <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto overscroll-contain rounded-[8px] border py-1 shadow-xl"
          style={{ background: 'var(--sf-paper, #111)', borderColor: 'var(--sf-rule)' }}
        >
          {filtered.length ? filtered.map((option, index) => [
            grouped && (index === 0 || index === popularCount) ? (
              <li key={`h${index}`} role="presentation" className="px-4 pb-1 pt-2 text-[0.75rem] uppercase tracking-wide" style={{ color: 'var(--sf-ink-3)' }}>
                {index === 0 ? 'Más populares' : allLabel}
              </li>
            ) : null,
            <li
              key={`${index}-${option}`}
              id={`${listId}-${index}`}
              role="option"
              data-index={index}
              aria-selected={option === value}
              className="flex min-h-11 cursor-pointer items-center px-4 text-[0.95rem]"
              style={index === active ? { background: 'var(--sf-accent-fill, #e5c36f)', color: 'var(--sf-accent-ink, #111)', fontWeight: 600 } : option === value ? { color: 'var(--sf-accent)' } : undefined}
              onPointerEnter={() => setActive(index)}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              {option}
            </li>,
          ]).concat(allowCustom && !query ? [
            <li
              key="no-aparece"
              role="option"
              aria-selected={false}
              className="flex min-h-11 cursor-pointer items-center border-t px-4 text-[0.95rem] font-semibold"
              style={{ borderColor: 'var(--sf-rule)', color: 'var(--sf-accent)' }}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => { onChange(''); setQuery(''); setManual(true); setOpen(false); input.current?.focus() }}
            >
              Aquí no aparece el mío
            </li>,
          ] : []) : (
            <li className="px-4 py-3 text-[0.9rem]" style={{ color: 'var(--sf-ink-3)' }}>
              {allowCustom && query ? `Se usará “${query.trim()}”` : emptyText}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
