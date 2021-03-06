# tdao-genesis

This repo generates TDAO distribution rounds for use during the genesis period of the procotol launch.

## Setup

```
yarn set version stable
yarn install
```

## Hardhat

Copy `localHardhatAddresses.json` to `src/contracts/localHardhatAddresses.json`.

## Usage

### Help

View command help and usage

```
yarn run cli <cmd?> --help
```

### Download ETH Address DB

We store a (large) SQLite database containing all eligible ETH addresses.
 This is required as one-time pre-requisite for creating distribution rounds.

```
yarn run cli download-db <gcp-service-account-key-file>
```

### Add a hardhat address to DB

You can add an address to the ETH address database:

```
yarn run cli add-address-to-db <address>
```

### Creating a distribution round 

To create a distribution round JSON, obtain genesis data from the `tdao-ui` and run the following:

```
yarn run cli create-round \
  --genesis-data-file <genesis-data-file> \
  --round-id <round-id> \
  --total-token-count <total-token-count> \
  --private-key-file <private-key-file>
```
