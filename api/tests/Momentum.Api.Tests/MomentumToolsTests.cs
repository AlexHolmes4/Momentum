using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Momentum.Api.Models;
using Momentum.Api.Services;
using Momentum.Api.Tools;

namespace Momentum.Api.Tests;

public class MomentumToolsTests
{
    private const string TestJwt = "test-jwt-token";

    private static MomentumTools CreateTools(MockHttpHandler? handler = null)
    {
        handler ??= new MockHttpHandler(HttpStatusCode.OK, "[]");
        var httpClient = new HttpClient(handler) { BaseAddress = new Uri("https://test.supabase.co") };
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Supabase:PublishableKey"] = "sb_test_key"
            })
            .Build();
        var dataService = new SupabaseDataService(httpClient, config);

        // Create a fake IHttpContextAccessor with a Bearer token
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers.Authorization = $"Bearer {TestJwt}";
        var accessor = new HttpContextAccessor { HttpContext = httpContext };

        return new MomentumTools(dataService, accessor);
    }

    [Fact]
    public async Task GetGoals_delegates_to_data_service()
    {
        var goals = new[] { new { id = "1", title = "Goal", description = (string?)null, target_date = (string?)null, status = "active", created_at = "2026-01-01" } };
        var handler = new MockHttpHandler(HttpStatusCode.OK, JsonSerializer.Serialize(goals));
        var tools = CreateTools(handler);

        var result = await tools.GetGoals(CancellationToken.None);

        Assert.Single(result);
        Assert.Equal("Goal", result[0].Title);
    }

    [Fact]
    public async Task CreateGoal_delegates_to_data_service()
    {
        var created = new[] { new { id = "1", title = "New", description = (string?)null, target_date = (string?)null, status = "active", created_at = "2026-01-01" } };
        var handler = new MockHttpHandler(HttpStatusCode.Created, JsonSerializer.Serialize(created));
        var tools = CreateTools(handler);

        var result = await tools.CreateGoal("New", null, null, CancellationToken.None);

        Assert.Equal("New", result.Title);
    }

    [Fact]
    public void ProposeGoals_returns_serialized_proposal()
    {
        var tools = CreateTools();
        var goals = new List<ProposedGoal>
        {
            new("Get fit", null, null, [new("Run 5k", "high", null, null)])
        };

        var result = tools.ProposeGoals(goals);

        var proposal = JsonSerializer.Deserialize<GoalProposal>(result);
        Assert.NotNull(proposal);
        Assert.Single(proposal!.Goals);
        Assert.Equal("Get fit", proposal.Goals[0].Title);
    }

    [Fact]
    public void BrainDump_returns_analysis_prompt()
    {
        var tools = CreateTools();

        var result = tools.BrainDump("I want to learn guitar and read more books");

        Assert.Contains("brain dump", result);
        Assert.Contains("learn guitar", result);
    }
}
