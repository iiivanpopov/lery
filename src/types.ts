export const Status = {
	IDLE: 'IDLE',
	LOADING: 'LOADING',
	ERROR: 'ERROR',
	REFETCHING: 'REFETCHING',
	SUCCESS: 'SUCCESS',
} as const
export type Status = (typeof Status)[keyof typeof Status]

export type QueryState<T = unknown> = {
	data: T | null
	error: unknown | null
	status: Status
	isIdle: boolean
	isLoading: boolean
	isFetching: boolean
	isSuccess: boolean
	isError: boolean
	isFetched: boolean
}

export type Subscriber<T> = (state: QueryState<T>) => void
