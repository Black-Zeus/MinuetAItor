import React from "react";
import ReactDOM from "react-dom/client";
import "./style.css";

function App() {
  return (
    <div className="min-h-screen bg-red-100 p-6 font-sans">
      <h1 className="text-3xl font-bold text-slate-900">
        MinuetAItor
      </h1>

      <p className="mt-2 text-slate-700">
        Frontend inicial (Vite + React).
      </p>

      <p className="mt-2">
        API health:{" "}
        <code className="rounded bg-slate-200 px-2 py-0.5 text-sm">
          /api/health
        </code>
      </p>
    </div>
  );
}


ReactDOM.createRoot(document.getElementById("root")).render(<App />);