using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Momentum.Api.Tests.Helpers;

namespace Momentum.Api.Tests;

public class ProposalEndpointTests : IClassFixture<ProposalApiFactory>
{
    private readonly HttpClient _client;

    public ProposalEndpointTests(ProposalApiFactory factory)
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
    public async Task Chat_WhenAICallsProposeGoals_EmitsProposalEvent()
    {
        var request = CreateChatRequest(new
        {
            messages = new[] { new { role = "user", content = "I want to get fit" } },
            sessionId = "test-proposal-1"
        });

        var response = await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("event: proposal", body);
    }

    [Fact]
    public async Task Chat_WhenAICallsProposeGoals_ProposalContainsGoals()
    {
        var request = CreateChatRequest(new
        {
            messages = new[] { new { role = "user", content = "I want to get fit" } },
            sessionId = "test-proposal-2"
        });

        var response = await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("Get fit", body);
        Assert.Contains("Run 5k", body);
    }

    [Fact]
    public async Task Chat_WhenAICallsProposeGoals_EmitsDoneEvent()
    {
        var request = CreateChatRequest(new
        {
            messages = new[] { new { role = "user", content = "I want to get fit" } },
            sessionId = "test-proposal-3"
        });

        var response = await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("event: done", body);
    }
}
