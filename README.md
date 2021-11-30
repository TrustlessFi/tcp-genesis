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

### Download ETH Address DB

We store a (large) SQLite database containing all eligible ETH addresses.
 This is required as one-time pre-requisite for creating distribution rounds.

```
yarn run cli download-db <private-key-file>
```

### Creating a distribution round 

To create a distribution round JSON for a given chain, round and token count:

```
yarn run cli create-round <chain-id> <round-id> <token-count>
```
