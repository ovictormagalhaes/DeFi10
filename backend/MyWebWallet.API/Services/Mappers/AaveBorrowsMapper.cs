using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;
using MyWebWallet.API.Aggregation;
using System.Globalization;

namespace MyWebWallet.API.Services.Mappers;

public class AaveBorrowsMapper : IWalletItemMapper<AaveGetUserBorrowsResponse>
{
    private readonly ITokenFactory _tokenFactory;
    
    public AaveBorrowsMapper(ITokenFactory tokenFactory)
    {
        _tokenFactory = tokenFactory;
    }

    public string ProtocolName => "Aave-Borrows";
    public string GetProtocolName() => ProtocolName;

    public bool SupportsChain(ChainEnum chain)
    {
        return GetSupportedChains().Contains(chain);
    }

    public IEnumerable<ChainEnum> GetSupportedChains()
    {
        return new[] { ChainEnum.Base };
    }

    public async Task<List<WalletItem>> MapAsync(AaveGetUserBorrowsResponse response, ChainEnum chain)
    {
        if (!SupportsChain(chain))
            throw new NotSupportedException($"Chain {chain} is not supported by {GetProtocolName()}");

        if (response?.Data?.UserBorrows == null)
            return new List<WalletItem>();

        var walletItems = new List<WalletItem>();

        foreach (var borrow in response.Data.UserBorrows)
        {
            try
            {
                // Parse values safely
                if (!decimal.TryParse(borrow.Debt.Amount.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var amountFormatted))
                    continue;

                if (!decimal.TryParse(borrow.Debt.Usd, NumberStyles.Float, CultureInfo.InvariantCulture, out var totalPriceUsd))
                    continue;

                // Skip zero or negative amounts
                if (amountFormatted <= 0)
                    continue;

                // Calculate unit price safely
                decimal unitPrice = 0;
                if (amountFormatted > 0 && totalPriceUsd >= 0)
                {
                    unitPrice = SafeDivide(totalPriceUsd, amountFormatted);
                }

                // Determine decimals - use currency decimals if available, otherwise reasonable defaults
                int decimals = GetTokenDecimals(borrow.Currency.Symbol, borrow.Currency.Address);

                Console.WriteLine($"AaveBorrows: {borrow.Currency.Symbol} amount={amountFormatted} totalUSD={totalPriceUsd} unitPrice={unitPrice} decimals={decimals}");

                var borrowedToken = _tokenFactory.CreateBorrowed(
                    borrow.Currency.Name ?? string.Empty,
                    borrow.Currency.Symbol ?? string.Empty,
                    borrow.Currency.Address ?? string.Empty,
                    chain,
                    decimals,
                    amountFormatted,
                    unitPrice);

                walletItems.Add(new WalletItem
                {
                    Type = WalletItemType.LendingAndBorrowing,
                    Protocol = GetProtocol(chain),
                    Position = new Position
                    {
                        Label = "Borrowed",
                        Tokens = new List<Token> { borrowedToken }
                    },
                    AdditionalData = new AdditionalData()
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error processing Aave borrow for {borrow.Currency?.Symbol}: {ex.Message}");
                // Continue processing other borrows
            }
        }

        return walletItems;
    }

    /// <summary>
    /// Divisão segura que evita resultados extremos
    /// </summary>
    private static decimal SafeDivide(decimal numerator, decimal denominator)
    {
        if (denominator == 0) return 0;
        
        try
        {
            var result = numerator / denominator;
            
            // Sanity check: preços unitários não devem ser extremamente altos
            const decimal MAX_REASONABLE_PRICE = 1_000_000m; // 1 milhão USD por token
            if (result > MAX_REASONABLE_PRICE)
            {
                Console.WriteLine($"AaveBorrows: Capping extreme unit price {result} to {MAX_REASONABLE_PRICE}");
                return MAX_REASONABLE_PRICE;
            }
            
            return result;
        }
        catch (OverflowException)
        {
            Console.WriteLine($"AaveBorrows: Division overflow {numerator} / {denominator}, returning 0");
            return 0;
        }
    }

    /// <summary>
    /// Determina o número de decimals baseado no símbolo do token
    /// </summary>
    private static int GetTokenDecimals(string? symbol, string? address)
    {
        if (string.IsNullOrEmpty(symbol))
            return 18; // Default ERC20

        // Conhecidos tokens e seus decimals
        return symbol.ToUpperInvariant() switch
        {
            "USDC" => 6,
            "USDT" => 6,
            "DAI" => 18,
            "WETH" => 18,
            "ETH" => 18,
            "WBTC" => 8,
            "BTC" => 8,
            _ => 18 // Default para outros tokens
        };
    }

    private static Protocol GetProtocol(ChainEnum chain) => new()
    {
        Name = "Aave V3",
        Chain = chain.ToChainId(),
        Id = "aave-v3",
        Url = "https://app.aave.com",
        Logo = "https://cdn.moralis.io/defi/aave.png"
    };
}