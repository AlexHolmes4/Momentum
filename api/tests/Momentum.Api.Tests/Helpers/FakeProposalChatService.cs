using System.Runtime.CompilerServices;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Momentum.Api.Models;

namespace Momentum.Api.Tests.Helpers;

/// <summary>
/// Simulates the AI calling propose_goals by invoking the kernel function directly.
/// </summary>
public class FakeProposalChatService : IChatCompletionService
{
    public IReadOnlyDictionary<string, object?> Attributes => new Dictionary<string, object?>();

    public Task<IReadOnlyList<ChatMessageContent>> GetChatMessageContentsAsync(
        ChatHistory chatHistory,
        PromptExecutionSettings? executionSettings = null,
        Kernel? kernel = null,
        CancellationToken cancellationToken = default)
    {
        var result = new List<ChatMessageContent>
        {
            new(AuthorRole.Assistant, "Here is my proposal.")
        };
        return Task.FromResult<IReadOnlyList<ChatMessageContent>>(result);
    }

    public async IAsyncEnumerable<StreamingChatMessageContent> GetStreamingChatMessageContentsAsync(
        ChatHistory chatHistory,
        PromptExecutionSettings? executionSettings = null,
        Kernel? kernel = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        // Simulate the AI calling propose_goals by directly invoking the kernel function
        if (kernel != null)
        {
            var fn = kernel.Plugins.GetFunction("GoalProposalPlugin", "ProposeGoals");
            var goals = new List<ProposedGoal>
            {
                new("Get fit", "Health and fitness goal", "2026-06-01", [
                    new("Run 5k", "high", "2026-04-01", "Health"),
                    new("Join gym", "medium", null, "Health")
                ])
            };
            var goalsJson = System.Text.Json.JsonSerializer.Serialize(goals);
            await fn.InvokeAsync(kernel, new KernelArguments { ["goals"] = goalsJson });
        }

        // Don't yield text tokens — function call is the only output
        await Task.CompletedTask;
        yield break;
    }
}
