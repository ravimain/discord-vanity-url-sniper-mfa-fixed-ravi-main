import WebSocket from "ws";
import http2 from "http2";
import fs from "fs/promises";
let mfaToken = null;
let ws = null;
let session = null;
let guilds = {};
let lastSequence = null;
const readMFAToken = async () => { 
    try { 
        mfaToken = await fs.readFile('mfa_token.txt', 'utf8');
    } catch {} 
};
async function extractJsonFromString(str) {
    const jsonRegex = /{[^{}]*}|\[[^\[\]]*\]/g;
    const matches = str.match(jsonRegex) || [];
    const results = [];
    
    for (const match of matches) {
        try {
            const parsed = JSON.parse(match);
            if (parsed) results.push(parsed);
        } catch {}
    }
    
    return results;
}
function connectWebSocket() {
    if(ws) ws.close();
    ws = new WebSocket("wss://gateway-us-east1-d.discord.gg", {
        perMessageDeflate: false
    });
    setTimeout(() => {
        if(ws) ws.close();
    }, 900000);
    ws.onclose = () => {
        setTimeout(connectWebSocket, 100);
    };
    ws.onerror = () => {
        ws.close();
    };
    ws.onmessage = async ({data}) => {
        try {
            const {d, op, t, s} = JSON.parse(data);
            if(s) lastSequence = s;
    
            if(t === "GUILD_UPDATE") {
                const find = guilds[d.guild_id];
                if(find && find !== d.vanity_url_code) {
                    ["/api/v9/", "/api/v7/"].forEach(v => {
                        const req = session.request({
                            ":authority": "canary.discord.com", 
                            ":scheme": "https",
                            ":method": "PATCH", 
                            ":path": `${v}guilds/guildidgirXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/vanity-url`,
                            "Authorization": "",
                            "Content-Type": "application/json",
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
                            "X-Super-Properties": "eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiQ2hyb21lIiwiZGV2aWNlIjoiIiwic3lzdGVtX2xvY2FsZSI6InRyLVRSIiwiY2xpZW50X21vZHMiOmZhbHNlLCJicm93c2VyX3VzZXJfYWdlbnQiOiJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOyBXaW42NDsgeDY0KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMTMyLjAuMC4wIFNhZmFyaS81MzcuMzYiLCJicm93c2VyX3ZlcnNpb24iOiIxMzIuMC4wLjAiLCJvc192ZXJzaW9uIjoiMTAifQ==",
                            'X-Discord-MFA-Authorization': mfaToken,
                            "Cookie": `__Secure-recent_mfa=${mfaToken}`
                        });  
                        req.on('response', async (headers) => {
                            const statusCode = headers[':status'];
                            const chunks = [];
                            req.on('data', chunk => chunks.push(chunk));
                            req.on('end', async () => {
                                const responseData = Buffer.concat(chunks).toString();
                                let jsonResult;
                                try {
                                    const extractedJson = await extractJsonFromString(responseData);
                                    jsonResult = extractedJson.find(e => e.code) || extractedJson.find(e => e.message) || extractedJson;
                                } catch {
                                    jsonResult = responseData;
                                }
                                console.log(`${find} ${v}`, {
                                    status: statusCode,
                                    data: jsonResult
                                });
                                const webhook = session.request({
                                    ":method": "POST",
                                    ":path": `/api/v9/channels/kanalidgirXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/messages`,
                                    ":authority": "canary.discord.com",
                                    ":scheme": "https",
                                    "Authorization": "",
                                    "Content-Type": "application/json",
                                });
                        
                                webhook.write(JSON.stringify({
                                    content: `@everyone ${find}\n\`\`\`json\n${JSON.stringify(jsonResult)}\`\`\``
                                }));
                                webhook.end();
                            });
                        });
                        
                        req.end(JSON.stringify({code: find}));
                    });
                }
            } else if(t === "READY") {
                d.guilds.forEach(({id, vanity_url_code}) => {
                    if(vanity_url_code) guilds[id] = vanity_url_code;
                });
                console.log(guilds);
            }

            if(op === 10) {
                setInterval(() => {
                    if(ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            op: 1,
                            d: lastSequence
                        }));
                    }
                }, d.heartbeat_interval);

                ws.send(JSON.stringify({
                    op: 2,
                    d: {
                        token: "SUNUCULARDA OLAN TOKENI GIR XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                        intents: 1 << 0,
                        properties: { 
                            os: "linux", 
                            browser: "firefox", 
                            device: "ravi" 
                        },
                    }
                }));

                setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ op: 1, d: {}, s: null, t: "heartbeat" }));
                    }
                }, d.heartbeat_interval);
            } else if (op === 7) {
                process.exit();
            }
        } catch (err) {
        }
    };
    setInterval(() => {
        const req = session.request({
            ":method": "GET",
            ":path": "/",
            ":authority": "canary.discord.com",
            ":scheme": "https"
        });
        req.end();
    }, 2500);
}
function connectHTTP2() {
    if(session) session.close();
    session = http2.connect("https://canary.discord.com", {
        settings: {
            enablePush: false
        }
    });
    session.on('error', () => {
        setTimeout(connectHTTP2, 50);
    });
    session.on('close', () => {
        setTimeout(connectHTTP2, 50);
    });
    session.on("connect", () => {
        connectWebSocket();
    });
}
async function initialize() {
    await readMFAToken();
    connectHTTP2();
    setInterval(readMFAToken, 30000);
}
initialize();