---
name: one-for-all-asset
description: Parse a pasted developer asset (code, curl, prompt, configuration, or credentials), infer metadata, split secrets into private bindings, and save it to the user's One for All cloud workspace.
---

# One for All Asset Upload

Use this skill when the user asks to save, catalog, or upload reusable development material to One for All. The input may be a complete code block, a prompt, a configuration file, a curl command, or a standalone key/token.

## Required behavior

1. Treat the user's pasted material as the asset body. Do not ask the user to split shared and private sections manually.
2. Infer the following fields from the content and the surrounding request:
   - `title`: concise, useful name in the user's language.
   - `typeKey`: exactly one of `credentials`, `infra`, `prompt`, `snippet`, `database`, `component`, `website`.
   - `description`: one sentence describing the reusable purpose.
   - `tags`: 2-8 useful tags, without secrets or secret values.
3. Split sensitive values before upload. Replace detected values in `sharedContent` with `${ENV_NAME}` and put the original values in `privateBindings`:
   - `Authorization: Bearer <value>` becomes `Authorization: Bearer ${ENV_NAME}`.
   - Assignment keys ending in `KEY`, `TOKEN`, `SECRET`, or `PASSWORD` are private.
   - JSON keys such as `apiKey`, `accessToken`, `secretKey`, or `password` are private.
   - A standalone token/key is private even when no code is present; create a minimal shared template that refers to its environment variable.
   - Preserve existing `${NAME}` and `{{NAME}}` placeholders and never classify examples such as `sk-…`, `your-key`, or `placeholder` as real secrets.
4. Choose a descriptive environment variable. Prefer an existing key name; for GPT Image input use `GPT_IMAGE_API_KEY`, otherwise use a specific uppercase name such as `OPENROUTER_API_KEY` or `API_BEARER_TOKEN`.
5. Upload the result with the bundled script. The script repeats sensitive-value detection as a final guard and sends `sharedContent` plus `privateBindings` to the owner-scoped One for All API.
6. After success, report only the title, type, tags, asset ID, `openUrl`, the number of private bindings, and whether the run created a new asset or updated an existing one. Give the user the `openUrl` so they can open the asset in One for All. Never print private values, the full request body, cookies, passwords, or bearer tokens.

## Upload procedure

The script is at `skills/one-for-all-asset/scripts/publish_asset.mjs`. Run it from the user's current project so it can read that project's `.env.local`:

```bash
node /path/to/one-for-all/skills/one-for-all-asset/scripts/publish_asset.mjs \
  --title "$TITLE" --type "$TYPE_KEY" --description "$DESCRIPTION" --tags "$TAGS" \
  < "$INPUT_FILE"
```

For website assets, pass `--type website --url "$URL" --folder "$FOLDER"` (the URL can also be inferred from a standalone URL body).

The input file should be temporary and mode `600` when it contains secrets; remove it immediately after the command completes. Do not put the raw secret in command-line arguments, shell history, logs, or a committed file. If the user already supplied a local file, pass it directly as `INPUT_FILE`.

For a non-mutating check, add `--dry-run`; it prints inferred metadata and private variable names only. Normal execution is an upload and is authorized by this skill's purpose.

## Create vs. update

The script talks to the owner-scoped API and returns a structured JSON result: `id`, `title`, `typeKey`, `tags`, `privateBindingCount`, `action` (`created` or `updated`), and `openUrl` (`https://tools.chatcanvas.online/a/<id>`). Use the same protocol for `website`, `prompt`, `snippet`, `credentials`, `infra`, `database`, and `component`.

Default behavior:

1. If the user or this session already has an asset ID, pass `--asset-id <UUID>` so the script updates that asset (`PUT /assets/:id`).
2. Otherwise the script lists existing assets and **reuses an ID** when it finds an exact match:
   - `website`: same normalized URL
   - other types: same `typeKey` + same title (case-insensitive)
3. Pass `--force-create` only when the user explicitly wants a new variant kept side by side.
4. If no new private values are detected during an update, the script omits `privateBindings` and preserves existing bindings. Pass `--clear-private` only when the user explicitly asks to remove them.

Policy:

- **Update in place** when the pasted material is a revision of the same task/subject, including a completed version of a truncated paste.
- **Create new** when the task differs, or when the user wants multiple variants.
- If the match is uncertain, pass `--force-create` rather than guessing an ID. Never overwrite an asset the user did not clearly re-supply.

## Authentication

The script loads `.env.local` in the current working directory (or the path in `OFA_ENV_FILE`). Prefer a short-lived `OFA_SESSION_TOKEN` Bearer token. Otherwise set `OFA_EMAIL` and `OFA_PASSWORD` for one-time login; the script exchanges them for an HttpOnly session cookie without printing it. `OFA_API_URL` can override the default `https://tools.chatcanvas.online/api/v1` for local testing.

Do not use or expose the development asset's API key as the One for All login credential. The asset's private values belong in `privateBindings` and are encrypted by the server.

Read [references/api.md](references/api.md) only when the API contract or authentication details need to be checked.
