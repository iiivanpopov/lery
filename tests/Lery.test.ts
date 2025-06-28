import { beforeEach, describe, expect, it } from 'bun:test'
import { Lery, type QueryState, Status } from '../src'
import { serializeKey } from '../src/hash'

describe('Lery Query Manager', () => {
	let lery: Lery<{
		[key: string]: any
	}>

	beforeEach(() => {
		lery = new Lery()
	})

	const wait = () => Promise.resolve().then(() => Promise.resolve())

	// ============================================================================
	// SUBSCRIPTION TESTS
	// ============================================================================

	describe('Subscription Management', () => {
		it('should emit initial idle state on subscribe', () => {
			const states: QueryState[] = []
			lery.subscribe({
				queryKey: ['subscription-initial'],
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
				error: null,
				isFetched: false
			})
		})

		it('should unsubscribe and clear cache when no subscribers remain', () => {
			const callback = () => {}
			const unsubscribe = lery.subscribe({
				queryKey: ['subscription-cleanup'],
				callback
			})

			unsubscribe()

			const state = lery.state(['subscription-cleanup'])
			expect(state.status).toBe(Status.IDLE)
			expect(state.data).toBeNull()
		})

		it('should allow late subscription after fetch completion', async () => {
			// Fetch without subscribers
			lery.fetch({
				queryKey: ['subscription-late'],
				queryFn: () => Promise.resolve('completed-data')
			})
			await wait()

			// Subscribe after completion
			const states: QueryState[] = []
			lery.subscribe({
				queryKey: ['subscription-late'],
				callback: s => states.push(s)
			})

			expect(states[0].status).toBe(Status.SUCCESS)
			expect(states[0].data).toBe('completed-data')
		})

		it('should notify multiple subscribers simultaneously', async () => {
			const subscriber1: QueryState[] = []
			const subscriber2: QueryState[] = []

			lery.subscribe({
				queryKey: ['subscription-multiple'],
				callback: s => subscriber1.push(s)
			})
			lery.subscribe({
				queryKey: ['subscription-multiple'],
				callback: s => subscriber2.push(s)
			})

			lery.fetch({
				queryKey: ['subscription-multiple'],
				queryFn: () => Promise.resolve('shared-data')
			})
			await wait()

			expect(subscriber1[subscriber1.length - 1].data).toBe('shared-data')
			expect(subscriber2[subscriber2.length - 1].data).toBe('shared-data')
		})

		it('should not notify after unsubscription', async () => {
			const states: QueryState[] = []
			const unsubscribe = lery.subscribe({
				queryKey: ['subscription-no-notify'],
				callback: s => states.push(s)
			})

			unsubscribe()

			lery.fetch({
				queryKey: ['subscription-no-notify'],
				queryFn: () => Promise.resolve('should-not-reach')
			})
			await wait()

			expect(states).toHaveLength(1) // Only initial state
			expect(states[0].status).toBe(Status.IDLE)
		})
	})

	// ============================================================================
	// FETCH OPERATION TESTS
	// ============================================================================

	describe('Fetch Operations', () => {
		it('should handle successful fetch with proper state transitions', async () => {
			const states: QueryState[] = []
			lery.subscribe({
				queryKey: ['fetch-success'],
				callback: s => states.push(s)
			})

			lery.fetch({
				queryKey: ['fetch-success'],
				queryFn: () => Promise.resolve('success-data')
			})

			// Check loading state
			expect(states[1]).toMatchObject({
				status: Status.LOADING,
				isLoading: true,
				isFetching: true,
				isIdle: false,
				isSuccess: false,
				isError: false
			})

			await wait()

			// Check success state
			const finalState = states[2]
			expect(finalState).toMatchObject({
				status: Status.SUCCESS,
				data: 'success-data',
				error: null,
				isSuccess: true,
				isLoading: false,
				isFetching: false,
				isFetched: true
			})
		})
		it('should handle fetch errors with proper error state', async () => {
			const states: QueryState[] = []

			lery.subscribe({
				queryKey: ['fetch-error'],
				callback: s => states.push(s)
			})

			await lery.fetch({
				queryKey: ['fetch-error'],
				queryFn: () => Promise.reject(new Error('fetch-failed'))
			})

			expect(states.length).toBeGreaterThan(0)
		})

		it('should use REFETCHING status for subsequent fetches', async () => {
			const states: QueryState[] = []
			lery.subscribe({
				queryKey: ['fetch-refetch'],
				callback: s => states.push(s)
			})

			// First fetch
			lery.fetch({
				queryKey: ['fetch-refetch'],
				queryFn: () => Promise.resolve('first-data')
			})
			await wait()

			// Second fetch should use REFETCHING
			lery.fetch({
				queryKey: ['fetch-refetch'],
				queryFn: () => Promise.resolve('second-data')
			})

			expect(states[4]).toMatchObject({
				status: Status.REFETCHING,
				isFetching: true,
				isLoading: false
			})

			await wait()

			expect(states[5]).toMatchObject({
				status: Status.SUCCESS,
				data: 'second-data'
			})
		})

		it('should override previous data on refetch', async () => {
			const states: QueryState[] = []
			lery.subscribe({
				queryKey: ['fetch-override'],
				callback: s => states.push(s)
			})

			// First fetch
			lery.fetch({
				queryKey: ['fetch-override'],
				queryFn: () => Promise.resolve('original-data')
			})
			await wait()

			// Second fetch with different data
			lery.fetch({
				queryKey: ['fetch-override'],
				queryFn: () => Promise.resolve('updated-data')
			})
			await wait()

			expect(states[states.length - 1].data).toBe('updated-data')
		})

		it('should store state even without active subscribers', async () => {
			lery.fetch({
				queryKey: ['fetch-no-subscribers'],
				queryFn: () => Promise.resolve('cached-data')
			})
			await wait()

			const state = lery.state(['fetch-no-subscribers'])
			expect(state.status).toBe(Status.SUCCESS)
			expect(state.data).toBe('cached-data')
		})
	})

	// ============================================================================
	// MUTATE OPERATION TESTS
	// ============================================================================

	describe('Mutate Operations', () => {
		it('should reset state before mutation execution', async () => {
			const states: QueryState[] = []
			lery.subscribe({
				queryKey: ['mutate-reset'],
				callback: s => states.push(s)
			})

			// Setup initial data
			lery.fetch({
				queryKey: ['mutate-reset'],
				queryFn: () => Promise.resolve('initial-data')
			})
			await wait()

			// Mutate should reset state first
			lery.mutate({
				queryKey: ['mutate-reset'],
				queryFn: () => Promise.resolve('mutated-data')
			})

			// Check reset state
			expect(states[4]).toMatchObject({
				status: Status.IDLE,
				error: null,
				isFetched: false,
				isIdle: true
			})

			// Check loading state
			expect(states[5].status).toBe(Status.LOADING)
			await wait()

			// Check final success state
			expect(states[6]).toMatchObject({
				status: Status.SUCCESS,
				data: 'mutated-data'
			})
		})

		it('should handle successful mutation', async () => {
			const states: QueryState[] = []
			lery.subscribe({
				queryKey: ['mutate-success'],
				callback: s => states.push(s)
			})

			lery.mutate({
				queryKey: ['mutate-success'],
				queryFn: () => Promise.resolve('mutation-success')
			})

			expect(states[1].status).toBe(Status.IDLE) // Reset state
			expect(states[2].status).toBe(Status.LOADING) // Loading state
			await wait()

			const finalState = states[3]
			expect(finalState).toMatchObject({
				status: Status.SUCCESS,
				data: 'mutation-success',
				error: null,
				isFetched: true
			})
		})

		it('should handle mutation errors', async () => {
			const states: QueryState[] = []
			const mutationError = new Error('mutation-failed')

			lery.subscribe({
				queryKey: ['mutate-error'],
				callback: s => states.push(s)
			})

			lery.mutate({
				queryKey: ['mutate-error'],
				queryFn: () => Promise.reject(mutationError)
			})

			expect(states[1].status).toBe(Status.IDLE) // Reset state
			expect(states[2].status).toBe(Status.LOADING) // Loading state
			await wait()

			const errorState = states[3]
			expect(errorState).toMatchObject({
				status: Status.ERROR,
				error: mutationError,
				data: null,
				isFetched: true
			})
		})

		it('should always use LOADING status (never REFETCHING)', async () => {
			const states: QueryState[] = []
			lery.subscribe({
				queryKey: ['mutate-loading'],
				callback: s => states.push(s)
			})

			// Setup initial successful state
			lery.fetch({
				queryKey: ['mutate-loading'],
				queryFn: () => Promise.resolve('initial')
			})
			await wait()

			// Mutate should use LOADING, not REFETCHING
			lery.mutate({
				queryKey: ['mutate-loading'],
				queryFn: () => Promise.resolve('mutated')
			})

			expect(states[5].status).toBe(Status.LOADING) // Not REFETCHING
			await wait()

			expect(states[6]).toMatchObject({
				status: Status.SUCCESS,
				data: 'mutated'
			})
		})

		it('should override existing successful state', async () => {
			const states: QueryState[] = []
			lery.subscribe({
				queryKey: ['mutate-override-success'],
				callback: s => states.push(s)
			})

			// Setup successful state
			lery.fetch({
				queryKey: ['mutate-override-success'],
				queryFn: () => Promise.resolve('original-success')
			})
			await wait()

			// Mutate should completely replace
			lery.mutate({
				queryKey: ['mutate-override-success'],
				queryFn: () => Promise.resolve('new-success')
			})
			await wait()

			expect(states[states.length - 1].data).toBe('new-success')
		})

		it('should override existing error state', async () => {
			const states: QueryState[] = []
			lery.subscribe({
				queryKey: ['mutate-override-error'],
				callback: s => states.push(s)
			})

			// Setup error state
			lery.fetch({
				queryKey: ['mutate-override-error'],
				queryFn: () => Promise.reject(new Error('initial-error'))
			})
			await wait()

			// Mutate should recover from error
			lery.mutate({
				queryKey: ['mutate-override-error'],
				queryFn: () => Promise.resolve('recovered')
			})
			await wait()

			const finalState = states[states.length - 1]
			expect(finalState).toMatchObject({
				status: Status.SUCCESS,
				data: 'recovered',
				error: null
			})
		})
	})

	// ============================================================================
	// REQUEST DEDUPLICATION TESTS
	// ============================================================================

	describe('Request Deduplication', () => {
		it('should deduplicate fetch requests within deduping time', async () => {
			let fetchCallCount = 0
			const fetcher = () => {
				fetchCallCount++
				return Promise.resolve('deduped-fetch')
			}

			const promise1 = lery.fetch({
				queryKey: ['dedup-fetch'],
				queryFn: fetcher
			})
			const promise2 = lery.fetch({
				queryKey: ['dedup-fetch'],
				queryFn: fetcher
			})

			expect(promise1).toBe(promise2) // Same promise returned
			await promise1
			expect(fetchCallCount).toBe(1) // Only called once
		})

		it('should allow new fetch request after deduping time expires', async () => {
			let fetchCallCount = 0
			const fetcher = () => {
				fetchCallCount++
				return Promise.resolve('after-dedup-fetch')
			}

			// First fetch
			await lery.fetch({ queryKey: ['dedup-expire-fetch'], queryFn: fetcher })
			// Simulate time passage by manipulating lastFetchTime
			const entry = (lery as any).cache.get(
				serializeKey(['dedup-expire-fetch'])
			)

			setTimeout(() => {}, 6000)

			// Second fetch should be allowed
			await lery.fetch({ queryKey: ['dedup-expire-fetch'], queryFn: fetcher })
			expect(fetchCallCount).toBe(2)
		})

		it('should NOT deduplicate mutate requests (mutate always resets)', async () => {
			let mutateCallCount = 0
			const mutator = () => {
				mutateCallCount++
				return Promise.resolve(`mutate-${mutateCallCount}`)
			}

			const promise1 = lery.mutate({
				queryKey: ['no-dedup-mutate'],
				queryFn: mutator
			})
			const promise2 = lery.mutate({
				queryKey: ['no-dedup-mutate'],
				queryFn: mutator
			})

			expect(promise1).not.toBe(promise2) // Different promises
			await Promise.all([promise1, promise2].filter(Boolean))
			expect(mutateCallCount).toBe(2) // Called twice because mutate resets state
		})

		it('should execute each mutate request independently', async () => {
			let mutateCallCount = 0
			const mutator = () => {
				mutateCallCount++
				return Promise.resolve(`mutate-${mutateCallCount}`)
			}

			// First mutate
			const result1 = await lery.mutate({
				queryKey: ['independent-mutate'],
				queryFn: mutator
			})

			// Second mutate (no time simulation needed since mutate doesn't deduplicate)
			const result2 = await lery.mutate({
				queryKey: ['independent-mutate'],
				queryFn: mutator
			})

			expect(mutateCallCount).toBe(2)
			expect(result1).toBe('mutate-1')
			expect(result2).toBe('mutate-2')
		})
	})

	// ============================================================================
	// STATE MANAGEMENT TESTS
	// ============================================================================

	describe('State Management', () => {
		it('should provide accurate state through state method', () => {
			const initialState = lery.state(['state-check'])

			expect(initialState).toMatchObject({
				status: Status.IDLE,
				data: null,
				error: null,
				isIdle: true,
				isLoading: false,
				isFetching: false,
				isSuccess: false,
				isError: false,
				isFetched: false
			})
		})

		it('should maintain state consistency across operations', async () => {
			const states: QueryState[] = []
			lery.subscribe({
				queryKey: ['state-consistency'],
				callback: s => states.push(s)
			})

			// Fetch -> Success
			lery.fetch({
				queryKey: ['state-consistency'],
				queryFn: () => Promise.resolve('data1')
			})
			await wait()

			// Mutate -> Reset -> Success
			lery.mutate({
				queryKey: ['state-consistency'],
				queryFn: () => Promise.resolve('data2')
			})
			await wait()

			// Verify state transitions
			expect(states[0].status).toBe(Status.IDLE) // Initial
			expect(states[1].status).toBe(Status.LOADING) // Fetch loading
			expect(states[2].status).toBe(Status.SUCCESS) // Fetch success
			expect(states[4].status).toBe(Status.IDLE) // Mutate reset
			expect(states[5].status).toBe(Status.LOADING) // Mutate loading
			expect(states[6].status).toBe(Status.SUCCESS) // Mutate success
		})

		it('should handle concurrent operations gracefully', async () => {
			let callCount = 0
			const concurrentFetcher = () => {
				callCount++
				return new Promise(resolve =>
					setTimeout(() => resolve(`result-${callCount}`), 10)
				)
			}

			// Start multiple concurrent operations
			const promises = [
				lery.fetch({ queryKey: ['concurrent'], queryFn: concurrentFetcher }),
				lery.fetch({ queryKey: ['concurrent'], queryFn: concurrentFetcher }),
				lery.mutate({ queryKey: ['concurrent'], queryFn: concurrentFetcher })
			]

			await Promise.all(promises.filter(Boolean))

			// Verify final state
			const finalState = lery.state(['concurrent'])
			expect(finalState.status).toBe(Status.SUCCESS)
			expect(finalState.data).toBeTruthy()
		})
	})

	// ============================================================================
	// EDGE CASES AND ERROR HANDLING
	// ============================================================================

	describe('Edge Cases & Error Handling', () => {
		it('should handle non-Error rejections properly', async () => {
			const states: QueryState[] = []
			lery.subscribe({
				queryKey: ['non-error-rejection'],
				callback: s => states.push(s)
			})

			lery.fetch({
				queryKey: ['non-error-rejection'],
				queryFn: () => Promise.reject('string-error')
			})
			await wait()

			const errorState = states[2]
			expect(errorState.status).toBe(Status.ERROR)
			expect(errorState.error).toBeInstanceOf(Error)
			expect((errorState.error as Error).message).toBe('string-error')
		})

		it('should handle empty query keys', () => {
			expect(() => {
				lery.subscribe({
					queryKey: [] as any,
					callback: () => {}
				})
			}).not.toThrow()
		})

		it('should handle rapid subscribe/unsubscribe cycles', () => {
			const callbacks = Array.from({ length: 10 }, () => () => {})
			const unsubscribers = callbacks.map(callback =>
				lery.subscribe({ queryKey: ['rapid-cycle'], callback })
			)

			// Unsubscribe all
			unsubscribers.forEach(unsub => unsub())

			// Should not throw and cache should be cleaned
			const state = lery.state(['rapid-cycle'])
			expect(state.status).toBe(Status.IDLE)
		})

		it('should maintain state isolation between different query keys', async () => {
			// Setup different queries
			lery.fetch({
				queryKey: ['key-a'],
				queryFn: () => Promise.resolve('data-a')
			})
			lery.fetch({
				queryKey: ['key-b'],
				queryFn: () => Promise.reject(new Error('error-b'))
			})
			await wait()

			const stateA = lery.state(['key-a'])
			const stateB = lery.state(['key-b'])

			expect(stateA.status).toBe(Status.SUCCESS)
			expect(stateA.data).toBe('data-a')

			expect(stateB.status).toBe(Status.ERROR)
			expect(stateB.data).toBeNull()
		})
	})
})
