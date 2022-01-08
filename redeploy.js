// 1. In the REMIX compile 
//      RootkitTransferGate, 
//      Vault,
//      Arbitrage
//      ITokensRecoverable
//      IERC20
//      IERC31337
// 2. Right click on the script name and hit "Run" to execute
(async () => {
    try {
        console.log('Running deploy script...')

        const deployer = "0x804CC8D469483d202c69752ce0304F71ae14ABdf";
        const router = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d";
        const baseToken = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
        const eliteToken = "0x93747501F46Ae40b8A4B8F1a1529696AE24ea04e";
        const rootedToken = "0xCb5f72d37685C3D5aD0bB5F982443BC8FcdF570E";
        const basePool = "0x01f8989c1e556f5c89c7D46786dB98eEAAe82c33";
        const elitePool = "0x44EE37ba8c98493F2590811c197Ddd474C911D46";
        const transferGate = "0x105E66f0bfD5b3b1E386D0dC6EC00F3342EF3fF6";
        const calculator = "0xA12C55637E642C0e79C5923125cd7eeb8be3a53F";
        const oldVault = "0xDE2F4d32b713aDaE849F8A221bf2ed54c262B7c6";
        const oldArbitrage = "0x908756371035f31C40E15e5Fe678bBbF4329FFe8";
        const bot = "0x439Fd1FDfF5D1c46F67220c7C38d04F366372332";

        const signer = (new ethers.providers.Web3Provider(web3Provider)).getSigner();
        
        //=======================================================================================
        //                                          DEPLOY
        //=======================================================================================

        // Vault
        const vaultMetadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/Vault.json`));    
        const vaultFactory = new ethers.ContractFactory(vaultMetadata.abi, vaultMetadata.data.bytecode.object, signer);
        const vaultContract = await vaultFactory.deploy(baseToken, eliteToken, rootedToken, calculator, transferGate, router);

        console.log(`Vault: ${vaultContract.address}`);
        await vaultContract.deployed();
        console.log('Vault deployed.');

        // Arbitrage
        const arbitrageMetadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/Arbitrage.json`));    
        const arbitrageFactory = new ethers.ContractFactory(arbitrageMetadata.abi, arbitrageMetadata.data.bytecode.object, signer);
        const arbitrageContract = await arbitrageFactory.deploy(baseToken, eliteToken, rootedToken, router);

        console.log(`Arbitrage: ${arbitrageContract.address}`);
        await arbitrageContract.deployed();
        console.log('Arbitrage deployed.');

        //=======================================================================================
        //                                          CONFIG
        //=======================================================================================

        let txResponse = await vaultContract.setupPools();
        await txResponse.wait();
        console.log('setupPools is called in the Vault');
        txResponse = await vaultContract.setSeniorVaultManager(deployer, true);
        await txResponse.wait();
        console.log('deployer is SeniorVaultManager');

        const transferGateMetadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/RootKitTransferGate.json`));
        const transferGateFactory = new ethers.ContractFactory(transferGateMetadata.abi, transferGateMetadata.data.bytecode.object, signer);  
        const transferGateContract = await transferGateFactory.attach(transferGate);
      
        txResponse = await transferGateContract.setUnrestrictedController(vaultContract.address, true);
        await txResponse.wait();
        console.log('Vault is UnrestrictedController in the gate.');

        txResponse = await transferGateContract.setUnrestrictedController(arbitrageContract.address, true);
        await txResponse.wait();
        console.log('Arbitrage is UnrestrictedController in the gate.');

        txResponse = await transferGateContract.setFeeControllers(vaultContract.address, true);
        await txResponse.wait();
        console.log('Vault is fee controller in the gate.');

        txResponse = await transferGateContract.setFreeParticipant(vaultContract.address, true);
        await txResponse.wait();
        txResponse = await transferGateContract.setFreeParticipant(arbitrageContract.address, true);
        await txResponse.wait();
        console.log('Vault and Arbitrage are Free Participants in the gate.');

        txResponse = await arbitrageContract.setArbitrageur(bot, true);
        await txResponse.wait();
        console.log('Bot is set in arbitrage');

        const eliteMetadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/IERC31337.json`));
        const eliteFactory = new ethers.ContractFactory(eliteMetadata.abi, eliteMetadata.data.bytecode.object, signer);  
        const eliteContract = await eliteFactory.attach(eliteToken);

        txResponse = await eliteContract.setSweeper(vaultContract.address, true);
        await txResponse.wait();
        console.log('Vault is sweeper');

        //=======================================================================================
        //                                      RECOVER TOKENS
        //=======================================================================================

        const tokensRecoverableMetadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/ITokensRecoverable.json`));
        const tokensRecoverableFactory = new ethers.ContractFactory(tokensRecoverableMetadata.abi, tokensRecoverableMetadata.data.bytecode.object, signer);  
        const oldVaultContract = await tokensRecoverableFactory.attach(oldVault);        
        const erc20Metadata = JSON.parse(await remix.call('fileManager', 'getFile', `browser/artifacts/IERC20.json`));
        const erc20Factory = new ethers.ContractFactory(erc20Metadata.abi, erc20Metadata.data.bytecode.object, signer);  
        
        // Recovering Base from Vault
        let baseContract = await erc20Factory.attach(baseToken);
        txResponse = await oldVaultContract.recoverTokens(baseToken);
        await txResponse.wait();
        let recovered = await baseContract.balanceOf(deployer);
        await baseContract.transfer(vaultContract.address, recovered);
        console.log(`${ethers.utils.formatEther(recovered)} Base tokens recovered and sent to the new vault`);

        // Recovering Elite from Vault
        txResponse = await oldVaultContract.recoverTokens(eliteToken);
        await txResponse.wait();
        recovered = await eliteContract.balanceOf(deployer);
        txResponse = await eliteContract.transfer(vaultContract.address, recovered);
        await txResponse.wait();
        console.log(`${ethers.utils.formatEther(recovered)} Elite tokens recovered and sent to the new vault`);

        // Recovering Rooted from Vault
        let rootedContract = await erc20Factory.attach(rootedToken);
        let balanceBefore = await rootedContract.balanceOf(deployer);
        txResponse = await oldVaultContract.recoverTokens(rootedToken);
        await txResponse.wait();
        let balanceAfter = await rootedContract.balanceOf(deployer);
        recovered = balanceAfter.sub(balanceBefore);
        txResponse = await rootedContract.transfer(vaultContract.address, recovered);
        await txResponse.wait();
        console.log(`${ethers.utils.formatEther(recovered)} Rooted tokens recovered and sent to the new vault`);

        // Recovering Base Pool LPs from Vault
        const basePoolContract = await erc20Factory.attach(basePool);
        txResponse = await oldVaultContract.recoverTokens(basePool);
        await txResponse.wait();
        recovered = await basePoolContract.balanceOf(deployer);        
        txResponse = await basePoolContract.transfer(vaultContract.address, recovered);
        await txResponse.wait();
        console.log(`${ethers.utils.formatEther(recovered)} Base Pool LPs recovered and sent to the new vault`);

        // Recovering Elite Pool LPs from Vault
        const elitePoolContract = await erc20Factory.attach(elitePool);
        txResponse = await oldVaultContract.recoverTokens(elitePool);
        await txResponse.wait();
        recovered = await elitePoolContract.balanceOf(deployer);
        txResponse = await elitePoolContract.transfer(vaultContract.address, recovered);
        await txResponse.wait();
        console.log(`${ethers.utils.formatEther(recovered)} Elite Pool LPs recovered and sent to the new vault`);

        // Recovering Base from Arbitrage
        const oldArbitrageContract = await tokensRecoverableFactory.attach(oldArbitrage);
        baseContract = await erc20Factory.attach(baseToken);
        balanceBefore = await baseContract.balanceOf(deployer);
        txResponse = await oldArbitrageContract.recoverTokens(baseToken);
        await txResponse.wait();
        balanceAfter = await baseContract.balanceOf(deployer);
        recovered = balanceAfter.sub(balanceBefore);
        await baseContract.transfer(arbitrageContract.address, recovered);
        console.log(`${ethers.utils.formatEther(recovered)} Base tokens recovered and sent to the new arbitrage`);

        console.log('Done!');
    } 
    catch (e) {
        console.log(e)
    }
})()