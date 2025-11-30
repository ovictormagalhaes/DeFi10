using System;
using System.Linq;
using System.Numerics;
using System.Reflection;

namespace MyWebWallet.API.Services.Solana.RaydiumClmm;

public static class OffsetUtils
{
    public static T Parse<T>(ReadOnlySpan<byte> data) where T : new()
    {
        var obj = new T();
        var props = typeof(T).GetProperties();

        foreach (var prop in props)
        {
            var off = prop.GetCustomAttribute<OffsetAttribute>();
            if (off == null) continue;

            var start = off.Start;
            var length = off.Length;

            if (length == 0)
            {
                // Infer type length (u64, u128, pubkey, etc.)
                if (prop.PropertyType == typeof(string)) length = 32;
                else if (prop.PropertyType == typeof(byte[])) length = 8;
                else if (prop.PropertyType == typeof(BigInteger)) length = 16;
                else if (prop.PropertyType == typeof(ulong)) length = 8;
                else if (prop.PropertyType == typeof(int)) length = 4;
                else throw new Exception($"Cannot infer length for {prop.Name}");
            }

            var slice = data.Slice(start, length).ToArray();

            object value = prop.PropertyType switch
            {
                var t when t == typeof(string) =>
                    new Solnet.Wallet.PublicKey(slice).Key,

                var t when t == typeof(byte[]) =>
                    slice,

                var t when t == typeof(int) =>
                    BitConverter.ToInt32(slice),

                var t when t == typeof(ulong) =>
                    BitConverter.ToUInt64(slice),

                var t when t == typeof(BigInteger) =>
                    new BigInteger(slice.Concat(new byte[] { 0 }).ToArray()),

                _ => throw new Exception($"Unsupported type {prop.PropertyType.Name}")
            };

            prop.SetValue(obj, value);
        }

        return obj;
    }
}
