const BN = require('bignumber.js').default;
const FEE_DIVISOR = 10000;
const MIN_PRICE = 1;
// ret = base_unit * (x/base_unit) ^ n
function fpow(x, n, baseUnit) {
    let z = BN(0);
    n = parseInt(n);
    if (z.comparedTo(x) == 0) {
        if (n == 0) {
            z = BN(baseUnit);
        }
    }
    else {
        z = BN(baseUnit);
        let i = 0;
        while (i < n) {
            z = z.multipliedBy(x);
            z = z.dividedBy(baseUnit);
            i = i + 1;
        }
    }
    return z;
}
module.exports = {
    validateDelta: function (delta) {
        return delta >= FEE_DIVISOR;
    },
    validateSpotPrice: function (spotPrice) {
        return spotPrice > MIN_PRICE;
    },
    getBuyInfo: function (spot_price, delta, num_items, fee_multiplier, protocol_fee_multiplier) {
        if (num_items == 0) {
            return (1, 0, 0, 0, 0, 0);
        }
        let delta_pow_n = fpow(BN(delta), num_items, BN(FEE_DIVISOR));
        let new_spot_price = BN(spot_price).multipliedBy(delta_pow_n).dividedBy(FEE_DIVISOR);
        let buy_spot_price = BN(spot_price).multipliedBy(delta).dividedBy(FEE_DIVISOR);
        let input_value = buy_spot_price.multipliedBy(BN(delta_pow_n).minus(FEE_DIVISOR).multipliedBy(FEE_DIVISOR).dividedBy(delta - FEE_DIVISOR)).dividedBy(FEE_DIVISOR);
        let total_fee = input_value.multipliedBy(protocol_fee_multiplier + fee_multiplier).dividedBy(FEE_DIVISOR);
        let trade_fee = input_value.multipliedBy(fee_multiplier).dividedBy(FEE_DIVISOR);
        let protocol_fee = total_fee.minus(trade_fee);
        input_value = input_value.plus(trade_fee);
        input_value = input_value.plus(protocol_fee);
        let new_delta = delta;
        return [0, new_spot_price.toFixed(0), new_delta, input_value.toFixed(0), protocol_fee.toFixed(0), trade_fee.toFixed(0)];
    },
    getSellInfo: function (spot_price, delta, num_items_sell, fee_multiplier, protocol_fee_multiplier) {
        if (num_items_sell == 0) {
            return (1, 0, 0, 0, 0, 0);
        }
        let inv_delta = (BN(FEE_DIVISOR).multipliedBy(FEE_DIVISOR)).dividedBy(delta);
        let inv_delta_pow_n = fpow(inv_delta, num_items_sell, BN(FEE_DIVISOR));
        let new_spot_price = (BN(spot_price).multipliedBy(inv_delta_pow_n)).dividedBy(FEE_DIVISOR);
        if (new_spot_price.comparedTo(MIN_PRICE) < 0) {
            new_spot_price = BN(MIN_PRICE);
        }
        ;
        let output_value = BN(spot_price).multipliedBy(BN(FEE_DIVISOR).minus(inv_delta_pow_n).multipliedBy(FEE_DIVISOR).dividedBy(BN(FEE_DIVISOR).minus(inv_delta))).dividedBy(FEE_DIVISOR);
        let total_fee = output_value.multipliedBy(protocol_fee_multiplier + fee_multiplier).dividedBy(FEE_DIVISOR);
        let trade_fee = output_value.multipliedBy(fee_multiplier).dividedBy(FEE_DIVISOR);
        let protocol_fee = total_fee.minus(trade_fee);
        output_value = output_value.minus(trade_fee);
        output_value = output_value.minus(protocol_fee);
        return [0, new_spot_price.toFixed(0), delta, output_value.toFixed(0), protocol_fee.toFixed(0), trade_fee.toFixed(0)];
    }
};
//# sourceMappingURL=exponential.js.map