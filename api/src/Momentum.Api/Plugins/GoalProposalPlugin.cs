using System.ComponentModel;
using Microsoft.SemanticKernel;
using Momentum.Api.Models;

namespace Momentum.Api.Plugins;

public class GoalProposalPlugin
{
    public GoalProposal? CapturedProposal { get; private set; }

    [KernelFunction, Description("Propose goals and tasks based on the user's brain dump")]
    public string ProposeGoals(
        [Description("List of goals with linked tasks")] List<ProposedGoal> goals)
    {
        CapturedProposal = new GoalProposal(goals);
        return "Proposal created successfully.";
    }
}
