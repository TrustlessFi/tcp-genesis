import { Contract } from "ethers";
import { BaseProvider } from "@ethersproject/providers";

import { getAddress } from "@trustlessfi/addresses";
import { assertUnreachable } from "@trustlessfi/utils";
import * as artifacts from "./artifacts";
import * as typechain from "./typechain";

type abi = { [key in string]: any }[];
type contractAbi = { abi: abi };

import localHardhatAddressesEmpty from "./localHardhatAddresses.empty.json";

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
};

interface typechainMap {
  [ProtocolContract.Accounting]: typechain.Accounting;
  [ProtocolContract.GenesisAllocation]: typechain.GenesisAllocation;
  [ProtocolContract.Governor]: typechain.Governor;
  [ProtocolContract.HuePositionNFT]: typechain.HuePositionNFT;
}

export const getContractAddress = async (
  chainID: number,
  contract: ProtocolContract,
  provider: BaseProvider
) => {
  const localAddresses = await getLocalAddresses();
  const _governor = async () =>
    getContract(chainID, ProtocolContract.Governor, provider);

  switch (contract) {
    case ProtocolContract.Accounting:
      return (await _governor()).accounting();
    case ProtocolContract.GenesisAllocation:
      return getAddress(
        chainID,
        "TCP",
        ProtocolContract.GenesisAllocation,
        localAddresses
      );
    case ProtocolContract.Governor:
      return getAddress(
        chainID,
        "TCP",
        ProtocolContract.Governor,
        localAddresses
      );
    case ProtocolContract.HuePositionNFT:
      return (await _governor()).huePositionNFT();
    default:
      assertUnreachable(contract);
  }
};

export const getContract = async <K extends ProtocolContract>(
  chainID: number,
  contract: K,
  provider: BaseProvider
): Promise<typechainMap[K]> => {
  const artifact = artifactMap[contract];
  const address = await getContractAddress(chainID, contract, provider);
  return new Contract(address, artifact.abi, provider) as typechainMap[K];
};

const getLocalAddresses = async (): Promise<
  typeof localHardhatAddressesEmpty
> => {
  try {
    // try dynamic import of local hardhat addresses

    // @ts-ignore
    return await import("./localHardhatAddresses.json");
  } catch (e) {
    if (!(e instanceof Error)) {
      // in typescript, e is of 'unknown' type - guard against non-Error types.
      throw e;
    }
    // if error is unrelated to finding a module, rethrow
    if (e.message.toLocaleLowerCase().indexOf("cannot find module") < 0) {
      throw e;
    }
    // module is not found - use defaults.
    console.warn(
      `local hardhat addresses not found - falling back to defaults`
    );
    return localHardhatAddressesEmpty;
  }
};
