using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Interfaces;

namespace DeFi10.API.Services.Infrastructure.Alchemy
{
    public class AlchemyNftService : IAlchemyNftService
    {
        private readonly HttpClient _httpClient;
        private readonly string _alchemyNftBaseUrl;

        public AlchemyNftService(IOptions<AlchemyOptions> options)
        {
            _httpClient = new HttpClient();
            var nftUrl = options.Value.GetNftUrl();
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
