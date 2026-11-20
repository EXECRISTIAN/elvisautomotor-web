'use client'

import { useEffect, useState } from 'react'
import { fetchGraphQL } from '../lib/data/public-read'
import { GET_VEHICLES } from '../lib/data/queries'
import { isLocalDemo } from '../lib/localStore'
import type { Vehicle } from '../lib/types'

type Where = Record<string, unknown>

/**
 * Lista de autos que llega armada desde el servidor y, en la muestra local, se vuelve a leer al abrir
 * la página (así aparecen los autos agregados o cambiados desde el panel).
 */
export function useLiveVehicles(initial: Vehicle[], where: Where, take: number, orderBy: Where[] = [{ year: 'desc' }]) {
  const [state, setState] = useState({ items: initial, total: initial.length })
  const key = JSON.stringify([where, take, orderBy])
  useEffect(() => {
    if (!isLocalDemo()) return
    let active = true
    void fetchGraphQL<{ publicInventoryVehicles: { items: Vehicle[]; totalCount: number } }>(GET_VEHICLES, { where, orderBy, take })
      .then((data) => { if (active) setState({ items: data.publicInventoryVehicles?.items ?? [], total: data.publicInventoryVehicles?.totalCount ?? 0 }) })
      .catch(() => {})
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state
}
