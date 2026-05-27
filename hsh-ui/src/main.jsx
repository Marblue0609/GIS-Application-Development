import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App.jsx';

// 全局样式：移除默认边距，确保地图填满视口
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#e76f51',
          colorSuccess: '#7aa95c',
          colorWarning: '#f4a261',
          colorText: '#332821',
          colorTextSecondary: '#7b695f',
          colorBgContainer: '#fffaf3',
          colorBorder: '#ead8c7',
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
