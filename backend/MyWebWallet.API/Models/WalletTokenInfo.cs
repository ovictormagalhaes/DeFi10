namespace MyWebWallet.API.Models;

public class WalletTokenInfo
{
    public string TokenAddress { get; set; }
    public string Chain { get; set; }
    public string Name { get; set; }
    public string Symbol { get; set; }
    public string Logo { get; set; }
    public decimal Balance { get; set; }
    public int DecimalPlaces { get; set; }
    public decimal BalanceFormated { get; set; }
    public decimal Price { get; set; }
    public decimal TotalPrice { get; set; }
    public bool Native { get; set; }
    public bool PossibleSpam { get; set; }

    public WalletTokenInfo(
        string tokenAddress,
        string chain,
        string name,
        string symbol,
        string logo,
        string thumbnail,
        decimal balance,
        int decimalPlaces,
        double usdPrice,
        bool native,
        bool possibleSpam
    )
    {
        TokenAddress = tokenAddress;
        Chain = chain;
        Name = name;
        Symbol = symbol;
        Logo = string.IsNullOrEmpty(logo) ? thumbnail : logo;
        Balance = balance;
        DecimalPlaces = decimalPlaces;
        Price = (decimal)usdPrice;
        BalanceFormated = balance / (decimal)Math.Pow(10, decimalPlaces);
        TotalPrice = BalanceFormated * Price;
        Native = native;
        PossibleSpam = possibleSpam;
    }
}