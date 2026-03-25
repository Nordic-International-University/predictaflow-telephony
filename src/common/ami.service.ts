import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';
import { EventEmitter } from 'events';

/**
 * Asterisk Manager Interface (AMI) — FreePBX bilan to'g'ridan-to'g'ri TCP ulanish.
 *
 * AMI orqali:
 * - Qo'ng'iroq boshlash (Originate)
 * - Kanal holati (Status)
 * - Call event kuzatuv (Newchannel, Hangup, Bridge, etc.)
 * - Peer holati (SIPpeerstatus)
 */
@Injectable()
export class AmiService extends EventEmitter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AmiService.name);
  private socket: net.Socket;
  private connected = false;
  private buffer = '';
  private actionId = 0;
  private pendingActions = new Map<string, { resolve: Function; reject: Function }>();

  private host: string;
  private port: number;
  private user: string;
  private secret: string;

  constructor(private config: ConfigService) {
    super();
    this.host = this.config.get('AMI_HOST', '192.168.33.116');
    this.port = parseInt(this.config.get('AMI_PORT', '5038'), 10);
    this.user = this.config.get('AMI_USER', 'admin');
    this.secret = this.config.get('AMI_SECRET', 'changeme');
  }

  async onModuleInit() {
    // Non-blocking — server AMI siz ham ishga tushadi
    this.connect().catch(() => this.logger.warn('AMI ga ulanib bo\'lmadi — server davom etadi'));
  }

  onModuleDestroy() {
    this.disconnect();
  }

  /** AMI ga ulanish */
  async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.socket = new net.Socket();
        this.socket.setEncoding('utf-8');
        this.socket.setTimeout(5000);

        this.socket.on('data', (data: string) => this.handleData(data));

        this.socket.on('error', (err: any) => {
          this.logger.warn(`AMI ulanish xatosi: ${err?.message || err}`);
          this.connected = false;
          resolve(false);
        });

        this.socket.on('close', () => {
          this.connected = false;
          this.logger.warn('AMI ulanish yopildi');
          // Qayta ulanish 5 sekunddan keyin
          setTimeout(() => this.connect(), 5000);
        });

        this.socket.connect(this.port, this.host, async () => {
          this.logger.log(`AMI ulandi: ${this.host}:${this.port}`);
          // Login
          const loginResult = await this.sendAction({
            Action: 'Login',
            Username: this.user,
            Secret: this.secret,
          });
          if (loginResult?.Response === 'Success') {
            this.connected = true;
            this.logger.log('AMI login muvaffaqiyatli');
            resolve(true);
          } else {
            this.logger.error('AMI login xatosi');
            resolve(false);
          }
        });
      } catch (e: any) {
        this.logger.warn(`AMI ulanib bo'lmadi: ${e?.message || e}`);
        resolve(false);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      try {
        this.sendAction({ Action: 'Logoff' }).catch(() => {});
        this.socket.destroy();
      } catch {}
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  /** AMI ga action yuborish */
  async sendAction(action: Record<string, string>): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        return reject(new Error('AMI ulanmagan'));
      }

      const id = String(++this.actionId);
      action['ActionID'] = id;

      const lines = Object.entries(action)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\r\n');

      this.pendingActions.set(id, { resolve, reject });
      this.socket.write(lines + '\r\n\r\n');

      // Timeout
      setTimeout(() => {
        if (this.pendingActions.has(id)) {
          this.pendingActions.delete(id);
          reject(new Error('AMI javob vaqti tugadi'));
        }
      }, 10000);
    });
  }

  private handleData(data: string) {
    this.buffer += data;
    const messages = this.buffer.split('\r\n\r\n');
    this.buffer = messages.pop() || '';

    for (const msg of messages) {
      if (!msg.trim()) continue;

      const parsed: Record<string, string> = {};
      for (const line of msg.split('\r\n')) {
        const idx = line.indexOf(':');
        if (idx > 0) {
          parsed[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
        }
      }

      // Pending action javobimi?
      const actionId = parsed['ActionID'];
      if (actionId && this.pendingActions.has(actionId)) {
        const { resolve } = this.pendingActions.get(actionId);
        this.pendingActions.delete(actionId);
        resolve(parsed);
      }

      // Event emit
      if (parsed['Event']) {
        this.emit(parsed['Event'], parsed);
        this.emit('*', parsed); // Barcha eventlar
      }
    }
  }
}
