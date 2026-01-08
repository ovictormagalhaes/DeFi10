using DeFi10.API.Models;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Aggregation;

public interface ITokenFactory
{
    Token CreateSupplied(string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount, decimal unitPriceUsd);
    Token CreateBorrowed(string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount, decimal unitPriceUsd);
    Token CreateUncollectedReward(string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount, decimal unitPriceUsd);
    Token CreateCollectedFee(string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount, decimal unitPriceUsd);
    Token CreateStaked(string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount, decimal unitPriceUsd);
    Token CreateGovernancePower(string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount);
}