using System.Runtime.CompilerServices;
using System.Text;
using Microsoft.SemanticKernel.ChatCompletion;
using Momentum.Api.Models;

namespace Momentum.Api.Services;

public class AssistantService
{
    private readonly IChatCompletionService _chatService;
    private readonly SessionStore _sessionStore;

    public AssistantService(IChatCompletionService chatService, SessionStore sessionStore)
    {
        _chatService = chatService;
        _sessionStore = sessionStore;
    }

    public async IAsyncEnumerable<string> StreamAsync(
        ChatRequest request,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var history = _sessionStore.GetOrCreate(request.SessionId);

        // Add the latest user message to history
        var lastMessage = request.Messages[^1];
        history.AddUserMessage(lastMessage.Content);

        // Stream the AI response
        var fullResponse = new StringBuilder();
        await foreach (var chunk in _chatService.GetStreamingChatMessageContentsAsync(
            history, cancellationToken: cancellationToken))
        {
            var content = chunk.Content ?? string.Empty;
            if (content.Length > 0)
            {
                fullResponse.Append(content);
                yield return content;
            }
        }

        // Append full assistant response to history
        history.AddAssistantMessage(fullResponse.ToString());
    }
}
