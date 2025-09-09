using Microsoft.AspNetCore.Mvc;
using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;

namespace MyWebWallet.API.Controllers;

[ApiController]
[Route("api/v1/wallets")]
public class WalletController : ControllerBase
{
    private readonly IWalletService _walletService;

    public WalletController(IWalletService walletService)
    {
        _walletService = walletService;
    }

    /// <summary>
    /// Gets information from a Web3 wallet including tokens, balances and values in USD
    /// </summary>
    /// <param name="account">Wallet address (Ethereum or Solana)</param>
    /// <returns>Complete wallet information</returns>
    [HttpGet("accounts/{account}")]
    public async Task<ActionResult<WalletResponse>> GetAccount(string account)
    {
        try
        {
            var walletInfo = await _walletService.GetWalletInfoAsync(account);
            return Ok(walletInfo);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Internal server error", details = ex.Message });
        }
    }
}