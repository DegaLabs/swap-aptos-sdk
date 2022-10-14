let SDK = require('../index')

async function main() {
    let collectibleSwap = "0xd39111acba9f96a14150674b359d564e566f8057143a0593723fe753fc67c3b2"
    const NODE_URL = "https://fullnode.devnet.aptoslabs.com";
    const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";
    let sdk = await SDK.createInstance("devnet", NODE_URL, FAUCET_URL, collectibleSwap)
    //let nfts = await sdk.getNFTs("0xad73baea5ef67a1b52352ee2f781a132cfe6b9bdec544a5b55ef1b4557bfc5fd")
    //console.log(nfts)
    // let pools = await sdk.getOwnedCollections("0xad73baea5ef67a1b52352ee2f781a132cfe6b9bdec544a5b55ef1b4557bfc5fd")
    //console.log(pools[0].data.tokens.head, pools[0].data.tokens.tail)
    //console.log(pools["CloneX"])
    let pools = Object.values(sdk.getPools())
    // // let buyInfo = sdk.getSellInfo("CloneX", "0xad73baea5ef67a1b52352ee2f781a132cfe6b9bdec544a5b55ef1b4557bfc5fd",
    // //                             pools[0].data.coinType, 5)
    // console.log(pools[0]) 
    // console.log(pools[0].data.spot_price, pools[0].data.reserve)
    await sdk.checkForNewPools()
    //updating pools
    sdk.automatePoolsUpdate()
    setInterval(() => {
        console.log('last update', pools[0].lastUpdate, sdk.getPoolTokenCount(pools[0]))
    }, 10000)
    // process.exit(0)
}

main()