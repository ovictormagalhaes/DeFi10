using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using MyWebWallet.API.Services.Interfaces;

namespace MyWebWallet.API.Services
{
    public class AlchemyNftService : IAlchemyNftService
    {
        private readonly HttpClient _httpClient;
        private readonly string _alchemyNftBaseUrl;

        public AlchemyNftService(IConfiguration configuration)
        {
            _httpClient = new HttpClient();
            var nftUrl = configuration["Alchemy:NftUrl"];
            _alchemyNftBaseUrl = nftUrl.EndsWith("/") ? nftUrl : nftUrl + "/";
        }

        public async Task<string> GetNftsForOwnerAsync(string owner, int pageSize = 100)
        {
            var url = $"{_alchemyNftBaseUrl}getNFTsForOwner?owner={owner}&withMetadata=true&pageSize={pageSize}";
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("accept", "application/json");
            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync();
        }
    }
}
