import { Navigate, Route, Routes } from "react-router-dom";
import { ClientConfigProvider } from "./config/ClientConfigContext";
import PlayFlow from "./pages/PlayFlow";
import Display from "./pages/Display";
import Admin from "./pages/Admin";

export default function App(): JSX.Element {
  return (
    <ClientConfigProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/play" replace />} />
        <Route path="/play" element={<PlayFlow />} />
        <Route path="/display" element={<Display />} />
        <Route path="/admin/*" element={<Admin />} />
        <Route path="*" element={<Navigate to="/play" replace />} />
      </Routes>
    </ClientConfigProvider>
  );
}
