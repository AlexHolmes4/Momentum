namespace Momentum.Api.Models;

public record ProposedTask(string Title, string Priority, string? DueDate, string? Category);

public record ProposedGoal(string Title, string? Description, string? TargetDate, List<ProposedTask> Tasks);

public record GoalProposal(List<ProposedGoal> Goals);
