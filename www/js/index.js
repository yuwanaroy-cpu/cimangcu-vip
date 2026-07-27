// Variable Global
let jsonData = { allowed_ids: [] };
let sha = "";

// ==========================================
// 1. TAMPILAN & STATUS (UI HELPER)
// ==========================================

function toggleDark() {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    localStorage.setItem("darkmode", isDark ? "1" : "0");
    document.getElementById("darkToggle").innerText = isDark ? "☀️" : "🌙";
}

function setStatus(msg, type) {
    const el = document.getElementById("status");
    el.innerText = msg;
    el.className = "status show " + type;
    setTimeout(() => { el.className = "status"; }, 3500);
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================
// 2. LOGIKA SEARCH & RENDER
// ==========================================

function getSearchTerm() {
    return document.getElementById("search").value.toLowerCase().trim();
}

function getFilteredIds() {
    const ids = jsonData.allowed_ids || [];
    const term = getSearchTerm();
    
    return ids
        .map((val, idx) => ({ value: val, originalIndex: idx }))
        .filter(item => !term || item.value.toLowerCase().includes(term));
}

function render() {
    const list = document.getElementById("list");
    const empty = document.getElementById("empty");
    const filtered = getFilteredIds();

    document.getElementById("stat-total").innerText = (jsonData.allowed_ids || []).length;
    document.getElementById("stat-shown").innerText = filtered.length;

    if (filtered.length === 0 && (jsonData.allowed_ids || []).length > 0) {
        empty.style.display = "block";
        list.innerHTML = "";
        return;
    }
    empty.style.display = "none";

    let html = "";
    filtered.forEach((item) => {
        const v = escapeHtml(item.value);
        const idx = item.originalIndex; // Menggunakan indeks asli array

        html += `
        <div class="item">
            <input value="${v}" onchange="updateID(${idx}, this.value)">
            <button class="secondary" onclick="copyID('${v}')" title="Salin ID">📋</button>
            <button class="danger" onclick="hapus(${idx})" title="Hapus">X</button>
        </div>
        `;
    });

    list.innerHTML = html;
}

// ==========================================
// 3. MANAJEMEN ID (CRUD)
// ==========================================

function updateID(index, newValue) {
    if (!jsonData.allowed_ids) jsonData.allowed_ids = [];
    jsonData.allowed_ids[index] = newValue.trim();
    render();
    setStatus("ID diperbarui", "success");
}

function hapus(index) {
    const itemTarget = jsonData.allowed_ids[index];
    if (!confirm(`Hapus ID: "${itemTarget}"?`)) return;
    
    jsonData.allowed_ids.splice(index, 1);
    render();
    setStatus("ID dihapus", "success");
}

function addID() {
    const input = document.getElementById("newid");
    const val = input.value.trim();
    
    if (!val) {
        setStatus("ID tidak boleh kosong", "error");
        return;
    }
    if (!jsonData.allowed_ids) jsonData.allowed_ids = [];
    if (jsonData.allowed_ids.includes(val)) {
        setStatus("ID sudah ada: " + val, "error");
        return;
    }
    
    jsonData.allowed_ids.push(val);
    input.value = "";
    document.getElementById("search").value = "";
    render();
    setStatus("ID ditambahkan: " + val, "success");
}

function sortIDs() {
    if (!jsonData.allowed_ids) return;
    jsonData.allowed_ids.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    render();
    setStatus("ID berhasil diurutkan A-Z", "success");
}

function removeDuplicates() {
    if (!jsonData.allowed_ids) return;
    const before = jsonData.allowed_ids.length;
    jsonData.allowed_ids = [...new Set(jsonData.allowed_ids)];
    const after = jsonData.allowed_ids.length;
    render();
    setStatus(`Duplikat dihapus: ${before - after} item`, "success");
}

function clearAll() {
    if (!jsonData.allowed_ids || jsonData.allowed_ids.length === 0) return;
    if (!confirm(`Hapus seluruh ${jsonData.allowed_ids.length} ID?`)) return;
    jsonData.allowed_ids = [];
    render();
    setStatus("Semua ID telah dihapus", "success");
}

async function copyID(text) {
    try {
        await navigator.clipboard.writeText(text);
        setStatus("📋 ID disalin: " + text, "success");
    } catch (e) {
        // Fallback untuk browser lama
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setStatus("📋 ID disalin: " + text, "success");
    }
}

// ==========================================
// 4. INTEGRASI API GITHUB
// ==========================================

async function loadJSON() {
    const token = document.getElementById("token").value.trim();
    const owner = document.getElementById("owner").value.trim();
    const repo = document.getElementById("repo").value.trim();
    const path = document.getElementById("path").value.trim();

    if (!token) { setStatus("Token GitHub wajib diisi", "error"); return; }

    try {
        const r = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            {
                headers: {
                    Authorization: "Bearer " + token,
                    Accept: "application/vnd.github+json"
                }
            }
        );

        if (r.status === 401) throw new Error("Token tidak valid / tidak punya akses");
        if (r.status === 404) throw new Error("File atau repositori tidak ditemukan");
        if (!r.ok) throw new Error("HTTP Status " + r.status);

        const d = await r.json();
        sha = d.sha;

        // Decode base64 UTF-8 secara aman
        const cleanContent = d.content.replace(/\s/g, "");
        const bytes = Uint8Array.from(atob(cleanContent), c => c.charCodeAt(0));
        const text = new TextDecoder().decode(bytes);

        jsonData = JSON.parse(text);
        if (!Array.isArray(jsonData.allowed_ids)) {
            jsonData.allowed_ids = [];
        }

        document.getElementById("search").value = "";
        render();
        setStatus(`✅ Berhasil memuat ${jsonData.allowed_ids.length} ID`, "success");
        localStorage.setItem("github_token", token);
    } catch (e) {
        setStatus("❌ " + e.message, "error");
    }
}

async function saveJSON() {
    const token = document.getElementById("token").value.trim();
    const owner = document.getElementById("owner").value.trim();
    const repo = document.getElementById("repo").value.trim();
    const path = document.getElementById("path").value.trim();
    const msg = document.getElementById("msg").value.trim();

    if (!token) { setStatus("Token GitHub wajib diisi", "error"); return; }
    if (!sha) { setStatus("Silakan Load JSON terlebih dahulu!", "error"); return; }

    // Pembersihan data sebelum disimpan
    jsonData.allowed_ids = [...new Set(
        (jsonData.allowed_ids || [])
            .map(x => (x || "").trim())
            .filter(x => x !== "")
    )];

    try {
        const text = JSON.stringify(jsonData, null, 2);
        const bytes = new TextEncoder().encode(text);
        let binary = "";
        bytes.forEach(b => binary += String.fromCharCode(b));
        const content = btoa(binary);

        const body = { message: msg, content: content, sha: sha };

        const r = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            {
                method: "PUT",
                headers: {
                    Authorization: "Bearer " + token,
                    Accept: "application/vnd.github+json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            }
        );

        if (r.ok) {
            const result = await r.json();
            sha = result.content.sha; // Update SHA terbaru setelah simpan
            render();
            setStatus(`✅ Tersimpan ke GitHub! (${jsonData.allowed_ids.length} ID)`, "success");
        } else if (r.status === 409) {
            setStatus("Gagal simpan: Konflik SHA. Silakan Load ulang.", "error");
        } else {
            setStatus("Gagal simpan: HTTP " + r.status, "error");
        }
    } catch (e) {
        setStatus("❌ " + e.message, "error");
    }
}

// ==========================================
// 5. INISIALISASI HALAMAN
// ==========================================

window.onload = function() {
    const savedToken = localStorage.getItem("github_token");
    if (savedToken) document.getElementById("token").value = savedToken;

    if (localStorage.getItem("darkmode") === "1") {
        document.body.classList.add("dark");
        document.getElementById("darkToggle").innerText = "☀️";
    }
};
