import {
	type QueryConfig,
	type QueryFetchConfig,
	type QueryMutateConfig,
	type QueryState,
	QueryType,
	Status,
	type Subscriber
} from './types'

const DEFAULT_DEDUPING_TIME = 5000 // ms

export class Query<T> {
	private data: T | null = null
	private error: unknown | null = null
	private status: Status = Status.IDLE
	public isFetched = false

	public subscribers: Set<Subscriber<T>> = new Set()

	private lastFetchTime = 0
	private currentPromise: Promise<T> | null = null

	private fetchId = 0

	constructor(private config: QueryConfig) {}

	private notify() {
		const state = this.getState()
		for (const cb of this.subscribers) cb(state)
	}

	private mergeOptions(config: QueryMutateConfig<T> | QueryFetchConfig<T>) {
		return { ...this.config?.options, ...config.options }
	}

	private setState({
		data,
		error,
		status,
		isFetched
	}: {
		data?: T | null
		error?: unknown | null
		status?: Status
		isFetched?: boolean
	}) {
		if (data !== undefined) this.data = data
		if (error !== undefined) this.error = error
		if (status !== undefined) this.status = status
		if (isFetched !== undefined) this.isFetched = isFetched
		this.notify()
	}

	begin() {
		const isRefetching = this.isFetched && this.config.type === QueryType.FETCH
		this.setState({
			status: isRefetching ? Status.REFETCHING : Status.LOADING
		})
	}

	succeed(result: T) {
		this.setState({
			data: result,
			error: null,
			status: Status.SUCCESS,
			isFetched: true
		})
	}

	fail(err: unknown) {
		this.setState({
			data: null,
			error: err instanceof Error ? err : new Error(String(err)),
			status: Status.ERROR,
			isFetched: true
		})
	}

	reset(config: Pick<QueryMutateConfig<T>, 'options'> & { type: QueryType }) {
		this.data = null
		this.error = null
		this.status = Status.IDLE
		this.isFetched = false
		this.currentPromise = null
		this.lastFetchTime = 0
		this.config = config
		this.notify()
	}

	getState(): QueryState<T> {
		return {
			data: this.data,
			error: this.error,
			status: this.status,
			isIdle: this.status === Status.IDLE,
			isLoading: this.status === Status.LOADING,
			isFetching:
				this.status === Status.LOADING || this.status === Status.REFETCHING,
			isSuccess: this.status === Status.SUCCESS,
			isError: this.status === Status.ERROR,
			isFetched: this.isFetched
		}
	}

	query(config: QueryFetchConfig<T> | QueryMutateConfig<T>): Promise<T> | null {
		const now = Date.now()

		const mergedOptions = this.mergeOptions(config)
		const dedupingTime = mergedOptions.dedupingTime ?? DEFAULT_DEDUPING_TIME

		const isFetchOngoing =
			this.currentPromise && this.lastFetchTime + dedupingTime > now
		if (isFetchOngoing) return this.currentPromise
		this.lastFetchTime = now

		this.begin()

		this.fetchId += 1
		const currentId = this.fetchId

		this.currentPromise = config
			.queryFn()
			.then(data => {
				if (this.fetchId === currentId) {
					this.succeed(data)
				}
				return data
			})
			.catch(err => {
				if (this.fetchId === currentId) {
					this.fail(err)
				}
				return err
			})
			.finally(() => {
				if (this.fetchId === currentId) {
					this.currentPromise = null
				}
			})

		return this.currentPromise
	}
}
