#!/usr/bin/env ts-node
import { Command } from "commander";
import * as ethers from "ethers";
import { downloadDB, createDB } from "./ethAddresses";
import { createRound } from "./rounds";

const program = new Command();

program.command("create-db").action(createDB);

program.command("download-db").argument("<private-key>").action(downloadDB);

program
  .command("create-round")
  .argument("<chain-id>")
  .argument("<round-id>")
  .argument("<token-count>")
  .action((chainID: string, roundID: string, tokenCount: string, opts) =>
    createRound(
      parseInt(chainID),
      parseInt(roundID),
      ethers.BigNumber.from(tokenCount),
      opts
    )
  );

(async function () {
  await program.parseAsync(process.argv);
})();
