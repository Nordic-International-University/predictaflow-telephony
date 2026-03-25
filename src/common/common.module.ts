import { Global, Module } from '@nestjs/common';
import { AmiService } from './ami.service';
import { AriService } from './ari.service';

@Global()
@Module({
  providers: [AmiService, AriService],
  exports: [AmiService, AriService],
})
export class CommonModule {}
