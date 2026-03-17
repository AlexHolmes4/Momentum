using System.Runtime.CompilerServices;
using Microsoft.Extensions.AI;

namespace Momentum.Api.Tests.Helpers;

/// <summary>
/// Fake IChatClient that returns configurable text chunks for streaming.
/// </summary>
public class FakeChatClient : IChatClient
{
    private readonly string[] _chunks;

    public FakeChatClient(params string[] chunks)
    {
        _chunks = chunks.Length > 0 ? chunks : ["Hello", " from", " AI"];
    }

    public ChatClientMetadata Metadata => new("FakeProvider", null, "fake-model");

    public Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> chatMessages,
        ChatOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        var fullText = string.Join("", _chunks);
        var message = new ChatMessage(ChatRole.Assistant, fullText);
        return Task.FromResult(new ChatResponse([message]));
    }

    public async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> chatMessages,
        ChatOptions? options = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        foreach (var chunk in _chunks)
        {
            await Task.Yield();
            yield return new ChatResponseUpdate
            {
                Role = ChatRole.Assistant,
                Contents = [new TextContent(chunk)]
            };
        }
    }

    public object? GetService(Type serviceType, object? key = null) => null;

    public void Dispose() { }
}
