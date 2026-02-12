import { describe, it, expect, vi } from 'vitest';
import { sendEmail, EmailTemplates } from '../email';

// Mock Resend
vi.mock('resend', () => {
  return {
    Resend: class {
      emails = {
        send: vi.fn().mockResolvedValue({ data: { id: 'msg_123' }, error: null })
      };
    }
  };
});

import { resend } from '../email';

describe('Email Utility', () => {
  it('should format welcome email correctly', () => {
    const template = EmailTemplates.welcome('John Doe');
    expect(template.subject).toBe('Welcome to ReadMart!');
    expect(template.html).toContain('John Doe');
    expect(template.html).toContain('Start Reading');
  });

  it('should format order confirmation correctly', () => {
    const template = EmailTemplates.orderConfirmation('ORD-123', 'KES 1,500');
    expect(template.subject).toBe('Order Confirmation #ORD-123');
    expect(template.html).toContain('ORD-123');
    expect(template.html).toContain('KES 1,500');
  });

  it('should format partner approval correctly', () => {
    const template = EmailTemplates.partnerApproval('Acme Corp');
    expect(template.subject).toBe('Partnership Application Approved!');
    expect(template.html).toContain('Acme Corp');
    expect(template.html).toContain('approved');
  });

  it('should call sendEmail with correct parameters', async () => {
    const options = {
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test content</p>'
    };

    const result = await sendEmail(options);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 'msg_123' });
    expect(resend?.emails.send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test content</p>'
    }));
  });
});
