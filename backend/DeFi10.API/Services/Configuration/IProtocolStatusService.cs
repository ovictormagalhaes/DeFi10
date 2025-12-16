using DeFi10.API.DTOs;

namespace DeFi10.API.Services.Configuration;

public interface IProtocolStatusService
{
    ProtocolStatusListResponse GetProtocolStatus();
}
