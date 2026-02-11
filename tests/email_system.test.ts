import { expect, test, describe, vi } from 'vitest';
import { sendEmail } from '../api/_email';
import { supabase } from '../api/_db';

// Mock Supabase functions
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'test-log-id' }, error: null }),
};

vi.mock('../api/_db', () => ({
  supabase: mockSupabase
}));

// Mock Resend
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'resend-id' }, error: null })
    }
  }))
}));

describe('Email System Integration', () => {
  test('sendEmail logs to database and calls Resend', async () => {
    const params = {
      to: 'test@example.com',
      subject: 'Test Subject',
      message: 'Test Message'
    };

    const result = await sendEmail(params as any);

    // Verify database logging was initiated
    expect(mockSupabase.from).toHaveBeenCalledWith('notification_logs');
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ recipient: 'test@example.com', subject: 'Test Subject' })
    ]));

    // Verify result
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('resend-id');
  });

  test('sendEmail handles Resend failure and updates log', async () => {
    // Override mock for failure case
    const { Resend } = await import('resend');
    const mockResend = new Resend('key');
    (mockResend.emails.send as any).mockResolvedValueOnce({ 
      data: null, 
      error: { name: 'error', message: 'API Failure' } 
    });

    const result = await sendEmail({
      to: 'fail@example.com',
      subject: 'Fail',
      html: '<p>Fail</p>'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('API Failure');
    
    // Verify log was updated with failure
    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error_message: 'API Failure'
    }));
  });
});
