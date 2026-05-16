import { useAuthSessionSSE } from "@/hooks/useAuthSessionSSE";

const AuthSessionEventsBridge = () => {
  useAuthSessionSSE();
  return null;
};

export default AuthSessionEventsBridge;

