// 1. Double check addresses
// 2. In the REMIX compile IOwned
// 3. Right click on the script name and hit "Run" to execute
(async () => {
	try {
		const newOwner = "0x50A73495b844195D510D41509D50F195bCfa371C";
		const arbitrage = "0xcf53281777CeBcD2D2646E12Ca9e8fAeA0e1a3aF";
		const calculator = "0xA12C55637E642C0e79C5923125cd7eeb8be3a53F";
		const elite = "0x93747501F46Ae40b8A4B8F1a1529696AE24ea04e";
		const rooted = "0xCb5f72d37685C3D5aD0bB5F982443BC8FcdF570E"
		const singleSideLiquidityAdder = "0x75013Cbfc60fda02c7B18cD1066d7B6C46970D25"
		const stakingToken = "0x39E9fB78b543748950827BF4c606F58724b67a80"
		const transferGate = "0x105E66f0bfD5b3b1E386D0dC6EC00F3342EF3fF6";
		const vault = "0xc547D2bc0C3606602a4C9A530BFadDBc07A7f06F";

		const signer = (new ethers.providers.Web3Provider(web3Provider)).getSigner();

		const ownedMetadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/IOwned.json`));
		const ownedFactory = new ethers.ContractFactory(ownedMetadata.abi, ownedMetadata.data.bytecode.object, signer);
		const owned = [
			arbitrage,
			calculator,
			elite,
			rooted,
			singleSideLiquidityAdder,
			stakingToken,
			transferGate,
			vault
		];

		const arbitrageContract = await ownedFactory.attach(arbitrage);
		const gas = await arbitrageContract.estimateGas.transferOwnership(newOwner);
		const increasedGas = gas.toNumber() * 1.5;

		for (var i = 0; i < owned.length; i++) {
			const contract = await ownedFactory.attach(owned[i]);
			contract.transferOwnership(newOwner, { gasLimit: increasedGas });
		}

		console.log('Done!');
	}
	catch (e) {
		console.log(e)
	}
})()