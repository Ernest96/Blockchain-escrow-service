import { expect } from "chai";
import { network } from "hardhat";

describe("Escrow — happy paths and revert checks", function () {
  async function deploy() {
    const { ethers } = await network.connect();

    const [payer, provider, stranger] = await ethers.getSigners();
    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.deploy();
    await escrow.waitForDeployment();

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    return { ethers, escrow, payer, provider, stranger, now };
  }

  it("lock(): records a deal and emits Locked", async () => {
    const { ethers, escrow, payer, provider, now } = await deploy();
    const deadline = now + 3600;
    const amount = ethers.parseEther("1");

    await expect(
      escrow.connect(payer).lock(provider.address, deadline, { value: amount }),
    )
      .to.emit(escrow, "Locked")
      .withArgs(0n, payer.address, provider.address, amount, deadline);

    const deal = await escrow.deals(0);
    expect(deal.payer).to.equal(payer.address);
    expect(deal.provider).to.equal(provider.address);
    expect(deal.amount).to.equal(amount);
    expect(deal.deadline).to.equal(BigInt(deadline));
  });

  it("lock(): reverts on zero amount", async () => {
    const { escrow, payer, provider, now } = await deploy();
    await expect(
      escrow.connect(payer).lock(provider.address, now + 3600, { value: 0n }),
    ).to.be.revertedWithCustomError(escrow, "ZeroAmount");
  });

  it("lock(): reverts on past deadline", async () => {
    const { ethers, escrow, payer, provider, now } = await deploy();
    await expect(
      escrow
        .connect(payer)
        .lock(provider.address, now - 1, { value: ethers.parseEther("1") }),
    ).to.be.revertedWithCustomError(escrow, "DeadlineInPast");
  });

  it("claim(): provider receives funds before deadline", async () => {
    const { ethers, escrow, payer, provider, now } = await deploy();
    const amount = ethers.parseEther("1");
    await escrow
      .connect(payer)
      .lock(provider.address, now + 3600, { value: amount });

    const balanceBefore = await ethers.provider.getBalance(provider.address);
    const tx = await escrow.connect(provider).claim(0);
    const receipt = await tx.wait();
    const gasCost = receipt!.gasUsed * receipt!.gasPrice;
    const balanceAfter = await ethers.provider.getBalance(provider.address);

    expect(balanceAfter - balanceBefore + gasCost).to.equal(amount);
    // Settling deletes the deal — mirrors UTxO consumption on Cardano.
    const deal = await escrow.deals(0);
    expect(deal.amount).to.equal(0n);
  });

  it("claim(): rejects non-provider caller", async () => {
    const { ethers, escrow, payer, provider, stranger, now } = await deploy();
    await escrow
      .connect(payer)
      .lock(provider.address, now + 3600, { value: ethers.parseEther("1") });
    await expect(
      escrow.connect(stranger).claim(0),
    ).to.be.revertedWithCustomError(escrow, "NotProvider");
  });

  it("claim(): rejects after deadline", async () => {
    const { ethers, escrow, payer, provider, now } = await deploy();
    await escrow
      .connect(payer)
      .lock(provider.address, now + 60, { value: ethers.parseEther("1") });

    // advance time past the deadline
    await ethers.provider.send("evm_increaseTime", [120]);
    await ethers.provider.send("evm_mine", []);

    await expect(
      escrow.connect(provider).claim(0),
    ).to.be.revertedWithCustomError(escrow, "PastDeadline");
  });

  it("refund(): payer reclaims funds after deadline", async () => {
    const { ethers, escrow, payer, provider, now } = await deploy();
    const amount = ethers.parseEther("0.5");
    await escrow
      .connect(payer)
      .lock(provider.address, now + 60, { value: amount });

    await ethers.provider.send("evm_increaseTime", [120]);
    await ethers.provider.send("evm_mine", []);

    const balanceBefore = await ethers.provider.getBalance(payer.address);
    const tx = await escrow.connect(payer).refund(0);
    const receipt = await tx.wait();
    const gasCost = receipt!.gasUsed * receipt!.gasPrice;
    const balanceAfter = await ethers.provider.getBalance(payer.address);

    expect(balanceAfter - balanceBefore + gasCost).to.equal(amount);
    const deal = await escrow.deals(0);
    expect(deal.amount).to.equal(0n);
  });

  it("refund(): rejects before deadline", async () => {
    const { ethers, escrow, payer, provider, now } = await deploy();
    await escrow
      .connect(payer)
      .lock(provider.address, now + 3600, { value: ethers.parseEther("1") });
    await expect(
      escrow.connect(payer).refund(0),
    ).to.be.revertedWithCustomError(escrow, "TooEarly");
  });

  it("refund(): rejects non-payer caller", async () => {
    const { ethers, escrow, payer, provider, stranger, now } = await deploy();
    await escrow
      .connect(payer)
      .lock(provider.address, now + 60, { value: ethers.parseEther("1") });
    await ethers.provider.send("evm_increaseTime", [120]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      escrow.connect(stranger).refund(0),
    ).to.be.revertedWithCustomError(escrow, "NotPayer");
  });

  it("double-claim is rejected (deal already consumed)", async () => {
    const { ethers, escrow, payer, provider, now } = await deploy();
    await escrow
      .connect(payer)
      .lock(provider.address, now + 3600, { value: ethers.parseEther("1") });
    await escrow.connect(provider).claim(0);
    await expect(
      escrow.connect(provider).claim(0),
    ).to.be.revertedWithCustomError(escrow, "UnknownDeal");
  });
});
