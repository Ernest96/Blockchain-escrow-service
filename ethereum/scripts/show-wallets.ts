// Prints the Sepolia addresses of the configured payer and provider keys
// — so you know where to send faucet ETH.
//
// Usage:
//   npx hardhat run scripts/show-wallets.ts --network sepolia
//   (or omit --network; it just reads the env vars)

import { ethers } from "ethers";
import "dotenv/config";

function showAddress(label: string, key: string | undefined) {
  if (!key) {
    console.log(`${label}: <not set in .env>`);
    return;
  }
  try {
    const w = new ethers.Wallet(key);
    console.log(`${label}: ${w.address}`);
  } catch (e: any) {
    console.log(`${label}: <invalid private key — ${e.message}>`);
  }
}

console.log("Sepolia wallets:");
showAddress("  deployer ", process.env.SEPOLIA_PRIVATE_KEY);
showAddress("  payer    ", process.env.PAYER_PRIVATE_KEY);
showAddress("  provider ", process.env.PROVIDER_PRIVATE_KEY);
console.log("\nFund both at:");
console.log("  https://sepoliafaucet.com");
console.log("  https://www.alchemy.com/faucets/ethereum-sepolia");
