# eUTXO vs Account-Based 

Companion code for *A Comparative Analysis of Smart Contract Architectures: The eUTXO Model and the Account-Based Model* (UTM 2026).

Two parallel implementations of the same time-locked service-payment escrow:

| Side       | Toolchain                                    | Testnet  |
|------------|----------------------------------------------|----------|
| Ethereum   | Solidity 0.8.28 + Hardhat 3                  | Sepolia  |
| Cardano    | Aiken (Plutus V3) + Mesh.js                  | Preprod  |

## Measured transactions

The per-action cost figures reported in Table 4 of the paper correspond to the following on-chain transactions. Each can be independently inspected on the respective block explorer.

| Action         | Network            | Transaction hash | Explorer |
|----------------|--------------------|------------------|----------|
| Create (lock)  | Sepolia (Ethereum) | `0x48b5776b7082729d3d595958bf3196eaaff4b897e01b05b1ec11ff2e801c56fb` | [Etherscan](https://sepolia.etherscan.io/tx/0x48b5776b7082729d3d595958bf3196eaaff4b897e01b05b1ec11ff2e801c56fb) |
| Claim          | Sepolia (Ethereum) | `0x28332e33ac97fd5bd9f94c470577ec602abcd0ba8f2570f4743f3849c0108cd4` | [Etherscan](https://sepolia.etherscan.io/tx/0x28332e33ac97fd5bd9f94c470577ec602abcd0ba8f2570f4743f3849c0108cd4) |
| Refund         | Sepolia (Ethereum) | `0x9575bbdefc4dd4b84f01559b12cf9a02b2fe0b47ec9b7fb648b2f79111562685` | [Etherscan](https://sepolia.etherscan.io/tx/0x9575bbdefc4dd4b84f01559b12cf9a02b2fe0b47ec9b7fb648b2f79111562685) |
| Create (lock)  | Preprod (Cardano)  | `2985af0e2865c8742cf1889b49d2a41e6995246acca0bff919514476330fb9a1` | [Cardanoscan](https://preprod.cardanoscan.io/transaction/2985af0e2865c8742cf1889b49d2a41e6995246acca0bff919514476330fb9a1) |
| Claim          | Preprod (Cardano)  | `3befc488bb49bebbdec0c543779abe7dee6b152598bbb2fc3055d3301499e6f8` | [Cardanoscan](https://preprod.cardanoscan.io/transaction/3befc488bb49bebbdec0c543779abe7dee6b152598bbb2fc3055d3301499e6f8) |
| Refund         | Preprod (Cardano)  | `4094f747d30a134429ae0f2831ed95e1926fe6ea957739f47cf0470d398335b9` | [Cardanoscan](https://preprod.cardanoscan.io/transaction/4094f747d30a134429ae0f2831ed95e1926fe6ea957739f47cf0470d398335b9) |


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