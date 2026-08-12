describe('dataSource', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  it('uses migration-safe CLI options', async () => {
    process.env.NODE_ENV = 'development';
    process.env.POSTGRES_SYNCHRONIZE = 'true';

    const dataSource = (await import('./data-source')).default;
    const options = dataSource.options as any;

    expect(options.synchronize).toBe(false);
    expect(options.dropSchema).toBe(false);
    expect(options.entities).toEqual(['src/**/*.entity{.ts,.js}']);
    expect(options.migrations).toEqual(['src/migrations/*{.ts,.js}']);
    expect(options.migrationsTableName).toBe('migrations');
  });
});
