import { Module } from '@nestjs/common';
import { CallController } from './call.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [CallController],
})
export class CallModule {}
