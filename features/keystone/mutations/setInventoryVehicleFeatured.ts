import { permissions } from '../access'
import { assertSessionRooftopPermission } from '../tenantRecords'

/**
 * Marca o desmarca un vehículo como destacado en la página principal.
 * No altera el contenido aprobado de la publicación, por lo que no reabre la revisión.
 */
export async function setInventoryVehicleFeatured(_root: unknown, { vehicleId, featured }: { vehicleId: string; featured: boolean }, context: any) {
  if (!context.session?.itemId || !permissions.canManageInventory({ session: context.session })) {
    throw new Error('Se requiere permiso de gestión de inventario')
  }
  const vehicle = await context.query.Vehicle.findOne({ where: { id: String(vehicleId || '') }, query: 'id rooftop { id }' })
  if (!vehicle?.rooftop?.id) throw new Error('Vehículo no encontrado o sin acceso')
  await assertSessionRooftopPermission(context, vehicle.rooftop.id, 'canManageInventory')
  await context.sudo().prisma.vehicle.update({ where: { id: vehicle.id }, data: { isFeatured: Boolean(featured) } })
  return true
}
