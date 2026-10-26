import {
  MIN_JWT_SECRET_LENGTH,
  parseFrontendOrigins,
  PLACEHOLDER_JWT_SECRET,
  resolveCorsOrigin,
  resolveJwtSecret,
  resolveTrustProxy,
} from './security';

const longSecret = 'a'.repeat(MIN_JWT_SECRET_LENGTH);

function createLogger() {
  return { error: jest.fn(), warn: jest.fn() };
}

describe('resolveJwtSecret', () => {
  it('returns the configured secret in production', () => {
    const logger = createLogger();
    const secret = resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: longSecret }, logger);

    expect(secret).toBe(longSecret);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('refuses to start in production without a secret', () => {
    const logger = createLogger();

    expect(() => resolveJwtSecret({ NODE_ENV: 'production' }, logger)).toThrow(/JWT_SECRET/);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET'));
  });

  it('refuses to start in production with the change-me placeholder', () => {
    const logger = createLogger();

    expect(() =>
      resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: PLACEHOLDER_JWT_SECRET }, logger),
    ).toThrow(/change-me/);
    expect(logger.error).toHaveBeenCalled();
  });

  it('only warns when the production secret is shorter than 32 characters', () => {
    const logger = createLogger();
    const secret = resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'short' }, logger);

    expect(secret).toBe('short');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(String(MIN_JWT_SECRET_LENGTH)),
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('does not require a secret outside production', () => {
    const logger = createLogger();

    expect(resolveJwtSecret({}, logger)).toBeUndefined();
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('trims a secret that has surrounding whitespace', () => {
    const secret = resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: `  ${longSecret}  ` });

    expect(secret).toBe(longSecret);
  });
});

describe('parseFrontendOrigins', () => {
  it('splits comma-separated URLs and removes trailing slashes', () => {
    expect(
      parseFrontendOrigins(
        'https://shop.example.com/, http://localhost:3005/ ,https://admin.example.com',
      ),
    ).toEqual(['https://shop.example.com', 'http://localhost:3005', 'https://admin.example.com']);
  });

  it('drops empty entries and duplicates', () => {
    expect(parseFrontendOrigins('https://shop.example.com,, https://shop.example.com/')).toEqual([
      'https://shop.example.com',
    ]);
  });

  it('returns an empty list without FRONTEND_URL', () => {
    expect(parseFrontendOrigins(undefined)).toEqual([]);
    expect(parseFrontendOrigins('')).toEqual([]);
  });
});

describe('resolveCorsOrigin', () => {
  it('allows only the configured FRONTEND_URL values', () => {
    expect(
      resolveCorsOrigin({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://shop.example.com/,https://admin.example.com',
      }),
    ).toEqual(['https://shop.example.com', 'https://admin.example.com']);
  });

  it('allows any localhost port outside production without FRONTEND_URL', () => {
    const origin = resolveCorsOrigin({ NODE_ENV: 'development' });

    expect(origin).toBeInstanceOf(RegExp);
    const pattern = origin as RegExp;
    expect(pattern.test('http://localhost:3000')).toBe(true);
    expect(pattern.test('http://localhost:3005')).toBe(true);
    expect(pattern.test('https://evil.example.com')).toBe(false);
    expect(pattern.test('http://localhost.evil.example.com')).toBe(false);
    expect(pattern.test('https://localhost:3000')).toBe(false);
  });

  it('allows no cross-origin requests in production without FRONTEND_URL', () => {
    expect(resolveCorsOrigin({ NODE_ENV: 'production' })).toEqual([]);
  });
});

describe('resolveTrustProxy', () => {
  it('is undefined without TRUST_PROXY', () => {
    expect(resolveTrustProxy({})).toBeUndefined();
    expect(resolveTrustProxy({ TRUST_PROXY: '  ' })).toBeUndefined();
  });

  it('turns a number of proxies into a number', () => {
    expect(resolveTrustProxy({ TRUST_PROXY: '1' })).toBe(1);
  });

  it('turns true and false into booleans', () => {
    expect(resolveTrustProxy({ TRUST_PROXY: 'true' })).toBe(true);
    expect(resolveTrustProxy({ TRUST_PROXY: 'false' })).toBe(false);
  });

  it('passes other Express values through as a string', () => {
    expect(resolveTrustProxy({ TRUST_PROXY: 'loopback' })).toBe('loopback');
    expect(resolveTrustProxy({ TRUST_PROXY: '10.0.0.0/8' })).toBe('10.0.0.0/8');
  });
});
