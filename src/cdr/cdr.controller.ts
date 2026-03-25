import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AmiService } from '../common/ami.service';

@ApiTags('CDR')
@Controller('cdr')
export class CdrController {
  constructor(private readonly ami: AmiService) {}

  @Get()
  @ApiOperation({
    summary: 'CDR — Call Detail Records',
    description: `Barcha qo'ng'iroqlar tarixi:
- **src** — kim qo'ng'iroq qildi
- **dst** — kimga
- **duration** — umumiy davomiylik (sekund)
- **billsec** — gaplashish vaqti (sekund)
- **disposition** — natija (ANSWERED, NO ANSWER, BUSY, FAILED)
- **calldate** — sana va vaqt
- **recordingfile** — ovoz yozuv fayli

FreePBX MySQL asteriskcdrdb.cdr jadvalidan.`,
  })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'src', required: false, description: 'Kimdan' })
  @ApiQuery({ name: 'dst', required: false, description: 'Kimga' })
  @ApiQuery({ name: 'disposition', required: false, description: 'ANSWERED, NO ANSWER, BUSY, FAILED' })
  async getCdr(
    @Query('limit') limit = '50',
    @Query('src') src?: string,
    @Query('dst') dst?: string,
    @Query('disposition') disposition?: string,
  ) {
    return {
      note: 'CDR uchun FreePBX MySQL (asteriskcdrdb) ga ulanish kerak',
      filters: { src, dst, disposition, limit },
      hint: 'SELECT * FROM asteriskcdrdb.cdr ORDER BY calldate DESC LIMIT 50',
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'CDR statistika' })
  async getStats() {
    return { note: 'FreePBX MySQL ga ulanish kerak' };
  }

  @Get('recordings')
  @ApiOperation({
    summary: 'Ovoz yozuvlari',
    description: 'Ovoz yozuvlar /var/spool/asterisk/monitor/ da saqlanadi.',
  })
  async getRecordings() {
    return { path: '/var/spool/asterisk/monitor/', note: 'Fayl tizimidan oqiladi' };
  }
}
