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
| `SEPOLIA_RPC_URL`     | Alchemy / Infura Sepolia endpoint             |
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

