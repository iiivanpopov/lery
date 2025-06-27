import { Lery } from './src/Lery'

type User = { id: string; name: string }

type API = {
	user: User
}

const lery = new Lery<API>()

// Subscribe to state changes
const unsubscribe = lery.subscribe(['user'], state => {
	if (state.isLoading) console.log('Loading...')
	if (state.isError) console.log('Error')
	if (state.isSuccess) console.log('Success\n', state.data)
})

// Fetch user data
const response = await lery.fetch(['user'], async () => {
	const res = await fetch('/api/user')
	return res.json() as Promise<User>
})
