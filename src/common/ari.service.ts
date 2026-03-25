import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * Asterisk REST Interface (ARI) — HTTP API orqali Asterisk boshqaruv.
 *
 * ARI orqali:
 * - Kanallar boshqaruvi
 * - Bridgelar (konferens)
 * - Recording boshqaruvi
 * - Endpoint holati
 */
@Injectable()
export class AriService {
  private readonly logger = new Logger(AriService.name);
  private http: AxiosInstance;

  constructor(private config: ConfigService) {
    const baseURL = this.config.get('ARI_URL', 'http://192.168.33.116:8088');
    const user = this.config.get('ARI_USER', 'admin');
    const secret = this.config.get('ARI_SECRET', 'changeme');

    this.http = axios.create({
      baseURL: `${baseURL}/ari`,
      auth: { username: user, password: secret },
      timeout: 10000,
    });
  }

  /** ARI GET */
  async get(path: string, params?: any): Promise<any> {
    const { data } = await this.http.get(path, { params });
    return data;
  }

  /** ARI POST */
  async post(path: string, body?: any, params?: any): Promise<any> {
    const { data } = await this.http.post(path, body, { params });
    return data;
  }

  /** ARI DELETE */
  async delete(path: string, params?: any): Promise<any> {
    const { data } = await this.http.delete(path, { params });
    return data;
  }

  // ─── Channels ───

  /** Barcha faol kanallar */
  async getChannels(): Promise<any[]> {
    return this.get('/channels');
  }

  /** Bitta kanal tafsiloti */
  async getChannel(channelId: string): Promise<any> {
    return this.get(`/channels/${channelId}`);
  }

  /** Yangi qo'ng'iroq boshlash */
  async originate(params: {
    endpoint: string;
    extension?: string;
    context?: string;
    priority?: number;
    callerId?: string;
    timeout?: number;
    app?: string;
    appArgs?: string;
  }): Promise<any> {
    return this.post('/channels', null, {
      endpoint: params.endpoint,
      extension: params.extension,
      context: params.context || 'from-internal',
      priority: params.priority || 1,
      callerId: params.callerId,
      timeout: params.timeout || 30,
      app: params.app,
      appArgs: params.appArgs,
    });
  }

  /** Kanalni tugatish */
  async hangup(channelId: string, reason?: string): Promise<void> {
    await this.delete(`/channels/${channelId}`, { reason: reason || 'normal' });
  }

  /** Hold */
  async hold(channelId: string): Promise<void> {
    await this.post(`/channels/${channelId}/hold`);
  }

  /** Unhold */
  async unhold(channelId: string): Promise<void> {
    await this.delete(`/channels/${channelId}/hold`);
  }

  /** Mute */
  async mute(channelId: string, direction: 'both' | 'in' | 'out' = 'both'): Promise<void> {
    await this.post(`/channels/${channelId}/mute`, null, { direction });
  }

  /** Unmute */
  async unmute(channelId: string, direction: 'both' | 'in' | 'out' = 'both'): Promise<void> {
    await this.delete(`/channels/${channelId}/mute`, { direction });
  }

  /** DTMF yuborish */
  async sendDtmf(channelId: string, dtmf: string): Promise<void> {
    await this.post(`/channels/${channelId}/dtmf`, null, { dtmf });
  }

  // ─── Bridges (konferens) ───

  async getBridges(): Promise<any[]> {
    return this.get('/bridges');
  }

  async createBridge(type: string = 'mixing'): Promise<any> {
    return this.post('/bridges', null, { type });
  }

  async addChannelToBridge(bridgeId: string, channelId: string): Promise<void> {
    await this.post(`/bridges/${bridgeId}/addChannel`, null, { channel: channelId });
  }

  // ─── Recordings ───

  /** Barcha yozuvlar */
  async getRecordings(): Promise<any[]> {
    return this.get('/recordings/stored');
  }

  /** Bitta yozuv */
  async getRecording(name: string): Promise<any> {
    return this.get(`/recordings/stored/${name}`);
  }

  /** Yozuvni o'chirish */
  async deleteRecording(name: string): Promise<void> {
    await this.delete(`/recordings/stored/${name}`);
  }

  // ─── Endpoints ───

  /** Barcha endpointlar */
  async getEndpoints(): Promise<any[]> {
    return this.get('/endpoints');
  }

  /** Technology bo'yicha (SIP, PJSIP, IAX2) */
  async getEndpointsByTech(tech: string): Promise<any[]> {
    return this.get(`/endpoints/${tech}`);
  }

  /** Bitta endpoint tafsiloti */
  async getEndpoint(tech: string, resource: string): Promise<any> {
    return this.get(`/endpoints/${tech}/${resource}`);
  }

  // ─── Asterisk info ───

  async getAsteriskInfo(): Promise<any> {
    return this.get('/asterisk/info');
  }
}
