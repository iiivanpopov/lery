import { Lery } from './src/Lery'

type User = { id: string; name: string }

type API = {
	user: User
}

const lery = new Lery<API>({ options: { dedupingTime: 5000 } })

// Subscribe to state changes
const unsubscribe = lery.subscribe({
	queryKey: ['user', 1],
	callback: state => {
		if (state.isLoading) console.log('Loading...')
		if (state.isError) console.log('Error')
		if (state.isSuccess) console.log('Success\n', state.data)
	},
})

// Fetch user data
const response = await lery.fetch({
	queryKey: ['user', 1],
	queryFn: async () => {
		return { id: '1', name: 'name' }
		const res = await fetch('/api/user')
		return res.json() as Promise<User>
	},
	options: { dedupingTime: 3000 },
})

unsubscribe()
