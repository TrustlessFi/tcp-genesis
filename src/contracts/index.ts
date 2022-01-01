import { Contract } from "ethers"
import { BaseProvider } from "@ethersproject/providers"

import { getAddress, chainAddresses } from "@trustlessfi/addresses"
import { assertUnreachable } from "@trustlessfi/utils"
import * as artifacts from "./artifacts"
import * as typechain from "./typechain"

type abi = { [key in string]: any }[]
type contractAbi = { abi: abi }

import protocolAddresses from "./protocolAddresses.json"

export enum ProtocolContract {
  Accounting = "Accounting",
  GenesisAllocation = "GenesisAllocation",
  Governor = "Governor",
  HuePositionNFT = "HuePositionNFT",
}

const artifactMap: { [key in ProtocolContract]: contractAbi } = {
  [ProtocolContract.Accounting]: artifacts.Accounting,
  [ProtocolContract.GenesisAllocation]: artifacts.GenesisAllocation,
  [ProtocolContract.Governor]: artifacts.Governor,
  [ProtocolContract.HuePositionNFT]: artifacts.HuePositionNFT,
}

interface typechainMap {
  [ProtocolContract.Accounting]: typechain.Accounting
  [ProtocolContract.GenesisAllocation]: typechain.GenesisAllocation
  [ProtocolContract.Governor]: typechain.Governor
  [ProtocolContract.HuePositionNFT]: typechain.HuePositionNFT
}

export const getContractAddress = async (
  chainID: number,
  contract: ProtocolContract,
  provider: BaseProvider
) => {
  const _governor = async () =>
    getContract(chainID, ProtocolContract.Governor, provider)

  switch (contract) {
    case ProtocolContract.Accounting:
      return (await _governor()).accounting()
    case ProtocolContract.GenesisAllocation:
      return getAddress(
        chainID,
        "TCP",
        ProtocolContract.GenesisAllocation,
        protocolAddresses
      )
    case ProtocolContract.Governor:
      return getAddress(
        chainID,
        "TCP",
        ProtocolContract.Governor,
        protocolAddresses
      )
    case ProtocolContract.HuePositionNFT:
      return (await _governor()).huePositionNFT()
    default:
      assertUnreachable(contract)
  }
}

export const getContract = async <K extends ProtocolContract>(
  chainID: number,
  contract: K,
  provider: BaseProvider
): Promise<typechainMap[K]> => {
  const artifact = artifactMap[contract]
  const address = await getContractAddress(chainID, contract, provider)
  return new Contract(address, artifact.abi, provider) as typechainMap[K]
}
