'use server'

import { apiClient } from '../config'

// Public storefront reads, run on the server so client screens never build their own endpoint.
export async function fetchGraphQL<T>(query: string, variables?: Record<string, any>): Promise<T> {
  return apiClient.request<T>(query, variables)
}
