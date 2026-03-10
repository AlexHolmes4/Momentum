using System.Net;
using System.Net.Http.Headers;
using Momentum.Api.Tests.Helpers;

namespace Momentum.Api.Tests;

public class RateLimitTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public RateLimitTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task RateLimit_Returns429AfterExceedingLimit()
    {
        // Unique user per test run to avoid interference
        var token = JwtHelper.GenerateToken(userId: $"rate-test-{Guid.NewGuid()}");

        // Send 10 requests (should all succeed)
        for (int i = 0; i < 10; i++)
        {
            var request = new HttpRequestMessage(HttpMethod.Get, "/api/me");
            request.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", token);
            var response = await _client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        // 11th request should be rate limited
        var blockedRequest = new HttpRequestMessage(HttpMethod.Get, "/api/me");
        blockedRequest.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", token);
        var blockedResponse = await _client.SendAsync(blockedRequest);
        Assert.Equal(HttpStatusCode.TooManyRequests, blockedResponse.StatusCode);
    }

    [Fact]
    public async Task Health_IsNotRateLimited()
    {
        // Send 15 requests to health — more than the 10-per-user limit
        // All should succeed because health has no rate limiting policy
        for (int i = 0; i < 15; i++)
        {
            var response = await _client.GetAsync("/health");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }
}
