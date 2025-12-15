using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DeFi10.API.Models;

namespace DeFi10.API.Services.Domain;


public interface IWalletGroupService
{


    Task<WalletGroup> CreateAsync(List<string> wallets, string? displayName = null, string? password = null);


    Task<WalletGroup?> UpdateAsync(Guid id, List<string> wallets, string? displayName = null);


    Task<WalletGroup?> GetAsync(Guid id);


    Task<bool> DeleteAsync(Guid id);


    string? ValidateWallets(List<string> wallets);


    Task<bool> ValidatePasswordAsync(Guid id, string password);
}
