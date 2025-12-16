using System.Globalization;
using System.Text;
using System.Text.Json;
using DeFi10.API.Infrastructure.Json;
using Xunit;

namespace DeFi10.API.Tests.Infrastructure.Json;

public class StringToDecimalConverterTests
{
    private readonly StringToDecimalConverter _sut;
    private readonly JsonSerializerOptions _options;

    public StringToDecimalConverterTests()
    {
        _sut = new StringToDecimalConverter();
        _options = new JsonSerializerOptions();
        _options.Converters.Add(_sut);
    }

    #region Read Tests - Number Token

    [Fact]
    public void Read_NumberToken_ReturnsDecimal()
    {
        var json = "42.5";
        
        var result = JsonSerializer.Deserialize<decimal>(json, _options);
        
        Assert.Equal(42.5m, result);
    }

    [Fact]
    public void Read_NumberTokenInteger_ReturnsDecimal()
    {
        var json = "100";
        
        var result = JsonSerializer.Deserialize<decimal>(json, _options);
        
        Assert.Equal(100m, result);
    }

    [Fact]
    public void Read_NumberTokenZero_ReturnsZero()
    {
        var json = "0";
        
        var result = JsonSerializer.Deserialize<decimal>(json, _options);
        
        Assert.Equal(0m, result);
    }

    [Fact]
    public void Read_NumberTokenNegative_ReturnsNegativeDecimal()
    {
        var json = "-123.45";
        
        var result = JsonSerializer.Deserialize<decimal>(json, _options);
        
        Assert.Equal(-123.45m, result);
    }

    [Fact]
    public void Read_NumberTokenLargeValue_ReturnsDecimal()
    {
        var json = "999999999999999.99";
        
        var result = JsonSerializer.Deserialize<decimal>(json, _options);
        
        Assert.Equal(999999999999999.99m, result);
    }

    [Fact]
    public void Read_NumberTokenSmallValue_ReturnsDecimal()
    {
        var json = "0.000000001";
        
        var result = JsonSerializer.Deserialize<decimal>(json, _options);
        
        Assert.Equal(0.000000001m, result);
    }

    #endregion

    #region Read Tests - String Token

    [Fact]
    public void Read_StringTokenValidNumber_ReturnsDecimal()
    {
        var json = "\"42.5\"";
        
        var result = JsonSerializer.Deserialize<decimal>(json, _options);
        
        Assert.Equal(42.5m, result);
    }

    [Fact]
    public void Read_StringTokenInteger_ReturnsDecimal()
    {
        var json = "\"100\"";
        
        var result = JsonSerializer.Deserialize<decimal>(json, _options);
        
        Assert.Equal(100m, result);
    }

    [Fact]
    public void Read_StringTokenNegative_ReturnsNegativeDecimal()
    {
        var json = "\"-123.45\"";
        
        var result = JsonSerializer.Deserialize<decimal>(json, _options);
        
        Assert.Equal(-123.45m, result);
    }

    [Fact]
    public void Read_StringTokenWithSpaces_ReturnsDecimal()
    {
        var json = "\"  42.5  \"";
        
        var result = JsonSerializer.Deserialize<decimal>(json, _options);
        
        Assert.Equal(42.5m, result);
    }

    [Fact]
    public void Read_StringTokenEmpty_ReturnsZero()
    {
        var json = "\"\"";
        
        var result = JsonSerializer.Deserialize<decimal>(json, _options);
        
        Assert.Equal(0m, result);
    }

    [Fact]
    public void Read_StringTokenWhitespace_ReturnsZero()
    {
        var json = "\"   \"";
        
        var result = JsonSerializer.Deserialize<decimal>(json, _options);
        
        Assert.Equal(0m, result);
    }

    [Fact]
    public void Read_StringTokenScientificNotation_ReturnsDecimal()
    {
        var json = "\"1.5e2\"";
        
        var result = JsonSerializer.Deserialize<decimal>(json, _options);
        
        Assert.Equal(150m, result);
    }

    [Fact]
    public void Read_StringTokenWithCommaThousandSeparator_ParsesCorrectly()
    {
        var json = "\"1,000.50\"";
        
        var result = JsonSerializer.Deserialize<decimal>(json, _options);
        
        Assert.Equal(1000.50m, result);
    }

    [Fact]
    public void Read_StringTokenWithPlusSign_ReturnsDecimal()
    {
        var json = "\"+42.5\"";
        
        var result = JsonSerializer.Deserialize<decimal>(json, _options);
        
        Assert.Equal(42.5m, result);
    }

    [Fact]
    public void Read_StringTokenMaxDecimal_ReturnsMaxValue()
    {
        var json = $"\"{decimal.MaxValue.ToString(CultureInfo.InvariantCulture)}\"";
        
        var result = JsonSerializer.Deserialize<decimal>(json, _options);
        
        Assert.Equal(decimal.MaxValue, result);
    }

    [Fact]
    public void Read_StringTokenMinDecimal_ReturnsMinValue()
    {
        var json = $"\"{decimal.MinValue.ToString(CultureInfo.InvariantCulture)}\"";
        
        var result = JsonSerializer.Deserialize<decimal>(json, _options);
        
        Assert.Equal(decimal.MinValue, result);
    }

    #endregion

    #region Read Tests - String Token Errors

    [Fact]
    public void Read_StringTokenInvalidFormat_ThrowsJsonException()
    {
        var json = "\"not a number\"";
        
        var exception = Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<decimal>(json, _options));
        
        Assert.Contains("Unable to convert", exception.Message);
        Assert.Contains("not a number", exception.Message);
    }

    [Fact]
    public void Read_StringTokenInvalidCharacters_ThrowsJsonException()
    {
        var json = "\"12.34.56\"";
        
        var exception = Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<decimal>(json, _options));
        
        Assert.Contains("Unable to convert", exception.Message);
    }

    [Fact]
    public void Read_StringTokenAlphanumeric_ThrowsJsonException()
    {
        var json = "\"123abc\"";
        
        var exception = Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<decimal>(json, _options));
        
        Assert.Contains("Unable to convert", exception.Message);
    }

    [Fact]
    public void Read_StringTokenSpecialCharacters_ThrowsJsonException()
    {
        var json = "\"$100.00\"";
        
        var exception = Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<decimal>(json, _options));
        
        Assert.Contains("Unable to convert", exception.Message);
    }

    #endregion

    #region Read Tests - Unexpected Token Types

    [Fact]
    public void Read_BooleanToken_ThrowsJsonException()
    {
        var json = "true";
        
        var exception = Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<decimal>(json, _options));
        
        Assert.Contains("Unexpected token type", exception.Message);
    }

    [Fact]
    public void Read_NullToken_ThrowsJsonException()
    {
        var json = "null";
        
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<decimal>(json, _options));
    }

    [Fact]
    public void Read_ArrayToken_ThrowsJsonException()
    {
        var json = "[42.5]";
        
        var exception = Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<decimal>(json, _options));
        
        Assert.Contains("Unexpected token type", exception.Message);
    }

    [Fact]
    public void Read_ObjectToken_ThrowsJsonException()
    {
        var json = "{\"value\":42.5}";
        
        var exception = Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<decimal>(json, _options));
        
        Assert.Contains("Unexpected token type", exception.Message);
    }

    #endregion

    #region Write Tests

    [Fact]
    public void Write_PositiveDecimal_WritesNumberValue()
    {
        var value = 42.5m;
        
        var json = JsonSerializer.Serialize(value, _options);
        
        Assert.Equal("42.5", json);
    }

    [Fact]
    public void Write_NegativeDecimal_WritesNumberValue()
    {
        var value = -123.45m;
        
        var json = JsonSerializer.Serialize(value, _options);
        
        Assert.Equal("-123.45", json);
    }

    [Fact]
    public void Write_Zero_WritesZero()
    {
        var value = 0m;
        
        var json = JsonSerializer.Serialize(value, _options);
        
        Assert.Equal("0", json);
    }

    [Fact]
    public void Write_Integer_WritesIntegerValue()
    {
        var value = 100m;
        
        var json = JsonSerializer.Serialize(value, _options);
        
        Assert.Equal("100", json);
    }

    [Fact]
    public void Write_SmallDecimal_WritesWithPrecision()
    {
        var value = 0.000000001m;
        
        var json = JsonSerializer.Serialize(value, _options);
        
        Assert.Equal("0.000000001", json);
    }

    [Fact]
    public void Write_LargeDecimal_WritesFullValue()
    {
        var value = 999999999999999.99m;
        
        var json = JsonSerializer.Serialize(value, _options);
        
        Assert.Equal("999999999999999.99", json);
    }

    [Fact]
    public void Write_MaxDecimal_WritesMaxValue()
    {
        var value = decimal.MaxValue;
        
        var json = JsonSerializer.Serialize(value, _options);
        
        var expected = decimal.MaxValue.ToString(CultureInfo.InvariantCulture);
        Assert.Equal(expected, json);
    }

    [Fact]
    public void Write_MinDecimal_WritesMinValue()
    {
        var value = decimal.MinValue;
        
        var json = JsonSerializer.Serialize(value, _options);
        
        var expected = decimal.MinValue.ToString(CultureInfo.InvariantCulture);
        Assert.Equal(expected, json);
    }

    #endregion

    #region Roundtrip Tests

    [Fact]
    public void Roundtrip_StringToDecimalToString_PreservesValue()
    {
        var json = "\"42.5\"";
        
        var deserialized = JsonSerializer.Deserialize<decimal>(json, _options);
        var serialized = JsonSerializer.Serialize(deserialized, _options);
        
        Assert.Equal(42.5m, deserialized);
        Assert.Equal("42.5", serialized);
    }

    [Fact]
    public void Roundtrip_NumberToDecimalToNumber_PreservesValue()
    {
        var json = "123.456";
        
        var deserialized = JsonSerializer.Deserialize<decimal>(json, _options);
        var serialized = JsonSerializer.Serialize(deserialized, _options);
        
        Assert.Equal(123.456m, deserialized);
        Assert.Equal(json, serialized);
    }

    [Fact]
    public void Roundtrip_ComplexObject_ConvertsCorrectly()
    {
        var json = "{\"Price\":\"1234.56\",\"Quantity\":100}";
        
        var deserialized = JsonSerializer.Deserialize<TestObject>(json, _options);
        var serialized = JsonSerializer.Serialize(deserialized, _options);
        
        Assert.NotNull(deserialized);
        Assert.Equal(1234.56m, deserialized.Price);
        Assert.Equal(100m, deserialized.Quantity);
        Assert.Contains("\"Price\":1234.56", serialized);
        Assert.Contains("\"Quantity\":100", serialized);
    }

    private class TestObject
    {
        public decimal Price { get; set; }
        public decimal Quantity { get; set; }
    }

    #endregion

    #region InvariantCulture Tests

    [Fact]
    public void Read_UsesInvariantCulture_DotDecimalSeparator()
    {
        var json = "\"123.45\"";
        
        var originalCulture = Thread.CurrentThread.CurrentCulture;
        try
        {
            Thread.CurrentThread.CurrentCulture = new CultureInfo("de-DE");
            
            var result = JsonSerializer.Deserialize<decimal>(json, _options);
            
            Assert.Equal(123.45m, result);
        }
        finally
        {
            Thread.CurrentThread.CurrentCulture = originalCulture;
        }
    }

    [Fact]
    public void Write_UsesInvariantCulture_DotDecimalSeparator()
    {
        var value = 123.45m;
        
        var originalCulture = Thread.CurrentThread.CurrentCulture;
        try
        {
            Thread.CurrentThread.CurrentCulture = new CultureInfo("de-DE");
            
            var json = JsonSerializer.Serialize(value, _options);
            
            Assert.Equal("123.45", json);
        }
        finally
        {
            Thread.CurrentThread.CurrentCulture = originalCulture;
        }
    }

    #endregion
}
