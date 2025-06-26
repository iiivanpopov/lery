import { expect, test } from 'bun:test'
import { Lery } from '../src/Lery'

test('Lery: subscribe and getState returns initial state', () => {
	const lery = new Lery()
	const key = 'foo'
	let state: any = null
	const unsub = lery.subscribe(key, s => {
		state = s
	})
	expect(state).toEqual({ data: null, error: null, isLoading: false })
	expect(lery.getState(key)).toEqual({
		data: null,
		error: null,
		isLoading: false,
	})
	unsub()
})

test('Lery: fetch updates state and notifies subscribers', async () => {
	const lery = new Lery()
	const key = 'bar'
	const result = { value: 42 }
	let states: any[] = []
	lery.subscribe(key, s => {
		states.push({ ...s })
	})
	lery.fetch(key, async () => {
		await new Promise(r => setTimeout(r, 10))
		return result
	})
	await new Promise(r => setTimeout(r, 30))
	expect(states[0]).toEqual({ data: null, error: null, isLoading: false })
	expect(states[1]).toEqual({ data: null, error: null, isLoading: true })
	expect(states[2]).toEqual({ data: result, error: null, isLoading: false })
	expect(lery.getState(key)).toEqual({
		data: result,
		error: null,
		isLoading: false,
	})
})

test('Lery: fetch handles errors', async () => {
	const lery = new Lery()
	const key = 'err'
	let states: any[] = []
	lery.subscribe(key, s => {
		states.push({ ...s })
	})
	lery.fetch(key, async () => {
		await new Promise(r => setTimeout(r, 10))
		throw new Error('fail')
	})
	await new Promise(r => setTimeout(r, 30))
	expect(states[1].isLoading).toBe(true)
	expect(states[2].error).toBeInstanceOf(Error)
	expect(states[2].error.message).toBe('fail')
	expect(states[2].data).toBe(null)
	expect(states[2].isLoading).toBe(false)
})

test('Lery: unsubscribe removes subscriber and cleans up cache', () => {
	const lery = new Lery()
	const key = 'baz'
	let called = 0
	const unsub = lery.subscribe(key, () => {
		called++
	})
	unsub()
	// After unsubscribe, cache should be cleaned up if no data/error/loading
	expect(lery.getState(key)).toEqual({
		data: null,
		error: null,
		isLoading: false,
	})
	// Internal cache should not have the key
	// @ts-expect-error: access private
	expect(lery.cache.has(key)).toBe(false)
})
