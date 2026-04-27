// Claims a deal at the deployed Escrow on Sepolia (provider signs).
//
// Required env: SEPOLIA_RPC_URL, SEPOLIA_PRIVATE_KEY, PROVIDER_PRIVATE_KEY,
//               DEAL_ID
// Optional env: ESCROW_ADDRESS
//
// Run: DEAL_ID=0 npx hardhat run scripts/sepolia/claim.ts --network sepolia

import { getContext, etherscanTx, isEntryPoint } from "./_lib.js";

/** Claims a deal. Provider signs. */
export async function claimDeal(opts: { dealId?: bigint } = {}): Promise<string> {
  const dealId =
    opts.dealId ??
    (process.env.DEAL_ID ? BigInt(process.env.DEAL_ID) : undefined);
  if (dealId === undefined) {
    throw new Error("DEAL_ID env var (or opts.dealId) is required");
  }

  const { provider, escrow } = await getContext();
  const tx = await escrow.connect(provider).claim(dealId);
  console.log(`claim tx:     ${tx.hash}`);
  console.log(`etherscan:    ${etherscanTx(tx.hash)}`);
  const receipt = await tx.wait();
  console.log(`gas used:     ${receipt!.gasUsed.toString()}`);
  return tx.hash;
}

if (isEntryPoint(import.meta.url)) {
  await claimDeal();
}
