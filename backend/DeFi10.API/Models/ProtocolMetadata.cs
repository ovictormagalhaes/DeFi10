namespace DeFi10.API.Models;

/// <summary>
/// Metadados persistentes de protocolo DeFi.
/// </summary>
public class ProtocolMetadata
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Chain { get; set; } = string.Empty;
    public string? Url { get; set; }
    public string? Logo { get; set; }
}
