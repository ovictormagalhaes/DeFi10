namespace MyWebWallet.API.Services.Interfaces
{
    public interface IAlchemyNftService
    {
        Task<string> GetNftsForOwnerAsync(string owner, int pageSize = 100);
    }
}
