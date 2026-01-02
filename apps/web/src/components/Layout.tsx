
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Props = {
    children: ReactNode;
};

export default function Layout({ children }: Props) {
    const { logout } = useAuth();

    return (
        <div>
            <header
                style={{
                    padding: "12px 20px",
                    borderBottom: "1px solid #ddd",
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                }}
            >
                <strong>VocalBridge</strong>

                <nav style={{ display: "flex", gap: 12}}>
                    <Link to="/agents">Agents</Link>
                    <Link to="/chat">Try It</Link>
                    <Link to="/billing">Billing</Link>
                </nav>

                <div style={{ marginLeft: "auto" }}>
                    <button onClick={logout}>Logout</button>
                </div>
            </header>

            <main style={{ padding: 20 }}>{children}</main>
        </div>
    );
}