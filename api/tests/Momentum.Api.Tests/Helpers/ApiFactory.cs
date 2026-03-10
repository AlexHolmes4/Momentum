using Microsoft.AspNetCore.Hosting;
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
