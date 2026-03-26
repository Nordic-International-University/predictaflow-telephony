import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private apiKey: string;
  private allowedIps: string[];

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get('API_KEY', 'predictaflow-secret-2026');
    const ips = this.config.get('ALLOWED_IPS', '');
    this.allowedIps = ips ? ips.split(',').map((ip: string) => ip.trim()) : [];
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const path = request.path || '';

    // Static files va health check — himoyasiz
    if (path === '/' || path.startsWith('/index.html') || path === '/favicon.ico') {
      return true;
    }

    // IP tekshirish (agar ALLOWED_IPS sozlangan bo'lsa)
    if (this.allowedIps.length > 0) {
      const clientIp = request.ip || request.connection?.remoteAddress || '';
      const realIp = clientIp.replace('::ffff:', '');
      if (!this.allowedIps.includes(realIp) && !this.allowedIps.includes('*')) {
        throw new UnauthorizedException(`IP ${realIp} ruxsat berilmagan`);
      }
    }

    // API Key tekshirish
    const key = request.headers['x-api-key'] || request.query?.api_key;
    if (!key || key !== this.apiKey) {
      throw new UnauthorizedException('Noto\'g\'ri yoki yo\'q API Key');
    }

    return true;
  }
}
