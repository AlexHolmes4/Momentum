using Microsoft.SemanticKernel.ChatCompletion;
using Momentum.Api.Services;

namespace Momentum.Api.Tests;

public class SessionStoreTests
{
    [Fact]
    public void GetOrCreate_NewSession_ReturnsChatHistoryWithSystemPrompt()
    {
        var store = new SessionStore();

        var history = store.GetOrCreate("session-1");

        Assert.NotNull(history);
        Assert.Single(history); // system prompt only
        Assert.Equal(AuthorRole.System, history[0].Role);
    }

    [Fact]
    public void GetOrCreate_ExistingSession_ReturnsSameInstance()
    {
        var store = new SessionStore();

        var first = store.GetOrCreate("session-1");
        first.AddUserMessage("hello");

        var second = store.GetOrCreate("session-1");

        Assert.Same(first, second);
        Assert.Equal(2, second.Count); // system prompt + user message
    }

    [Fact]
    public void GetOrCreate_DifferentSessions_ReturnsDifferentInstances()
    {
        var store = new SessionStore();

        var a = store.GetOrCreate("session-a");
        var b = store.GetOrCreate("session-b");

        Assert.NotSame(a, b);
    }

    [Fact]
    public void SystemPrompt_ContainsMomentumInstructions()
    {
        var store = new SessionStore();

        var history = store.GetOrCreate("session-1");

        var systemMessage = history[0].Content!;
        Assert.Contains("goal-setting assistant", systemMessage, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("propose_goals", systemMessage);
    }
}
