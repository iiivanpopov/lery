import type { Query } from './Query.ts'

// ==============================
// Constants
// ==============================

export const Status = {
	IDLE: 'IDLE',
	LOADING: 'LOADING',
	ERROR: 'ERROR',
	REFETCHING: 'REFETCHING',
	SUCCESS: 'SUCCESS'
} as const

export type Status = (typeof Status)[keyof typeof Status]

// ==============================
// Utility Types
// ==============================

type PrimitiveKey = string | number

export type KeyOf<T> = Extract<keyof T, PrimitiveKey>

// ==============================
// Data & Cache
// ==============================

export type DataMap = Record<string, unknown>

export type CacheValue<
	TDataMap extends DataMap,
	TKey extends KeyOf<TDataMap>
> = TDataMap[TKey]

export type QueryKey<TDataMap extends DataMap> = [
	KeyOf<TDataMap>,
	...PrimitiveKey[]
]

export type CacheKey<TDataMap extends DataMap> = QueryKey<TDataMap>

export type CacheMap<
	TDataMap extends DataMap,
	TKey extends KeyOf<TDataMap>
> = Map<string, Query<CacheValue<TDataMap, TKey>>>

// ==============================
// Query State & Subscription
// ==============================

export type QueryState<T = unknown> = {
	readonly data: T | null
	readonly error: unknown | null
	readonly status: Status
	readonly isIdle: boolean
	readonly isLoading: boolean
	readonly isFetching: boolean
	readonly isSuccess: boolean
	readonly isError: boolean
	readonly isFetched: boolean
}

export type Subscriber<T> = (state: QueryState<T>) => void
export type Unsubscribe = () => void

export type SubscribeConfig<
	TDataMap extends DataMap,
	TKey extends KeyOf<TDataMap>
> = {
	queryKey: QueryKey<TDataMap>
	callback: Subscriber<TDataMap[TKey]>
}

// ==============================
// Options
// ==============================

// Lery
export interface LeryOptions {
	dedupingTime?: number
}

export interface LeryConfig {
	options?: LeryOptions
}

// Lery.Fetch
export interface FetchOptions {
	dedupingTime?: number
}

export type FetchConfig<
	TDataMap extends DataMap,
	TKey extends KeyOf<TDataMap>
> = {
	queryKey: QueryKey<TDataMap>
	queryFn: () => Promise<TDataMap[TKey]>
	options?: FetchOptions
}

// Lery.Mutate
export interface MutateOptions {
	dedupingTime?: number
}

export type MutateConfig<
	TDataMap extends DataMap,
	TKey extends KeyOf<TDataMap>
> = {
	queryKey: QueryKey<TDataMap>
	queryFn: () => Promise<TDataMap[TKey]>
	options?: MutateOptions
}

// Query
export interface QueryOptions {
	dedupingTime?: number
}

export interface QueryConfig {
	options?: QueryOptions
}

// Query.Fetch
export type QueryFetchConfig<T> = {
	queryFn: () => Promise<T>
	options?: FetchOptions
}

// Query.Mutate
export type QueryMutateConfig<T> = {
	queryFn: () => Promise<T>
	options?: MutateOptions
}
