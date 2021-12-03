import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import * as sqlite3 from "sqlite3";
import * as sqlite from "sqlite";
import * as gcpStorage from "@google-cloud/storage";

import { dbFile, addressesFolder, gcpDbFile } from "./const";

const _pathExists = fs.existsSync;
const _isDirectory = (path: fs.PathLike) => fs.statSync(path).isDirectory();
const _isFile = (path: fs.PathLike) => fs.statSync(path).isFile();
const _getDb = async (dbFile: fs.PathLike) => {
  return sqlite.open({ filename: dbFile.toString(), driver: sqlite3.Database });
};
async function* _readLines(file: fs.PathLike) {
  /* reads `file` and returns an async iterator of lines found */
  const lineReader = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });
  for await (const line of lineReader) {
    yield line;
  }
  lineReader.close();
  lineReader.removeAllListeners();
}
const _containsCsvHeader = async (header: string, csvFile: fs.PathLike) => {
  /* ensures `csvFile` has expected headers */
  const iter = _readLines(csvFile);
  let headerFound = false;
  for await (const line of iter) {
    headerFound = line === header;
    break;
  }
  return headerFound;
};
const _validAddressRegex = new RegExp(`0x[0-9a-f]{40}`, "i");
const _isValidAddress = (value: string) => {
  /* ensures `value` matches typical address (ignores case) */
  return _validAddressRegex.test(value);
};
const _addAddressToDB = async (db: sqlite.Database, address: string) => {
  await db.run(
    `INSERT OR IGNORE INTO addresses (address) VALUES (?)`,
    address.toLocaleLowerCase()
  );
};

interface CreateDBOpts {}

export const createDB = async (_: CreateDBOpts = {}) => {
  // validate options
  if (!_pathExists(addressesFolder) || !_isDirectory(addressesFolder)) {
    throw new Error(`directory not found: ${addressesFolder}`);
  }

  // collect CSV files
  const csvFiles: string[] = [];
  const csvRegexp = new RegExp("^.*.csv$", "i");
  for (const file of fs.readdirSync(addressesFolder)) {
    const filePath = path.join(addressesFolder, file);
    if (!_isFile(filePath)) continue;
    if (!csvRegexp.test(filePath)) continue;
    if (!(await _containsCsvHeader("address", filePath))) continue;
    csvFiles.push(filePath);
  }

  // fail if no CSV files found (odds are this is an error)
  if (csvFiles.length <= 0) {
    throw new Error(`no csv files found: ${addressesFolder}`);
  }

  const db = await _getDb(dbFile);

  // create schema
  console.log("creating schema (if not exists)");
  await db.run(
    "CREATE TABLE IF NOT EXISTS addresses (address TEXT CHAR(42) PRIMARY KEY) WITHOUT ROWID;"
  );

  // set sqlite options
  console.log("setting pragmas");
  await db.run(`PRAGMA journal_mode = OFF;`);
  await db.run(`PRAGMA synchronous = OFF;`);

  // open transaction
  console.log("opening transaction");
  await db.run(`BEGIN TRANSACTION;`);

  // iterate over found files, and insert contents
  console.log("inserting records (if not exists)");
  for (const csvFile of csvFiles) {
    console.log(`reading: ${csvFile}`);

    // utilities to print statuses to stderr
    let counter = 0;
    let currStderrLine = "";
    const _clearStderrLine = () => {
      process.stderr.write(
        `\r${new Array(currStderrLine.length + 1).join(" ")}\r`
      );
      currStderrLine = "";
    };

    for await (const address of _readLines(csvFile)) {
      // ignore invalid eth-addresses
      if (!_isValidAddress(address)) {
        _clearStderrLine();
        console.warn(`ignoring address: ${address}`);
        continue;
      }

      // perform insert (if not exists)
      await _addAddressToDB(db, address);

      // print updated status
      counter += 1;
      _clearStderrLine();
      currStderrLine = `processed entries: ${counter}`;
      process.stderr.write(currStderrLine);
    }

    // file complete: print final status
    _clearStderrLine();
    console.log(`processed entries: ${counter}`);
  }

  // close transaction
  console.log("closing transaction");
  await db.run(`END TRANSACTION;`);
};

interface DownloadDBOpts {}
export const downloadDB = async (
  gcpServiceAccountKeyFile: string,
  _: DownloadDBOpts
) => {
  // validate options
  if (!_pathExists(gcpServiceAccountKeyFile)) {
    throw new Error(`file not found: ${gcpServiceAccountKeyFile}`);
  }
  if (_pathExists(dbFile)) {
    throw new Error(`file exists: ${dbFile}`);
  }

  // download gcp file
  const storage = new gcpStorage.Storage({
    keyFilename: gcpServiceAccountKeyFile,
  });
  const { bucket, file } = gcpDbFile;
  console.log(`Downloading gs://${bucket}/${file} -> ${dbFile}`);
  await storage
    .bucket(bucket)
    .file(file)
    .download({ destination: dbFile.toString() })
    .catch((error) => {
      fs.unlinkSync(dbFile);
      throw error;
    });
};

interface AddAddressToDBOpts {}
export const addAddressToDB = async (
  address: string,
  _: AddAddressToDBOpts
) => {
  const db = await _getDb(dbFile);
  console.log(`Adding ${address} to database`);
  await _addAddressToDB(db, address);
};

export const isValidEthAddress = async (value: string) => {
  const db = await _getDb(dbFile);
  const dbRecord = await db.get(
    `SELECT address FROM addresses WHERE address=?`,
    [value.toLocaleLowerCase()]
  );
  return dbRecord !== undefined;
};
