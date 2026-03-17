using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.DependencyInjection;
using Momentum.Api.Services;

namespace Momentum.Api.Tests.Helpers;

public class ApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("Supabase:JwtSecret", JwtHelper.TestSecret);
        builder.UseSetting("Supabase:Url", "https://test.supabase.co");
        builder.UseSetting("Supabase:PublishableKey", "sb_test_key");
        builder.UseSetting("RateLimit:PermitLimit", "10");
        builder.UseSetting("RateLimit:WindowSeconds", "60");

        builder.ConfigureServices(services =>
        {
            // Remove any existing IChatClient registration
            var descriptor = services.FirstOrDefault(
                d => d.ServiceType == typeof(IChatClient));
            if (descriptor != null)
                services.Remove(descriptor);

            // Register fake so tests don't throw on startup
            services.AddSingleton<IChatClient>(
                new FakeChatClient("Hello", " from", " AI"));
        });
    }
}

public class ChatApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("Supabase:JwtSecret", JwtHelper.TestSecret);
        builder.UseSetting("Supabase:Url", "https://test.supabase.co");
        builder.UseSetting("Supabase:PublishableKey", "sb_test_key");
        builder.UseSetting("RateLimit:PermitLimit", "100");
        builder.UseSetting("RateLimit:WindowSeconds", "60");

        builder.ConfigureServices(services =>
        {
            var descriptor = services.FirstOrDefault(
                d => d.ServiceType == typeof(IChatClient));
            if (descriptor != null)
                services.Remove(descriptor);

            services.AddSingleton<IChatClient>(
                new FakeChatClient("Hello", " from", " AI"));
        });
    }
}
