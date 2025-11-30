namespace MyWebWallet.API.Messaging.Rabbit;

public class RabbitMqOptions
{
    public string Host { get; set; } = string.Empty;
    public string VirtualHost { get; set; } = "/";
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public int Port { get; set; } = 5672;
    public bool UseTls { get; set; } = false;
    public int RequestedHeartbeatSeconds { get; set; } = 30;
    public bool PublisherConfirms { get; set; } = true;
    public int PublisherConfirmTimeoutSeconds { get; set; } = 30;
    public string Exchange { get; set; } = "wallet.aggregation";
}
