# MCP Server + Semantic Kernel → Anthropic SDK Migration Design

**Date:** 2026-03-16
**Features:** A017 (MCP server setup), A018 (read tools), A019 (write tools) + SK migration
**Status:** Approved

---

## Summary

Migrate the AI assistant backend from Semantic Kernel to the official Anthropic C# SDK (`Anthropic` NuGet) with `IChatClient` (`Microsoft.Extensions.AI`), and add an MCP server endpoint with CRUD tools for goals and tasks. The MCP tools and the chat assistant share a single `SupabaseDataService` for all database operations.

## Decision Record

| Decision | Choice | Rationale |
|---|---|---|
| AI SDK | Anthropic C# SDK (`Anthropic` NuGet) | Official SDK, `IChatClient` integration, fewer dependencies than SK |
| Abstraction layer | `IChatClient` (Microsoft.Extensions.AI) | GA, provider-agnostic, MCP tools work directly with it |
| MCP server | `ModelContextProtocol.AspNetCore` + `WithHttpTransport()` | Official C# MCP SDK, Streamable HTTP transport per spec |
| Tool architecture | Shared service, dual exposure | `SupabaseDataService` → AIFunction tools for chat + MCP tools for external clients |
| Auth for tools | User JWT passthrough → Supabase PostgREST → RLS | DB-enforced data isolation, no service-role key needed |
| Supabase client | Raw `HttpClient` + PostgREST | Per-request JWT threading is simple; supabase-csharp designed for single-user client apps |
| NOT using | Microsoft Agent Framework | Public preview/prerelease; our assistant is simple enough for IChatClient + MCP |

## Architecture

```
User → Chat UI → POST /api/assistant/chat (Bearer JWT)
                    ↓
              IChatClient (Anthropic SDK via AsIChatClient)
              + UseFunctionInvocation() pipeline
              + tools: [get_goals, get_tasks, create_goal, create_task, complete_task, propose_goals, brain_dump]
                    ↓ (auto-invoked by function calling)
              SupabaseDataService (user JWT → PostgREST → RLS enforced)
                    ↓
              SSE stream back to UI (token + proposal events)

External MCP Client (Claude Desktop, etc.)
              → /mcp endpoint (ModelContextProtocol.AspNetCore, Streamable HTTP)
              → MomentumTools class (delegates to same SupabaseDataService)
              → Auth: Bearer JWT required on MCP connection
```

## NuGet Package Changes

| Remove | Add |
|---|---|
| `Microsoft.SemanticKernel` v1.73.0 | `Anthropic` (official C# SDK, v10+) |
| | `Microsoft.Extensions.AI` (IChatClient abstractions, if not transitively included) |
| | `ModelContextProtocol.AspNetCore` (MCP server with HTTP transport) |

## Component Design

### 1. SupabaseDataService

All Supabase database operations via PostgREST REST API. Each method takes a `userJwt` parameter for RLS enforcement.

**File:** `Services/SupabaseDataService.cs`

```csharp
public class SupabaseDataService(HttpClient httpClient, IConfiguration config)
{
    // Reads
    Task<List<Goal>> GetGoalsAsync(string userJwt, CancellationToken ct);
    Task<List<TaskItem>> GetTasksAsync(string userJwt, string? goalId, CancellationToken ct);

    // Writes
    Task<Goal> CreateGoalAsync(string userJwt, CreateGoalRequest req, CancellationToken ct);
    Task<TaskItem> CreateTaskAsync(string userJwt, CreateTaskRequest req, CancellationToken ct);
    Task CompleteTaskAsync(string userJwt, string taskId, CancellationToken ct);
}
```

**PostgREST pattern:** Each method sets `Authorization: Bearer {userJwt}` and `apikey: {publishableKey}` headers, then calls:

```
GET  {supabaseUrl}/rest/v1/goals?status=eq.active&select=*
GET  {supabaseUrl}/rest/v1/tasks?status=eq.active&select=*
GET  {supabaseUrl}/rest/v1/tasks?status=eq.active&goal_id=eq.{goalId}&select=*
POST {supabaseUrl}/rest/v1/goals  (body: JSON)
POST {supabaseUrl}/rest/v1/tasks  (body: JSON)
```

**CompleteTask** follows the existing pattern: INSERT into `archived_tasks` + DELETE from `tasks` (two sequential calls).

**DTOs:** `Goal`, `TaskItem` (avoids `System.Threading.Tasks.Task` collision), `CreateGoalRequest`, `CreateTaskRequest` — simple records matching the Supabase schema.

### 2. AssistantService (Rewritten)

**File:** `Services/AssistantService.cs`

Migrated from Semantic Kernel to `IChatClient`:

```csharp
public class AssistantService(AnthropicClient anthropicClient, SupabaseDataService dataService, IConfiguration config)
{
    public async IAsyncEnumerable<StreamChunk> StreamAsync(
        ChatRequest request, string userJwt, [EnumeratorCancellation] CancellationToken ct)
    {
        // 1. Acquire per-session semaphore (keep existing locking)
        // 2. Get/create message history from SessionStore
        // 3. Build IChatClient with function invocation pipeline:
        //    anthropicClient.AsIChatClient(model)
        //        .AsBuilder()
        //        .UseFunctionInvocation()
        //        .Build()
        // 4. Build tool list via AIFunctionFactory.Create()
        //    — each tool closure captures userJwt for RLS
        //    — propose_goals closure captures a local GoalProposal? variable
        // 5. Call chatClient.GetStreamingResponseAsync(messages, chatOptions)
        // 6. For each ChatResponseUpdate:
        //    — if update.Text is non-empty → yield StreamChunk.TextToken(text)
        //    — skip tool-call/tool-result updates (handled internally by UseFunctionInvocation)
        // 7. After streaming completes, check captured proposal variable
        //    — if non-null → yield StreamChunk.GoalProposal(proposal)
        // 8. Append assistant response to session history
    }
}

// StreamChunk is KEPT (not deleted) — same discriminated type as before:
// StreamChunk.TextToken(string) and StreamChunk.GoalProposal(GoalProposal)
// The SSE mapping in Program.cs remains unchanged.
```

**Tool registration (per-request, captures userJwt):**

```csharp
var tools = new List<AITool>
{
    AIFunctionFactory.Create(
        () => dataService.GetGoalsAsync(userJwt, ct),
        "get_goals", "Get all active goals"),
    AIFunctionFactory.Create(
        (string? goalId) => dataService.GetTasksAsync(userJwt, goalId, ct),
        "get_tasks", "Get active tasks, optionally filtered by goal ID"),
    AIFunctionFactory.Create(
        (string title, string? description, string? targetDate) =>
            dataService.CreateGoalAsync(userJwt, new(title, description, targetDate), ct),
        "create_goal", "Create a new goal"),
    AIFunctionFactory.Create(
        (string title, string priority, string? dueDate, string? category, string? goalId) =>
            dataService.CreateTaskAsync(userJwt, new(title, priority, dueDate, category, goalId), ct),
        "create_task", "Create a new task"),
    AIFunctionFactory.Create(
        (string taskId) => dataService.CompleteTaskAsync(userJwt, taskId, ct),
        "complete_task", "Mark a task as complete (archives it)"),
    AIFunctionFactory.Create(
        (List<ProposedGoal> goals) => {
            capturedProposal = new GoalProposal(goals);  // local variable in StreamAsync
            return "Proposal created successfully.";
        },
        "propose_goals", "Propose structured goals with linked tasks"),
    AIFunctionFactory.Create(
        (string text) => BrainDumpPrompt(text),  // returns structured analysis/questions
        "brain_dump", "Decompose a brain dump into clarifying questions or goal/task proposals"),
};
```

**Key migration mapping:**

| Semantic Kernel | IChatClient (Microsoft.Extensions.AI) |
|---|---|
| `IChatCompletionService` | `IChatClient` via `anthropicClient.AsIChatClient(model)` |
| `Kernel.Plugins.Add(plugin)` | `ChatOptions { Tools = [...] }` |
| `FunctionChoiceBehavior.Auto()` | `.AsBuilder().UseFunctionInvocation().Build()` |
| `GetStreamingChatMessageContentsAsync` | `GetStreamingResponseAsync` |
| `ChatHistory` (SK type) | `List<ChatMessage>` (Microsoft.Extensions.AI type) |
| `StreamingChatMessageContent` | `ChatResponseUpdate` |

### 3. SessionStore (Modified)

**File:** `Services/SessionStore.cs`

Changes from SK `ChatHistory` to `List<ChatMessage>` from `Microsoft.Extensions.AI`. System prompt injection pattern stays the same. Per-session `SemaphoreSlim` locking preserved.

### 4. MomentumTools (New)

**File:** `Tools/MomentumTools.cs`

MCP tool definitions using `[McpServerToolType]` and `[McpServerTool]` attributes. Delegates to `SupabaseDataService`.

```csharp
[McpServerToolType]
public class MomentumTools(SupabaseDataService dataService)
{
    [McpServerTool("get_goals", ReadOnly = true), Description("Get all active goals for the current user")]
    public Task<List<Goal>> GetGoals(RequestContext<CallToolRequestParams> context, CancellationToken ct)
    {
        var jwt = ExtractJwt(context);
        return dataService.GetGoalsAsync(jwt, ct);
    }

    [McpServerTool("get_tasks", ReadOnly = true), Description("Get active tasks, optionally filtered by goal")]
    public Task<List<TaskItem>> GetTasks(RequestContext<CallToolRequestParams> context, string? goalId, CancellationToken ct)
    {
        var jwt = ExtractJwt(context);
        return dataService.GetTasksAsync(jwt, goalId, ct);
    }

    [McpServerTool("create_goal", Destructive = false), Description("Create a new goal")]
    public Task<Goal> CreateGoal(RequestContext<CallToolRequestParams> context, string title, string? description, string? targetDate, CancellationToken ct)
    {
        var jwt = ExtractJwt(context);
        return dataService.CreateGoalAsync(jwt, new(title, description, targetDate), ct);
    }

    [McpServerTool("create_task", Destructive = false), Description("Create a new task")]
    public Task<TaskItem> CreateTask(RequestContext<CallToolRequestParams> context, string title, string priority, string? dueDate, string? category, string? goalId, CancellationToken ct)
    {
        var jwt = ExtractJwt(context);
        return dataService.CreateTaskAsync(jwt, new(title, priority, dueDate, category, goalId), ct);
    }

    [McpServerTool("complete_task", Destructive = true), Description("Mark a task as complete (archives it)")]
    public Task CompleteTask(RequestContext<CallToolRequestParams> context, string taskId, CancellationToken ct)
    {
        var jwt = ExtractJwt(context);
        return dataService.CompleteTaskAsync(jwt, taskId, ct);
    }

    [McpServerTool("propose_goals", Destructive = false), Description("Propose structured goals with linked tasks for user review")]
    public string ProposeGoals(List<ProposedGoal> goals)
    {
        // MCP version just returns the proposal as JSON for the client to handle
        return JsonSerializer.Serialize(new GoalProposal(goals));
    }

    [McpServerTool("brain_dump", ReadOnly = true), Description("Decompose a brain dump into clarifying questions or goal/task proposals")]
    public Task<string> BrainDump(RequestContext<CallToolRequestParams> context, string text, CancellationToken ct)
    {
        // Returns structured prompt that either asks clarifying questions
        // or proposes goals/tasks — single request/response (not multi-turn)
    }

    private static string ExtractJwt(RequestContext<CallToolRequestParams> context)
    {
        // RequestContext inherits User (ClaimsPrincipal) from MessageContext
        // Extract raw JWT from IHttpContextAccessor via context.Services
        var httpContext = context.Services.GetRequiredService<IHttpContextAccessor>().HttpContext;
        return httpContext!.Request.Headers.Authorization.ToString().Replace("Bearer ", "");
    }
}
```

**MCP tool metadata:**
- `get_goals`, `get_tasks`: `ReadOnly = true` — no side effects
- `create_goal`, `create_task`: `Destructive = false` — creates new data, not destructive
- `complete_task`: `Destructive = true` — deletes from tasks table (moves to archive)
- `brain_dump`: `ReadOnly = true` — analysis only, no mutations

### 5. Program.cs Changes

**Remove:**
```csharp
// Semantic Kernel registration
builder.Services.AddSingleton<IChatCompletionService>(...)
builder.Services.AddSingleton<Kernel>(...)
```

**Add:**
```csharp
// Anthropic SDK + IChatClient
// AnthropicClient reads ANTHROPIC_API_KEY env var by default (parameterless constructor)
// Or pass explicitly: new AnthropicClient() { ApiKey = config["Anthropic:ApiKey"] }
builder.Services.AddSingleton<AnthropicClient>();
builder.Services.AddHttpClient<SupabaseDataService>(client =>
{
    client.BaseAddress = new Uri(config["Supabase:Url"]!);
});
builder.Services.AddHttpContextAccessor();

// MCP server
builder.Services.AddMcpServer()
    .WithHttpTransport()
    .WithToolsFromAssembly();

// ... after app.Build()
app.MapMcp().RequireAuthorization();
```

The chat endpoint (`POST /api/assistant/chat`) stays at the same path with the same SSE streaming contract. Frontend changes are not needed.

### 6. Configuration

**appsettings.json additions:**
```json
{
  "Anthropic": {
    "Model": "claude-sonnet-4-5-20250929"
  },
  "Supabase": {
    "Url": "https://xxx.supabase.co",
    "JwtSecret": "...",
    "PublishableKey": "sb_publishable_..."
  }
}
```

`ANTHROPIC_API_KEY` should be set as an environment variable (the Anthropic SDK reads it automatically). The existing `Supabase:Url` and `Supabase:JwtSecret` config entries are kept for JWT validation. `Supabase:PublishableKey` is added for PostgREST `apikey` headers. `SupabaseDataService` reads both `Supabase:Url` (base address via typed HttpClient) and `Supabase:PublishableKey` from config.

**Note on per-request tool creation:** `AIFunctionFactory.Create` uses reflection internally, so there is a small per-request cost to build the tool list. For a single-user app this is negligible. If needed in the future, tool definitions could be cached and JWT injected via a scoped service instead of closures.

**Note on session memory:** `SessionStore` uses `ConcurrentDictionary` with no eviction — sessions accumulate in memory indefinitely. This is a known limitation, acceptable for single-user. If multi-user load grows, add TTL-based eviction or move to Redis.

## Auth Flow

1. **Chat endpoint:** User's Supabase JWT arrives as `Authorization: Bearer <jwt>` on `POST /api/assistant/chat`. ASP.NET Core JWT middleware validates it. The raw token is extracted and passed to `AssistantService`, which threads it into tool closures → `SupabaseDataService` → PostgREST headers → RLS enforced.

2. **MCP endpoint:** External MCP client connects to `/mcp` with `Authorization: Bearer <jwt>`. Same JWT middleware validates it. `MomentumTools` extracts the JWT from `IHttpContextAccessor` → `SupabaseDataService` → PostgREST → RLS enforced.

3. **Security boundary:** RLS at the database level. Even if tool code has a bug, one user cannot access another user's data because the JWT's `auth.uid()` scopes all queries via Postgres policies.

## Testing Strategy

**Updated tests:**

| Test File | Change |
|---|---|
| `ChatEndpointTests.cs` | Mock `IChatClient` instead of `IChatCompletionService` |
| `AssistantServiceTests.cs` | Rewrite for `IChatClient` streaming + tool invocation |
| `ValidationTests.cs` | Keep as-is |
| `AuthTests.cs` | Keep as-is |
| `CorsTests.cs`, `RateLimitTests.cs`, `HealthTests.cs`, `ErrorHandlingTests.cs` | Keep as-is |

**New tests:**

| Test File | Purpose |
|---|---|
| `SupabaseDataServiceTests.cs` | Mock `HttpMessageHandler`, verify PostgREST URLs/headers/bodies |
| `MomentumToolsTests.cs` | Unit test MCP tools with mocked `SupabaseDataService` |
| `McpEndpointTests.cs` | Integration: `McpClient` → `/mcp` → tools respond correctly |

**Test helper changes:**

| Remove | Add |
|---|---|
| `FakeChatCompletionService.cs` | `FakeChatClient.cs` (implements `IChatClient`) |
| `FakeProposalChatService.cs` | (merged into `FakeChatClient` with tool simulation) |

**ApiFactory update:** DI registration switches from `IChatCompletionService` to `IChatClient`. `ChatApiFactory` and `ProposalApiFactory` patterns preserved with new fake.

## Files Changed & Deleted

### New Files

| File | Purpose |
|---|---|
| `Services/SupabaseDataService.cs` | PostgREST CRUD with per-request JWT |
| `Tools/MomentumTools.cs` | `[McpServerToolType]` class, 6 MCP tools |
| `Models/Goal.cs` | Goal DTO |
| `Models/TaskItem.cs` | TaskItem DTO |
| `Models/CreateGoalRequest.cs` | Input DTO for create_goal |
| `Models/CreateTaskRequest.cs` | Input DTO for create_task |
| `Tests/SupabaseDataServiceTests.cs` | HttpClient mock tests |
| `Tests/MomentumToolsTests.cs` | MCP tool unit tests |
| `Tests/McpEndpointTests.cs` | MCP integration tests |
| `Tests/Helpers/FakeChatClient.cs` | IChatClient test double |

### Modified Files

| File | Change |
|---|---|
| `Program.cs` | Replace SK with AnthropicClient + IChatClient + MCP server |
| `Services/AssistantService.cs` | Rewrite: SK → IChatClient streaming with AIFunction tools |
| `Services/SessionStore.cs` | `ChatHistory` (SK) → `List<ChatMessage>` (M.E.AI) |
| `Momentum.Api.csproj` | Swap NuGet packages |
| `appsettings.json` | Add `Anthropic:ApiKey`, `Anthropic:Model` |
| `Tests/ChatEndpointTests.cs` | Update for new DI/streaming types |
| `Tests/AssistantServiceTests.cs` | Rewrite for IChatClient |
| `Tests/Helpers/ApiFactory.cs` | Update DI registration |

### Deleted Files

| File | Reason |
|---|---|
| `Plugins/GoalProposalPlugin.cs` | Replaced by `propose_goals` AIFunction tool |
| `Tests/GoalProposalPluginTests.cs` | Replaced by MomentumToolsTests |
| `Tests/ProposalEndpointTests.cs` | Merged into updated ChatEndpointTests |
| `Tests/Helpers/FakeChatCompletionService.cs` | Replaced by FakeChatClient |
| `Tests/Helpers/FakeProposalChatService.cs` | Replaced by FakeChatClient |

**Kept (modified):**
- `Models/StreamChunk.cs` — kept as the SSE return type from `AssistantService.StreamAsync`
- `Models/GoalProposal.cs` — kept, used by `propose_goals` tool and SSE proposal events

## Frontend Impact

**None.** The chat endpoint contract (`POST /api/assistant/chat` → SSE with `event: token`, `event: proposal`, `event: done`) is preserved. The frontend `useAssistant` hook does not need changes.

## References

- [Anthropic C# SDK — IChatClient integration](https://platform.claude.com/docs/en/api/sdks/csharp)
- [MCP C# SDK — Getting Started](https://csharp.sdk.modelcontextprotocol.io/concepts/getting-started.html)
- [MCP C# SDK — McpServerToolAttribute API](https://csharp.sdk.modelcontextprotocol.io/api/ModelContextProtocol.Server.McpServerToolAttribute.html)
- [MCP C# SDK — RequestContext API](https://csharp.sdk.modelcontextprotocol.io/api/ModelContextProtocol.Server.RequestContext-1.html)
- [Microsoft.Extensions.AI docs](https://learn.microsoft.com/en-us/dotnet/ai/microsoft-extensions-ai)
- [MCP Authorization Spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [Agent Framework Migration Guide (reference)](https://learn.microsoft.com/en-us/agent-framework/migration-guide/from-semantic-kernel/)
