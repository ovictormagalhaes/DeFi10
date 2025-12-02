using MyWebWallet.API.Messaging.Contracts.Enums;
using MyWebWallet.API.Models;

namespace MyWebWallet.API.Messaging.Workers.TriggerRules;

/// <summary>
/// Interface for detecting protocol-specific triggers from NFT/token scan results
/// </summary>
public interface IProtocolTriggerDetector
{
    /// <summary>
    /// Evaluates the payload from an NFT/token scan and returns protocols to trigger
    /// </summary>
    /// <param name="payload">The deserialized payload from the integration result</param>
    /// <param name="chain">The blockchain chain being scanned</param>
    /// <returns>List of (Provider, Chain) tuples to trigger, empty if none detected</returns>
    List<(IntegrationProvider Provider, Chain Chain)> DetectTriggersFromPayload(object? payload, Chain chain);
    
    /// <summary>
    /// The provider type this detector handles
    /// </summary>
    IntegrationProvider HandlesProvider { get; }
}
