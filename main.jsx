import React from "react";
import { createRoot } from "react-dom/client";
import CIPBeamOptimizer from "./CIPBeamOptimizer.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CIPBeamOptimizer />
  </React.StrictMode>,
);
