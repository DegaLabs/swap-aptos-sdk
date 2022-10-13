const UTILS = {
    getPoolTokenIds: async (walletClient, pool, collectibleSwap, poolAddress, limit, start) => {
        const depositCount = {};
        const tokenDepositForClaim = {};
        let eventStore = `${collectibleSwap}::pool::EventsStore<${pool.data.coinType}, ${pool.data.collectionCoinType}>`;
        const liquidityAddedEvents = await walletClient.getEventStream(poolAddress, eventStore, "liquidity_added_handle", limit, start);
        const liquidityRemovedEvents = await walletClient.getEventStream(poolAddress, eventStore, "liquidity_removed_handle", limit, start);
        const swapCoinToTokensEvents = await walletClient.getEventStream(poolAddress, eventStore, "swap_coin_to_tokens_handle", limit, start);
        const swapTokensToCoinEvents = await walletClient.getEventStream(poolAddress, eventStore, "swap_tokens_to_coin_handle", limit, start);
        const claimTokensEvents = await walletClient.getEventStream(poolAddress, eventStore, "claim_tokens_handle", limit, start);
        const processElement = function (element, store, push) {
            const elementString = JSON.stringify(element);
            if (push) {
                store[elementString] = store[elementString]
                    ? {
                        count: store[elementString].count + 1,
                        data: element
                    }
                    : {
                        count: 1,
                        data: element
                    };
            }
            else {
                store[elementString] = store[elementString]
                    ? {
                        count: store[elementString].count - 1,
                        data: element
                    }
                    : {
                        count: -1,
                        data: element
                    };
            }
        };
        liquidityAddedEvents.forEach((e) => {
            e.data.token_ids.forEach((element) => {
                processElement({ data: element }, depositCount, true);
            });
        });
        if (pool.data.pool_type == 0) {
            // tokens deposit for claim
            swapTokensToCoinEvents.forEach((e) => {
                e.data.token_ids.forEach((element) => {
                    processElement({ data: element }, tokenDepositForClaim, false);
                });
            });
        }
        else {
            // tokens transfer to pool
            swapTokensToCoinEvents.forEach((e) => {
                e.data.token_ids.forEach((element) => {
                    processElement({ data: element }, depositCount, true);
                });
            });
        }
        liquidityRemovedEvents.forEach((e) => {
            e.data.token_ids.forEach((element) => {
                processElement({ data: element }, depositCount, false);
            });
        });
        swapCoinToTokensEvents.forEach((e) => {
            e.data.token_ids.forEach((element) => {
                processElement({ data: element }, depositCount, false);
            });
        });
        claimTokensEvents.forEach((e) => {
            e.data.token_ids.forEach((element) => {
                processElement({ data: element }, tokenDepositForClaim, false);
            });
        });
        let inPool = Object.values(depositCount);
        let forClaim = Object.values(tokenDepositForClaim);
        inPool = inPool.filter((e) => e.count > 0);
        forClaim = forClaim.filter((e) => e.count > 0);
        return { tokenIds: inPool, tokenIdsForClaim: forClaim };
    }
};
module.exports = UTILS;
//# sourceMappingURL=utils.js.map