import ChatThread from "../assistant/ChatThread";
import { useChat } from "../assistant/useChat";

const GREETING = "Привет! Я бот WebIK. Спросите что-нибудь о наших услугах 👋";

/** Демо-чат на «Возможностях». Тот же бот, что в виджете справа внизу. */
export default function ChatBot() {
  const { messages, typing, send } = useChat(GREETING);
  return <ChatThread messages={messages} typing={typing} onSend={send} className="h-[260px]" />;
}
