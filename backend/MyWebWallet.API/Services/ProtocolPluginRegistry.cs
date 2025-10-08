using MyWebWallet.API.Models;
using MyWebWallet.API.Plugins;
using System.Reflection;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services
{
    /// <summary>
    /// Service for discovering, registering and managing protocol plugins
    /// </summary>
    public interface IProtocolPluginRegistry
    {
        /// <summary>
        /// Discover and register all available plugins
        /// </summary>
        Task<int> DiscoverAndRegisterPluginsAsync();

        /// <summary>
        /// Register a specific plugin
        /// </summary>
        void RegisterPlugin<T>() where T : class, IProtocolPlugin;

        /// <summary>
        /// Get all registered plugins
        /// </summary>
        IEnumerable<IProtocolPlugin> GetAllPlugins();

        /// <summary>
        /// Get plugin by protocol ID
        /// </summary>
        IProtocolPlugin? GetPlugin(string protocolId);

        /// <summary>
        /// Get plugins that support a specific chain
        /// </summary>
        IEnumerable<IProtocolPlugin> GetPluginsForChain(ChainEnum chain);

        /// <summary>
        /// Get plugins that support specific wallet item types
        /// </summary>
        IEnumerable<IDeFiProtocolPlugin> GetPluginsForType(WalletItemType walletItemType);

        /// <summary>
        /// Check health of all plugins or a specific one
        /// </summary>
        Task<Dictionary<string, HealthCheckResult>> CheckPluginHealthAsync(string? protocolId = null);
    }

    public class ProtocolPluginRegistry : IProtocolPluginRegistry
    {
        private readonly Dictionary<string, IProtocolPlugin> _plugins = new();
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<ProtocolPluginRegistry> _logger;

        public ProtocolPluginRegistry(IServiceProvider serviceProvider, ILogger<ProtocolPluginRegistry> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        public async Task<int> DiscoverAndRegisterPluginsAsync()
        {
            var discoveredCount = 0;
            
            try
            {
                // Discover plugins in current assembly
                var assembly = Assembly.GetExecutingAssembly();
                var pluginTypes = assembly.GetTypes()
                    .Where(type => type.IsClass && !type.IsAbstract && typeof(IProtocolPlugin).IsAssignableFrom(type))
                    .Where(type => type.GetCustomAttribute<ProtocolPluginAttribute>() != null);

                foreach (var pluginType in pluginTypes)
                {
                    try
                    {
                        var plugin = ActivatorUtilities.CreateInstance(_serviceProvider, pluginType) as IProtocolPlugin;
                        if (plugin != null)
                        {
                            await plugin.InitializeAsync(_serviceProvider);
                            
                            var attribute = pluginType.GetCustomAttribute<ProtocolPluginAttribute>()!;
                            _plugins[attribute.ProtocolId] = plugin;
                            discoveredCount++;
                            
                            _logger.LogInformation("Registered protocol plugin: {ProtocolId} v{Version} ({Type})", 
                                attribute.ProtocolId, attribute.Version, pluginType.Name);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to register plugin: {PluginType}", pluginType.Name);
                    }
                }

                _logger.LogInformation("Protocol plugin discovery completed. Registered {Count} plugins", discoveredCount);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to discover protocol plugins");
            }

            return discoveredCount;
        }

        public void RegisterPlugin<T>() where T : class, IProtocolPlugin
        {
            try
            {
                var plugin = ActivatorUtilities.CreateInstance<T>(_serviceProvider);
                var attribute = typeof(T).GetCustomAttribute<ProtocolPluginAttribute>();
                
                if (attribute == null)
                {
                    throw new InvalidOperationException($"Plugin {typeof(T).Name} must have ProtocolPluginAttribute");
                }

                _plugins[attribute.ProtocolId] = plugin;
                _logger.LogInformation("Manually registered protocol plugin: {ProtocolId} ({Type})", 
                    attribute.ProtocolId, typeof(T).Name);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to register plugin: {PluginType}", typeof(T).Name);
                throw;
            }
        }

        public IEnumerable<IProtocolPlugin> GetAllPlugins()
        {
            return _plugins.Values;
        }

        public IProtocolPlugin? GetPlugin(string protocolId)
        {
            return _plugins.TryGetValue(protocolId, out var plugin) ? plugin : null;
        }

        public IEnumerable<IProtocolPlugin> GetPluginsForChain(ChainEnum chain)
        {
            return _plugins.Values.Where(plugin => plugin.SupportsChain(chain));
        }

        public IEnumerable<IDeFiProtocolPlugin> GetPluginsForType(WalletItemType walletItemType)
        {
            return _plugins.Values
                .OfType<IDeFiProtocolPlugin>()
                .Where(plugin => plugin.SupportedPositionTypes.Contains(walletItemType));
        }

        public async Task<Dictionary<string, HealthCheckResult>> CheckPluginHealthAsync(string? protocolId = null)
        {
            var results = new Dictionary<string, HealthCheckResult>();

            var pluginsToCheck = string.IsNullOrEmpty(protocolId) 
                ? _plugins 
                : _plugins.Where(kvp => kvp.Key == protocolId);

            foreach (var (id, plugin) in pluginsToCheck)
            {
                try
                {
                    var healthResult = await plugin.CheckHealthAsync();
                    results[id] = healthResult;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Health check failed for plugin {ProtocolId}", id);
                    results[id] = HealthCheckResult.Unhealthy("Health check exception", new[] { ex.Message });
                }
            }

            return results;
        }
    }
}