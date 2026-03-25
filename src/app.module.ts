import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CallModule } from './call/call.module';
import { StatusModule } from './status/status.module';
import { CdrModule } from './cdr/cdr.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    CallModule,
    StatusModule,
    CdrModule,
    WebhookModule,
  ],
})
export class AppModule {}
