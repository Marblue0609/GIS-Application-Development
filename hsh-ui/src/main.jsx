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
          colorPrimary: '#ff6b4a',
          colorSuccess: '#4fb36b',
          colorWarning: '#ffb23f',
          colorText: '#2f2a26',
          colorTextSecondary: '#726a62',
          colorBgContainer: '#fffdf8',
          colorBorder: '#f0dfcf',
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
