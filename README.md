# eUTXO vs Account-Based 

Companion code for *A Comparative Analysis of Smart Contract Architectures: The eUTXO Model and the Account-Based Model* (UTM 2026).

Two parallel implementations of the same time-locked service-payment escrow:

| Side       | Toolchain                                    | Testnet  |
|------------|----------------------------------------------|----------|
| Ethereum   | Solidity 0.8.28 + Hardhat 3                  | Sepolia  |
| Cardano    | Aiken (Plutus V3) + Mesh.js                  | Preprod  |

## Repository layout

```
contracts-comparison/
├── ethereum/                       # Hardhat 3 project
│   ├── contracts/Escrow.sol
│   ├── ignition/modules/Escrow.ts  # deploy module (Ignition)
│   └── scripts/
│       ├── print-storage-layout.ts
│       ├── show-wallets.ts
│       └── sepolia/                # per-action scripts (post-deploy)
│           ├── lib.ts              # shared helpers
│           ├── lock.ts
│           ├── claim.ts
│           └── refund.ts
└── cardano/                        # Aiken + Mesh.js
    ├── validators/escrow.ak
    ├── plutus.json                 # compiled blueprint (committed)
    ├── scripts/print-datum-schema.ts
    └── offchain/                   # Mesh.js scripts
        ├── common.ts               # shared helpers (wallet, validator, ref)
        ├── address.ts              # prints script address
        ├── show-wallets.ts         # prints PAYER + PROVIDER addresses
        ├── brew-wallets.ts         # generates fresh testnet mnemonics
        ├── setup-collateral.ts     # sets collateral on a wallet
        ├── publish-script.ts       # publishes validator as on-chain ref
        ├── lock.ts
        ├── claim.ts
        └── refund.ts
```

# Ethereum Escrow

Solidity escrow contract on Sepolia, built with Hardhat v3.

## Setup

```bash
npm install
cp .env.example .env   # fill in the values
```

`.env` keys:

| Key                   | Description                                   |
|-----------------------|-----------------------------------------------|
| `SEPOLIA_RPC_URL`     | Infura Sepolia endpoint             |
| `PAYER_PRIVATE_KEY`   | Private key of the payer wallet               |
| `PROVIDER_PRIVATE_KEY`| Private key of the provider wallet            |
| `ESCROW_ADDRESS`      | Override deployed contract address            |

## Deploy

```bash
npm run deploy:sepolia
```

## Lock / Claim / Refund

```bash
# Lock funds (defaults: 0.001 ETH, 30-min deadline)
npm run lock

# Claim — provider collects after service is delivered
DEAL_ID=3 npm run claim

# Refund — payer reclaims after deadline passes
DEAL_ID=3 npm run refund
```


---

# Cardano Escrow

Aiken (Plutus V3) validator + Mesh.js off-chain on Preprod.

## Setup

```bash
cd cardano/offchain
npm install
cp .env.example .env   # fill in the values
```

`.env` keys:

| Key                      | Description                                  |
|--------------------------|----------------------------------------------|
| `BLOCKFROST_PROJECT_ID`  | Blockfrost Preprod project ID                |
| `ADMIN_MNEMONIC`         | 24-word mnemonic — one-time script publisher |
| `PAYER_MNEMONIC`         | 24-word mnemonic — locks funds, can refund   |
| `PROVIDER_MNEMONIC`      | 24-word mnemonic — claims funds              |

## One-time setup (per deployment)

```bash
# Generate fresh wallets (skip if you already have mnemonics)
npm run brew-wallets

# Fund wallets from the Preprod faucet, then:
npm run setup-collateral   # sets collateral on PAYER and PROVIDER wallets
npm run publish-script     # publishes the validator as an on-chain reference script
```

## Lock / Claim / Refund

```bash
# Lock funds (defaults: 5 ADA, 30-min deadline)
npm run lock

# Claim — provider collects (paste tx hash printed by lock)
npm run claim <lock-tx-hash>

# Refund — payer reclaims after deadline
npm run refund <lock-tx-hash>
```