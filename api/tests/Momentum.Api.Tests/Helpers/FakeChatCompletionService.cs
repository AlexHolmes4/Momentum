using System.Runtime.CompilerServices;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;

namespace Momentum.Api.Tests.Helpers;

public class FakeChatCompletionService : IChatCompletionService
{
    private readonly string[] _chunks;

    public FakeChatCompletionService(params string[] chunks)
    {
        _chunks = chunks;
    }

    public IReadOnlyDictionary<string, object?> Attributes => new Dictionary<string, object?>();

    public Task<IReadOnlyList<ChatMessageContent>> GetChatMessageContentsAsync(
        ChatHistory chatHistory,
        PromptExecutionSettings? executionSettings = null,
        Kernel? kernel = null,
        CancellationToken cancellationToken = default)
    {
        var result = new List<ChatMessageContent>
        {
            new(AuthorRole.Assistant, string.Join("", _chunks))
        };
        return Task.FromResult<IReadOnlyList<ChatMessageContent>>(result);
    }

    public async IAsyncEnumerable<StreamingChatMessageContent> GetStreamingChatMessageContentsAsync(
        ChatHistory chatHistory,
        PromptExecutionSettings? executionSettings = null,
        Kernel? kernel = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        foreach (var chunk in _chunks)
        {
            yield return new StreamingChatMessageContent(AuthorRole.Assistant, chunk);
            await Task.Yield(); // simulate async streaming
        }
    }
}
