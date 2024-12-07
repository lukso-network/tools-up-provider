export * from './client'
export * from './server'
export * from './popup'

export const isEmptyAccount = (value: `0x${string}` | undefined) => !value
export const EMPTY_ACCOUNT = '0x0000000000000000000000000000000000000000'
export const cleanupAccounts = (values: Array<`0x${string}` | undefined>): `0x${string}`[] => {
  const list = []
  for (const value of values) {
    if (isEmptyAccount(value)) {
      break
    }
    list.push(value)
  }
  return list as `0x${string}`[]
}
