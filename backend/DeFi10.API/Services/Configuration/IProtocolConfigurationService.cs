using DeFi10.API.Configuration;
using DeFi10.API.Models;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Services.Configuration;

public interface IProtocolConfigurationService
{
    ProtocolDefinition? GetProtocol(string protocolId);
    IEnumerable<string> GetRegisteredProtocolIds();
    IEnumerable<ProtocolChainResolved> GetEnabledChains(string protocolId);
    IEnumerable<ChainEnum> GetAllConfiguredChains(string protocolId);
    ProtocolChainResolved? GetProtocolOnChain(string protocolId, ChainEnum chain);
    bool IsProtocolEnabledOnChain(string protocolId, ChainEnum chain);
}
