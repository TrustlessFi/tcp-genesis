import * as ethers from "ethers";
import * as fs from "fs";
import * as path from "path";

import { roundsFolder } from "./const";
import { isValidEthAddress } from "./ethAddresses";

interface _GetMessageArgs {
  roundID: number;
  chainID: number;
  tokenCount: ethers.BigNumber;
  address: string;
  genesisAllocationAddress: string;
}
const _getMessage = async ({
  genesisAllocationAddress,
  address,
  roundID,
  chainID,
  tokenCount,
}: _GetMessageArgs) => {
  const name = "Tcp Genesis Allocation";

  return ethers.utils.solidityKeccak256(
    ["bytes", "uint", "address", "address", "uint256", "uint128"],
    [
      ethers.utils.toUtf8Bytes(name),
      chainID,
      genesisAllocationAddress,
      address,
      roundID,
      tokenCount,
    ]
  );
};

const _bnf = ethers.BigNumber.from;
const _scale = (quantity: number, decimals = 18): ethers.BigNumber => {
  if (decimals < 6) throw new Error("too few decimals: " + decimals);
  const bigInt = BigInt(Math.round(quantity * 1e6));
  return _bnf(bigInt.toString() + "0".repeat(decimals - 6));
};
const _unscale = (quantity: ethers.BigNumber, decimals = 18): number => {
  const digits = quantity.toString().length;
  let digitsToRemove = digits - 15;
  if (digitsToRemove > decimals) {
    throw new Error("number too large");
  }
  while (digitsToRemove > 9) {
    quantity = quantity.div(1e9);
    digitsToRemove -= 9;
    decimals -= 9;
  }
  let num;
  if (digitsToRemove > 0) {
    decimals -= digitsToRemove;
    num = quantity.div(10 ** digitsToRemove).toNumber();
  } else {
    num = quantity.toNumber();
  }
  return num / 10 ** decimals;
};

interface _GenesisData {
  chainID: number;
  genesisAllocationAddress: string;
  liquidityPositions: string[];
  debtPositions: string[];
}
interface _SignatureData {
  signature: string;
  tokenCount: string;
}
interface _RoundData {
  roundID: number;
  signatures: { [key: string]: _SignatureData };
}

interface CreateRoundOpts {
  genesisDataFile: string;
  privateKeyFile: string;
  roundID: number;
  totalTokenCount: number;
}
export const createRound = async (opts: CreateRoundOpts) => {
  const { genesisDataFile, privateKeyFile, totalTokenCount, roundID } = opts;

  // ensure file paths exist
  for (const path of [genesisDataFile, privateKeyFile]) {
    if (!fs.existsSync(path)) {
      throw new Error(`file not found: ${path}`);
    }
  }

  // parse genesis data
  const genesisData = JSON.parse(
    fs.readFileSync(genesisDataFile).toString()
  ) as _GenesisData;
  const {
    genesisAllocationAddress,
    chainID,
    liquidityPositions,
    debtPositions,
  } = genesisData;

  console.log(`genesis data: ${genesisDataFile}`);
  console.log(`private key: ${privateKeyFile}`);
  console.log(`genesis allocation address: ${genesisAllocationAddress}`);
  console.log(`total tokens: ${totalTokenCount}`);
  console.log(`round id: ${roundID}`);
  console.log(`chain id: ${chainID}`);
  console.log(`====================`);

  const scoreMap = {} as { [key: string]: number };

  // accumulate debt positions
  console.log(`debt positions: ${debtPositions.length}`);
  for (const address of debtPositions) {
    if (!scoreMap[address]) scoreMap[address] = 0;
    scoreMap[address] += 1;
  }

  // accumulate liquidity positions
  console.log(`liquidity positions: ${liquidityPositions.length}`);
  for (const address of liquidityPositions) {
    if (!scoreMap[address]) scoreMap[address] = 0;
    scoreMap[address] += 1;
  }

  // unset scores for 'invalid' eth addresses
  const invalidAddresses = new Set() as Set<string>;
  for (const address of Object.keys(scoreMap)) {
    if (!(await isValidEthAddress(address))) {
      scoreMap[address] = 0;
      invalidAddresses.add(address);
    }
  }
  console.log(`invalid addresses: ${invalidAddresses.size}`);

  // calculate total score
  let totalScore = 0;
  Object.values(scoreMap).map((score) => (totalScore += score));
  console.log(`total addresses: ${Object.keys(scoreMap).length}`);
  console.log(`total score: ${totalScore}`);
  console.log(`====================`);

  // generate signatures
  console.log(`generating signatures`);
  const privateKey = fs.readFileSync(privateKeyFile).toString().trim();
  const signatures = {} as { [key: string]: _SignatureData };
  const wallet = new ethers.Wallet(privateKey);
  for (const [address, score] of Object.entries(scoreMap)) {
    const log = (score: number, tokenCount: number, message: string) => {
      console.log(
        `${address} (score: ${score}, tokens: ${tokenCount}): ${message}`
      );
    };

    // skip addresses with a zero score
    if (score === 0) {
      log(score, 0, "ineligible");
      continue;
    }

    // calculate token count as a score-based percentage of total count
    const tokenCount = _scale((score / totalScore) * totalTokenCount);

    // generate message and sign it
    const message = await _getMessage({
      chainID,
      roundID,
      genesisAllocationAddress,
      address,
      tokenCount,
    });
    const signature = await wallet.signMessage(ethers.utils.arrayify(message));

    // add to payload
    log(score, _unscale(tokenCount), signature);
    signatures[address] = { signature, tokenCount: tokenCount.toHexString() };
  }

  // generate round payload
  const roundFile = path.join(roundsFolder, `${chainID}-${roundID}.json`);
  const roundData = { roundID, signatures } as _RoundData;

  // serialize round payload
  console.log(`writing signatures to: ${roundFile}`);
  fs.writeFileSync(roundFile, JSON.stringify(roundData));
};
