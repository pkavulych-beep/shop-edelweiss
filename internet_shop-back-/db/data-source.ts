import 'dotenv/config';
import { DataSource } from 'typeorm';
import { getDataSourceOptions } from '../src/database/data-source-options';

// Для CLI typeorm (npm run migration:*). Міграції працюють зі схемою, тож synchronize тут вимкнено завжди.
const AppDataSource = new DataSource({
  ...getDataSourceOptions(),
  synchronize: false,
  migrationsRun: false,
});

export default AppDataSource;
