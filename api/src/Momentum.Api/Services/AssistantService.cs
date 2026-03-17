using System.Runtime.CompilerServices;
using System.Text;
using Microsoft.Extensions.AI;
using Momentum.Api.Models;
using AiChatMessage = Microsoft.Extensions.AI.ChatMessage;

namespace Momentum.Api.Services;

public class AssistantService(IChatClient chatClient, SessionStore sessionStore)
{
    public async IAsyncEnumerable<StreamChunk> StreamAsync(
        ChatRequest request, string userId,
        [EnumeratorCancellation] CancellationToken ct)
    {
        var sessionKey = $"{userId}:{request.SessionId}";
        var sessionLock = sessionStore.GetLock(sessionKey);
        await sessionLock.WaitAsync(ct);

        try
        {
            var history = sessionStore.GetOrCreate(sessionKey);

            // Only the last message is appended — server-side history is the source of truth.
            var lastMessage = request.Messages[^1];
            history.Add(new AiChatMessage(
                new ChatRole(lastMessage.Role), lastMessage.Content));

            // Stream response
            var fullResponse = new StringBuilder();
            await foreach (var update in chatClient.GetStreamingResponseAsync(history, null, ct))
            {
                if (update.Text is { Length: > 0 } text)
                {
                    fullResponse.Append(text);
                    yield return StreamChunk.TextToken(text);
                }
            }

            // Append assistant response to history
            if (fullResponse.Length > 0)
                history.Add(new AiChatMessage(ChatRole.Assistant, fullResponse.ToString()));
        }
        finally
        {
            sessionLock.Release();
        }
    }
}
