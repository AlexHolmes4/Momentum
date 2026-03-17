using System.Text.Json.Serialization;

namespace Momentum.Api.Models;

public record TaskItem(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("priority")] string Priority,
    [property: JsonPropertyName("due_date")] string? DueDate,
    [property: JsonPropertyName("category")] string? Category,
    [property: JsonPropertyName("goal_id")] string? GoalId,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("created_at")] string CreatedAt
);
