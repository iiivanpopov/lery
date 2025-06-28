export const Status = {
	IDLE: 'IDLE',
	LOADING: 'LOADING',
	REFETCHING: 'REFETCHING',
	SUCCESS: 'SUCCESS',
	ERROR: 'ERROR'
} as const
export type Status = (typeof Status)[keyof typeof Status]

export type PrimitiveKey = string | number | boolean | symbol

export type DataMap = Record<string, unknown>

export type QueryKeyFor<
	TDataMap extends DataMap,
	TKey extends keyof TDataMap
> = [TKey, ...PrimitiveKey[]]

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

export interface Hooks<T> {
	onSuccess?: (state: QueryState<T>) => void
	onError?: (state: QueryState<T>) => void
	onFinish?: (state: QueryState<T>) => void
}

export interface QueryBaseConfig<T, C = unknown> extends QueryContext<C> {
	queryFn: QueryFn<T, C>
	options?: QueryOptions
	hooks?: Hooks<T>
}

export interface QueryActionConfig<
	TDataMap extends DataMap,
	TKey extends keyof TDataMap,
	C = unknown
> extends QueryContext<C> {
	queryKey: QueryKeyFor<TDataMap, TKey>
	queryFn: QueryFn<TDataMap[TKey], C>
	options?: QueryOptions
	hooks?: Hooks<TDataMap[TKey]>
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
	queryKey: QueryKeyFor<TDataMap, TKey>
	callback: Subscriber<TDataMap[TKey]>
}

export interface QueryExecution<T> {
	id: number
	promise: Promise<T>
	controller: AbortController
	timestamp: number
}
