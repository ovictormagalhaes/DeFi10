using Microsoft.Extensions.Options;

namespace DeFi10.API.Configuration;

public sealed class MongoDBOptions : IValidateOptions<MongoDBOptions>
{
    public string? ConnectionString { get; set; }
    public string? DatabaseName { get; set; }
    public CollectionNames Collections { get; set; } = new();

    public ValidateOptionsResult Validate(string? name, MongoDBOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.ConnectionString))
        {
            return ValidateOptionsResult.Fail("MongoDB:ConnectionString is required");
        }

        if (string.IsNullOrWhiteSpace(options.DatabaseName))
        {
            return ValidateOptionsResult.Fail("MongoDB:DatabaseName is required");
        }

        if (string.IsNullOrWhiteSpace(options.Collections.WalletGroups))
        {
            return ValidateOptionsResult.Fail("MongoDB:Collections:WalletGroups is required");
        }

        if (string.IsNullOrWhiteSpace(options.Collections.Strategies))
        {
            return ValidateOptionsResult.Fail("MongoDB:Collections:Strategies is required");
        }

        if (string.IsNullOrWhiteSpace(options.Collections.Tokens))
        {
            return ValidateOptionsResult.Fail("MongoDB:Collections:Tokens is required");
        }

        return ValidateOptionsResult.Success;
    }

    public sealed class CollectionNames
    {
        public string WalletGroups { get; set; } = "wallet_groups";
        public string Strategies { get; set; } = "strategies";
        public string Tokens { get; set; } = "tokens";
    }
}
