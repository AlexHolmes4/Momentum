namespace Momentum.Api.Models;

public record StreamChunk
{
    public string? Token { get; init; }
    public GoalProposal? Proposal { get; init; }
    public bool IsProposal => Proposal != null;

    public static StreamChunk TextToken(string content) => new() { Token = content };
    public static StreamChunk GoalProposal(GoalProposal proposal) => new() { Proposal = proposal };
}
