export const Status = {
	IDLE: 'IDLE',
	LOADING: 'LOADING',
	REFETCHING: 'REFETCHING',
	SUCCESS: 'SUCCESS',
	ERROR: 'ERROR'
} as const
export type Status = (typeof Status)[keyof typeof Status]

export type PrimitiveKey = string | number | boolean | symbol
export type KeyOf<T> = keyof T
export type QueryKey<TDataMap extends DataMap> = [
	KeyOf<TDataMap>,
	...PrimitiveKey[]
]

export interface QueryExecution<T> {
	id: number
	promise: Promise<T>
	controller: AbortController
	timestamp: number
}

export type DataMap = Record<string, unknown>

export type QueryState<T = unknown> = Readonly<{
	data: T | null
	error: unknown | null
	status: Status
	isIdle: boolean
	isLoading: boolean
	isFetching: boolean
	isSuccess: boolean
	isError: boolean
	isFetched: boolean
	isStale: boolean
	lastSuccessTime: number
}>

export type Subscriber<T = unknown> = (state: QueryState<T>) => void

export const QueryType = {
	MUTATE: 'MUTATE',
	FETCH: 'FETCH'
} as const
export type QueryType = (typeof QueryType)[keyof typeof QueryType]

export interface QueryOptions {
	dedupingTime?: number
	cacheTTL?: number
	staleTime?: number
	refreshInterval?: number
}

export interface LeryOptions extends QueryOptions {
	maxCacheSize?: number
}

export interface LeryConfig {
	options?: LeryOptions
}

export interface QueryConfig {
	type: QueryType
	options?: QueryOptions
}

export interface QueryContext<C = unknown> {
	signal?: AbortSignal
	context?: C
}

export type QueryFn<T, C = unknown> = (ctx: QueryContext<C>) => Promise<T>

export interface QueryBaseConfig<T, C = unknown> extends QueryContext<C> {
	queryFn: QueryFn<T, C>
	options?: QueryOptions
}

export type QueryFetchConfig<T, C = unknown> = QueryBaseConfig<T, C>
export type QueryMutateConfig<T, C = unknown> = QueryBaseConfig<T, C>

export interface QueryActionConfig<
	TDataMap extends DataMap,
	TKey extends keyof TDataMap,
	C = unknown
> extends QueryContext<C> {
	queryKey: QueryKey<TDataMap>
	queryFn: QueryFn<TDataMap[TKey], C>
	options?: QueryOptions
}

export type FetchConfig<
	TDataMap extends DataMap,
	TKey extends keyof TDataMap,
	C = unknown
> = QueryActionConfig<TDataMap, TKey, C>
export type MutateConfig<
	TDataMap extends DataMap,
	TKey extends keyof TDataMap,
	C = unknown
> = QueryActionConfig<TDataMap, TKey, C>

export interface SubscribeConfig<
	TDataMap extends DataMap,
	TKey extends keyof TDataMap
> {
	queryKey: QueryKey<TDataMap>
	callback: Subscriber<TDataMap[TKey]>
}
