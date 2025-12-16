namespace DeFi10.API.Services.Core;

public interface IProofOfWorkService
{
    Task<(string Challenge, DateTime ExpiresAt)> GenerateChallengeAsync();
    Task<bool> ValidateProofAsync(string challenge, string nonce);
    Task InvalidateChallengeAsync(string challenge);
}
