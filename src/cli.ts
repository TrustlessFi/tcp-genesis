#!/usr/bin/env ts-node
import { Command } from "commander";
import * as ethers from "ethers";
import { downloadDB, createDB, addAddressToDB } from "./ethAddresses";
import { createRound } from "./rounds";

const program = new Command();

program.command("create-db").action(createDB);

program
  .command("add-address-to-db")
  .argument("<address>")
  .action(addAddressToDB);

program
  .command("download-db")
  .argument("<gcp-service-account-key-file>")
  .action(downloadDB);

program
  .command("create-round")
  .argument("<chain-id>")
  .argument("<round-id>")
  .argument("<token-count>")
  .argument("<private-key-file>")
  .action(
    (
      chainID: string,
      roundID: string,
      tokenCount: string,
      privateKeyFile: string,
      opts
    ) =>
      createRound(
        parseInt(chainID),
        parseInt(roundID),
        ethers.BigNumber.from(tokenCount),
        privateKeyFile,
        opts
      )
  );

(async function () {
  await program.parseAsync(process.argv);
})();
