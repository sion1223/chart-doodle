import React from "react";
import { createRoot } from "react-dom/client";
import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import "@fontsource/gaegu/400.css";
import "@fontsource/gaegu/700.css";
import "./app.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <TDSMobileAITProvider>
      <App />
    </TDSMobileAITProvider>
  </React.StrictMode>,
);
