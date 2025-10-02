namespace MyWebWallet.API.Models
{
    public enum RebalanceAssetType
    {
        Unknown = 0,
        Wallet = 1,
        LiquidityPool = 2,
        LendingAndBorrowing = 3,
        Staking = 4,
        Token = 5,
        Group = 6,
        Protocol = 7,
        Other = 50
    }
}
