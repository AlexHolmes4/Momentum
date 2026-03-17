using System.ComponentModel;
using System.Text.Json;
using ModelContextProtocol.Server;
using Momentum.Api.Models;
using Momentum.Api.Services;

namespace Momentum.Api.Tools;

[McpServerToolType]
public class MomentumTools(SupabaseDataService dataService, IHttpContextAccessor httpContextAccessor)
{
    private string ExtractJwt()
    {
        var httpContext = httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException("No HTTP context available");
        var auth = httpContext.Request.Headers.Authorization.ToString();
        return auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? auth["Bearer ".Length..]
            : throw new UnauthorizedAccessException("Missing Bearer token");
    }

    [McpServerTool(Name = "get_goals", ReadOnly = true)]
    [Description("Get all active goals for the current user")]
    public Task<List<Goal>> GetGoals(CancellationToken ct)
    {
        return dataService.GetGoalsAsync(ExtractJwt(), ct);
    }

    [McpServerTool(Name = "get_tasks", ReadOnly = true)]
    [Description("Get active tasks, optionally filtered by goal ID")]
    public Task<List<TaskItem>> GetTasks(string? goalId, CancellationToken ct)
    {
        return dataService.GetTasksAsync(ExtractJwt(), goalId, ct);
    }

    [McpServerTool(Name = "create_goal", Destructive = false)]
    [Description("Create a new goal")]
    public Task<Goal> CreateGoal(string title, string? description, string? targetDate, CancellationToken ct)
    {
        return dataService.CreateGoalAsync(ExtractJwt(), new(title, description, targetDate), ct);
    }

    [McpServerTool(Name = "create_task", Destructive = false)]
    [Description("Create a new task")]
    public Task<TaskItem> CreateTask(string title, string priority, string? dueDate, string? category, string? goalId, CancellationToken ct)
    {
        return dataService.CreateTaskAsync(ExtractJwt(), new(title, priority, dueDate, category, goalId), ct);
    }

    [McpServerTool(Name = "complete_task", Destructive = true)]
    [Description("Mark a task as complete (archives it)")]
    public Task CompleteTask(string taskId, CancellationToken ct)
    {
        return dataService.CompleteTaskAsync(ExtractJwt(), taskId, ct);
    }

    [McpServerTool(Name = "propose_goals", Destructive = false)]
    [Description("Propose structured goals with linked tasks for user review")]
    public string ProposeGoals(List<ProposedGoal> goals)
    {
        return JsonSerializer.Serialize(new GoalProposal(goals));
    }

    [McpServerTool(Name = "brain_dump", ReadOnly = true)]
    [Description("Decompose a brain dump into clarifying questions or goal/task proposals")]
    public string BrainDump(string text)
    {
        return $"Please analyze and decompose the following brain dump into goals and tasks:\n\n{text}";
    }
}
