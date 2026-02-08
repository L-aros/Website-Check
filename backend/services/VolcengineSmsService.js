const { sms } = require('@volcengine/openapi');

class VolcengineSmsService {
  constructor() {
    this.accessKeyId = process.env.VOLC_ACCESS_KEY_ID;
    this.secretKey = process.env.VOLC_SECRET_KEY;
    this.signName = process.env.VOLC_SMS_SIGN_NAME;
    this.templateId = process.env.VOLC_SMS_TEMPLATE_ID;
    this.smsAccount = process.env.VOLC_SMS_ACCOUNT; // Account ID for SMS service
    this.templateHasParams = process.env.VOLC_SMS_TEMPLATE_HAS_PARAMS !== 'false';

    if (this.accessKeyId && this.secretKey) {
      this.client = new sms.SmsService({
        accessKeyId: this.accessKeyId,
        secretKey: this.secretKey,
      });
    }
  }

  async send(phone, params) {
    if (!this.client) {
      console.warn('Volcengine SMS not configured');
      return { ok: false, provider: 'volcengine', errorMessage: 'not_configured' };
    }

    try {
      const templateParam = this.templateHasParams ? params : {};
      const request = {
        SmsAccount: this.smsAccount,
        Sign: this.signName,
        TemplateID: this.templateId,
        PhoneNumbers: phone,
        TemplateParam: JSON.stringify(templateParam),
      };

      const result = await this.client.SendSms(request);
      return {
        ok: true,
        provider: 'volcengine',
        requestId: result && (result.RequestId || result.requestId),
        raw: result,
      };
    } catch (error) {
      return {
        ok: false,
        provider: 'volcengine',
        errorMessage: error && error.message ? error.message : String(error),
      };
    }
  }
}

module.exports = new VolcengineSmsService();
