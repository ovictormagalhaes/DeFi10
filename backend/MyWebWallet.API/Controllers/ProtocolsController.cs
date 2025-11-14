using Microsoft.AspNetCore.Mvc;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Models;
using MyWebWallet.API.Plugins;
using ChainEnum = MyWebWallet.API.Models.Chain;
using MyWebWallet.API.Services;

namespace MyWebWallet.API.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class ProtocolsController : ControllerBase
    {
        private readonly IProtocolPluginRegistry _pluginRegistry;
        private readonly IChainConfigurationService _chainConfig;
        private readonly ILogger<ProtocolsController> _logger;

        public ProtocolsController(IProtocolPluginRegistry pluginRegistry, IChainConfigurationService chainConfig, ILogger<ProtocolsController> logger)
        { _pluginRegistry = pluginRegistry; _chainConfig = chainConfig; _logger = logger; }

        /// <summary>
        /// Get all available protocol plugins
        /// </summary>
        [HttpGet]
        public ActionResult<IEnumerable<ProtocolInfo>> GetAllProtocols()
        {
            try
            {
                var plugins = _pluginRegistry.GetAllPlugins();
                var protocols = plugins.Select(plugin => new ProtocolInfo
                {
                    Id = plugin.ProtocolId,
                    Name = plugin.ProtocolId, // Name fallback to ProtocolId (GetProtocolName removed)
                    Version = plugin.Version,
                    Description = plugin.Description,
                    WebsiteUrl = plugin.WebsiteUrl,
                    LogoUrl = plugin.LogoUrl,
                    SupportedChains = plugin.GetSupportedChains().ToList(),
                    SupportedPositionTypes = plugin is IDeFiProtocolPlugin defi ? defi.SupportedPositionTypes.ToList() : new List<WalletItemType>()
                });

                return Ok(protocols);
            }
            catch (Exception ex) { _logger.LogError(ex, "Error getting protocol list"); return StatusCode(500, "Failed to get protocol list"); }
        }

        /// <summary>
        /// Get protocols that support a specific chain
        /// </summary>
        [HttpGet("chain/{chain}")]
        public ActionResult<IEnumerable<ProtocolInfo>> GetProtocolsForChain(ChainEnum chain)
        {
            try
            {
                var plugins = _pluginRegistry.GetPluginsForChain(chain);
                var protocols = plugins.Select(plugin => new ProtocolInfo
                {
                    Id = plugin.ProtocolId,
                    Name = plugin.ProtocolId,
                    Version = plugin.Version,
                    Description = plugin.Description,
                    WebsiteUrl = plugin.WebsiteUrl,
                    LogoUrl = plugin.LogoUrl,
                    SupportedChains = plugin.GetSupportedChains().ToList(),
                    SupportedPositionTypes = plugin is IDeFiProtocolPlugin defi ? defi.SupportedPositionTypes.ToList() : new List<WalletItemType>()
                });

                return Ok(protocols);
            }
            catch (Exception ex) { _logger.LogError(ex, "Error getting protocols for chain {Chain}", chain); return StatusCode(500, $"Failed to get protocols for chain {chain}"); }
        }

        /// <summary>
        /// Get health status of all protocols or a specific one
        /// </summary>
        [HttpGet("health")]
        public async Task<ActionResult<Dictionary<string, object>>> GetProtocolHealth([FromQuery] string? protocolId = null)
        {
            try
            {
                var healthResults = await _pluginRegistry.CheckPluginHealthAsync(protocolId);
                var response = healthResults.ToDictionary(kvp => kvp.Key, kvp => (object)new { kvp.Value.IsHealthy, kvp.Value.Status, ResponseTimeMs = kvp.Value.ResponseTime.TotalMilliseconds, kvp.Value.Errors, kvp.Value.CheckedAt, kvp.Value.AdditionalData });
                return Ok(response);
            }
            catch (Exception ex) { _logger.LogError(ex, "Error checking protocol health"); return StatusCode(500, "Failed to check protocol health"); }
        }

        /// <summary>
        /// Validate configuration for a specific protocol and chain
        /// </summary>
        [HttpGet("{protocolId}/validate/{chain}")]
        public async Task<ActionResult<object>> ValidateProtocolConfiguration(string protocolId, ChainEnum chain)
        {
            try
            {
                var plugin = _pluginRegistry.GetPlugin(protocolId); if (plugin == null) return NotFound($"Protocol {protocolId} not found");
                var validation = await plugin.ValidateConfigurationAsync(chain);
                return Ok(new { ProtocolId = protocolId, Chain = chain, validation.IsValid, validation.Errors, validation.Warnings, validation.AdditionalData });
            }
            catch (Exception ex) { _logger.LogError(ex, "Error validating protocol {ProtocolId} configuration for chain {Chain}", protocolId, chain); return StatusCode(500, $"Failed to validate protocol {protocolId} configuration"); }
        }

        /// <summary>
        /// Get wallet items for a specific protocol
        /// </summary>
        [HttpGet("{protocolId}/wallet/{accountAddress}")]
        public async Task<ActionResult<List<WalletItem>>> GetWalletItems(string protocolId, string accountAddress, [FromQuery] ChainEnum? chain = null)
        {
            try
            {
                var plugin = _pluginRegistry.GetPlugin(protocolId); if (plugin == null) return NotFound($"Protocol {protocolId} not found");
                var targetChain = chain ?? plugin.GetSupportedChains().FirstOrDefault(); if (targetChain == default) return BadRequest($"Protocol {protocolId} doesn't support any chains or chain not specified");
                if (!plugin.SupportsChain(targetChain)) return BadRequest($"Protocol {protocolId} doesn't support chain {targetChain}");
                var walletItems = await plugin.GetWalletItemsAsync(accountAddress, targetChain); return Ok(walletItems);
            }
            catch (Exception ex) { _logger.LogError(ex, "Error getting wallet items for protocol {ProtocolId}, account {Account}, chain {Chain}", protocolId, accountAddress, chain); return StatusCode(500, $"Failed to get wallet items for protocol {protocolId}"); }
        }

        /// <summary>
        /// Get specific position data
        /// </summary>
        [HttpGet("{protocolId}/position/{positionId}")]
        public async Task<ActionResult<WalletItem>> GetPosition(string protocolId, string positionId, [FromQuery] ChainEnum? chain = null)
        {
            try
            {
                var plugin = _pluginRegistry.GetPlugin(protocolId); if (plugin == null) return NotFound($"Protocol {protocolId} not found");
                if (plugin is not IDeFiProtocolPlugin defiPlugin) return BadRequest($"Protocol {protocolId} doesn't support position queries");
                var targetChain = chain ?? plugin.GetSupportedChains().FirstOrDefault(); if (targetChain == default) return BadRequest($"Protocol {protocolId} doesn't support any chains or chain not specified");
                var position = await defiPlugin.GetPositionAsync(positionId, targetChain); if (position == null) return NotFound($"Position {positionId} not found");
                return Ok(position);
            }
            catch (Exception ex) { _logger.LogError(ex, "Error getting position {PositionId} for protocol {ProtocolId}, chain {Chain}", positionId, protocolId, chain); return StatusCode(500, $"Failed to get position {positionId} for protocol {protocolId}"); }
        }
    }

    /// <summary>
    /// DTO for protocol information
    /// </summary>
    public class ProtocolInfo
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string WebsiteUrl { get; set; } = string.Empty;
        public string LogoUrl { get; set; } = string.Empty;
        public List<ChainEnum> SupportedChains { get; set; } = new();
        public List<WalletItemType> SupportedPositionTypes { get; set; } = new();
    }
}