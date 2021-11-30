import * as ethers from "ethers";

export const getProvider = async (chainID: number) => {
  let networkish: ethers.providers.Networkish = chainID;
  if (networkish === 1337) {
    networkish = "http://localhost:8545";
  }
  return ethers.getDefaultProvider(networkish);
};
