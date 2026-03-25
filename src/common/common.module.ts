import { Global, Module } from '@nestjs/common';
import { AmiService } from './ami.service';

@Global()
@Module({
  providers: [AmiService],
  exports: [AmiService],
})
export class CommonModule {}
