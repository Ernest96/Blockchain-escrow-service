// End-to-end happy-path smoke test against an already-deployed Escrow on Sepolia.
//   1. payer locks 0.001 ETH (or LOCK_AMOUNT_ETH) for the provider
//   2. provider claims the deal
//
// Deployment is NOT performed here — run `npm run deploy:sepolia` first.
//
// Run: npx hardhat run scripts/sepolia/smoke.ts --network sepolia

import { lockDeal } from "./lock.js";
import { claimDeal } from "./claim.js";

console.log("=== lock ===");
const { dealId, txHash: lockTxHash } = await lockDeal();

console.log("\n=== claim ===");
const claimTxHash = await claimDeal({ dealId });

console.log("\n✓ Sepolia happy-path complete.");
console.log(`Lock tx:      ${lockTxHash}`);
console.log(`Claim tx:     ${claimTxHash}`);
