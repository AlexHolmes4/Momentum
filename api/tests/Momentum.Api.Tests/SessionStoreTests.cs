using Microsoft.Extensions.AI;
using Momentum.Api.Services;

namespace Momentum.Api.Tests;

public class SessionStoreTests
{
    [Fact]
    public void GetOrCreate_NewSession_ReturnsListWithSystemPrompt()
    {
        var store = new SessionStore();

        var history = store.GetOrCreate("session-1");

        Assert.NotNull(history);
        Assert.Single(history);
        Assert.Equal(ChatRole.System, history[0].Role);
    }

    [Fact]
    public void GetOrCreate_ExistingSession_ReturnsSameInstance()
    {
        var store = new SessionStore();

        var first = store.GetOrCreate("session-1");
        first.Add(new ChatMessage(ChatRole.User, "hello"));

        var second = store.GetOrCreate("session-1");

        Assert.Same(first, second);
        Assert.Equal(2, second.Count);
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

        var systemMessage = history[0].Text!;
        Assert.Contains("goal-setting assistant", systemMessage, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("propose_goals", systemMessage);
    }
}
