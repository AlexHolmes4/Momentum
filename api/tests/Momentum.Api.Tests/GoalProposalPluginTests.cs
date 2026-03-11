using Momentum.Api.Models;
using Momentum.Api.Plugins;

namespace Momentum.Api.Tests;

public class GoalProposalPluginTests
{
    [Fact]
    public void ProposeGoals_CapturesProposal()
    {
        var plugin = new GoalProposalPlugin();
        var goals = new List<ProposedGoal>
        {
            new("Get fit", "Health and fitness", "2026-06-01", [
                new("Run 5k", "high", "2026-04-01", "Health"),
                new("Join gym", "medium", null, "Health")
            ])
        };

        var result = plugin.ProposeGoals(goals);

        Assert.NotNull(plugin.CapturedProposal);
        Assert.Single(plugin.CapturedProposal.Goals);
        Assert.Equal("Get fit", plugin.CapturedProposal.Goals[0].Title);
        Assert.Equal(2, plugin.CapturedProposal.Goals[0].Tasks.Count);
        Assert.Equal("Proposal created successfully.", result);
    }

    [Fact]
    public void ProposeGoals_CapturesMultipleGoals()
    {
        var plugin = new GoalProposalPlugin();
        var goals = new List<ProposedGoal>
        {
            new("Learn piano", null, null, [
                new("Buy keyboard", "high", null, "Music")
            ]),
            new("Read more", "Read 20 books", "2026-12-31", [
                new("Pick first book", "low", null, "Reading")
            ])
        };

        plugin.ProposeGoals(goals);

        Assert.Equal(2, plugin.CapturedProposal!.Goals.Count);
        Assert.Equal("Learn piano", plugin.CapturedProposal.Goals[0].Title);
        Assert.Equal("Read more", plugin.CapturedProposal.Goals[1].Title);
    }

    [Fact]
    public void CapturedProposal_IsNullBeforeInvocation()
    {
        var plugin = new GoalProposalPlugin();

        Assert.Null(plugin.CapturedProposal);
    }
}
