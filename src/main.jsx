import { Buffer } from "buffer";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { initMixpanel } from "./utils/mixpanel.js";
import "./index.css";

window.Buffer = Buffer;
initMixpanel();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);