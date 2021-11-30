import * as path from "path";

const dataDir = path.resolve(__dirname, "..", "data");
export const addressesFolder = path.join(dataDir, "eth-addresses");
export const dbFile = path.join(addressesFolder, "eth-addresses.sqlite");
export const roundsFolder = path.join(dataDir, "rounds");
export const gcpDbFile = {
  bucket: "eth-addresses",
  file: "eth-addresses.sqlite",
};
