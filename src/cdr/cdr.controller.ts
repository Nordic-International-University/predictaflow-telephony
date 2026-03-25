import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AmiService } from '../common/ami.service';
import { AriService } from '../common/ari.service';

@ApiTags('CDR')
@Controller('cdr')
export class CdrController {
  constructor(
    private readonly ami: AmiService,
    private readonly ari: AriService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'CDR — Call Detail Records',
    description: `Barcha qo'ng'iroqlar tarixi. Har bir yozuvda:
- **src** — kim qo'ng'iroq qildi
- **dst** — kimga qo'ng'iroq qilindi
- **duration** — umumiy davomiylik (sekund)
- **billsec** — gaplashish vaqti (sekund)
- **disposition** — natija (ANSWERED, NO ANSWER, BUSY, FAILED)
- **calldate** — sana va vaqt
- **recordingfile** — ovoz yozuv fayli (agar bor bo'lsa)
- **uniqueid** — yagona identifikator
- **dcontext** — kontekst (from-internal, from-external)
- **channel** — kanal (SIP/200-xxx)
- **dstchannel** — manzil kanal

FreePBX MySQL/MariaDB asteriskcdrdb.cdr jadvalidan.`,
  })
  @ApiQuery({ name: 'limit', required: false, example: 50, description: 'Nechta yozuv' })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiQuery({ name: 'src', required: false, description: 'Kimdan (extension yoki raqam)' })
  @ApiQuery({ name: 'dst', required: false, description: 'Kimga' })
  @ApiQuery({ name: 'disposition', required: false, description: 'ANSWERED, NO ANSWER, BUSY, FAILED' })
  @ApiQuery({ name: 'from_date', required: false, example: '2026-03-01', description: 'Boshlanish sanasi' })
  @ApiQuery({ name: 'to_date', required: false, example: '2026-03-25', description: 'Tugash sanasi' })
  async getCdr(
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
    @Query('src') src?: string,
    @Query('dst') dst?: string,
    @Query('disposition') disposition?: string,
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
  ) {
    // AMI orqali CDR so'rash (FreePBX MySQL dan)
    // Haqiqiy implementatsiyada FreePBX MySQL ga to'g'ridan-to'g'ri ulanish kerak
    // Hozir AMI orqali oxirgi kanallarni ko'rsatamiz
    return {
      note: 'CDR uchun FreePBX MySQL (asteriskcdrdb) ga ulanish kerak. Hozir AMI orqali faol kanallar.',
      filters: { src, dst, disposition, fromDate, toDate, limit, offset },
      hint: 'FreePBX MySQL: SELECT * FROM asteriskcdrdb.cdr ORDER BY calldate DESC LIMIT 50',
    };
  }

  @Get('stats')
  @ApiOperation({
    summary: 'CDR statistika',
    description: `Qo'ng'iroqlar statistikasi:
- Bugun nechta qo'ng'iroq
- Umumiy gaplashish vaqti
- Disposition bo'yicha taqsimot
- Eng ko'p qo'ng'iroq qilgan extension`,
  })
  @ApiQuery({ name: 'date', required: false, example: '2026-03-25' })
  async getStats(@Query('date') date?: string) {
    return {
      date: date || 'bugun',
      note: 'FreePBX MySQL ga ulanish kerak',
      hint: `SELECT disposition, COUNT(*) as cnt, SUM(billsec) as total_sec
             FROM asteriskcdrdb.cdr WHERE DATE(calldate) = '${date || 'CURDATE()'}'
             GROUP BY disposition`,
    };
  }

  @Get('recordings')
  @ApiOperation({
    summary: 'Ovoz yozuvlari ro\'yxati',
    description: 'ARI orqali saqlangan barcha ovoz yozuvlari.',
  })
  async getRecordings() {
    try {
      const recordings = await this.ari.getRecordings();
      return { count: recordings.length, recordings };
    } catch (e) {
      return {
        count: 0,
        recordings: [],
        note: 'ARI ulanmagan yoki yozuvlar yo\'q',
        hint: 'Ovoz yozuvlar /var/spool/asterisk/monitor/ da saqlanadi',
      };
    }
  }

  @Get('recordings/:name')
  @ApiOperation({
    summary: 'Bitta ovoz yozuv tafsiloti',
    description: 'Yozuv nomi bo\'yicha tafsilot — format, davomiylik, sana.',
  })
  async getRecording(@Param('name') name: string) {
    return this.ari.getRecording(name);
  }
}
