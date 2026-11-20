'use client'

import { useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DeskSection, DeskTable, Figure, Notice, Panel, Pill, Segmented, Status, Td, Th, Tr, Track } from '@/features/platform/components/desk'
import { cn } from '@/lib/utils'
import { type CatalogMake, type CatalogModel, type InventoryPair, addInventoryPairs, deleteMake, deleteModel, saveMake, saveModel } from '../actions'
import { ConfirmDialog, EmptyRow, Field, FormDialog, TAP, TAP_INPUT, TAP_SM } from './formKit'

export const BODY_STYLES = [
  { value: 'sedan', label: 'Sedán' },
  { value: 'suv', label: 'SUV' },
  { value: 'truck', label: 'Pickup' },
  { value: 'coupe', label: 'Cupé' },
  { value: 'hatchback', label: 'Hatchback' },
  { value: 'convertible', label: 'Descapotable' },
  { value: 'wagon', label: 'Rural' },
  { value: 'van', label: 'Utilitario' },
  { value: 'minivan', label: 'Monovolumen' },
]
const bodyStyleLabel = (value: string | null) => BODY_STYLES.find(style => style.value === value)?.label || null

type MakeFilter = 'all' | 'with-models' | 'no-models'
type MakeDraft = { id?: string; name: string }
type ModelDraft = { id?: string; makeId: string; name: string; bodyStyle: string; baseYear: string }
type Pending = { kind: 'make'; make: CatalogMake } | { kind: 'model'; model: CatalogModel }

const pairKey = (make: string, model: string) => `${make.trim().toLowerCase()}|${model.trim().toLowerCase()}`

export function MakesModelsPanel({
  makes,
  inventoryPairs,
  error,
  onReload,
}: {
  makes: CatalogMake[]
  inventoryPairs: InventoryPair[]
  error: string | null
  onReload: () => Promise<void>
}) {
  const [filter, setFilter] = useState<MakeFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(makes[0]?.id || null)
  const [makeDraft, setMakeDraft] = useState<MakeDraft | null>(null)
  const [modelDraft, setModelDraft] = useState<ModelDraft | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [addingPairs, setAddingPairs] = useState<string | null>(null)
  const [pairError, setPairError] = useState<string | null>(null)

  const counts = {
    all: makes.length,
    withModels: makes.filter(make => make.modelsCount > 0).length,
    noModels: makes.filter(make => make.modelsCount === 0).length,
  }
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return makes
      .filter(make => filter === 'all' || (filter === 'with-models' ? make.modelsCount > 0 : make.modelsCount === 0))
      .filter(make => !term || make.name.toLowerCase().includes(term) || make.models.some(model => model.name.toLowerCase().includes(term)))
  }, [makes, filter, search])
  const selected = makes.find(make => make.id === selectedId) || null

  const catalogPairs = useMemo(() => new Set(makes.flatMap(make => make.models.map(model => pairKey(make.name, model.name)))), [makes])
  const missingPairs = inventoryPairs.filter(pair => !catalogPairs.has(pairKey(pair.make, pair.model)))

  const closeForms = () => { setMakeDraft(null); setModelDraft(null); setFieldErrors({}); setFormError(null) }

  const submitMake = async () => {
    if (!makeDraft) return
    const name = makeDraft.name.trim()
    const errors: Record<string, string> = {}
    if (!name) errors.name = 'El nombre es obligatorio'
    else if (name.length > 100) errors.name = 'El nombre es demasiado largo'
    else if (makes.some(make => make.id !== makeDraft.id && make.name.toLowerCase() === name.toLowerCase())) errors.name = 'This make already exists'
    setFieldErrors(errors)
    if (Object.keys(errors).length) return
    setBusy(true); setFormError(null)
    const response = await saveMake({ id: makeDraft.id, name })
    setBusy(false)
    if (!response.success) { setFormError(response.error); return }
    setNotice(makeDraft.id ? `Make renamed to ${name}` : `Se agregaron ${name}`)
    closeForms()
    await onReload()
  }

  const submitModel = async () => {
    if (!modelDraft) return
    const name = modelDraft.name.trim()
    const make = makes.find(item => item.id === modelDraft.makeId)
    const errors: Record<string, string> = {}
    if (!make) errors.makeId = 'Elige una marca'
    if (!name) errors.name = 'El nombre es obligatorio'
    else if (name.length > 100) errors.name = 'El nombre es demasiado largo'
    else if (make?.models.some(model => model.id !== modelDraft.id && model.name.toLowerCase() === name.toLowerCase())) errors.name = `${make.name} already has this model`
    let baseYear: number | null = null
    if (modelDraft.baseYear.trim()) {
      baseYear = Number(modelDraft.baseYear.trim())
      const maxYear = new Date().getFullYear() + 2
      if (!Number.isInteger(baseYear) || baseYear < 1900 || baseYear > maxYear) errors.baseYear = `Year must be 1900 to ${maxYear}`
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length) return
    setBusy(true); setFormError(null)
    const response = await saveModel({ id: modelDraft.id, makeId: modelDraft.makeId, name, bodyStyle: modelDraft.bodyStyle === 'none' ? null : modelDraft.bodyStyle, baseYear })
    setBusy(false)
    if (!response.success) { setFormError(response.error); return }
    setNotice(modelDraft.id ? `Saved ${name}` : `Se agregaron ${make?.name} ${name}`)
    setSelectedId(modelDraft.makeId)
    closeForms()
    await onReload()
  }

  const confirmDelete = async () => {
    if (!pending) return
    setBusy(true); setFormError(null)
    const response = pending.kind === 'make' ? await deleteMake(pending.make.id) : await deleteModel(pending.model.id)
    setBusy(false)
    if (!response.success) { setFormError(response.error); return }
    setNotice(pending.kind === 'make' ? `Deleted ${pending.make.name}` : `Deleted ${pending.model.name}`)
    if (pending.kind === 'make' && selectedId === pending.make.id) setSelectedId(null)
    setPending(null)
    await onReload()
  }

  const addPairs = async (pairs: InventoryPair[], key: string) => {
    setAddingPairs(key); setNotice(null); setPairError(null)
    const response = await addInventoryPairs(pairs.map(pair => ({ make: pair.make, model: pair.model })))
    setAddingPairs(null)
    if (!response.success) { setPairError(response.error); return }
    setNotice(`Se agregaron ${response.added ?? 0} ${response.added === 1 ? 'modelo' : 'modelos'} del inventario`)
    await onReload()
  }

  return (
    <div className="space-y-4">
      {error && <Notice tone="bad">{error}</Notice>}
      {notice && <Notice tone="ok">{notice}</Notice>}

      {missingPairs.length > 0 && (
        <DeskSection
          title="En inventario, no en catálogo"
          count={missingPairs.length}
          actions={
            <Track>
              <Pill size="sm" variant="primary" className={TAP_SM} disabled={addingPairs !== null} onClick={() => addPairs(missingPairs, 'all')}>
                <Plus />
                {addingPairs === 'all' ? 'Adding…' : 'Agregar todos'}
              </Pill>
            </Track>
          }
        >
          {pairError && <Notice tone="bad" className="mb-3">{pairError}</Notice>}
          <DeskTable aria-label="Modelos del inventario que faltan en el catálogo">
            <thead>
              <tr>
                <Th>Marca y modelo</Th>
                <Th>Estado</Th>
                <Th align="right">Unidades</Th>
                <Th align="right"><span className="sr-only">Acción</span></Th>
              </tr>
            </thead>
            <tbody>
              {missingPairs.map(pair => {
                const key = pairKey(pair.make, pair.model)
                return (
                  <Tr key={key}>
                    <Td className="font-medium text-foreground">{pair.make} {pair.model}</Td>
                    <Td><Status tone="warn">No está en el catálogo</Status></Td>
                    <Td align="right"><Figure size="sm">{pair.units}</Figure></Td>
                    <Td align="right" className="w-px whitespace-nowrap">
                      <Pill size="sm" className={TAP_SM} disabled={addingPairs !== null} onClick={() => addPairs([pair], key)} aria-label={`Add ${pair.make} ${pair.model}`}>
                        <Plus />
                        {addingPairs === key ? 'Adding…' : 'Add'}
                      </Pill>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </DeskTable>
        </DeskSection>
      )}

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Segmented<MakeFilter>
          label="Filtrar marcas"
          value={filter}
          onChange={setFilter}
          size="sm"
          options={[
            { value: 'all', label: 'Todos', count: counts.all },
            { value: 'with-models', label: 'Con modelos', count: counts.withModels },
            { value: 'no-models', label: 'Sin modelos', count: counts.noModels, tone: counts.noModels ? 'warn' : undefined },
          ]}
        />
        <div className="relative min-w-0 sm:max-w-xs sm:flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className={cn('pl-9', TAP_INPUT)} value={search} onChange={event => setSearch(event.target.value)} placeholder="Marca o modelo" aria-label="Buscar marcas y modelos" />
        </div>
        <Track className="sm:ml-auto">
          <Pill variant="primary" className={TAP} onClick={() => { closeForms(); setMakeDraft({ name: '' }) }}>
            <Plus />
            Agregar marca
          </Pill>
        </Track>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {visible.length === 0 ? (
          <Panel><EmptyRow>{makes.length === 0 ? 'No makes yet' : 'No makes match'}</EmptyRow></Panel>
        ) : (
          <DeskTable aria-label="Marcas">
            <thead>
              <tr>
                <Th>Marca</Th>
                <Th>Estado</Th>
                <Th align="right">Modelos</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map(make => (
                <Tr key={make.id} className={cn(make.id === selectedId && 'bg-muted/60 hover:bg-muted/60')}>
                  <Td className="p-0 first:pl-0">
                    <button
                      type="button"
                      onClick={() => setSelectedId(make.id)}
                      aria-pressed={make.id === selectedId}
                      className="flex min-h-11 w-full min-w-0 items-center px-4 text-left font-medium text-foreground hover:underline"
                    >
                      {make.name}
                    </button>
                  </Td>
                  <Td>{make.modelsCount > 0 ? <Status tone="ok">Con modelos</Status> : <Status tone="warn">Sin modelos</Status>}</Td>
                  <Td align="right">{make.modelsCount}</Td>
                </Tr>
              ))}
            </tbody>
          </DeskTable>
        )}

        <Panel className="overflow-hidden">
          {!selected ? (
            <EmptyRow>Elige una marca</EmptyRow>
          ) : (
            <div>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <h3 className="flex min-w-0 items-baseline gap-2 text-base font-semibold">
                  {selected.name}
                  <span className="text-[13px] font-normal tabular-nums text-muted-foreground">{selected.modelsCount} {selected.modelsCount === 1 ? 'modelo' : 'modelos'}</span>
                </h3>
                <Track>
                  <Pill size="sm" className={TAP_SM} onClick={() => { closeForms(); setMakeDraft({ id: selected.id, name: selected.name }) }}>
                    <Pencil />
                    Renombrar
                  </Pill>
                  <Pill
                    size="sm"
                    className={TAP_SM}
                    disabled={selected.modelsCount > 0}
                    title={selected.modelsCount > 0 ? 'Primero elimina sus modelos' : undefined}
                    onClick={() => { setFormError(null); setPending({ kind: 'make', make: selected }) }}
                  >
                    <Trash2 />
                    Eliminar
                  </Pill>
                  <Pill size="sm" variant="primary" className={TAP_SM} onClick={() => { closeForms(); setModelDraft({ makeId: selected.id, name: '', bodyStyle: 'none', baseYear: '' }) }}>
                    <Plus />
                    Agregar modelo
                  </Pill>
                </Track>
              </div>
              {selected.modelsCount > 0 && <p className="border-b px-4 py-2 text-xs text-muted-foreground">Se puede eliminar cuando la marca no tenga modelos.</p>}
              {selected.models.length === 0 ? (
                <EmptyRow>Sin modelos</EmptyRow>
              ) : (
                <table className="w-full border-collapse text-[13px]" aria-label={`${selected.name} models`}>
                  <thead>
                    <tr>
                      <Th>Modelo</Th>
                      <Th priority={2}>Carrocería</Th>
                      <Th align="right" priority={2}>Desde</Th>
                      <Th align="right"><span className="sr-only">Acciones</span></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.models.map(model => (
                      <Tr key={model.id}>
                        <Td className="max-w-0 min-w-[7rem]">
                          <span className="block truncate font-medium text-foreground">{model.name}</span>
                          <span className="block truncate text-xs text-muted-foreground md:hidden">{[bodyStyleLabel(model.bodyStyle), model.baseYear ? `Since ${model.baseYear}` : null].filter(Boolean).join(' · ') || 'No body style'}</span>
                        </Td>
                        <Td priority={2} className="text-muted-foreground">{bodyStyleLabel(model.bodyStyle) || 'Ninguno'}</Td>
                        <Td align="right" priority={2} className="text-muted-foreground">{model.baseYear || ''}</Td>
                        <Td align="right" className="w-px whitespace-nowrap">
                          <div className="inline-flex gap-1">
                            <Pill size="sm" className={TAP_SM} aria-label={`Editar ${model.name}`} onClick={() => { closeForms(); setModelDraft({ id: model.id, makeId: selected.id, name: model.name, bodyStyle: model.bodyStyle || 'none', baseYear: model.baseYear ? String(model.baseYear) : '' }) }}>
                              <Pencil />
                              Editar
                            </Pill>
                            <Pill size="sm" variant="plain" className={cn(TAP_SM, 'max-sm:w-11')} aria-label={`Eliminar ${model.name}`} onClick={() => { setFormError(null); setPending({ kind: 'model', model }) }}>
                              <Trash2 />
                            </Pill>
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </Panel>
      </div>

      <FormDialog
        open={makeDraft !== null}
        title={makeDraft?.id ? 'Rename make' : 'Agregar marca'}
        busy={busy}
        error={formError}
        onSubmit={submitMake}
        onOpenChange={open => { if (!open) closeForms() }}
      >
        <Field id="make-name" label="Nombre" error={fieldErrors.name}>
          <Input id="make-name" className={TAP_INPUT} autoFocus maxLength={100} value={makeDraft?.name || ''} aria-invalid={Boolean(fieldErrors.name)} onChange={event => setMakeDraft(draft => draft && { ...draft, name: event.target.value })} />
        </Field>
      </FormDialog>

      <FormDialog
        open={modelDraft !== null}
        title={modelDraft?.id ? 'Edit model' : 'Agregar modelo'}
        busy={busy}
        error={formError}
        onSubmit={submitModel}
        onOpenChange={open => { if (!open) closeForms() }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="model-make" label="Marca" error={fieldErrors.makeId}>
            <Select value={modelDraft?.makeId || ''} onValueChange={value => setModelDraft(draft => draft && { ...draft, makeId: value })}>
              <SelectTrigger id="model-make" className={TAP_INPUT}><SelectValue placeholder="Elige una marca" /></SelectTrigger>
              <SelectContent>{makes.map(make => <SelectItem key={make.id} value={make.id}>{make.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field id="model-name" label="Nombre" error={fieldErrors.name}>
            <Input id="model-name" className={TAP_INPUT} autoFocus maxLength={100} value={modelDraft?.name || ''} aria-invalid={Boolean(fieldErrors.name)} onChange={event => setModelDraft(draft => draft && { ...draft, name: event.target.value })} />
          </Field>
          <Field id="model-body" label="Carrocería">
            <Select value={modelDraft?.bodyStyle || 'none'} onValueChange={value => setModelDraft(draft => draft && { ...draft, bodyStyle: value })}>
              <SelectTrigger id="model-body" className={TAP_INPUT}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguno</SelectItem>
                {BODY_STYLES.map(style => <SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field id="model-year" label="Año base" error={fieldErrors.baseYear}>
            <Input id="model-year" className={TAP_INPUT} inputMode="numeric" maxLength={4} value={modelDraft?.baseYear || ''} aria-invalid={Boolean(fieldErrors.baseYear)} onChange={event => setModelDraft(draft => draft && { ...draft, baseYear: event.target.value })} />
          </Field>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === 'make' ? `Eliminar ${pending.make.name}?` : `Eliminar ${pending?.kind === 'model' ? pending.model.name : ''}?`}
        confirmLabel="Eliminar"
        busy={busy}
        error={formError}
        onConfirm={confirmDelete}
        onOpenChange={open => { if (!open) { setPending(null); setFormError(null) } }}
      />
    </div>
  )
}
