require("@nomiclabs/hardhat-waffle");
require("hardhat-abi-exporter");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.7.4",
  defaultNetwork: "rinkeby",
  networks: {
    hardhat: {
      accounts: {
        accountsBalance: "100000000000000000000000",
      },
    },
    ganache: {
      url: "http://localhost:8545",
      accounts: {
        mnemonic: "",
      },
      blockGasLimit: 120000000000,
    },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/11c990cbd8d3486397e398470aaf124a",
      accounts: {
        mnemonic: "",
      },
      //gas: 120000000000,
      blockGasLimit: 120000000000,
      //gasPrice: 10,
    },
  },
  abiExporter: {
    path: "./data/abi",
    clear: true,
    flat: true,
    //only: ['ERC20'],
  },
};
