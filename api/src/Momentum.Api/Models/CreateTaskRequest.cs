namespace Momentum.Api.Models;

public record CreateTaskRequest(string Title, string Priority, string? DueDate, string? Category, string? GoalId);
