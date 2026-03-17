using System.ComponentModel;
using System.Text.Json;
using ModelContextProtocol.Server;
using Momentum.Api.Models;
using Momentum.Api.Services;

namespace Momentum.Api.Tools;

[McpServerToolType]
public class MomentumTools(SupabaseDataService dataService)
{
    [McpServerTool("get_goals"), Description("Get all active goals for the current user")]
    public Task<List<Goal>> GetGoals(string userJwt, CancellationToken ct)
    {
        return dataService.GetGoalsAsync(userJwt, ct);
    }

    [McpServerTool("get_tasks"), Description("Get active tasks, optionally filtered by goal ID")]
    public Task<List<TaskItem>> GetTasks(string userJwt, string? goalId, CancellationToken ct)
    {
        return dataService.GetTasksAsync(userJwt, goalId, ct);
    }

    [McpServerTool("create_goal"), Description("Create a new goal")]
    public Task<Goal> CreateGoal(string userJwt, string title, string? description, string? targetDate, CancellationToken ct)
    {
        return dataService.CreateGoalAsync(userJwt, new(title, description, targetDate), ct);
    }

    [McpServerTool("create_task"), Description("Create a new task")]
    public Task<TaskItem> CreateTask(string userJwt, string title, string priority, string? dueDate, string? category, string? goalId, CancellationToken ct)
    {
        return dataService.CreateTaskAsync(userJwt, new(title, priority, dueDate, category, goalId), ct);
    }

    [McpServerTool("complete_task"), Description("Mark a task as complete (archives it)")]
    public Task CompleteTask(string userJwt, string taskId, CancellationToken ct)
    {
        return dataService.CompleteTaskAsync(userJwt, taskId, ct);
    }

    [McpServerTool("propose_goals"), Description("Propose structured goals with linked tasks for user review")]
    public string ProposeGoals(List<ProposedGoal> goals)
    {
        return JsonSerializer.Serialize(new GoalProposal(goals));
    }

    [McpServerTool("brain_dump"), Description("Decompose a brain dump into clarifying questions or goal/task proposals")]
    public string BrainDump(string text)
    {
        return $"Please analyze and decompose the following brain dump into goals and tasks:\n\n{text}";
    }
}
