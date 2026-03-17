namespace Momentum.Api.Models;

public record CreateGoalRequest(string Title, string? Description, string? TargetDate);
