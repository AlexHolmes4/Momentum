# AI Goal-Setting Assistant — Technology References

Verified documentation links for the AI assistant feature's tech stack. Web-searched 2026-03-09. Updated as new sessions discover additional resources.

---

## .NET AI Stack Overview (2026)

Three complementary layers exist — they are not competing:

| Layer | Package | Role |
|-------|---------|------|
| `Microsoft.Extensions.AI` | `Microsoft.Extensions.AI` | Lowest-level: `IChatClient`, `IEmbeddingGenerator` — provider-agnostic primitives (GA) |
| Semantic Kernel | `Microsoft.SemanticKernel` | Orchestration: plugins, function calling, memory, multi-agent, MCP (recommended for this feature) |
| Microsoft Agent Framework | `Microsoft.AI.Agents` | Top-level: graph workflows, A2A, checkpointing, human-in-the-loop (still maturing) |

For this feature, use **Semantic Kernel** for orchestration, built on **Microsoft.Extensions.AI** for provider abstraction.

**Key note (2026):** Microsoft recommends Semantic Kernel v1.x for existing/near-term projects. For new projects, **Microsoft Agent Framework** (SK + AutoGen unified) is the future direction. Semantic Kernel is appropriate and will migrate cleanly.

## Microsoft Agent Framework & Semantic Kernel

| Topic | URL |
|-------|-----|
| Semantic Kernel Docs (Microsoft Learn) | https://learn.microsoft.com/en-us/semantic-kernel/ |
| Semantic Kernel Agent Framework | https://learn.microsoft.com/en-us/semantic-kernel/frameworks/agent/ |
| Microsoft.Extensions.AI | https://learn.microsoft.com/en-us/dotnet/ai/microsoft-extensions-ai |
| .NET + AI Ecosystem overview | https://learn.microsoft.com/en-us/dotnet/ai/dotnet-ai-ecosystem |
| Microsoft Agent Framework announcement | https://devblogs.microsoft.com/semantic-kernel/semantic-kernel-and-microsoft-agent-framework/ |
| Microsoft Agent Framework GitHub | https://github.com/microsoft/agent-framework |
| Microsoft Agent Framework — First Agent Quickstart | https://learn.microsoft.com/en-us/agent-framework/get-started/your-first-agent |
| SK + Microsoft Agent Framework (Visual Studio Magazine, Oct 2025) | https://visualstudiomagazine.com/articles/2025/10/01/semantic-kernel-autogen--open-source-microsoft-agent-framework.aspx |
| Semantic Kernel GitHub | https://github.com/microsoft/semantic-kernel |
| SK streaming API: GetStreamingChatMessageContentsAsync | https://learn.microsoft.com/en-us/dotnet/api/microsoft.semantickernel.chatcompletion.ichatcompletionservice.getstreamingchatmessagecontentsasync?view=semantic-kernel-dotnet |
| SK ChatCompletionAgent | https://learn.microsoft.com/en-us/semantic-kernel/frameworks/agent/agent-types/chat-completion-agent |
| SK OpenAI Streaming Sample | https://github.com/microsoft/semantic-kernel/blob/main/dotnet/samples/Concepts/ChatCompletion/OpenAI_ChatCompletionStreaming.cs |
| Microsoft Agent Framework Overview (Microsoft Learn) | https://learn.microsoft.com/en-us/agent-framework/overview/ |
| Migration Guide from Semantic Kernel | https://learn.microsoft.com/en-us/agent-framework/migration-guide/from-semantic-kernel/ |
| Migration Guide from AutoGen | https://learn.microsoft.com/en-us/agent-framework/migration-guide/from-autogen/ |

**Key update (2026-03):** Microsoft Agent Framework is now in **public preview** (v1.0rc4 Python, prerelease NuGet for .NET). It is the direct successor to both Semantic Kernel and AutoGen, created by the same teams. NuGet packages: `Microsoft.Agents.AI`, `Microsoft.Agents.AI.OpenAI`. Python: `pip install agent-framework --pre`. SK remains appropriate for existing projects and migrates cleanly.

## Model Context Protocol (MCP)

| Topic | URL |
|-------|-----|
| MCP Official Docs | https://modelcontextprotocol.io |
| MCP Specification (2025-11-25) | https://modelcontextprotocol.io/specification/2025-11-25 |
| MCP GitHub Organization | https://github.com/modelcontextprotocol |
| MCP C# SDK GitHub | https://github.com/modelcontextprotocol/csharp-sdk |
| MCP C# SDK API Docs | https://modelcontextprotocol.github.io/csharp-sdk/ |
| Build an MCP server in C# (.NET Blog) | https://devblogs.microsoft.com/dotnet/build-a-model-context-protocol-mcp-server-in-csharp/ |
| MCP C# SDK v1.0 release | https://devblogs.microsoft.com/dotnet/release-v10-of-the-official-mcp-csharp-sdk/ |
| SK + MCP integration guide | https://devblogs.microsoft.com/semantic-kernel/integrating-model-context-protocol-tools-with-semantic-kernel-a-step-by-step-guide/ |
| Give SK agents access to MCP servers | https://learn.microsoft.com/en-us/semantic-kernel/concepts/plugins/adding-mcp-plugins |
| Building an MCP server with SK | https://devblogs.microsoft.com/semantic-kernel/building-a-model-context-protocol-server-with-semantic-kernel/ |
| MCP TypeScript SDK | https://github.com/modelcontextprotocol/typescript-sdk |
| MCP Python build guide | https://modelcontextprotocol.io/docs/develop/build-server |
| MCP SDK overview | https://modelcontextprotocol.io/docs/sdk |
| MCP features guide (Tools/Resources/Prompts) | https://workos.com/blog/mcp-features-guide |
| Build MCP server in TypeScript (FreeCodeCamp) | https://www.freecodecamp.org/news/how-to-build-a-custom-mcp-server-with-typescript-a-handbook-for-developers/ |

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
| SSE + Semantic Kernel streaming chat | https://www.petkir.at/blog/semantic-kernel/01_chat_03_sse |
| SSE in ASP.NET Core (antondevtips) | https://antondevtips.com/blog/real-time-server-sent-events-in-asp-net-core |
| Pragmatic SSE Guide (Roxeem) | https://roxeem.com/2025/10/24/a-pragmatic-guide-to-server-sent-events-sse-in-asp-net-core/ |
| SSE MCP Server in .NET (Medium) | https://medium.com/@hany.habib1988/building-a-server-sent-event-sse-mcp-server-with-net-core-c-48ac55000336 |
| Real-Time AI Streaming with Azure OpenAI (Microsoft Community Hub) | https://techcommunity.microsoft.com/blog/azuredevcommunityblog/real%E2%80%91time-ai-streaming-with-azure-openai-and-signalr/4468833 |

**Key note:** .NET 10 adds native `TypedResults.ServerSentEvents` / `Results.ServerSentEvents` with `IAsyncEnumerable<T>`. For earlier .NET versions, set `Content-Type: text/event-stream` and write `data: ...\n\n` manually. The SK streaming primitive is `IChatCompletionService.GetStreamingChatMessageContentsAsync()` returning `IAsyncEnumerable<StreamingChatMessageContent>`.

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
- For cross-provider consistency with SK, use `RetainArgumentTypes = true` in execution settings

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
