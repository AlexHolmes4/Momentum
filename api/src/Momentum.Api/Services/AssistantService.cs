using System.Runtime.CompilerServices;
using System.Text;
using Microsoft.Extensions.AI;
using Momentum.Api.Models;
using AiChatMessage = Microsoft.Extensions.AI.ChatMessage;

namespace Momentum.Api.Services;

public class AssistantService(
    IChatClient chatClient,
    SessionStore sessionStore,
    SupabaseDataService dataService)
{
    public async IAsyncEnumerable<StreamChunk> StreamAsync(
        ChatRequest request, string userJwt,
        [EnumeratorCancellation] CancellationToken ct)
    {
        var sessionKey = $"{request.SessionId}";
        var sessionLock = sessionStore.GetLock(sessionKey);
        await sessionLock.WaitAsync(ct);

        try
        {
            var history = sessionStore.GetOrCreate(sessionKey);

            // Only the last message is appended — server-side history is the source of truth.
            var lastMessage = request.Messages[^1];
            history.Add(new AiChatMessage(
                new ChatRole(lastMessage.Role), lastMessage.Content));

            // Capture variable for proposal detection
            GoalProposal? capturedProposal = null;

            // Build per-request tools with JWT captured in closures
            var tools = new List<AITool>
            {
                AIFunctionFactory.Create(
                    () => dataService.GetGoalsAsync(userJwt, ct),
                    "get_goals", "Get all active goals"),
                AIFunctionFactory.Create(
                    (string? goalId) => dataService.GetTasksAsync(userJwt, goalId, ct),
                    "get_tasks", "Get active tasks, optionally filtered by goal ID"),
                AIFunctionFactory.Create(
                    (string title, string? description, string? targetDate) =>
                        dataService.CreateGoalAsync(userJwt, new(title, description, targetDate), ct),
                    "create_goal", "Create a new goal"),
                AIFunctionFactory.Create(
                    (string title, string priority, string? dueDate, string? category, string? goalId) =>
                        dataService.CreateTaskAsync(userJwt, new(title, priority, dueDate, category, goalId), ct),
                    "create_task", "Create a new task"),
                AIFunctionFactory.Create(
                    (string taskId) => dataService.CompleteTaskAsync(userJwt, taskId, ct),
                    "complete_task", "Mark a task as complete (archives it)"),
                AIFunctionFactory.Create(
                    (List<ProposedGoal> goals) =>
                    {
                        capturedProposal = new GoalProposal(goals);
                        return "Proposal created successfully.";
                    },
                    "propose_goals", "Propose structured goals with linked tasks"),
                AIFunctionFactory.Create(
                    (string text) => $"Please analyze and decompose the following brain dump into goals and tasks:\n\n{text}",
                    "brain_dump", "Decompose a brain dump into clarifying questions or goal/task proposals"),
            };

            var options = new ChatOptions { Tools = tools };

            // Stream response
            var fullResponse = new StringBuilder();
            await foreach (var update in chatClient.GetStreamingResponseAsync(history, options, ct))
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

            // If the AI called propose_goals, yield the proposal
            if (capturedProposal != null)
                yield return StreamChunk.GoalProposal(capturedProposal);
        }
        finally
        {
            sessionLock.Release();
        }
    }
}
