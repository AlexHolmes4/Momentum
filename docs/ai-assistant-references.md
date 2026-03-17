# AI Goal-Setting Assistant — Technology References

Verified documentation links for the AI assistant feature's tech stack. Web-searched 2026-03-09. Updated 2026-03-16 — migrating from Semantic Kernel to Anthropic SDK + IChatClient + MCP C# SDK.

---

## .NET AI Stack Overview (2026)

Three complementary layers exist — they are not competing:

| Layer | Package | Role |
|-------|---------|------|
| `Microsoft.Extensions.AI` | `Microsoft.Extensions.AI` | Lowest-level: `IChatClient`, `IEmbeddingGenerator` — provider-agnostic primitives (GA) |
| Semantic Kernel | `Microsoft.SemanticKernel` | Orchestration: plugins, function calling, memory, multi-agent, MCP |
| Microsoft Agent Framework | `Microsoft.Agents.AI` | Top-level: graph workflows, A2A, checkpointing, human-in-the-loop (public preview/RC) |

### Our approach (decided 2026-03-16)

Use the **Anthropic C# SDK** (`Anthropic` NuGet) with its `IChatClient` integration (`Microsoft.Extensions.AI`), combined with the **MCP C# SDK** (`ModelContextProtocol`) for tool serving. This replaces Semantic Kernel.

**Why this approach:**
- The official Anthropic C# SDK provides `IChatClient` via `client.AsIChatClient()`, which is the `Microsoft.Extensions.AI` abstraction
- MCP tools from the MCP C# SDK work directly with `IChatClient` — shown in Anthropic's own docs
- Fewer dependencies, no prerelease packages, stable foundation
- Avoids Semantic Kernel's `Kernel`/`Plugin`/`KernelFunction` ceremony
- Microsoft Agent Framework is the SK successor but still prerelease — we can migrate later if needed

**Migration from Semantic Kernel:**

| Before (Semantic Kernel) | After (Anthropic SDK + IChatClient) |
|---|---|
| `Microsoft.SemanticKernel` v1.73.0 | `Anthropic` NuGet (official SDK, v10+) |
| `Kernel` + `IChatCompletionService` | `AnthropicClient.AsIChatClient()` → `IChatClient` |
| `[KernelFunction]` + plugin classes | `AIFunctionFactory.Create()` or `McpServerTool` |
| `ChatHistory` + custom `SessionStore` | `IChatClient` with manual message list (or thin wrapper) |
| `FunctionChoiceBehavior.Auto()` | `.AsBuilder().UseFunctionInvocation().Build()` |
| `GetStreamingChatMessageContentsAsync` | `chatClient.GetStreamingResponseAsync()` |

**Key note (2026-03):** Microsoft Agent Framework (`Microsoft.Agents.AI`) is now the direct successor to both Semantic Kernel and AutoGen (same teams, public preview). For projects needing agent sessions, middleware, multi-agent workflows, or graph-based orchestration, Agent Framework is the recommended path. Our assistant is simple enough that `IChatClient` + MCP covers our needs without the extra layer.

## Anthropic C# SDK (our primary AI package)

| Topic | URL |
|-------|-----|
| Anthropic C# SDK docs | https://platform.claude.com/docs/en/api/sdks/csharp |
| Anthropic C# SDK GitHub | https://github.com/anthropics/anthropic-sdk-csharp |
| Anthropic C# SDK NuGet | https://www.nuget.org/packages/Anthropic |
| Anthropic API reference | https://platform.claude.com/docs/en/api/overview |
| Anthropic streaming guide | https://platform.claude.com/docs/en/build-with-claude/streaming |
| Anthropic tool use guide | https://platform.claude.com/docs/en/build-with-claude/tool-use |

**Key patterns:**
- `AnthropicClient` → `client.AsIChatClient("model")` provides `IChatClient` (`Microsoft.Extensions.AI`)
- `.AsBuilder().UseFunctionInvocation().Build()` enables automatic tool/function calling
- `client.Messages.CreateStreaming()` for raw streaming; `IChatClient.GetStreamingResponseAsync()` for abstracted streaming
- MCP tools from `ModelContextProtocol` SDK work directly with `IChatClient` via `ChatOptions.Tools`

```csharp
// Example: Anthropic SDK + IChatClient + MCP tools
IChatClient chatClient = new AnthropicClient().AsIChatClient("claude-sonnet-4-5-20250929")
    .AsBuilder()
    .UseFunctionInvocation()
    .Build();

ChatOptions options = new() { Tools = [.. await mcpServer.ListToolsAsync()] };
await chatClient.GetResponseAsync("...", options);
```

## Microsoft.Extensions.AI

| Topic | URL |
|-------|-----|
| Microsoft.Extensions.AI docs | https://learn.microsoft.com/en-us/dotnet/ai/microsoft-extensions-ai |
| .NET + AI Ecosystem overview | https://learn.microsoft.com/en-us/dotnet/ai/dotnet-ai-ecosystem |
| IChatClient API reference | https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.ai.ichatclient |
| AIFunctionFactory API reference | https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.ai.aifunctionfactory |

**Key note:** `Microsoft.Extensions.AI` is the GA provider-agnostic abstraction layer. The Anthropic SDK implements `IChatClient` via `AsIChatClient()`. This is the interface MCP tools and function calling plug into.

## Microsoft Agent Framework & Semantic Kernel (reference)

| Topic | URL |
|-------|-----|
| Microsoft Agent Framework Overview | https://learn.microsoft.com/en-us/agent-framework/overview/ |
| Microsoft Agent Framework GitHub | https://github.com/microsoft/agent-framework |
| Agent Framework Anthropic Provider | https://learn.microsoft.com/en-us/agent-framework/agents/providers/anthropic |
| Agent Framework MCP Tools | https://learn.microsoft.com/en-us/agent-framework/user-guide/model-context-protocol/using-mcp-tools |
| Migration Guide from Semantic Kernel | https://learn.microsoft.com/en-us/agent-framework/migration-guide/from-semantic-kernel/ |
| Semantic Kernel Docs | https://learn.microsoft.com/en-us/semantic-kernel/ |
| Semantic Kernel GitHub | https://github.com/microsoft/semantic-kernel |

**Status (2026-03):** Microsoft Agent Framework is in **public preview/RC**. It is the direct successor to both Semantic Kernel and AutoGen (same teams). NuGet: `Microsoft.Agents.AI`, `Microsoft.Agents.AI.Anthropic`. We are not using it currently but it is the natural upgrade path if we need agent sessions, middleware, or multi-agent orchestration in the future.

## Model Context Protocol (MCP)

| Topic | URL |
|-------|-----|
| MCP Official Docs | https://modelcontextprotocol.io |
| MCP Specification (2025-11-25) | https://modelcontextprotocol.io/specification/2025-11-25 |
| MCP Authorization Spec | https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization |
| MCP GitHub Organization | https://github.com/modelcontextprotocol |
| MCP C# SDK GitHub | https://github.com/modelcontextprotocol/csharp-sdk |
| MCP C# SDK API Docs | https://modelcontextprotocol.github.io/csharp-sdk/ |
| Build an MCP server in C# (.NET Blog) | https://devblogs.microsoft.com/dotnet/build-a-model-context-protocol-mcp-server-in-csharp/ |
| MCP C# SDK v1.0 release | https://devblogs.microsoft.com/dotnet/release-v10-of-the-official-mcp-csharp-sdk/ |
| Anthropic SDK IChatClient + MCP example | https://platform.claude.com/docs/en/api/sdks/csharp (see IChatClient integration section) |
| MCP SDK overview | https://modelcontextprotocol.io/docs/sdk |
| MCP features guide (Tools/Resources/Prompts) | https://workos.com/blog/mcp-features-guide |

### MCP Server Primitives

| Primitive | Controlled by | Purpose |
|-----------|---------------|---------|
| Tools | Model | Actions the LLM can invoke (our main use case) |
| Resources | Application | Read-only data via URIs (e.g. expose goal list as resource) |
| Prompts | User | Reusable message templates |
| Elicitation | Server | Server requests additional info from user mid-interaction (new, 2025-06) |

### MCP Transport

**Spec 2025-11-25:** Use **Streamable HTTP** for remote servers (replaces legacy SSE transport). stdio for local/embedded servers.

### NuGet Packages

- `ModelContextProtocol` — core + DI
- `ModelContextProtocol.AspNetCore` — HTTP server transport
- `ModelContextProtocol.Core` — low-level only

## SSE Streaming in ASP.NET Core

| Topic | URL |
|-------|-----|
| SSE in ASP.NET Core + .NET 10 (Milan Jovanović) | https://www.milanjovanovic.tech/blog/server-sent-events-in-aspnetcore-and-dotnet-10 |
| SSE in ASP.NET Core (antondevtips) | https://antondevtips.com/blog/real-time-server-sent-events-in-asp-net-core |
| Pragmatic SSE Guide (Roxeem) | https://roxeem.com/2025/10/24/a-pragmatic-guide-to-server-sent-events-sse-in-asp-net-core/ |

**Key note:** .NET 10 adds native `TypedResults.ServerSentEvents` / `Results.ServerSentEvents` with `IAsyncEnumerable<T>`. The `IChatClient.GetStreamingResponseAsync()` from `Microsoft.Extensions.AI` returns `IAsyncEnumerable<ChatResponseUpdate>` which maps naturally to SSE events.

## LLM Evaluation

| Topic | URL |
|-------|-----|
| promptfoo GitHub (open source) | https://github.com/promptfoo/promptfoo |
| promptfoo docs | https://www.promptfoo.dev/docs/intro/ |
| promptfoo assertions / expected outputs | https://www.promptfoo.dev/docs/configuration/expected-outputs/ |
| promptfoo cross-model output consistency | https://www.danielcorin.com/posts/2023/promptfoo-and-output-structure/ |
| Braintrust eval platform | https://www.braintrust.dev |
| Best prompt eval tools 2025 (Braintrust) | https://www.braintrust.dev/articles/best-prompt-evaluation-tools-2025 |
| LLM eval platforms comparison (Arize) | https://arize.com/llm-evaluation-platforms-top-frameworks/ |

**Recommendation:** Use **promptfoo** — open source, CLI-first, YAML config, works in GitHub Actions, compares multiple models side by side. Use `is-json` + JSON schema assertion for schema validation, `llm-rubric` for quality scoring.

## Structured Output

Both providers now have native structured output — schema is compiled to a grammar and token generation is constrained at inference time. This guarantees the `propose_goals` call always returns valid Goal/Task JSON.

| Topic | URL |
|-------|-----|
| Anthropic structured outputs (public beta, Nov 2025) | https://platform.claude.com/docs/en/build-with-claude/structured-outputs |
| Anthropic Agent SDK structured outputs | https://platform.claude.com/docs/en/agent-sdk/structured-outputs |
| Anthropic cookbook — extracting structured JSON | https://github.com/anthropics/anthropic-cookbook/blob/main/tool_use/extracting_structured_json.ipynb |
| OpenAI structured outputs | https://platform.openai.com/docs/guides/structured-outputs |
| LiteLLM unified JSON mode (cross-provider) | https://docs.litellm.ai/docs/completion/json_mode |
| Structured output provider comparison | https://medium.com/@rosgluk/structured-output-comparison-across-popular-llm-providers-openai-gemini-anthropic-mistral-and-1a5d42fa612a |

**Key notes:**
- Anthropic native structured outputs require beta header: `anthropic-beta: structured-outputs-2025-11-13` (Claude Sonnet 4.5+, Opus 4.1+)
- Format guarantees schema compliance, not semantic correctness — numerical ranges and business logic still need post-response validation
- The Anthropic C# SDK supports structured outputs via the Messages API; `IChatClient` tool results use standard JSON serialization

## Hosting

| Topic | URL |
|-------|-----|
| Azure Container Apps | https://azure.microsoft.com/en-us/products/container-apps |
| Azure Container Apps Pricing | https://azure.microsoft.com/en-us/pricing/details/container-apps/ |
| Azure Container Apps Billing (free tier details) | https://learn.microsoft.com/en-us/azure/container-apps/billing |
| Azure Container Apps Plan Types | https://learn.microsoft.com/en-us/azure/container-apps/plans |
| Azure Functions Pricing (for reference — not recommended for SSE) | https://azure.microsoft.com/en-us/pricing/details/functions/ |
| fly.io vs Railway comparison (2026) | https://thesoftwarescout.com/fly-io-vs-railway-2026-which-developer-platform-should-you-deploy-on/ |

## Anthropic — Building Effective Agents

| Topic | URL |
|-------|-----|
| Building Effective Agents (Anthropic Engineering blog) | https://www.anthropic.com/engineering/building-effective-agents |

**Key patterns (from the article):**

The article distinguishes **workflows** (predefined code paths orchestrating LLMs) from **agents** (LLMs dynamically directing their own tool usage). Five workflow patterns are described in increasing complexity:

1. **Prompt Chaining** — sequential steps, each LLM call processes previous output
2. **Routing** — classify input, dispatch to specialized handlers
3. **Parallelization** — run tasks simultaneously (sectioning or voting)
4. **Orchestrator-Workers** — central LLM dynamically delegates to worker LLMs
5. **Evaluator-Optimizer** — iterative refinement with evaluation feedback

**Core principle:** "Success in the LLM space isn't about building the most sophisticated system. It's about building the right system for your needs." Start simple — optimized prompts with retrieval often suffice. Only add agent complexity when demonstrated performance gains justify it.

**Three pillars:** simplicity in design, transparency in planning, meticulous tool/interface documentation.

## Claude Code — Best Practices & Architecture

| Topic | URL |
|-------|-----|
| Claude Code Best Practices | https://code.claude.com/docs/en/best-practices |
| How Claude Code Works (agentic loop, tools, context) | https://code.claude.com/docs/en/how-claude-code-works |
| Claude Code Subagents | https://code.claude.com/docs/en/sub-agents |
| Claude Code Common Workflows | https://code.claude.com/docs/en/common-workflows |
| Claude Code Extend / Features Overview | https://code.claude.com/docs/en/features-overview |
| Claude Code Skills | https://code.claude.com/docs/en/skills |
| Claude Code Documentation Index (llms.txt) | https://code.claude.com/docs/llms.txt |

**Key takeaways:**

- **Context window is the #1 resource to manage.** Performance degrades as it fills. Use `/clear` between unrelated tasks, use subagents to isolate verbose operations, use `/compact` to summarize.
- **Give Claude verification criteria** (tests, screenshots, expected outputs) — the single highest-leverage practice.
- **Explore → Plan → Implement → Commit** — separate research/planning from coding.
- **Subagents** run in isolated context windows. Three built-in types: Explore (Haiku, read-only), Plan (inherited model, read-only), General-purpose (inherited model, all tools). Custom subagents defined in `.claude/agents/` with YAML frontmatter.
- **Skills** (`.claude/skills/`) load on demand vs CLAUDE.md which loads every session — use skills for domain knowledge that's only sometimes relevant.
- **Parallel sessions** via git worktrees, desktop app, or agent teams for independent work streams.
- **Non-interactive mode** (`claude -p "prompt"`) for CI/CD integration and fan-out patterns.
