# Database Design - One for All

## Overview

Two-table minimal design for MVP multi-user support.

## Tables

### users

User authentication and profile.

| Column     | Type      | Constraints       | Description              |
|------------|-----------|-------------------|--------------------------|
| id         | STRING    | PK, CUID          | User ID                  |
| email      | STRING    | UNIQUE, NOT NULL  | Email for login          |
| name       | STRING    | NOT NULL          | Display name             |
| avatar_url | STRING    | NULLABLE          | Avatar URL               |
| password   | STRING    | NOT NULL          | bcrypt hashed password   |
| created_at | TIMESTAMP | DEFAULT now()     | Creation time            |
| updated_at | TIMESTAMP | AUTO UPDATE       | Last update time         |

### assets

Development assets with shared template and private bindings.

| Column           | Type      | Constraints       | Description                              |
|------------------|-----------|-------------------|------------------------------------------|
| id               | STRING    | PK, CUID          | Asset ID                                 |
| user_id          | STRING    | FK -> users.id    | Owner user ID                            |
| title            | STRING    | NOT NULL          | Asset title                              |
| type_key         | STRING    | NOT NULL          | Asset type (credentials/infra/etc)       |
| description      | STRING    | DEFAULT ''        | Asset description                        |
| tags             | JSON      | DEFAULT []        | Tags array                               |
| shared_content   | TEXT      | NOT NULL          | Template with {{PLACEHOLDER}}            |
| private_bindings | JSON      | DEFAULT {}        | Record<string, string>, encrypted values |
| favorite         | BOOLEAN   | DEFAULT false     | Favorite flag                            |
| used_at          | TIMESTAMP | DEFAULT now()     | Last used time                           |
| created_at       | TIMESTAMP | DEFAULT now()     | Creation time                            |
| updated_at       | TIMESTAMP | AUTO UPDATE       | Last update time                         |

**Indexes:**
- user_id (foreign key)
- type_key (filter by type)
- favorite (filter favorites)
- used_at (sort by recent)

## Data Model Mapping

### From localStorage to Database

Current localStorage model:
```typescript
type Asset = {
  id: string
  title: string
  typeKey: 'credentials' | 'infra' | 'prompt' | 'snippet' | 'database' | 'component'
  description: string
  tags: string[]
  sharedContent: string
  privateBindings: Record<string, string>
  favorite: boolean
  updated: string
  used: string
}
```

Database model adds:
- `user_id`: Asset ownership
- `created_at`: Creation timestamp (in addition to updated_at)
- DB-level constraints and indexes

Migration strategy:
1. Export existing localStorage data
2. Create user account
3. Import assets with user_id reference

## Security Notes

### Private Bindings Encryption

`private_bindings` field stores encrypted sensitive values:
- Application-level encryption before storing to DB
- Encryption key stored in environment variable or KMS
- Never log or expose raw private_bindings in API responses

### Access Control

- Assets are scoped by `user_id`
- All asset operations require authentication
- Users can only access their own assets

## Future Extensions

When needed, these tables can be added:
- `workspaces`: Multi-user workspaces
- `workspace_members`: Team membership
- `asset_versions`: Version history
- `audit_logs`: Security audit trail
