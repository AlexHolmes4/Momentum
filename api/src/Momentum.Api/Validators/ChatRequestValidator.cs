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
