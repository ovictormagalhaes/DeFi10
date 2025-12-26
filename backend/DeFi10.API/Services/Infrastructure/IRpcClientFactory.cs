using DeFi10.API.Models;
using Nethereum.Web3;
using Solnet.Rpc;

namespace DeFi10.API.Services.Infrastructure;

public interface IRpcClientFactory
{
    IRpcClient GetSolanaClient();    
    IWeb3 GetEvmClient(Chain chain);    
    string GetRpcUrl(Chain chain);
}
