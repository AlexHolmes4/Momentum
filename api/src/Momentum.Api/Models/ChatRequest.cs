namespace Momentum.Api.Models;

public record ChatMessage(string Role, string Content);

public record ChatRequest(List<ChatMessage> Messages, string SessionId);
