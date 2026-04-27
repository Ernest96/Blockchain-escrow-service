// One-time setup: creates a 5-ADA collateral UTxO for the given wallet.
// Plutus script transactions require collateral.
//
// Usage:
//   tsx setup-collateral.ts payer
//   tsx setup-collateral.ts provider

import { getWallet } from "./common.js";

const role = process.argv[2] as "payer" | "provider";
if (role !== "payer" && role !== "provider") {
  console.error("Usage: tsx setup-collateral.ts <payer|provider>");
  process.exit(1);
}

const { wallet } = await getWallet(role);
const address = await wallet.getChangeAddress();
console.log(`${role} address:    `, address);

const collateral = await wallet.getCollateral();
if (collateral.length > 0) {
  console.log("Collateral already exists:", collateral[0].input.txHash);
  process.exit(0);
}

console.log("Creating collateral (5 ADA)…");
const txHash = await wallet.createCollateral();
console.log("Collateral tx:    ", txHash);
console.log("Cardanoscan:      ", `https://preview.cardanoscan.io/transaction/${txHash}`);
