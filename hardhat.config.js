require("@nomiclabs/hardhat-waffle");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.7.4",
  networks: {
    hardhat: {
      accounts: {
        accountsBalance: "100000000000000000000000"
      },
      chainId: 1,
      gas: 1,
      gasPrice: 152525256960
    }
  }
};