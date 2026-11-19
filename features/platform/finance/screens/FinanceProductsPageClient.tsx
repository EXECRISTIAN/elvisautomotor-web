'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, DeskSection, DeskTable, Figure, Notice, Pill, Readout, ReadoutStrip, Segmented, Status, Td, Th, Tr, Track } from '@/features/platform/components/desk'
import { formatCentsForInput, parseDollarsToCents } from '@/features/platform/deals/lib/moneyInput'
import { getFinanceProductCatalog, saveFinanceProduct } from '../actions/catalog'
import { FinanceFormDialog, type FieldErrors, type FinanceFormField } from '../components/FinanceFormDialog'
import type { CatalogProduct, CatalogRooftop } from '../lib/catalogTypes'
import { PRODUCT_CATEGORIES, categoryLabels, formatCents, newIdempotencyKey } from '../lib/display'

type Catalog = { products: CatalogProduct[]; rooftops: CatalogRooftop[]; sessionRooftopId: string | null }
type Editor = { mode: 'create' | 'edit'; product?: CatalogProduct; values: Record<string, string>; idempotencyKey: string }

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,79}$/

export function FinanceProductsPageClient({ initial, initialError }: { initial: Catalog | null; initialError: string | null }) {
  const router = useRouter()
  const [catalog, setCatalog] = useState<Catalog | null>(initial)
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)
  const [rooftopId, setRooftopId] = useState<string>(initial?.sessionRooftopId || '')
  const [tab, setTab] = useState<'active' | 'inactive' | 'all'>('active')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  const rooftops = catalog?.rooftops || []
  const rooftopName = (id: string) => rooftops.find(rooftop => rooftop.id === id)?.name || 'Sucursal'

  const reload = async () => {
    setLoading(true)
    const response = await getFinanceProductCatalog()
    if (response.success) {
      setCatalog(response.data)
      setError(null)
      if (!rooftopId) setRooftopId(response.data.sessionRooftopId || '')
    } else setError(response.error)
    setLoading(false)
    router.refresh()
  }

  const rooftopProducts = useMemo(() => (catalog?.products || []).filter(product => !rooftopId || product.rooftop?.id === rooftopId), [catalog, rooftopId])
  const counts = {
    active: rooftopProducts.filter(product => product.active).length,
    inactive: rooftopProducts.filter(product => !product.active).length,
    all: rooftopProducts.length,
  }
  const term = search.trim().toLowerCase()
  const visible = rooftopProducts
    .filter(product => tab === 'all' || (tab === 'active' ? product.active : !product.active))
    .filter(product => category === 'all' || product.category === category)
    .filter(product => !term || `${product.code} ${product.name}`.toLowerCase().includes(term))
  const activeProducts = rooftopProducts.filter(product => product.active)
  const costKnown = activeProducts.filter(product => product.costCents != null)
  const averageMargin = costKnown.length ? costKnown.reduce((sum, product) => sum + (product.retailPriceCents - (product.costCents || 0)), 0) / costKnown.length : null

  const openCreate = () => {
    setFieldErrors({}); setFormError(null)
    setEditor({ mode: 'create', idempotencyKey: newIdempotencyKey('finance-product'), values: { rooftopId: rooftopId || catalog?.sessionRooftopId || '', code: '', name: '', category: 'service-contract', retail: '', cost: '' } })
  }
  const openEdit = (product: CatalogProduct) => {
    setFieldErrors({}); setFormError(null)
    setEditor({
      mode: 'edit', product, idempotencyKey: newIdempotencyKey('finance-product'),
      values: { rooftopId: product.rooftop?.id || '', rooftopName: product.rooftop?.name || '', code: product.code, name: product.name, category: product.category, retail: formatCentsForInput(product.retailPriceCents), cost: product.costCents == null ? '' : formatCentsForInput(product.costCents), active: product.active ? 'yes' : '' },
    })
  }

  const submit = async () => {
    if (!editor) return
    const v = editor.values
    const errors: FieldErrors = {}
    const code = (v.code || '').trim().toUpperCase()
    if (!v.rooftopId) errors.rooftopId = 'Select a rooftop.'
    if (editor.mode === 'create') {
      if (!CODE_PATTERN.test(code)) errors.code = 'Use 2-80 letters, digits, dashes or underscores.'
      else if ((catalog?.products || []).some(product => product.rooftop?.id === v.rooftopId && product.code === code)) errors.code = 'This code already exists at this rooftop.'
    }
    if (!(v.name || '').trim()) errors.name = 'Enter a product name.'
    else if (v.name.trim().length > 200) errors.name = 'Usa 200 caracteres o menos.'
    if (!PRODUCT_CATEGORIES.includes(v.category as typeof PRODUCT_CATEGORIES[number])) errors.category = 'Select a category.'
    const retail = (v.retail || '').trim() ? parseDollarsToCents(v.retail) : null
    if (retail == null) errors.retail = 'Enter a dollar amount, for example 1,299.50.'
    const costHidden = editor.mode === 'edit' && editor.product?.costCents == null
    const cost = (v.cost || '').trim() ? parseDollarsToCents(v.cost) : null
    if (!(costHidden && !(v.cost || '').trim()) && cost == null) errors.cost = 'Enter a dollar amount, for example 899.'
    setFieldErrors(errors)
    if (Object.keys(errors).length) return
    setBusyId('editor'); setFormError(null)
    const response = await saveFinanceProduct({
      rooftopId: v.rooftopId,
      code: editor.mode === 'edit' ? editor.product!.code : code,
      name: v.name.trim(),
      category: v.category,
      retailPriceCents: retail!,
      costCents: cost,
      active: editor.mode === 'create' ? true : v.active === 'yes',
      expectNew: editor.mode === 'create',
      idempotencyKey: editor.idempotencyKey,
    })
    setBusyId(null)
    if (!response.success) { setFormError(response.error); return }
    setEditor(null)
    setNotice({ tone: 'ok', text: editor.mode === 'create' ? `${code} added.` : `${editor.product!.code} saved.` })
    await reload()
  }

  const toggleActive = async (product: CatalogProduct) => {
    if (!product.rooftop) return
    setBusyId(product.id); setNotice(null)
    const response = await saveFinanceProduct({
      rooftopId: product.rooftop.id,
      code: product.code,
      name: product.name,
      category: product.category,
      retailPriceCents: product.retailPriceCents,
      costCents: product.costCents,
      active: !product.active,
      expectNew: false,
      idempotencyKey: newIdempotencyKey('finance-product'),
    })
    setBusyId(null)
    setNotice(response.success ? { tone: 'ok', text: `${product.code} ${product.active ? 'deactivated' : 'activated'}.` } : { tone: 'bad', text: response.error })
    if (response.success) await reload()
  }

  const editorFields: FinanceFormField[] = !editor ? [] : [
    editor.mode === 'create'
      ? { name: 'rooftopId', label: 'Sucursal', type: 'select', options: rooftops.map(rooftop => ({ value: rooftop.id, label: rooftop.name })), wide: true }
      : { name: 'rooftopName', label: 'Sucursal', type: 'readonly', wide: true },
    editor.mode === 'create' ? { name: 'code', label: 'Código', placeholder: 'VSC-60', maxLength: 80 } : { name: 'code', label: 'Código', type: 'readonly' },
    { name: 'category', label: 'Categoría', type: 'select', options: PRODUCT_CATEGORIES.map(value => ({ value, label: categoryLabels[value] })) },
    { name: 'name', label: 'Nombre', maxLength: 200, wide: true },
    { name: 'retail', label: 'Precio de venta', type: 'money', placeholder: '$1,299' },
    { name: 'cost', label: 'Costo', type: 'money', placeholder: editor.mode === 'edit' && editor.product?.costCents == null ? 'Unchanged' : '$899', description: editor.mode === 'edit' && editor.product?.costCents == null ? 'Hidden for your role; blank keeps the current cost' : undefined },
    ...(editor.mode === 'edit' ? [{ name: 'active', label: 'Activo en menús', type: 'checkbox' as const }] : []),
  ]

  const breadcrumbs = [
    { type: 'link' as const, label: 'Inicio', href: basePath },
    { type: 'page' as const, label: 'Gestión' },
    { type: 'link' as const, label: 'Solicitudes de crédito', href: `${basePath}/platform/finance` },
    { type: 'page' as const, label: 'Productos adicionales' },
  ]

  const header = (
    <DeskHeader
      title="Productos adicionales"
      tone={error ? 'bad' : counts.active > 0 ? 'ok' : 'warn'}
      status={error ? 'No disponible' : `${counts.active} active`}
      meta={error ? 'No disponible' : `${rooftopId ? rooftopName(rooftopId) : 'Todas las sucursales'} · ${counts.active} activos · ${counts.inactive} inactivos`}
      actions={
        <>
          <Pill asChild variant="plain">
            <Link href={`${basePath}/platform/finance`}><ArrowLeft />Financiación</Link>
          </Pill>
          <Pill variant="plain" onClick={reload} disabled={loading} aria-label="Actualizar">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Actualizar
          </Pill>
          <Pill variant="primary" onClick={openCreate} disabled={!rooftops.length || Boolean(error)} title={!rooftops.length ? 'No rooftop available' : undefined}>
            <Plus />
            Nuevo producto
          </Pill>
        </>
      }
    />
  )

  if (error && !catalog) {
    return (
      <PageContainer title="Productos adicionales" header={header} breadcrumbs={breadcrumbs}>
        <div className="space-y-3 px-4 pb-24 md:px-6">
          <Notice tone="bad">
            <p className="font-medium">Los productos no están disponibles</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
          </Notice>
          <Track><Pill onClick={reload} disabled={loading}>Reintentar</Pill></Track>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer title="Productos adicionales" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-6 px-4 pb-24 md:px-6">
        {notice && (
          <Notice tone={notice.tone}>
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
              <p className="min-w-0">{notice.text}</p>
              <Track><Pill size="sm" variant="plain" onClick={() => setNotice(null)}>Descartar</Pill></Track>
            </div>
          </Notice>
        )}
        {error && <Notice tone="bad">{error}</Notice>}

        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          {rooftops.length > 1 && (
            <Select value={rooftopId || 'all'} onValueChange={value => setRooftopId(value === 'all' ? '' : value)}>
              <SelectTrigger className="h-10 w-full rounded-[4px] lg:w-[220px]" aria-label="Sucursal"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sucursales</SelectItem>
                {rooftops.map(rooftop => <SelectItem key={rooftop.id} value={rooftop.id}>{rooftop.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Segmented
            label="Estado del producto"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'active', label: 'Activo', count: counts.active, tone: 'ok' },
              { value: 'inactive', label: 'Inactivo', count: counts.inactive, tone: 'idle' },
              { value: 'all', label: 'Todas', count: counts.all },
            ]}
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-10 w-full rounded-[4px] lg:w-[190px]" aria-label="Categoría"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {PRODUCT_CATEGORIES.map(value => <SelectItem key={value} value={value}>{categoryLabels[value]}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative min-w-0 flex-1 lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-10 rounded-[4px] pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por código o nombre" aria-label="Buscar productos" />
          </div>
          {loading && <span className="text-sm text-muted-foreground" role="status">Actualizando…</span>}
        </div>

        <DeskSection title="Catálogo" count={visible.length}>
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
              <p>{rooftopProducts.length === 0 ? 'No hay productos en esta sucursal' : 'No hay productos que coincidan'}</p>
              <Track>
                {rooftopProducts.length === 0
                  ? <Pill size="sm" variant="primary" onClick={openCreate} disabled={!rooftops.length}>Nuevo producto</Pill>
                  : <Pill size="sm" onClick={() => { setSearch(''); setCategory('all'); setTab('all') }}>Limpiar filtros</Pill>}
              </Track>
            </div>
          ) : (
            <DeskTable>
              <thead>
                <tr>
                  <Th>Producto</Th>
                  <Th>Estado</Th>
                  <Th priority={2}>Categoría</Th>
                  {!rooftopId && <Th priority={3}>Sucursal</Th>}
                  <Th priority={3} align="right">Cotizaciones</Th>
                  <Th align="right">Precio de venta</Th>
                  <Th priority={2} align="right">Costo</Th>
                  <Th priority={2} align="right">Margen</Th>
                  <Th align="right"><span className="sr-only">Acciones</span></Th>
                </tr>
              </thead>
              <tbody>
                {visible.map(product => {
                  const margin = product.costCents == null ? null : product.retailPriceCents - product.costCents
                  const busy = busyId === product.id
                  return (
                    <Tr key={product.id}>
                      <Td>
                        <p className="font-medium text-foreground">{product.name}</p>
                        <Code>{product.code}</Code>
                      </Td>
                      <Td><Status tone={product.active ? 'ok' : 'idle'}>{product.active ? 'Activo' : 'Inactivo'}</Status></Td>
                      <Td priority={2} className="text-muted-foreground">{categoryLabels[product.category] || product.category}</Td>
                      {!rooftopId && <Td priority={3} className="text-muted-foreground">{product.rooftop?.name || '-'}</Td>}
                      <Td priority={3} align="right">{product.quotesCount || 0}</Td>
                      <Td align="right"><Figure size="sm">{formatCents(product.retailPriceCents)}</Figure></Td>
                      <Td priority={2} align="right" className="text-muted-foreground">{formatCents(product.costCents, 'Hidden')}</Td>
                      <Td priority={2} align="right">{margin != null ? formatCents(margin) : '-'}</Td>
                      <Td align="right">
                        <span className="inline-flex flex-wrap justify-end gap-2">
                          <Pill size="sm" className="max-md:h-10" onClick={() => openEdit(product)} disabled={busy}>Editar</Pill>
                          <Pill size="sm" className="max-md:h-10" variant={product.active ? 'plain' : 'raised'} onClick={() => toggleActive(product)} disabled={busy}>
                            {busy ? 'Guardando…' : product.active ? 'Desactivar' : 'Activar'}
                          </Pill>
                        </span>
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </DeskTable>
          )}
        </DeskSection>

        <ReadoutStrip>
          <Readout label="Activo" value={counts.active} tone={counts.active > 0 ? 'ok' : 'warn'} />
          <Readout label="Inactivo" value={counts.inactive} />
          <Readout label="Margen promedio" value={averageMargin == null ? '-' : formatCents(Math.round(averageMargin))} sub={averageMargin == null ? 'Costo oculto o sin productos' : 'Productos activos'} />
        </ReadoutStrip>

        <FinanceFormDialog
          open={Boolean(editor)}
          title={editor?.mode === 'create' ? 'New F&I product' : `Edit ${editor?.product?.code || 'product'}`}
          fields={editorFields}
          values={editor?.values || {}}
          errors={fieldErrors}
          error={formError}
          busy={busyId === 'editor'}
          submitLabel={editor?.mode === 'create' ? 'Agregar producto' : 'Guardar'}
          onValuesChange={values => setEditor(current => current ? { ...current, values } : current)}
          onSubmit={submit}
          onOpenChange={open => { if (!open) setEditor(null) }}
        />
      </div>
    </PageContainer>
  )
}
