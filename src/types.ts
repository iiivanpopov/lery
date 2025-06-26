/** Request state */
export type QueryState<T> = {
	data: T | null
	error: unknown | null
	isLoading: boolean
}

/** Subscriber to changes */
export type Subscriber<T> = (state: QueryState<T>) => void

/** Cached entry */
export type CacheEntry<T> = QueryState<T> & {
	subscribers: Set<Subscriber<T>>
}
