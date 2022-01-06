import { BigNumber, BigNumberish } from 'ethers'
import fs from 'fs'
import axios from 'axios'

export const fetchJSON = async <T>(url: string): Promise<T> => {
  return (await axios.get(url)).data as T
}

export const readJSON = <T>(file: string) => {
  if (!fs.existsSync(file)) throw new Error(`Loading local json file ${file} not found`)
  return (JSON.parse(fs.readFileSync(file, 'utf8'))) as T
}

export const unscale = (quantity: BigNumber, decimals = 18): number => {
  const digits = quantity.toString().length
  let digitsToRemove = digits - 15
  if (digitsToRemove > decimals) {
    throw new Error('number too large')
  }
  while(digitsToRemove > 9) {
    quantity = quantity.div(1e9)
    digitsToRemove -= 9
    decimals -= 9
  }
  let num = 0
  if (digitsToRemove > 0)  {
    decimals -= digitsToRemove
    num = quantity.div(10**digitsToRemove).toNumber()
  } else {
    num = quantity.toNumber()
  }
  const result = num / (10**decimals)
  return result
}

export const bnf = (val: BigNumberish) => BigNumber.from(val)

export const scale = (quantity: number, decimals = 18): BigNumber => bnf(mnt(quantity, decimals))

export const mnt = (quantity: number, decimals = 18): string => {
  if (isNaN(quantity)) return '0'
  if (decimals < 6) throw new Error('too few decimals: ' + decimals)
  return (BigInt(Math.round(quantity * 1e6))).toString() + '0'.repeat(decimals - 6)
}
