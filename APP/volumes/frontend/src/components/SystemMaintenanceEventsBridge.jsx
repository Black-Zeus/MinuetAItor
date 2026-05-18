import { useSystemMaintenanceSSE } from "@/hooks/useSystemMaintenanceSSE";

const SystemMaintenanceEventsBridge = () => {
  useSystemMaintenanceSSE();
  return null;
};

export default SystemMaintenanceEventsBridge;
