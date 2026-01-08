using System.Text.Json;
using System.Linq;
using System;

namespace DeFi10.API.Infrastructure.Http;


public abstract class BaseHttpService
{
    protected readonly HttpClient HttpClient;
    protected readonly ILogger Logger;
    protected readonly JsonSerializerOptions JsonOptions;

    protected BaseHttpService(HttpClient httpClient, ILogger logger)
    {
        HttpClient = httpClient;
        Logger = logger;
        JsonOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);
    }


    protected async Task<TResponse> GetAsync<TResponse>(
        string url,
        Dictionary<string, string>? headers = null,
        CancellationToken cancellationToken = default)
    {
        ConfigureHeaders(headers);
        
        var response = await HttpClient.GetAsync(url, cancellationToken);
        
        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync(cancellationToken);
            Logger.LogError(
                "HTTP request failed - URL: {Url}, Status: {StatusCode}, Content: {ErrorContent}",
                url, response.StatusCode, errorContent);
            response.EnsureSuccessStatusCode();
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        return JsonSerializer.Deserialize<TResponse>(json, JsonOptions) 
            ?? throw new InvalidOperationException($"Failed to deserialize {typeof(TResponse).Name}");
    }


    protected async Task<TResponse?> TryGetAsync<TResponse>(
        string url,
        Dictionary<string, string>? headers = null,
        CancellationToken cancellationToken = default) where TResponse : class
    {
        try
        {
            return await GetAsync<TResponse>(url, headers, cancellationToken);
        }
        catch (Exception ex)
        {
            Logger.LogWarning(ex, "TryGetAsync failed for {Url}, returning null", url);
            return null;
        }
    }


    protected async Task<TResponse> PostAsync<TRequest, TResponse>(
        string url,
        TRequest payload,
        Dictionary<string, string>? headers = null,
        CancellationToken cancellationToken = default)
    {
        ConfigureHeaders(headers);

        var json = JsonSerializer.Serialize(payload, JsonOptions);
        var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

        try
        {
            Logger.LogDebug("HTTP POST - Endpoint: {Url}, BaseAddress: {BaseAddress}, PayloadLength: {Len}, HeaderCount: {HeaderCount}",
                url, HttpClient.BaseAddress?.ToString() ?? "(null)", json?.Length ?? 0, HttpClient.DefaultRequestHeaders.Count());

            var response = await HttpClient.PostAsync(url, content, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync(cancellationToken);
                Logger.LogError(
                    "HTTP POST failed - URL: {Url}, Status: {StatusCode}, Content: {ErrorContent}",
                    url, response.StatusCode, errorContent);
                response.EnsureSuccessStatusCode();
            }

            var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
            var deserialized = JsonSerializer.Deserialize<TResponse>(responseJson, JsonOptions);
            if (deserialized == null)
            {
                var preview = responseJson?.Length > 1000 ? responseJson.Substring(0, 1000) + "..." : responseJson;
                Logger.LogError("Failed to deserialize {Type}. Response length={Len}. Preview: {Preview}", typeof(TResponse).Name, responseJson?.Length ?? 0, preview);
                throw new InvalidOperationException($"Failed to deserialize {typeof(TResponse).Name}. See logs for response preview.");
            }
            return deserialized;
        }
        catch (Exception ex)
        {
            var isAbsolute = Uri.TryCreate(url, UriKind.Absolute, out var tmp) && tmp.IsAbsoluteUri;
            Logger.LogError(ex, "HTTP POST exception for URL '{Url}'. IsAbsolute: {IsAbsolute}. HttpClient.BaseAddress: {BaseAddress}. Exception: {ExceptionMessage}",
                url, isAbsolute, HttpClient.BaseAddress?.ToString() ?? "(null)", ex.Message);
            throw;
        }
    }

    private void ConfigureHeaders(Dictionary<string, string>? headers)
    {
        HttpClient.DefaultRequestHeaders.Clear();
        HttpClient.DefaultRequestHeaders.Add("Accept", "application/json");
        
        if (headers != null)
        {
            foreach (var (key, value) in headers)
            {
                HttpClient.DefaultRequestHeaders.Add(key, value);
            }
        }
    }
}
