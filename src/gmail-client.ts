import { google, gmail_v1 } from 'googleapis';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getHeader,
  extractBody,
  extractAttachments,
  stripHtml,
  buildMimeMessage,
  type AttachmentInfo,
} from './utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

export interface EmailSummary {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
}

export interface EmailDetail {
  id: string;
  threadId: string;
  labelIds: string[];
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  body: string;
  htmlBody: string;
  attachments: AttachmentInfo[];
}

export interface DraftSummary {
  draftId: string;
  messageId: string;
  snippet: string;
  subject: string;
  to: string;
}

export interface LabelInfo {
  id: string;
  name: string;
  type: string;
  messagesTotal?: number;
  messagesUnread?: number;
}

export class GmailClient {
  private gmail: gmail_v1.Gmail;

  constructor() {
    const credentialsPath = resolve(PROJECT_ROOT, 'credentials.json');
    const tokensPath = resolve(PROJECT_ROOT, '.gmail-tokens.json');

    let credentials: Record<string, unknown>;
    try {
      credentials = JSON.parse(readFileSync(credentialsPath, 'utf-8'));
    } catch {
      throw new Error(
        'credentials.json not found. Run the auth setup first — see README.md for instructions.',
      );
    }

    let tokens: Record<string, unknown>;
    try {
      tokens = JSON.parse(readFileSync(tokensPath, 'utf-8'));
    } catch {
      throw new Error(
        '.gmail-tokens.json not found. Run "bun run auth" to authenticate with Gmail.',
      );
    }

    const config = (credentials as Record<string, Record<string, string>>).installed ||
      (credentials as Record<string, Record<string, string>>).web;
    if (!config) {
      throw new Error('Invalid credentials.json format.');
    }

    const auth = new google.auth.OAuth2(config.client_id, config.client_secret);
    auth.setCredentials(tokens);

    this.gmail = google.gmail({ version: 'v1', auth });
  }

  async searchEmails(
    query: string,
    maxResults: number = 10,
    pageToken?: string,
  ): Promise<{ emails: EmailSummary[]; nextPageToken?: string }> {
    const res = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
      pageToken,
    });

    const messages = res.data.messages || [];
    if (messages.length === 0) {
      return { emails: [], nextPageToken: res.data.nextPageToken ?? undefined };
    }

    const emails = await Promise.all(
      messages.map(async (msg) => {
        const detail = await this.gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        });
        const headers = detail.data.payload?.headers;
        return {
          id: detail.data.id || '',
          threadId: detail.data.threadId || '',
          snippet: detail.data.snippet || '',
          from: getHeader(headers, 'From') || '',
          to: getHeader(headers, 'To') || '',
          subject: getHeader(headers, 'Subject') || '',
          date: getHeader(headers, 'Date') || '',
        };
      }),
    );

    return { emails, nextPageToken: res.data.nextPageToken ?? undefined };
  }

  async getEmail(messageId: string): Promise<EmailDetail> {
    const res = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const headers = res.data.payload?.headers;
    const { text, html } = extractBody(res.data.payload!);
    const attachments = extractAttachments(res.data.payload!);
    const body = text || (html ? stripHtml(html) : '');

    return {
      id: res.data.id || '',
      threadId: res.data.threadId || '',
      labelIds: res.data.labelIds || [],
      from: getHeader(headers, 'From') || '',
      to: getHeader(headers, 'To') || '',
      cc: getHeader(headers, 'Cc') || '',
      subject: getHeader(headers, 'Subject') || '',
      date: getHeader(headers, 'Date') || '',
      body,
      htmlBody: html,
      attachments,
    };
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
    cc?: string,
    bcc?: string,
    isHtml: boolean = false,
  ): Promise<{ messageId: string; threadId: string }> {
    const raw = buildMimeMessage({
      to,
      subject,
      cc,
      bcc,
      textBody: isHtml ? undefined : body,
      htmlBody: isHtml ? body : undefined,
    });

    const res = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    return { messageId: res.data.id || '', threadId: res.data.threadId || '' };
  }

  async replyToEmail(
    messageId: string,
    body: string,
    isHtml: boolean = false,
    replyAll: boolean = false,
  ): Promise<{ messageId: string; threadId: string }> {
    const original = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'metadata',
      metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Message-ID', 'References'],
    });

    const headers = original.data.payload?.headers;
    const originalFrom = getHeader(headers, 'From') || '';
    const originalTo = getHeader(headers, 'To') || '';
    const originalCc = getHeader(headers, 'Cc') || '';
    const originalSubject = getHeader(headers, 'Subject') || '';
    const originalMessageId = getHeader(headers, 'Message-ID') || '';
    const originalReferences = getHeader(headers, 'References') || '';

    const subject = originalSubject.startsWith('Re:') ? originalSubject : `Re: ${originalSubject}`;
    const to = originalFrom;
    const cc = replyAll
      ? [originalTo, originalCc].filter(Boolean).join(', ')
      : undefined;

    const references = originalReferences
      ? `${originalReferences} ${originalMessageId}`
      : originalMessageId;

    const raw = buildMimeMessage({
      to,
      subject,
      cc,
      textBody: isHtml ? undefined : body,
      htmlBody: isHtml ? body : undefined,
      inReplyTo: originalMessageId,
      references,
    });

    const res = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        threadId: original.data.threadId || undefined,
      },
    });

    return { messageId: res.data.id || '', threadId: res.data.threadId || '' };
  }

  async forwardEmail(
    messageId: string,
    to: string,
  ): Promise<{ messageId: string; threadId: string }> {
    const email = await this.getEmail(messageId);

    const subject = email.subject.startsWith('Fwd:')
      ? email.subject
      : `Fwd: ${email.subject}`;

    const forwardedBody = [
      '',
      '---------- Forwarded message ---------',
      `From: ${email.from}`,
      `Date: ${email.date}`,
      `Subject: ${email.subject}`,
      `To: ${email.to}`,
      '',
      email.body,
    ].join('\n');

    const raw = buildMimeMessage({
      to,
      subject,
      textBody: forwardedBody,
    });

    const res = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    return { messageId: res.data.id || '', threadId: res.data.threadId || '' };
  }

  async createDraft(
    to: string,
    subject: string,
    body: string,
    cc?: string,
    bcc?: string,
    isHtml: boolean = false,
  ): Promise<{ draftId: string; messageId: string }> {
    const raw = buildMimeMessage({
      to,
      subject,
      cc,
      bcc,
      textBody: isHtml ? undefined : body,
      htmlBody: isHtml ? body : undefined,
    });

    const res = await this.gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: { raw },
      },
    });

    return {
      draftId: res.data.id || '',
      messageId: res.data.message?.id || '',
    };
  }

  async listDrafts(
    maxResults: number = 10,
    pageToken?: string,
  ): Promise<{ drafts: DraftSummary[]; nextPageToken?: string }> {
    const res = await this.gmail.users.drafts.list({
      userId: 'me',
      maxResults,
      pageToken,
    });

    const drafts = res.data.drafts || [];
    if (drafts.length === 0) {
      return { drafts: [], nextPageToken: res.data.nextPageToken ?? undefined };
    }

    const summaries = await Promise.all(
      drafts.map(async (draft) => {
        const detail = await this.gmail.users.drafts.get({
          userId: 'me',
          id: draft.id!,
          format: 'metadata',
        });
        const headers = detail.data.message?.payload?.headers;
        return {
          draftId: detail.data.id || '',
          messageId: detail.data.message?.id || '',
          snippet: detail.data.message?.snippet || '',
          subject: getHeader(headers, 'Subject') || '',
          to: getHeader(headers, 'To') || '',
        };
      }),
    );

    return { drafts: summaries, nextPageToken: res.data.nextPageToken ?? undefined };
  }

  async sendDraft(draftId: string): Promise<{ messageId: string; threadId: string }> {
    const res = await this.gmail.users.drafts.send({
      userId: 'me',
      requestBody: { id: draftId },
    });

    return {
      messageId: res.data.id || '',
      threadId: res.data.threadId || '',
    };
  }

  async deleteDraft(draftId: string): Promise<void> {
    await this.gmail.users.drafts.delete({
      userId: 'me',
      id: draftId,
    });
  }

  async trashEmail(messageId: string): Promise<void> {
    await this.gmail.users.messages.trash({
      userId: 'me',
      id: messageId,
    });
  }

  async archiveEmail(messageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: ['INBOX'] },
    });
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: ['UNREAD'] },
    });
  }

  async markAsUnread(messageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { addLabelIds: ['UNREAD'] },
    });
  }

  async listLabels(): Promise<LabelInfo[]> {
    const res = await this.gmail.users.labels.list({ userId: 'me' });
    return (res.data.labels || []).map((label) => ({
      id: label.id || '',
      name: label.name || '',
      type: label.type || '',
      messagesTotal: label.messagesTotal ?? undefined,
      messagesUnread: label.messagesUnread ?? undefined,
    }));
  }

  async createLabel(
    name: string,
    backgroundColor?: string,
    textColor?: string,
  ): Promise<LabelInfo> {
    const requestBody: gmail_v1.Schema$Label = {
      name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    };

    if (backgroundColor || textColor) {
      requestBody.color = {
        backgroundColor: backgroundColor || '#000000',
        textColor: textColor || '#ffffff',
      };
    }

    const res = await this.gmail.users.labels.create({
      userId: 'me',
      requestBody,
    });

    return {
      id: res.data.id || '',
      name: res.data.name || '',
      type: res.data.type || 'user',
    };
  }

  async applyLabel(messageId: string, labelId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { addLabelIds: [labelId] },
    });
  }

  async removeLabel(messageId: string, labelId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: [labelId] },
    });
  }

  async getAttachment(
    messageId: string,
    attachmentId: string,
  ): Promise<{ data: string; size: number }> {
    const res = await this.gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    return {
      data: res.data.data || '',
      size: res.data.size || 0,
    };
  }
}
