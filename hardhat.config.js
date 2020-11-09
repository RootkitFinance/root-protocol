require("@nomiclabs/hardhat-waffle");
require("hardhat-abi-exporter");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.7.4",
  networks: {
    hardhat: {
      accounts: {
        accountsBalance: "100000000000000000000000",
      },
    },
    ropsten: {
      url: "https://rinkeby.infura.io/v3/11c990cbd8d3486397e398470aaf124a",
      accounts: [
        "d4d5fac89a1f07527ebd5c1fd3b3b2bb1003c70dff3e449640606a8875721c9f",
        "0886587474d28516d9015a16ac4450ddcc56429bef09f7eb334f6c1f5bfde62f",
        "9ba0f385330ce1497d3175a5394bcce724eb789e0f25bfde39285a0f58420afd",
      ],
    },
  },
  abiExporter: {
    path: "./data/abi",
    clear: true,
    flat: true,
    //only: ['ERC20'],
  },
};
