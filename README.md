# mcp-gmail

Give Claude full access to your Gmail. Search, read, send, reply, forward, manage drafts, labels, and attachments — all through the [Model Context Protocol](https://modelcontextprotocol.io/).

### What you can do

> "Search my inbox for emails from Sarah this week"
> "Draft a reply to that meeting invite"
> "Archive all read emails labeled 'notifications'"
> "Forward the latest invoice to accounting@company.com"

17 tools covering everything you'd do in Gmail — without leaving Claude.

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) runtime
- A Google account with Gmail

### 1. Google Cloud setup

<details>
<summary><b>Create project & enable Gmail API</b> (click to expand)</summary>

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. **Select a project** → **New Project** → name it (e.g., "Gmail MCP") → **Create**
3. Go to **APIs & Services** → **Library** → search **Gmail API** → **Enable**
</details>

<details>
<summary><b>Configure OAuth consent screen</b></summary>

1. Go to **APIs & Services** → **OAuth consent screen**
2. Click **Create** on the Overview tab
3. Fill in **App name** and **User support email**
4. Select **External** → **Create**
5. **Data access** tab → **Add or Remove Scopes** → find `https://www.googleapis.com/auth/gmail.modify` → check it → **Update** → **Save**
6. **Users** tab → **Add Users** → add your Gmail address → **Save**

> **Tip:** In "Testing" mode, refresh tokens expire every 7 days. To avoid this, go to **Publishing status** → **Publish App**. For personal use, Google won't require verification.
</details>

<details>
<summary><b>Create OAuth credentials</b></summary>

1. Go to **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth client ID** → **Desktop app**
3. Click **Create** → **Download JSON**
4. Save as `credentials.json` in the project root
</details>

### 2. Install & authenticate

```bash
git clone https://github.com/user/mcp-gmail.git  # replace with your repo URL
cd mcp-gmail
bun install
bun run auth    # opens browser for Gmail authorization
```

Tokens are saved locally to `.gmail-tokens.json` (git-ignored).

### 3. Add to Claude Desktop

Edit your config file:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gmail": {
      "command": "bun",
      "args": ["/ABSOLUTE/PATH/TO/mcp-gmail/src/index.ts"]
    }
  }
}
```

> **Note:** Claude Desktop doesn't inherit your shell `PATH`. If `bun` isn't found, use the full path — run `which bun` to find it.

Restart Claude Desktop. You should see **gmail** in the MCP servers list.

---

## Tools

### Email

| Tool | Description |
|------|-------------|
| `search_emails` | Search using Gmail query syntax |
| `get_email` | Get full content by message ID |
| `send_email` | Send a new email |
| `reply_to_email` | Reply to an email (preserves thread) |
| `forward_email` | Forward to new recipients |

### Drafts

| Tool | Description |
|------|-------------|
| `create_draft` | Create a new draft |
| `list_drafts` | List all drafts |
| `send_draft` | Send an existing draft |
| `delete_draft` | Permanently delete a draft |

### Organization

| Tool | Description |
|------|-------------|
| `trash_email` | Move to trash |
| `archive_email` | Remove from inbox |
| `mark_as_read` | Mark as read |
| `mark_as_unread` | Mark as unread |

### Labels

| Tool | Description |
|------|-------------|
| `list_labels` | List all labels |
| `create_label` | Create a new label |
| `apply_label` | Apply a label to a message |
| `remove_label` | Remove a label from a message |

### Attachments

| Tool | Description |
|------|-------------|
| `get_attachment` | Download attachment (base64) |

---

## Gmail Search Syntax

The `search_emails` tool supports all [Gmail search operators](https://support.google.com/mail/answer/7190):

```
from:alice@example.com          # From specific sender
to:bob@example.com              # To specific recipient
subject:meeting                 # Subject contains "meeting"
has:attachment                  # Has attachments
is:unread                       # Unread emails
is:starred                      # Starred emails
label:important                 # Has label
after:2024/01/01                # After date
before:2024/12/31               # Before date
newer_than:7d                   # Last 7 days
"exact phrase"                  # Exact match
from:alice subject:report       # Combine operators
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `credentials.json not found` | Download OAuth credentials from Google Cloud Console |
| `.gmail-tokens.json not found` | Run `bun run auth` |
| `Token has been revoked` | Re-run `bun run auth` |
| `Refresh token expired` | App is in "Testing" mode — re-run `bun run auth` or publish the app |
| `Insufficient permissions` | Ensure `gmail.modify` scope was granted during auth |
| Server not appearing in Claude | Check the config path is absolute, then restart Claude Desktop |
| `Port 3000 is already in use` | Free port 3000 and re-run `bun run auth` |

## License

[Apache 2.0](LICENSE)
