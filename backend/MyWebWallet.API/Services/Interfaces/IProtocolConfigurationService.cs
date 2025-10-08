using MyWebWallet.API.Configuration;
using MyWebWallet.API.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Interfaces;

public interface IProtocolConfigurationService
{
    ProtocolDefinition? GetProtocol(string protocolId);
    IEnumerable<string> GetRegisteredProtocolIds();
    IEnumerable<ProtocolChainResolved> GetEnabledChains(string protocolId);
    ProtocolChainResolved? GetProtocolOnChain(string protocolId, ChainEnum chain);
    bool IsProtocolEnabledOnChain(string protocolId, ChainEnum chain);
}
