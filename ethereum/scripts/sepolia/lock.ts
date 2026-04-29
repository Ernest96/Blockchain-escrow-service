import { getContext, etherscanTx} from "./lib.js";

export async function lockDeal(opts: {
  amountEth?: string;
  deadlineMin?: number;
} = {}): Promise<{ dealId: bigint; txHash: string }> {
  const amountEth = opts.amountEth ?? "0.001";
  const deadlineMin = Number(opts.deadlineMin ?? "30");

  const { ethers, payer, provider, escrow } = await getContext();
  const amount = ethers.parseEther(amountEth);
  const deadline = Math.floor(Date.now() / 1000) + deadlineMin * 60;

  console.log(`Payer:        ${payer.address}`);
  console.log(`Provider:     ${provider.address}`);
  console.log(`Amount:       ${amountEth} ETH`);
  console.log(`Deadline:     ${new Date(deadline * 1000).toISOString()}`);

  const tx = await escrow
    .connect(payer)
    .lock(provider.address, deadline, { value: amount });
  console.log(`lock tx:      ${tx.hash}`);
  console.log(`etherscan:    ${etherscanTx(tx.hash)}`);
  const receipt = await tx.wait();

  const lockEvent = receipt!.logs
    .map((log) => {
      try {
        return escrow.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsedLog) => parsedLog?.name === "Locked");

  if (!lockEvent) {
    throw new Error(`Locked event not found in tx ${tx.hash}. `);
  }
  const dealId = lockEvent.args[0] as bigint;

  console.log(`deal id:      ${dealId.toString()}`);
  console.log(`gas used:     ${receipt!.gasUsed.toString()}`);
  return { dealId, txHash: tx.hash };
}

await lockDeal();