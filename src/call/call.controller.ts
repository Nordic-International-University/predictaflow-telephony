import { Controller, Post, Get, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AmiService } from '../common/ami.service';
import { AriService } from '../common/ari.service';
import { OriginateDto, TransferDto, HangupDto, DtmfDto } from './call.dto';

@ApiTags('Call')
@Controller('call')
export class CallController {
  constructor(
    private readonly ami: AmiService,
    private readonly ari: AriService,
  ) {}

  @Post('originate')
  @ApiOperation({
    summary: "Qo'ng'iroq boshlash",
    description: `Yangi qo'ng'iroqni Asterisk orqali boshlash.
    FreePBX trunk orqali tashqi raqamga yoki ichki extension ga qo'ng'iroq qiladi.`,
  })
  async originate(@Body() dto: OriginateDto) {
    const result = await this.ami.sendAction({
      Action: 'Originate',
      Channel: dto.from ? `SIP/${dto.from}` : `SIP/trunk/${dto.number}`,
      Exten: dto.number,
      Context: dto.context || 'from-internal',
      Priority: '1',
      CallerID: dto.callerId || dto.number,
      Timeout: String((dto.timeout || 30) * 1000),
      Async: 'true',
    });
    return { status: result?.Response === 'Success' ? 'ok' : 'error', result };
  }

  @Post('hangup')
  @ApiOperation({
    summary: "Qo'ng'iroqni tugatish",
    description: "Faol qo'ng'iroqni kanal ID orqali tugatish.",
  })
  async hangup(@Body() dto: HangupDto) {
    try {
      await this.ari.hangup(dto.channelId, dto.reason);
      return { status: 'ok', channelId: dto.channelId };
    } catch (e) {
      // AMI orqali harakat
      const result = await this.ami.sendAction({
        Action: 'Hangup',
        Channel: dto.channelId,
        Cause: dto.reason === 'busy' ? '17' : '16',
      });
      return { status: result?.Response === 'Success' ? 'ok' : 'error', result };
    }
  }

  @Post('transfer')
  @ApiOperation({
    summary: "Qo'ng'iroqni boshqa raqamga o'tkazish",
    description: "Faol qo'ng'iroqni boshqa extension yoki tashqi raqamga redirect qilish.",
  })
  async transfer(@Body() dto: TransferDto) {
    const result = await this.ami.sendAction({
      Action: 'Redirect',
      Channel: dto.channelId,
      Exten: dto.target,
      Context: dto.context || 'from-internal',
      Priority: '1',
    });
    return { status: result?.Response === 'Success' ? 'ok' : 'error', result };
  }

  @Post('hold')
  @ApiOperation({ summary: "Hold — qo'ng'iroqni kutishga qo'yish" })
  async hold(@Body('channelId') channelId: string) {
    await this.ari.hold(channelId);
    return { status: 'ok', channelId, action: 'hold' };
  }

  @Post('unhold')
  @ApiOperation({ summary: "Unhold — kutishdan olish" })
  async unhold(@Body('channelId') channelId: string) {
    await this.ari.unhold(channelId);
    return { status: 'ok', channelId, action: 'unhold' };
  }

  @Post('mute')
  @ApiOperation({ summary: "Mute — mikrofon o'chirish" })
  async mute(@Body('channelId') channelId: string) {
    await this.ari.mute(channelId, 'in');
    return { status: 'ok', channelId, action: 'mute' };
  }

  @Post('unmute')
  @ApiOperation({ summary: "Unmute — mikrofon yoqish" })
  async unmute(@Body('channelId') channelId: string) {
    await this.ari.unmute(channelId, 'in');
    return { status: 'ok', channelId, action: 'unmute' };
  }

  @Post('dtmf')
  @ApiOperation({ summary: 'DTMF yuborish', description: "Faol kanalga DTMF tonlar yuborish (masalan IVR uchun)." })
  async dtmf(@Body() dto: DtmfDto) {
    await this.ari.sendDtmf(dto.channelId, dto.digits);
    return { status: 'ok', channelId: dto.channelId, digits: dto.digits };
  }

  @Get('active')
  @ApiOperation({
    summary: "Faol qo'ng'iroqlar",
    description: "Hozirgi barcha faol kanallar (qo'ng'iroqlar) ro'yxati.",
  })
  async getActive() {
    try {
      const channels = await this.ari.getChannels();
      return { count: channels.length, channels };
    } catch {
      // AMI fallback
      const result = await this.ami.sendAction({ Action: 'CoreShowChannels' });
      return { source: 'ami', result };
    }
  }

  @Get('active/:channelId')
  @ApiOperation({ summary: 'Kanal tafsiloti' })
  async getChannel(@Param('channelId') channelId: string) {
    return this.ari.getChannel(channelId);
  }

  @Get('bridges')
  @ApiOperation({ summary: "Bridgelar (konferens qo'ng'iroqlar)" })
  async getBridges() {
    const bridges = await this.ari.getBridges();
    return { count: bridges.length, bridges };
  }

  @Get('endpoints')
  @ApiOperation({
    summary: 'SIP endpointlar (telefonlar)',
    description: "Barcha ro'yxatga olingan SIP/PJSIP endpointlar va ularning holati.",
  })
  @ApiQuery({ name: 'tech', required: false, description: 'SIP, PJSIP, IAX2', example: 'PJSIP' })
  async getEndpoints(@Query('tech') tech?: string) {
    if (tech) {
      return this.ari.getEndpointsByTech(tech);
    }
    return this.ari.getEndpoints();
  }

  @Get('info')
  @ApiOperation({ summary: 'Asterisk server ma\'lumoti', description: 'Versiya, uptime, modullar.' })
  async getInfo() {
    try {
      const info = await this.ari.getAsteriskInfo();
      return info;
    } catch {
      return {
        ami_connected: this.ami.isConnected(),
        ami_host: `${process.env.AMI_HOST}:${process.env.AMI_PORT}`,
      };
    }
  }
}
