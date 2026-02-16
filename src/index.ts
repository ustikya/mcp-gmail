#!/usr/bin/env bun
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { GmailClient } from './gmail-client.js';

const server = new McpServer({
  name: 'mcp-gmail',
  version: '1.0.0',
});

const gmail = new GmailClient();

// --- Email Search & Read ---

server.tool(
  'search_emails',
  'Search emails using Gmail query syntax (e.g., "from:alice subject:meeting is:unread"). Returns matching messages with snippets.',
  {
    query: z.string().describe('Gmail search query (supports Gmail search operators)'),
    maxResults: z.number().optional().default(10).describe('Maximum number of results (1-100, default: 10)'),
    pageToken: z.string().optional().describe('Token for next page of results'),
  },
  async ({ query, maxResults, pageToken }) => {
    try {
      const result = await gmail.searchEmails(query, maxResults, pageToken);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  'get_email',
  'Get the full content of an email by message ID. Returns headers, body text, and attachment list.',
  {
    messageId: z.string().describe('The email message ID'),
  },
  async ({ messageId }) => {
    try {
      const result = await gmail.getEmail(messageId);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// --- Send & Reply ---

server.tool(
  'send_email',
  'Send a new email message.',
  {
    to: z.string().describe('Recipient email address(es), comma-separated'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body content'),
    cc: z.string().optional().describe('CC recipients, comma-separated'),
    bcc: z.string().optional().describe('BCC recipients, comma-separated'),
    isHtml: z.boolean().optional().default(false).describe('Whether body is HTML (default: plain text)'),
  },
  async ({ to, subject, body, cc, bcc, isHtml }) => {
    try {
      const result = await gmail.sendEmail(to, subject, body, cc, bcc, isHtml);
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'sent', ...result }, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  'reply_to_email',
  'Reply to an existing email, preserving the thread. Automatically sets reply headers.',
  {
    messageId: z.string().describe('The message ID to reply to'),
    body: z.string().describe('Reply body content'),
    isHtml: z.boolean().optional().default(false).describe('Whether body is HTML'),
    replyAll: z.boolean().optional().default(false).describe('Reply to all recipients'),
  },
  async ({ messageId, body, isHtml, replyAll }) => {
    try {
      const result = await gmail.replyToEmail(messageId, body, isHtml, replyAll);
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'sent', ...result }, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  'forward_email',
  'Forward an email to new recipients.',
  {
    messageId: z.string().describe('The message ID to forward'),
    to: z.string().describe('Recipient email address(es), comma-separated'),
  },
  async ({ messageId, to }) => {
    try {
      const result = await gmail.forwardEmail(messageId, to);
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'forwarded', ...result }, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// --- Drafts ---

server.tool(
  'create_draft',
  'Create a new email draft.',
  {
    to: z.string().describe('Recipient email address(es), comma-separated'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body content'),
    cc: z.string().optional().describe('CC recipients, comma-separated'),
    bcc: z.string().optional().describe('BCC recipients, comma-separated'),
    isHtml: z.boolean().optional().default(false).describe('Whether body is HTML'),
  },
  async ({ to, subject, body, cc, bcc, isHtml }) => {
    try {
      const result = await gmail.createDraft(to, subject, body, cc, bcc, isHtml);
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'draft_created', ...result }, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  'list_drafts',
  'List email drafts.',
  {
    maxResults: z.number().optional().default(10).describe('Maximum number of results (default: 10)'),
    pageToken: z.string().optional().describe('Token for next page of results'),
  },
  async ({ maxResults, pageToken }) => {
    try {
      const result = await gmail.listDrafts(maxResults, pageToken);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  'send_draft',
  'Send an existing draft by its draft ID.',
  {
    draftId: z.string().describe('The draft ID to send'),
  },
  async ({ draftId }) => {
    try {
      const result = await gmail.sendDraft(draftId);
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'sent', ...result }, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  'delete_draft',
  'Permanently delete a draft.',
  {
    draftId: z.string().describe('The draft ID to delete'),
  },
  async ({ draftId }) => {
    try {
      await gmail.deleteDraft(draftId);
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'deleted', draftId }, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// --- Email Organization ---

server.tool(
  'trash_email',
  'Move an email to the trash.',
  {
    messageId: z.string().describe('The message ID to trash'),
  },
  async ({ messageId }) => {
    try {
      await gmail.trashEmail(messageId);
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'trashed', messageId }, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  'archive_email',
  'Archive an email by removing it from the inbox.',
  {
    messageId: z.string().describe('The message ID to archive'),
  },
  async ({ messageId }) => {
    try {
      await gmail.archiveEmail(messageId);
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'archived', messageId }, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  'mark_as_read',
  'Mark an email as read.',
  {
    messageId: z.string().describe('The message ID to mark as read'),
  },
  async ({ messageId }) => {
    try {
      await gmail.markAsRead(messageId);
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'marked_read', messageId }, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  'mark_as_unread',
  'Mark an email as unread.',
  {
    messageId: z.string().describe('The message ID to mark as unread'),
  },
  async ({ messageId }) => {
    try {
      await gmail.markAsUnread(messageId);
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'marked_unread', messageId }, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// --- Labels ---

server.tool(
  'list_labels',
  'List all Gmail labels.',
  {},
  async () => {
    try {
      const labels = await gmail.listLabels();
      return { content: [{ type: 'text', text: JSON.stringify(labels, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  'create_label',
  'Create a new Gmail label.',
  {
    name: z.string().describe('Label name (use "/" for nested labels, e.g., "Projects/Work")'),
    backgroundColor: z.string().optional().describe('Background color hex code'),
    textColor: z.string().optional().describe('Text color hex code'),
  },
  async ({ name, backgroundColor, textColor }) => {
    try {
      const label = await gmail.createLabel(name, backgroundColor, textColor);
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'created', ...label }, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  'apply_label',
  'Apply a label to an email message.',
  {
    messageId: z.string().describe('The message ID'),
    labelId: z.string().describe('The label ID to apply'),
  },
  async ({ messageId, labelId }) => {
    try {
      await gmail.applyLabel(messageId, labelId);
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'label_applied', messageId, labelId }, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

server.tool(
  'remove_label',
  'Remove a label from an email message.',
  {
    messageId: z.string().describe('The message ID'),
    labelId: z.string().describe('The label ID to remove'),
  },
  async ({ messageId, labelId }) => {
    try {
      await gmail.removeLabel(messageId, labelId);
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'label_removed', messageId, labelId }, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// --- Attachments ---

server.tool(
  'get_attachment',
  'Download an email attachment. Returns the content as base64-encoded data.',
  {
    messageId: z.string().describe('The message ID containing the attachment'),
    attachmentId: z.string().describe('The attachment ID (from get_email results)'),
  },
  async ({ messageId, attachmentId }) => {
    try {
      const result = await gmail.getAttachment(messageId, attachmentId);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
);

// --- Start Server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
