#!/usr/bin/env ts-node
import { Command } from "commander";
import * as ethers from "ethers";
import { downloadDB, createDB, addAddressToDB } from "./ethAddresses";
import { createRound } from "./rounds";
import { storeInFleek } from './storeInFleek'

const program = new Command();

program
  .command("store-in-fleek")
  .requiredOption("-a, --fleek-api-keys-file <fleek-api-keys-file>")
  .requiredOption("-f, --file <file>")
  .action(storeInFleek)

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
  .requiredOption("-g, --genesis-data-file <genesis-data-file>")
  .requiredOption("-p, --private-key-file <private-key-file>")
  .requiredOption("-r, --round-id <round-id>")
  .requiredOption("-t, --total-token-count <total-token-count>")
  .action(({ roundId, totalTokenCount, ...args }) =>
    createRound({
      roundID: parseInt(roundId),
      totalTokenCount: parseInt(totalTokenCount),
      ...args,
    })
  );

(async function () {
  await program.parseAsync(process.argv);
})();
