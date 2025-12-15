using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using DeFi10.API.Configuration;
using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Core;
using DeFi10.API.Services.Domain;
using DeFi10.API.Controllers.Requests;
using DeFi10.API.Controllers.Responses;

namespace DeFi10.API.Controllers;

[ApiController]
[Route("api/v1/wallet-groups")]
public class WalletGroupsController : ControllerBase
{
    private readonly IWalletGroupService _walletGroupService;
    private readonly IProofOfWorkService _proofOfWorkService;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly ProofOfWorkOptions _powOptions;
    private readonly JwtOptions _jwtOptions;
    private readonly ILogger<WalletGroupsController> _logger;

    public WalletGroupsController(
        IWalletGroupService walletGroupService,
        IProofOfWorkService proofOfWorkService,
        IJwtTokenService jwtTokenService,
        IOptions<ProofOfWorkOptions> powOptions,
        IOptions<JwtOptions> jwtOptions,
        ILogger<WalletGroupsController> logger)
    {
        _walletGroupService = walletGroupService;
        _proofOfWorkService = proofOfWorkService;
        _jwtTokenService = jwtTokenService;
        _powOptions = powOptions.Value;
        _jwtOptions = jwtOptions.Value;
        _logger = logger;
    }

    [HttpGet("challenge")]
    public async Task<IActionResult> GenerateChallenge()
    {
        try
        {
            var (challenge, expiresAt) = await _proofOfWorkService.GenerateChallengeAsync();
            
            return Ok(new ChallengeResponse
            {
                Challenge = challenge,
                ExpiresAt = expiresAt,
                Difficulty = _powOptions.Difficulty
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate PoW challenge");
            return StatusCode(500, new { error = "Failed to generate challenge" });
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateWalletGroupRequest request)
    {
        if (request == null)
        {
            return BadRequest(new { error = "Request body is required" });
        }

        var validationError = _walletGroupService.ValidateWallets(request.Wallets);
        if (validationError != null)
        {
            return BadRequest(new { error = validationError });
        }

        // Se tem challenge/nonce/password, valida PoW
        var hasAuth = !string.IsNullOrWhiteSpace(request.Challenge) || 
                      !string.IsNullOrWhiteSpace(request.Nonce) || 
                      !string.IsNullOrWhiteSpace(request.Password);

        if (hasAuth)
        {
            // Validação: todos os campos de auth devem estar presentes
            if (string.IsNullOrWhiteSpace(request.Challenge) || 
                string.IsNullOrWhiteSpace(request.Nonce) || 
                string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest(new { error = "Challenge, nonce and password are required for authenticated wallet groups" });
            }

            // Valida Proof-of-Work
            var isValidProof = await _proofOfWorkService.ValidateProofAsync(request.Challenge, request.Nonce);
            if (!isValidProof)
            {
                return BadRequest(new { error = "Invalid proof-of-work. Challenge may be expired or nonce is incorrect." });
            }

            // Invalida o challenge para prevenir reuso
            await _proofOfWorkService.InvalidateChallengeAsync(request.Challenge);
        }

        try
        {
            var group = await _walletGroupService.CreateAsync(
                request.Wallets, 
                request.DisplayName, 
                request.Password
            );
            
            _logger.LogInformation("Created wallet group {GroupId} with auth={HasAuth}", group.Id, hasAuth);
            
            return CreatedAtAction(
                nameof(Get),
                new { id = group.Id },
                new
                {
                    id = group.Id,
                    wallets = group.Wallets,
                    displayName = group.DisplayName,
                    hasPassword = !string.IsNullOrWhiteSpace(group.PasswordHash),
                    createdAt = group.CreatedAt,
                    updatedAt = group.UpdatedAt
                });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create wallet group");
            return StatusCode(500, new { error = "Failed to create wallet group" });
        }
    }

    [HttpPost("{id:guid}/connect")]
    public async Task<IActionResult> Connect(Guid id, [FromBody] ConnectRequest request)
    {
        if (request == null)
        {
            return BadRequest(new { error = "Request body is required" });
        }

        try
        {
            var group = await _walletGroupService.GetAsync(id);
            
            // Retorna sempre Unauthorized tanto para ID inexistente quanto senha inválida
            // Isso previne enumeração de wallet groups via DDOS
            if (group == null)
            {
                _logger.LogWarning("Connection attempt to non-existent wallet group {GroupId}", id);
                return Unauthorized(new { error = "Invalid credentials" });
            }

            // Se o grupo tem senha, valida
            if (!string.IsNullOrWhiteSpace(group.PasswordHash))
            {
                if (string.IsNullOrWhiteSpace(request.Password))
                {
                    _logger.LogWarning("Connection attempt without password for wallet group {GroupId}", id);
                    return Unauthorized(new { error = "Invalid credentials" });
                }

                var isValidPassword = await _walletGroupService.ValidatePasswordAsync(id, request.Password);
                if (!isValidPassword)
                {
                    _logger.LogWarning("Invalid password attempt for wallet group {GroupId}", id);
                    return Unauthorized(new { error = "Invalid credentials" });
                }
            }
            // Se não tem senha, aceita qualquer valor (inclusive vazio)

            // Gera token JWT
            var token = _jwtTokenService.GenerateToken(group.Id, group.DisplayName);
            var expiresAt = DateTime.UtcNow.AddMinutes(_jwtOptions.ExpirationMinutes);

            _logger.LogInformation("Generated JWT token for wallet group {GroupId}", id);

            return Ok(new ConnectResponse
            {
                Token = token,
                WalletGroupId = group.Id,
                ExpiresAt = expiresAt,
                Wallets = group.Wallets,
                DisplayName = group.DisplayName,
                HasPassword = !string.IsNullOrWhiteSpace(group.PasswordHash),
                CreatedAt = group.CreatedAt,
                UpdatedAt = group.UpdatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to connect to wallet group {GroupId}", id);
            return StatusCode(500, new { error = "Failed to connect to wallet group" });
        }
    }


    [Authorize]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        // Extrai walletGroupId do token JWT (já validado pelo middleware)
        // Tenta 'sub' primeiro, depois o claim mapeado pelo ASP.NET Core
        var tokenWalletGroupId = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value 
                                  ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        if (string.IsNullOrWhiteSpace(tokenWalletGroupId))
        {
            _logger.LogWarning("Sub claim not found in JWT token. Available claims: {Claims}", 
                string.Join(", ", User.Claims.Select(c => $"{c.Type}={c.Value}")));
            return Unauthorized(new { error = "Invalid token" });
        }
        
        if (!Guid.TryParse(tokenWalletGroupId, out var authenticatedId))
        {
            _logger.LogWarning("Invalid sub claim in JWT token: {SubClaim}", tokenWalletGroupId);
            return Unauthorized(new { error = "Invalid token" });
        }

        // Verifica se o walletGroupId do token corresponde ao da rota
        if (authenticatedId != id)
        {
            _logger.LogWarning("Token walletGroupId {TokenId} does not match route walletGroupId {RouteId}", authenticatedId, id);
            return Forbid();
        }

        try
        {
            var group = await _walletGroupService.GetAsync(id);
            
            if (group == null)
            {
                return NotFound(new { error = "Wallet group not found" });
            }

            return Ok(new
            {
                id = group.Id,
                wallets = group.Wallets,
                displayName = group.DisplayName,
                hasPassword = !string.IsNullOrWhiteSpace(group.PasswordHash),
                createdAt = group.CreatedAt,
                updatedAt = group.UpdatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get wallet group {GroupId}", id);
            return StatusCode(500, new { error = "Failed to retrieve wallet group" });
        }
    }


    [Authorize]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWalletGroupRequest request)
    {
        // Extrai walletGroupId do token JWT (já validado pelo middleware)
        var tokenWalletGroupId = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value 
                                  ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        if (string.IsNullOrWhiteSpace(tokenWalletGroupId) || !Guid.TryParse(tokenWalletGroupId, out var authenticatedId))
        {
            _logger.LogWarning("Invalid sub claim in JWT token");
            return Unauthorized(new { error = "Invalid token" });
        }

        // Verifica se o walletGroupId do token corresponde ao da rota
        if (authenticatedId != id)
        {
            _logger.LogWarning("Token walletGroupId {TokenId} does not match route walletGroupId {RouteId}", authenticatedId, id);
            return Forbid();
        }

        if (request == null)
        {
            return BadRequest(new { error = "Request body is required" });
        }

        var validationError = _walletGroupService.ValidateWallets(request.Wallets);
        if (validationError != null)
        {
            return BadRequest(new { error = validationError });
        }

        try
        {
            var group = await _walletGroupService.UpdateAsync(id, request.Wallets, request.DisplayName);
            
            if (group == null)
            {
                return NotFound(new { error = "Wallet group not found" });
            }

            _logger.LogInformation("Updated wallet group {GroupId}", id);

            return Ok(new
            {
                id = group.Id,
                wallets = group.Wallets,
                displayName = group.DisplayName,
                hasPassword = !string.IsNullOrWhiteSpace(group.PasswordHash),
                createdAt = group.CreatedAt,
                updatedAt = group.UpdatedAt
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update wallet group {GroupId}", id);
            return StatusCode(500, new { error = "Failed to update wallet group" });
        }
    }


    [Authorize]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        // Extrai walletGroupId do token JWT (já validado pelo middleware)
        var tokenWalletGroupId = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value 
                                  ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        if (string.IsNullOrWhiteSpace(tokenWalletGroupId) || !Guid.TryParse(tokenWalletGroupId, out var authenticatedId))
        {
            _logger.LogWarning("Invalid sub claim in JWT token");
            return Unauthorized(new { error = "Invalid token" });
        }

        // Verifica se o walletGroupId do token corresponde ao da rota
        if (authenticatedId != id)
        {
            _logger.LogWarning("Token walletGroupId {TokenId} does not match route walletGroupId {RouteId}", authenticatedId, id);
            return Forbid();
        }

        try
        {
            var deleted = await _walletGroupService.DeleteAsync(id);
            
            if (!deleted)
            {
                return NotFound(new { error = "Wallet group not found" });
            }

            _logger.LogInformation("Deleted wallet group {GroupId}", id);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete wallet group {GroupId}", id);
            return StatusCode(500, new { error = "Failed to delete wallet group" });
        }
    }
}
