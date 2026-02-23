// ToasterManager.jsx
import { ToastContainer, Bounce } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function ToasterManager() {
  return (
    <ToastContainer
      icon={false}
      position="bottom-right"
      autoClose={3000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick={false}
      rtl={false}
      pauseOnFocusLoss
      draggable={false}
      pauseOnHover={false}
      theme="dark"
      transition={Bounce}
      style={{ zIndex: 1100 }}
      toastClassName={() =>
        [
          "w-[440px] max-w-[calc(100vw-1.5rem)]",
          "bg-[#0B1220]",
          "text-white",
          "rounded-xl shadow-lg border border-white/10",
          "px-4 py-3",
          "overflow-hidden",
        ].join(" ")
      }
      bodyClassName={() => "m-0 p-0 text-sm leading-5"}

    />
  );
}
