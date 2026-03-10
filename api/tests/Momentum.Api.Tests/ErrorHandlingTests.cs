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
