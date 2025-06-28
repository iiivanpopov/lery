import type {
	QueryConfig,
	QueryExecution,
	QueryFetchConfig,
	QueryMutateConfig,
	QueryState,
	Subscriber
} from './types'
import { QueryType, Status } from './types'

export class Query<T, E = Error> {
	private data: T | null = null
	private error: E | null = null
	private status: Status = Status.IDLE
	private isFetched: boolean = false
	private lastSuccessTime: number = 0
	public readonly subscribers: Set<Subscriber<T>> = new Set()
	private currentExecution: QueryExecution<T> | null = null
	private executionCounter: number = 0
	private refreshTimer: NodeJS.Timeout | null = null
	private lastConfig: QueryFetchConfig<T> | QueryMutateConfig<T> | null = null

	constructor(private config: QueryConfig) {}

	private setupRefresh(config: QueryFetchConfig<T>) {
		this.clearRefreshTimer()

		const interval = this.config.options?.refreshInterval
		if (!interval) return

		this.refreshTimer = setInterval(() => {
			if (this.subscribers.size > 0) {
				this.query(config)
			} else {
				this.clearRefreshTimer()
			}
		}, interval)
	}

	private clearRefreshTimer() {
		if (this.refreshTimer) {
			clearInterval(this.refreshTimer)
			this.refreshTimer = null
		}
	}

	private notify() {
		this.subscribers.forEach(cb => cb(this.state))
	}

	private isExecutionActive = (id: number) => this.currentExecution?.id === id

	private updateState(id: number, updates: Partial<QueryState<T>>) {
		if (!this.isExecutionActive(id)) return
		this.forceUpdateState(updates)
	}

	private forceUpdateState(updates: Partial<QueryState<T>>) {
		if (updates.data !== undefined) this.data = updates.data
		if (updates.error !== undefined) this.error = updates.error as E
		if (updates.status !== undefined) this.status = updates.status
		if (updates.isFetched !== undefined) this.isFetched = updates.isFetched

		this.notify()
	}

	private isStale(config: QueryFetchConfig<T> | QueryMutateConfig<T>): boolean {
		if (this.config.type === QueryType.MUTATE) {
			return true
		}

		if (!this.isFetched || this.data === null) {
			return true
		}

		const options = { ...this.config.options, ...config.options }
		const staleTime = options.staleTime ?? 0

		if (staleTime === 0) return true
		if (staleTime === Infinity) return false

		const now = Date.now()
		return now >= this.lastSuccessTime + staleTime
	}

	private shouldFetch(
		config: QueryFetchConfig<T> | QueryMutateConfig<T>
	): boolean {
		if (this.currentExecution) {
			const now = Date.now()
			const options = { ...this.config.options, ...config.options }
			const dedupingTime = Math.max(
				options.dedupingTime ?? 0,
				options.refreshInterval ?? 0
			)

			if (this.currentExecution.timestamp + dedupingTime > now) return false
		}

		return this.isStale(config)
	}

	reset() {
		this.cancel()

		this.currentExecution = null
		this.executionCounter = 0

		this.data = null
		this.error = null
		this.status = Status.IDLE
		this.isFetched = false
		this.lastSuccessTime = 0

		this.notify()
	}

	get state(): QueryState<T> {
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
			isFetched: this.isFetched,
			isStale: this.isStale(this.lastConfig || ({} as any)),
			lastSuccessTime: this.lastSuccessTime
		}
	}

	async query(config: QueryFetchConfig<T> | QueryMutateConfig<T>): Promise<T> {
		this.lastConfig = config

		if (!this.shouldFetch(config)) {
			if (this.currentExecution) return this.currentExecution.promise

			if (this.data !== null && this.status === Status.SUCCESS) {
				return Promise.resolve(this.data)
			}
		}

		const now = Date.now()

		this.currentExecution?.controller.abort()

		const id = ++this.executionCounter
		const controller = new AbortController()

		if (
			!this.refreshTimer &&
			this.config.type === QueryType.FETCH &&
			this.subscribers.size > 0
		) {
			this.setupRefresh(config)
		}

		this.forceUpdateState({
			status:
				this.isFetched && this.config.type === QueryType.FETCH
					? Status.REFETCHING
					: Status.LOADING
		})

		const promise = this.executeQuery(config, id, controller.signal)
		this.currentExecution = { id, promise, controller, timestamp: now }

		return promise
	}

	private async executeQuery(
		config: QueryFetchConfig<T> | QueryMutateConfig<T>,
		id: number,
		signal: AbortSignal
	): Promise<T> {
		try {
			const data = await config.queryFn()

			const successTime = Date.now()

			this.updateState(id, {
				data,
				error: null,
				status: Status.SUCCESS,
				isFetched: true
			})

			if (this.isExecutionActive(id)) {
				this.lastSuccessTime = successTime
			}

			return data
		} catch (error) {
			if (signal.aborted) {
				throw new Error('Query aborted')
			}

			const normalized =
				error instanceof Error ? error : new Error(String(error))

			this.updateState(id, {
				error: normalized as E,
				status: Status.ERROR,
				isFetched: true
			})

			throw normalized
		} finally {
			if (this.currentExecution?.id === id) {
				this.currentExecution = null
			}
		}
	}

	cancel() {
		this.currentExecution?.controller.abort()
		this.clearRefreshTimer()
		this.currentExecution = null
	}

	subscribe(cb: Subscriber<T>) {
		this.subscribers.add(cb)

		return () => {
			this.subscribers.delete(cb)

			if (this.subscribers.size === 0) {
				this.clearRefreshTimer()
			}
		}
	}

	invalidate() {
		this.lastSuccessTime = 0
		this.notify()
	}

	async refetch(): Promise<T> {
		if (!this.lastConfig) {
			throw new Error('No previous config to refetch with')
		}

		const originalTime = this.lastSuccessTime
		this.lastSuccessTime = 0

		try {
			return await this.query(this.lastConfig)
		} catch (error) {
			this.lastSuccessTime = originalTime
			throw error
		}
	}

	get lastFetchTime() {
		return this.currentExecution?.timestamp ?? this.lastSuccessTime
	}

	get cacheTTL() {
		return this.config.options?.cacheTTL ?? 0
	}

	get staleTime() {
		return this.config.options?.staleTime ?? 0
	}
}
