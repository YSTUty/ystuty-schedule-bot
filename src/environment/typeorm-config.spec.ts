describe('TYPEORM_CONFIG', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  it('rejects POSTGRES_SYNCHRONIZE=true in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.POSTGRES_SYNCHRONIZE = 'true';

    await expect(import('./index')).rejects.toThrow(
      'POSTGRES_SYNCHRONIZE must not be enabled in production. Use migrations instead.',
    );
  });

  it('keeps synchronize disabled by default for non-dev databases', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.POSTGRES_SYNCHRONIZE;
    process.env.POSTGRES_DATABASE = 'ystuty-schedule-bot';

    const env = await import('./index');

    expect(env.TYPEORM_CONFIG.synchronize).toBe(false);
  });
});
