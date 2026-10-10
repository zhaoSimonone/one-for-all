# One for All API contract

The default API base is `https://tools.chatcanvas.online/api/v1`.

## Authentication

- `POST /auth/login` with `{ "email": "...", "password": "..." }` returns an HttpOnly `ofa_session` cookie.
- Asset requests may use `Cookie: ofa_session=...` or `Authorization: Bearer <JWT>`.
- `GET /auth/me` is useful for checking a token, but never print the response token or cookie.

## Create asset

`POST /assets` accepts:

```json
{
  "title": "string",
  "typeKey": "credentials | infra | prompt | snippet | database | component | website",
  "description": "string",
  "tags": ["string"],
  "sharedContent": "string",
  "privateBindings": { "ENV_NAME": "secret value" },
  "favorite": false
}
```

The server encrypts `privateBindings` with AES-256-GCM before writing PostgreSQL. Normal asset responses contain only private variable names and lengths; real values are owner-only. The uploader must never log the request body or API response containing private values.
