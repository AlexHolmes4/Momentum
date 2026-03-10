using System.Net;
using System.Net.Http.Headers;
using Momentum.Api.Tests.Helpers;

namespace Momentum.Api.Tests;

public class AuthTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public AuthTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task ApiMe_WithoutToken_Returns401()
    {
        var response = await _client.GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ApiMe_WithValidToken_ReturnsUserId()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/me");
        request.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", JwtHelper.GenerateToken());

        var response = await _client.SendAsync(request);

        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains(JwtHelper.TestUserId, content);
    }

    [Fact]
    public async Task Health_WithoutToken_StillReturnsOk()
    {
        // Health must remain anonymous even after auth middleware is added
        var response = await _client.GetAsync("/health");

        response.EnsureSuccessStatusCode();
    }
}
