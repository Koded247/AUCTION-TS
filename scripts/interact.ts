import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { ReverseDutchAuctionSwap__factory } from "./typechain-types/factories/ReverseDutchAuctionSwap__factory";
import { IERC20__factory } from "./typechain-types/factories/IERC20__factory";

dotenv.config();

async function main() {
  // Connect to provider
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  console.log(`Connected to network: ${(await provider.getNetwork()).name}`);
  console.log(`Using address: ${wallet.address}`);

  // Get contract addresses from env vars or config
  const auctionContractAddress = process.env.AUCTION_CONTRACT_ADDRESS!;
  const tokenAddress = process.env.TOKEN_ADDRESS!;

  // Create contract instances
  const auctionContract = ReverseDutchAuctionSwap__factory.connect(
    auctionContractAddress,
    wallet
  );
  const tokenContract = IERC20__factory.connect(tokenAddress, wallet);

  // Display menu options
  console.log("\n===== REVERSE DUTCH AUCTION SWAP INTERFACE =====");
  console.log("1. Create new auction");
  console.log("2. Get current price for auction");
  console.log("3. Buy from auction");
  console.log("4. Cancel auction");
  console.log("5. View auction details");
  console.log("0. Exit");

  // Get user choice
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  readline.question("\nSelect option: ", async (choice: string) => {
    readline.close();

    switch (choice) {
      case "1":
        await createAuction(wallet, auctionContract, tokenContract);
        break;
      case "2":
        await getCurrentPrice(auctionContract);
        break;
      case "3":
        await buyFromAuction(wallet, auctionContract);
        break;
      case "4":
        await cancelAuction(auctionContract);
        break;
      case "5":
        await viewAuctionDetails(auctionContract);
        break;
      case "0":
        console.log("Exiting...");
        process.exit(0);
      default:
        console.log("Invalid option selected");
        main();
    }
  });
}

async function createAuction(
  wallet: ethers.Wallet,
  auctionContract: ethers.Contract,
  tokenContract: ethers.Contract
) {
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n===== CREATE NEW AUCTION =====");

  // Get auction parameters
  const tokenAddress = await new Promise<string>((resolve) =>
    readline.question("Token address: ", resolve)
  );
  const initialPrice = await new Promise<string>((resolve) =>
    readline.question("Initial price (in wei): ", resolve)
  );
  const duration = await new Promise<string>((resolve) =>
    readline.question("Duration (in seconds): ", resolve)
  );
  const decayRate = await new Promise<string>((resolve) =>
    readline.question("Decay rate (price drop per second, in wei): ", resolve)
  );
  const amount = await new Promise<string>((resolve) =>
    readline.question("Token amount: ", resolve)
  );

  readline.close();

  try {
    // Approve tokens for transfer
    console.log("Approving tokens for auction contract...");
    const approvalTx = await tokenContract.approve(
      auctionContract.address,
      ethers.utils.parseUnits(amount, 18)
    );
    await approvalTx.wait();
    console.log(`Approval transaction confirmed: ${approvalTx.hash}`);

    // Create auction
    console.log("Creating auction...");
    const tx = await auctionContract.createAuction(
      tokenAddress,
      ethers.utils.parseUnits(initialPrice, 18),
      duration,
      ethers.utils.parseUnits(decayRate, 18),
      ethers.utils.parseUnits(amount, 18)
    );
    const receipt = await tx.wait();
    
    // Find auction created event
    const event = receipt.events?.find(
      (e: any) => e.event === "AuctionCreated"
    );
    const auctionId = event?.args?.auctionId.toString();
    
    console.log(`Auction created successfully! Auction ID: ${auctionId}`);
    console.log(`Transaction hash: ${tx.hash}`);
  } catch (error) {
    console.error("Error creating auction:", error);
  }

  setTimeout(() => main(), 1000);
}

async function getCurrentPrice(auctionContract: ethers.Contract) {
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const auctionId = await new Promise<string>((resolve) =>
    readline.question("Enter auction ID: ", resolve)
  );
  readline.close();

  try {
    const currentPrice = await auctionContract.getCurrentPrice(auctionId);
    console.log(
      `Current price: ${ethers.utils.formatEther(currentPrice)} ETH`
    );
  } catch (error) {
    console.error("Error getting current price:", error);
  }

  setTimeout(() => main(), 1000);
}

async function buyFromAuction(
  wallet: ethers.Wallet,
  auctionContract: ethers.Contract
) {
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const auctionId = await new Promise<string>((resolve) =>
    readline.question("Enter auction ID: ", resolve)
  );
  readline.close();

  try {
    // Get current price
    const currentPrice = await auctionContract.getCurrentPrice(auctionId);
    console.log(
      `Current price: ${ethers.utils.formatEther(currentPrice)} ETH`
    );

    // Confirm purchase
    const confirm = await new Promise<string>((resolve) => {
      const rl = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(
        `Confirm purchase at ${ethers.utils.formatEther(
          currentPrice
        )} ETH? (y/n): `,
        (answer: string) => {
          rl.close();
          resolve(answer);
        }
      );
    });

    if (confirm.toLowerCase() === "y") {
      console.log("Executing purchase...");
      const tx = await auctionContract.buy(auctionId, {
        value: currentPrice,
      });
      await tx.wait();
      console.log("Purchase successful!");
      console.log(`Transaction hash: ${tx.hash}`);
    } else {
      console.log("Purchase cancelled");
    }
  } catch (error) {
    console.error("Error buying from auction:", error);
  }

  setTimeout(() => main(), 1000);
}

async function cancelAuction(auctionContract: ethers.Contract) {
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const auctionId = await new Promise<string>((resolve) =>
    readline.question("Enter auction ID to cancel: ", resolve)
  );
  readline.close();

  try {
    console.log("Cancelling auction...");
    const tx = await auctionContract.cancelAuction(auctionId);
    await tx.wait();
    console.log("Auction cancelled successfully!");
    console.log(`Transaction hash: ${tx.hash}`);
  } catch (error) {
    console.error("Error cancelling auction:", error);
  }

  setTimeout(() => main(), 1000);
}

async function viewAuctionDetails(auctionContract: ethers.Contract) {
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const auctionId = await new Promise<string>((resolve) =>
    readline.question("Enter auction ID: ", resolve)
  );
  readline.close();

  try {
    const auction = await auctionContract.auctions(auctionId);
    console.log("\n===== AUCTION DETAILS =====");
    console.log(`Seller: ${auction.seller}`);
    console.log(`Token: ${auction.token}`);
    console.log(`Initial Price: ${ethers.utils.formatEther(auction.initialPrice)} ETH`);
    console.log(`Start Time: ${new Date(auction.startTime.toNumber() * 1000).toLocaleString()}`);
    console.log(`Duration: ${auction.duration.toString()} seconds`);
    console.log(`Decay Rate: ${ethers.utils.formatEther(auction.decayRate)} ETH/second`);
    console.log(`Amount: ${ethers.utils.formatEther(auction.amount)}`);
    console.log(`Active: ${auction.active}`);

    if (auction.active) {
      const currentPrice = await auctionContract.getCurrentPrice(auctionId);
      console.log(`Current Price: ${ethers.utils.formatEther(currentPrice)} ETH`);
      
      const now = Math.floor(Date.now() / 1000);
      const endTime = auction.startTime.toNumber() + auction.duration.toNumber();
      const timeRemaining = endTime - now;
      
      if (timeRemaining > 0) {
        console.log(`Time remaining: ${timeRemaining} seconds`);
      } else {
        console.log("Auction has ended");
      }
    }
  } catch (error) {
    console.error("Error getting auction details:", error);
  }

  setTimeout(() => main(), 1000);
}

// Run the script
main().catch((error) => {
  console.error(error);
  process.exit(1);
});