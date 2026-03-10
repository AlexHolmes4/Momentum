using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Momentum.Api.Tests.Helpers;

public static class JwtHelper
{
    public const string TestSecret = "test-secret-key-that-is-at-least-256-bits-long!!";
    public const string TestUserId = "test-user-123";

    public static string GenerateToken(string? userId = null)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(TestSecret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: "https://test.supabase.co/auth/v1",
            audience: "authenticated",
            claims: [new Claim("sub", userId ?? TestUserId)],
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
