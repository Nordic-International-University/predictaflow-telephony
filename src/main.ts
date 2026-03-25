import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Static files — frontend
  app.useStaticAssets(join(__dirname, '..', 'src', 'public'));

  app.enableCors({ origin: '*' });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('PredictaFlow Telephony')
    .setDescription(`
## Asterisk / FreePBX Telephony API

Qo'ng'iroqlarni boshqarish, status kuzatuv, CDR, call recording.

### Modullar
- **Call** — Qo'ng'iroq boshlash, tugatish, transfer, hold
- **Status** — Raqam holati: band, o'chirilgan, tarmoqda yo'q, xato format
- **CDR** — Call Detail Records — barcha qo'ng'iroqlar tarixi
- **Webhook** — Call event larni tashqi tizimga yuborish (call start, answer, end, hangup)

### Ulanish
FreePBX AMI: \`${process.env.AMI_HOST}:${process.env.AMI_PORT}\`
Faqat local — 127.0.0.1 (backend shu serverda ishlaydi).
    `)
    .setVersion('1.0.0')
    .addTag('Call', 'Qo\'ng\'iroq boshqaruvi — originate, hangup, transfer, hold, mute')
    .addTag('Status', 'Raqam holati — reachable, busy, off, no-network, invalid')
    .addTag('CDR', 'Call Detail Records — tarixi, davomiylik, recording')
    .addTag('Webhook', 'Call eventlarni tashqi tizimlarga yuborish')
    .addTag('Channel', 'Asterisk kanallar — faol qo\'ng\'iroqlar, trunk holati')
    .addTag('Recording', 'Ovoz yozuvlari — ro\'yxat, yuklab olish, o\'chirish')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const host = process.env.HOST || '0.0.0.0';
  const port = parseInt(process.env.PORT || '3100', 10);
  await app.listen(port, host);

  console.log(`\n🚀 Telephony API: http://${host}:${port}`);
  console.log(`📖 Swagger:       http://${host}:${port}/docs`);
  console.log(`📞 AMI:           ${process.env.AMI_HOST}:${process.env.AMI_PORT}\n`);
}
bootstrap();
