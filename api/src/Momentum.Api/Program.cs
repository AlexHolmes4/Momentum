var builder = WebApplication.CreateBuilder(args);

// Structured JSON logging for Azure Log Analytics
builder.Logging.AddJsonConsole();

var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.Run();

public partial class Program { }
