const hre = require("hardhat");

async function main() {
  const Voting = await hre.ethers.getContractFactory("DecentralizedVoting");
  const voting = await Voting.deploy();

  await voting.waitForDeployment();

  console.log("-----------------------------------------------");
  console.log("Smart Contract deployed to:", await voting.getAddress());
  console.log("-----------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});