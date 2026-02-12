import { expect, test, describe, vi, beforeAll } from 'vitest';

// Mock Supabase functions
vi.mock('../api/_db', async () => {
  const actual = await vi.importActual<typeof import('../api/_db')>('../api/_db');
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'test-log-id' }, error: null }),
  };
  return { ...actual, supabase: mockSupabase };
});

// Mock Resend
vi.mock('resend', async () => {
  const mockSend = vi.fn().mockResolvedValue({ data: { id: 'resend-id' }, error: null });
  class MockResend {
    constructor(apiKey: string) {}
    emails = {
      send: mockSend
    };
  }
  return {
    __esModule: true,
    default: MockResend,
    mockSend,
  };
});

// Mock sendEmail from _email.ts
vi.mock('../api/_email', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_email')>();
  const resendModule = await import('resend') as any;
  const mockedGetResend = vi.fn(() => ({
    emails: {
      send: resendModule.mockSend
    }
  }));

  return {
    ...actual,
    getResend: mockedGetResend,
  };
});

describe('Email System Integration', () => {
  let sendEmail: typeof import('../api/_email').sendEmail;
  let mockSupabase: any;
  let mockSend: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    vi.clearAllMocks();
    const emailModule = await import('../api/_email');
    sendEmail = emailModule.sendEmail;
    const dbModule = await import('../api/_db');
    mockSupabase = dbModule.supabase;
    const resendModule = await import('resend') as any;
    mockSend = resendModule.mockSend;
  });

  test('sendEmail logs to database and calls Resend', async () => {
    const params = {
      to: 'test@example.com',
      subject: 'Test Subject',
      body: 'Test Message'
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
    mockSend.mockResolvedValueOnce({
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
