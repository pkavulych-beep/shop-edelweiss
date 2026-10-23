import { ENTITIES, getDataSourceOptions } from './data-source-options';

describe('getDataSourceOptions', () => {
  it('locally keeps synchronize on and does not run migrations', () => {
    const options = getDataSourceOptions({ NODE_ENV: 'development' });
    expect(options.synchronize).toBe(true);
    expect(options.migrationsRun).toBe(false);
  });

  it('without NODE_ENV behaves like local development', () => {
    const options = getDataSourceOptions({});
    expect(options.synchronize).toBe(true);
    expect(options.migrationsRun).toBe(false);
  });

  it('in production builds the schema only with migrations', () => {
    const options = getDataSourceOptions({ NODE_ENV: 'production' });
    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(true);
  });

  it('takes the connection from env and registers all entities and migrations', () => {
    const options = getDataSourceOptions({
      DB_HOST: 'db',
      DB_PORT: '6543',
      DB_USERNAME: 'shop',
      DB_PASSWORD: 'secret',
      DB_NAME: 'Edelweiss',
    });
    expect(options).toMatchObject({
      type: 'postgres',
      host: 'db',
      port: 6543,
      username: 'shop',
      password: 'secret',
      database: 'Edelweiss',
      entities: ENTITIES,
    });
    expect(options.migrations).toEqual([
      expect.stringMatching(/[\\/]migrations[\\/]\*\.\{ts,js\}$/),
    ]);
  });
});
