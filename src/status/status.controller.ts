import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AmiService } from '../common/ami.service';

/** Raqam holatlari */
export enum CallDisposition {
  ANSWERED = 'ANSWERED',           // Ko'tardi
  NO_ANSWER = 'NO_ANSWER',        // Ko'tarmadi
  BUSY = 'BUSY',                   // Band
  FAILED = 'FAILED',               // Muvaffaqiyatsiz
  NOT_REACHABLE = 'NOT_REACHABLE', // O'chirilgan / tarmoqda yo'q
  INVALID_NUMBER = 'INVALID_NUMBER', // Xato formatli raqam
  CONGESTION = 'CONGESTION',       // Tarmoq band
  CANCELLED = 'CANCELLED',         // Bekor qilindi
}

/** SIP response code → status mapping */
const SIP_CODE_MAP: Record<string, CallDisposition> = {
  '200': CallDisposition.ANSWERED,
  '486': CallDisposition.BUSY,
  '480': CallDisposition.NOT_REACHABLE,   // Temporarily Unavailable
  '487': CallDisposition.CANCELLED,
  '404': CallDisposition.INVALID_NUMBER,
  '403': CallDisposition.FAILED,
  '408': CallDisposition.NO_ANSWER,        // Request Timeout
  '484': CallDisposition.INVALID_NUMBER,   // Address Incomplete
  '488': CallDisposition.FAILED,
  '500': CallDisposition.FAILED,
  '502': CallDisposition.NOT_REACHABLE,
  '503': CallDisposition.CONGESTION,       // Service Unavailable
  '603': CallDisposition.NO_ANSWER,        // Decline
};

/** Asterisk DIALSTATUS → status mapping */
const DIALSTATUS_MAP: Record<string, CallDisposition> = {
  'ANSWER': CallDisposition.ANSWERED,
  'BUSY': CallDisposition.BUSY,
  'NOANSWER': CallDisposition.NO_ANSWER,
  'CANCEL': CallDisposition.CANCELLED,
  'CONGESTION': CallDisposition.CONGESTION,
  'CHANUNAVAIL': CallDisposition.NOT_REACHABLE,
  'DONTCALL': CallDisposition.FAILED,
  'TORTURE': CallDisposition.FAILED,
  'INVALIDARGS': CallDisposition.INVALID_NUMBER,
};

class CheckNumberDto {
  @ApiProperty({ description: 'Telefon raqam', example: '+998901234567' })
  @IsString()
  number: string;
}

@ApiTags('Status')
@Controller('status')
export class StatusController {
  constructor(private readonly ami: AmiService) {}

  @Get('dispositions')
  @ApiOperation({
    summary: 'Barcha call holatlar (dispositions)',
    description: `Qo'ng'iroq natijasi statuslari:
- **ANSWERED** — Ko'tardi, gaplashdi
- **NO_ANSWER** — Ko'tarmadi (jiringlab turdi)
- **BUSY** — Band
- **NOT_REACHABLE** — O'chirilgan yoki tarmoqda mavjud emas
- **INVALID_NUMBER** — Xato formatli raqam
- **CONGESTION** — Tarmoq band, qayta urinish kerak
- **CANCELLED** — Qo'ng'iroq bekor qilindi
- **FAILED** — Texnik xato`,
  })
  getDispositions() {
    return {
      dispositions: Object.entries(CallDisposition).map(([key, value]) => ({
        code: value,
        label_uz: {
          ANSWERED: "Ko'tardi",
          NO_ANSWER: "Ko'tarmadi",
          BUSY: 'Band',
          FAILED: 'Xato',
          NOT_REACHABLE: "O'chirilgan / Tarmoqda yo'q",
          INVALID_NUMBER: 'Xato formatli raqam',
          CONGESTION: 'Tarmoq band',
          CANCELLED: 'Bekor qilindi',
        }[value],
      })),
      sip_codes: SIP_CODE_MAP,
      dialstatus_map: DIALSTATUS_MAP,
    };
  }

  @Get('peer/:extension')
  @ApiOperation({
    summary: 'SIP peer holati',
    description: `Ichki extension (SIP peer) ning hozirgi holati:
- **Reachable** — onlayn, ishlayapti
- **Unreachable** — offlayn
- **Lagged** — sekin javob
- **Unknown** — noma'lum`,
  })
  async getPeerStatus(@Param('extension') extension: string) {
    const result = await this.ami.sendAction({
      Action: 'SIPpeerstatus',
      Peer: extension,
    });
    return result;
  }

  @Get('peers')
  @ApiOperation({
    summary: 'Barcha SIP peerlar holati',
    description: 'Barcha SIP/PJSIP telefonlarning onlayn/offlayn holati.',
  })
  async getAllPeers() {
    const result = await this.ami.sendAction({ Action: 'SIPpeers' });
    return result;
    }
  }

  @Get('trunks')
  @ApiOperation({
    summary: 'Trunk holatlari',
    description: 'Tashqi telefon liniyalari (trunk) — ishlayaptimi yoki yo\'q.',
  })
  async getTrunks() {
    const result = await this.ami.sendAction({ Action: 'SIPshowregistry' });
    return result;
  }

  @Post('check-number')
  @ApiOperation({
    summary: 'Raqam formatini tekshirish',
    description: `Telefon raqam formatini tekshirish:
- +998XXXXXXXXX (12 raqam) — to'g'ri
- 998XXXXXXXXX — to'g'ri (+ qo'shiladi)
- 0XXXXXXXXX — to'g'ri (998 qo'shiladi)
- Qisqa/uzun — xato`,
  })
  checkNumber(@Body() dto: CheckNumberDto) {
    const num = dto.number.replace(/[\s\-\(\)]/g, '');
    let normalized = num;
    let valid = false;
    let error: string | null = null;

    // +998XXXXXXXXX
    if (/^\+998\d{9}$/.test(num)) {
      normalized = num;
      valid = true;
    }
    // 998XXXXXXXXX
    else if (/^998\d{9}$/.test(num)) {
      normalized = `+${num}`;
      valid = true;
    }
    // 0XXXXXXXXX (local)
    else if (/^0\d{9}$/.test(num)) {
      normalized = `+998${num.substring(1)}`;
      valid = true;
    }
    // XXXXXXXXX (9 raqam)
    else if (/^\d{9}$/.test(num)) {
      normalized = `+998${num}`;
      valid = true;
    }
    // Ichki extension (3-4 raqam)
    else if (/^\d{3,4}$/.test(num)) {
      normalized = num;
      valid = true;
      error = null;
    }
    else {
      error = 'Xato formatli raqam';
    }

    // Operator aniqlash
    let operator = null;
    const prefix = normalized.replace('+998', '').substring(0, 2);
    const operatorMap: Record<string, string> = {
      '90': 'Beeline', '91': 'Beeline',
      '93': 'Ucell', '94': 'Ucell',
      '95': 'Ucell', '97': 'UMS',
      '98': 'UMS', '99': 'UMS',
      '33': 'Humans', '50': 'Humans',
      '55': 'Humans', '77': 'Mobi',
      '88': 'UzMobile', '71': 'Shahar',
    };
    if (valid && normalized.startsWith('+998')) {
      operator = operatorMap[prefix] || 'Noma\'lum';
    }

    return {
      original: dto.number,
      normalized,
      valid,
      error,
      operator,
      type: normalized.length <= 4 ? 'internal' : 'external',
    };
  }

  @Get('ami-status')
  @ApiOperation({ summary: 'AMI ulanish holati' })
  getAmiStatus() {
    return {
      connected: this.ami.isConnected(),
      host: `${process.env.AMI_HOST}:${process.env.AMI_PORT}`,
    };
  }

  @Post('resolve-disposition')
  @ApiOperation({
    summary: 'SIP code → Call disposition',
    description: 'SIP javob kodi yoki Asterisk DIALSTATUS ni inson tushunadigan holatga aylantirish.',
  })
  resolveDisposition(
    @Body('sipCode') sipCode?: string,
    @Body('dialstatus') dialstatus?: string,
  ) {
    let disposition: CallDisposition = CallDisposition.FAILED;
    let source = '';

    if (sipCode && SIP_CODE_MAP[sipCode]) {
      disposition = SIP_CODE_MAP[sipCode];
      source = 'sip_code';
    } else if (dialstatus && DIALSTATUS_MAP[dialstatus.toUpperCase()]) {
      disposition = DIALSTATUS_MAP[dialstatus.toUpperCase()];
      source = 'dialstatus';
    }

    const labels: Record<string, string> = {
      ANSWERED: "Ko'tardi",
      NO_ANSWER: "Ko'tarmadi",
      BUSY: 'Band',
      FAILED: 'Xato',
      NOT_REACHABLE: "O'chirilgan / Tarmoqda yo'q",
      INVALID_NUMBER: 'Xato formatli raqam',
      CONGESTION: 'Tarmoq band',
      CANCELLED: 'Bekor qilindi',
    };

    return {
      disposition,
      label: labels[disposition] || disposition,
      source,
      input: { sipCode, dialstatus },
    };
  }
}
