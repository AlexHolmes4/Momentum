using System.Net;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Configuration;
using Momentum.Api.Models;
using Momentum.Api.Services;
using Momentum.Api.Tests.Helpers;

namespace Momentum.Api.Tests;

public class AssistantServiceTests
{
    private static AssistantService CreateService(IChatClient chatClient, SessionStore? sessionStore = null)
    {
        sessionStore ??= new SessionStore();
        var handler = new MockHttpHandler(HttpStatusCode.OK, "[]");
        var httpClient = new HttpClient(handler) { BaseAddress = new Uri("https://test.supabase.co") };
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Supabase:PublishableKey"] = "sb_test_key"
            })
            .Build();
        var dataService = new SupabaseDataService(httpClient, config);
        return new AssistantService(chatClient, sessionStore, dataService);
    }

    [Fact]
    public async Task StreamAsync_YieldsTokenChunks()
    {
        var service = CreateService(new FakeChatClient("Hello", " world", "!"));
        var request = new ChatRequest(
            [new Models.ChatMessage("user", "I want to get fit")],
            "test-session");

        var tokens = new List<string>();
        await foreach (var chunk in service.StreamAsync(request, "test-jwt", CancellationToken.None))
        {
            if (!chunk.IsProposal)
                tokens.Add(chunk.Token!);
        }

        Assert.Equal(["Hello", " world", "!"], tokens);
    }

    [Fact]
    public async Task StreamAsync_AddsUserMessageToHistory()
    {
        var sessionStore = new SessionStore();
        var service = CreateService(new FakeChatClient("response"), sessionStore);
        var request = new ChatRequest(
            [new Models.ChatMessage("user", "I want to learn piano")],
            "test-session");

        await foreach (var _ in service.StreamAsync(request, "test-jwt", CancellationToken.None)) { }

        var history = sessionStore.GetOrCreate("test-session");
        // system + user + assistant
        Assert.Equal(3, history.Count);
        Assert.Equal("I want to learn piano", history[1].Text);
        Assert.Equal(ChatRole.User, history[1].Role);
    }

    [Fact]
    public async Task StreamAsync_AppendsAssistantResponseToHistory()
    {
        var sessionStore = new SessionStore();
        var service = CreateService(new FakeChatClient("Hello", " world"), sessionStore);
        var request = new ChatRequest(
            [new Models.ChatMessage("user", "braindump")],
            "test-session");

        await foreach (var _ in service.StreamAsync(request, "test-jwt", CancellationToken.None)) { }

        var history = sessionStore.GetOrCreate("test-session");
        Assert.Equal("Hello world", history[2].Text);
        Assert.Equal(ChatRole.Assistant, history[2].Role);
    }

    [Fact]
    public async Task StreamAsync_MaintainsHistoryAcrossCalls()
    {
        var sessionStore = new SessionStore();
        var service = CreateService(new FakeChatClient("response"), sessionStore);

        var req1 = new ChatRequest(
            [new Models.ChatMessage("user", "first")],
            "test-session");
        await foreach (var _ in service.StreamAsync(req1, "test-jwt", CancellationToken.None)) { }

        var req2 = new ChatRequest(
            [new Models.ChatMessage("user", "second")],
            "test-session");
        await foreach (var _ in service.StreamAsync(req2, "test-jwt", CancellationToken.None)) { }

        var history = sessionStore.GetOrCreate("test-session");
        // system + user1 + assistant1 + user2 + assistant2
        Assert.Equal(5, history.Count);
    }

    [Fact]
    public async Task StreamAsync_WhenNoFunctionCall_YieldsNoProposal()
    {
        var service = CreateService(new FakeChatClient("Just text"));
        var request = new ChatRequest(
            [new Models.ChatMessage("user", "hello")],
            "test-no-proposal");

        var hasProposal = false;
        await foreach (var chunk in service.StreamAsync(request, "test-jwt", CancellationToken.None))
        {
            if (chunk.IsProposal)
                hasProposal = true;
        }

        Assert.False(hasProposal);
    }
}
