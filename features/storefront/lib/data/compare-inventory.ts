export function partitionSavedVehicleResults<T extends { id: string }>(ids: readonly string[], results: readonly unknown[]) {
  if (ids.length !== results.length) throw new Error('Respuesta incompleta del inventario.')

  const vehicles: T[] = []
  const unavailableIds: string[] = []

  ids.forEach((id, index) => {
    const result = results[index]
    if (!result || typeof result !== 'object' || !Object.prototype.hasOwnProperty.call(result, 'publicInventoryVehicle')) {
      throw new Error('Respuesta inválida del inventario.')
    }

    const vehicle = (result as { publicInventoryVehicle?: T | null }).publicInventoryVehicle
    if (vehicle === null) {
      unavailableIds.push(id)
    } else if (!vehicle || typeof vehicle !== 'object' || typeof vehicle.id !== 'string') {
      throw new Error('Respuesta inválida del vehículo.')
    } else {
      vehicles.push(vehicle)
    }
  })

  return { vehicles, unavailableIds }
}
