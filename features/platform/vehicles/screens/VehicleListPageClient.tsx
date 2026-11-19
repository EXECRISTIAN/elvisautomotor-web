'use client'

import { isRepresentativePhoto } from '@/features/storefront/lib/photoAttribution'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ClipboardList, History, MoreHorizontal, Plus, RefreshCw, Search, Upload } from 'lucide-react'
import { LiveVehiclePhotos, reorderPhotoIds, uploadVehiclePhoto, VehiclePhotoEditor } from '../components/VehiclePhotos'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import {
  Attention,
  Code,
  DeskHeader,
  DeskSection,
  DeskTable,
  Facts,
  Figure,
  Notice,
  Pill,
  Readout,
  ReadoutStrip,
  Segmented,
  Status,
  Td,
  Th,
  Tr,
  Track,
  type DeskTone,
} from '@/features/platform/components/desk'
import {
  type InventoryMake,
  type InventoryVehicle,
  type IntakeRooftop,
  decideInventoryMerchandising,
  getInventoryWorkspace,
  intakeInventoryVehicle,
  moveInventoryStock,
  openInventoryReconWorkItem,
  recordInventoryCost,
  recordInventoryFeedRun,
  submitInventoryMerchandising,
  transitionInventoryAcquisition,
  transitionInventoryReconWorkItem,
  updateInventoryMerchandisingDraft,
} from '../actions'
import { selectPublicFeedRunCandidates } from '../lib/publicFeedCandidates'
import { ACQUISITION_SOURCES, COST_TYPES, RECON_CATEGORIES, acquisitionSourceLabels, costTypeLabels, reconCategoryLabels } from '../lib/inventoryLabels'
import {
  createMerchandisingCommandAttempt,
  merchandisingCommandResultMessage,
  resolveMerchandisingCommandAttempt,
  resolveMerchandisingCommandResponse,
  UNCONFIRMED_MERCHANDISING_COMMAND_MESSAGE,
  type MerchandisingCommandAttempt,
  type MerchandisingCommandResult,
} from '../lib/merchandisingCommandOutcome'
import {
  createReconStartAttempt,
  normalizeReconStartResult,
  reconStartResultMessage,
  resolveReconStartAttempt,
  UNCONFIRMED_RECON_START_MESSAGE,
  type ReconStartAttempt,
} from '../lib/reconStartOutcome'
import {
  createReconCompletionAttempt,
  normalizeReconCompletionResult,
  reconCompletionResultMessage,
  resolveReconCompletionAttempt,
  UNCONFIRMED_RECON_COMPLETION_MESSAGE,
  type ReconCompletionAttempt,
} from '../lib/reconCompletionOutcome'
import {
  normalizePublicFeedRunResult,
  publicFeedRunResultMessage,
  resolvePublicFeedRunAttempt,
  UNCONFIRMED_PUBLIC_FEED_RUN_MESSAGE,
  type PublicFeedRunAttempt,
} from '../lib/publicFeedRunOutcome'
import { countLabel } from '@/features/platform/lib/format'
import { FUEL_OPTIONS, TRANSMISSION_OPTIONS } from '@/features/lib/vehicleSpecs'
import { normalizeMoneyText } from '@/features/platform/deals/lib/moneyInput'

const SPEC_NONE = 'ninguno'
const specValue = (value: string) => (value === SPEC_NONE ? '' : value)

type Vehicle = InventoryVehicle

type InventoryTaskType = 'intake' | 'edit' | 'photos' | 'move' | 'cost' | 'recon-open' | 'recon-complete'
type StagedPhoto = { id: string; file: File | null; url: string; name: string }
type InventoryTask = { type: InventoryTaskType; vehicle: Vehicle | null; reconWorkItem?: Vehicle['reconWorkItems'][number]; idempotencyKey: string; fields: Record<string, string>; reconCompletionAttempt?: ReconCompletionAttempt }

/** Acepta 54900000, 54.900.000, $ 54.900.000,50 y también 33,450.00. */
function moneyInputCents(value: string) {
  const trimmed = normalizeMoneyText(value)
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null
  const [whole, fraction = ''] = trimmed.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}

const statusTones: Record<string, DeskTone> = {
  available: 'ok',
  prep: 'info',
  pending: 'warn',
  hold: 'info',
  service: 'idle',
  sold: 'accent',
}

const statusLabels: Record<string, string> = {
  available: 'Disponible',
  prep: 'En preparación',
  pending: 'Señado / pendiente',
  hold: 'Reservado',
  service: 'En taller',
  sold: 'Vendido',
}

const LOT_STATUSES = ['available', 'prep', 'pending', 'hold', 'service', 'sold'] as const

/** Intake stocks a unit as Vehicle.status `service` until it is marked frontline; that is prep, not a repair. */
function lotStage(vehicle: Vehicle) {
  return vehicle.status === 'service' && !vehicle.frontlineAt ? 'prep' : vehicle.status
}

/** The workspace filters on Vehicle.status; prep and service share `service`. */
function serverStatusFilter(stage: string) {
  return stage === 'prep' ? 'service' : stage
}

const acquisitionLabels: Record<string, string> = {
  appraised: 'Tasado',
  approved: 'Ingreso aprobado',
  purchased: 'Comprado',
  arrived: 'Recibido',
  reconditioning: 'Sent to recon',
  frontline: 'En exhibición',
  cancelled: 'Ingreso cancelado',
}

const reconLabels: Record<string, string> = {
  'not-started': 'Preparación sin iniciar',
  'in-progress': 'Preparación en curso',
  completed: 'Preparación terminada',
}

const listingLabels: Record<string, string> = {
  draft: 'Publicación en borrador',
  submitted: 'Publicación esperando aprobación',
  approved: 'Publicación aprobada',
  rejected: 'Publicación rechazada',
}

const conditionLabels: Record<string, string> = {
  new: '0 km',
  used: 'Usado',
  certified: 'Usado certificado',
}

const CONDITIONS = ['new', 'used', 'certified'] as const
const OTHER_MAKE = '__other'

function featureList(value: string) {
  return [...new Set(value.split(/[\n,]/).map(feature => feature.trim()).filter(Boolean))].slice(0, 100)
}

const fieldLabelClass = 'text-[12px] font-medium text-muted-foreground'

function countByStage(list: Vehicle[]) {
  return list.reduce<Record<string, number>>((counts, vehicle) => {
    const stage = lotStage(vehicle)
    counts[stage] = (counts[stage] || 0) + 1
    return counts
  }, {})
}

/** Reads the work items first; the stock-level status says "in progress" as soon as an item is opened. */
function reconLabel(vehicle: Vehicle) {
  const items = vehicle.reconWorkItems
  if (items.some(item => item.status === 'in-progress')) return 'Preparación en curso'
  if (items.some(item => item.status === 'open')) return items.some(item => item.status === 'completed') ? 'Preparación abierta' : 'Preparación sin iniciar'
  if (vehicle.reconStatus === 'completed' || (items.length > 0 && items.every(item => ['completed', 'cancelled'].includes(item.status)))) return 'Preparación terminada'
  return reconLabels[vehicle.reconStatus] || vehicle.reconStatus
}

/** What the merchandising gate (inventoryPublication.ts) will refuse, as the next step to take. */
function listingNeeds(vehicle: Vehicle): 'photos' | 'details' | null {
  if (!vehicle.images.length) return 'photos'
  if (!vehicle.description.trim() || vehicle.price <= 0) return 'details'
  return null
}

/** Listing, photo, recon and frontline work run only on lot inventory (the server refuses the rest). */
function isActiveInventory(vehicle: Vehicle) {
  return vehicle.status === 'available' || vehicle.status === 'service'
}

function inactiveReason(vehicle: Vehicle) {
  return `${statusLabels[vehicle.status] || vehicle.status} no admiten cambios en la publicación`
}

function hasOpenRecon(vehicle: Vehicle) {
  return vehicle.reconWorkItems.some(item => ['open', 'in-progress'].includes(item.status))
}


export function VehicleListPageClient({
  initialVehicles,
  initialIntakeRooftops,
  initialError,
  currencyCode,
  makes = [],
}: {
  initialVehicles: Vehicle[]
  initialIntakeRooftops: IntakeRooftop[]
  initialError: string | null
  currencyCode: string
  makes?: InventoryMake[]
}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<string>('age-desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [intakeRooftops, setIntakeRooftops] = useState<IntakeRooftop[]>(initialIntakeRooftops)
  const [intakeRooftopId, setIntakeRooftopId] = useState(initialIntakeRooftops[0]?.id || '')
  const [task, setTask] = useState<InventoryTask | null>(null)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [actionMessage, setActionMessageText] = useState<string | null>(null)
  const [actionTone, setActionTone] = useState<DeskTone>('idle')
  const setActionMessage = (message: string | null, tone: DeskTone = 'idle') => {
    setActionMessageText(message)
    setActionTone(tone)
  }
  const [pendingFeedRun, setPendingFeedRun] = useState<PublicFeedRunAttempt | null>(null)
  const [pendingMerchandisingAttempt, setPendingMerchandisingAttempt] = useState<MerchandisingCommandAttempt | null>(null)
  const [pendingReconStart, setPendingReconStart] = useState<ReconStartAttempt | null>(null)
  const [intakePhotos, setIntakePhotos] = useState<StagedPhoto[]>([])
  const [intakePhotoStatus, setIntakePhotoStatus] = useState<string | null>(null)
  const [lotCounts, setLotCounts] = useState<Record<string, number> | null>(() => initialError ? null : countByStage(initialVehicles))

  const isInitialLoad = useRef(true)
  /** The open task's unit as last loaded, so photo changes made in a dialog show straight away. */
  const currentTaskVehicle = task?.vehicle ? vehicles.find(vehicle => vehicle.inventoryStockId === task.vehicle!.inventoryStockId) ?? task.vehicle : null

  const loadVehicles = async () => {
    setLoading(true)
    setError(null)

    const response = await getInventoryWorkspace(serverStatusFilter(statusFilter))
    if (response.success) {
      const rooftops = response.intakeRooftops
      setIntakeRooftops(rooftops)
      setIntakeRooftopId(current => current || rooftops[0]?.id || '')
      setVehicles(statusFilter === 'all' ? response.vehicles : response.vehicles.filter(vehicle => lotStage(vehicle) === statusFilter))
      const counted = countByStage(response.vehicles)
      setLotCounts(current => {
        if (statusFilter === 'all') return counted
        if (!current) return current
        const stages = statusFilter === 'prep' || statusFilter === 'service' ? ['prep', 'service'] : [statusFilter]
        return { ...current, ...Object.fromEntries(stages.map(stage => [stage, counted[stage] || 0])) }
      })
    } else {
      setError(response.error || 'Unable to load inventory.')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false
      return
    }
    void loadVehicles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const beginTask = (type: InventoryTaskType, vehicle: Vehicle | null = null, reconWorkItem?: Vehicle['reconWorkItems'][number]) => {
    if (type === 'intake' && !intakeRooftopId) {
      setActionMessage('No rooftop is available for intake.')
      return
    }
    const fields: Record<string, string> = type === 'intake' ? {
      vin: '', stockNumber: '', year: String(new Date().getFullYear()), condition: 'used', makeChoice: '', make: '', model: '', trim: '',
      exteriorColor: '', interiorColor: '', fuelType: SPEC_NONE, transmission: SPEC_NONE, engine: '', features: '',
      purchaseDollars: '', retailDollars: '', mileage: '0', description: '', locationCode: 'INTAKE', acquisitionSource: 'dealer-transfer', sourceReference: '',
    } : type === 'edit' && vehicle ? {
      retailDollars: vehicle.price.toFixed(2), mileage: String(vehicle.mileage), description: vehicle.description,
    } : type === 'photos' ? {} : type === 'move' && vehicle ? { locationCode: vehicle.locationCode } : type === 'cost' ? { costType: 'other', dollars: '100', reference: '' } :
      type === 'recon-open' ? { title: '', category: 'inspection', estimatedDollars: '0' } : { actualDollars: '0' }
    setTaskError(null)
    setActionMessage(null)
    if (type === 'intake') clearIntakePhotos()
    setTask({ type, vehicle, reconWorkItem, idempotencyKey: `inventory-${type}:${vehicle?.inventoryStockId || crypto.randomUUID()}:${crypto.randomUUID()}`, fields })
  }

  const clearIntakePhotos = () => {
    setIntakePhotos(current => {
      current.forEach(photo => { if (photo.file) URL.revokeObjectURL(photo.url) })
      return []
    })
    setIntakePhotoStatus(null)
  }
  const closeTask = () => {
    setTask(null)
    setTaskError(null)
    clearIntakePhotos()
  }
  const stageIntakeFiles = (files: File[]) => setIntakePhotos(current => [
    ...current,
    ...files.map(file => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), name: file.name })),
  ])
  const stageIntakeUrl = (url: string) => setIntakePhotos(current => [...current, { id: crypto.randomUUID(), file: null, url, name: url.split('/').pop() || 'Foto' }])
  const moveIntakePhoto = (id: string, to: number) => setIntakePhotos(current => {
    const order = reorderPhotoIds(current.map(photo => photo.id), id, to)
    return order.map(photoId => current.find(photo => photo.id === photoId)!)
  })
  const removeIntakePhoto = (id: string) => setIntakePhotos(current => current.filter(photo => {
    if (photo.id === id && photo.file) URL.revokeObjectURL(photo.url)
    return photo.id !== id
  }))

  /** Intake photos go up after the unit is stocked, in the order shown; the first becomes primary. */
  const uploadIntakePhotos = async (stockId: string, idempotencyKey: string) => {
    let failed = 0
    for (const [index, photo] of intakePhotos.entries()) {
      setIntakePhotoStatus(`Subiendo foto ${index + 1} de ${intakePhotos.length}`)
      try {
        const response = await uploadVehiclePhoto(stockId, photo, `${idempotencyKey}:photo:${photo.id}`)
        if (!response.success) failed += 1
      } catch {
        failed += 1
      }
    }
    setIntakePhotoStatus(null)
    return failed
  }

  const intakeVehicle = () => beginTask('intake')
  const editMerchandisingDraft = (vehicle: Vehicle) => beginTask('edit', vehicle)
  const managePhotos = (vehicle: Vehicle) => beginTask('photos', vehicle)
  const moveStock = (vehicle: Vehicle) => beginTask('move', vehicle)
  const addInventoryCost = (vehicle: Vehicle) => beginTask('cost', vehicle)

  const submitInventoryTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!task) return
    if (task.type === 'photos') {
      closeTask()
      return
    }
    const field = (name: string) => task.fields[name]?.trim() || ''
    const money = (name: string, label: string) => {
      const cents = moneyInputCents(field(name))
      if (cents == null) throw new Error(`${label} debe ser un importe, por ejemplo 54.900.000 o 54900000.`)
      return cents
    }
    setTaskError(null)
    setActionMessage(null)
    setActionId(task.vehicle?.inventoryStockId || 'intake')
    let reconCompletionAttempt: ReconCompletionAttempt | null = task.reconCompletionAttempt ?? null
    let taskSuccessMessage = 'Saved.'
    let taskSuccessTone: DeskTone = 'idle'
    try {
      let response: { success: boolean; error?: string } | undefined
      if (task.type === 'intake') {
        const vin = field('vin').toUpperCase()
        const stockNumber = field('stockNumber').toUpperCase()
        const year = Number(field('year'))
        const mileage = Number(field('mileage'))
        const make = makes.length && field('makeChoice') !== OTHER_MAKE ? field('makeChoice') : field('make')
        const model = field('model')
        const condition = field('condition')
        if (!CONDITIONS.includes(condition as typeof CONDITIONS[number])) throw new Error('Elegí la condición.')
        const locationCode = field('locationCode').toUpperCase()
        const purchasePriceCents = money('purchaseDollars', 'Purchase cost')
        const priceCents = money('retailDollars', 'Retail price')
        if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) throw new Error('Ingresá un número de chasis (VIN) válido de 17 caracteres (no usa I, O ni Q).')
        if (!stockNumber || !make || !model || !locationCode || !Number.isInteger(year) || year < 1886 || year > new Date().getFullYear() + 1 || !Number.isSafeInteger(mileage) || mileage < 0 || priceCents <= 0) {
          throw new Error('Completá número de stock, año válido, marca, modelo, kilometraje, ubicación y un precio de venta mayor a cero.')
        }
        const intakeResponse = await intakeInventoryVehicle({
          rooftopId: intakeRooftopId, idempotencyKey: task.idempotencyKey,
          reason: 'Vehículo ingresado desde el panel de inventario', acquisitionSource: ACQUISITION_SOURCES.includes(field('acquisitionSource') as typeof ACQUISITION_SOURCES[number]) ? field('acquisitionSource') : 'dealer-transfer', sourceReference: field('sourceReference') || 'operator-recorded',
          vin, stockNumber, year, make, model, trim: field('trim'), exteriorColor: field('exteriorColor'), interiorColor: field('interiorColor'),
          fuelType: specValue(field('fuelType')), transmission: specValue(field('transmission')), engine: field('engine'),
          mileage, purchasePriceCents, listPriceCents: priceCents, priceCents,
          condition, description: field('description'), features: featureList(task.fields.features || ''), imagePath: '', locationCode, locationLabel: locationCode,
        })
        if (intakeResponse.success && intakePhotos.length) {
          const failed = await uploadIntakePhotos(intakeResponse.data.intakeInventoryVehicle.stockId, task.idempotencyKey)
          if (failed) {
            taskSuccessMessage = `Unidad ingresada. ${failed} de ${intakePhotos.length} fotos no se subieron; agregalas desde Fotos.`
            taskSuccessTone = 'warn'
          } else {
            taskSuccessMessage = `Unidad ingresada con ${intakePhotos.length} ${intakePhotos.length === 1 ? 'foto' : 'fotos'}.`
          }
        }
        response = intakeResponse
      } else if (task.type === 'edit' && task.vehicle) {
        const priceCents = money('retailDollars', 'Retail price')
        const mileage = Number(field('mileage'))
        if (priceCents <= 0 || !Number.isSafeInteger(mileage) || mileage < 0 || !field('description')) throw new Error('Ingresá un precio de venta mayor a cero, el kilometraje y la descripción.')
        // Photo changes in this dialog save on their own and move the stock revision forward.
        const current = currentTaskVehicle || task.vehicle
        response = await updateInventoryMerchandisingDraft({
          stockId: current.inventoryStockId, priceCents, listPriceCents: priceCents, mileage, description: field('description'),
          expectedUpdatedAt: current.stockUpdatedAt, reason: 'Borrador de publicación actualizado desde el panel de inventario', idempotencyKey: task.idempotencyKey,
        })
      } else if (task.type === 'move' && task.vehicle) {
        const locationCode = field('locationCode').toUpperCase()
        if (!locationCode) throw new Error('La ubicación es obligatoria.')
        response = await moveInventoryStock({ stockId: task.vehicle.inventoryStockId, locationCode, locationLabel: locationCode, expectedUpdatedAt: task.vehicle.stockUpdatedAt, reason: 'Movido desde el panel de inventario', idempotencyKey: task.idempotencyKey })
      } else if (task.type === 'cost' && task.vehicle) {
        const amountCents = money('dollars', 'Inventory cost')
        if (amountCents <= 0) throw new Error('Ingresá un costo mayor a cero.')
        response = await recordInventoryCost({ stockId: task.vehicle.inventoryStockId, costType: COST_TYPES.includes(field('costType') as typeof COST_TYPES[number]) ? field('costType') : 'other', amountCents, reference: field('reference') || undefined, reason: 'Costo registrado desde el panel de inventario', idempotencyKey: task.idempotencyKey })
      } else if (task.type === 'recon-open' && task.vehicle) {
        const title = field('title')
        if (!title) throw new Error('Indicá la tarea de preparación.')
        const estimatedCostCents = money('estimatedDollars', 'Estimated recon cost')
        response = await openInventoryReconWorkItem({ stockId: task.vehicle.inventoryStockId, title, category: RECON_CATEGORIES.includes(field('category') as typeof RECON_CATEGORIES[number]) ? field('category') : 'other', estimatedCostCents, reason: 'Abierto desde el panel de inventario', idempotencyKey: task.idempotencyKey })
      } else if (task.type === 'recon-complete' && task.vehicle && task.reconWorkItem) {
        const attempt = resolveReconCompletionAttempt(task.reconCompletionAttempt ?? null, () => createReconCompletionAttempt(
          task.reconWorkItem!.id,
          task.vehicle!.inventoryStockId,
          task.reconWorkItem!.updatedAt,
          money('actualDollars', 'Actual recon cost'),
          'Completed from inventory operations desk',
          task.idempotencyKey
        ))
        reconCompletionAttempt = attempt
        setTask(current => current && current.idempotencyKey === task.idempotencyKey ? { ...current, reconCompletionAttempt: attempt } : current)
        const reconResponse = await transitionInventoryReconWorkItem({ id: attempt.workItemId, toStatus: attempt.toStatus, actualCostCents: attempt.actualCostCents, expectedUpdatedAt: attempt.expectedUpdatedAt, reason: attempt.reason, idempotencyKey: attempt.idempotencyKey })
        response = reconResponse
        if (!reconResponse.success && reconResponse.rejected) {
          // Refused before anything was written: show why and let the amount be corrected.
          reconCompletionAttempt = null
          setTask(current => current && current.idempotencyKey === task.idempotencyKey ? { ...current, reconCompletionAttempt: undefined } : current)
          setTaskError(reconResponse.error)
          return
        }
        const result = normalizeReconCompletionResult(
          reconResponse.success,
          reconResponse.success ? reconResponse.data.transitionInventoryReconWorkItem : null,
          attempt
        )
        if (!result) {
          setTaskError(UNCONFIRMED_RECON_COMPLETION_MESSAGE)
          return
        }
        taskSuccessMessage = reconCompletionResultMessage(result)
      }
      if (!response?.success) {
        setTaskError(response?.error || 'Unable to save. Your entries are kept so you can retry.')
        return
      }
      closeTask()
      setActionMessage(taskSuccessMessage, taskSuccessTone)
      await loadVehicles()
    } catch (error) {
      if (task.type === 'recon-complete' && reconCompletionAttempt) {
        setTaskError(UNCONFIRMED_RECON_COMPLETION_MESSAGE)
      } else {
        setTaskError(error instanceof Error ? error.message : 'No se pudo guardar.')
      }
    } finally {
      setActionId(null)
    }
  }

  const advanceAcquisition = async (vehicle: Vehicle) => {
    if (!vehicle.acquisition || !['arrived', 'reconditioning'].includes(vehicle.acquisition.status)) return
    const toStatus = vehicle.acquisition.status === 'arrived' ? 'reconditioning' : 'frontline'
    if (toStatus === 'frontline' && (vehicle.reconStatus !== 'completed' || vehicle.merchandisingStatus !== 'approved')) {
      setActionMessage('Finish recon and approve the listing before marking frontline.', 'warn')
      return
    }
    setActionId(vehicle.inventoryStockId)
    const response = await transitionInventoryAcquisition({
      id: vehicle.acquisition.id,
      toStatus,
      expectedUpdatedAt: vehicle.acquisition.updatedAt,
      reason: `${toStatus} desde el panel de inventario`,
      idempotencyKey: `acquisition-transition:${vehicle.acquisition.id}:${crypto.randomUUID()}`,
    })
    if (response.success) setActionMessage(toStatus === 'frontline' ? 'Pasó a exhibición.' : 'Enviado a preparación.')
    else setActionMessage(response.error, 'bad')
    await loadVehicles()
    setActionId(null)
  }

  const executeMerchandisingAttempt = async (attempt: MerchandisingCommandAttempt) => {
    setPendingMerchandisingAttempt(attempt)
    setActionId(attempt.stockId)
    try {
      const response = attempt.kind !== 'submit'
        ? await decideInventoryMerchandising({ id: attempt.versionId, decision: attempt.decision, reason: attempt.reason, expectedUpdatedAt: attempt.expectedUpdatedAt, idempotencyKey: attempt.idempotencyKey })
        : await submitInventoryMerchandising({ stockId: attempt.stockId, reason: attempt.reason, idempotencyKey: attempt.idempotencyKey })
      if (!response.success && response.rejected) {
        setPendingMerchandisingAttempt(null)
        setActionMessage(response.error, 'bad')
        await loadVehicles()
        return
      }
      const result = resolveMerchandisingCommandResponse(
        response.success,
        response.success ? response.data[attempt.kind !== 'submit' ? 'decideInventoryMerchandising' : 'submitInventoryMerchandising'] : null,
        attempt
      )
      if (!result) {
        setPendingMerchandisingAttempt(attempt)
        setActionMessage(UNCONFIRMED_MERCHANDISING_COMMAND_MESSAGE, 'warn')
        return
      }
      setPendingMerchandisingAttempt(null)
      setActionMessage(merchandisingCommandResultMessage(attempt, result))
      await loadVehicles()
    } catch {
      setPendingMerchandisingAttempt(attempt)
      setActionMessage(UNCONFIRMED_MERCHANDISING_COMMAND_MESSAGE, 'warn')
    } finally {
      setActionId(null)
    }
  }

  const submitOrApproveMerchandising = async (vehicle: Vehicle) => {
    if (pendingMerchandisingAttempt) return
    const attempt = createMerchandisingCommandAttempt(vehicle.inventoryStockId, vehicle.latestMerchandisingVersion, () => crypto.randomUUID(), vehicle.publicListing.action)
    await executeMerchandisingAttempt(attempt)
  }

  const retryMerchandisingAttempt = async () => {
    const attempt = resolveMerchandisingCommandAttempt(pendingMerchandisingAttempt, () => null)
    if (attempt) await executeMerchandisingAttempt(attempt)
  }

  const executeReconStartAttempt = async (attempt: ReconStartAttempt) => {
    setPendingReconStart(attempt)
    setActionId(attempt.stockId)
    try {
      const response = await transitionInventoryReconWorkItem({ id: attempt.workItemId, toStatus: attempt.toStatus, expectedUpdatedAt: attempt.expectedUpdatedAt, reason: attempt.reason, idempotencyKey: attempt.idempotencyKey })
      if (!response.success && response.rejected) {
        setPendingReconStart(null)
        setActionMessage(response.error, 'bad')
        await loadVehicles()
        return
      }
      const result = normalizeReconStartResult(response.success, response.success ? response.data.transitionInventoryReconWorkItem : null, attempt)
      if (!result) {
        setPendingReconStart(attempt)
        setActionMessage(null)
        return
      }
      setPendingReconStart(null)
      setActionMessage(reconStartResultMessage(result))
      await loadVehicles()
    } catch {
      setPendingReconStart(attempt)
      setActionMessage(null)
    } finally {
      setActionId(null)
    }
  }

  const retryReconStart = async () => {
    const attempt = resolveReconStartAttempt(pendingReconStart, () => null)
    if (attempt) await executeReconStartAttempt(attempt)
  }

  const advanceRecon = async (vehicle: Vehicle) => {
    if (pendingReconStart) return
    const active = vehicle.reconWorkItems.find(item => ['open', 'in-progress'].includes(item.status))
    if (!active) return beginTask('recon-open', vehicle)
    if (active.status === 'in-progress') return beginTask('recon-complete', vehicle, active)
    const attempt = createReconStartAttempt(active.id, vehicle.inventoryStockId, active.updatedAt, () => crypto.randomUUID())
    await executeReconStartAttempt(attempt)
  }

  const recordPublicFeed = async () => {
    const candidateStockIds = selectPublicFeedRunCandidates(vehicles).map(vehicle => vehicle.inventoryStockId)
    const attempt = resolvePublicFeedRunAttempt(pendingFeedRun, candidateStockIds, () => `public-feed:${crypto.randomUUID()}`)
    if (!attempt) { setActionMessage('No vehicles are ready to publish.'); return }
    setPendingFeedRun(attempt)
    setActionId('feed')
    try {
      const response = await recordInventoryFeedRun({ channelKey: 'public-inventory-feed', stockIds: attempt.stockIds, errors: [], idempotencyKey: attempt.idempotencyKey })
      if (!response.success && response.rejected) {
        setPendingFeedRun(null)
        setActionMessage(response.error, 'bad')
        await loadVehicles()
        return
      }
      const result = response.success ? normalizePublicFeedRunResult(response.data.recordInventoryFeedRun, attempt.stockIds.length) : null
      if (!result) {
        setPendingFeedRun(attempt)
        setActionMessage(UNCONFIRMED_PUBLIC_FEED_RUN_MESSAGE, 'warn')
        return
      }
      setActionMessage(publicFeedRunResultMessage(result))
      setPendingFeedRun(null)
      await loadVehicles()
    } catch {
      setPendingFeedRun(attempt)
      setActionMessage(UNCONFIRMED_PUBLIC_FEED_RUN_MESSAGE, 'warn')
    } finally {
      setActionId(null)
    }
  }

  const filteredVehicles = vehicles.filter(v => {
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    const str = `${v.year} ${v.make} ${v.model} ${v.vin} ${v.stockNumber} ${v.locationCode}`.toLowerCase()
    return str.includes(search)
  }).sort((a, b) => {
    if (sortOrder === 'age-asc') return (calculateDaysInStock(a) ?? -1) - (calculateDaysInStock(b) ?? -1)
    if (sortOrder === 'price-desc') return b.price - a.price
    if (sortOrder === 'price-asc') return a.price - b.price
    if (sortOrder === 'stock') return a.stockNumber.localeCompare(b.stockNumber)
    return (calculateDaysInStock(b) ?? -1) - (calculateDaysInStock(a) ?? -1)
  })

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return '-'
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(value)
  }

  /** Stops at the sale date once sold; null for a sold unit with no recorded sale date. */
  function calculateDaysInStock(vehicle: Vehicle): number | null {
    const date = vehicle.dateAcquired || vehicle.createdAt
    if (vehicle.status === 'sold' && !vehicle.soldAt) return null
    if (!date) return 0
    const end = vehicle.status === 'sold' && vehicle.soldAt ? new Date(vehicle.soldAt).getTime() : Date.now()
    return Math.max(0, Math.floor((end - new Date(date).getTime()) / (1000 * 60 * 60 * 24)))
  }
  const daysLabel = (vehicle: Vehicle) => {
    const days = calculateDaysInStock(vehicle)
    return days == null ? 'Vendido' : `${days} d`
  }

  const totalValue = filteredVehicles.filter(v => v.status === 'available').reduce((sum, v) => sum + (v.price || 0), 0)
  const avgDaysInStock = filteredVehicles.filter(v => v.status === 'available').length > 0
    ? Math.round(filteredVehicles.filter(v => v.status === 'available').reduce((sum, v) => sum + (calculateDaysInStock(v) ?? 0), 0) / filteredVehicles.filter(v => v.status === 'available').length)
    : 0
  const agingCount = filteredVehicles.filter(v => v.status === 'available' && (calculateDaysInStock(v) ?? 0) > 60).length
  const updateTaskField = (name: string, value: string) => setTask(current => current ? { ...current, fields: { ...current.fields, [name]: value } } : current)
  const taskInput = (name: string, label: string, options: { type?: string; required?: boolean; min?: number; step?: number; maxLength?: number; inputMode?: 'decimal' | 'numeric' | 'text'; disabled?: boolean; list?: string } = {}) => (
    <label key={name} htmlFor={`inventory-task-${name}`} className="grid gap-1.5 text-sm">
      <span className={fieldLabelClass}>{label}</span>
      <Input id={`inventory-task-${name}`} type={options.type || 'text'} inputMode={options.inputMode} min={options.min} step={options.step} maxLength={options.maxLength} required={options.required ?? true} disabled={options.disabled} list={options.list} value={task?.fields[name] || ''} onChange={event => updateTaskField(name, event.target.value)} />
    </label>
  )
  const taskSelect = (name: string, label: string, options: ReadonlyArray<{ value: string; label: string }>) => (
    <label key={name} htmlFor={`inventory-task-${name}`} className="grid gap-1.5 text-sm">
      <span className={fieldLabelClass}>{label}</span>
      <Select value={task?.fields[name] || ''} onValueChange={value => updateTaskField(name, value)}>
        <SelectTrigger id={`inventory-task-${name}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </label>
  )
  const taskTitle = task?.type === 'intake' ? 'Ingresar vehículo' : task?.type === 'edit' ? 'Editar borrador de publicación' : task?.type === 'photos' ? 'Fotos' : task?.type === 'move' ? 'Mover unidad' : task?.type === 'cost' ? 'Registrar costo' : task?.type === 'recon-open' ? 'Agregar tarea de preparación' : 'Terminar tarea de preparación'
  const intakeMakeChoice = task?.type === 'intake' ? task.fields.makeChoice || '' : ''
  const intakeModels = makes.find(make => make.name === intakeMakeChoice)?.models || []

  const isFiltered = Boolean(searchQuery.trim()) || statusFilter !== 'all'
  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
  }

  const breadcrumbs = [
    { type: 'link' as const, label: 'Inicio', href: basePath },
    { type: 'page' as const, label: 'Gestión' },
    { type: 'page' as const, label: 'Inventario' },
  ]

  const lotTotal = lotCounts ? Object.values(lotCounts).reduce((sum, count) => sum + count, 0) : undefined
  const statusOptions = [
    { value: 'all', label: 'Todos', count: lotTotal },
    ...LOT_STATUSES.map(status => ({ value: status, label: statusLabels[status], count: lotCounts ? lotCounts[status] || 0 : undefined, tone: statusTones[status] })),
  ]
  const reconOpenCount = filteredVehicles.filter(hasOpenRecon).length
  const intakeRooftopName = intakeRooftops.find(rooftop => rooftop.id === intakeRooftopId)?.name

  /** Aged per the desk's 60-day threshold: available units only. */
  const isAged = (vehicle: Vehicle) => {
    const days = calculateDaysInStock(vehicle)
    return days != null && days > 60 && vehicle.status === 'available'
  }

  /** One step at a time: send to recon, work the recon items, approve the listing, then frontline. */
  const buildActions = (vehicle: Vehicle) => {
    const active = isActiveInventory(vehicle)
    const acquisitionStatus = vehicle.acquisition?.status
    const activeRecon = vehicle.reconWorkItems.find(item => ['open', 'in-progress'].includes(item.status))
    const reconDone = vehicle.reconStatus === 'completed'
    const listingApproved = vehicle.merchandisingStatus === 'approved'
    const needs = listingNeeds(vehicle)
    const actions: Array<{ key: string; label: string; onClick: () => void; disabled?: boolean }> = []
    // Pending, sold and delivered units are off the lot workflow: no recon, listing or frontline steps.
    if (active && acquisitionStatus === 'arrived' && vehicle.acquisition) {
      actions.push({ key: 'acquisition', label: 'Enviar a preparación', onClick: () => advanceAcquisition(vehicle) })
    }
    if (active && !reconDone && acquisitionStatus !== 'arrived') {
      actions.push({
        key: 'recon',
        label: !activeRecon ? 'Add work item' : activeRecon.status === 'in-progress' ? 'Terminar tarea' : 'Iniciar tarea',
        onClick: () => advanceRecon(vehicle),
        disabled: Boolean(pendingReconStart),
      })
    }
    if (active && reconDone && (!listingApproved || vehicle.publicListing.action)) {
      const submits = vehicle.publicListing.action !== 'reapprove' && vehicle.merchandisingStatus !== 'submitted'
      const listingLabel = vehicle.publicListing.action === 'reapprove' ? 'Re-approve listing'
        : vehicle.publicListing.action === 'resubmit' ? 'Resubmit listing'
          : vehicle.merchandisingStatus === 'submitted' ? 'Aprobar publicación' : 'Enviar publicación a revisión'
      // Submitting needs photos, a description and a price: offer the missing piece as the step.
      if (submits && needs === 'photos') actions.push({ key: 'listing', label: 'Agregar fotos', onClick: () => managePhotos(vehicle) })
      else if (submits && needs === 'details') actions.push({ key: 'listing', label: 'Agregar descripción', onClick: () => editMerchandisingDraft(vehicle) })
      else actions.push({ key: 'listing', label: listingLabel, onClick: () => submitOrApproveMerchandising(vehicle), disabled: Boolean(pendingMerchandisingAttempt) })
    }
    if (active && acquisitionStatus === 'reconditioning' && vehicle.acquisition && reconDone && listingApproved && !vehicle.publicListing.action) {
      actions.push({ key: 'acquisition', label: 'Pasar a exhibición', onClick: () => advanceAcquisition(vehicle) })
    }
    return actions
  }

  /** Why a unit is waiting on the desk, from the statuses the workspace already returns. */
  const waitingReasons = (vehicle: Vehicle) => {
    const reasons: Array<{ key: string; label: string; aged?: boolean }> = []
    if (isAged(vehicle)) reasons.push({ key: 'aged', label: `${calculateDaysInStock(vehicle)} días en stock`, aged: true })
    if (!isActiveInventory(vehicle)) return reasons
    if (vehicle.acquisition?.status === 'arrived') reasons.push({ key: 'arrived', label: 'Recibido, sin enviar a preparación' })
    if (hasOpenRecon(vehicle)) reasons.push({ key: 'recon', label: reconLabel(vehicle) })
    if (!vehicle.images.length) reasons.push({ key: 'photos', label: 'Sin fotos' })
    if (vehicle.reconStatus === 'completed' && (vehicle.merchandisingStatus !== 'approved' || vehicle.publicListing.action)) {
      reasons.push({
        key: 'listing',
        label: vehicle.publicListing.action === 'reapprove' ? 'Listing needs re-approval'
          : vehicle.publicListing.action === 'resubmit' ? 'Listing needs resubmitting'
            : listingLabels[vehicle.merchandisingStatus] || vehicle.merchandisingStatus,
      })
    }
    return reasons
  }

  // The queue reads the loaded lot, not the search box: oldest aged units first, then the rest by age.
  const needsYou = vehicles
    .map(vehicle => ({ vehicle, reasons: waitingReasons(vehicle), days: calculateDaysInStock(vehicle) ?? 0 }))
    .filter(entry => entry.reasons.length > 0)
    .sort((a, b) => Number(isAged(b.vehicle)) - Number(isAged(a.vehicle)) || b.days - a.days)

  const thumbFor = (vehicle: Vehicle) => vehicle.images.find(image => image.url)?.url || vehicle.primaryImagePath

  const vehicleName = (vehicle: Vehicle) => (
    <Link href={`${basePath}/platform/vehicles/${vehicle.id}`} className="font-medium text-foreground hover:underline">
      {vehicle.year} {vehicle.make} {vehicle.model}
      {vehicle.trim && <span className="font-normal text-muted-foreground"> {vehicle.trim}</span>}
    </Link>
  )

  const reconCell = (vehicle: Vehicle) => {
    const label = reconLabel(vehicle)
    const tone: DeskTone = label === 'Preparación terminada' ? 'ok' : label === 'Preparación en curso' ? 'info' : hasOpenRecon(vehicle) ? 'warn' : 'idle'
    return <Status tone={tone}>{label.replace(/^Recon /, '').replace(/^\w/, c => c.toUpperCase())}</Status>
  }

  const listingCell = (vehicle: Vehicle, stage: string) => {
    const status = vehicle.merchandisingStatus
    const tone: DeskTone = vehicle.publicListing.action ? 'warn' : status === 'approved' ? 'ok' : status === 'submitted' ? 'warn' : status === 'rejected' ? 'bad' : 'idle'
    const word = vehicle.publicListing.action === 'reapprove' ? 'Re-approve' : vehicle.publicListing.action === 'resubmit' ? 'Resubmit'
      : (listingLabels[status] || status).replace(/^Listing /, '').replace(/^\w/, c => c.toUpperCase())
    const showLive = stage === 'available' || stage === 'prep'
    return (
      <div className="min-w-0">
        <Status tone={tone}>{word}</Status>
        {showLive && (
          <p className="mt-0.5 max-w-[14rem] truncate text-xs text-muted-foreground" title={vehicle.publicListing.live ? undefined : vehicle.publicListing.reason || undefined}>
            {vehicle.publicListing.live ? 'Publicado en la web' : `No publicado: ${vehicle.publicListing.reason || 'No disponible'}`}
          </p>
        )}
      </div>
    )
  }

  const moreMenu = (vehicle: Vehicle, busy: boolean) => {
    const active = isActiveInventory(vehicle)
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Pill size="sm" variant="plain" className="w-7 px-0 max-md:size-10" aria-label={`Más acciones para ${vehicle.stockNumber}`} disabled={busy}>
            <MoreHorizontal />
          </Pill>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild><Link href={`${basePath}/platform/vehicles/${vehicle.id}`}>Abrir vehículo</Link></DropdownMenuItem>
          {active && <DropdownMenuItem disabled={busy} onClick={() => moveStock(vehicle)}>Mover</DropdownMenuItem>}
          <DropdownMenuItem disabled={busy} onClick={() => addInventoryCost(vehicle)}>Costo</DropdownMenuItem>
          {active ? <>
            <DropdownMenuItem disabled={busy} onClick={() => editMerchandisingDraft(vehicle)}>Editar publicación</DropdownMenuItem>
            <DropdownMenuItem disabled={busy} onClick={() => managePhotos(vehicle)}>Fotos</DropdownMenuItem>
          </> : (
            <DropdownMenuItem disabled>{inactiveReason(vehicle)}</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const header = (
    <DeskHeader
      title="Inventario"
      tone={error ? 'bad' : agingCount > 0 ? 'warn' : 'ok'}
      status={error ? 'No disponible' : agingCount > 0 ? `${agingCount} unidades demoradas` : 'Sin unidades demoradas'}
      meta={[
        lotTotal !== undefined ? countLabel(lotTotal, 'unidad', 'unidades') : null,
        error ? 'No disponible' : needsYou.length ? `${needsYou.length} esperan una acción` : lotTotal !== undefined ? 'Nada pendiente' : null,
        intakeRooftopName,
      ].filter(Boolean).join(' · ') || undefined}
      actions={
        <>
          {intakeRooftops.length > 1 && (
            <Select value={intakeRooftopId} onValueChange={setIntakeRooftopId}>
              <SelectTrigger className="text-[13px] h-8 w-full rounded-[4px] sm:w-[180px]" aria-label="Sucursal de ingreso">
                <SelectValue placeholder="Sucursal de ingreso" />
              </SelectTrigger>
              <SelectContent>
                {intakeRooftops.map(rooftop => (
                  <SelectItem key={rooftop.id} value={rooftop.id}>
                    {rooftop.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Track>
            <Pill variant="plain" onClick={loadVehicles} disabled={loading} aria-label="Actualizar">
              <RefreshCw className={loading ? 'animate-spin' : undefined} />
              <span className="max-sm:sr-only">Actualizar</span>
            </Pill>
            <Pill variant="plain" asChild>
              <Link href={`${basePath}/platform/vehicles/acquisitions`}><ClipboardList /><span className="max-sm:sr-only">Ingresos</span></Link>
            </Pill>
            <Pill variant="plain" asChild>
              <Link href={`${basePath}/platform/vehicles/feed`}><History /><span className="max-sm:sr-only">Feed</span></Link>
            </Pill>
            <Pill onClick={recordPublicFeed} disabled={actionId === 'feed'}>
              <Upload />
              {pendingFeedRun ? 'Reintentar publicación' : 'Publicar feed'}
            </Pill>
            <Pill variant="primary" onClick={intakeVehicle} disabled={actionId === 'intake' || !intakeRooftopId}>
              <Plus /> Ingresar vehículo
            </Pill>
          </Track>
        </>
      }
    />
  )

  const renderDetails = (vehicle: Vehicle) => (
    <div role="region" aria-label={`Detalle del vehículo ${vehicle.stockNumber}`} className="grid gap-x-8 gap-y-3 lg:grid-cols-2">
      <Facts
        items={[
          { label: 'VIN / chasis', value: vehicle.vin, mono: true },
          { label: 'Stock #', value: vehicle.stockNumber, mono: true },
          { label: 'Ubicación', value: vehicle.locationLabel || vehicle.locationCode },
          { label: 'Días en stock', value: daysLabel(vehicle), mono: true },
          { label: 'Precio de venta', value: formatCurrency(vehicle.price), mono: true },
          { label: 'Costo', value: vehicle.purchasePrice == null ? 'Not recorded' : formatCurrency(vehicle.purchasePrice), mono: true },
        ]}
      />
      <Facts
        items={[
          { label: 'Ingreso', value: vehicle.acquisition ? acquisitionLabels[vehicle.acquisition.status] || vehicle.acquisition.status : 'Ninguna' },
          { label: 'Preparación', value: reconLabel(vehicle) },
          { label: 'Publicación', value: listingLabels[vehicle.merchandisingStatus] || vehicle.merchandisingStatus },
          { label: 'Página web', value: vehicle.publicListing.live ? 'Publicado' : `No publicado: ${vehicle.publicListing.reason || 'No disponible'}` },
          { label: 'Feed', value: vehicle.feedStatus },
          { label: 'Colores', value: [vehicle.color, vehicle.interiorColor].filter(Boolean).join(' / ') || 'Not recorded' },
          { label: 'Fotos', value: vehicle.images.length || 'Ninguna', mono: vehicle.images.length > 0 },
          { label: 'Tareas de preparación', value: vehicle.reconWorkItems.length, mono: true },
        ]}
      />
      <div className="min-w-0 border-t pt-3 text-sm lg:col-span-2">
        <p className={fieldLabelClass}>Publicación</p>
        <p className="mt-1 break-words text-muted-foreground">{vehicle.description || 'No description'}</p>
      </div>
      <div className="lg:col-span-2">
        <Track>
          <Pill size="sm" className="max-md:h-10" asChild><Link href={`${basePath}/platform/vehicles/${vehicle.id}`}>Abrir vehículo</Link></Pill>
          {isActiveInventory(vehicle) && <Pill size="sm" className="max-md:h-10" onClick={() => managePhotos(vehicle)}>Fotos</Pill>}
          <Pill size="sm" variant="plain" className="max-md:h-10" onClick={() => setSelectedVehicle(null)}>Cerrar detalle</Pill>
        </Track>
      </div>
    </div>
  )

  return (
    <PageContainer title="Inventario" header={header} breadcrumbs={breadcrumbs}>
    <div className="min-w-0 max-w-full space-y-6 px-4 pb-24 md:px-6">
      {actionMessage && (
        <Notice tone={actionTone}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>{actionMessage}</span>
            {pendingMerchandisingAttempt && (
              <Track>
                <Pill size="sm" onClick={retryMerchandisingAttempt} disabled={Boolean(actionId)}>Reintentar</Pill>
              </Track>
            )}
          </div>
        </Notice>
      )}
      {pendingReconStart && (
        <Notice tone="warn">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>{UNCONFIRMED_RECON_START_MESSAGE}</span>
            <Track>
              <Pill size="sm" onClick={retryReconStart} disabled={Boolean(actionId)}>Reintentar</Pill>
            </Track>
          </div>
        </Notice>
      )}

      {!loading && !error && (
        <DeskSection title="Requiere acción" count={needsYou.length} id="inventory-needs-you">
          {needsYou.length === 0 ? (
            <p className="py-3 text-[13px] text-muted-foreground">
              {statusFilter === 'all' ? 'No hay unidades demoradas ni tareas de preparación, publicación o fotos pendientes.' : `Nada pendiente en ${statusLabels[statusFilter] || statusFilter}.`}
            </p>
          ) : (
            <DeskTable aria-label="Unidades que esperan una acción">
              <thead>
                <tr>
                  <Th>Vehículo</Th>
                  <Th priority={2}>Pendiente</Th>
                  <Th align="right" priority={2}>Días</Th>
                  <Th align="right"><span className="sr-only">Próximo paso</span></Th>
                </tr>
              </thead>
              <tbody>
                {needsYou.map(({ vehicle, reasons }) => {
                  const next = buildActions(vehicle)[0]
                  const busy = actionId === vehicle.inventoryStockId
                  const reasonList = (
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      {reasons.map(reason => reason.aged
                        ? <Attention key={reason.key}>{reason.label}</Attention>
                        : <span key={reason.key} className="text-[13px] text-foreground">{reason.label}</span>)}
                    </span>
                  )
                  return (
                    <Tr key={vehicle.id}>
                      <Td className="min-w-0">
                        <div className="min-w-0">{vehicleName(vehicle)}</div>
                        <div className="mt-0.5"><Code>{vehicle.stockNumber}</Code></div>
                        <div className="mt-1 md:hidden">{reasonList}</div>
                      </Td>
                      <Td priority={2}>{reasonList}</Td>
                      <Td align="right" priority={2}>
                        <Figure size="sm" attention={isAged(vehicle)}>{daysLabel(vehicle)}</Figure>
                      </Td>
                      <Td align="right" className="whitespace-nowrap">
                        {next ? (
                          <Pill size="sm" className="max-md:h-10" disabled={busy || next.disabled} onClick={next.onClick}>{next.label}</Pill>
                        ) : (
                          <Pill size="sm" variant="plain" className="max-md:h-10" asChild><Link href={`${basePath}/platform/vehicles/${vehicle.id}`}>Abrir</Link></Pill>
                        )}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </DeskTable>
          )}
        </DeskSection>
      )}

      <DeskSection title={statusFilter === 'all' ? 'Stock' : statusLabels[statusFilter] || statusFilter} count={loading || error ? undefined : filteredVehicles.length} id="inventory-lot">
        <div className="mb-3 flex min-w-0 flex-col gap-3">
          <Segmented label="Filtrar por estado" value={statusFilter} onChange={setStatusFilter} options={statusOptions} className="self-stretch" />
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Stock, chasis, marca, modelo"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-[4px] pl-9 text-[13px] max-md:h-10"
                aria-label="Buscar en el inventario"
              />
            </div>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="text-[13px] w-full rounded-[4px] max-md:h-10 sm:w-[180px]" aria-label="Ordenar inventario">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="age-desc">Más antiguos primero</SelectItem>
                <SelectItem value="age-asc">Más nuevos primero</SelectItem>
                <SelectItem value="price-desc">Mayor precio</SelectItem>
                <SelectItem value="price-asc">Menor precio</SelectItem>
                <SelectItem value="stock">Número de stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12" role="status">
            <RefreshCw className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Cargando inventario</span>
          </div>
        ) : error ? (
          <Notice tone="bad">
            <p className="font-medium">No se pudo cargar el inventario</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
            <Track className="mt-2">
              <Pill size="sm" onClick={loadVehicles}>Reintentar</Pill>
            </Track>
          </Notice>
        ) : filteredVehicles.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">{isFiltered ? 'Sin resultados' : 'No hay vehículos'}</p>
            {isFiltered && (
              <Track>
                <Pill size="sm" onClick={resetFilters}>Limpiar filtros</Pill>
              </Track>
            )}
          </div>
        ) : (
          <DeskTable aria-label="Inventario">
            <thead>
              <tr>
                <Th priority={2} className="w-14"><span className="sr-only">Foto</span></Th>
                <Th>Vehículo</Th>
                <Th priority={2}>Stock #</Th>
                <Th priority={2}>Estado</Th>
                <Th priority={3}>Preparación</Th>
                <Th priority={3}>Publicación</Th>
                <Th align="right">Días</Th>
                <Th align="right">Precio</Th>
                <Th align="right" priority={2}><span className="sr-only">Acciones</span></Th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.map((vehicle) => {
                const busy = actionId === vehicle.inventoryStockId
                const stage = lotStage(vehicle)
                const isOpen = selectedVehicle?.id === vehicle.id
                const thumb = thumbFor(vehicle)
                const actions = buildActions(vehicle)
                const subline = [
                  vehicle.color,
                  conditionLabels[vehicle.condition] || vehicle.condition,
                  `${vehicle.mileage.toLocaleString('es-AR')} km`,
                  vehicle.locationLabel || vehicle.locationCode,
                ].filter(Boolean)
                const rowButtons = (
                  <div className="flex items-center justify-end gap-1">
                    {actions.map(action => (
                      <Pill key={action.key} size="sm" className="max-md:h-10" disabled={busy || action.disabled} onClick={action.onClick}>
                        {action.label}
                      </Pill>
                    ))}
                    <Pill size="sm" variant="plain" className="max-md:h-10" aria-expanded={isOpen} onClick={() => setSelectedVehicle(current => current?.id === vehicle.id ? null : vehicle)}>
                      Detalle
                    </Pill>
                    {moreMenu(vehicle, busy)}
                  </div>
                )
                return [
                  <Tr key={vehicle.id} className={isOpen ? 'border-b-0 bg-muted/30' : undefined}>
                    <Td priority={2} className="w-14 py-2">
                      <div className="relative h-9 w-12 overflow-hidden rounded-[4px] bg-muted">
                        {thumb
                          ? <Image src={thumb} alt="" fill unoptimized sizes="48px" className="object-cover" />
                          : null}
                        {thumb && isRepresentativePhoto(thumb, vehicle) && (
                          <span title="Foto ilustrativa: otro modelo" className="absolute inset-x-0 bottom-0 bg-zinc-950/75 text-center text-[9px] font-medium leading-3 text-white">Similares</span>
                        )}
                        {thumb
                          ? null
                          : <span className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">Sin foto</span>}
                      </div>
                    </Td>
                    <Td className="min-w-0 max-w-[22rem] max-md:max-w-[13rem]">
                      <div className="min-w-0 break-words">{vehicleName(vehicle)}</div>
                      <p className="mt-0.5 text-xs text-muted-foreground max-md:line-clamp-2 md:truncate">{subline.join(' · ')}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 md:hidden">
                        <Code>{vehicle.stockNumber}</Code>
                        <Status tone={statusTones[stage] || 'idle'}>{statusLabels[stage] || stage}</Status>
                      </div>
                      <div className="mt-2 md:hidden [&>div]:justify-start [&>div]:flex-wrap">{rowButtons}</div>
                    </Td>
                    <Td priority={2}><Code className="text-foreground">{vehicle.stockNumber}</Code></Td>
                    <Td priority={2}><Status tone={statusTones[stage] || 'idle'}>{statusLabels[stage] || stage}</Status></Td>
                    <Td priority={3}>{reconCell(vehicle)}</Td>
                    <Td priority={3}>{listingCell(vehicle, stage)}</Td>
                    <Td align="right" className="align-top md:align-middle">
                      <span className="sr-only">Días en stock </span>
                      <Figure size="sm" attention={isAged(vehicle)}>{daysLabel(vehicle)}</Figure>
                    </Td>
                    <Td align="right" className="align-top md:align-middle">
                      <span className="sr-only">Precio </span>
                      <Figure size="sm">{formatCurrency(vehicle.price)}</Figure>
                    </Td>
                    <Td align="right" priority={2} className="whitespace-nowrap">{rowButtons}</Td>
                  </Tr>,
                  isOpen ? (
                    <tr key={`${vehicle.id}-details`} className="border-b bg-muted/30">
                      <td colSpan={9} className="px-4 pb-4 pt-1">{renderDetails(vehicle)}</td>
                    </tr>
                  ) : null,
                ]
              })}
            </tbody>
          </DeskTable>
        )}
      </DeskSection>

      {!loading && !error && (
        <ReadoutStrip>
          <Readout label="Unidades" value={filteredVehicles.length} />
          <Readout label="Valor de venta" value={formatCurrency(totalValue)} sub="Available units" />
          <Readout label="Días promedio" value={avgDaysInStock} sub="Available units" />
          <Readout label="Más de 60 días" value={agingCount} tone={agingCount > 0 ? 'warn' : undefined} />
          <Readout label="Preparación abierta" value={reconOpenCount} tone={reconOpenCount > 0 ? 'info' : undefined} />
        </ReadoutStrip>
      )}

      <Dialog open={Boolean(task)} onOpenChange={open => { if (!open && !actionId && !task?.reconCompletionAttempt) closeTask() }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{taskTitle}</DialogTitle>
            <DialogDescription className="text-[13px]">
              {task?.vehicle
                ? `${task.vehicle.stockNumber} · ${task.vehicle.year} ${task.vehicle.make} ${task.vehicle.model}${task.reconWorkItem ? ` · ${task.reconWorkItem.title}` : ''}`
                : intakeRooftopName || 'New unit'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitInventoryTask} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {task?.type === 'intake' && <>
                {taskInput('vin', '17-character VIN', { required: true, maxLength: 17 })}
                {taskInput('stockNumber', 'Número de stock')}
                {taskInput('year', 'Año', { type: 'number', min: 1886, step: 1 })}
                <label htmlFor="inventory-task-condition" className="grid gap-1.5 text-sm">
                  <span className={fieldLabelClass}>Condición</span>
                  <Select value={task.fields.condition || 'used'} onValueChange={value => updateTaskField('condition', value)}>
                    <SelectTrigger id="inventory-task-condition">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITIONS.map(condition => (
                        <SelectItem key={condition} value={condition}>{conditionLabels[condition]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                {makes.length > 0 ? (
                  <label htmlFor="inventory-task-makeChoice" className="grid gap-1.5 text-sm">
                    <span className={fieldLabelClass}>Marca</span>
                    <Select value={intakeMakeChoice} onValueChange={value => { updateTaskField('makeChoice', value); updateTaskField('model', '') }}>
                      <SelectTrigger id="inventory-task-makeChoice">
                        <SelectValue placeholder="Elegí la marca" />
                      </SelectTrigger>
                      <SelectContent>
                        {makes.map(make => (
                          <SelectItem key={make.id} value={make.name}>{make.name}</SelectItem>
                        ))}
                        <SelectItem value={OTHER_MAKE}>Otra</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                ) : taskInput('make', 'Marca', { maxLength: 100 })}
                {makes.length > 0 && intakeMakeChoice === OTHER_MAKE && taskInput('make', 'Otra marca', { maxLength: 100 })}
                {taskInput('model', 'Modelo', { maxLength: 100, list: intakeModels.length ? 'inventory-task-model-options' : undefined })}
                {intakeModels.length > 0 && (
                  <datalist id="inventory-task-model-options">
                    {intakeModels.map(model => <option key={model.id} value={model.name} />)}
                  </datalist>
                )}
                {taskInput('trim', 'Versión (opcional)', { required: false, maxLength: 100 })}
                {taskInput('exteriorColor', 'Color exterior (opcional)', { required: false, maxLength: 100 })}
                {taskInput('interiorColor', 'Color interior (opcional)', { required: false, maxLength: 100 })}
                {taskSelect('fuelType', 'Combustible', [{ value: SPEC_NONE, label: 'No informado' }, ...FUEL_OPTIONS])}
                {taskSelect('transmission', 'Transmisión', [{ value: SPEC_NONE, label: 'No informada' }, ...TRANSMISSION_OPTIONS])}
                {taskInput('engine', 'Cilindrada / motor (opcional)', { required: false, maxLength: 40 })}
                {taskInput('mileage', 'Kilometraje', { type: 'number', min: 0, step: 1 })}
                {taskInput('purchaseDollars', `Costo de compra (${currencyCode})`, { inputMode: 'decimal' })}
                {taskInput('retailDollars', `Precio de venta (${currencyCode})`, { inputMode: 'decimal' })}
                {taskInput('locationCode', 'Ubicación')}
                {taskSelect('acquisitionSource', 'Origen', ACQUISITION_SOURCES.map(value => ({ value, label: acquisitionSourceLabels[value] })))}
                {taskInput('sourceReference', 'Referencia (opcional)', { required: false, maxLength: 200 })}
              </>}
              {task?.type === 'edit' && <>
                {taskInput('retailDollars', `Precio de venta (${currencyCode})`, { inputMode: 'decimal' })}
                {taskInput('mileage', 'Kilometraje', { type: 'number', min: 0, step: 1 })}
              </>}
              {task?.type === 'move' && taskInput('locationCode', 'New lot location')}
              {task?.type === 'cost' && <>
                {taskSelect('costType', 'Tipo de costo', COST_TYPES.map(value => ({ value, label: costTypeLabels[value] })))}
                {taskInput('dollars', `Importe (${currencyCode})`, { inputMode: 'decimal' })}
                {taskInput('reference', 'Invoice or reference (optional)', { required: false })}
              </>}
              {task?.type === 'recon-open' && <>
                {taskInput('title', 'Tarea')}
                {taskSelect('category', 'Categoría', RECON_CATEGORIES.map(value => ({ value, label: reconCategoryLabels[value] })))}
                {taskInput('estimatedDollars', `Costo estimado (${currencyCode})`, { inputMode: 'decimal' })}
              </>}
              {task?.type === 'recon-complete' && taskInput('actualDollars', `Costo real (${currencyCode})`, { inputMode: 'decimal', disabled: Boolean(task.reconCompletionAttempt) })}
              {task?.type === 'intake' && (
                <label htmlFor="inventory-task-features" className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className={fieldLabelClass}>Equipamiento (opcional, uno por línea)</span>
                  <Textarea id="inventory-task-features" value={task.fields.features || ''} onChange={event => updateTaskField('features', event.target.value)} rows={3} />
                </label>
              )}
              {(task?.type === 'intake' || task?.type === 'edit') && (
                <label htmlFor="inventory-task-description" className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className={fieldLabelClass}>Description{task.type === 'edit' ? '' : ' (required to publish)'}</span>
                  <Textarea id="inventory-task-description" required={task.type === 'edit'} value={task.fields.description || ''} onChange={event => updateTaskField('description', event.target.value)} rows={3} />
                </label>
              )}
              {task?.type === 'intake' && (
                <VehiclePhotoEditor
                  label="Fotos (obligatorias para publicar)"
                  tiles={intakePhotos}
                  busy={Boolean(actionId)}
                  status={intakePhotoStatus}
                  onAddFiles={stageIntakeFiles}
                  onAddUrl={stageIntakeUrl}
                  onMove={moveIntakePhoto}
                  onRemove={removeIntakePhoto}
                />
              )}
              {(task?.type === 'edit' || task?.type === 'photos') && currentTaskVehicle && (
                <LiveVehiclePhotos
                  stockId={currentTaskVehicle.inventoryStockId}
                  images={currentTaskVehicle.images}
                  label={task.type === 'edit' ? 'Fotos (se guardan al modificarlas)' : 'Fotos (la primera es la principal)'}
                  onChanged={loadVehicles}
                />
              )}
            </div>
            {taskError && <Notice tone="bad">{taskError}</Notice>}
            <DialogFooter className="sm:justify-end">
              <Track>
                {task?.type === 'photos' ? (
                  <Pill type="submit" variant="primary" className="max-sm:h-11">Listo</Pill>
                ) : <>
                  <Pill variant="plain" className="max-sm:h-11" disabled={Boolean(actionId) || Boolean(task?.reconCompletionAttempt)} onClick={closeTask}>Cancelar</Pill>
                  <Pill type="submit" variant="primary" className="max-sm:h-11" disabled={Boolean(actionId)}>{actionId ? 'Guardando…' : task?.reconCompletionAttempt ? 'Reintentar' : 'Guardar'}</Pill>
                </>}
              </Track>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </PageContainer>
  )
}
