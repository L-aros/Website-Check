import React, { useEffect, useState } from 'react';
import { Card, Form, Switch, Input, Select, Button, App, InputNumber } from 'antd';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const Settings = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/settings');
      form.setFieldsValue(res.data || {});
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await axios.put('/api/settings', values);
      message.success(t('settings.saved'));
      await load();
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>{t('settings.title')}</h2>
      <Card variant="borderless" loading={loading}>
        <Form layout="vertical" form={form}>
          <Card type="inner" title={t('settings.attachmentsSection')} variant="borderless">
            <Form.Item
              name="autoDownloadAttachmentsFromNewLinks"
              label={t('settings.autoDownloadFromNewLinks')}
              valuePropName="checked"
              extra={t('settings.autoDownloadFromNewLinksHelp')}
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="attachmentDateAfter"
              label={t('settings.dateAfter')}
              extra={t('settings.dateAfterHelp')}
            >
              <Input allowClear placeholder="2026-01-01" />
            </Form.Item>

            <Form.Item
              name="maxNewLinksPerCheck"
              label={t('settings.maxNewLinksPerCheck')}
              extra={t('settings.maxNewLinksPerCheckHelp')}
            >
              <InputNumber min={0} max={500} style={{ width: 200 }} />
            </Form.Item>

            <Form.Item
              name="attachmentLogLevel"
              label={t('settings.logLevel')}
              extra={t('settings.logLevelHelp')}
            >
              <Select
                options={[
                  { label: 'error', value: 'error' },
                  { label: 'warn', value: 'warn' },
                  { label: 'info', value: 'info' },
                  { label: 'debug', value: 'debug' },
                ]}
              />
            </Form.Item>
          </Card>

          <div style={{ marginTop: 16 }}>
            <Button type="primary" onClick={save} loading={saving}>
              {t('common.save')}
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Settings;
