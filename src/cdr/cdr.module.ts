import { Module } from '@nestjs/common';
import { CdrController } from './cdr.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [CdrController],
})
export class CdrModule {}
