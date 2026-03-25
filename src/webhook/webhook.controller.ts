import { Controller, Post, Get, Body, Delete, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray } from 'class-validator';
import { AmiService } from '../common/ami.service';

/** Webhook eventlar */
export enum CallEvent {
  CALL_START = 'call.start',           // Qo'ng'iroq boshlandi (ringing)
  CALL_ANSWER = 'call.answer',         // Ko'tardi
  CALL_END = 'call.end',               // Tugadi
  CALL_HANGUP = 'call.hangup',         // Qo'yildi
  CALL_BRIDGE = 'call.bridge',         // Ikki kanal ulandi
  CALL_HOLD = 'call.hold',             // Kutishga qo'yildi
  CALL_UNHOLD = 'call.unhold',         // Kutishdan olindi
  CALL_TRANSFER = 'call.transfer',     // O'tkazildi
  CALL_DTMF = 'call.dtmf',            // DTMF tugma bosildi
  CALL_RECORDING_START = 'call.recording.start',
  CALL_RECORDING_STOP = 'call.recording.stop',
  PEER_STATUS = 'peer.status',         // Extension onlayn/offlayn
}

class RegisterWebhookDto {
  @ApiProperty({ description: 'Webhook URL', example: 'http://192.168.33.10:8000/api/v1/telephony/event' })
  @IsString()
  url: string;

  @ApiProperty({
    description: 'Qaysi eventlarga subscribe',
    example: ['call.start', 'call.answer', 'call.end', 'call.hangup'],
    enum: CallEvent,
    isArray: true,
  })
  @IsArray()
  events: string[];

  @ApiProperty({ description: 'Webhook nomi', example: 'predictaflow-main' })
  @IsOptional()
  @IsString()
  name?: string;
}

/** In-memory webhook storage */
interface WebhookRegistration {
  id: string;
  name: string;
  url: string;
  events: string[];
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

@ApiTags('Webhook')
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private webhooks: Map<string, WebhookRegistration> = new Map();
  private eventLog: any[] = [];

  constructor(private readonly ami: AmiService) {
    this.setupAmiListeners();
  }

  /** AMI eventlarni tinglash va webhooklarga forward qilish */
  private setupAmiListeners() {
    const eventMap: Record<string, CallEvent> = {
      'Newchannel': CallEvent.CALL_START,
      'DialBegin': CallEvent.CALL_START,
      'DialEnd': CallEvent.CALL_END,
      'Hangup': CallEvent.CALL_HANGUP,
      'Bridge': CallEvent.CALL_BRIDGE,
      'BridgeEnter': CallEvent.CALL_BRIDGE,
      'Hold': CallEvent.CALL_HOLD,
      'Unhold': CallEvent.CALL_UNHOLD,
      'AttendedTransfer': CallEvent.CALL_TRANSFER,
      'BlindTransfer': CallEvent.CALL_TRANSFER,
      'DTMFBegin': CallEvent.CALL_DTMF,
      'PeerStatus': CallEvent.PEER_STATUS,
      'MusicOnHoldStart': CallEvent.CALL_HOLD,
      'MusicOnHoldStop': CallEvent.CALL_UNHOLD,
      'MonitorStart': CallEvent.CALL_RECORDING_START,
      'MonitorStop': CallEvent.CALL_RECORDING_STOP,
    };

    // Har bir AMI event ni kuzatish
    this.ami.on('*', (data: any) => {
      const event = data?.Event;
      if (!event) return;

      const callEvent = eventMap[event];
      if (!callEvent) return;

      const payload = {
        event: callEvent,
        asterisk_event: event,
        timestamp: new Date().toISOString(),
        data: {
          channel: data.Channel,
          callerIdNum: data.CallerIDNum,
          callerIdName: data.CallerIDName,
          connectedLineNum: data.ConnectedLineNum,
          exten: data.Exten,
          context: data.Context,
          uniqueId: data.Uniqueid,
          linkedId: data.Linkedid,
          cause: data.Cause,
          causeTxt: data['Cause-txt'],
          duration: data.Duration,
          peer: data.Peer,
          peerStatus: data.PeerStatus,
        },
      };

      // Event log ga saqlash
      this.eventLog.push(payload);
      if (this.eventLog.length > 1000) this.eventLog.shift();

      // Webhooklarga yuborish
      this.broadcastToWebhooks(callEvent, payload);
    });
  }

  /** Payload ni subscribe bo'lgan webhooklarga yuborish */
  private async broadcastToWebhooks(event: CallEvent, payload: any) {
    const axios = require('axios');

    for (const [id, wh] of this.webhooks) {
      if (!wh.events.includes(event) && !wh.events.includes('*')) continue;

      try {
        await axios.post(wh.url, payload, { timeout: 5000 });
        wh.lastTriggered = new Date();
        wh.triggerCount++;
      } catch (e: any) {
        this.logger.warn(`Webhook ${wh.name} (${wh.url}) ga yuborib bo'lmadi: ${e?.message || e}`);
      }
    }
  }

  @Post('register')
  @ApiOperation({
    summary: 'Webhook ro\'yxatdan o\'tkazish',
    description: `Asterisk call eventlarini tashqi URL ga yuborish uchun webhook ro'yxatdan o'tkazish.

**Mavjud eventlar:**
- \`call.start\` — Qo'ng'iroq boshlandi (ringing)
- \`call.answer\` — Ko'tardi
- \`call.end\` — Tugadi (natija bilan)
- \`call.hangup\` — Qo'yildi (sabab bilan)
- \`call.bridge\` — Ikki tomon ulandi
- \`call.hold\` — Kutishga qo'yildi
- \`call.unhold\` — Kutishdan olindi
- \`call.transfer\` — Boshqa raqamga o'tkazildi
- \`call.dtmf\` — DTMF tugma bosildi
- \`call.recording.start\` — Yozuv boshlandi
- \`call.recording.stop\` — Yozuv tugadi
- \`peer.status\` — Extension onlayn/offlayn
- \`*\` — Barcha eventlar`,
  })
  register(@Body() dto: RegisterWebhookDto) {
    const id = `wh_${Date.now()}`;
    const wh: WebhookRegistration = {
      id,
      name: dto.name || id,
      url: dto.url,
      events: dto.events,
      createdAt: new Date(),
      triggerCount: 0,
    };
    this.webhooks.set(id, wh);
    this.logger.log(`Webhook ro'yxatdan o'tdi: ${wh.name} → ${wh.url} [${wh.events.join(', ')}]`);
    return { status: 'ok', webhook: wh };
  }

  @Get()
  @ApiOperation({ summary: 'Barcha ro\'yxatdan o\'tgan webhooklar' })
  list() {
    return {
      count: this.webhooks.size,
      webhooks: Array.from(this.webhooks.values()),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Webhookni o\'chirish' })
  remove(@Param('id') id: string) {
    const deleted = this.webhooks.delete(id);
    return { status: deleted ? 'ok' : 'not_found', id };
  }

  @Get('events')
  @ApiOperation({
    summary: 'Oxirgi eventlar (log)',
    description: 'Oxirgi 100 ta Asterisk call event — real vaqtda kuzatuv uchun.',
  })
  getEvents() {
    return {
      count: this.eventLog.length,
      events: this.eventLog.slice(-100).reverse(),
    };
  }

  @Get('event-types')
  @ApiOperation({ summary: 'Mavjud event turlari' })
  getEventTypes() {
    return {
      events: Object.entries(CallEvent).map(([key, value]) => ({
        code: value,
        name: key,
      })),
    };
  }
}
