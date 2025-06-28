import type {
	QueryBaseConfig,
	QueryConfig,
	QueryExecution,
	QueryState,
	Subscriber
} from './types'

import { QueryType, Status } from './types'

export class Query<T, C = unknown, M = unknown, E = Error> {
	private data: T | null = null
	private error: E | null = null
	private status: Status = Status.IDLE
	private isFetched = false
	private lastSuccessTime = 0

	private subscribers = new Set<Subscriber<T>>()
	private currentExecution: QueryExecution<T> | null = null
	private executionCounter = 0
	private refreshTimer: NodeJS.Timeout | null = null
	private lastConfig: QueryBaseConfig<T, C, M> | null = null
	private lastContext: C | null = null

	constructor(private config: QueryConfig<any, C, M>) {}

	// --- Refresh Logic ---

	private setupRefresh(config: QueryBaseConfig<T, C, M>) {
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

	// --- State Logic ---

	private notify() {
		this.subscribers.forEach(cb => cb(this.state))
	}

	private isExecutionActive(id: number) {
		return this.currentExecution?.id === id
	}

	private updateState(id: number, updates: Partial<QueryState<T>>) {
		if (this.isExecutionActive(id)) {
			this.forceUpdateState(updates)
			return true
		}
		return false
	}

	private forceUpdateState(updates: Partial<QueryState<T>>) {
		let hasChanged = false

		if (updates.data !== undefined && updates.data !== this.data) {
			this.data = updates.data
			hasChanged = true
		}

		if (updates.error !== undefined && updates.error !== this.error) {
			this.error = updates.error as E
			hasChanged = true
		}

		if (updates.status !== undefined && updates.status !== this.status) {
			this.status = updates.status
			hasChanged = true
		}

		if (
			updates.isFetched !== undefined &&
			updates.isFetched !== this.isFetched
		) {
			this.isFetched = updates.isFetched
			hasChanged = true
		}

		if (hasChanged) this.notify()
	}

	// --- Staleness & Deduping ---

	private isStale(config: QueryBaseConfig<T, C, M>): boolean {
		if (this.config.type === QueryType.MUTATE) return true
		if (!this.isFetched || this.data === null) return true

		const options = { ...this.config.options, ...config.options }
		const staleTime = options.staleTime ?? 0

		if (staleTime === 0) return true
		if (staleTime === Infinity) return false

		return Date.now() >= this.lastSuccessTime + staleTime
	}

	private shouldFetch(config: QueryBaseConfig<T, C, M>): boolean {
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

	// --- Public API ---

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

	async query(config: QueryBaseConfig<T, C, M>): Promise<T> {
		this.lastConfig = config
		this.lastContext = config.context ?? null

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
			this.setupRefresh(config as QueryBaseConfig<T, C, M>)
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
		config: QueryBaseConfig<T, C, M>,
		id: number,
		internalSignal: AbortSignal
	): Promise<T> {
		const signal = config.signal ?? internalSignal

		for (const plugin of this.config.plugins) {
			if (plugin.onBeforeQuery) {
				config = await plugin.onBeforeQuery(config)
			}
		}

		try {
			const data = await config.queryFn({
				signal,
				context: (config.context ?? this.lastContext)!,
				meta: config.meta ?? (undefined as M)
			})

			const isUpdated = this.updateState(id, {
				data,
				error: null,
				status: Status.SUCCESS,
				isFetched: true
			})

			if (this.isExecutionActive(id)) {
				this.lastSuccessTime = Date.now()
			}

			if (isUpdated && config?.hooks?.onSuccess) {
				config.hooks.onSuccess(this.state)
			}

			for (const plugin of this.config.plugins) {
				plugin.onSuccess?.(data, config)
			}

			return data
		} catch (error) {
			if (signal.aborted) throw new Error('Query aborted')

			for (const plugin of this.config.plugins) {
				plugin.onError?.(error, config)
			}

			const normalized =
				error instanceof Error ? error : new Error(String(error))

			const isUpdated = this.updateState(id, {
				error: normalized as E,
				status: Status.ERROR,
				isFetched: true
			})

			if (isUpdated && config?.hooks?.onError) {
				config.hooks.onError(this.state)
			}

			throw normalized
		} finally {
			if (config?.hooks?.onFinish) {
				config?.hooks?.onFinish(this.state)
			}
			if (this.currentExecution?.id === id) {
				this.currentExecution = null
			}

			for (const plugin of this.config.plugins) {
				plugin.onFinish?.(this.state)
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
		if (!this.lastConfig) throw new Error('No previous config to refetch with')

		const originalTime = this.lastSuccessTime
		this.lastSuccessTime = 0

		try {
			return await this.query(this.lastConfig)
		} catch (error) {
			this.lastSuccessTime = originalTime
			throw error
		}
	}

	// --- Getters ---

	get lastFetchTime() {
		return this.currentExecution?.timestamp ?? this.lastSuccessTime
	}

	get cacheTTL() {
		return this.config.options?.cacheTTL ?? 0
	}

	get staleTime() {
		return this.config.options?.staleTime ?? 0
	}

	get subscribersCount() {
		return this.subscribers.size
	}
}
