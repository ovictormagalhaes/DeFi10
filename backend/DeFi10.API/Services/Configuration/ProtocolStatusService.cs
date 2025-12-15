using Microsoft.Extensions.Options;
using DeFi10.API.Configuration;
using DeFi10.API.DTOs;
using DeFi10.API.Services.Domain.Mappers;
using DeFi10.API.Services.Infrastructure.Moralis.Models;
using DeFi10.API.Services.Protocols.Aave.Models.Supplies;
using DeFi10.API.Services.Protocols.Pendle.Models;
using DeFi10.API.Services.Protocols.Uniswap.Models;
using DeFi10.API.Services.Protocols.Kamino.Models;
using DeFi10.API.Services.Protocols.Raydium.Models;
using Chain = DeFi10.API.Models.Chain;
using DeFi10.API.Services.Infrastructure.MoralisSolana.Models;

namespace DeFi10.API.Services.Configuration;

public class ProtocolStatusService : IProtocolStatusService
{
    private readonly MoralisOptions _moralisOptions;
    private readonly IProtocolConfigurationService _protocolConfig;
    
    // Mappers
    private readonly IWalletItemMapper<IEnumerable<TokenDetail>> _moralisTokenMapper;
    private readonly IWalletItemMapper<AaveGetUserSuppliesResponse> _aaveSuppliesMapper;
    private readonly IWalletItemMapper<UniswapV3GetActivePoolsResponse> _uniswapV3Mapper;
    private readonly IWalletItemMapper<PendleVePositionsResponse> _pendleVeMapper;
    private readonly IWalletItemMapper<IEnumerable<KaminoPosition>> _kaminoMapper;
    private readonly IWalletItemMapper<IEnumerable<RaydiumPosition>> _raydiumMapper;
    private readonly IWalletItemMapper<SolanaTokenResponse> _solanaTokenMapper;

    public ProtocolStatusService(
        IOptions<MoralisOptions> moralisOptions,
        IProtocolConfigurationService protocolConfig,
        IWalletItemMapper<IEnumerable<TokenDetail>> moralisTokenMapper,
        IWalletItemMapper<AaveGetUserSuppliesResponse> aaveSuppliesMapper,
        IWalletItemMapper<UniswapV3GetActivePoolsResponse> uniswapV3Mapper,
        IWalletItemMapper<PendleVePositionsResponse> pendleVeMapper,
        IWalletItemMapper<IEnumerable<KaminoPosition>> kaminoMapper,
        IWalletItemMapper<IEnumerable<RaydiumPosition>> raydiumMapper,
        IWalletItemMapper<SolanaTokenResponse> solanaTokenMapper)
    {
        _moralisOptions = moralisOptions.Value;
        _protocolConfig = protocolConfig;
        
        _moralisTokenMapper = moralisTokenMapper;
        _aaveSuppliesMapper = aaveSuppliesMapper;
        _uniswapV3Mapper = uniswapV3Mapper;
        _pendleVeMapper = pendleVeMapper;
        _kaminoMapper = kaminoMapper;
        _raydiumMapper = raydiumMapper;
        _solanaTokenMapper = solanaTokenMapper;
    }

    public ProtocolStatusListResponse GetProtocolStatus()
    {
        var protocols = new List<ProtocolStatusResponse>();

        // Moralis EVM
        var moralisEvm = BuildMoralisEvmStatus();
        if (moralisEvm != null) protocols.Add(moralisEvm);

        // Moralis Solana
        var moralisSolana = BuildMoralisSolanaStatus();
        if (moralisSolana != null) protocols.Add(moralisSolana);

        // Aave V3
        var aave = BuildAaveStatus();
        if (aave != null) protocols.Add(aave);

        // Uniswap V3
        var uniswap = BuildUniswapV3Status();
        if (uniswap != null) protocols.Add(uniswap);

        // Pendle V2
        var pendle = BuildPendleStatus();
        if (pendle != null) protocols.Add(pendle);

        // Raydium
        var raydium = BuildRaydiumStatus();
        if (raydium != null) protocols.Add(raydium);

        // Kamino
        var kamino = BuildKaminoStatus();
        if (kamino != null) protocols.Add(kamino);

        var availableChains = GetAvailableChains();

        return new ProtocolStatusListResponse(protocols, availableChains);
    }

    private ProtocolStatusResponse? BuildMoralisEvmStatus()
    {
        var protocolDef = _moralisTokenMapper.GetProtocolDefinition(Chain.Base);
        var chainSupport = new Dictionary<string, bool>();
        
        var configuredChains = _protocolConfig.GetAllConfiguredChains(ProtocolNames.Moralis)
            .Where(c => c != Chain.Solana); // EVM only
        
        foreach (var chain in configuredChains)
        {
            var chainConfig = _protocolConfig.GetProtocolOnChain(ProtocolNames.Moralis, chain);
            chainSupport[chain.ToString()] = _moralisOptions.Enabled && chainConfig?.Enabled == true;
        }

        return new ProtocolStatusResponse(
            ProtocolId: "moralis-evm",
            ProtocolName: $"{protocolDef.Name} (EVM Wallet)",
            IconUrl: protocolDef.Logo,
            Website: protocolDef.Url,
            BlockchainGroup: BlockchainGroup.EVM,
            ChainSupport: chainSupport
        );
    }

    private ProtocolStatusResponse? BuildMoralisSolanaStatus()
    {
        var protocolDef = _solanaTokenMapper.GetProtocolDefinition(Chain.Solana);
        var chainSupport = new Dictionary<string, bool>();
        
        var configuredChains = _protocolConfig.GetAllConfiguredChains(ProtocolNames.Moralis)
            .Where(c => c == Chain.Solana); // Solana only
        
        foreach (var chain in configuredChains)
        {
            var chainConfig = _protocolConfig.GetProtocolOnChain(ProtocolNames.Moralis, chain);
            chainSupport[chain.ToString()] = _moralisOptions.Enabled && chainConfig?.Enabled == true;
        }

        return new ProtocolStatusResponse(
            ProtocolId: "moralis-solana",
            ProtocolName: $"{protocolDef.Name} (Solana Wallet)",
            IconUrl: protocolDef.Logo,
            Website: protocolDef.Url,
            BlockchainGroup: BlockchainGroup.Solana,
            ChainSupport: chainSupport
        );
    }

    private ProtocolStatusResponse? BuildAaveStatus()
    {
        var protocolDef = _aaveSuppliesMapper.GetProtocolDefinition(Chain.Base);
        var chainSupport = new Dictionary<string, bool>();
        
        var configuredChains = _protocolConfig.GetAllConfiguredChains(ProtocolNames.AaveV3);
        foreach (var chain in configuredChains)
        {
            var chainConfig = _protocolConfig.GetProtocolOnChain(ProtocolNames.AaveV3, chain);
            chainSupport[chain.ToString()] = chainConfig?.Enabled == true;
        }

        return new ProtocolStatusResponse(
            ProtocolId: protocolDef.Id,
            ProtocolName: protocolDef.Name,
            IconUrl: protocolDef.Logo,
            Website: protocolDef.Url,
            BlockchainGroup: BlockchainGroup.EVM,
            ChainSupport: chainSupport
        );
    }

    private ProtocolStatusResponse? BuildUniswapV3Status()
    {
        var protocolDef = _uniswapV3Mapper.GetProtocolDefinition(Chain.Base);
        var chainSupport = new Dictionary<string, bool>();
        
        var configuredChains = _protocolConfig.GetAllConfiguredChains(ProtocolNames.UniswapV3);
        foreach (var chain in configuredChains)
        {
            var chainConfig = _protocolConfig.GetProtocolOnChain(ProtocolNames.UniswapV3, chain);
            chainSupport[chain.ToString()] = chainConfig?.Enabled == true;
        }

        return new ProtocolStatusResponse(
            ProtocolId: protocolDef.Id,
            ProtocolName: protocolDef.Name,
            IconUrl: protocolDef.Logo,
            Website: protocolDef.Url,
            BlockchainGroup: BlockchainGroup.EVM,
            ChainSupport: chainSupport
        );
    }

    private ProtocolStatusResponse? BuildPendleStatus()
    {
        var protocolDef = _pendleVeMapper.GetProtocolDefinition(Chain.Ethereum);
        var chainSupport = new Dictionary<string, bool>();
        
        var configuredChains = _protocolConfig.GetAllConfiguredChains(ProtocolNames.PendleV2);
        foreach (var chain in configuredChains)
        {
            var chainConfig = _protocolConfig.GetProtocolOnChain(ProtocolNames.PendleV2, chain);
            chainSupport[chain.ToString()] = chainConfig?.Enabled == true;
        }

        return new ProtocolStatusResponse(
            ProtocolId: protocolDef.Id,
            ProtocolName: protocolDef.Name,
            IconUrl: protocolDef.Logo,
            Website: protocolDef.Url,
            BlockchainGroup: BlockchainGroup.EVM,
            ChainSupport: chainSupport
        );
    }

    private ProtocolStatusResponse? BuildRaydiumStatus()
    {
        var protocolDef = _raydiumMapper.GetProtocolDefinition(Chain.Solana);
        var chainSupport = new Dictionary<string, bool>();
        
        var configuredChains = _protocolConfig.GetAllConfiguredChains(ProtocolNames.Raydium);
        foreach (var chain in configuredChains)
        {
            var chainConfig = _protocolConfig.GetProtocolOnChain(ProtocolNames.Raydium, chain);
            chainSupport[chain.ToString()] = chainConfig?.Enabled == true;
        }
        
        return new ProtocolStatusResponse(
            ProtocolId: protocolDef.Id,
            ProtocolName: protocolDef.Name,
            IconUrl: protocolDef.Logo,
            Website: protocolDef.Url,
            BlockchainGroup: BlockchainGroup.Solana,
            ChainSupport: chainSupport
        );
    }

    private ProtocolStatusResponse? BuildKaminoStatus()
    {
        var protocolDef = _kaminoMapper.GetProtocolDefinition(Chain.Solana);
        var chainSupport = new Dictionary<string, bool>();
        
        var configuredChains = _protocolConfig.GetAllConfiguredChains(ProtocolNames.Kamino);
        foreach (var chain in configuredChains)
        {
            var chainConfig = _protocolConfig.GetProtocolOnChain(ProtocolNames.Kamino, chain);
            chainSupport[chain.ToString()] = chainConfig?.Enabled == true;
        }
        
        return new ProtocolStatusResponse(
            ProtocolId: protocolDef.Id,
            ProtocolName: protocolDef.Name,
            IconUrl: protocolDef.Logo,
            Website: protocolDef.Url,
            BlockchainGroup: BlockchainGroup.Solana,
            ChainSupport: chainSupport
        );
    }

    private List<string> GetAvailableChains()
    {
        return new List<string> { "Base", "Arbitrum", "Ethereum", "BNB", "Solana" };
    }
}
