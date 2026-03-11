# API Session 3: propose_goals Kernel Function & Proposal SSE Event — Implementation Plan

> **Status: COMPLETE** — All 6 tasks implemented and PR'd to `develop` (2026-03-11). 34/34 tests passing.

**Goal:** Add a Semantic Kernel `propose_goals` function that captures structured goal/task proposals, and emit them as `event: proposal` SSE events from the chat endpoint (A011-A012).

**Architecture:** `GoalProposalPlugin` defines a `[KernelFunction]` method `ProposeGoals` that receives a list of `ProposedGoal` objects and stores them in a `CapturedProposal` property. `AssistantService.StreamAsync` builds a `Kernel` with the plugin registered, passes it to `GetStreamingChatMessageContentsAsync` with `FunctionChoiceBehavior.Auto()`. After streaming completes, if the plugin captured a proposal, it yields a `StreamChunk.Proposal`. The endpoint emits `event: proposal` SSE events for proposal chunks and `data: {...}` for token chunks. A `FakeProposalChatService` test helper simulates the AI calling `propose_goals` by invoking the kernel function directly.

**Tech Stack:** .NET 10, ASP.NET Core Minimal APIs, Semantic Kernel 1.73 (`[KernelFunction]`, `FunctionChoiceBehavior.Auto()`), xUnit + WebApplicationFactory

**Design Doc:** `docs/plans/2026-03-09-ai-assistant-design.md` — Sections 4.3, 4.4

**Features covered:** A011 (propose_goals kernel function), A012 (proposal SSE event)

---

### Task 1: DTOs + GoalProposalPlugin (A011)

**Files:**
- Create: `api/src/Momentum.Api/Models/GoalProposal.cs`
- Create: `api/src/Momentum.Api/Plugins/GoalProposalPlugin.cs`
- Create: `api/tests/Momentum.Api.Tests/GoalProposalPluginTests.cs`

**Step 1: Write the failing tests**

Create `api/tests/Momentum.Api.Tests/GoalProposalPluginTests.cs`:

```csharp
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
```

**Step 2: Run tests to verify they fail**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: 3 GoalProposalPlugin tests FAIL — types don't exist yet. Existing 26 tests PASS.

**Step 3: Create DTOs**

Create `api/src/Momentum.Api/Models/GoalProposal.cs`:

```csharp
namespace Momentum.Api.Models;

public record ProposedTask(string Title, string Priority, string? DueDate, string? Category);

public record ProposedGoal(string Title, string? Description, string? TargetDate, List<ProposedTask> Tasks);

public record GoalProposal(List<ProposedGoal> Goals);
```

**Step 4: Create the plugin**

Create `api/src/Momentum.Api/Plugins/GoalProposalPlugin.cs`:

```csharp
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
```

**Step 5: Run tests to verify they pass**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: `Passed! - Failed: 0, Passed: 29`

**Step 6: Commit**

```bash
git add api/
git commit -m "feat: add GoalProposalPlugin with typed DTOs and unit tests"
```

---

### Task 2: StreamChunk type + AssistantService refactor

**Files:**
- Create: `api/src/Momentum.Api/Models/StreamChunk.cs`
- Modify: `api/src/Momentum.Api/Services/AssistantService.cs`
- Modify: `api/tests/Momentum.Api.Tests/AssistantServiceTests.cs`

**Step 1: Create StreamChunk**

Create `api/src/Momentum.Api/Models/StreamChunk.cs`:

```csharp
namespace Momentum.Api.Models;

public record StreamChunk
{
    public string? Token { get; init; }
    public GoalProposal? Proposal { get; init; }
    public bool IsProposal => Proposal != null;

    public static StreamChunk TextToken(string content) => new() { Token = content };
    public static StreamChunk GoalProposal(GoalProposal proposal) => new() { Proposal = proposal };
}
```

**Step 2: Update AssistantServiceTests for new return type**

Modify `api/tests/Momentum.Api.Tests/AssistantServiceTests.cs` — change every `StreamAsync` consumer to work with `StreamChunk`:

```csharp
using Microsoft.SemanticKernel.ChatCompletion;
using Momentum.Api.Models;
using Momentum.Api.Services;
using Momentum.Api.Tests.Helpers;

namespace Momentum.Api.Tests;

public class AssistantServiceTests
{
    [Fact]
    public async Task StreamAsync_YieldsTokenChunks()
    {
        var chatService = new FakeChatCompletionService("Hello", " world", "!");
        var sessionStore = new SessionStore();
        var service = new AssistantService(chatService, sessionStore);
        var request = new ChatRequest(
            [new ChatMessage("user", "I want to get fit")],
            "test-session");

        var tokens = new List<string>();
        await foreach (var chunk in service.StreamAsync(request, CancellationToken.None))
        {
            if (!chunk.IsProposal)
                tokens.Add(chunk.Token!);
        }

        Assert.Equal(["Hello", " world", "!"], tokens);
    }

    [Fact]
    public async Task StreamAsync_AddsUserMessageToHistory()
    {
        var chatService = new FakeChatCompletionService("response");
        var sessionStore = new SessionStore();
        var service = new AssistantService(chatService, sessionStore);
        var request = new ChatRequest(
            [new ChatMessage("user", "I want to learn piano")],
            "test-session");

        // Consume the stream
        await foreach (var _ in service.StreamAsync(request, CancellationToken.None)) { }

        var history = sessionStore.GetOrCreate("test-session");
        // system + user + assistant
        Assert.Equal(3, history.Count);
        Assert.Equal("I want to learn piano", history[1].Content);
        Assert.Equal(AuthorRole.User, history[1].Role);
    }

    [Fact]
    public async Task StreamAsync_AppendsAssistantResponseToHistory()
    {
        var chatService = new FakeChatCompletionService("Hello", " world");
        var sessionStore = new SessionStore();
        var service = new AssistantService(chatService, sessionStore);
        var request = new ChatRequest(
            [new ChatMessage("user", "braindump")],
            "test-session");

        await foreach (var _ in service.StreamAsync(request, CancellationToken.None)) { }

        var history = sessionStore.GetOrCreate("test-session");
        Assert.Equal("Hello world", history[2].Content);
        Assert.Equal(AuthorRole.Assistant, history[2].Role);
    }

    [Fact]
    public async Task StreamAsync_MaintainsHistoryAcrossCalls()
    {
        var chatService = new FakeChatCompletionService("response");
        var sessionStore = new SessionStore();
        var service = new AssistantService(chatService, sessionStore);

        // First message
        var req1 = new ChatRequest(
            [new ChatMessage("user", "first")],
            "test-session");
        await foreach (var _ in service.StreamAsync(req1, CancellationToken.None)) { }

        // Second message — history should include first exchange
        var req2 = new ChatRequest(
            [new ChatMessage("user", "second")],
            "test-session");
        await foreach (var _ in service.StreamAsync(req2, CancellationToken.None)) { }

        var history = sessionStore.GetOrCreate("test-session");
        // system + user1 + assistant1 + user2 + assistant2
        Assert.Equal(5, history.Count);
    }
}
```

**Step 3: Run tests to verify they fail**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: 4 AssistantServiceTests FAIL — `StreamAsync` still returns `string`, not `StreamChunk`. Other tests PASS.

**Step 4: Modify AssistantService to return StreamChunk**

Replace `api/src/Momentum.Api/Services/AssistantService.cs` with:

```csharp
using System.Runtime.CompilerServices;
using System.Text;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Momentum.Api.Models;
using Momentum.Api.Plugins;

namespace Momentum.Api.Services;

public class AssistantService
{
    private readonly IChatCompletionService _chatService;
    private readonly SessionStore _sessionStore;

    public AssistantService(IChatCompletionService chatService, SessionStore sessionStore)
    {
        _chatService = chatService;
        _sessionStore = sessionStore;
    }

    public async IAsyncEnumerable<StreamChunk> StreamAsync(
        ChatRequest request,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var sessionLock = _sessionStore.GetLock(request.SessionId);
        await sessionLock.WaitAsync(cancellationToken);
        try
        {
            var history = _sessionStore.GetOrCreate(request.SessionId);

            // Only the last message is appended — server-side history is the source of truth.
            var lastMessage = request.Messages[^1];
            history.AddUserMessage(lastMessage.Content);

            // Build kernel with proposal plugin for function calling
            var plugin = new GoalProposalPlugin();
            var kernel = Kernel.CreateBuilder().Build();
            kernel.Plugins.AddFromObject(plugin);

            var settings = new PromptExecutionSettings
            {
                FunctionChoiceBehavior = FunctionChoiceBehavior.Auto()
            };

            // Stream the AI response
            var fullResponse = new StringBuilder();
            await foreach (var chunk in _chatService.GetStreamingChatMessageContentsAsync(
                history, settings, kernel, cancellationToken))
            {
                var content = chunk.Content ?? string.Empty;
                if (content.Length > 0)
                {
                    fullResponse.Append(content);
                    yield return StreamChunk.TextToken(content);
                }
            }

            // Append full assistant response to history
            if (fullResponse.Length > 0)
                history.AddAssistantMessage(fullResponse.ToString());

            // If the AI called propose_goals, yield the proposal
            if (plugin.CapturedProposal != null)
                yield return StreamChunk.GoalProposal(plugin.CapturedProposal);
        }
        finally
        {
            sessionLock.Release();
        }
    }
}
```

**Step 5: Run tests to verify they pass**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: `Passed! - Failed: 0, Passed: 29` (all existing + plugin tests pass)

**Step 6: Commit**

```bash
git add api/
git commit -m "refactor: AssistantService returns StreamChunk with proposal support"
```

---

### Task 3: Update SSE endpoint for proposal events (A012)

**Files:**
- Modify: `api/src/Momentum.Api/Program.cs`

**Step 1: Update the endpoint to emit proposal events**

In `api/src/Momentum.Api/Program.cs`, replace the `/api/assistant/chat` endpoint:

```csharp
app.MapPost("/api/assistant/chat", async (
    ChatRequest req,
    IValidator<ChatRequest> validator,
    AssistantService assistant,
    HttpContext ctx) =>
{
    var validationResult = await validator.ValidateAsync(req);
    if (!validationResult.IsValid)
        return Results.ValidationProblem(validationResult.ToDictionary());

    async IAsyncEnumerable<SseItem<object>> StreamEvents(
        [EnumeratorCancellation] CancellationToken ct)
    {
        await foreach (var chunk in assistant.StreamAsync(req, ct))
        {
            if (chunk.IsProposal)
                yield return new SseItem<object>(chunk.Proposal!, "proposal");
            else
                yield return new SseItem<object>(new { type = "token", content = chunk.Token });
        }
        yield return new SseItem<object>(new { }, "done");
    }

    return (IResult)TypedResults.ServerSentEvents(StreamEvents(ctx.RequestAborted));
}).RequireAuthorization().RequireRateLimiting("per-user");
```

**Step 2: Run tests to verify existing tests still pass**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: `Passed! - Failed: 0, Passed: 29` (no regressions)

**Step 3: Commit**

```bash
git add api/src/Momentum.Api/Program.cs
git commit -m "feat: emit event: proposal SSE events for goal proposals"
```

---

### Task 4: FakeProposalChatService + Proposal integration tests (A012)

**Files:**
- Create: `api/tests/Momentum.Api.Tests/Helpers/FakeProposalChatService.cs`
- Modify: `api/tests/Momentum.Api.Tests/Helpers/ApiFactory.cs`
- Create: `api/tests/Momentum.Api.Tests/ProposalEndpointTests.cs`

**Step 1: Write the failing integration tests**

Create `api/tests/Momentum.Api.Tests/ProposalEndpointTests.cs`:

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Momentum.Api.Tests.Helpers;

namespace Momentum.Api.Tests;

public class ProposalEndpointTests : IClassFixture<ProposalApiFactory>
{
    private readonly HttpClient _client;

    public ProposalEndpointTests(ProposalApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    private HttpRequestMessage CreateChatRequest(object body)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/assistant/chat")
        {
            Content = new StringContent(
                JsonSerializer.Serialize(body, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }),
                Encoding.UTF8,
                "application/json")
        };
        request.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", JwtHelper.GenerateToken());
        return request;
    }

    [Fact]
    public async Task Chat_WhenAICallsProposeGoals_EmitsProposalEvent()
    {
        var request = CreateChatRequest(new
        {
            messages = new[] { new { role = "user", content = "I want to get fit" } },
            sessionId = "test-proposal-1"
        });

        var response = await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("event: proposal", body);
    }

    [Fact]
    public async Task Chat_WhenAICallsProposeGoals_ProposalContainsGoals()
    {
        var request = CreateChatRequest(new
        {
            messages = new[] { new { role = "user", content = "I want to get fit" } },
            sessionId = "test-proposal-2"
        });

        var response = await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync();
        // The proposal event data should contain goal information
        Assert.Contains("Get fit", body);
        Assert.Contains("Run 5k", body);
    }

    [Fact]
    public async Task Chat_WhenAICallsProposeGoals_EmitsDoneEvent()
    {
        var request = CreateChatRequest(new
        {
            messages = new[] { new { role = "user", content = "I want to get fit" } },
            sessionId = "test-proposal-3"
        });

        var response = await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("event: done", body);
    }
}
```

**Step 2: Run tests to verify they fail**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: 3 ProposalEndpointTests FAIL — `ProposalApiFactory` doesn't exist yet. Existing tests PASS.

**Step 3: Create FakeProposalChatService**

Create `api/tests/Momentum.Api.Tests/Helpers/FakeProposalChatService.cs`:

```csharp
using System.Runtime.CompilerServices;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Momentum.Api.Models;

namespace Momentum.Api.Tests.Helpers;

/// <summary>
/// Simulates the AI calling propose_goals by invoking the kernel function directly.
/// This bypasses the real AI's function calling mechanism but tests the full pipeline:
/// plugin invocation → proposal capture → SSE event emission.
/// </summary>
public class FakeProposalChatService : IChatCompletionService
{
    public IReadOnlyDictionary<string, object?> Attributes => new Dictionary<string, object?>();

    public Task<IReadOnlyList<ChatMessageContent>> GetChatMessageContentsAsync(
        ChatHistory chatHistory,
        PromptExecutionSettings? executionSettings = null,
        Kernel? kernel = null,
        CancellationToken cancellationToken = default)
    {
        var result = new List<ChatMessageContent>
        {
            new(AuthorRole.Assistant, "Here is my proposal.")
        };
        return Task.FromResult<IReadOnlyList<ChatMessageContent>>(result);
    }

    public async IAsyncEnumerable<StreamingChatMessageContent> GetStreamingChatMessageContentsAsync(
        ChatHistory chatHistory,
        PromptExecutionSettings? executionSettings = null,
        Kernel? kernel = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        // Simulate the AI calling propose_goals by directly invoking the kernel function
        if (kernel != null)
        {
            var fn = kernel.Plugins.GetFunction("GoalProposalPlugin", "ProposeGoals");
            var goalsJson = System.Text.Json.JsonSerializer.Serialize(new[]
            {
                new
                {
                    title = "Get fit",
                    description = "Health and fitness goal",
                    targetDate = "2026-06-01",
                    tasks = new[]
                    {
                        new { title = "Run 5k", priority = "high", dueDate = "2026-04-01", category = "Health" },
                        new { title = "Join gym", priority = "medium", dueDate = (string?)null, category = "Health" }
                    }
                }
            });
            await fn.InvokeAsync(kernel, new KernelArguments { ["goals"] = goalsJson });
        }

        // Don't yield text tokens — function call is the only output
        await Task.CompletedTask;
        yield break;
    }
}
```

**Step 4: Create ProposalApiFactory**

Append to `api/tests/Momentum.Api.Tests/Helpers/ApiFactory.cs`:

```csharp
public class ProposalApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("Supabase:JwtSecret", JwtHelper.TestSecret);
        builder.UseSetting("Supabase:Url", "https://test.supabase.co");
        builder.UseSetting("RateLimit:PermitLimit", "100");
        builder.UseSetting("RateLimit:WindowSeconds", "60");

        builder.ConfigureServices(services =>
        {
            // Remove any existing IChatCompletionService registration
            var descriptor = services.FirstOrDefault(
                d => d.ServiceType == typeof(IChatCompletionService));
            if (descriptor != null)
                services.Remove(descriptor);

            // Register fake that simulates propose_goals function call
            services.AddSingleton<IChatCompletionService>(new FakeProposalChatService());
        });
    }
}
```

**Step 5: Run tests to verify they pass**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: `Passed! - Failed: 0, Passed: 32`

**Important:** If `KernelFunction.InvokeAsync` doesn't auto-deserialize the JSON string into `List<ProposedGoal>`, the fix is to pass the deserialized object directly in `FakeProposalChatService`:

```csharp
// Fallback if JSON string marshaling doesn't work:
var goals = new List<ProposedGoal>
{
    new("Get fit", "Health and fitness goal", "2026-06-01", [
        new("Run 5k", "high", "2026-04-01", "Health"),
        new("Join gym", "medium", null, "Health")
    ])
};
await fn.InvokeAsync(kernel, new KernelArguments { ["goals"] = goals });
```

**Step 6: Commit**

```bash
git add api/
git commit -m "test: add proposal SSE integration tests with FakeProposalChatService"
```

---

### Task 5: AssistantService proposal unit tests

**Files:**
- Modify: `api/tests/Momentum.Api.Tests/AssistantServiceTests.cs`

**Step 1: Add proposal-specific tests**

Append these tests to `api/tests/Momentum.Api.Tests/AssistantServiceTests.cs`:

```csharp
    [Fact]
    public async Task StreamAsync_WhenAICallsProposeGoals_YieldsProposal()
    {
        var chatService = new FakeProposalChatService();
        var sessionStore = new SessionStore();
        var service = new AssistantService(chatService, sessionStore);
        var request = new ChatRequest(
            [new ChatMessage("user", "I want to get fit")],
            "test-proposal");

        StreamChunk? proposalChunk = null;
        await foreach (var chunk in service.StreamAsync(request, CancellationToken.None))
        {
            if (chunk.IsProposal)
                proposalChunk = chunk;
        }

        Assert.NotNull(proposalChunk);
        Assert.NotNull(proposalChunk!.Proposal);
        Assert.Single(proposalChunk.Proposal!.Goals);
        Assert.Equal("Get fit", proposalChunk.Proposal.Goals[0].Title);
    }

    [Fact]
    public async Task StreamAsync_WhenNoFunctionCall_YieldsNoProposal()
    {
        var chatService = new FakeChatCompletionService("Just text");
        var sessionStore = new SessionStore();
        var service = new AssistantService(chatService, sessionStore);
        var request = new ChatRequest(
            [new ChatMessage("user", "hello")],
            "test-no-proposal");

        var hasProposal = false;
        await foreach (var chunk in service.StreamAsync(request, CancellationToken.None))
        {
            if (chunk.IsProposal)
                hasProposal = true;
        }

        Assert.False(hasProposal);
    }
```

**Step 2: Run tests to verify they pass**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: `Passed! - Failed: 0, Passed: 34`

**Step 3: Commit**

```bash
git add api/tests/
git commit -m "test: add proposal streaming unit tests for AssistantService"
```

---

### Task 6: Update feature status + progress log

**Files:**
- Modify: `claude-features.json` — set A011, A012 to `"passing"`
- Modify: `claude-progress.txt` — append session summary

**Step 1: Update feature statuses**

In `claude-features.json`, update:
- `A011` → `"status": "passing"`
- `A012` → `"status": "passing"`

**Step 2: Append progress log**

Append to `claude-progress.txt`:

```
---
[API Session 3 — propose_goals + Proposal SSE — 2026-03-11]
STATUS: Complete
BRANCH: feat/session-api-3-proposals
COMPLETED:
  - A011: GoalProposalPlugin with [KernelFunction] ProposeGoals, typed DTOs (ProposedGoal, ProposedTask, GoalProposal)
  - A012: StreamChunk discriminated type, event: proposal SSE events from chat endpoint
  - AssistantService refactored to yield StreamChunk (token or proposal)
  - Kernel built per-request with GoalProposalPlugin + FunctionChoiceBehavior.Auto()
  - FakeProposalChatService test helper simulates AI calling propose_goals
  - ProposalApiFactory for integration tests with proposal flow
VERIFIED:
  - dotnet test passes (34 tests — 26 existing + 8 new)
  - Plugin captures proposals correctly (3 unit tests)
  - AssistantService yields proposals when function is called (2 unit tests)
  - Endpoint emits event: proposal with goal/task JSON (3 integration tests)
  - Existing token streaming tests unaffected
NOTES:
  - FunctionChoiceBehavior.Auto() registered but only activates with real AI provider (Session 4+)
  - FakeProposalChatService invokes kernel function directly to simulate AI function calling
  - StreamChunk uses factory methods: StreamChunk.TextToken() and StreamChunk.GoalProposal()
  - Plugin is instantiated per-request inside AssistantService — no shared state between requests
NEXT:
  API Session 4 or Frontend Session: A013-A016 (Assistant page, useAssistant hook, AssistantChat, ProposalReview)
```

**Step 3: Commit**

```bash
git add claude-features.json claude-progress.txt
git commit -m "docs: mark A011-A012 passing, add API Session 3 progress"
```
