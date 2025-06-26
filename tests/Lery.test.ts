import { beforeEach, describe, expect, it } from 'bun:test'
import { Lery } from '../src/Lery'
import { Status, type QueryState } from '../src/types'

describe('Lery class', () => {
	let lery: Lery<any>

	beforeEach(() => {
		lery = new Lery()
	})

	const wait = () => Promise.resolve().then(() => Promise.resolve())

	it('1. emits initial state on subscribe', () => {
		const states: QueryState[] = []
		lery.subscribe('key1', state => states.push(state))

		expect(states).toHaveLength(1)
		expect(states[0]).toMatchObject({
			status: Status.IDLE,
			isIdle: true,
			isLoading: false,
			isFetching: false,
			isSuccess: false,
			isError: false,
			data: null,
			error: null,
		})
	})

	it('2. handles successful fetch', async () => {
		const states: QueryState[] = []
		lery.subscribe('key2', s => states.push(s))
		lery.fetch('key2', () => Promise.resolve('data123'))

		expect(states[1].status).toBe(Status.LOADING)
		await wait()

		const final = states[2]
		expect(final.status).toBe(Status.SUCCESS)
		expect(final.data).toBe('data123')
		expect(final.error).toBeNull()
		expect(final.isFetched).toBe(true)
	})

	it('3. handles fetch error', async () => {
		const states: QueryState[] = []
		const errorObj = new Error('fail')
		lery.subscribe('key3', s => states.push(s))
		lery.fetch('key3', () => Promise.reject(errorObj))

		expect(states[1].status).toBe(Status.LOADING)
		await wait()

		const final = states[2]
		expect(final.status).toBe(Status.ERROR)
		expect(final.error).toBe(errorObj)
		expect(final.data).toBeNull()
		expect(final.isFetched).toBe(true)
	})

	it('4. uses REFETCHING after first fetch', async () => {
		const states: QueryState[] = []
		lery.subscribe('key4', s => states.push(s))
		lery.fetch('key4', () => Promise.resolve(1))
		await wait()

		lery.fetch('key4', () => Promise.resolve(2))

		expect(states[3].status).toBe(Status.REFETCHING)
		await wait()

		expect(states[4]).toMatchObject({
			status: Status.SUCCESS,
			data: 2,
		})
	})

	it('5. unsubscribe removes subscriber and clears cache', () => {
		const callback = () => {}
		const unsubscribe = lery.subscribe('key5', callback)
		unsubscribe()

		const state = lery.getState('key5')
		expect(state.status).toBe(Status.IDLE)
		expect(state.data).toBeNull()
	})

	it('6. late subscription after fetch emits latest state', async () => {
		lery.fetch('key6', () => Promise.resolve('done'))
		await wait()

		const states: QueryState[] = []
		lery.subscribe('key6', s => states.push(s))

		expect(states[0].status).toBe(Status.SUCCESS)
		expect(states[0].data).toBe('done')
	})

	it('7. fetch without subscribers still stores state', async () => {
		lery.fetch('key7', () => Promise.resolve('cached'))
		await wait()

		const state = lery.getState('key7')
		expect(state.status).toBe(Status.SUCCESS)
		expect(state.data).toBe('cached')
	})

	it('8. no notification after unsubscribe', async () => {
		const states: QueryState[] = []
		const unsub = lery.subscribe('key8', s => states.push(s))
		unsub()

		lery.fetch('key8', () => Promise.resolve('will-not-reach'))
		await wait()

		expect(states).toHaveLength(1)
		expect(states[0].status).toBe(Status.IDLE)
	})

	it('9. notifies multiple subscribers', async () => {
		const s1: QueryState[] = []
		const s2: QueryState[] = []

		lery.subscribe('key9', s => s1.push(s))
		lery.subscribe('key9', s => s2.push(s))

		lery.fetch('key9', () => Promise.resolve(9))
		await wait()

		expect(s1[s1.length - 1].data).toBe(9)
		expect(s2[s2.length - 1].data).toBe(9)
	})

	it('10. refetch overrides previous data', async () => {
		const states: QueryState[] = []
		lery.subscribe('key10', s => states.push(s))

		lery.fetch('key10', () => Promise.resolve('first'))
		await wait()
		lery.fetch('key10', () => Promise.resolve('second'))
		await wait()

		expect(states[states.length - 1].data).toBe('second')
	})
})
