import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installResilientSupabaseFetch } from "./lib/resilientSupabaseFetch";

installResilientSupabaseFetch();

createRoot(document.getElementById("root")!).render(<App />);
