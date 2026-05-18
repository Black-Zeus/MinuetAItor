import { useNotificationsSSE } from "@/hooks/useNotificationsSSE";

const NotificationsEventsBridge = () => {
  useNotificationsSSE();
  return null;
};

export default NotificationsEventsBridge;
