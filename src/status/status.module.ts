import { Module } from '@nestjs/common';
import { StatusController } from './status.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [StatusController],
})
export class StatusModule {}
