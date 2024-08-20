import express from 'express';
import { ethers } from "ethers";
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const tokenAddress = process.env.TOKEN_ADDRESS;
const contractAddresses = [
  "0x7eaB1c8a3E722fe477e28C7CDc7F954A54Ea3213",
  "0x05b2607d070f9206eb595c0596fd78748751a8e7"
];

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

if (!ETHERSCAN_API_KEY) {
  console.error("ETHERSCAN_API_KEY is not set in the .env file");
  process.exit(1);
}

const provider = new ethers.EtherscanProvider("mainnet", ETHERSCAN_API_KEY);

const abi = [
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)"
];
if(!tokenAddress) {
  console.error("TOKEN_ADDRESS is not set in the .env file");
  process.exit(1);
}

const contract = new ethers.Contract(tokenAddress, abi, provider);

let lastCirculatingSupply: bigint | null = null;

async function calculateCirculatingSupply(): Promise<bigint> {
  try {
    const totalSupply = await contract.totalSupply();
    console.log(`Total Supply: ${totalSupply.toString()}`);

    const balances = await Promise.all(
      contractAddresses.map(async (address) => {
        try {
          const balance = await contract.balanceOf(address);
          console.log(`Balance of ${address}: ${balance.toString()}`);
          return BigInt(balance);
        } catch (error) {
          console.error(`Error fetching balance for ${address}:`, error);
          return 0n;
        }
      })
    );

    const totalLocked = balances.reduce((acc, balance) => acc + balance, 0n);

    const circulatingSupply = BigInt(totalSupply) - totalLocked;
    console.log(`Circulating Supply: ${circulatingSupply.toString()}`);
    
    lastCirculatingSupply = circulatingSupply;
    
    return circulatingSupply;
  } catch (error) {
    console.error("Error calculating circulating supply:", error);
    throw error;
  }
}

app.get('/', async (req, res) => {
  try {
    const circulatingSupply = await calculateCirculatingSupply();
    res.set('Content-Type', 'text/plain');
    res.send(circulatingSupply.toString());
  } catch (error) {
    console.error("Failed to calculate new circulating supply:", error);
    if (lastCirculatingSupply !== null) {
      console.log(`Returning last known circulating supply: ${lastCirculatingSupply.toString()}`);
      res.set('Content-Type', 'text/plain');
      res.send(lastCirculatingSupply.toString());
    } else {
      res.status(500).send('Error calculating circulating supply and no previous value available');
    }
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});