using MyWebWallet.API.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Aggregation;

public interface ITokenFactory
{
    Token CreateSupplied(string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount, decimal unitPriceUsd);
    Token CreateBorrowed(string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount, decimal unitPriceUsd);
    Token CreateUncollectedReward(string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount, decimal unitPriceUsd);
}

public sealed class TokenFactory : ITokenFactory
{
    public Token CreateSupplied(string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount, decimal unitPriceUsd)
        => Build(TokenType.Supplied, name, symbol, contract, chain, decimals, formattedAmount, unitPriceUsd);

    public Token CreateBorrowed(string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount, decimal unitPriceUsd)
        => Build(TokenType.Borrowed, name, symbol, contract, chain, decimals, formattedAmount, unitPriceUsd);

    public Token CreateUncollectedReward(string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount, decimal unitPriceUsd)
        => Build(TokenType.LiquidityUncollectedFee, name, symbol, contract, chain, decimals, formattedAmount, unitPriceUsd);

    private static Token Build(TokenType type, string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount, decimal unitPriceUsd)
    {
        if (decimals < 0) decimals = 0; if (decimals > 28) decimals = 28; // safety bounds
        var rawAmount = formattedAmount * TokenFinancials.DecimalPow10(decimals);
        var totalPrice = unitPriceUsd * formattedAmount;
        return new Token
        {
            Type = type,
            Name = name,
            Symbol = symbol,
            ContractAddress = contract,
            Chain = chain.ToChainId(),
            Financials = new TokenFinancials
            {
                DecimalPlaces = decimals,
                Amount = rawAmount,
                BalanceFormatted = formattedAmount,
                Price = unitPriceUsd,
                TotalPrice = totalPrice
            }
        };
    }
}
