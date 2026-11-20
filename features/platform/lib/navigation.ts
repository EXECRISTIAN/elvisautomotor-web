import {
  Tag,
  Percent,
  BarChart3,
  CalendarClock,
  Car,
  CarFront,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileBarChart,
  KeyRound,
  Building2,
  Boxes,
  Tags,
  Contact,
  Receipt,
  Gauge,
  Landmark,
  LucideIcon,
  Package,
  PackageCheck,
  Settings2,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react'

export interface PlatformNavItem {
  title: string
  href: string
  color: string
  description: string
  icon: LucideIcon
  group?: string
}

export interface PlatformNavGroup {
  id: string
  title: string
  icon: LucideIcon
  items: PlatformNavItem[]
}

// Menú del panel para Elvis Automotores. Los módulos que Elvis no usa (taller, repuestos, pagos con
// tarjeta, contabilidad, entregas, API) quedan fuera del menú pero NO se borran: sus rutas siguen
// existiendo y se pueden volver a mostrar quitándolos de HIDDEN_FOR_ELVIS.
const allPlatformNavItems: PlatformNavItem[] = [
  // Principal
  { title: 'Resumen',        href: '/platform/overview',       color: 'slate',   description: 'Ventas, inventario y actividad del día.',                       icon: Gauge,         group: 'standalone' },
  { title: 'Inventario',     href: '/platform/vehicles',       color: 'blue',    description: 'Vehículos, precios, fotos, destacados y publicación.',          icon: Car,           group: 'standalone' },
  { title: 'Operaciones',    href: '/platform/deals',          color: 'emerald', description: 'Operaciones de venta desde la cotización hasta la entrega.',   icon: DollarSign,    group: 'standalone' },
  { title: 'Estadísticas',   href: '/platform/analytics',      color: 'violet',  description: 'Ventas, inventario, conversión y métricas.',                     icon: BarChart3,     group: 'standalone' },
  { title: 'Configuración',  href: '/platform/store-settings', color: 'slate',   description: 'Datos del negocio, horarios, WhatsApp y moneda.',               icon: Settings2,     group: 'standalone' },

  // Ventas
  { title: 'Consultas',      href: '/platform/crm',            color: 'purple',  description: 'Consultas, seguimiento y oportunidades de venta.',             icon: Users,         group: 'sales' },
  { title: 'Pruebas de manejo', href: '/platform/test-drives', color: 'cyan',    description: 'Citas de prueba de manejo.',                                   icon: CalendarClock, group: 'sales' },
  { title: 'Usados ofrecidos', href: '/platform/trade-ins',    color: 'amber',   description: 'Autos que ofrecen los clientes (Véndelo en Elvis).',            icon: CarFront,      group: 'sales' },
  { title: 'Ofertas progresivas', href: '/progressive-offers', color: 'amber', description: 'Precios que bajan por hora o por día (se ven en /ofertas).', icon: Tag, group: 'sales' },
  { title: 'Clientes',       href: '/platform/customers',      color: 'pink',    description: 'Fichas de clientes e historial.',                                icon: Contact,       group: 'sales' },

  // Financiación
  { title: 'Solicitudes de crédito', href: '/platform/finance', color: 'indigo', description: 'Solicitudes de financiación y envío a entidades.',             icon: CreditCard,    group: 'finance' },
  { title: 'Bancos',         href: '/banks',                   color: 'indigo',  description: 'Entidades con las que trabaja la agencia.',                      icon: Landmark,      group: 'finance' },
  { title: 'Planes de financiación', href: '/financing-plans', color: 'indigo', description: 'Tasas, plazos y montos que usa el simulador del sitio.',      icon: Percent,       group: 'finance' },
  { title: 'Entregas',       href: '/platform/delivery',       color: 'teal',    description: 'Entregas y checklist.',                                          icon: PackageCheck,  group: 'finance' },
  { title: 'Pagos',          href: '/platform/payments',       color: 'green',   description: 'Transacciones y devoluciones.',                                  icon: Receipt,       group: 'finance' },
  { title: 'Contabilidad',   href: '/platform/accounting',     color: 'sky',     description: 'Asientos y cuentas contables.',                                  icon: Landmark,      group: 'finance' },

  // Taller
  { title: 'Taller',         href: '/platform/service',        color: 'orange',  description: 'Citas y órdenes de taller.',                                    icon: Wrench,        group: 'service' },
  { title: 'Repuestos',      href: '/platform/parts',          color: 'stone',   description: 'Repuestos y órdenes de compra.',                                 icon: Boxes,         group: 'service' },

  // Administración
  { title: 'Personal',       href: '/platform/users',          color: 'purple',  description: 'Usuarios del equipo, roles y permisos.',                         icon: Users,         group: 'operations' },
  { title: 'Organización',   href: '/platform/organization',   color: 'slate',   description: 'Sucursales, accesos, roles y retención de datos.',              icon: Building2,     group: 'operations' },
  { title: 'Catálogo',       href: '/platform/catalog',        color: 'lime',    description: 'Marcas, modelos y reglas de asignación de consultas.',          icon: Tags,          group: 'operations' },
  { title: 'Reportes',       href: '/platform/reports',        color: 'violet',  description: 'Reportes guardados y auditoría.',                               icon: FileBarChart,  group: 'operations' },
  { title: 'Claves de API',  href: '/platform/api-keys',       color: 'zinc',    description: 'Claves de acceso para integraciones.',                          icon: KeyRound,      group: 'operations' },
]

export const HIDDEN_FOR_ELVIS = new Set([
  '/platform/delivery', '/platform/payments', '/platform/accounting',
  '/platform/service', '/platform/parts', '/platform/api-keys',
])

export const platformNavItems = allPlatformNavItems.filter((item) => !HIDDEN_FOR_ELVIS.has(item.href))

export const platformStandaloneItems = platformNavItems.filter((item) => item.group === 'standalone')

export const platformNavGroups: PlatformNavGroup[] = [
  { id: 'sales',      title: 'Ventas',         icon: Users,         items: platformNavItems.filter((i) => i.group === 'sales') },
  { id: 'finance',    title: 'Financiación',   icon: CreditCard,    items: platformNavItems.filter((i) => i.group === 'finance') },
  { id: 'operations', title: 'Administración', icon: ClipboardList, items: platformNavItems.filter((i) => i.group === 'operations') },
].filter((group) => group.items.length > 0)

export function getPlatformNavItemsWithBasePath(basePath: string) {
  return platformNavItems.map((item) => ({
    ...item,
    href: `${basePath}${item.href}`,
  }))
}

export function getIconForNavItem(title: string): LucideIcon {
  if (title === 'Onboarding') {
    return Sparkles
  }

  const item = platformNavItems.find((navItem) => navItem.title === title)
  return item?.icon || Package
}
