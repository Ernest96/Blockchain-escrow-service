import { getContext, etherscanTx } from "./lib.js";

export async function refundDeal(opts: { dealId?: bigint } = {}): Promise<string> {
  const raw = process.env.DEAL_ID;
  if (!opts.dealId && !raw) throw new Error("no <deal-id> provided");
  const dealId = opts.dealId ?? BigInt(raw!);

  const { payer, escrow } = await getContext();
  const tx = await escrow.connect(payer).refund(dealId);
  console.log(`refund tx:    ${tx.hash}`);
  console.log(`etherscan:    ${etherscanTx(tx.hash)}`);
  const receipt = await tx.wait();
  console.log(`gas used:     ${receipt!.gasUsed.toString()}`);
  return tx.hash;
}

await refundDeal();