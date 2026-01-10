# Interior Design Agent Memory System — Design Overview

## Architecture (high level)
- **Frontend (React/Vite)**: ChatGPT-style UI with project list (sidebar) and chat panel. Uses REST + WebSocket for chat. Handles optimistic send, streaming-like reveal, option cards, and design saves.
- **Backend (Django + DRF + Channels)**:
  - REST: auth (token), projects, versions, images, feedback, preferences, chat messages, agent chat pipeline, demo seed.
  - WebSocket: `/ws/chat/?project_id=..&token=..` pushes assistant replies.
  - In-memory channel layer (Channels) for demo; can swap to Redis for scale.
- **Memory model**:
  - Project → DesignVersions → GeneratedImages
  - FeedbackEvents (select/reject/modify/save) + Preference learning
  - ChatMessages (user/assistant/system) with metadata_json storing design_options, resolved_context, version info.
  - Canonical version = latest DesignVersion with a save FeedbackEvent.

## Data Model (simplified)
- **Project**: user, room_type, title, timestamps.
- **DesignVersion**: project FK, version_number (auto per project), parent_version FK, notes, created_at.
- **GeneratedImage**: design_version FK, prompt, params_json, image_url, created_at.
- **FeedbackEvent**: user FK, project FK, design_version FK (nullable), event_type (select/reject/modify/save), payload_json, created_at.
- **Preference**: user FK, key, value, confidence, source, updated_at.
- **ProjectLink**: from_project, to_project, link_type, reason, created_at.
- **ChatMessage**: user, project, role (user/assistant/system), content, metadata_json, created_at.
- **UserProfile**: OneToOne with User for display name.

## Retrieval strategy
- Detect target project/room from message or explicit project_id.
- Detect cross-room reference phrases (“same vibe as bedroom”, “like …”).
- Prefer canonical saved version for reference summaries; fall back to latest version.
- Return bounded context:
  - Preferences (top 10 by confidence)
  - Reference project + canonical version + last images/events
  - Recent target events
  - Retrieval reason (if cross-room detected)

## Preference learning
- Rule-based for now:
  - Text cues: “warmer”, “plants/greenery” → tone=warm, plants=true
  - Selection: favorite_option_index
- Confidences capped at 1.0; source explicit/implicit.

## Agent pipeline (/api/agent/chat)
1) Save user ChatMessage.
2) Resolve context (per above).
3) Call LLM (Claude) or MOCK_LLM.
4) Parse strict JSON { reply, design_options, version_action, preference_hints }.
5) Create versions/images if requested; store attachments in assistant metadata_json (design_options with image_url, resolved_context, version_id).
6) Save assistant ChatMessage; return payload to client.

## Demo flow (scripted)
- Bedroom session: modern request → 5 options; pick option 3; make warmer → v2; save canonical.
- Living room: “same vibe as bedroom” should use bedroom canonical.
- Bedroom update: add plants → v3 parented to canonical.
- Office: simpler, using learned prefs (warm tones, plants).
> Note: Demo seed endpoint exists on backend; UI button currently removed.

## Key technology choices
- **Django + DRF**: rapid CRUD, auth, migrations.
- **Channels**: WebSocket push for chat; in-memory layer for demo (swap to Redis if needed).
- **SQLite**: demo storage; swap to Postgres for prod.
- **React/Vite**: fast dev, simple state; WebSocket client + REST fallback.

## Trade-offs
- **In-memory channel layer**: fine for demo, not for multi-instance; would use Redis in production.
- **Rule-based learning**: good for demo determinism; would extend with embeddings/pattern mining later.
- **SQLite**: simple; not suitable for multi-user scale; Postgres recommended.
- **Optimistic UI without true streaming**: WS simulates push; real tokenized streaming would require chunked LLM output.

## Tests (current gaps)
- Coverage exists for canonical version and agent metadata. Still need more around context retrieval and preference learning for full confidence.
