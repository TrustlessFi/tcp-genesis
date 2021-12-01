import * as ethers from "ethers";
import * as fs from "fs";
import * as path from "path";

import { isValidEthAddress } from "./ethAddresses";
import { roundsFolder } from "./const";
import { getContract, ProtocolContract } from "./contracts";
import { getProvider } from "./providers";

interface CreateRoundOpts {}

export const createRound = async (
  chainID: number,
  roundID: number,
  tokensTotal: ethers.BigNumber,
  privateKeyFile: string,
  _: CreateRoundOpts
) => {
  if (!fs.existsSync(privateKeyFile)) {
    throw new Error(`file not found: ${privateKeyFile}`);
  }
  const privateKey = fs.readFileSync(privateKeyFile).toString().trim();
  const provider = await getProvider(chainID);
  const roundFile = path.join(roundsFolder, `${chainID}-${roundID}.json`);

  const contracts = {
    accounting: await getContract(
      chainID,
      ProtocolContract.Accounting,
      provider
    ),
    huePositionNFT: await getContract(
      chainID,
      ProtocolContract.HuePositionNFT,
      provider
    ),
    genesisAllocation: await getContract(
      chainID,
      ProtocolContract.GenesisAllocation,
      provider
    ),
  };

  // get next debt position nft id
  const nextDebtPositionId = await contracts.huePositionNFT.nextPositionID();
  const genesisParticipants = new Set() as Set<string>;

  // iterate from 0 -> next debt position ID
  // find all debt owners with positive debt + valid eth addresses
  console.log(
    "finding eligible genesis participants by iterating over all debt positions"
  );
  console.log(`max debt position id: ${nextDebtPositionId}`);
  for (
    let debtPositionID = ethers.BigNumber.from(0);
    debtPositionID < nextDebtPositionId;
    debtPositionID = debtPositionID.add(1)
  ) {
    const debtPosition = await contracts.accounting.getPosition(debtPositionID);
    const owner = await contracts.huePositionNFT.ownerOf(debtPositionID);

    const log = (msg: string) =>
      console.log(`(${debtPositionID}) ${owner}: ${msg}`);

    // if debt owner is considered 'invalid', ignore
    if (!(await isValidEthAddress(owner))) {
      log(`ineligible (invalid owner address)`);
      continue;
    }

    // if debt position <= 0, ignore
    if (!debtPosition.debt.gt(0)) {
      log(`ineligible (non-positive debt position)`);
      continue;
    }

    // if debt owner is already included in genesis participants - ignore
    if (genesisParticipants.has(owner)) {
      log(`eligible (owner already eligible)`);
      continue;
    }

    // fetch all liquidity positions for debt owner
    const liquidityPositionIDs =
      await contracts.accounting.getPoolPositionNftIdsByOwner(owner);
    let positiveLiquidityPosition: null | Awaited<
      ReturnType<typeof contracts.accounting.getPoolPosition>
    > = null;
    // determine if debt owner has any positive liquidity positions
    for (const liquidityPositionID of liquidityPositionIDs) {
      const liquidityPosition = await contracts.accounting.getPoolPosition(
        liquidityPositionID
      );
      if (liquidityPosition.liquidity.gt(0)) {
        positiveLiquidityPosition = liquidityPosition;
        break;
      }
    }
    if (positiveLiquidityPosition === null) {
      log(`ineligible (non-positive liquidity position)`);
      continue;
    }

    // address has positive debt position and positive liquidity position
    // - add to genesis participants
    log(`eligible (positive debt and liquidity positions)`);
    genesisParticipants.add(owner);
  }

  const numGenesisParticipants = genesisParticipants.size;
  const tokensPerParticipant =
    numGenesisParticipants > 0
      ? tokensTotal.div(numGenesisParticipants)
      : ethers.BigNumber.from(0);

  console.log(`genesis allocation: ${contracts.genesisAllocation.address}`);
  console.log(`genesis participants: ${genesisParticipants.size}`);
  console.log(`round id: ${roundID}`);
  console.log(`tokens total: ${tokensTotal}`);
  console.log(`tokens per participant: ${tokensPerParticipant}`);

  console.log(`generating signatures`);
  const signatures = {} as { [key: string]: string };
  for (const genesisParticipant of genesisParticipants) {
    let wallet = new ethers.Wallet(privateKey);
    const message = await contracts.genesisAllocation.getMessage(
      genesisParticipant,
      roundID,
      tokensPerParticipant
    );
    const signature = await wallet.signMessage(ethers.utils.arrayify(message));
    console.log(`${genesisParticipant}: ${signature}`);
    signatures[genesisParticipant] = signature;
  }

  console.log(`writing signatures to: ${roundFile}`);
  fs.writeFileSync(
    roundFile,
    JSON.stringify({
      roundID: roundID,
      count: tokensPerParticipant.toNumber(),
      signatures,
    })
  );
};
