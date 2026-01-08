using DeFi10.API.Models;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Aggregation;

public sealed class TokenFactory : ITokenFactory
{
    public Token CreateSupplied(string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount, decimal unitPriceUsd)
        => Build(TokenType.Supplied, name, symbol, contract, chain, decimals, formattedAmount, unitPriceUsd);

    public Token CreateBorrowed(string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount, decimal unitPriceUsd)
        => Build(TokenType.Borrowed, name, symbol, contract, chain, decimals, formattedAmount, unitPriceUsd);

    public Token CreateUncollectedReward(string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount, decimal unitPriceUsd)
        => Build(TokenType.LiquidityUncollectedFee, name, symbol, contract, chain, decimals, formattedAmount, unitPriceUsd);

    public Token CreateCollectedFee(string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount, decimal unitPriceUsd)
        => Build(TokenType.LiquidityCollectedFee, name, symbol, contract, chain, decimals, formattedAmount, unitPriceUsd);

    public Token CreateStaked(string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount, decimal unitPriceUsd)
        => Build(TokenType.Supplied, name, symbol, contract, chain, decimals, formattedAmount, unitPriceUsd);

    public Token CreateGovernancePower(string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount)
        => Build(TokenType.GovernancePower, name, symbol, contract, chain, decimals, formattedAmount, 0);

    private static Token Build(TokenType type, string name, string symbol, string contract, ChainEnum chain, int decimals, decimal formattedAmount, decimal unitPriceUsd)
    {
        if (decimals < 0) decimals = 0;
        if (decimals > 28) decimals = 28;
        if (formattedAmount < 0) formattedAmount = 0;
        if (unitPriceUsd < 0) unitPriceUsd = 0;
        decimal rawAmount = SafeMultiply(formattedAmount, TokenFinancials.DecimalPow10(decimals));
        decimal totalPrice = SafeMultiply(formattedAmount, unitPriceUsd);
        return new Token
        {
            Type = type,
            Name = name ?? string.Empty,
            Symbol = symbol ?? string.Empty,
            ContractAddress = contract ?? string.Empty,
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

    private static decimal SafeMultiply(decimal a, decimal b)
    {
        try
        {
            if (a == 0 || b == 0) return 0;
            if (Math.Abs(a) <= 100_000_000 && Math.Abs(b) <= 100_000_000) return a * b;
            if (a > 0 && b > 0 && a <= decimal.MaxValue / b) return a * b;
            if (a < 0 && b < 0 && (-a) <= decimal.MaxValue / (-b)) return a * b;
            var absA = Math.Abs(a); var absB = Math.Abs(b);
            if (((a < 0 && b > 0) || (a > 0 && b < 0)) && absA <= decimal.MaxValue / absB) return a * b;
            double resultDouble = (double)a * (double)b;
            if (Math.Abs(resultDouble) <= 1_000_000_000_000) return (decimal)resultDouble;
            return 0;
        }
        catch { return 0; }
    }
}
