# contracts-comparison

Companion code for *A Comparative Analysis of Smart Contract Architectures: The eUTXO Model and the Account-Based Model* (UTM 2026).

**Repository:** https://github.com/Ernest96/Blockchain-escrow-service

Two parallel implementations of the same time-locked service-payment escrow:

| Side       | Toolchain                                    | Testnet  |
|------------|----------------------------------------------|----------|
| Ethereum   | Solidity 0.8.28 + Hardhat 3 + Mocha/Chai     | Sepolia  |
| Cardano    | Aiken (Plutus V3) + Mesh.js                  | Preview  |

## Repository layout

```
contracts-comparison/
├── ethereum/                       # Hardhat 3 project
│   ├── contracts/Escrow.sol
│   ├── test/Escrow.test.ts
│   ├── ignition/modules/Escrow.ts  # deploy module (Ignition)
│   └── scripts/
│       ├── print-storage-layout.ts
│       ├── show-wallets.ts
│       └── sepolia/                # per-action scripts (post-deploy)
│           ├── _lib.ts             # common helpers only
│           ├── lock.ts             # exports lockDeal()
│           ├── claim.ts            # exports claimDeal()
│           ├── refund.ts           # exports refundDeal()
│           └── smoke.ts            # orchestrator (lock + claim)
└── cardano/                        # Aiken + Mesh.js
    ├── validators/escrow.ak
    ├── scripts/print-datum-schema.ts
    └── offchain/                   # Mesh.js scripts
        ├── lock.ts
        ├── claim.ts
        ├── refund.ts
        ├── preview-smoke.ts
        ├── setup-collateral.ts
        ├── show-wallets.ts
        └── address.ts
```

## Phase 1 — Compile both contracts and extract artefacts

```bash
# Ethereum side
cd ethereum
npm install
npx hardhat compile
npx hardhat run scripts/print-storage-layout.ts

# Cardano side
cd ../cardano
aiken check
aiken build              # produces plutus.json
npx -y tsx scripts/print-datum-schema.ts
```

Outputs go straight into REPORT.md (axis 1).

## Phase 2 — Off-chain happy path

### Local-only (no testnet funds needed)

```bash
cd ethereum
npx hardhat test         # 10 tests, all on the in-process EDR network
```

### Sepolia (Ethereum) — needs a funded private key

Deployment and per-action scripts are deliberately separate. The order is:

1. `cp ethereum/.env.example ethereum/.env` and fill in:
   - `SEPOLIA_RPC_URL` (Infura / Alchemy / public)
   - `SEPOLIA_PRIVATE_KEY` (deployer — used by `deploy:sepolia` only)
   - `PAYER_PRIVATE_KEY` (signs `lock` and `refund`)
   - `PROVIDER_PRIVATE_KEY` (signs `claim`)

   The three keys can all be the same wallet if you want the simplest
   setup; the contract enforces the roles via `msg.sender` checks.
2. Show the addresses to fund:
   ```bash
   cd ethereum
   npm run wallets
   ```
   Send ~0.1 Sepolia ETH to the payer and ~0.01 to the provider. Faucets:
   - https://sepoliafaucet.com
   - https://www.alchemy.com/faucets/ethereum-sepolia
3. **Deploy** (Hardhat Ignition — separate from the action scripts):
   ```bash
   npm run deploy:sepolia
   ```
   The address is recorded in `ignition/deployments/chain-11155111/deployed_addresses.json`; subsequent scripts read it from there automatically (or you can override with `ESCROW_ADDRESS=…`).
4. **Run actions** — each is its own script under `scripts/sepolia/`:
   ```bash
   npm run lock:sepolia                         # locks 0.001 ETH (LOCK_AMOUNT_ETH overrides)
   DEAL_ID=0 npm run claim:sepolia              # provider claims
   DEAL_ID=0 npm run refund:sepolia             # payer refunds (only after deadline)
   ```
   Or run lock + claim end-to-end:
   ```bash
   npm run smoke:sepolia
   ```
   Save the printed contract address and tx hashes into REPORT.md.

### Preview (Cardano) — needs a Blockfrost project ID and two funded mnemonics

1. `cp cardano/offchain/.env.example cardano/offchain/.env` and fill in:
   - `BLOCKFROST_PROJECT_ID` (free at https://blockfrost.io, choose **Preview**)
   - `PAYER_MNEMONIC` (24 words)
   - `PROVIDER_MNEMONIC` (24 words)
2. Show the addresses to fund:
   ```bash
   cd cardano/offchain
   npm install
   npm run wallets
   ```
   Send ~100 tADA to each at https://docs.cardano.org/cardano-testnets/tools/faucet (choose Preview).
3. One-time collateral setup for both wallets (Plutus needs it):
   ```bash
   npm run setup-collateral payer
   npm run setup-collateral provider
   ```
4. Run the smoke test (lock + claim, captures all tx hashes):
   ```bash
   npm run smoke
   ```
   Save the printed tx hashes into REPORT.md.

## Status

- [x] Phase 0 — toolchain + scaffolding
- [x] Phase 1 — Escrow.sol + escrow.ak compile, artefacts extracted
- [x] Phase 2 — Hardhat tests pass locally; Mesh.js scripts authored & smoke-tested
- [ ] Phase 2 — Sepolia deployment & Preview happy-path on-chain (needs funded keys)
- [ ] Phase 3 — Axis 2 (security): reentrancy, front-running, double-satisfaction, Slither + aiken check
- [ ] Phase 4 — Axis 3 (concurrency): 5 overlapping transactions per network
- [ ] Phase 5 — Axis 4 (expressiveness): LOC, compile-vs-runtime errors
- [ ] Phase 6 — REPORT.md + paper Section 3

## Notes for reproducibility

- All numeric POSIX times are in milliseconds (matches Plutus V3 validity ranges).
- Cardano slot conversion uses `SLOT_CONFIG_NETWORK.preview` from `@meshsdk/core`.
- Solidity storage layout is emitted by enabling `outputSelection: { "*": { "*": ["storageLayout"] } }` in `hardhat.config.ts`.
- The Plutus blueprint is the source of truth for the on-chain encoding of `Datum` (constructor 0, 3 fields) and `Redeemer` (`Claim` = 0, `Refund` = 1).
