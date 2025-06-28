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
	private isFetched = false
	public readonly subscribers = new Set<Subscriber<T>>()
	private currentExecution: QueryExecution<T> | null = null
	private executionCounter = 0

	constructor(private config: QueryConfig) {}

	private notify() {
		this.subscribers.forEach(cb => cb(this.state))
	}

	private isExecutionActive = (id: number) => this.currentExecution?.id === id

	private updateState(id: number, updates: Partial<QueryState<T>>) {
		if (!this.isExecutionActive(id)) return

		this.forceUpdateState(updates)
		this.notify()
	}

	private forceUpdateState(updates: Partial<QueryState<T>>) {
		if (updates.data !== undefined) this.data = updates.data
		if (updates.error !== undefined) this.error = updates.error as E
		if (updates.status !== undefined) this.status = updates.status
		if (updates.isFetched !== undefined) this.isFetched = updates.isFetched

		this.notify()
	}

	reset() {
		this.cancel()
		this.data = null
		this.error = null
		this.status = Status.IDLE
		this.isFetched = false
		this.currentExecution = null
		this.executionCounter = 0
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
			isFetched: this.isFetched
		}
	}

	query(config: QueryFetchConfig<T> | QueryMutateConfig<T>): Promise<T> {
		const now = Date.now()
		const options = { ...this.config?.options, ...config.options }
		const dedupingTime = options.dedupingTime ?? 5000

		if (
			this.currentExecution &&
			this.currentExecution.timestamp + dedupingTime > now
		) {
			return this.currentExecution.promise
		}

		this.currentExecution?.controller.abort()

		const id = ++this.executionCounter
		const controller = new AbortController()

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

			this.updateState(id, {
				data,
				error: null,
				status: Status.SUCCESS,
				isFetched: true
			})

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
		this.currentExecution = null
	}

	subscribe(cb: Subscriber<T>) {
		this.subscribers.add(cb)
		return () => this.subscribers.delete(cb)
	}

	get lastFetchTime() {
		return this.currentExecution?.timestamp ?? 0
	}

	get cacheTTL() {
		return this.config.options?.cacheTTL ?? 0
	}
}
