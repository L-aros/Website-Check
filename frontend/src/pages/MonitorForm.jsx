import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Select, Checkbox, App, Card, Collapse, Switch, Divider, Row, Col } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { SettingOutlined, BellOutlined, GlobalOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Option } = Select;

const MonitorForm = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { message } = App.useApp();
  const { t } = useTranslation();

  useEffect(() => {
    if (isEdit) {
      fetchMonitor();
    }
  }, [id]);

  const fetchMonitor = async () => {
    try {
      const res = await axios.get(`/api/monitors/${id}`);
      form.setFieldsValue(res.data);
    } catch (error) {
      message.error('Failed to fetch monitor details');
    }
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      if (isEdit) {
        await axios.put(`/api/monitors/${id}`, values);
        message.success(t('common.save') + ' ' + t('common.success', { defaultValue: 'Success' }));
      } else {
        await axios.post('/api/monitors', values);
        message.success(t('common.save') + ' ' + t('common.success', { defaultValue: 'Success' }));
      }
      navigate('/monitors');
    } catch (error) {
      message.error('Failed to save monitor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card 
        title={isEdit ? t('monitorForm.editTitle') : t('monitorForm.createTitle')} 
        variant="borderless"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{
          frequency: '*/30 * * * *',
          selectorType: 'css',
          status: 'active',
          saveHtml: false,
          downloadAttachments: false,
          attachmentTypes: 'pdf,doc,docx,xls,xlsx,zip,rar',
          matchType: 'none',
          matchIgnoreCase: true,
          notifyEmail: false,
          notifyFeishu: false,
          notifySms: false,
          smsPhoneList: ''
        }}
      >
        {/* Basic Info Section */}
        <Divider orientation="left"><GlobalOutlined /> {t('monitorForm.basicInfo')}</Divider>
        <Row gutter={24}>
            <Col xs={24} md={12}>
                <Form.Item
                    name="name"
                    label={t('monitorForm.name')}
                    rules={[{ required: true }]}
                >
                    <Input placeholder="e.g. Product Price Check" />
                </Form.Item>
            </Col>
            <Col xs={24} md={12}>
                <Form.Item
                    name="url"
                    label={t('monitorForm.url')}
                    rules={[{ required: true, type: 'url' }]}
                >
                    <Input placeholder="https://example.com" />
                </Form.Item>
            </Col>
        </Row>
        <Row gutter={24}>
            <Col xs={24} md={12}>
                <Form.Item
                    name="status"
                    label={t('monitorForm.status')}
                    rules={[{ required: true }]}
                >
                    <Select>
                        <Option value="active">{t('monitorForm.statusActive')}</Option>
                        <Option value="paused">{t('monitorForm.statusPaused')}</Option>
                    </Select>
                </Form.Item>
            </Col>
        </Row>

        {/* Rules Section */}
        <Divider orientation="left"><ThunderboltOutlined /> {t('monitorForm.rules')}</Divider>
        <Row gutter={24}>
            <Col xs={24} md={6}>
                <Form.Item
                    name="selectorType"
                    label={t('monitorForm.selectorType')}
                >
                    <Select>
                        <Option value="css">CSS Selector</Option>
                        <Option value="xpath">XPath</Option>
                    </Select>
                </Form.Item>
            </Col>
            <Col xs={24} md={12}>
                <Form.Item
                    name="selector"
                    label={t('monitorForm.selector')}
                    rules={[{ required: true }]}
                    help="e.g. .price or //div[@id='price']"
                >
                    <Input />
                </Form.Item>
            </Col>
            <Col xs={24} md={6}>
                <Form.Item
                    name="frequency"
                    label={t('monitorForm.frequency')}
                    rules={[{ required: true }]}
                    help="e.g. */30 * * * * (Every 30 mins)"
                >
                    <Input />
                </Form.Item>
            </Col>
        </Row>

        {/* Notifications */}
        <Divider orientation="left"><BellOutlined /> {t('monitorForm.notifications')}</Divider>
        <Form.Item>
            <Form.Item name="notifyEmail" valuePropName="checked" noStyle>
                <Checkbox>{t('monitorForm.notifyEmail')}</Checkbox>
            </Form.Item>
            <Form.Item name="notifyFeishu" valuePropName="checked" noStyle>
                <Checkbox style={{ marginLeft: 16 }}>{t('monitorForm.notifyFeishu')}</Checkbox>
            </Form.Item>
            <Form.Item name="notifySms" valuePropName="checked" noStyle>
                <Checkbox style={{ marginLeft: 16 }}>{t('monitorForm.notifySms')}</Checkbox>
            </Form.Item>
        </Form.Item>

        <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.notifyEmail !== currentValues.notifyEmail}
        >
            {({ getFieldValue }) =>
            getFieldValue('notifyEmail') ? (
                <Form.Item
                name="emailList"
                label={t('monitorForm.emailList')}
                rules={[{ required: true }]}
                help={t('monitorForm.emailListHelp')}
                >
                <Input placeholder="admin@example.com, user@example.com" />
                </Form.Item>
            ) : null
            }
        </Form.Item>

        <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.notifyFeishu !== currentValues.notifyFeishu}
        >
            {({ getFieldValue }) =>
            getFieldValue('notifyFeishu') ? (
                <Form.Item
                name="feishuWebhook"
                label={t('monitorForm.feishuWebhook')}
                rules={[{ required: true }]}
                >
                <Input placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..." />
                </Form.Item>
            ) : null
            }
        </Form.Item>

        <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.notifySms !== currentValues.notifySms}
        >
            {({ getFieldValue }) =>
            getFieldValue('notifySms') ? (
                <Form.Item
                    name="smsPhoneList"
                    label={t('monitorForm.smsPhoneList')}
                    rules={[{ required: true, message: t('monitorForm.smsPhoneListRequired') }]}
                    help={t('monitorForm.smsPhoneListHelp')}
                >
                    <Input placeholder="13800000000,13900000000" />
                </Form.Item>
            ) : null
            }
        </Form.Item>

        {/* Advanced Settings */}
        <Collapse ghost items={[
            {
                key: 'advanced',
                label: <span><SettingOutlined /> {t('monitorForm.advanced')}</span>,
                children: (
                    <>
                        <Form.Item name="saveHtml" label={t('monitorForm.saveHtml')} valuePropName="checked">
                            <Switch />
                        </Form.Item>

                        <Form.Item
                            name="trackLinks"
                            label={t('monitorForm.trackLinks')}
                            extra={t('monitorForm.trackLinksHelp')}
                            valuePropName="checked"
                        >
                            <Switch />
                        </Form.Item>

                        <Form.Item
                            name="linkScopeSelector"
                            label={t('monitorForm.linkScopeSelector')}
                            extra={t('monitorForm.linkScopeSelectorHelp')}
                        >
                            <Input placeholder=".article-list" />
                        </Form.Item>

                        <Form.Item name="matchType" label={t('monitorForm.matchType')}>
                          <Select>
                            <Option value="none">{t('monitorForm.matchTypeNone')}</Option>
                            <Option value="keyword">{t('monitorForm.matchTypeKeyword')}</Option>
                            <Option value="regex">{t('monitorForm.matchTypeRegex')}</Option>
                          </Select>
                        </Form.Item>

                        <Form.Item
                          noStyle
                          shouldUpdate={(prev, curr) => prev.matchType !== curr.matchType}
                        >
                          {({ getFieldValue }) =>
                            getFieldValue('matchType') && getFieldValue('matchType') !== 'none' ? (
                              <>
                                <Form.Item
                                  name="matchPattern"
                                  label={t('monitorForm.matchPattern')}
                                  rules={[{ required: true }]}
                                  extra={t('monitorForm.matchPatternHelp')}
                                >
                                  <Input />
                                </Form.Item>
                                <Form.Item name="matchIgnoreCase" valuePropName="checked">
                                  <Checkbox>{t('monitorForm.matchIgnoreCase')}</Checkbox>
                                </Form.Item>
                              </>
                            ) : null
                          }
                        </Form.Item>
                        
                        <Form.Item name="downloadAttachments" label={t('monitorForm.autoDownload')} valuePropName="checked">
                            <Switch />
                        </Form.Item>

                        <Form.Item
                            name="downloadAttachmentsFromNewLinks"
                            label={t('monitorForm.downloadFromNewLinks')}
                            extra={t('monitorForm.downloadFromNewLinksHelp')}
                            valuePropName="checked"
                        >
                            <Switch />
                        </Form.Item>

                        <Form.Item
                            noStyle
                            shouldUpdate={(prev, curr) =>
                              prev.downloadAttachments !== curr.downloadAttachments ||
                              prev.downloadAttachmentsFromNewLinks !== curr.downloadAttachmentsFromNewLinks
                            }
                        >
                             {({ getFieldValue }) =>
                                (getFieldValue('downloadAttachments') || getFieldValue('downloadAttachmentsFromNewLinks')) ? (
                                    <Form.Item
                                    name="attachmentTypes"
                                    label={t('monitorForm.attachmentTypes')}
                                    help="Comma separated extensions (e.g. pdf,doc,zip)"
                                    >
                                    <Input />
                                    </Form.Item>
                                ) : null
                            }
                        </Form.Item>
                    </>
                )
            }
        ]} />

        <Form.Item style={{ marginTop: 24 }}>
          <Button type="primary" htmlType="submit" loading={loading} size="large">
            {t('common.save')}
          </Button>
          <Button style={{ marginLeft: 16 }} onClick={() => navigate('/monitors')} size="large">
            {t('common.cancel')}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default MonitorForm;
