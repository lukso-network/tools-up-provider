export * from './client'
export * from './server'
export * from './popup'

export const isEmptyAccount = (value: `0x${string}` | string | undefined) => !value || /^0x0*$/.test(value)
export const EMPTY_ACCOUNT = '0x0000000000000000000000000000000000000000'
export const cleanupAccounts = (values: Array<`0x${string}` | undefined>): `0x${string}`[] => {
  return values?.map(value => (isEmptyAccount(value) ? EMPTY_ACCOUNT : value) as `0x${string}`) || []
}
