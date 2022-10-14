const Aptos = require('aptos')
const { mainModule } = require('process')
const { SHA3 } = require('sha3')
let AptosWeb3 = require('./dist/wallet_client')
const { TxnBuilderTypes, BCS, AptosClient, Types } = Aptos
const curves = require('./src/curves')
const utils = require('./src/utils')
const BN = require('bignumber.js').default
const axios = require('axios').default
function toUTF8Array(str) {
    var utf8 = [];
    for (var i = 0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
            utf8.push(0xc0 | (charcode >> 6),
                0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
            utf8.push(0xe0 | (charcode >> 12),
                0x80 | ((charcode >> 6) & 0x3f),
                0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
            i++;
            // UTF-16 encodes 0x10000-0x10FFFF by
            // subtracting 0x10000 and splitting the
            // 20 bits of 0x0-0xFFFFF into two halves
            charcode = 0x10000 + (((charcode & 0x3ff) << 10)
                | (str.charCodeAt(i) & 0x3ff));
            utf8.push(0xf0 | (charcode >> 18),
                0x80 | ((charcode >> 12) & 0x3f),
                0x80 | ((charcode >> 6) & 0x3f),
                0x80 | (charcode & 0x3f));
        }
    }
    return utf8;
}

class SDK {
    constructor(network, node_url, faucet_url, collectibleSwap, poolFee, protocolFee) {
        this.wallet = new AptosWeb3.WalletClient(node_url, faucet_url)
        this.collectibleSwap = collectibleSwap
        this.poolFee = poolFee ? poolFee : 125;
        this.protocolFee = protocolFee ? protocolFee : 25
        this.FEE_DIVISOR = 10000
        this.network = network
        this.pools = {}
        this.cacheStorage = {}
    }

    static async createInstance(network, node_url, faucet_url, collectibleSwap, updatePool = true) {
        let instance = new SDK(network, node_url, faucet_url, collectibleSwap)
        instance.readPools()
        await instance.getListedCollections()

        if (Object.keys(instance.pools).length == 0) {
            await instance.updatePools();
        } else {
            let pools = Object.values(instance.pools)
            await Promise.all(
                pools.map(async (p) => {
                    await instance.updatePoolTokens(p)
                })
            )
        }
        return instance
    }

    addPools(ps) {
        ps.forEach(p => this.commitPool(p))
    }

    initializeTxBuilder(sender) {
        this.remoteTxBuilder = new Aptos.TransactionBuilderRemoteABI(this.wallet.aptosClient, { sender: sender })
    }

    async updatePoolFromType(resourceType) {
        try {
            let pool = await this.wallet.aptosClient.getAccountResource(this.getPoolAddress(), resourceType)
            if (this.pools[pool.type]) {
                pool = this.pools[pool.type]
            } else {
                await this.refactorPool(pool)
            }
            this.pools[pool.type] = pool
            return pool
        } catch (e) {
            console.log('e', this.getPoolAddress(), e)
        }
        return null
    }

    async updatePools() {
        let poolAddress = this.getPoolAddress()
        let pools = await this.wallet.aptosClient.getAccountResources(poolAddress)
        let ret = pools.filter(p => p.type.startsWith(this.poolPrefix()))
        await Promise.all(
            ret.map(async (p) => {
                await this.refactorPool(p)
                this.pools[p.type] = p
                console.log(p.type)
            })
        )
        this.savePools()
    }

    getAptosAccount(mnemonicsOrPrivateKey) {
        if (mnemonicsOrPrivateKey.privateKey) {
            return AptosWeb3.WalletClient.getAccountFromPrivateKey(mnemonicsOrPrivateKey.privateKey)
        }
        return AptosWeb3.WalletClient.getAccountFromMnemonic(mnemonicsOrPrivateKey.mnemonics)
    }

    async getOwnedCollections(addr, limit, depositStart, withdrawStart) {
        let nfts = await this.wallet.getTokens(addr, limit, depositStart, withdrawStart)
        let collections = {}
        nfts.forEach(t => {
            let e = t.token
            if (!collections[e.collection]) {
                collections[e.collection] = []
            }
            collections[e.collection].push(e)
        })
        return collections
    }

    getPoolAddress() {
        let sender = this.collectibleSwap
        let seed = "collectibleswap_resource_account_seed"
        let senderSerialized = Aptos.BCS.bcsToBytes(Aptos.TxnBuilderTypes.AccountAddress.fromHex(sender))
        let seedSerialized = toUTF8Array(seed)
        let joined = [...senderSerialized, ...seedSerialized, ...[255]]

        const hash = new SHA3(256);

        hash.update(Buffer.from(joined));

        return hash.digest('hex')
    }

    poolPrefix() {
        return `${this.collectibleSwap}::pool::Pool<`
    }

    async getListedCollections() {
        if (this.listedCollections) {
            return this.listedCollections
        }
        let resourceType = `${this.collectibleSwap}::type_registry::TypeRegistry`
        let registryResource = await this.wallet.getAccountResource(this.collectibleSwap, resourceType)
        console.log(registryResource, this.collectibleSwap, resourceType)
        if (!registryResource) {
            this.listedCollections = {}
            return this.listedCollections
        }
        registryResource = registryResource.data
        let collectionList = registryResource.collection_list
        let collectionToCollectionCoinType = {}
        for (const c of collectionList) {
            let coinType = await this.wallet.getCustomResource(
                this.collectibleSwap,
                resourceType,
                "collection_to_cointype",
                `${this.collectibleSwap}::type_registry::CollectionCoinType`,
                "0x1::type_info::TypeInfo",
                c)
            let moduleName = Buffer.from(coinType.module_name.replace("0x", ""), "hex").toString("utf8")
            let structName = Buffer.from(coinType.struct_name.replace("0x", ""), "hex").toString("utf8")
            collectionToCollectionCoinType[JSON.stringify(c)] = `${coinType.account_address}::${moduleName}::${structName}`
        }
        this.listedCollections = collectionToCollectionCoinType
        return collectionToCollectionCoinType
    }

    getCollectionCoinType(collection, creator) {
        let key = {
            collection,
            creator
        }
        return this.listedCollections[JSON.stringify(key)]
    }

    getPool(collection, creator, coinType) {
        let poolTypes = Object.keys(this.pools)
        for (const pt of poolTypes) {
            let pool = this.pools[pt]
            if (pool && pool.data.collection == collection
                && pool.data.token_creator == creator
                && pool.data.coinType == coinType) {
                return pool
            }
        }

        return null
    }

    getPoolFromPoolType(poolType) {
        return this.pools[poolType]
    }

    getPoolsForCollection(collection, creator) {
        let collectionCoinType = this.getCollectionCoinType(collection, creator)

        const isGoodPool = function (p) {
            let type = p.type
            let splits = type.split(",")
            if (splits.length == 2) {
                let second = splits[1].trim()
                let ret = second.toLowerCase() == `${collectionCoinType}>`.toLowerCase()
                return ret
            }
            return false
        }
        return Object.values(this.pools).filter(p => isGoodPool(p))
    }

    getPoolsForCoinType(coinType) {
        return Object.values(this.pools).filter(p => p.data.coinType == coinType)
    }

    getPools() {
        return this.pools
    }

    async createNewPoolFunctionPayload(
        coinType,
        collection,
        tokenNames,
        tokenCreator,
        initialPrice,
        curveType,
        poolType,
        assetRecipient,
        delta,
        propertyVersion) {
        let collectionCoinType = this.getCollectionCoinType(collection, tokenCreator)
        let rawTransaction = await this.remoteTxBuilder.build(
            `${this.collectibleSwap}::pool::create_new_pool_script`,
            [coinType, collectionCoinType],
            [
                collection,
                tokenNames,
                tokenCreator,
                initialPrice,
                curveType,
                poolType,
                assetRecipient,
                delta,
                propertyVersion
            ]
        )

        return rawTransaction.payload
    }

    async createNewPool(
        aptosAccount,
        coinType,
        collection,
        tokenNames,
        tokenCreator,
        initialPrice,
        curveType,
        poolType,
        assetRecipient,
        delta,
        propertyVersion) {
        let payload = await this.createNewPoolFunctionPayload(coinType,
            collection,
            tokenNames,
            tokenCreator,
            initialPrice,
            curveType,
            poolType,
            assetRecipient,
            delta,
            propertyVersion)

        return submitTransaction(aptosAccount, payload)
    }

    async submitTransaction(aptosAccount, payload) {
        const txnRequest = await this.wallet.aptosClient.generateRawTransaction(
            aptosAccount.address(),
            payload
        );

        const signedTxn = await this.wallet.aptosClient.signTransaction(aptosAccount, txnRequest);
        const transactionRes = await this.wallet.aptosClient.submitTransaction(signedTxn);
        await this.wallet.aptosClient.waitForTransaction(transactionRes.hash);
        return transactionRes.hash
    }

    async submitTransactionWithAdaptor(signAndSubmitTransaction, payload) {
        await signAndSubmitTransaction(payload)
    }

    async refactorPool(p) {
        let type = p.type
        console.log('type', p.type)
        let splits = type.split(",")
        let prefix = this.poolPrefix()
        let coinType = splits[0].substring(prefix.length)
        p.data.coinType = coinType
        p.data.collectionCoinType = this.getCollectionCoinType(p.data.collection, p.data.token_creator)
        //get coin decimals
        let coinData = await this.wallet.getCoinData(coinType)
        p.data.coinInfo = {
            decimals: coinData.data.decimals,
            name: coinData.data.name,
            symbol: coinData.data.symbol
        }
        let lpCoinData = await this.wallet.getCoinData(
            `0x${this.getPoolAddress()}::liquidity_coin::LiquidityCoin<${coinType}, ${p.data.collectionCoinType}>`
        )
        p.data.lpInfo = lpCoinData.data
        p.data.lpInfo.supply = parseInt(p.data.lpInfo.supply.vec[0].integer.vec[0].value)

        p.data.tokens = {}
        p.data.tokensForClaim = {}
        p.data.reserve = p.data.reserve.value
        await this.updatePoolTokens(p)
    }

    async getPoolTokenIds(p) {
        return await utils.getPoolTokenIds(this.wallet, p, this.collectibleSwap, this.getPoolAddress())
    }

    async updatePoolTokens(p) {
        try {
            if (p.updatingInProgress) {
                return
            }
            p.updatingInProgress = true
            let now = Math.floor(Date.now() / 1000)

            let start = Date.now()
            let { tokenIds, tokenIdsForClaim } = await utils.getPoolTokenIds(this.wallet, p, this.collectibleSwap, this.getPoolAddress())

            let remainingTokenIdObjects = []

            tokenIds.forEach(tokenIdObject => {
                let tokenId = JSON.stringify(tokenIdObject.data)
                let count = tokenIdObject.count
                if (p.data.tokens[tokenId]) {
                    p.data.tokens[tokenId].count += count
                } else {
                    remainingTokenIdObjects.push(tokenIdObject)
                }
            })

            const func1 = async () => {
                let tokens = await this.wallet.getTokensFromTokenIdsWithCount(remainingTokenIdObjects)
                tokens.forEach(e => {
                    p.data.tokens[JSON.stringify(e.tokenId)] = e
                })
            }

            let remainingTokenIdObjectsForClaim = []

            tokenIdsForClaim.forEach(tokenIdObject => {
                let tokenId = JSON.stringify(tokenIdObject.data)
                let count = tokenIdObject.count
                console.log('tokenIdsForClaim', tokenId)

                if (p.data.tokensForClaim[tokenId]) {
                    p.data.tokensForClaim[tokenId].count += count
                } else {
                    remainingTokenIdObjectsForClaim.push(tokenIdObject)
                }
            })

            const func2 = async () => {
                let tokens = await this.wallet.getTokensFromTokenIdsWithCount(remainingTokenIdObjectsForClaim)
                tokens.forEach(e => {
                    p.data.tokensForClaim[JSON.stringify(e.tokenId)] = e
                })
            }
            await Promise.all([func1(), func2()])
            p.lastUpdate = now

            let end = Date.now()
            console.log("elapesed", end - start)
            start = end
            p.updatingInProgress = false
            this.savePool(p)
        } catch (e) {

        }
        p.updatingInProgress = false
    }

    getBuyInfo(collection, creator, coinType, numItems) {
        let pool = this.getPool(collection, creator, coinType)
        if (pool) {
            let errorCode = 0
            let newSpotPrice = parseInt(pool.data.spot_price)
            let newDelta = parseInt(pool.data.delta)
            let inputValue = 0
            let subInputValue = 0
            let protocolFee = 0
            let subProtocolFee = 0
            let tradeFee = 0
            let subTradeFee = 0
            let currentTokenCountInPool = 0
            let unrealizedFee = pool.data.unrealized_fee
            Object.values(pool.data.tokens).forEach(e => {
                currentTokenCountInPool += e.count
            })

            let i = 0;
            while (i < numItems) {
                [errorCode, newSpotPrice, newDelta, subInputValue, subProtocolFee, subTradeFee] = curves.getBuyInfo(pool.data.curve_type, newSpotPrice, newDelta, 1, parseInt(this.poolFee), this.protocolFee)
                tradeFee = parseInt(tradeFee) + parseInt(subTradeFee)
                protocolFee = parseInt(protocolFee) + parseInt(subProtocolFee)
                inputValue = parseInt(inputValue) + parseInt(subInputValue)
                let priceIncrease = Math.floor((parseInt(subTradeFee) + parseInt(unrealizedFee)) / (currentTokenCountInPool - (i + 1)))
                unrealizedFee = (parseInt(subTradeFee) + parseInt(unrealizedFee)) - (currentTokenCountInPool - (i + 1)) * priceIncrease;
                newSpotPrice = parseInt(newSpotPrice) + priceIncrease;
                i = i + 1
            }
            return { errorCode, newSpotPrice, newDelta, inputValue, protocolFee, tradeFee, unrealizedFee }
        }
        return null
    }

    getSellInfo(collection, creator, coinType, numItems) {
        let pool = this.getPool(collection, creator, coinType)
        if (pool) {
            let errorCode = 0
            let newSpotPrice = pool.data.spot_price
            let newDelta = pool.data.delta
            let inputValue = 0
            let subInputValue = 0
            let protocolFee = 0
            let subProtocolFee = 0
            let tradeFee = 0
            let subTradeFee = 0
            let currentTokenCountInPool = 0
            let unrealizedFee = pool.data.unrealized_fee
            Object.values(pool.data.tokens).forEach(e => {
                currentTokenCountInPool += e.count
            })

            let i = 0;
            while (i < numItems) {
                [errorCode, newSpotPrice, newDelta, subInputValue, subProtocolFee, subTradeFee] = curves.getSellInfo(pool.data.curve_type, newSpotPrice, newDelta, 1, parseInt(this.poolFee), this.protocolFee)

                tradeFee = parseInt(tradeFee) + parseInt(subTradeFee)
                protocolFee = parseInt(protocolFee) + parseInt(subProtocolFee)
                inputValue = parseInt(inputValue) + parseInt(subInputValue)
                let priceIncrease = Math.floor((parseInt(subTradeFee) + parseInt(unrealizedFee)) / (currentTokenCountInPool - (i + 1)))
                unrealizedFee = (parseInt(subTradeFee) + parseInt(unrealizedFee)) - (currentTokenCountInPool - (i + 1)) * priceIncrease;
                newSpotPrice = parseInt(newSpotPrice) + priceIncrease;
                i = i + 1
            }
            return { errorCode, newSpotPrice, newDelta, inputValue, protocolFee, tradeFee, unrealizedFee }
        }
        return null
    }

    async createBuyNFTsFunctionPayload(
        collection, tokenCreator, names, propertyVersion, coinType, slippage
    ) {
        let collectionCoinType = this.getCollectionCoinType(collection, tokenCreator)
        let { inputValue } = this.getBuyInfo(collection, tokenCreator, coinType, names.length)
        let rawTransaction = await this.remoteTxBuilder.build(
            `${this.collectibleSwap}::pool::swap_coin_to_specific_tokens_script`,
            [coinType, collectionCoinType],
            [
                names,
                propertyVersion,
                Math.round(inputValue * (1000 + slippage) / 1000)
            ]
        )

        return rawTransaction.payload
    }

    async createSellNFTsFunctionPayload(
        collection, tokenCreator, names, propertyVersion, coinType, slippage
    ) {
        let collectionCoinType = this.getCollectionCoinType(collection, tokenCreator)
        let { inputValue } = this.getSellInfo(collection, tokenCreator, coinType, names.length)
        let rawTransaction = await this.remoteTxBuilder.build(
            `${this.collectibleSwap}::pool::swap_tokens_to_coin_script`,
            [coinType, collectionCoinType],
            [
                names,
                Math.floor(inputValue * (1000 - slippage) / 1000),
                propertyVersion
            ]
        )

        return rawTransaction.payload
    }

    async buyNFTs(aptosAccount, collection, creator, names, propertyVersion, coinType, slippage) {
        let payload = await this.createBuyNFTsFunctionPayload(collection, creator, names, propertyVersion, coinType, slippage)
        return await this.submitTransaction(aptosAccount, payload)
    }

    async sellNFTs(aptosAccount, collection, creator, names, propertyVersion, coinType, slippage) {
        let payload = await this.createSellNFTsFunctionPayload(collection, creator, names, propertyVersion, coinType, slippage)
        return await this.submitTransaction(aptosAccount, payload)
    }

    async createAddLiquidityFunctionPayload(
        coinType,
        collection,
        tokenNames,
        tokenCreator,
        propertyVersion,
        maxCoinAmount) {
        let collectionCoinType = this.getCollectionCoinType(collection, tokenCreator)
        let rawTransaction = await this.remoteTxBuilder.build(
            `${this.collectibleSwap}::pool::add_liquidity_script`,
            [coinType, collectionCoinType],
            [
                maxCoinAmount,
                tokenNames,
                propertyVersion
            ]
        )

        return rawTransaction.payload
    }

    async createRemoveLiquidityFunctionPayload(
        coinType,
        collection,
        tokenCreator,
        lpAmount,
        minCoinAmount, minNFTs) {
        let collectionCoinType = this.getCollectionCoinType(collection, tokenCreator)
        let rawTransaction = await this.remoteTxBuilder.build(
            `${this.collectibleSwap}::pool::remove_liquidity_script`,
            [coinType, collectionCoinType],
            [
                minCoinAmount,
                minNFTs,
                lpAmount
            ]
        )

        return rawTransaction.payload
    }

    getPoolTokenCount(pool) {
        let currentTokenCountInPool = 0
        Object.values(pool.data.tokens).forEach(e => {
            currentTokenCountInPool += e.count
        })
        return currentTokenCountInPool
    }

    async addLiquidity(aptosAccount,
        coinType,
        collection,
        tokenNames,
        tokenCreator,
        propertyVersion,
        maxCoinAmount) {
        let payload = await this.createAddLiquidityFunctionPayload(coinType,
            collection,
            tokenNames,
            tokenCreator,
            propertyVersion,
            maxCoinAmount)
        return await this.submitTransaction(aptosAccount, payload)
    }

    estimateLiquidityAddition(coinType, collection, tokenCreator, numItems) {
        let pool = this.getPool(collection, tokenCreator, coinType)
        return numItems * parseInt(pool.data.spot_price)
    }

    async removeLiquidity(
        aptosAccount,
        coinType,
        collection,
        tokenCreator,
        lpAmount,
        minCoinAmount,
        numItems) {
        let payload = await this.createRemoveLiquidityFunctionPayload(
            coinType,
            collection,
            tokenCreator,
            lpAmount, minCoinAmount, numItems)
        return await this.submitTransaction(aptosAccount, payload)
    }

    estimateLiquidityRemoval(coinType, collection, tokenCreator, lpAmount) {
        let pool = this.getPool(collection, tokenCreator, coinType)
        let lpSupply = pool.data.lpInfo.supply
        let spotPrice = parseInt(pool.data.spot_price)
        let tokenCount = this.getPoolTokenCount(pool)

        let numItems = lpAmount / lpSupply * tokenCount
        let coinAmount = parseInt(BN(lpAmount).multipliedBy(tokenCount).multipliedBy(spotPrice).dividedBy(lpSupply).toFixed(0))
        console.log(lpSupply, spotPrice, tokenCount, numItems, coinAmount)
        if (numItems != parseInt(numItems)) {
            numItems = parseInt(numItems) + 1
            let reducedValue = numItems * spotPrice - coinAmount
            coinAmount -= reducedValue
        }
        return { numItems, coinAmount }
    }

    async automatePoolsUpdate(period = 20, cb) {
        Object.values(this.pools).forEach(p => {
            this.automatePoolUpdate(p, period, cb)
        })
    }

    async automatePoolUpdate(p, period = 20, cb) {
        if (p.automatePoolUpdateEnabled) {
            return
        }
        p.automatePoolUpdateEnabled = true
        this.loopUpdatePool(p, period)
    }

    async loopUpdatePool(p, period) {
        console.log('execiting')
        await this.updatePoolTokens(p)
        setTimeout(() => {
            this.loopUpdatePool(p, period)
        }, period * 1000)
    }

    isInBrowser() {
        return typeof window !== 'undefined'
    }

    saveData(key, value) {
        if (this.isInBrowser()) {
            window.localStorage.setItem(`${this.network}-${key}`, value)
        } else {
            this.cacheStorage[`${this.network}-${key}`] = value
        }
    }

    savePool(p) {
        this.saveData(`pool-${p.type}`, JSON.stringify(p))
    }

    commitPool(p) {
        this.pools[p.type] = p
        this.savePool(p)
    }

    savePools() {
        Object.values(this.pools).forEach(e => this.savePool(e))
    }

    readPools() {
        let objects = this.isInBrowser() ? Object.entries(window.localStorage) : Object.entries(this.cacheStorage)
        let pools = objects
            .filter(([k, v]) => k.startsWith(`${this.network}-pool-`))
            .map(e => JSON.parse(e[1]))
        pools.forEach(p => {
            this.pools[p.type] = p
        })
        console.log("found", pools.length, "from local")
        return this.pools
    }

    getData(key) {
        if (this.isInBrowser()) {
            return window.localStorage.getItem(`${this.network}-${key}`)
        } else {
            return this.cacheStorage[`${this.network}-${key}`]
        }
        return null
    }

    async checkForNewPools() {
        let poolCreatedEventStart = this.getData(`poolCreatedEventStart`)
        poolCreatedEventStart = poolCreatedEventStart ? parseInt(poolCreatedEventStart) : 0

        let eventStore = `${this.collectibleSwap}::pool::NewPoolEventStore`

        console.log('poolCreatedEventStart', poolCreatedEventStart)

        const poolCreatedEvents = await this.wallet.getEventStream(
            this.getPoolAddress(),
            eventStore,
            "pool_created_handle",
            null,
            poolCreatedEventStart
        );
        poolCreatedEventStart += poolCreatedEvents.length

        let resourceTypes = []

        for (const e of poolCreatedEvents) {
            //create simple pool
            let coinTypeInfo = e.data.coin_type_info
            let moduleName = Buffer.from(coinTypeInfo.module_name.replace("0x", ""), "hex").toString("utf8")
            let structName = Buffer.from(coinTypeInfo.struct_name.replace("0x", ""), "hex").toString("utf8")
            let coinType = `${coinTypeInfo.account_address}::${moduleName}::${structName}`

            let collectionCoinTypeInfo = e.data.collection_coin_type_info
            moduleName = Buffer.from(collectionCoinTypeInfo.module_name.replace("0x", ""), "hex").toString("utf8")
            structName = Buffer.from(collectionCoinTypeInfo.struct_name.replace("0x", ""), "hex").toString("utf8")
            let collectionCoinType = `${collectionCoinTypeInfo.account_address}::${moduleName}::${structName}`

            let resourceType = `0x${this.collectibleSwap.replace("0x", "")}::pool::Pool<${coinType}, ${collectionCoinType}>`
            resourceTypes.push(resourceType)
        }

        console.log('resourceTypes', resourceTypes)

        await Promise.all(
            resourceTypes.map(async (resourceType) => {
                console.log('updating', resourceType)
                let pool = await this.updatePoolFromType(resourceType)
                if (pool) {
                    this.automatePoolUpdate(pool)
                }
            })
        )

        this.saveData(`poolCreatedEventStart`, poolCreatedEventStart)
        setTimeout(() => {
            this.checkForNewPools()
        }, 20 * 1000)
    }
}


module.exports = SDK