using Microsoft.SemanticKernel.ChatCompletion;
using Momentum.Api.Models;
using Momentum.Api.Services;
using Momentum.Api.Tests.Helpers;

namespace Momentum.Api.Tests;

public class AssistantServiceTests
{
    [Fact]
    public async Task StreamAsync_YieldsTokenChunks()
    {
        var chatService = new FakeChatCompletionService("Hello", " world", "!");
        var sessionStore = new SessionStore();
        var service = new AssistantService(chatService, sessionStore);
        var request = new ChatRequest(
            [new ChatMessage("user", "I want to get fit")],
            "test-session");

        var tokens = new List<string>();
        await foreach (var chunk in service.StreamAsync(request, "test-user", CancellationToken.None))
        {
            if (!chunk.IsProposal)
                tokens.Add(chunk.Token!);
        }

        Assert.Equal(["Hello", " world", "!"], tokens);
    }

    [Fact]
    public async Task StreamAsync_AddsUserMessageToHistory()
    {
        var chatService = new FakeChatCompletionService("response");
        var sessionStore = new SessionStore();
        var service = new AssistantService(chatService, sessionStore);
        var request = new ChatRequest(
            [new ChatMessage("user", "I want to learn piano")],
            "test-session");

        // Consume the stream
        await foreach (var _ in service.StreamAsync(request, "test-user", CancellationToken.None)) { }

        var history = sessionStore.GetOrCreate("test-user:test-session");
        // system + user + assistant
        Assert.Equal(3, history.Count);
        Assert.Equal("I want to learn piano", history[1].Content);
        Assert.Equal(AuthorRole.User, history[1].Role);
    }

    [Fact]
    public async Task StreamAsync_AppendsAssistantResponseToHistory()
    {
        var chatService = new FakeChatCompletionService("Hello", " world");
        var sessionStore = new SessionStore();
        var service = new AssistantService(chatService, sessionStore);
        var request = new ChatRequest(
            [new ChatMessage("user", "braindump")],
            "test-session");

        await foreach (var _ in service.StreamAsync(request, "test-user", CancellationToken.None)) { }

        var history = sessionStore.GetOrCreate("test-user:test-session");
        Assert.Equal("Hello world", history[2].Content);
        Assert.Equal(AuthorRole.Assistant, history[2].Role);
    }

    [Fact]
    public async Task StreamAsync_MaintainsHistoryAcrossCalls()
    {
        var chatService = new FakeChatCompletionService("response");
        var sessionStore = new SessionStore();
        var service = new AssistantService(chatService, sessionStore);

        // First message
        var req1 = new ChatRequest(
            [new ChatMessage("user", "first")],
            "test-session");
        await foreach (var _ in service.StreamAsync(req1, "test-user", CancellationToken.None)) { }

        // Second message — history should include first exchange
        var req2 = new ChatRequest(
            [new ChatMessage("user", "second")],
            "test-session");
        await foreach (var _ in service.StreamAsync(req2, "test-user", CancellationToken.None)) { }

        var history = sessionStore.GetOrCreate("test-user:test-session");
        // system + user1 + assistant1 + user2 + assistant2
        Assert.Equal(5, history.Count);
    }

    [Fact]
    public async Task StreamAsync_WhenAICallsProposeGoals_YieldsProposal()
    {
        var chatService = new FakeProposalChatService();
        var sessionStore = new SessionStore();
        var service = new AssistantService(chatService, sessionStore);
        var request = new ChatRequest(
            [new ChatMessage("user", "I want to get fit")],
            "test-proposal");

        StreamChunk? proposalChunk = null;
        await foreach (var chunk in service.StreamAsync(request, "test-user", CancellationToken.None))
        {
            if (chunk.IsProposal)
                proposalChunk = chunk;
        }

        Assert.NotNull(proposalChunk);
        Assert.NotNull(proposalChunk!.Proposal);
        Assert.Single(proposalChunk.Proposal!.Goals);
        Assert.Equal("Get fit", proposalChunk.Proposal.Goals[0].Title);
    }

    [Fact]
    public async Task StreamAsync_WhenNoFunctionCall_YieldsNoProposal()
    {
        var chatService = new FakeChatCompletionService("Just text");
        var sessionStore = new SessionStore();
        var service = new AssistantService(chatService, sessionStore);
        var request = new ChatRequest(
            [new ChatMessage("user", "hello")],
            "test-no-proposal");

        var hasProposal = false;
        await foreach (var chunk in service.StreamAsync(request, "test-user", CancellationToken.None))
        {
            if (chunk.IsProposal)
                hasProposal = true;
        }

        Assert.False(hasProposal);
    }
}
