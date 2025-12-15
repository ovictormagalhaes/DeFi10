using System;

namespace DeFi10.API.Services.Protocols.Raydium.Clmm;

[AttributeUsage(AttributeTargets.Property)]
public class OffsetAttribute : Attribute
{
    public int Start { get; }
    public int Length { get; }

    public OffsetAttribute(int start, int length = 0)
    {
        Start = start;
        Length = length;
    }
}
