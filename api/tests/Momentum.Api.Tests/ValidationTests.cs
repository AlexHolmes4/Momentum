using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Momentum.Api.Tests.Helpers;

namespace Momentum.Api.Tests;

public class ValidationTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public ValidationTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    private HttpRequestMessage CreateAuthenticatedPost(string url, object body)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(body, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }),
                Encoding.UTF8,
                "application/json")
        };
        request.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", JwtHelper.GenerateToken());
        return request;
    }

    [Fact]
    public async Task Chat_EmptyMessages_Returns400()
    {
        var request = CreateAuthenticatedPost("/api/assistant/chat", new
        {
            messages = Array.Empty<object>(),
            sessionId = "test-session"
        });

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Chat_MissingSessionId_Returns400()
    {
        var request = CreateAuthenticatedPost("/api/assistant/chat", new
        {
            messages = new[] { new { role = "user", content = "hello" } },
            sessionId = ""
        });

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Chat_SessionIdTooLong_Returns400()
    {
        var request = CreateAuthenticatedPost("/api/assistant/chat", new
        {
            messages = new[] { new { role = "user", content = "hello" } },
            sessionId = new string('x', 201)
        });

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Chat_EmptyMessageContent_Returns400()
    {
        var request = CreateAuthenticatedPost("/api/assistant/chat", new
        {
            messages = new[] { new { role = "user", content = "" } },
            sessionId = "test-session"
        });

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Chat_InvalidRole_Returns400()
    {
        var request = CreateAuthenticatedPost("/api/assistant/chat", new
        {
            messages = new[] { new { role = "admin", content = "hello" } },
            sessionId = "test-session"
        });

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
