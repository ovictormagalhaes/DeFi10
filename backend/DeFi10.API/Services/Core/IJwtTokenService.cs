namespace DeFi10.API.Services.Core;

public interface IJwtTokenService
{
    string GenerateToken(Guid walletGroupId, string? displayName);
    Guid? ValidateToken(string token);
}
