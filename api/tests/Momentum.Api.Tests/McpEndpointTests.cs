using System.Net;
using System.Net.Http.Headers;
using Momentum.Api.Tests.Helpers;

namespace Momentum.Api.Tests;

public class McpEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Mcp_endpoint_requires_auth()
    {
        var client = factory.CreateClient();

        // The legacy SSE endpoint at /sse is part of the MCP transport (mapped by MapMcp()).
        // Use ResponseHeadersRead to avoid hanging on the long-lived SSE stream.
        var response = await client.GetAsync("/sse", HttpCompletionOption.ResponseHeadersRead);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Mcp_endpoint_accepts_authenticated_request()
    {
        var client = factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "/sse");
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer", JwtHelper.GenerateToken());

        // Use ResponseHeadersRead to avoid hanging on the long-lived SSE stream.
        var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);

        // MCP SSE endpoint responds 200 OK when authenticated — not 401.
        Assert.NotEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
