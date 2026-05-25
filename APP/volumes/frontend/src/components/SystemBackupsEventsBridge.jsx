import { useSystemBackupsSSE } from "@/hooks/useSystemBackupsSSE";

const SystemBackupsEventsBridge = () => {
  useSystemBackupsSSE();
  return null;
};

export default SystemBackupsEventsBridge;
