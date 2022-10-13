const linear = require("./linear")
const exponential = require("./exponential")
const LINEAR = 0
const EXPONENTIAL = 1

module.exports = {
    validateDelta: function(curveType, delta) {
        if (curveType == LINEAR) {
            return linear.validateDelta(delta)
        }
        return exponential.validateDelta(delta)
    },
    validateSpotPrice: function(curveType, spotPrice) {
        if (curveType == LINEAR) {
            return linear.validateSpotPrice(spotPrice)
        }
        return exponential.validateSpotPrice(spotPrice)
    },
    getBuyInfo: function (curveType, spot_price, delta, num_items, fee_multiplier, protocol_fee_multiplier) {
        if (curveType == LINEAR) {
            return linear.getBuyInfo(spot_price, delta, num_items, fee_multiplier, protocol_fee_multiplier)
        }
        return exponential.getBuyInfo(spot_price, delta, num_items, fee_multiplier, protocol_fee_multiplier)
    },
    getSellInfo: function (curveType, spot_price, delta, num_items_sell, fee_multiplier, protocol_fee_multiplier) {
        if (curveType == LINEAR) {
            return linear.getSellInfo(spot_price, delta, num_items_sell, fee_multiplier, protocol_fee_multiplier)
        }
        return exponential.getSellInfo(spot_price, delta, num_items_sell, fee_multiplier, protocol_fee_multiplier)
    }
}