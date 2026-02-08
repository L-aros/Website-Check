const Core = require('@alicloud/pop-core');

class AliyunSmsService {
  constructor() {
    this.accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
    this.accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
    this.signName = process.env.ALIYUN_SMS_SIGN_NAME;
    this.templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;

    if (this.accessKeyId && this.accessKeySecret) {
      this.client = new Core({
        accessKeyId: this.accessKeyId,
        accessKeySecret: this.accessKeySecret,
        endpoint: 'https://dysmsapi.aliyuncs.com',
        apiVersion: '2017-05-25',
      });
    }
  }

  async send(phone, params) {
    if (!this.client) {
      console.warn('Aliyun SMS not configured');
      return { ok: false, provider: 'aliyun', errorMessage: 'not_configured' };
    }

    try {
      const result = await this.client.request('SendSms', {
        RegionId: 'cn-hangzhou',
        PhoneNumbers: phone,
        SignName: this.signName,
        TemplateCode: this.templateCode,
        TemplateParam: JSON.stringify(params),
      }, {
        method: 'POST',
      });
      const ok = result && (result.Code === 'OK' || result.Code === 'ok');
      return {
        ok: Boolean(ok),
        provider: 'aliyun',
        requestId: result && (result.RequestId || result.requestId),
        providerCode: result && result.Code,
        providerMessage: result && result.Message,
      };
    } catch (error) {
      return {
        ok: false,
        provider: 'aliyun',
        errorMessage: error && error.message ? error.message : String(error),
      };
    }
  }
}

module.exports = new AliyunSmsService();
