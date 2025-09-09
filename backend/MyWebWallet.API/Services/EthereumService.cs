using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;
using System.Text.RegularExpressions;

namespace MyWebWallet.API.Services;

public class EthereumService : IBlockchainService
{
    private readonly IMoralisService _moralisService;
    private readonly IConfiguration _configuration;

    public string NetworkName => "Ethereum";

    public EthereumService(IMoralisService moralisService, IConfiguration configuration)
    {
        _moralisService = moralisService;
        _configuration = configuration;
    }

    public bool IsValidAddress(string account)
    {
        // Ethereum address validation (42 characters, starts with 0x)
        return Regex.IsMatch(account, @"^0x[a-fA-F0-9]{40}$");
    }

    public async Task<WalletInfo> GetWalletTokensAsync(string account)
    {
        if (!IsValidAddress(account))
        {
            throw new ArgumentException("Invalid Ethereum address");
        }


        var walletInfo = new WalletInfo {
            Account = account,
            Network = NetworkName,
        };
        var tokensMapped = new List<WalletTokenInfo>();

        try
        {
            Console.WriteLine($"Fetching tokens for wallet: {account} on Base chain");

            // Fetch tokens using Moralis for the Base chain
            var baseChainId = "base"; // Hardcoded for now
            var tokens = await _moralisService.GetERC20TokenBalanceAsync(account, baseChainId);

            tokensMapped = tokens.Result?.Select(token =>
            {
                decimal.TryParse(token.Balance, out var balance);

                return new WalletTokenInfo(
                    tokenAddress: token.TokenAddress,
                    chain: baseChainId,
                    name: token.Name,
                    symbol: token.Symbol,
                    logo: token.Logo,
                    thumbnail: token.Thumbnail,
                    balance: balance,
                    usdPrice: token.UsdPrice,
                    native: token.NativeToken,
                    possibleSpam: token.PossibleSpam,
                    decimalPlaces: token.Decimals ?? 1
                );
            })?.ToList() ?? new List<WalletTokenInfo>();

            var defi = await _moralisService.GetDeFiPositionsAsync(account, baseChainId);
            
            var defiMapped = defi.Select(d =>
            {
                return new WalletDefiInfo
                {
                    Protocol = new Protocol
                    {
                        Name = d.ProtocolName,
                        Chain = baseChainId,
                        Id = d.ProtocolId,
                        Url = d.ProtocolUrl,
                        Logo = d.ProtocolLogo
                    },
                    Position = new Position
                    {
                        Label = d.Position.Label,
                        Balance = d.Position.BalanceUsd,
                        TotalUnclaimed = d.Position.TotalUnclaimedUsdValue,
                        Tokens = d.Position.Tokens.Select(t => new PositionToken
                        {
                            Type = t.TokenType,
                            Name = t.Name,
                            Symbol = t.Symbol,
                            ContractAddress = t.ContractAddress,
                            DecimalPlaces = int.TryParse(t.Decimals, out var decimals) ? decimals : 0,
                            Logo = t.Logo,
                            Thumbnail = t.Thumbnail,
                            Balance = t.Balance != null ? decimal.Parse(t.Balance) : null,
                            UnitPrice = t.UsdPrice,
                            TotalPrice = t.UsdValue
                        }).ToList()
                    },
                    AdditionalData = new AdditionalData
                    {
                       HealthFactor = d.AccountData?.HealthFactory
                    }
                };
            })?.ToList() ?? new List<WalletDefiInfo>();


            walletInfo.Tokens = tokensMapped;
            walletInfo.DeFi = defiMapped;

            Console.WriteLine($"Total tokens fetched: {tokensMapped.Count}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error fetching wallet data from Base chain: {ex.Message}");
            throw;
        }

        return walletInfo;
    }
}