using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Momentum.Api.Tests.Helpers;

namespace Momentum.Api.Tests;

public class ChatEndpointTests : IClassFixture<ChatApiFactory>
{
    private readonly HttpClient _client;

    public ChatEndpointTests(ChatApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    private HttpRequestMessage CreateChatRequest(object body)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/assistant/chat")
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
    public async Task Chat_ValidRequest_ReturnsSSEContentType()
    {
        var request = CreateChatRequest(new
        {
            messages = new[] { new { role = "user", content = "I want to get fit" } },
            sessionId = "test-sse-1"
        });

        var response = await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);

        response.EnsureSuccessStatusCode();
        Assert.Equal("text/event-stream", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Chat_ValidRequest_StreamsTokenEvents()
    {
        var request = CreateChatRequest(new
        {
            messages = new[] { new { role = "user", content = "braindump" } },
            sessionId = "test-sse-2"
        });

        var response = await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync();
        // SSE format: each event is "data: ...\n\n"
        Assert.Contains("data:", body);
    }

    [Fact]
    public async Task Chat_WithoutToken_Returns401()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/assistant/chat")
        {
            Content = new StringContent(
                JsonSerializer.Serialize(new
                {
                    messages = new[] { new { role = "user", content = "hello" } },
                    sessionId = "test"
                }),
                Encoding.UTF8,
                "application/json")
        };

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
