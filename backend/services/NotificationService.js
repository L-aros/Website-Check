const nodemailer = require('nodemailer');
const axios = require('axios');
const aliyunSms = require('./AliyunSmsService');
const volcengineSms = require('./VolcengineSmsService');
const { NotificationLog } = require('../models');

class NotificationService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(to, subject, text) {
    if (!to) return { ok: false, provider: 'smtp', errorMessage: 'no_recipient' };
    try {
      const info = await this.transporter.sendMail({
        from: `"Website Monitor" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html: `<p>${text.replace(/\n/g, '<br>')}</p>`,
      });
      return { ok: true, provider: 'smtp', requestId: info && info.messageId };
    } catch (error) {
      return { ok: false, provider: 'smtp', errorMessage: error && error.message ? error.message : String(error) };
    }
  }

  async sendFeishu(webhookUrl, text) {
    if (!webhookUrl) return { ok: false, provider: 'feishu', errorMessage: 'no_recipient' };
    try {
      await axios.post(webhookUrl, {
        msg_type: 'text',
        content: {
          text: text,
        },
      });
      return { ok: true, provider: 'feishu' };
    } catch (error) {
      return { ok: false, provider: 'feishu', errorMessage: error && error.message ? error.message : String(error) };
    }
  }

  async sendSMS(phone, params) {
    if (!phone) return { ok: false, provider: null, errorMessage: 'no_recipient' };

    const primary = process.env.SMS_PRIMARY_PROVIDER || 'aliyun';
    const fallback = process.env.SMS_FALLBACK_PROVIDER || 'volcengine';

    const providers = [primary, fallback].filter(Boolean);
    const tried = [];

    for (const provider of providers) {
      tried.push(provider);
      if (provider === 'aliyun') {
        const result = await aliyunSms.send(phone, params);
        if (result && result.ok) return { ...result, tried };
        if (!result || result.ok === false) continue;
      } else if (provider === 'volcengine') {
        const result = await volcengineSms.send(phone, params);
        if (result && result.ok) return { ...result, tried };
        if (!result || result.ok === false) continue;
      } else {
        continue;
      }
    }

    return { ok: false, provider: tried[tried.length - 1] || null, tried, errorMessage: 'all_providers_failed' };
  }

  maskPhone(phone) {
    if (!phone) return '';
    const p = String(phone).trim();
    if (p.length <= 7) return p;
    return `${p.slice(0, 3)}****${p.slice(-4)}`;
  }

  maskWebhook(url) {
    if (!url) return '';
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.host}${u.pathname.slice(0, 12)}...`;
    } catch {
      return 'configured';
    }
  }

  async writeLog(entry) {
    try {
      await NotificationLog.create(entry);
    } catch (e) {
      return;
    }
  }

  async notify(monitor, changeType, contentSnippet, meta = {}) {
    const subject = `[Monitor Alert] ${monitor.name || monitor.url} Changed`;
    const message = `
      Monitor: ${monitor.name}
      URL: ${monitor.url}
      Change Type: ${changeType}
      Time: ${new Date().toLocaleString()}
      
      Content Snippet:
      ${contentSnippet.substring(0, 200)}...
    `;

    if (monitor.notifyEmail && monitor.emailList) {
      const result = await this.sendEmail(monitor.emailList, subject, message);
      await this.writeLog({
        monitorId: monitor.id,
        changeHistoryId: meta.historyId || null,
        channel: 'email',
        provider: result.provider,
        recipient: String(monitor.emailList || '').slice(0, 200),
        status: result.ok ? 'success' : 'failed',
        requestId: result.requestId || null,
        errorMessage: result.ok ? null : (result.errorMessage || null),
        payloadPreview: subject.slice(0, 200),
        sentAt: new Date(),
      });
    }

    if (monitor.notifyFeishu && monitor.feishuWebhook) {
      const result = await this.sendFeishu(monitor.feishuWebhook, message);
      await this.writeLog({
        monitorId: monitor.id,
        changeHistoryId: meta.historyId || null,
        channel: 'feishu',
        provider: result.provider,
        recipient: this.maskWebhook(monitor.feishuWebhook),
        status: result.ok ? 'success' : 'failed',
        requestId: result.requestId || null,
        errorMessage: result.ok ? null : (result.errorMessage || null),
        payloadPreview: String(monitor.name || monitor.url || '').slice(0, 200),
        sentAt: new Date(),
      });
    }

    if (monitor.notifySms) {
      const webBase = (process.env.PUBLIC_WEB_URL || '').trim().replace(/\/+$/, '');
      const link = webBase ? `${webBase}/history/${monitor.id}${meta.historyId ? `?h=${meta.historyId}` : ''}` : '';

      const phoneListRaw = (monitor.smsPhoneList || '').trim();
      const phoneList = phoneListRaw
        ? phoneListRaw.split(',').map((p) => p.trim()).filter(Boolean)
        : (process.env.ADMIN_PHONE ? [process.env.ADMIN_PHONE] : []);

      for (const phone of [...new Set(phoneList)]) {
        const params = {
          name: String(monitor.name || 'Website Monitor').substring(0, 20),
          time: new Date().toLocaleTimeString(),
          link,
        };
        const result = await this.sendSMS(phone, params);
        await this.writeLog({
          monitorId: monitor.id,
          changeHistoryId: meta.historyId || null,
          channel: 'sms',
          provider: result.provider,
          recipient: this.maskPhone(phone),
          status: result.ok ? 'success' : 'failed',
          requestId: result.requestId || null,
          errorMessage: result.ok ? null : (result.errorMessage || null),
          payloadPreview: JSON.stringify({ name: params.name, time: params.time, link: params.link }).slice(0, 500),
          sentAt: new Date(),
        });
      }
    }
  }
}

module.exports = new NotificationService();
