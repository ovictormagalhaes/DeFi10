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
        // Safety bounds for decimals
        if (decimals < 0) decimals = 0; 
        if (decimals > 28) decimals = 28;
        
        // Protect against invalid amounts and prices
        if (formattedAmount < 0) formattedAmount = 0;
        if (unitPriceUsd < 0) unitPriceUsd = 0;
        
        // Calculate raw amount with overflow protection
        decimal rawAmount = SafeMultiply(formattedAmount, TokenFinancials.DecimalPow10(decimals));
        
        // Calculate total price with overflow protection  
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

    /// <summary>
    /// Multiplicação segura que detecta overflow antes de executar
    /// </summary>
    private static decimal SafeMultiply(decimal a, decimal b)
    {
        try
        {
            if (a == 0 || b == 0) return 0;
            
            // Para valores pequenos e médios, multiplicação direta é sempre segura
            // Aumentamos o limite para ser menos restritivo
            if (Math.Abs(a) <= 100_000_000 && Math.Abs(b) <= 100_000_000)
            {
                return a * b;
            }
            
            // Para valores maiores, verificar overflow usando lógica matemática
            // Se a > 0 e b > 0, então a * b vai overflow se a > decimal.MaxValue / b
            if (a > 0 && b > 0)
            {
                if (a <= decimal.MaxValue / b)
                {
                    return a * b;
                }
            }
            else if (a < 0 && b < 0)
            {
                // Ambos negativos: resultado positivo
                if ((-a) <= decimal.MaxValue / (-b))
                {
                    return a * b;
                }
            }
            else if ((a < 0 && b > 0) || (a > 0 && b < 0))
            {
                // Um negativo, um positivo: resultado negativo
                var absA = Math.Abs(a);
                var absB = Math.Abs(b);
                if (absA <= decimal.MaxValue / absB)
                {
                    return a * b;
                }
            }
            
            // Se chegou aqui, vai overflow - retornar valor limitado em vez de 0
            Console.WriteLine($"TokenFactory SafeMultiply overflow detected: {a} * {b}, using fallback calculation");
            
            // Para price calculations (geralmente valores pequenos), preferir manter o cálculo
            // usando double precision como fallback
            double aDouble = (double)a;
            double bDouble = (double)b;
            double resultDouble = aDouble * bDouble;
            
            // Se o resultado em double ainda é razoável, usar ele
            if (Math.Abs(resultDouble) <= 1_000_000_000_000) // 1 trilhão
            {
                return (decimal)resultDouble;
            }
            
            // Último caso: valor realmente extremo, retornar 0
            return 0;
        }
        catch (OverflowException)
        {
            Console.WriteLine($"TokenFactory SafeMultiply overflow exception: {a} * {b}, returning 0");
            return 0;
        }
    }
}
