import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AmiService } from '../common/ami.service';
import { OriginateDto, TransferDto, HangupDto, DtmfDto } from './call.dto';

@ApiTags('Call')
@Controller('call')
export class CallController {
  constructor(private readonly ami: AmiService) {}

  @Post('originate')
  @ApiOperation({
    summary: "Qo'ng'iroq boshlash",
    description: "Yangi qo'ng'iroqni Asterisk AMI orqali boshlash.",
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
  @ApiOperation({ summary: "Qo'ng'iroqni tugatish" })
  async hangup(@Body() dto: HangupDto) {
    const result = await this.ami.sendAction({
      Action: 'Hangup',
      Channel: dto.channelId,
      Cause: dto.reason === 'busy' ? '17' : '16',
    });
    return { status: result?.Response === 'Success' ? 'ok' : 'error', result };
  }

  @Post('transfer')
  @ApiOperation({ summary: "Qo'ng'iroqni o'tkazish" })
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
  @ApiOperation({ summary: "Hold — kutishga qo'yish" })
  async hold(@Body('channelId') channelId: string) {
    const result = await this.ami.sendAction({ Action: 'Park', Channel: channelId, Timeout: '300' });
    return { status: 'ok', channelId, action: 'hold', result };
  }

  @Post('mute')
  @ApiOperation({ summary: "Mute — mikrofon o'chirish" })
  async mute(@Body('channelId') channelId: string) {
    const result = await this.ami.sendAction({ Action: 'MuteAudio', Channel: channelId, Direction: 'in', State: 'on' });
    return { status: 'ok', channelId, action: 'mute', result };
  }

  @Post('unmute')
  @ApiOperation({ summary: "Unmute — mikrofon yoqish" })
  async unmute(@Body('channelId') channelId: string) {
    const result = await this.ami.sendAction({ Action: 'MuteAudio', Channel: channelId, Direction: 'in', State: 'off' });
    return { status: 'ok', channelId, action: 'unmute', result };
  }

  @Post('dtmf')
  @ApiOperation({ summary: 'DTMF yuborish' })
  async dtmf(@Body() dto: DtmfDto) {
    const result = await this.ami.sendAction({ Action: 'PlayDTMF', Channel: dto.channelId, Digit: dto.digits });
    return { status: 'ok', channelId: dto.channelId, digits: dto.digits, result };
  }

  @Get('active')
  @ApiOperation({ summary: "Faol qo'ng'iroqlar" })
  async getActive() {
    return this.ami.sendAction({ Action: 'CoreShowChannels' });
  }

  @Get('endpoints')
  @ApiOperation({ summary: 'SIP endpointlar' })
  async getEndpoints() {
    return this.ami.sendAction({ Action: 'SIPpeers' });
  }

  @Get('info')
  @ApiOperation({ summary: 'Asterisk server info' })
  async getInfo() {
    const [version, uptime] = await Promise.all([
      this.ami.sendAction({ Action: 'CoreSettings' }).catch(() => null),
      this.ami.sendAction({ Action: 'CoreStatus' }).catch(() => null),
    ]);
    return {
      ami_connected: this.ami.isConnected(),
      version: version?.AsteriskVersion || null,
      uptime: uptime?.CoreUptime || null,
      channels: uptime?.CoreCurrentCalls || null,
    };
  }
}
