using System.Net.ServerSentEvents;
using System.Runtime.CompilerServices;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.AI;
using Microsoft.IdentityModel.Tokens;
using Momentum.Api.Models;
using Momentum.Api.Services;

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
var supabaseUrl = builder.Configuration["Supabase:Url"];
var jwtSecret = builder.Configuration["Supabase:JwtSecret"];

if (string.IsNullOrEmpty(supabaseUrl))
    throw new InvalidOperationException("Supabase:Url is required");
if (string.IsNullOrEmpty(jwtSecret))
    throw new InvalidOperationException("Supabase:JwtSecret is required");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
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

// FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// Session store — in-memory conversation history
builder.Services.AddSingleton<SessionStore>();

// Assistant service — orchestrates AI streaming
builder.Services.AddScoped<AssistantService>();

// Anthropic SDK — IChatClient with function invocation pipeline
// AnthropicClient reads ANTHROPIC_API_KEY from env by default. In tests, replaced via DI override.
var anthropicApiKey = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");
var anthropicModel = builder.Configuration["Anthropic:Model"] ?? "claude-sonnet-4-5-20250929";

if (!string.IsNullOrEmpty(anthropicApiKey))
{
    builder.Services.AddSingleton<IChatClient>(sp =>
    {
        var client = new Anthropic.AnthropicClient();
        return client.AsIChatClient(anthropicModel)
            .AsBuilder()
            .UseFunctionInvocation()
            .Build();
    });
}
else
{
    // Placeholder for tests — real Anthropic key required in production
    builder.Services.AddSingleton<IChatClient>(sp =>
        throw new InvalidOperationException(
            "No AI model configured. Set ANTHROPIC_API_KEY environment variable."));
}

// Supabase data service — PostgREST CRUD with per-request JWT passthrough
builder.Services.AddHttpClient<SupabaseDataService>(client =>
{
    client.BaseAddress = new Uri(supabaseUrl);
});
builder.Services.AddHttpContextAccessor();

// MCP server — Streamable HTTP transport with tools auto-discovered from assembly
builder.Services.AddMcpServer()
    .WithHttpTransport()
    .WithToolsFromAssembly();

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
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.MapGet("/api/me", (ClaimsPrincipal user) => Results.Ok(new
{
    userId = user.FindFirst("sub")?.Value
})).RequireAuthorization().RequireRateLimiting("per-user");

app.MapPost("/api/assistant/chat", async (
    ChatRequest req,
    IValidator<ChatRequest> validator,
    AssistantService assistant,
    HttpContext ctx,
    ClaimsPrincipal user) =>
{
    var validationResult = await validator.ValidateAsync(req);
    if (!validationResult.IsValid)
        return Results.ValidationProblem(validationResult.ToDictionary());

    // Extract the raw JWT for tool closures (RLS enforcement via PostgREST)
    var userJwt = ctx.Request.Headers.Authorization.ToString().Replace("Bearer ", "");

    async IAsyncEnumerable<SseItem<object>> StreamEvents(
        [EnumeratorCancellation] CancellationToken ct)
    {
        await foreach (var chunk in assistant.StreamAsync(req, userJwt, ct))
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

// MCP endpoint — Streamable HTTP transport, requires JWT auth
app.MapMcp().RequireAuthorization();

app.Run();

public partial class Program { }
