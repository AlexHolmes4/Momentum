# Pull Reference Context

Search the project's documentation reference files for sections relevant to the current discussion topic.

## Instructions

1. Identify the topic from: `$ARGUMENTS` (if provided), or infer from the recent conversation context
2. Search for reference files in the project:
   - `docs/*references*.md`
   - `docs/*refs*.md`
   - Any markdown files in `docs/` containing "References" in their heading
3. Read the matching files and extract **only the sections relevant** to the topic — don't dump the entire file
4. Present the extracted context concisely:
   - Section heading
   - Key links (as clickable markdown)
   - Any important notes or caveats
5. If no reference file exists or the topic isn't covered, say so and suggest using `/research-refs` to add it

## Example Usage

- `/ref MCP` → pulls the Model Context Protocol section
- `/ref structured output` → pulls the Structured Output section
- `/ref` (no args) → infers topic from recent conversation
