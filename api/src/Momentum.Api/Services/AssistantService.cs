using System.Runtime.CompilerServices;
using System.Text;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Momentum.Api.Models;
using Momentum.Api.Plugins;

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

    public async IAsyncEnumerable<StreamChunk> StreamAsync(
        ChatRequest request,
        string userId,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var sessionKey = $"{userId}:{request.SessionId}";
        var sessionLock = _sessionStore.GetLock(sessionKey);
        await sessionLock.WaitAsync(cancellationToken);
        try
        {
            var history = _sessionStore.GetOrCreate(sessionKey);

            // Only the last message is appended — server-side history is the source of truth.
            var lastMessage = request.Messages[^1];
            history.AddUserMessage(lastMessage.Content);

            // Build kernel with proposal plugin for function calling
            var plugin = new GoalProposalPlugin();
            var kernelBuilder = Kernel.CreateBuilder();
            kernelBuilder.Services.AddSingleton(_chatService);
            var kernel = kernelBuilder.Build();
            kernel.Plugins.AddFromObject(plugin);

            var settings = new PromptExecutionSettings
            {
                FunctionChoiceBehavior = FunctionChoiceBehavior.Auto()
            };

            // Stream the AI response
            var fullResponse = new StringBuilder();
            await foreach (var chunk in _chatService.GetStreamingChatMessageContentsAsync(
                history, settings, kernel, cancellationToken))
            {
                var content = chunk.Content ?? string.Empty;
                if (content.Length > 0)
                {
                    fullResponse.Append(content);
                    yield return StreamChunk.TextToken(content);
                }
            }

            // Append full assistant response to history
            if (fullResponse.Length > 0)
                history.AddAssistantMessage(fullResponse.ToString());

            // If the AI called propose_goals, yield the proposal
            if (plugin.CapturedProposal != null)
                yield return StreamChunk.GoalProposal(plugin.CapturedProposal);
        }
        finally
        {
            sessionLock.Release();
        }
    }
}
