import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import postgres, { Sql } from 'postgres';

export const DATABASE = 'DATABASE';

/**
 * Direct Postgres access to Supabase with postgres.js.
 *
 * Parameterized tagged-template queries only — the library escapes every
 * interpolated value, so there is no SQL-injection surface. PostGIS queries
 * that need dynamic SQL fragments (radius, limits) interpolate via the
 * `sql` helper's explicit lists, never raw string concatenation.
 */
@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Sql => {
        const url = config.get<string>('supabaseDbUrl');
        if (!url) {
          throw new Error(
            'SUPABASE_DB_URL is not set. Copy .env.example to .env and fill it in.',
          );
        }
        return postgres(url, {
          max: 10,
          idle_timeout: 30,
          connect_timeout: 10,
          // on_prepare / prepared statements off: Supavisor transaction mode
          // doesn't support named prepared statements.
          prepare: false,
        });
      },
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
