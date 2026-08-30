import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { setupI18n } from "./i18n";
import "./styles/global.css";

setupI18n("en");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
