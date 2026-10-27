// Serverda ishlaydi: to'g'ri javob va xat saytning ichida YO'Q.
//
// Netlify > Site settings > Environment variables:
//   TG_TOKEN      = bot tokeni (yangisi!)
//   TG_CHAT_ID    = chat ID
//   NOTIFY_VISIT  = 1   (ixtiyoriy) har bir kirish haqida xabar
//   NOTIFY_FINISH = 0   (ixtiyoriy) 5 zalni tugatganlar haqidagi xabarni o'chirish
//   NOTIFY_WRONG  = 1   (ixtiyoriy) noto'g'ri urinishlar ham kelsin

const LETTER = `Jonim,

vaqt o'tdi, kunlar almashdi, lekin men hali ham sen haqingda tun-u kun o'ylayapman.
Ertalab ko'zimni ochsam ham, kechasi uxlashdan oldin ham xayolimda sen borsan.

Seni birinchi ko'rgan o'sha kunni hali ham yaxshi eslayman.
Yuragim o'shanda nimadir sezgandi, endi bilaman: bu sen ekansan.`;

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[’'`ʻʼ]/g, "")
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// "20", "20-maktab", "20 maktab", "maktab 20" (lotin va kirill)
function isCorrect(input) {
  const s = normalize(input);
  return /^(20[\s-]*(maktab|мактаб)?|(maktab|мактаб)[\s-]*20)$/.test(s);
}

function device(ua) {
  ua = ua || "";
  if (/iphone|ipad/i.test(ua)) return "iPhone/iPad";
  if (/android/i.test(ua)) return "Android";
  if (/windows|macintosh|linux/i.test(ua)) return "Kompyuter";
  return "Noma'lum";
}

function clean(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").slice(0, max);
}

async function notify(text) {
  const { TG_TOKEN, TG_CHAT_ID } = process.env;
  if (!TG_TOKEN || !TG_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text }),
    });
  } catch (e) {}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (code, obj) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(obj),
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, {});
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) {}

  const dev = device(event.headers["user-agent"]);
  const time = new Date().toLocaleTimeString("en-GB", {
    timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit", hour12: false,
  });

  if (body.type === "visit") {
    if (process.env.NOTIFY_VISIT === "1") {
      const via = clean(body.src, 10) === "qr" ? "QR orqali" : "havola orqali";
      await notify(`👀 Muzeyga kirishdi (${via})\n${time} · ${dev}`);
    }
    return json(200, { ok: true });
  }

  if (body.type === "finish") {
    if (process.env.NOTIFY_FINISH !== "0") {
      const picks = Array.isArray(body.picks)
        ? body.picks.slice(0, 5).map((p) => clean(p, 24)).join(" · ")
        : "";
      await notify(`🏛 5 zalni tugatdi\n${picks}\n${time} · ${dev}`);
    }
    return json(200, { ok: true });
  }

  if (body.type === "attempt") {
    if (isCorrect(body.code)) {
      await notify(`💌 Maxfiy xona ochildi!\n${time} · ${dev}`);
      return json(200, { ok: true, letter: LETTER });
    }
    // Tez-tez taxmin qilishni sekinlashtiramiz
    await sleep(700);
    if (process.env.NOTIFY_WRONG === "1") {
      await notify(`Urinish: "${clean(body.code, 40)}" (noto'g'ri)\n${time} · ${dev}`);
    }
    return json(200, { ok: false });
  }

  return json(400, {});
};
