# Session 1: .NET API Scaffold — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scaffold a .NET 10 ASP.NET Core API in `api/` with health endpoint, CORS, structured logging, error handling, JWT auth, rate limiting, and Semantic Kernel dependency.

**Architecture:** Monorepo: Next.js frontend in `src/`, .NET API in `api/`. The API is a minimal API project. Frontend and API deploy independently (Cloudflare Workers vs Azure Container Apps). Cross-cutting concerns (auth, rate limiting, error handling) are wired up now; the chat endpoint that uses them comes in Session 2.

**Tech Stack:** .NET 10, ASP.NET Core Minimal APIs, Semantic Kernel, JwtBearer, xUnit + WebApplicationFactory

**Design Doc:** `docs/plans/2026-03-09-ai-assistant-design.md` — Section 11 covers cross-cutting concern decisions.

**Note:** FluentValidation is deferred to Session 2 when we have request DTOs to validate.

---

### Task 1: Project Scaffold

**Files:**
- Modify: `.gitignore`
- Create: `api/Momentum.Api.sln`
- Create: `api/src/Momentum.Api/Momentum.Api.csproj`
- Create: `api/src/Momentum.Api/Program.cs`
- Create: `api/src/Momentum.Api/appsettings.json`
- Create: `api/tests/Momentum.Api.Tests/Momentum.Api.Tests.csproj`
- Create: `api/tests/Momentum.Api.Tests/Helpers/ApiFactory.cs`
- Create: `api/tests/Momentum.Api.Tests/Helpers/JwtHelper.cs`

**Step 1: Add .NET entries to .gitignore**

Append to the end of `.gitignore`:

```
# .NET
api/**/bin/
api/**/obj/
*.user
*.suo
.vs/
```

**Step 2: Create solution and API project**

```bash
mkdir -p api
dotnet new sln -n Momentum.Api -o api
dotnet new web -o api/src/Momentum.Api
dotnet sln api/Momentum.Api.sln add api/src/Momentum.Api/Momentum.Api.csproj
```

**Step 3: Add NuGet packages to API project**

```bash
dotnet add api/src/Momentum.Api/Momentum.Api.csproj package Microsoft.SemanticKernel
dotnet add api/src/Momentum.Api/Momentum.Api.csproj package Microsoft.AspNetCore.Authentication.JwtBearer
```

**Step 4: Create appsettings.json**

Replace `api/src/Momentum.Api/appsettings.json` with:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedOrigins": [
    "https://momentum.alexgholmes.workers.dev",
    "http://localhost:3000",
    "http://localhost:11001"
  ],
  "RateLimit": {
    "PermitLimit": 10,
    "WindowSeconds": 60
  },
  "Supabase": {
    "Url": "",
    "JwtSecret": ""
  }
}
```

**Step 5: Clean up Program.cs**

Replace `api/src/Momentum.Api/Program.cs` with:

```csharp
var builder = WebApplication.CreateBuilder(args);

// Structured JSON logging for Azure Log Analytics
builder.Logging.AddJsonConsole();

var app = builder.Build();

app.Run();

public partial class Program { }
```

The `public partial class Program { }` is required so the test project can use `WebApplicationFactory<Program>`.

**Step 6: Create test project**

```bash
dotnet new xunit -o api/tests/Momentum.Api.Tests
dotnet sln api/Momentum.Api.sln add api/tests/Momentum.Api.Tests/Momentum.Api.Tests.csproj
dotnet add api/tests/Momentum.Api.Tests/Momentum.Api.Tests.csproj reference api/src/Momentum.Api/Momentum.Api.csproj
dotnet add api/tests/Momentum.Api.Tests/Momentum.Api.Tests.csproj package Microsoft.AspNetCore.Mvc.Testing
```

**Step 7: Delete default test file**

Delete `api/tests/Momentum.Api.Tests/UnitTest1.cs`.

**Step 8: Create test helpers**

Create `api/tests/Momentum.Api.Tests/Helpers/JwtHelper.cs`:

```csharp
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Momentum.Api.Tests.Helpers;

public static class JwtHelper
{
    public const string TestSecret = "test-secret-key-that-is-at-least-256-bits-long!!";
    public const string TestUserId = "test-user-123";

    public static string GenerateToken(string? userId = null)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(TestSecret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: "https://test.supabase.co/auth/v1",
            audience: "authenticated",
            claims: [new Claim("sub", userId ?? TestUserId)],
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
```

Create `api/tests/Momentum.Api.Tests/Helpers/ApiFactory.cs`:

```csharp
using Microsoft.AspNetCore.Mvc.Testing;

namespace Momentum.Api.Tests.Helpers;

public class ApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("Supabase:JwtSecret", JwtHelper.TestSecret);
        builder.UseSetting("Supabase:Url", "https://test.supabase.co");
        builder.UseSetting("RateLimit:PermitLimit", "10");
        builder.UseSetting("RateLimit:WindowSeconds", "60");
    }
}
```

**Step 9: Verify build**

```bash
dotnet build api/Momentum.Api.sln
```

Expected: `Build succeeded. 0 Warning(s) 0 Error(s)`

**Step 10: Commit**

```bash
git add .gitignore api/
git commit -m "feat: scaffold .NET 10 API project with test infrastructure"
```

---

### Task 2: Health Endpoint (TDD)

**Files:**
- Create: `api/tests/Momentum.Api.Tests/HealthTests.cs`
- Modify: `api/src/Momentum.Api/Program.cs`

**Step 1: Write the failing test**

Create `api/tests/Momentum.Api.Tests/HealthTests.cs`:

```csharp
using Momentum.Api.Tests.Helpers;

namespace Momentum.Api.Tests;

public class HealthTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public HealthTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Health_ReturnsOkWithHealthyStatus()
    {
        var response = await _client.GetAsync("/health");

        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("healthy", content);
    }
}
```

**Step 2: Run test to verify it fails**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: FAIL — 404 Not Found (no `/health` endpoint exists yet).

**Step 3: Implement health endpoint**

In `api/src/Momentum.Api/Program.cs`, add before `app.Run();`:

```csharp
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));
```

Full file:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Logging.AddJsonConsole();

var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.Run();

public partial class Program { }
```

**Step 4: Run test to verify it passes**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: `Passed! - Failed: 0, Passed: 1`

**Step 5: Commit**

```bash
git add api/
git commit -m "feat: add health endpoint with integration test"
```

---

### Task 3: CORS Configuration (TDD)

**Files:**
- Create: `api/tests/Momentum.Api.Tests/CorsTests.cs`
- Modify: `api/src/Momentum.Api/Program.cs`

**Step 1: Write the failing tests**

Create `api/tests/Momentum.Api.Tests/CorsTests.cs`:

```csharp
using Momentum.Api.Tests.Helpers;

namespace Momentum.Api.Tests;

public class CorsTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public CorsTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Cors_AllowsProductionOrigin()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.Add("Origin", "https://momentum.alexgholmes.workers.dev");

        var response = await _client.SendAsync(request);

        response.EnsureSuccessStatusCode();
        Assert.True(
            response.Headers.TryGetValues("Access-Control-Allow-Origin", out var origins),
            "Expected Access-Control-Allow-Origin header"
        );
        Assert.Contains("https://momentum.alexgholmes.workers.dev", origins!);
    }

    [Fact]
    public async Task Cors_AllowsLocalhostDevOrigin()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.Add("Origin", "http://localhost:11001");

        var response = await _client.SendAsync(request);

        response.EnsureSuccessStatusCode();
        Assert.True(
            response.Headers.TryGetValues("Access-Control-Allow-Origin", out var origins),
            "Expected Access-Control-Allow-Origin header"
        );
        Assert.Contains("http://localhost:11001", origins!);
    }

    [Fact]
    public async Task Cors_RejectsUnknownOrigin()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.Add("Origin", "https://evil.example.com");

        var response = await _client.SendAsync(request);

        Assert.False(
            response.Headers.TryGetValues("Access-Control-Allow-Origin", out _),
            "Should not set Access-Control-Allow-Origin for unknown origins"
        );
    }
}
```

**Step 2: Run tests to verify CORS tests fail**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: 3 CORS tests FAIL (no CORS middleware), 1 health test PASSES.

**Step 3: Implement CORS**

Update `api/src/Momentum.Api/Program.cs`:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Logging.AddJsonConsole();

// CORS — origins from appsettings.json
var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
    ?? ["https://momentum.alexgholmes.workers.dev", "http://localhost:3000", "http://localhost:11001"];

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors();

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.Run();

public partial class Program { }
```

**Step 4: Run tests to verify all pass**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: `Passed! - Failed: 0, Passed: 4`

**Step 5: Commit**

```bash
git add api/
git commit -m "feat: add CORS configuration with integration tests"
```

---

### Task 4: Global Error Handling (TDD)

**Files:**
- Create: `api/tests/Momentum.Api.Tests/ErrorHandlingTests.cs`
- Modify: `api/src/Momentum.Api/Program.cs`

**Step 1: Write the failing test**

Create `api/tests/Momentum.Api.Tests/ErrorHandlingTests.cs`:

```csharp
using System.Net;
using Momentum.Api.Tests.Helpers;

namespace Momentum.Api.Tests;

public class ErrorHandlingTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public ErrorHandlingTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task NonExistentEndpoint_ReturnsProblemDetailsJson()
    {
        var response = await _client.GetAsync("/nonexistent");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json",
            response.Content.Headers.ContentType?.MediaType);
    }
}
```

**Step 2: Run tests to verify error handling test fails**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: Error handling test FAILS — 404 response has no body or wrong content type. Other 4 tests PASS.

**Step 3: Implement error handling**

In `api/src/Momentum.Api/Program.cs`, add to the builder section:

```csharp
builder.Services.AddProblemDetails();
```

Add to the app section, **before** `app.UseCors();`:

```csharp
app.UseExceptionHandler();
app.UseStatusCodePages();
```

Full file:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Logging.AddJsonConsole();

var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
    ?? ["https://momentum.alexgholmes.workers.dev", "http://localhost:3000", "http://localhost:11001"];

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// RFC 7807 Problem Details for error responses
builder.Services.AddProblemDetails();

var app = builder.Build();

// Middleware order matters!
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseCors();

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.Run();

public partial class Program { }
```

**Step 4: Run tests to verify all pass**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: `Passed! - Failed: 0, Passed: 5`

**Step 5: Commit**

```bash
git add api/
git commit -m "feat: add global error handling with Problem Details"
```

---

### Task 5: JWT Authentication (TDD)

**Files:**
- Create: `api/tests/Momentum.Api.Tests/AuthTests.cs`
- Modify: `api/src/Momentum.Api/Program.cs`

**Step 1: Write the failing tests**

Create `api/tests/Momentum.Api.Tests/AuthTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Headers;
using Momentum.Api.Tests.Helpers;

namespace Momentum.Api.Tests;

public class AuthTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public AuthTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task ApiMe_WithoutToken_Returns401()
    {
        var response = await _client.GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ApiMe_WithValidToken_ReturnsUserId()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/me");
        request.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", JwtHelper.GenerateToken());

        var response = await _client.SendAsync(request);

        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains(JwtHelper.TestUserId, content);
    }

    [Fact]
    public async Task Health_WithoutToken_StillReturnsOk()
    {
        // Health must remain anonymous even after auth middleware is added
        var response = await _client.GetAsync("/health");

        response.EnsureSuccessStatusCode();
    }
}
```

**Step 2: Run tests to verify auth tests fail**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: `ApiMe_WithoutToken_Returns401` and `ApiMe_WithValidToken_ReturnsUserId` FAIL — `/api/me` doesn't exist yet (404). Other tests PASS.

**Step 3: Implement JWT auth and /api/me endpoint**

Update `api/src/Momentum.Api/Program.cs`:

```csharp
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.AddJsonConsole();

var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
    ?? ["https://momentum.alexgholmes.workers.dev", "http://localhost:3000", "http://localhost:11001"];

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddProblemDetails();

// JWT Authentication — verify Supabase tokens
var supabaseUrl = builder.Configuration["Supabase:Url"]
    ?? throw new InvalidOperationException("Supabase:Url is required");
var jwtSecret = builder.Configuration["Supabase:JwtSecret"]
    ?? throw new InvalidOperationException("Supabase:JwtSecret is required");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = $"{supabaseUrl}/auth/v1",
            ValidateAudience = true,
            ValidAudience = "authenticated",
            ValidateLifetime = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSecret))
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.MapGet("/api/me", (ClaimsPrincipal user) => Results.Ok(new
{
    userId = user.FindFirst("sub")?.Value
})).RequireAuthorization();

app.Run();

public partial class Program { }
```

**Step 4: Run tests to verify all pass**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: `Passed! - Failed: 0, Passed: 8`

**Step 5: Commit**

```bash
git add api/
git commit -m "feat: add JWT authentication with Supabase token verification"
```

---

### Task 6: Per-User Rate Limiting (TDD)

**Files:**
- Create: `api/tests/Momentum.Api.Tests/RateLimitTests.cs`
- Modify: `api/src/Momentum.Api/Program.cs`

**Step 1: Write the failing tests**

Create `api/tests/Momentum.Api.Tests/RateLimitTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Headers;
using Momentum.Api.Tests.Helpers;

namespace Momentum.Api.Tests;

public class RateLimitTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public RateLimitTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task RateLimit_Returns429AfterExceedingLimit()
    {
        // Unique user per test run to avoid interference
        var token = JwtHelper.GenerateToken(userId: $"rate-test-{Guid.NewGuid()}");

        // Send 10 requests (should all succeed)
        for (int i = 0; i < 10; i++)
        {
            var request = new HttpRequestMessage(HttpMethod.Get, "/api/me");
            request.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", token);
            var response = await _client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        // 11th request should be rate limited
        var blockedRequest = new HttpRequestMessage(HttpMethod.Get, "/api/me");
        blockedRequest.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", token);
        var blockedResponse = await _client.SendAsync(blockedRequest);
        Assert.Equal(HttpStatusCode.TooManyRequests, blockedResponse.StatusCode);
    }

    [Fact]
    public async Task Health_IsNotRateLimited()
    {
        // Send 15 requests to health — more than the 10-per-user limit
        // All should succeed because health has no rate limiting policy
        for (int i = 0; i < 15; i++)
        {
            var response = await _client.GetAsync("/health");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }
}
```

**Step 2: Run tests to verify rate limit tests fail**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: `RateLimit_Returns429AfterExceedingLimit` FAILS — 11th request returns 200 instead of 429 (no rate limiter configured). `Health_IsNotRateLimited` passes trivially. Other tests PASS.

**Step 3: Implement rate limiting**

In `api/src/Momentum.Api/Program.cs`, add the using statement at the top:

```csharp
using System.Threading.RateLimiting;
```

Add to the builder section (after authorization):

```csharp
// Per-user rate limiting — thresholds from appsettings.json
var rateLimitPermit = builder.Configuration.GetValue("RateLimit:PermitLimit", 10);
var rateLimitWindow = builder.Configuration.GetValue("RateLimit:WindowSeconds", 60);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("per-user", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User.FindFirst("sub")?.Value ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = rateLimitPermit,
                Window = TimeSpan.FromSeconds(rateLimitWindow)
            }));
});
```

Add to the app section (after `app.UseAuthorization();`):

```csharp
app.UseRateLimiter();
```

Update the `/api/me` endpoint to apply the rate limit policy:

```csharp
app.MapGet("/api/me", (ClaimsPrincipal user) => Results.Ok(new
{
    userId = user.FindFirst("sub")?.Value
})).RequireAuthorization().RequireRateLimiting("per-user");
```

Full final `Program.cs`:

```csharp
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Structured JSON logging for Azure Log Analytics
builder.Logging.AddJsonConsole();

// CORS — origins from appsettings.json
var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
    ?? ["https://momentum.alexgholmes.workers.dev", "http://localhost:3000", "http://localhost:11001"];

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// RFC 7807 Problem Details for error responses
builder.Services.AddProblemDetails();

// JWT Authentication — verify Supabase tokens
var supabaseUrl = builder.Configuration["Supabase:Url"]
    ?? throw new InvalidOperationException("Supabase:Url is required");
var jwtSecret = builder.Configuration["Supabase:JwtSecret"]
    ?? throw new InvalidOperationException("Supabase:JwtSecret is required");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = $"{supabaseUrl}/auth/v1",
            ValidateAudience = true,
            ValidAudience = "authenticated",
            ValidateLifetime = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSecret))
        };
    });

builder.Services.AddAuthorization();

// Per-user rate limiting — thresholds from appsettings.json
var rateLimitPermit = builder.Configuration.GetValue("RateLimit:PermitLimit", 10);
var rateLimitWindow = builder.Configuration.GetValue("RateLimit:WindowSeconds", 60);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("per-user", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User.FindFirst("sub")?.Value ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = rateLimitPermit,
                Window = TimeSpan.FromSeconds(rateLimitWindow)
            }));
});

var app = builder.Build();

// Middleware order matters!
// ExceptionHandler + StatusCodePages → CORS → Auth → RateLimiter
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// Endpoints
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.MapGet("/api/me", (ClaimsPrincipal user) => Results.Ok(new
{
    userId = user.FindFirst("sub")?.Value
})).RequireAuthorization().RequireRateLimiting("per-user");

app.Run();

public partial class Program { }
```

**Step 4: Run tests to verify all pass**

```bash
dotnet test api/Momentum.Api.sln --verbosity normal
```

Expected: `Passed! - Failed: 0, Passed: 10`

**Step 5: Commit**

```bash
git add api/
git commit -m "feat: add per-user rate limiting"
```
