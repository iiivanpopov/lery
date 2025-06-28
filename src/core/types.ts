import type { Lery } from './Lery'

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

export interface QueryConfig<
	T extends DataMap = any,
	C = unknown,
	M = unknown
> {
	type: QueryType
	options?: QueryOptions
	plugins: Plugin<T, C, M>[]
}

export interface Plugin<TDataMap extends DataMap, C = unknown, M = unknown> {
	onInit?: (lery: Lery<TDataMap>) => void
	onBeforeQuery?: <T>(
		config: QueryBaseConfig<T, C, M>
	) => QueryBaseConfig<T, C, M> | Promise<QueryBaseConfig<T, C, M>>
	onAfterQuery?: <T>(
		result: T,
		config: QueryBaseConfig<T, C, M>
	) => T | Promise<T>
	onSuccess?: <T>(result: T, config: QueryBaseConfig<T, C, M>) => void
	onError?: <T>(error: unknown, config: QueryBaseConfig<T, C, M>) => void
	onFinish?: <T>(result: T | unknown) => void
}

export interface QueryContext<C> {
	signal?: AbortSignal
	context?: C
}

export interface QueryMeta<M> {
	meta?: M
}

export type QueryFn<TData, C, M> = (args: {
	signal: AbortSignal
	context: C
	meta: M
}) => Promise<TData>

export interface Hooks<T> {
	onSuccess?: (state: QueryState<T>) => void
	onError?: (state: QueryState<T>) => void
	onFinish?: (state: QueryState<T>) => void
}

export interface QueryBaseConfig<T, C = unknown, M = unknown>
	extends QueryContext<C>,
		QueryMeta<M> {
	queryFn: QueryFn<T, C, M>
	options?: QueryOptions
	hooks?: Hooks<T>
}

export interface QueryActionConfig<
	TDataMap extends DataMap,
	TKey extends keyof TDataMap,
	C,
	M
> extends QueryBaseConfig<TDataMap[TKey], C, M> {
	queryKey: QueryKeyFor<TDataMap, TKey>
}

export type FetchConfig<
	TDataMap extends DataMap,
	TKey extends keyof TDataMap,
	C,
	M
> = QueryActionConfig<TDataMap, TKey, C, M>
export type MutateConfig<
	TDataMap extends DataMap,
	TKey extends keyof TDataMap,
	C,
	M
> = QueryActionConfig<TDataMap, TKey, C, M>

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
