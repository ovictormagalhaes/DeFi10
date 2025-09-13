namespace MyWebWallet.API.Models
{
    public enum WalletItemType
    {
        Unknown = 0,
        Wallet = 1,        
        LiquidityPool = 2,
        LendingAndBorrowing = 3,
        Staking = 4,
        Token = 5,
        Other = 50
    }
}
