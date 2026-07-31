import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PortfolioClient from "./app/PortfolioClient";
import "./app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PortfolioClient />
  </StrictMode>,
);
