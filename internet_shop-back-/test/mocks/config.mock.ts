export class ConfigService {
  get(key: string): string | undefined {
    return process.env[key];
  }
}

export class ConfigModule {
  static forRoot() {
    return {
      module: ConfigModule,
      providers: [ConfigService],
      exports: [ConfigService],
    };
  }
}