namespace DeFi10.API.Services.Infrastructure.Alchemy
{
    public interface IAlchemyNftService
    {
        Task<string> GetNftsForOwnerAsync(string owner, int pageSize = 100);
    }
}
