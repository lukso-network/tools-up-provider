export * from './client'
export * from './server'
export * from './popup'

/**
 * Small helper function to compare two arrays of addresses.
 * This allow null, undefined, or empty strings to be considered the same.
 * @param _addresses1 - array 1
 * @param _addresses2 - array 2
 * @returns Returns true if there were changes between the two arrays.
 */
export const arrayChanged = (_addresses1?: Array<`0x${string}` | string | null | undefined>, _addresses2?: Array<`0x${string}` | string | null | undefined>) => {
  const addresses1 = _addresses1 ?? []
  const addresses2 = _addresses2 ?? []
  for (let i = 0; i < addresses1.length || i < addresses2.length; i++) {
    const is1Null = addresses1[i] === null || addresses1[i] === undefined
    const is2Null = addresses2[i] === null || addresses2[i] === undefined
    if (is1Null && is2Null) {
      continue
    }
    if (addresses1[i] !== addresses2[i]) {
      return true
    }
  }
  return false
}

/**
 * Cleanup accounts array so there are no sparse values (i.e. empty values in the middle, this is not compatible
 *  with many of the web3 libraries (web3.js and viem)).
 * @param values - original array
 * @returns Returns copy of array which makes 0x00..., null, undefined and empty string mark the end of the array
 *         This is useful for cleaning up the array of accounts.
 */
export const cleanupAccounts = (values: Array<`0x${string}` | undefined>): `0x${string}`[] => {
  const output = []
  for (const value of values) {
    if (!value || /^0x0+$/.test(value)) {
      break
    }
    output.push(value)
  }
  return output as Array<`0x${string}`>
}
