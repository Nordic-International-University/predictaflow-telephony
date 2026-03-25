import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';

export class OriginateDto {
  @ApiProperty({ description: "Qo'ng'iroq qilinadigan raqam", example: '+998901234567' })
  @IsString()
  number: string;

  @ApiPropertyOptional({ description: 'Ichki raqam (extension) yoki trunk', example: '200' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'Caller ID', example: '555084400' })
  @IsOptional()
  @IsString()
  callerId?: string;

  @ApiPropertyOptional({ description: 'Kontekst', example: 'from-internal', default: 'from-internal' })
  @IsOptional()
  @IsString()
  context?: string;

  @ApiPropertyOptional({ description: 'Timeout (sekund)', example: 30, default: 30 })
  @IsOptional()
  @IsNumber()
  timeout?: number;
}

export class TransferDto {
  @ApiProperty({ description: 'Kanal ID', example: 'SIP/200-00000001' })
  @IsString()
  channelId: string;

  @ApiProperty({ description: 'Transfer qilinadigan raqam/extension', example: '201' })
  @IsString()
  target: string;

  @ApiPropertyOptional({ description: 'Kontekst', default: 'from-internal' })
  @IsOptional()
  @IsString()
  context?: string;
}

export class HangupDto {
  @ApiProperty({ description: 'Kanal ID', example: 'SIP/200-00000001' })
  @IsString()
  channelId: string;

  @ApiPropertyOptional({
    description: "Tugatish sababi",
    example: 'normal',
    enum: ['normal', 'busy', 'congestion', 'no_answer'],
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class DtmfDto {
  @ApiProperty({ description: 'Kanal ID' })
  @IsString()
  channelId: string;

  @ApiProperty({ description: 'DTMF belgilar', example: '1234#' })
  @IsString()
  digits: string;
}
