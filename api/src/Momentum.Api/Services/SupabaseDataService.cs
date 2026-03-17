using System.Net.Http.Json;
using Momentum.Api.Models;

namespace Momentum.Api.Services;

public class SupabaseDataService(HttpClient httpClient, IConfiguration config)
{
    private readonly string _publishableKey = config["Supabase:PublishableKey"]
        ?? throw new InvalidOperationException("Supabase:PublishableKey is required");

    public async Task<List<Goal>> GetGoalsAsync(string userJwt, CancellationToken ct)
    {
        var request = BuildRequest(HttpMethod.Get, "/rest/v1/goals?status=eq.active&select=*", userJwt);
        var response = await httpClient.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<List<Goal>>(ct) ?? [];
    }

    public async Task<List<TaskItem>> GetTasksAsync(string userJwt, string? goalId, CancellationToken ct)
    {
        var url = "/rest/v1/tasks?status=eq.active&select=*";
        if (goalId is not null)
            url += $"&goal_id=eq.{goalId}";

        var request = BuildRequest(HttpMethod.Get, url, userJwt);
        var response = await httpClient.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<List<TaskItem>>(ct) ?? [];
    }

    public async Task<Goal> CreateGoalAsync(string userJwt, CreateGoalRequest req, CancellationToken ct)
    {
        var body = new { title = req.Title, description = req.Description, target_date = req.TargetDate, status = "active" };
        var request = BuildRequest(HttpMethod.Post, "/rest/v1/goals", userJwt);
        request.Content = JsonContent.Create(body);
        request.Headers.Add("Prefer", "return=representation");

        var response = await httpClient.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        var goals = await response.Content.ReadFromJsonAsync<List<Goal>>(ct);
        return goals![0];
    }

    public async Task<TaskItem> CreateTaskAsync(string userJwt, CreateTaskRequest req, CancellationToken ct)
    {
        var body = new { title = req.Title, priority = req.Priority, due_date = req.DueDate, category = req.Category, goal_id = req.GoalId, status = "active" };
        var request = BuildRequest(HttpMethod.Post, "/rest/v1/tasks", userJwt);
        request.Content = JsonContent.Create(body);
        request.Headers.Add("Prefer", "return=representation");

        var response = await httpClient.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        var tasks = await response.Content.ReadFromJsonAsync<List<TaskItem>>(ct);
        return tasks![0];
    }

    public async Task CompleteTaskAsync(string userJwt, string taskId, CancellationToken ct)
    {
        // Step 1: Insert into archived_tasks (minimal body with task ID and completed status)
        var archiveBody = new { id = taskId, status = "completed", completed_at = DateTime.UtcNow.ToString("o") };
        var archiveRequest = BuildRequest(HttpMethod.Post, "/rest/v1/archived_tasks", userJwt);
        archiveRequest.Content = JsonContent.Create(archiveBody);
        var archiveResponse = await httpClient.SendAsync(archiveRequest, ct);
        archiveResponse.EnsureSuccessStatusCode();

        // Step 2: Delete from tasks
        var deleteRequest = BuildRequest(HttpMethod.Delete, $"/rest/v1/tasks?id=eq.{taskId}", userJwt);
        var deleteResponse = await httpClient.SendAsync(deleteRequest, ct);
        deleteResponse.EnsureSuccessStatusCode();
    }

    private HttpRequestMessage BuildRequest(HttpMethod method, string path, string userJwt)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", userJwt);
        request.Headers.Add("apikey", _publishableKey);
        return request;
    }
}
