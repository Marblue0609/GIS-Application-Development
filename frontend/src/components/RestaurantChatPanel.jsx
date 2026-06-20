import { useMemo, useRef, useState } from 'react';
import { Button, Input, Tag, Typography } from 'antd';
import { CloseOutlined, MessageOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';
import { ChatRestaurants } from '../services/chatService';

const { Text } = Typography;

const initialMessages = [
  {
    role: 'assistant',
    content: '可以问我餐厅评分、人均价格、菜系、地址、电话，或让我按需求推荐餐厅。',
  },
];

const renderInlineMarkdown = (text) => {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={`${match.index}-strong`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(<code key={`${match.index}-code`}>{token.slice(1, -1)}</code>);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      if (linkMatch) {
        parts.push(
          <a key={`${match.index}-link`} href={linkMatch[2]} target="_blank" rel="noreferrer">
            {linkMatch[1]}
          </a>,
        );
      } else {
        parts.push(token);
      }
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
};

const renderMarkdownBlocks = (content) => {
  const blocks = [];
  const lines = String(content ?? '').split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const Tag = `h${heading[1].length + 3}`;
      blocks.push(<Tag key={`heading-${index}`}>{renderInlineMarkdown(heading[2])}</Tag>);
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*]\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`ul-item-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`ol-item-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const paragraph = [];
    while (
      index < lines.length
      && lines[index].trim()
      && !/^(#{1,3})\s+/.test(lines[index])
      && !/^[-*]\s+/.test(lines[index])
      && !/^\d+\.\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }

    blocks.push(
      <p key={`p-${index}`}>
        {renderInlineMarkdown(paragraph.join(' '))}
      </p>,
    );
  }

  return blocks;
};

function MarkdownMessage({ content }) {
  return <div className="markdown-content">{renderMarkdownBlocks(content)}</div>;
}

function RestaurantChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  const apiMessages = useMemo(
    () => messages.filter((message) => message.role === 'user' || message.role === 'assistant'),
    [messages],
  );

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || sending) return;

    const nextMessages = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);

    try {
      const result = await ChatRestaurants(nextMessages.filter((message) => message.role !== 'system'));
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: result.reply || '没有收到有效回复。' },
      ]);
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: detail || '餐厅助手暂时不可用，请确认后端已启动并配置 DEEPSEEK_API_KEY。',
        },
      ]);
    } finally {
      setSending(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  if (!open) {
    return (
      <Button
        className="chat-toggle"
        type="primary"
        icon={<MessageOutlined />}
        onClick={() => setOpen(true)}
      >
        餐厅助手
      </Button>
    );
  }

  return (
    <section className="restaurant-chat-panel">
      <header className="chat-header">
        <div>
          <Text className="chat-kicker">DeepSeek</Text>
          <strong><RobotOutlined /> 餐厅助手</strong>
        </div>
        <div className="chat-header-actions">
          <Tag>deepseek-v4-flash</Tag>
          <Button type="text" icon={<CloseOutlined />} onClick={() => setOpen(false)} />
        </div>
      </header>

      <div className="chat-messages">
        {apiMessages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
            <MarkdownMessage content={message.content} />
          </div>
        ))}
        {sending && (
          <div className="chat-message assistant">
            <MarkdownMessage content="正在查询餐厅资料..." />
          </div>
        )}
      </div>

      <div className="chat-input-row">
        <Input.TextArea
          ref={inputRef}
          value={input}
          autoSize={{ minRows: 1, maxRows: 3 }}
          placeholder="例如：推荐几家评分高的人均 50 元以内餐厅"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={sending}
          onClick={sendMessage}
        />
      </div>
    </section>
  );
}

export default RestaurantChatPanel;
