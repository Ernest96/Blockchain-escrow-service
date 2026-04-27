// Refunds a deal at the deployed Escrow on Sepolia (payer signs).
// Will revert on-chain unless the deadline has passed.
//
// Required env: SEPOLIA_RPC_URL, SEPOLIA_PRIVATE_KEY, DEAL_ID
// Optional env: PROVIDER_PRIVATE_KEY (only because _lib.getContext loads it),
//               ESCROW_ADDRESS
//
// Run: DEAL_ID=0 npx hardhat run scripts/sepolia/refund.ts --network sepolia

import { getContext, etherscanTx, isEntryPoint } from "./_lib.js";

/** Refunds a deal. Payer signs. Reverts on-chain unless deadline has passed. */
export async function refundDeal(opts: { dealId?: bigint } = {}): Promise<string> {
  const dealId =
    opts.dealId ??
    (process.env.DEAL_ID ? BigInt(process.env.DEAL_ID) : undefined);
  if (dealId === undefined) {
    throw new Error("DEAL_ID env var (or opts.dealId) is required");
  }

  const { payer, escrow } = await getContext();
  const tx = await escrow.connect(payer).refund(dealId);
  console.log(`refund tx:    ${tx.hash}`);
  console.log(`etherscan:    ${etherscanTx(tx.hash)}`);
  const receipt = await tx.wait();
  console.log(`gas used:     ${receipt!.gasUsed.toString()}`);
  return tx.hash;
}

if (isEntryPoint(import.meta.url)) {
  await refundDeal();
}
