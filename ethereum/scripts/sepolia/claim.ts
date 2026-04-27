import { getContext, etherscanTx } from "./lib.js";

export async function claimDeal(opts: { dealId?: bigint } = {}): Promise<string> {
  const dealId = opts.dealId ?? (BigInt(String(process.env.DEAL_ID)));
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

await claimDeal();