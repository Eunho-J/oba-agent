# ggui Result Surface

Updated: 2026-05-30

## Version status

The ggui `0.2.0-alpha.4` line is available on npm under the `alpha` dist-tag for the packages this project cares about:

- `@ggui-ai/react@0.2.0-alpha.4`
- `@ggui-ai/react-native@0.2.0-alpha.4`
- `@ggui-ai/protocol@0.2.0-alpha.4`
- `@ggui-ai/agent-server@0.2.0-alpha.4`
- `@ggui-ai/cli@0.2.0-alpha.4`
- `@ggui-ai/design@0.2.0-alpha.4`
- `@ggui-ai/mcp-server@0.2.0-alpha.4`

Important: npm `latest` still points to older rc/alpha versions for several packages. Install with the `alpha` tag or exact versions:

```bash
npm install @ggui-ai/react@alpha @ggui-ai/protocol@alpha
```

or:

```bash
npm install @ggui-ai/react@0.2.0-alpha.4 @ggui-ai/protocol@0.2.0-alpha.4
```

GitHub release tags currently do not appear to mirror every npm alpha tag, so npm is the source of truth for the alpha.4 package availability.

## Role in this product

ggui is the user-facing result surface for cases where plain text is a poor fit. It renders renderer-neutral outputs from the gateway into mobile/web UI. It is not the local workflow runtime, not an allowed workflow node, and not the UI for internal self-evolution.

The user should be able to ask for inline surfaces such as a reference image gallery, a comparison table, or an action confirmation view.

The agent can search or receive data through the gateway, shape it into a neutral attachment surface, and show the result inside the assistant answer bubble. The render surface does not fetch remote assets by itself; it displays provided URLs and source metadata.

## Required result surfaces

### Reference Image Gallery

Shows image exploration results.

- item title or subject name
- source URL
- image URLs
- captions or source labels when available
- fallback/sample result when the gateway is unavailable

### Comparison Table

Shows structured choices before a user makes a selection.

- item title
- price or ranking when available
- pros/cons or short notes
- source label
- required confirmation state

### Action Confirmation

Shows whether an external action is only prepared, confirmed, held, or refused.

- action summary
- confirmation token status
- confirm / hold controls
- no external execution without a valid token
- typed error display when the guard refuses execution

## Event contract sketch

ggui surfaces may emit structured user-selection events back to the agent.

```json
{
  "type": "surface.selection",
  "surfaceId": "reference-image-gallery",
  "payload": {
    "photoUrl": "https://example.test/review-1.jpg",
    "itemTitle": "Workspace reference"
  }
}
```

The main agent API decides what to do with the event. ggui does not publish workflow YAML, mutate prompts, or run self-evolution.

## Design principle

The surface should show the concrete result the user asked for. YAML and self-evolution candidates stay internal and are validated through the local registry/workflow pipeline.
