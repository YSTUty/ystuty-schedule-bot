import { join } from 'node:path';

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
    expect(options.entities).toEqual([join(__dirname, '**/*.entity{.ts,.js}')]);
    expect(options.migrations).toEqual([
      join(__dirname, 'migrations/*{.ts,.js}'),
    ]);
    expect(options.migrationsTableName).toBe('migrations');
  });

  it('registers the conversation membership table only as an explicit entity', async () => {
    const dataSource = (await import('./data-source')).default;

    await (dataSource as any).buildMetadatas();

    const membershipTables = dataSource.entityMetadatas.filter(
      (metadata) => metadata.tableName === 'user_to_conversation',
    );

    expect(membershipTables).toHaveLength(1);
    expect(membershipTables[0].tableType).toBe('regular');
    expect(
      membershipTables[0].relations.map((relation) => ({
        property: relation.propertyName,
        inverseProperty: relation.inverseRelation?.propertyName,
      })),
    ).toEqual([
      {
        property: 'conversation',
        inverseProperty: 'userMemberships',
      },
      {
        property: 'userSocial',
        inverseProperty: 'conversationMemberships',
      },
    ]);
    expect(membershipTables[0].indices.map((index) => index.name)).toEqual([
      'IDX_d2ba571f48c738d93aaf8c51eb',
    ]);
    expect(
      membershipTables[0].foreignKeys.map((foreignKey) => ({
        name: foreignKey.name,
        onDelete: foreignKey.onDelete,
        onUpdate: foreignKey.onUpdate,
      })),
    ).toEqual([
      {
        name: 'FK_ed7ab53a15df7086d3053546057',
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'FK_3ce36341c875badc8c487a59a5e',
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
    ]);
  });
});
