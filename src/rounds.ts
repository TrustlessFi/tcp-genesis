import { utils as ethersUtils, BigNumber, Wallet } from 'ethers'
import fs from 'fs'
import path from 'path'

import { roundsFolder } from './const'
import { isValidEthAddress } from "./ethAddresses"
import { fetchJSON, scale, unscale, readJSON } from './utils'
import { ChainID } from '@trustlessfi/addresses'

const chainIDToRoundData: {[chainID in ChainID]: string} = {
  [ChainID.Rinkeby]: 'https://gist.githubusercontent.com/TrustlessOfficial/2d9d275d05ae66cff0be17091d5abe74/raw',
  [ChainID.Hardhat]: 'https://gist.githubusercontent.com/TrustlessOfficial/7c58aee4e69cbd512d5a0e8afe172d1c/raw',
}

interface roundIDtoURI {
  [chainID: string]: {
    roundIDtoURI: {
      [key: string]: {
        fleekURI: string
        ipfsHash: string
      }
    }
  }
}

interface getMessageArgs {
  roundID: number
  chainID: number
  tokenCount: BigNumber
  address: string
  genesisAllocationAddress: string
}

const name = 'Tcp Genesis Allocation'

const getMessage = async ({
  genesisAllocationAddress,
  address,
  roundID,
  chainID,
  tokenCount,
}: getMessageArgs) => {
  return ethersUtils.solidityKeccak256(
    ['bytes', 'uint', 'address', 'address', 'uint256', 'uint128'],
    [
      ethersUtils.toUtf8Bytes(name),
      chainID,
      genesisAllocationAddress,
      address,
      roundID,
      tokenCount,
    ]
  )
}

interface genesisData {
  chainID: number
  genesisAllocationAddress: string
  liquidityPositions: string[]
  debtPositions: string[]
}
interface signatureData {
  signature: string
  tokenCount: string
}
interface roundData {
  roundID: number
  signatures: { [key: string]: signatureData }
  count: number
  otherRounds: roundIDtoURI
}

interface createRoundOpts {
  genesisDataFile: string
  privateKeyFile: string
  roundID: number
  totalTokenCount: number
}

export const createRound = async (opts: createRoundOpts) => {
  const { genesisDataFile, privateKeyFile, totalTokenCount, roundID } = opts

  // ensure file paths exist
  for (const path of [genesisDataFile, privateKeyFile]) {
    if (!fs.existsSync(path)) {
      throw new Error(`file not found: ${path}`)
    }
  }

  const {
    genesisAllocationAddress,
    chainID,
    liquidityPositions,
    debtPositions
  } = readJSON<genesisData>(genesisDataFile)

  console.log(`========================================`)
  console.log(`genesis data: ${genesisDataFile}`)
  console.log(`genesis allocation address: ${genesisAllocationAddress}`)
  console.log(`total tokens: ${totalTokenCount}`)
  console.log(`round id: ${roundID}`)
  console.log(`chain id: ${chainID}`)
  console.log(`========================================`)

  const scoreMap = {} as { [key: string]: number }

  // accumulate debt positions
  console.log(`total debt positions: ${debtPositions.length}`)
  for (const address of debtPositions) {
    if (!scoreMap[address]) scoreMap[address] = 0
    scoreMap[address] += 1
  }

  // accumulate liquidity positions
  console.log(`total liquidity positions: ${liquidityPositions.length}`)
  for (const address of liquidityPositions) {
    if (!scoreMap[address]) scoreMap[address] = 0
    scoreMap[address] += 1
  }

  // unset scores for 'invalid' eth addresses
  const invalidAddresses = new Set() as Set<string>
  for (const address of Object.keys(scoreMap)) {
    if (false && !(await isValidEthAddress(address))) {
      scoreMap[address] = 0
      invalidAddresses.add(address)
    }
  }
  console.log(`invalid addresses: ${invalidAddresses.size}`)

  // calculate total score
  let totalScore = 0
  Object.values(scoreMap).map((score) => (totalScore += score))
  console.log(`total addresses: ${Object.keys(scoreMap).length}`)
  console.log(`total score: ${totalScore}`)
  console.log(`====================`)

  // generate signatures
  console.log(`generating signatures`)
  const privateKey = fs.readFileSync(privateKeyFile).toString().trim()
  const signatures = {} as { [key: string]: signatureData }
  const wallet = new Wallet(privateKey)
  for (const [address, score] of Object.entries(scoreMap)) {
    const log = (score: number, tokenCount: number, message: string) => {
      console.log(
        `${address} (score: ${score}, tokens: ${tokenCount}): ${message}`
      )
    }

    // skip addresses with a zero score
    if (score === 0) {
      log(score, 0, "ineligible")
      continue
    }

    // calculate token count as a score-based percentage of total count
    const tokenCount = scale((score / totalScore) * totalTokenCount)

    // generate message and sign it
    const message = await getMessage({
      chainID,
      roundID,
      genesisAllocationAddress,
      address,
      tokenCount,
    })
    const signature = await wallet.signMessage(ethersUtils.arrayify(message))

    // add to payload
    log(score, unscale(tokenCount), signature)
    signatures[address] = { signature, tokenCount: tokenCount.toHexString() }
  }

  // generate round payload
  const roundFile = path.join(roundsFolder, `${chainID}-${roundID}.json`)
  const roundData = {
    roundID,
    chainID,
    signatures,
    count: totalTokenCount,
    otherRounds: await fetchJSON<roundIDtoURI>(chainIDToRoundData[chainID as ChainID]),
  } as roundData

  // serialize round payload
  console.log(`writing signatures to: ${roundFile}`)
  fs.writeFileSync(roundFile, JSON.stringify(roundData))
}
