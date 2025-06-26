import { Status, type QueryState, type Subscriber } from './types'

export class QueryEntry<T> {
	private data: T | null = null
	private error: unknown | null = null
	private status: Status = Status.IDLE
	public isFetched = false
	public subscribers = new Set<Subscriber<T>>()

	begin() {
		this.status = this.isFetched ? Status.REFETCHING : Status.LOADING
		this.notify()
	}

	succeed(result: T) {
		this.data = result
		this.error = null
		this.status = Status.SUCCESS
		this.isFetched = true
		this.notify()
	}

	fail(err: unknown) {
		this.data = null
		this.error = err instanceof Error ? err : new Error(String(err))
		this.status = Status.ERROR
		this.isFetched = true
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
			isFetched: this.isFetched,
		}
	}

	private notify() {
		const state = this.getState()
		for (const cb of this.subscribers) {
			cb(state)
		}
	}
}
