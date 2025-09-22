const BASE_URL = process.env.REACT_APP_API_BASE_URL ?? "http://localhost:8000/api";

async function api(path, { method = "GET", body } = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText} – ${detail}`);
    }
    return res.status === 204 ? null : res.json();
}

export async function* streamChat(message) {
    const res = await fetch(`${BASE_URL}/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            // no auth headers needed
        },
        body: JSON.stringify({ message }),
    });

    if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }

    // stream parsing: the server yields newline-delimited lines
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // process complete lines
        let nl;
        while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);

            if (!line) continue;

            // format: "<type>: <payload>"
            const sep = line.indexOf(":");
            if (sep === -1) {
                yield { type: "unknown", raw: line };
                continue;
            }

            const type = line.slice(0, sep).trim();
            const rawPayload = line.slice(sep + 1).trim();

            let payload = rawPayload;
            try {
                payload = JSON.parse(rawPayload);
            } catch {
                // keep as raw string if not valid JSON
            }

            yield { type, payload };
        }
    }
}

export async function health() {
    const r = await fetch(`${BASE_URL}/health`);
    if (!r.ok) throw new Error(`Health check failed: ${r.status}`);
    return r.json();
}
