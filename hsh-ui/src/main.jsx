import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#2f6f5e',
          colorSuccess: '#2c9a5f',
          colorWarning: '#d9952e',
          colorText: '#26302c',
          colorTextSecondary: '#66766f',
          colorBgContainer: '#ffffff',
          colorBorder: '#dfe7e3',
          borderRadius: 6,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
        },
        components: {
          Button: {
            controlHeight: 40,
          },
          Input: {
            controlHeight: 40,
          },
          Select: {
            controlHeight: 40,
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </StrictMode>,
);
