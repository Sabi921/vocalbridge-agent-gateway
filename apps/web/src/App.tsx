
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.tsx";
import Login from "./pages/Login.tsx";
import Agents from "./pages/Agents.tsx";
import Chat from "./pages/Chat.tsx";
import Billing from "./pages/Billing.tsx";
import Layout from "./components/Layout.tsx";


export default function App() {
    const { apiKey } = useAuth();

    if (!apiKey) return <Login />;

    return (
        <Layout>
            <Routes>
                <Route path="/" element={<Navigate to="/agents" />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/billing" element={<Billing />} />
            </Routes>
        </Layout>
    );
}