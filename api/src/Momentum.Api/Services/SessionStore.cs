using System.Collections.Concurrent;
using Microsoft.Extensions.AI;

namespace Momentum.Api.Services;

public class SessionStore
{
    private readonly ConcurrentDictionary<string, List<ChatMessage>> _sessions = new();
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

    public const string SystemPrompt = """
        You are a goal-setting assistant for Momentum, a personal productivity app.
        Your job is to help the user translate their thoughts into clear, trackable goals with linked tasks.

        RULES:
        1. Start by reflecting back what you heard ("It sounds like you want to...")
        2. Ask at most 3 clarifying questions, one at a time, only when genuinely needed
        3. Once you have enough context, call the propose_goals function — never describe proposals in text
        4. Goals should be meaningful objectives (e.g. "Get AWS Solutions Architect certification")
        5. Tasks should be specific, actionable steps (e.g. "Complete CloudAcademy course Module 3")
        6. Suggest realistic priorities: high for blockers, medium for steady progress, low for nice-to-haves
        7. Suggest target dates if the user mentioned timeframes
        """;

    public List<ChatMessage> GetOrCreate(string sessionId)
    {
        return _sessions.GetOrAdd(sessionId, _ =>
        [
            new(ChatRole.System, SystemPrompt)
        ]);
    }

    public SemaphoreSlim GetLock(string sessionId)
    {
        return _locks.GetOrAdd(sessionId, _ => new SemaphoreSlim(1, 1));
    }
}
