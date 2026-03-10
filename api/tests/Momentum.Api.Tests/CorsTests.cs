using Momentum.Api.Tests.Helpers;

namespace Momentum.Api.Tests;

public class CorsTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public CorsTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Cors_AllowsProductionOrigin()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.Add("Origin", "https://momentum.alexgholmes.workers.dev");

        var response = await _client.SendAsync(request);

        response.EnsureSuccessStatusCode();
        Assert.True(
            response.Headers.TryGetValues("Access-Control-Allow-Origin", out var origins),
            "Expected Access-Control-Allow-Origin header"
        );
        Assert.Contains("https://momentum.alexgholmes.workers.dev", origins!);
    }

    [Fact]
    public async Task Cors_AllowsLocalhostDevOrigin()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.Add("Origin", "http://localhost:11001");

        var response = await _client.SendAsync(request);

        response.EnsureSuccessStatusCode();
        Assert.True(
            response.Headers.TryGetValues("Access-Control-Allow-Origin", out var origins),
            "Expected Access-Control-Allow-Origin header"
        );
        Assert.Contains("http://localhost:11001", origins!);
    }

    [Fact]
    public async Task Cors_RejectsUnknownOrigin()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.Add("Origin", "https://evil.example.com");

        var response = await _client.SendAsync(request);

        Assert.False(
            response.Headers.TryGetValues("Access-Control-Allow-Origin", out _),
            "Should not set Access-Control-Allow-Origin for unknown origins"
        );
    }
}
