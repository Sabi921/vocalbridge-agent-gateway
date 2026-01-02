
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

export default function Login() {
    const [key, setKey] = useState("");
    const [err, setErr] = useState<string | null>(null);
    const { login } = useAuth();

    const handleLogin = async () => {
        setErr(null);

        // temporarily store key so interceptor sends it
        localStorage.setItem("apiKey", key);

        try {
            await api.get("/agents"); // backend will 401 if key is wrong
            login(key);
        } catch (e: any) {
            localStorage.removeItem("apiKey");
            setErr("Invalid API key. Paste a real seeded key.");
        }
    };

    return (
        <div style={{ padding: 40 }}>
            <h2>VocalBridge Dashboard</h2>
            <p>Enter your API key to continue</p>

            <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="API Key"
                style={{ width: 360, padding: 8 }}
            />
            <br /><br />
            <button onClick={handleLogin}>Login</button>

            {err && <p style={{ marginTop: 12 }}>{err}</p>}
        </div>
    );
}