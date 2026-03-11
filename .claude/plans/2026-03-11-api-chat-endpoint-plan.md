# API Session 2: Chat Endpoint — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add POST /api/assistant/chat endpoint with SSE streaming, in-memory conversation history, system prompt, and FluentValidation (A007-A010).

**Architecture:** The endpoint accepts `{ messages, sessionId }`, validates via FluentValidation, maintains conversation history in a `ConcurrentDictionary<string, ChatHistory>` keyed by sessionId, streams AI responses via Semantic Kernel's `GetStreamingChatMessageContentsAsync`, and returns them as SSE events using .NET 10's native `Results.ServerSentEvents`. The AI never touches the database — it only generates text responses. The `propose_goals` function calling comes in Session 3.

**Tech Stack:** .NET 10, ASP.NET Core Minimal APIs, Semantic Kernel 1.73 (`IChatCompletionService`), FluentValidation, xUnit + WebApplicationFactory

**Design Doc:** `docs/plans/2026-03-09-ai-assistant-design.md` — Sections 4, 9, 11.5

**Features covered:** A007 (SSE streaming), A008 (conversation history), A009 (system prompt), A010 (FluentValidation)

---

### Task 1: Add NuGet Packages + DTOs

**Files:**
- Modify: `api/src/Momentum.Api/Momentum.Api.csproj`
- Create: `api/src/Momentum.Api/Models/ChatRequest.cs`

**Step 1: Add FluentValidation packages**

```bash
dotnet add api/src/Momentum.Api/Momentum.Api.csproj package FluentValidation
dotnet add api/src/Momentum.Api/Momentum.Api.csproj package FluentValidation.DependencyInjectionExtensions
```

Note: `FluentValidation.AspNetCore` is deprecated. Use the core packages with manual validation in Minimal APIs.

**Step 2: Create DTOs**

Create `api/src/Momentum.Api/Models/ChatRequest.cs`:

```csharp
namespace Momentum.Api.Models;

public record ChatMessage(string Role, string Content);

public record ChatRequest(List<ChatMessage> Messages, string SessionId);
```

**Step 3: Verify build**

```bash
dotnet build api/Momentum.Api.sln
```

Expected: `Build succeeded. 0 Warning(s) 0 Error(s)`

**Step 4: Commit**

```bash
git add api/
git commit -m "chore: add FluentValidation packages and ChatRequest DTOs"
```

---

### Task 2: FluentValidation — ChatRequestValidator (A010)

**Files:**
- Create: `api/src/Momentum.Api/Validators/ChatRequestValidator.cs`
- Create: `api/tests/Momentum.Api.Tests/ValidationTests.cs`
- Modify: `api/src/Momentum.Api/Program.cs`

**Step 1: Write the failing tests**

Create `api/tests/Momentum.Api.Tests/ValidationTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Momentum.Api.Tests.Helpers;

namespace Momentum.Api.Tests;

public class ValidationTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public ValidationTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    private HttpRequestMessage CreateAuthenticatedPost(string url, object body)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url)
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
    public async Task Chat_EmptyMessages_Returns400()
    {
        var request = CreateAuthenticatedPost("/api/assistant/chat", new
        {
            messages = Array.Empty<object>(),
            sessionId = "test-session"
        });

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Chat_MissingSessionId_Returns400()
    {
        var request = CreateAuthenticatedPost("/api/assistant/chat", new
        {
            messages = new[] { new { role = "user", content = "hello" } },
            sessionId = ""
        });

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Chat_SessionIdTooLong_Returns400()
    {
        var request = CreateAuthenticatedPost("/api/assistant/chat", new
        {
            messages = new[] { new { role = "user", content = "hello" } },
            sessionId = new string('x', 201)
        });

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Chat_EmptyMessageContent_Returns400()
    {
        var request = CreateAuthenticatedPost("/api/assistant/chat", new
        {
            messages = new[] { new { role = "user", content = "" } },
            sessionId = "test-session"
        });

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Chat_InvalidRole_Returns400()
    {
        var request = CreateAuthenticatedPost("/api/assistant/chat", new
        {
            messages = new[] { new { role = "admin", content = "hello" } },
            sessionId = "test-session"
        });

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
```

**Step 2: Run tests to verify they fail**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: All 5 validation tests FAIL — `/api/assistant/chat` doesn't exist yet (404 instead of 400). Existing 10 tests PASS.

**Step 3: Create the validator**

Create `api/src/Momentum.Api/Validators/ChatRequestValidator.cs`:

```csharp
using FluentValidation;
using Momentum.Api.Models;

namespace Momentum.Api.Validators;

public class ChatMessageValidator : AbstractValidator<ChatMessage>
{
    private static readonly string[] ValidRoles = ["user", "assistant"];

    public ChatMessageValidator()
    {
        RuleFor(m => m.Content).NotEmpty().WithMessage("Message content must not be empty.");
        RuleFor(m => m.Role).NotEmpty().Must(r => ValidRoles.Contains(r))
            .WithMessage("Role must be 'user' or 'assistant'.");
    }
}

public class ChatRequestValidator : AbstractValidator<ChatRequest>
{
    public ChatRequestValidator()
    {
        RuleFor(r => r.Messages).NotEmpty().WithMessage("At least one message is required.");
        RuleForEach(r => r.Messages).SetValidator(new ChatMessageValidator());
        RuleFor(r => r.SessionId).NotEmpty().MaximumLength(200)
            .WithMessage("SessionId must be 1-200 characters.");
    }
}
```

**Step 4: Register FluentValidation + stub endpoint in Program.cs**

Add this using at the top of `api/src/Momentum.Api/Program.cs`:

```csharp
using FluentValidation;
using Momentum.Api.Models;
```

Add to the builder section (after `AddAuthorization()`):

```csharp
// FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<Program>();
```

Add after the `/api/me` endpoint:

```csharp
app.MapPost("/api/assistant/chat", async (
    ChatRequest req,
    IValidator<ChatRequest> validator,
    ClaimsPrincipal user,
    HttpContext ctx) =>
{
    var validationResult = await validator.ValidateAsync(req);
    if (!validationResult.IsValid)
        return Results.ValidationProblem(validationResult.ToDictionary());

    // Stub — streaming implementation comes in Task 4
    return Results.Ok(new { status = "not_implemented" });
}).RequireAuthorization().RequireRateLimiting("per-user");
```

**Step 5: Run tests to verify they pass**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: `Passed! - Failed: 0, Passed: 15`

**Step 6: Commit**

```bash
git add api/
git commit -m "feat: add FluentValidation for ChatRequest with 5 validation tests"
```

---

### Task 3: Session Store — Conversation History (A008)

**Files:**
- Create: `api/src/Momentum.Api/Services/SessionStore.cs`
- Create: `api/tests/Momentum.Api.Tests/SessionStoreTests.cs`

**Step 1: Write the failing tests**

Create `api/tests/Momentum.Api.Tests/SessionStoreTests.cs`:

```csharp
using Microsoft.SemanticKernel.ChatCompletion;
using Momentum.Api.Services;

namespace Momentum.Api.Tests;

public class SessionStoreTests
{
    [Fact]
    public void GetOrCreate_NewSession_ReturnsChatHistoryWithSystemPrompt()
    {
        var store = new SessionStore();

        var history = store.GetOrCreate("session-1");

        Assert.NotNull(history);
        Assert.Single(history); // system prompt only
        Assert.Equal(AuthorRole.System, history[0].Role);
    }

    [Fact]
    public void GetOrCreate_ExistingSession_ReturnsSameInstance()
    {
        var store = new SessionStore();

        var first = store.GetOrCreate("session-1");
        first.AddUserMessage("hello");

        var second = store.GetOrCreate("session-1");

        Assert.Same(first, second);
        Assert.Equal(2, second.Count); // system prompt + user message
    }

    [Fact]
    public void GetOrCreate_DifferentSessions_ReturnsDifferentInstances()
    {
        var store = new SessionStore();

        var a = store.GetOrCreate("session-a");
        var b = store.GetOrCreate("session-b");

        Assert.NotSame(a, b);
    }

    [Fact]
    public void SystemPrompt_ContainsMomentumInstructions()
    {
        var store = new SessionStore();

        var history = store.GetOrCreate("session-1");

        var systemMessage = history[0].Content!;
        Assert.Contains("goal-setting assistant", systemMessage, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("propose_goals", systemMessage);
    }
}
```

**Step 2: Run tests to verify they fail**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: 4 SessionStore tests FAIL — `SessionStore` class doesn't exist. Existing tests PASS.

**Step 3: Implement SessionStore**

Create `api/src/Momentum.Api/Services/SessionStore.cs`:

```csharp
using System.Collections.Concurrent;
using Microsoft.SemanticKernel.ChatCompletion;

namespace Momentum.Api.Services;

public class SessionStore
{
    private readonly ConcurrentDictionary<string, ChatHistory> _sessions = new();

    private const string SystemPrompt = """
        You are a goal-setting assistant for Momentum, a personal productivity app.
        Your job is to help the user translate their thoughts into clear, trackable goals with linked tasks.

        RULES:
        1. Start by reflecting back what you heard ("It sounds like you want to...")
        2. Ask at most 3 clarifying questions, one at a time, only when genuinely needed
        3. Once you have enough context, call the propose_goals function — never describe proposals in text
        4. Goals should be meaningful objectives (e.g. "Get AWS Solutions Architect certification")
        5. Tasks should be specific, actionable steps (e.g. "Complete CloudAcademy course Module 3")
        6. Suggest realistic priorities: high for blockers, medium for steady progress, low for nice-to-haves
        7. Suggest target dates if the user mentioned timeframes
        """;

    public ChatHistory GetOrCreate(string sessionId)
    {
        return _sessions.GetOrAdd(sessionId, _ =>
        {
            var history = new ChatHistory();
            history.AddSystemMessage(SystemPrompt);
            return history;
        });
    }
}
```

**Step 4: Register as singleton in Program.cs**

Add using at top of `api/src/Momentum.Api/Program.cs`:

```csharp
using Momentum.Api.Services;
```

Add to builder section (after FluentValidation registration):

```csharp
// Session store — in-memory conversation history
builder.Services.AddSingleton<SessionStore>();
```

**Step 5: Run tests to verify they pass**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: `Passed! - Failed: 0, Passed: 19`

**Step 6: Commit**

```bash
git add api/
git commit -m "feat: add SessionStore for in-memory conversation history"
```

---

### Task 4: AssistantService — Streaming with System Prompt (A007, A009)

**Files:**
- Create: `api/src/Momentum.Api/Services/AssistantService.cs`
- Create: `api/tests/Momentum.Api.Tests/Helpers/FakeChatCompletionService.cs`
- Create: `api/tests/Momentum.Api.Tests/AssistantServiceTests.cs`

**Step 1: Write the failing tests**

Create `api/tests/Momentum.Api.Tests/Helpers/FakeChatCompletionService.cs`:

```csharp
using System.Runtime.CompilerServices;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;

namespace Momentum.Api.Tests.Helpers;

public class FakeChatCompletionService : IChatCompletionService
{
    private readonly string[] _chunks;

    public FakeChatCompletionService(params string[] chunks)
    {
        _chunks = chunks;
    }

    public IReadOnlyDictionary<string, object?> Attributes => new Dictionary<string, object?>();

    public Task<IReadOnlyList<ChatMessageContent>> GetChatMessageContentsAsync(
        ChatHistory chatHistory,
        PromptExecutionSettings? executionSettings = null,
        Kernel? kernel = null,
        CancellationToken cancellationToken = default)
    {
        var result = new List<ChatMessageContent>
        {
            new(AuthorRole.Assistant, string.Join("", _chunks))
        };
        return Task.FromResult<IReadOnlyList<ChatMessageContent>>(result);
    }

    public async IAsyncEnumerable<StreamingChatMessageContent> GetStreamingChatMessageContentsAsync(
        ChatHistory chatHistory,
        PromptExecutionSettings? executionSettings = null,
        Kernel? kernel = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        foreach (var chunk in _chunks)
        {
            yield return new StreamingChatMessageContent(AuthorRole.Assistant, chunk);
            await Task.Yield(); // simulate async streaming
        }
    }
}
```

Create `api/tests/Momentum.Api.Tests/AssistantServiceTests.cs`:

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

        var chunks = new List<string>();
        await foreach (var chunk in service.StreamAsync(request, CancellationToken.None))
        {
            chunks.Add(chunk);
        }

        Assert.Equal(["Hello", " world", "!"], chunks);
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

**Step 2: Run tests to verify they fail**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: 4 AssistantService tests FAIL — `AssistantService` doesn't exist. Existing tests PASS.

**Step 3: Implement AssistantService**

Create `api/src/Momentum.Api/Services/AssistantService.cs`:

```csharp
using System.Runtime.CompilerServices;
using System.Text;
using Microsoft.SemanticKernel.ChatCompletion;
using Momentum.Api.Models;

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

    public async IAsyncEnumerable<string> StreamAsync(
        ChatRequest request,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var history = _sessionStore.GetOrCreate(request.SessionId);

        // Add the latest user message to history
        var lastMessage = request.Messages[^1];
        history.AddUserMessage(lastMessage.Content);

        // Stream the AI response
        var fullResponse = new StringBuilder();
        await foreach (var chunk in _chatService.GetStreamingChatMessageContentsAsync(
            history, cancellationToken: cancellationToken))
        {
            var content = chunk.Content ?? string.Empty;
            if (content.Length > 0)
            {
                fullResponse.Append(content);
                yield return content;
            }
        }

        // Append full assistant response to history
        history.AddAssistantMessage(fullResponse.ToString());
    }
}
```

**Step 4: Run tests to verify they pass**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: `Passed! - Failed: 0, Passed: 23`

**Step 5: Commit**

```bash
git add api/
git commit -m "feat: add AssistantService with SK streaming and conversation history"
```

---

### Task 5: Wire SSE Endpoint + Integration Tests (A007)

**Files:**
- Modify: `api/src/Momentum.Api/Program.cs`
- Modify: `api/tests/Momentum.Api.Tests/Helpers/ApiFactory.cs`
- Create: `api/tests/Momentum.Api.Tests/ChatEndpointTests.cs`

**Step 1: Write the failing integration tests**

Create `api/tests/Momentum.Api.Tests/ChatEndpointTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Momentum.Api.Tests.Helpers;

namespace Momentum.Api.Tests;

public class ChatEndpointTests : IClassFixture<ChatApiFactory>
{
    private readonly HttpClient _client;

    public ChatEndpointTests(ChatApiFactory factory)
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
    public async Task Chat_ValidRequest_ReturnsSSEContentType()
    {
        var request = CreateChatRequest(new
        {
            messages = new[] { new { role = "user", content = "I want to get fit" } },
            sessionId = "test-sse-1"
        });

        var response = await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);

        response.EnsureSuccessStatusCode();
        Assert.Equal("text/event-stream", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Chat_ValidRequest_StreamsTokenEvents()
    {
        var request = CreateChatRequest(new
        {
            messages = new[] { new { role = "user", content = "braindump" } },
            sessionId = "test-sse-2"
        });

        var response = await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync();
        // SSE format: each event is "data: ...\n\n"
        Assert.Contains("data:", body);
    }

    [Fact]
    public async Task Chat_WithoutToken_Returns401()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/assistant/chat")
        {
            Content = new StringContent(
                JsonSerializer.Serialize(new
                {
                    messages = new[] { new { role = "user", content = "hello" } },
                    sessionId = "test"
                }),
                Encoding.UTF8,
                "application/json")
        };

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
```

**Step 2: Create ChatApiFactory with fake IChatCompletionService**

Update `api/tests/Momentum.Api.Tests/Helpers/ApiFactory.cs` to add a chat-specific factory:

```csharp
// Append to end of the existing ApiFactory.cs file (same namespace)

public class ChatApiFactory : WebApplicationFactory<Program>
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
                d => d.ServiceType == typeof(Microsoft.SemanticKernel.ChatCompletion.IChatCompletionService));
            if (descriptor != null)
                services.Remove(descriptor);

            // Register fake
            services.AddSingleton<Microsoft.SemanticKernel.ChatCompletion.IChatCompletionService>(
                new FakeChatCompletionService("Hello", " from", " AI"));
        });
    }
}
```

Add necessary usings at the top of `ApiFactory.cs`:

```csharp
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.SemanticKernel.ChatCompletion;
```

**Step 3: Run tests to verify they fail**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: ChatEndpoint tests FAIL — endpoint returns JSON (stub) not SSE. Existing tests PASS.

**Step 4: Wire SSE streaming in Program.cs**

Replace the stub `/api/assistant/chat` endpoint in `api/src/Momentum.Api/Program.cs` with:

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
            yield return new SseItem<object>(new { type = "token", content = chunk });
        }
    }

    return TypedResults.ServerSentEvents(
        StreamEvents(ctx.RequestAborted));
}).RequireAuthorization().RequireRateLimiting("per-user");
```

Add these usings to the top of Program.cs:

```csharp
using System.Runtime.CompilerServices;
using Microsoft.AspNetCore.Http.HttpResults;
```

Register `AssistantService` in the builder section:

```csharp
// Assistant service — orchestrates AI streaming
builder.Services.AddScoped<AssistantService>();
```

Register a placeholder `IChatCompletionService` so the app builds (will be replaced by real Anthropic connector in Session 3):

```csharp
// Placeholder AI service — replaced by real connector when ANTHROPIC_API_KEY is configured
builder.Services.AddSingleton<IChatCompletionService>(sp =>
    throw new InvalidOperationException(
        "No AI model configured. Set ANTHROPIC_API_KEY environment variable."));
```

Add this using:

```csharp
using Microsoft.SemanticKernel.ChatCompletion;
```

**Step 5: Run tests to verify they pass**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: `Passed! - Failed: 0, Passed: 26`

**Step 6: Commit**

```bash
git add api/
git commit -m "feat: wire POST /api/assistant/chat with SSE streaming"
```

---

### Task 6: Update Feature Status + Progress Log

**Files:**
- Modify: `claude-features.json` — set A007, A008, A009, A010 to `"passing"`
- Modify: `claude-progress.txt` — append session summary

**Step 1: Update feature statuses**

In `claude-features.json`, update these entries:
- `A007` → `"status": "passing"`
- `A008` → `"status": "passing"`
- `A009` → `"status": "passing"`
- `A010` → `"status": "passing"`

**Step 2: Append progress log**

Append to `claude-progress.txt`:

```
---
[API Session 2 — Chat Endpoint — 2026-03-11]
STATUS: Complete
BRANCH: feat/session-api-2-chat
COMPLETED:
  - A007: POST /api/assistant/chat with SSE streaming via .NET 10 Results.ServerSentEvents
  - A008: SessionStore — ConcurrentDictionary<string, ChatHistory> in-memory conversation history
  - A009: System prompt — goal-setting assistant with reflect/clarify/propose_goals rules
  - A010: FluentValidation — ChatRequestValidator for messages + sessionId validation
  - AssistantService — streams AI responses via IChatCompletionService, maintains history
  - FakeChatCompletionService test helper for integration testing
  - ChatApiFactory — WebApplicationFactory with fake AI service
VERIFIED:
  - dotnet test passes (26 tests — 10 existing + 16 new)
  - Validation: empty messages, empty sessionId, long sessionId, empty content, invalid role → 400
  - SSE: valid request returns text/event-stream with data events
  - Auth: request without token → 401
  - History: messages persist across calls within same sessionId
NOTES:
  - IChatCompletionService registered as a placeholder (throws) — real Anthropic connector in Session 3
  - SessionStore is singleton (in-memory) — Redis if multi-replica needed (per design doc)
  - propose_goals function calling deferred to Session 3 (A011-A012)
  - FluentValidation.AspNetCore is deprecated — using core FluentValidation + manual validation
NEXT:
  Session 3: A011 (propose_goals kernel function), A012 (proposal SSE event)
```

**Step 3: Commit**

```bash
git add claude-features.json claude-progress.txt
git commit -m "docs: mark A007-A010 passing, add API Session 2 progress"
```
