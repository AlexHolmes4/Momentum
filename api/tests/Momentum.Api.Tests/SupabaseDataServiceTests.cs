using System.Net;
using System.Text.Json;
using Momentum.Api.Models;
using Momentum.Api.Services;
using Microsoft.Extensions.Configuration;

namespace Momentum.Api.Tests;

public class SupabaseDataServiceTests
{
    private const string TestJwt = "test-jwt-token";
    private const string PublishableKey = "sb_test_key";
    private const string SupabaseUrl = "https://test.supabase.co";

    private static (SupabaseDataService service, MockHttpHandler handler) CreateService(
        HttpStatusCode statusCode = HttpStatusCode.OK, string responseBody = "[]")
    {
        var handler = new MockHttpHandler(statusCode, responseBody);
        var httpClient = new HttpClient(handler) { BaseAddress = new Uri(SupabaseUrl) };
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Supabase:PublishableKey"] = PublishableKey
            })
            .Build();
        var service = new SupabaseDataService(httpClient, config);
        return (service, handler);
    }

    [Fact]
    public async Task GetGoalsAsync_sends_correct_request()
    {
        var goals = new[] { new { id = "1", title = "Test Goal", description = (string?)null, target_date = (string?)null, status = "active", created_at = "2026-01-01" } };
        var (service, handler) = CreateService(responseBody: JsonSerializer.Serialize(goals));

        var result = await service.GetGoalsAsync(TestJwt, CancellationToken.None);

        Assert.Single(result);
        Assert.Equal("Test Goal", result[0].Title);
        Assert.Equal($"Bearer {TestJwt}", handler.LastRequest!.Headers.Authorization!.ToString());
        Assert.Equal(PublishableKey, handler.LastRequest.Headers.GetValues("apikey").First());
        Assert.Contains("status=eq.active", handler.LastRequest.RequestUri!.Query);
    }

    [Fact]
    public async Task GetTasksAsync_without_goalId_fetches_all_active()
    {
        var tasks = new[] { new { id = "1", title = "Task 1", priority = "high", due_date = (string?)null, category = (string?)null, goal_id = (string?)null, status = "active", created_at = "2026-01-01" } };
        var (service, handler) = CreateService(responseBody: JsonSerializer.Serialize(tasks));

        var result = await service.GetTasksAsync(TestJwt, null, CancellationToken.None);

        Assert.Single(result);
        Assert.DoesNotContain("goal_id", handler.LastRequest!.RequestUri!.Query);
    }

    [Fact]
    public async Task GetTasksAsync_with_goalId_filters()
    {
        var (service, handler) = CreateService(responseBody: "[]");

        await service.GetTasksAsync(TestJwt, "goal-123", CancellationToken.None);

        Assert.Contains("goal_id=eq.goal-123", handler.LastRequest!.RequestUri!.Query);
    }

    [Fact]
    public async Task CreateGoalAsync_posts_correct_body()
    {
        var created = new[] { new { id = "new-1", title = "New Goal", description = "Desc", target_date = "2026-12-31", status = "active", created_at = "2026-01-01" } };
        var (service, handler) = CreateService(HttpStatusCode.Created, JsonSerializer.Serialize(created));

        var result = await service.CreateGoalAsync(TestJwt, new("New Goal", "Desc", "2026-12-31"), CancellationToken.None);

        Assert.Equal("New Goal", result.Title);
        Assert.Equal(HttpMethod.Post, handler.LastRequest!.Method);
        Assert.Contains("/rest/v1/goals", handler.LastRequest.RequestUri!.AbsolutePath);

        var body = await handler.LastRequest.Content!.ReadAsStringAsync();
        Assert.Contains("New Goal", body);
    }

    [Fact]
    public async Task CreateTaskAsync_posts_correct_body()
    {
        var created = new[] { new { id = "new-1", title = "New Task", priority = "high", due_date = (string?)null, category = (string?)null, goal_id = (string?)null, status = "active", created_at = "2026-01-01" } };
        var (service, handler) = CreateService(HttpStatusCode.Created, JsonSerializer.Serialize(created));

        var result = await service.CreateTaskAsync(TestJwt, new("New Task", "high", null, null, null), CancellationToken.None);

        Assert.Equal("New Task", result.Title);
        Assert.Equal(HttpMethod.Post, handler.LastRequest!.Method);
    }

    [Fact]
    public async Task CompleteTaskAsync_archives_then_deletes()
    {
        var (service, handler) = CreateService();

        await service.CompleteTaskAsync(TestJwt, "task-1", CancellationToken.None);

        // Should be 2 requests: POST to archived_tasks, DELETE from tasks
        Assert.Equal(2, handler.AllRequests.Count);
        Assert.Equal(HttpMethod.Post, handler.AllRequests[0].Method);
        Assert.Contains("/rest/v1/archived_tasks", handler.AllRequests[0].RequestUri!.AbsolutePath);
        Assert.Equal(HttpMethod.Delete, handler.AllRequests[1].Method);
        Assert.Contains("/rest/v1/tasks", handler.AllRequests[1].RequestUri!.AbsolutePath);
        Assert.Contains("id=eq.task-1", handler.AllRequests[1].RequestUri!.Query);
    }
}

/// <summary>Mock HttpMessageHandler that captures requests and returns configurable responses.</summary>
public class MockHttpHandler(HttpStatusCode statusCode = HttpStatusCode.OK, string responseBody = "[]") : HttpMessageHandler
{
    public HttpRequestMessage? LastRequest { get; private set; }
    public List<HttpRequestMessage> AllRequests { get; } = [];

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        LastRequest = request;
        AllRequests.Add(request);
        return Task.FromResult(new HttpResponseMessage(statusCode)
        {
            Content = new StringContent(responseBody, System.Text.Encoding.UTF8, "application/json")
        });
    }
}
