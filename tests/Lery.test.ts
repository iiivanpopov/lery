import { beforeEach, describe, expect, it } from 'bun:test'
import { Lery, type QueryState, Status } from '../src'

describe('Lery class', () => {
	let lery: Lery<{
		[key: string]: any
	}>

	beforeEach(() => {
		lery = new Lery()
	})

	const wait = () => Promise.resolve().then(() => Promise.resolve())

	it('1. emits initial state on subscribe', () => {
		const states: QueryState[] = []
		lery.subscribe({
			queryKey: ['key1'],
			callback: state => states.push(state)
		})

		expect(states).toHaveLength(1)
		expect(states[0]).toMatchObject({
			status: Status.IDLE,
			isIdle: true,
			isLoading: false,
			isFetching: false,
			isSuccess: false,
			isError: false,
			data: null,
			error: null
		})
	})

	it('2. handles successful fetch', async () => {
		const states: QueryState[] = []
		lery.subscribe({ queryKey: ['key2'], callback: s => states.push(s) })
		lery.fetch({
			queryKey: ['key2'],
			queryFn: () => Promise.resolve('data123')
		})

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
		lery.subscribe({ queryKey: ['key3'], callback: s => states.push(s) })
		lery.fetch({ queryKey: ['key3'], queryFn: () => Promise.reject(errorObj) })

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
		lery.subscribe({ queryKey: ['key4'], callback: s => states.push(s) })
		lery.fetch({ queryKey: ['key4'], queryFn: () => Promise.resolve(1) })
		await wait()

		lery.fetch({ queryKey: ['key4'], queryFn: () => Promise.resolve(2) })

		expect(states[3].status).toBe(Status.REFETCHING)
		await wait()

		expect(states[4]).toMatchObject({
			status: Status.SUCCESS,
			data: 2
		})
	})

	it('5. unsubscribe removes subscriber and clears cache', () => {
		const callback = () => {}
		const unsubscribe = lery.subscribe({ queryKey: ['key5'], callback })
		unsubscribe()

		const state = lery.getState(['key5'])
		expect(state.status).toBe(Status.IDLE)
		expect(state.data).toBeNull()
	})

	it('6. late subscription after fetch emits latest state', async () => {
		lery.fetch({ queryKey: ['key6'], queryFn: () => Promise.resolve('done') })
		await wait()

		const states: QueryState[] = []
		lery.subscribe({ queryKey: ['key6'], callback: s => states.push(s) })

		expect(states[0].status).toBe(Status.SUCCESS)
		expect(states[0].data).toBe('done')
	})

	it('7. fetch without subscribers still stores state', async () => {
		lery.fetch({ queryKey: ['key7'], queryFn: () => Promise.resolve('cached') })
		await wait()

		const state = lery.getState(['key7'])
		expect(state.status).toBe(Status.SUCCESS)
		expect(state.data).toBe('cached')
	})

	it('8. no notification after unsubscribe', async () => {
		const states: QueryState[] = []
		const unsub = lery.subscribe({
			queryKey: ['key8'],
			callback: s => states.push(s)
		})
		unsub()

		lery.fetch({
			queryKey: ['key8'],
			queryFn: () => Promise.resolve('will-not-reach')
		})
		await wait()

		expect(states).toHaveLength(1)
		expect(states[0].status).toBe(Status.IDLE)
	})

	it('9. notifies multiple subscribers', async () => {
		const s1: QueryState[] = []
		const s2: QueryState[] = []

		lery.subscribe({ queryKey: ['key9'], callback: s => s1.push(s) })
		lery.subscribe({ queryKey: ['key9'], callback: s => s2.push(s) })

		lery.fetch({ queryKey: ['key9'], queryFn: () => Promise.resolve(9) })
		await wait()

		expect(s1[s1.length - 1].data).toBe(9)
		expect(s2[s2.length - 1].data).toBe(9)
	})

	it('10. refetch overrides previous data', async () => {
		const states: QueryState[] = []
		lery.subscribe({ queryKey: ['key10'], callback: s => states.push(s) })

		lery.fetch({ queryKey: ['key10'], queryFn: () => Promise.resolve('first') })
		await wait()
		lery.fetch({
			queryKey: ['key10'],
			queryFn: () => Promise.resolve('second')
		})
		await wait()

		expect(states[states.length - 1].data).toBe('second')
	})

	it('11. fetch deduplicates requests within dedupingTime', async () => {
		let callCount = 0
		const fetcher = () => {
			callCount++
			return Promise.resolve('deduped')
		}
		const p1 = lery.fetch({ queryKey: ['key11'], queryFn: fetcher })
		const p2 = lery.fetch({ queryKey: ['key11'], queryFn: fetcher })
		expect(p1).toBe(p2)
		await p1
		expect(callCount).toBe(1)
	})

	it('12. fetch allows new request after dedupingTime', async () => {
		let callCount = 0
		const fetcher = () => {
			callCount++
			return Promise.resolve('after-dedup')
		}
		await lery.fetch({ queryKey: ['key12'], queryFn: fetcher })
		const entry = (lery as any).cache.get('key12')
		entry.lastFetchTime -= 6000
		await lery.fetch({ queryKey: ['key12'], queryFn: fetcher })
		expect(callCount).toBe(2)
	})
})
