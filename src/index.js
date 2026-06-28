// ====================================================================
// ========== بوت تيليجرام المتكامل المطوّر - الإصدار 2.3 ==========
// ====================================================================

const DEFAULT_DATA = {
  settings: {
    botActive: true,
    stopMessage: "⏸️ البوت متوقف حالياً. يرجى المحاولة لاحقاً.",
    admins: [],
    antiSpam: { enabled: false, maxMessages: 5, interval: 10, action: "warn" },
  },
  verification: {
    enabled: false,
    channelId: null,
    channelName: null,
    requestMessage: "🔐 يرجى مشاركة رقم هاتفك للتحقق:",
    buttonText: "📱 مشاركة الرقم",
    successMessage: "✅ تم التحقق بنجاح!",
    failMessage: "❌ تم رفض طلب التحقق.",
    verifiedUsers: {},
    rejectedUsers: {},
    pendingUsers: {},
  },
  protection: { enabled: false },
  notifications: { enabled: false, channelId: null, channelName: null, logAllActions: true },
  welcome: {
    text: "🎉 <b>مرحباً بك في البوت!</b>\n\nيمكنك استخدام البوت للوصول إلى المحتوى.",
    mediaType: null,
    mediaFileId: null,
    useHtml: true,
    registeredMessage: "📦 <b>مرحباً بعودتك!</b>\n\nيمكنك استخدام البوت الآن.",
  },
  commands: {},
  users: {},
  bannedUsers: {},
  content: {},
  forcedSubscription: {
    enabled: false,
    list: [],
    settings: {
      notification: false,
      displayMode: "grouped",
      verifyButtonText: "تحقق ✅",
      groupedMessage: "📢 <b>يجب عليك الاشتراك في القنوات التالية:</b>",
      checkInterval: 3,
    },
    userStatus: {},
  },
  broadcast: { history: [] },
  content: {
    items: {},
    publishChannel: null,
    publishChannelName: null,
    nextId: 10000,
    contactMessage: "📞 <b>للتواصل معنا:</b>\n\nيمكنك التواصل مع الإدارة مباشرة.",
    searchPrompt: "🔍 أرسل رقم المحتوى المكون من 5 أرقام:",
  },
  buttons: {
    items: [], // { id, label, url }
  },
  texts: {
    welcomeNew: "🎉 <b>مرحباً بك في البوت!</b>\n\nيمكنك استخدام البوت للوصول إلى المحتوى.",
    welcomeRegistered: "📦 <b>مرحباً بعودتك!</b>\n\nيمكنك استخدام البوت الآن.",
    verificationRequest: "🔐 يرجى مشاركة رقم هاتفك للتحقق:",
    verificationSuccess: "✅ تم التحقق بنجاح!",
    verificationFail: "❌ تم رفض طلب التحقق.",
    forcedSubscriptionGrouped: "📢 <b>يجب عليك الاشتراك في القنوات التالية:</b>",
    forcedSubscriptionSeparate: "🔗 <b>{name}</b>\n\n{message}",
    searchPrompt: "🔍 أرسل رقم المحتوى المكون من 5 أرقام:",
    contactMessage: "📞 <b>للتواصل معنا:</b>\n\nيمكنك التواصل مع الإدارة مباشرة.",
    notVerified: "🔐 يجب إكمال التحقق أولاً.",
    notSubscribed: "❌ لم تكمل جميع الاشتراكات!",
    contentNotFound: "❌ لم يتم العثور على محتوى بالرقم <code>{id}</code>.",
    contentIdInvalid: "❌ رقم المحتوى يجب أن يكون 5 أرقام بالضبط.\nمثال: <code>10001</code>",
    unknownCommand: "❓ أمر غير معروف. أرسل /start للبدء.",
    botStopped: "⏸️ البوت متوقف حالياً. يرجى المحاولة لاحقاً.",
    bannedUser: "🚫 أنت محظور من استخدام هذا البوت.",
    accessDenied: "⚠️ هذا الإجراء للأدمن فقط",
  },
  stats: { totalMessages: 0, totalCommands: 0, dailyActive: {} },
};

let data = {};
const adminState = {};
const spamTracker = {};

async function loadData(env) {
  try {
    const stored = await env.KV_NAMESPACE.get("bot_data", "json");
    if (stored) { data = deepMerge(JSON.parse(JSON.stringify(DEFAULT_DATA)), stored); console.log("✅ Data loaded from KV"); }
    else { data = JSON.parse(JSON.stringify(DEFAULT_DATA)); await saveData(env); console.log("✅ Default data saved to KV"); }
  } catch (e) { console.error("Error loading data:", e); data = JSON.parse(JSON.stringify(DEFAULT_DATA)); }
}

async function saveData(env) {
  try { await env.KV_NAMESPACE.put("bot_data", JSON.stringify(data)); } catch (e) { console.error("Error saving data:", e); }
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else { result[key] = source[key]; }
  }
  return result;
}

async function telegramRequest(method, token, payload) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return await res.json();
  } catch (e) { console.error(`${method} error:`, e); return { ok: false, description: e.message }; }
}

async function telegramUploadVideoFile(chatId, videoBlob, caption, token, extra, width, height) {
  const url = `https://api.telegram.org/bot${token}/sendVideo`;
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("parse_mode", "HTML");
  form.append("caption", caption || "");
  form.append("video", videoBlob, "video.mp4");
  form.append("supports_streaming", "true");
  if (width) form.append("width", String(width));
  if (height) form.append("height", String(height));
  if (extra?.reply_markup) form.append("reply_markup", JSON.stringify(extra.reply_markup));
  if (data.protection.enabled && !extra?.bypass_protection) form.append("protect_content", "true");
  try { const res = await fetch(url, { method: "POST", body: form }); return await res.json(); } catch (e) { console.error("telegramUploadVideoFile error:", e); return { ok: false, description: e.message }; }
}

function isTwitterUrl(text) { return /https?:\/\/(www\.)?(twitter\.com|x\.com)\/[^/]+\/status\/\d+/i.test(text.trim()); }

async function fetchTwitterVideoInfo(tweetUrl) {
  try {
    const match = tweetUrl.trim().match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i);
    if (!match) return null;
    const tweetId = match[1];
    const res = await fetch(`https://api.vxtwitter.com/Twitter/status/${tweetId}`, { headers: { "User-Agent": "TelegramBot/1.0" } });
    if (!res.ok) return null;
    const json = await res.json();
    const extended = json.media_extended || [];
    const mediaUrls = json.mediaURLs || [];
    const videoItem = extended.filter((m) => m.type === "video").pop();
    if (videoItem?.url) { return { url: videoItem.url, width: videoItem.size?.width || videoItem.width || null, height: videoItem.size?.height || videoItem.height || null }; }
    const fallbackUrl = mediaUrls.find((u) => u.includes(".mp4") || u.includes("video"));
    return fallbackUrl ? { url: fallbackUrl, width: null, height: null } : null;
  } catch (e) { console.error("fetchTwitterVideoInfo error:", e); return null; }
}

async function sendTwitterVideo(chatId, tweetUrl, caption, token, extra) {
  const info = await fetchTwitterVideoInfo(tweetUrl);
  if (!info) return null;
  const r1 = await sendVideo(chatId, info.url, caption, token, extra);
  const fid1 = r1?.result?.video?.file_id;
  if (r1?.ok && fid1) return { fileId: fid1, partType: "video" };
  try {
    const videoRes = await fetch(info.url, { headers: { "User-Agent": "TelegramBot/1.0" } });
    if (!videoRes.ok) return null;
    const blob = await videoRes.blob();
    const r2 = await telegramUploadVideoFile(chatId, blob, caption, token, extra, info.width, info.height);
    const fid2 = r2?.result?.video?.file_id;
    if (r2?.ok && fid2) return { fileId: fid2, partType: "video" };
  } catch (e) { console.error("sendTwitterVideo download error:", e); }
  return null;
}

function getCountryFromPhone(phone) {
  if (!phone) return { flag: "🌍", name: "غير محدد" };
  const p = String(phone).replace(/\D/g, "");
  const prefixes = [
    { prefix: "9665", flag: "🇸🇦", name: "السعودية" }, { prefix: "9714", flag: "🇦🇪", name: "الإمارات" },
    { prefix: "9715", flag: "🇦🇪", name: "الإمارات" }, { prefix: "966", flag: "🇸🇦", name: "السعودية" },
    { prefix: "971", flag: "🇦🇪", name: "الإمارات" }, { prefix: "965", flag: "🇰🇼", name: "الكويت" },
    { prefix: "974", flag: "🇶🇦", name: "قطر" }, { prefix: "973", flag: "🇧🇭", name: "البحرين" },
    { prefix: "968", flag: "🇴🇲", name: "عُمان" }, { prefix: "967", flag: "🇾🇪", name: "اليمن" },
    { prefix: "962", flag: "🇯🇴", name: "الأردن" }, { prefix: "961", flag: "🇱🇧", name: "لبنان" },
    { prefix: "963", flag: "🇸🇾", name: "سوريا" }, { prefix: "964", flag: "🇮🇶", name: "العراق" },
    { prefix: "972", flag: "🇵🇸", name: "فلسطين" }, { prefix: "970", flag: "🇵🇸", name: "فلسطين" },
    { prefix: "20", flag: "🇪🇬", name: "مصر" }, { prefix: "212", flag: "🇲🇦", name: "المغرب" },
    { prefix: "213", flag: "🇩🇿", name: "الجزائر" }, { prefix: "216", flag: "🇹🇳", name: "تونس" },
    { prefix: "218", flag: "🇱🇾", name: "ليبيا" }, { prefix: "249", flag: "🇸🇩", name: "السودان" },
    { prefix: "252", flag: "🇸🇴", name: "الصومال" }, { prefix: "222", flag: "🇲🇷", name: "موريتانيا" },
    { prefix: "253", flag: "🇩🇯", name: "جيبوتي" }, { prefix: "269", flag: "🇰🇲", name: "جزر القمر" },
    { prefix: "1", flag: "🇺🇸", name: "أمريكا" }, { prefix: "44", flag: "🇬🇧", name: "بريطانيا" },
    { prefix: "33", flag: "🇫🇷", name: "فرنسا" }, { prefix: "49", flag: "🇩🇪", name: "ألمانيا" },
    { prefix: "39", flag: "🇮🇹", name: "إيطاليا" }, { prefix: "34", flag: "🇪🇸", name: "إسبانيا" },
    { prefix: "90", flag: "🇹🇷", name: "تركيا" }, { prefix: "98", flag: "🇮🇷", name: "إيران" },
    { prefix: "92", flag: "🇵🇰", name: "باكستان" }, { prefix: "91", flag: "🇮🇳", name: "الهند" },
    { prefix: "7", flag: "🇷🇺", name: "روسيا" }, { prefix: "86", flag: "🇨🇳", name: "الصين" },
    { prefix: "55", flag: "🇧🇷", name: "البرازيل" }, { prefix: "62", flag: "🇮🇩", name: "إندونيسيا" },
    { prefix: "60", flag: "🇲🇾", name: "ماليزيا" }, { prefix: "234", flag: "🇳🇬", name: "نيجيريا" },
    { prefix: "251", flag: "🇪🇹", name: "إثيوبيا" }, { prefix: "254", flag: "🇰🇪", name: "كينيا" },
    { prefix: "27", flag: "🇿🇦", name: "جنوب أفريقيا" }, { prefix: "61", flag: "🇦🇺", name: "أستراليا" },
    { prefix: "81", flag: "🇯🇵", name: "اليابان" }, { prefix: "82", flag: "🇰🇷", name: "كوريا الجنوبية" },
  ];
  prefixes.sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { prefix, flag, name } of prefixes) { if (p.startsWith(prefix)) return { flag, name }; }
  return { flag: "🌍", name: "غير معروف" };
}

function buildBasePayload(chatId, extra) {
  const payload = { chat_id: chatId, parse_mode: "HTML", ...(data.protection.enabled && !extra?.bypass_protection ? { protect_content: true } : {}) };
  if (extra) { const { bypass_protection, ...rest } = extra; Object.assign(payload, rest); }
  return payload;
}

async function sendMessage(chatId, text, token, extra) {
  const payload = buildBasePayload(chatId, extra);
  payload.text = text;
  if (!payload.reply_markup) payload.reply_markup = { remove_keyboard: true };
  return await telegramRequest("sendMessage", token, payload);
}

async function sendPhoto(chatId, fileId, caption, token, extra) {
  const payload = buildBasePayload(chatId, extra);
  payload.photo = fileId;
  payload.caption = caption || "";
  if (!payload.reply_markup) payload.reply_markup = { remove_keyboard: true };
  return await telegramRequest("sendPhoto", token, payload);
}

async function sendVideo(chatId, fileId, caption, token, extra) {
  const payload = buildBasePayload(chatId, extra);
  payload.video = fileId;
  payload.caption = caption || "";
  if (!payload.reply_markup) payload.reply_markup = { remove_keyboard: true };
  return await telegramRequest("sendVideo", token, payload);
}

async function sendDocument(chatId, fileId, caption, token, extra) {
  const payload = buildBasePayload(chatId, extra);
  payload.document = fileId;
  payload.caption = caption || "";
  if (!payload.reply_markup) payload.reply_markup = { remove_keyboard: true };
  return await telegramRequest("sendDocument", token, payload);
}

async function sendAnimation(chatId, fileId, caption, token, extra) {
  const payload = buildBasePayload(chatId, extra);
  payload.animation = fileId;
  payload.caption = caption || "";
  if (!payload.reply_markup) payload.reply_markup = { remove_keyboard: true };
  return await telegramRequest("sendAnimation", token, payload);
}

async function sendMedia(chatId, mediaType, fileId, caption, token, extra) {
  if (!mediaType || !fileId) return sendMessage(chatId, caption, token, extra);
  switch (mediaType) {
    case "photo": return sendPhoto(chatId, fileId, caption, token, extra);
    case "video": return sendVideo(chatId, fileId, caption, token, extra);
    case "document": return sendDocument(chatId, fileId, caption, token, extra);
    case "animation": return sendAnimation(chatId, fileId, caption, token, extra);
    default: return sendMessage(chatId, caption, token, extra);
  }
}

async function editMessage(chatId, msgId, text, token, extra) {
  const payload = { chat_id: chatId, message_id: msgId, text, parse_mode: "HTML" };
  if (extra) Object.assign(payload, extra);
  return await telegramRequest("editMessageText", token, payload);
}

async function editMessageReplyMarkup(chatId, msgId, token, replyMarkup) {
  const payload = { chat_id: chatId, message_id: msgId, reply_markup: replyMarkup };
  return await telegramRequest("editMessageReplyMarkup", token, payload);
}

async function answerCallback(cbId, text, token, showAlert = false) {
  await telegramRequest("answerCallbackQuery", token, { callback_query_id: cbId, text: text || "✅", show_alert: showAlert });
}

async function getChatInfo(chatId, token) {
  const result = await telegramRequest("getChat", token, { chat_id: chatId });
  if (result.ok && result.result) { return { name: result.result.title || result.result.username || chatId, type: result.result.type }; }
  return null;
}

async function getChatMember(chatId, userId, token) {
  const result = await telegramRequest("getChatMember", token, { chat_id: chatId, user_id: userId });
  return result.ok ? result.result : null;
}

async function updateBotCommands(token) {
  const commands = [{ command: "start", description: "بدء استخدام البوت" }];
  const keys = Object.keys(data.commands || {});
  keys.forEach((k) => { if (data.commands[k].enabled) { commands.push({ command: k, description: data.commands[k].description || "أمر مخصص" }); } });
  await telegramRequest("setMyCommands", token, { commands });
}

// ====================================================================
// ========== دوال التسجيل (Logs) ==========
// ====================================================================

let logChannelId = null, logEnabled = false, logAllActions = true;
function setLogChannel(channelId) { logChannelId = channelId; }
function setLogEnabled(enabled) { logEnabled = enabled; }
function setLogAllActions(enabled) { logAllActions = enabled; }

async function sendLog(userId, username, name, action, details, token, force = false) {
  if (!logEnabled || !logChannelId) return;
  if (!logAllActions && !force) return;
  const now = new Date();
  const date = now.toLocaleDateString("ar-EG");
  const time = now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const message = `📋 <b>سجل الإجراءات</b>\n\n👤 <b>الاسم:</b> ${name || "غير معروف"}\n🆔 <b>اليوزرنيم:</b> @${username || "لا يوجد"}\n🔢 <b>المعرف:</b> <code>${userId}</code>\n\n⚡ <b>الإجراء:</b> ${action}\n📝 <b>التفاصيل:</b> ${details}\n\n📅 <b>التاريخ:</b> ${date}\n🕐 <b>الوقت:</b> ${time}\n─────────────────`;
  try { await telegramRequest("sendMessage", token, { chat_id: logChannelId, text: message, parse_mode: "HTML" }); } catch (e) { console.error("Log error:", e); }
}
// ====================================================================
// ========== نظام مكافحة السبام ==========
// ====================================================================

function checkAntiSpam(userId) {
  const settings = data.settings.antiSpam;
  if (!settings.enabled) return { spam: false };
  if (!spamTracker[userId]) { spamTracker[userId] = { count: 1, firstTime: Date.now() }; return { spam: false }; }
  const tracker = spamTracker[userId];
  const elapsed = (Date.now() - tracker.firstTime) / 1000;
  if (elapsed > settings.interval) { spamTracker[userId] = { count: 1, firstTime: Date.now() }; return { spam: false }; }
  tracker.count++;
  if (tracker.count > settings.maxMessages) { return { spam: true, action: settings.action }; }
  return { spam: false };
}

// ====================================================================
// ========== دوال الاشتراك الإجباري ==========
// ====================================================================

async function checkForcedSubscription(userId, token) {
  const fs = data.forcedSubscription;
  if (!fs.enabled || !fs.list || fs.list.length === 0) return true;
  const activeSubs = fs.list.filter((s) => s.enabled !== false);
  if (activeSubs.length === 0) return true;
  let allSubscribed = true;
  for (const sub of activeSubs) {
    const subscribed = await checkSingleSubscription(userId, sub, token);
    if (!subscribed) { allSubscribed = false; break; }
  }
  if (allSubscribed) {
    if (!fs.userStatus) fs.userStatus = {};
    fs.userStatus[userId] = { completed: true, timestamp: Date.now() };
    return true;
  }
  if (fs.userStatus && fs.userStatus[userId]) { delete fs.userStatus[userId]; }
  return false;
}

async function checkSingleSubscription(userId, sub, token) {
  try {
    if (sub.type === "channel" || sub.type === "channel_private" || sub.type === "group" || sub.type === "group_private") {
      const target = sub.telegramId || sub.link;
      if (!target) return false;
      const member = await getChatMember(target, userId, token);
      return (member && ["member", "administrator", "creator"].includes(member.status)) || (member?.status === "restricted" && !member.is_member === false);
    } else if (sub.type === "bot") {
      const target = sub.telegramId || sub.link;
      if (!target) return false;
      const member = await getChatMember(target, userId, token);
      return member && ["member", "administrator", "creator", "restricted"].includes(member.status);
    } else if (sub.type === "link") {
      const status = fs_getUserLinkStatus(userId, sub.id);
      return status && status.completed && Date.now() - status.timestamp < 86400000;
    }
    return true;
  } catch (e) { console.error("Error checking subscription:", e); return false; }
}

function fs_getUserLinkStatus(userId, linkId) {
  const fs = data.forcedSubscription;
  if (!fs.userStatus || !fs.userStatus[userId] || !fs.userStatus[userId].links) return null;
  return fs.userStatus[userId].links[linkId] || null;
}

function getForcedSubscriptionKeyboard(userId) {
  const fs = data.forcedSubscription;
  const activeSubs = fs.list.filter((s) => s.enabled !== false);
  if (activeSubs.length === 0) return null;
  const buttons = [];
  for (const sub of activeSubs) {
    let label = sub.name || sub.type;
    if (sub.type === "channel" || sub.type === "channel_private") label = "📢 " + label;
    else if (sub.type === "group" || sub.type === "group_private") label = "👥 " + label;
    else if (sub.type === "bot") label = "🤖 " + label;
    else if (sub.type === "link") label = "🔗 " + label;
    buttons.push([{ text: label, url: sub.link || "https://t.me/" }]);
  }
  buttons.push([{ text: fs.settings.verifyButtonText || "تحقق ✅", callback_data: "check_subscription" }]);
  return { inline_keyboard: buttons };
}

async function showForcedSubscription(chatId, userId, token) {
  const fs = data.forcedSubscription;
  const activeSubs = fs.list.filter((s) => s.enabled !== false);
  if (activeSubs.length === 0) return;
  if (fs.settings.displayMode === "separate") {
    for (const sub of activeSubs) {
      const subscribed = await checkSingleSubscription(userId, sub, token);
      if (!subscribed) {
        let text = data.texts.forcedSubscriptionSeparate || "🔗 <b>{name}</b>\n\n{message}";
        text = text.replace(/{name}/g, sub.name || sub.type).replace(/{message}/g, sub.message || "");
        if (sub.type === "link") {
          text += '\n🔗 <a href="' + sub.link + '">اضغط هنا للدخول</a>\n⏳ بعد الدخول انتظر 3 ثوانٍ ثم اضغط "تم".';
          const kb = { inline_keyboard: [[{ text: "✅ تم", callback_data: "fs_link_done_" + sub.id }], [{ text: "🔄 التحقق", callback_data: "check_subscription" }]] };
          await sendMessage(chatId, text, token, { reply_markup: kb });
        } else {
          if (sub.link) text += '\n🔗 <a href="' + sub.link + '">الاشتراك</a>';
          text += '\n📌 بعد الاشتراك، اضغط "تحقق ✅"';
          const kb = { inline_keyboard: [[{ text: "✅ تحقق", callback_data: "check_subscription" }]] };
          await sendMessage(chatId, text, token, { reply_markup: kb });
        }
        return;
      }
    }
  } else {
    const text = data.texts.forcedSubscriptionGrouped || "📢 <b>يجب عليك الاشتراك في القنوات التالية:</b>";
    const keyboard = getForcedSubscriptionKeyboard(userId);
    await sendMessage(chatId, text, token, keyboard ? { reply_markup: keyboard } : {});
  }
}

// ====================================================================
// ========== دوال مساعدة عامة ==========
// ====================================================================

function isAdmin(userId, env) {
  const ADMIN = String(env.ADMIN_ID);
  const extraAdmins = data.settings.admins || [];
  return userId === ADMIN || extraAdmins.includes(userId);
}

function getAdminState(userId) {
  if (!adminState[userId]) adminState[userId] = { action: null, step: null, temp: {} };
  return adminState[userId];
}

function clearAdminState(userId) { adminState[userId] = { action: null, step: null, temp: {} }; }

function formatDate(d) {
  if (!d) return "غير معروف";
  try { return new Date(d).toLocaleString("ar-EG"); } catch { return d; }
}

function getTodayKey() { return new Date().toISOString().split("T")[0]; }

function recordActivity(userId) {
  const key = getTodayKey();
  if (!data.stats) data.stats = { totalMessages: 0, totalCommands: 0, dailyActive: {} };
  if (!data.stats.dailyActive) data.stats.dailyActive = {};
  if (!data.stats.dailyActive[key]) data.stats.dailyActive[key] = new Set();
  if (!data.stats.dailyActive[key][userId]) { data.stats.dailyActive[key][userId] = true; }
  data.stats.totalMessages = (data.stats.totalMessages || 0) + 1;
}

async function checkUserPermissions(userId, chatId, token, env) {
  if (isAdmin(userId, env)) return true;
  if (data.verification.enabled && !data.verification.verifiedUsers?.[userId]) {
    const kb = { inline_keyboard: [[{ text: "▶️ بدء التحقق", callback_data: "start_use" }]] };
    await sendMessage(chatId, data.texts.notVerified || "🔐 يجب إكمال التحقق أولاً.", token, { reply_markup: kb });
    return false;
  }
  const fsOk = await checkForcedSubscription(userId, token);
  if (!fsOk) { await showForcedSubscription(chatId, userId, token); return false; }
  return true;
}

// ===== دالة إنشاء لوحة المفاتيح الرئيسية (keyboard) =====
function getUserKeyboard() {
  const buttons = data.buttons?.items || [];
  const rows = [];
  // الأزرار الافتراضية
  rows.push([{ text: "🔍 البحث عن محتوى" }, { text: "📞 تواصل معنا" }]);
  // الأزرار المخصصة
  for (const btn of buttons) {
    rows.push([{ text: btn.label }]);
  }
  return {
    keyboard: rows,
    resize_keyboard: true,
    persistent: true,
  };
}

function generateContentId() {
  if (!data.content) data.content = { items: {}, nextId: 10000 };
  const id = String(data.content.nextId || 10000).padStart(5, "0");
  data.content.nextId = (data.content.nextId || 10000) + 1;
  return id;
}

function getWelcomeForUser(isNewUser, isPending, isVerified, isRejected) {
  if (data.verification.enabled && !isVerified && !isPending && !isRejected) {
    return {
      text: data.texts.notVerified || "🔐 يجب إكمال التحقق أولاً.",
      mediaType: null,
      mediaFileId: null,
      buttons: [[{ text: "▶️ بدء التحقق", callback_data: "start_use" }]],
      userKeyboard: null,
    };
  }
  if (isRejected) return {
    text: data.texts.verificationFail || "❌ تم رفض طلب التحقق.",
    mediaType: null, mediaFileId: null, buttons: null, userKeyboard: null,
  };
  if (isPending) return {
    text: "⏳ <b>طلبك قيد المراجعة.</b>\n\nيرجى الانتظار حتى يتم التحقق من طلبك.",
    mediaType: null, mediaFileId: null, buttons: null, userKeyboard: null,
  };
  if (isVerified || !data.verification.enabled) {
    const text = data.texts.welcomeRegistered || "📦 <b>مرحباً بعودتك!</b>";
    return { text, mediaType: null, mediaFileId: null, buttons: null, userKeyboard: getUserKeyboard() };
  }
  const text = data.texts.welcomeNew || "🎉 <b>مرحباً بك في البوت!</b>\n\nيمكنك استخدام البوت للوصول إلى المحتوى.";
  return { text, mediaType: data.welcome.mediaType, mediaFileId: data.welcome.mediaFileId, buttons: [[{ text: "▶️ بدء الاستخدام", callback_data: "start_use" }]], userKeyboard: null };
}

// ====================================================================
// ========== دوال إدارة الأزرار والنصوص ==========
// ====================================================================

function buttonsMenu() {
  const items = data.buttons?.items || [];
  const count = items.length;
  let listText = "لا توجد أزرار مخصصة.";
  if (count > 0) { listText = items.map((b, i) => `${i+1}. <b>${b.label}</b> — <code>${b.url}</code>`).join("\n"); }
  return {
    text: `🔘 <b>إدارة الأزرار</b>\n\n📌 عدد الأزرار: ${count}\n\n━━━ <b>قائمة الأزرار</b> ━━━\n${listText}\n\n🔹 اختر الإجراء:`,
    keyboard: { inline_keyboard: [
      [{ text: "➕ إضافة زر", callback_data: "btn_add" }],
      [{ text: "✏️ تعديل زر", callback_data: "btn_edit" }],
      [{ text: "🗑️ حذف زر", callback_data: "btn_delete" }],
      [{ text: "🔙 رجوع", callback_data: "admin_back" }],
    ]},
  };
}

function textsManagementMenu() {
  const t = data.texts || {};
  const keys = Object.keys(t);
  let listText = keys.length === 0 ? "لا توجد نصوص مخصصة." : keys.map(k => `• <b>${k}</b>: ${t[k].substring(0, 40)}...`).join("\n");
  return {
    text: `✏️ <b>إدارة النصوص المخصصة</b>\n\n📌 عدد النصوص: ${keys.length}\n\n━━━ <b>قائمة النصوص</b> ━━━\n${listText}\n\n🔹 لتعديل أي نص، استخدم الأمر:\n<code>/edit_text [المفتاح] [النص الجديد]</code>\n\nمثال:\n<code>/edit_text welcomeNew أهلاً بك في البوت!</code>`,
    keyboard: {
      inline_keyboard: [
        [{ text: "🔙 رجوع", callback_data: "admin_back" }]
      ]
    }
  };
}

function generateButtonId() { return 'btn_' + Date.now().toString(36); }

// ====================================================================
// ========== دوال المحتوى والنشر ==========
// ====================================================================

function buildPublishKeyboard(item, botUsername) {
  const bot = botUsername || "niswangybot";
  return { inline_keyboard: [[{ text: "📥 فتح المحتوى", url: `https://t.me/${bot}?start=share_${item.id}` }]] };
}

function buildPublishText(item, botUsername) {
  const bot = botUsername || "niswangybot";
  return `📌 ${item.title}\n\n🔐 المقطع كامل على @${bot}\nادخل للبوت ثم اضغط زر 🔍 البحث واكتب:\n( ${item.id} )\n\nأو ادخل مباشرةً 👇\nhttps://t.me/${bot}?start=share_${item.id}`;
}

async function deliverContent(chatId, contentId, token) {
  const item = data.content?.items?.[contentId];
  if (!item || !item.parts || item.parts.length === 0) {
    const msg = (data.texts.contentNotFound || "❌ لم يتم العثور على محتوى بالرقم <code>{id}</code>.").replace(/{id}/g, contentId);
    await sendMessage(chatId, msg, token, { reply_markup: getUserKeyboard() });
    return false;
  }
  const kb = { reply_markup: getUserKeyboard() };
  await sendMessage(chatId, `<b>${item.title}</b>\n\nرقم المحتوى:\n<code>${item.id}</code>`, token, kb);
  for (let i = 0; i < item.parts.length; i++) {
    const part = item.parts[i];
    const extra = kb;
    if (part.type === "text") { await sendMessage(chatId, part.content, token, extra); }
    else if (part.type === "photo") { await sendPhoto(chatId, part.fileId, part.caption || "", token, extra); }
    else if (part.type === "video") { await sendVideo(chatId, part.fileId, part.caption || "", token, extra); }
    else if (part.type === "document") { await sendDocument(chatId, part.fileId, part.caption || "", token, extra); }
    if (i < item.parts.length - 1) await new Promise((r) => setTimeout(r, 400));
  }
  return true;
}
// ====================================================================
// ========== قوائم الأدمن ==========
// ====================================================================

function adminMenu() {
  const contentCount = Object.keys(data.content?.items || {}).length;
  const usersCount = Object.keys(data.users || {}).length;
  const pendingCount = Object.keys(data.verification.pendingUsers || {}).length;
  const pendingBadge = pendingCount > 0 ? ` 🔴${pendingCount}` : "";
  return {
    text: `╔══════════════════════╗\n     🛡️ <b>لوحة التحكم</b>\n╚══════════════════════╝\n\n👤 المستخدمون: <b>${usersCount}</b>   📁 المحتوى: <b>${contentCount}</b>\n⏳ طلبات معلقة: <b>${pendingCount}</b>\n\n<i>اختر القسم المطلوب 👇</i>`,
    keyboard: { inline_keyboard: [
      [{ text: "⚙️ الإعدادات", callback_data: "admin_settings" }, { text: "📊 الإحصائيات", callback_data: "admin_stats" }],
      [{ text: "✏️ رسالة الترحيب", callback_data: "admin_welcome" }, { text: "📋 الأوامر", callback_data: "admin_commands" }],
      [{ text: `👥 المستخدمون (${usersCount})`, callback_data: "admin_users" }, { text: "🚫 المحظورون", callback_data: "admin_banned" }],
      [{ text: "📢 رسالة جماعية", callback_data: "admin_broadcast" }, { text: "📨 رسالة مباشرة", callback_data: "admin_direct_msg" }],
      [{ text: "🔗 الاشتراك الإجباري", callback_data: "admin_forced_subscription" }],
      [{ text: `📁 إدارة المحتوى (${contentCount})`, callback_data: "admin_content" }],
      [{ text: `✅ طلبات التحقق${pendingBadge}`, callback_data: "settings_verification" }],
      [{ text: "👮 الأدمنات", callback_data: "admin_admins" }, { text: "💾 نسخ احتياطي", callback_data: "admin_backup" }],
      [{ text: "🔘 إدارة الأزرار", callback_data: "admin_buttons" }],
      [{ text: "✏️ إدارة النصوص", callback_data: "admin_texts" }],
    ]},
  };
}

function settingsMenu() {
  const botStatus = data.settings.botActive ? "🟢 يعمل" : "🔴 متوقف";
  const verStatus = data.verification.enabled ? "🟢 نشط" : "🔴 متوقف";
  const verChannel = data.verification.channelName || data.verification.channelId || "غير محدد";
  const protectStatus = data.protection.enabled ? "🔒 مفعل" : "🔓 معطل";
  const notifStatus = data.notifications.enabled ? "🔔 مفعل" : "🔕 معطل";
  const notifChannel = data.notifications.channelName || data.notifications.channelId || "غير محدد";
  const fsStatus = data.forcedSubscription.enabled ? "🟢 مفعل" : "🔴 معطل";
  const spamStatus = data.settings.antiSpam?.enabled ? "🟢 مفعل" : "🔴 معطل";
  const logAll = data.notifications.logAllActions !== false ? "🟢 مفعل" : "🔴 معطل";
  return {
    text: `⚙️ <b>الإعدادات</b>\n\n🤖 <b>حالة البوت:</b> ${botStatus}\n✅ <b>التحقق:</b> ${verStatus}  |  📢 ${verChannel}\n🔒 <b>الحماية:</b> ${protectStatus}\n🔔 <b>الإشعارات:</b> ${notifStatus}  |  📢 ${notifChannel}\n📋 <b>تسجيل جميع الإجراءات:</b> ${logAll}\n🔗 <b>الاشتراك الإجباري:</b> ${fsStatus}\n🛡️ <b>مكافحة السبام:</b> ${spamStatus}\n\n🔹 اختر القسم:`,
    keyboard: { inline_keyboard: [
      [{ text: "🤖 حالة البوت", callback_data: "settings_bot_toggle" }],
      [{ text: "✅ التحقق من العضوية", callback_data: "settings_verification" }],
      [{ text: "🔒 حماية المحتوى", callback_data: "settings_protection" }],
      [{ text: "🔔 الإشعارات", callback_data: "settings_notifications" }],
      [{ text: "🔗 الاشتراك الإجباري", callback_data: "settings_forced_subscription" }],
      [{ text: "🛡️ مكافحة السبام", callback_data: "settings_antispam" }],
      [{ text: "🔙 رجوع", callback_data: "admin_back" }],
    ]},
  };
}

function statsMenu() {
  const users = Object.keys(data.users || {});
  const banned = Object.keys(data.bannedUsers || {});
  const verified = Object.keys(data.verification.verifiedUsers || {});
  const pending = Object.keys(data.verification.pendingUsers || {});
  const rejected = Object.keys(data.verification.rejectedUsers || {});
  const cmds = Object.keys(data.commands || {});
  const fsList = data.forcedSubscription.list || [];
  const fsCompleted = Object.values(data.forcedSubscription.userStatus || {}).filter((s) => s.completed).length;
  const todayKey = getTodayKey();
  const todayActive = data.stats?.dailyActive?.[todayKey] ? Object.keys(data.stats.dailyActive[todayKey]).length : 0;
  const totalMsgs = data.stats?.totalMessages || 0;
  const broadcastHistory = data.broadcast?.history || [];
  const contentItems = Object.values(data.content?.items || {});
  const publishedContent = contentItems.filter((i) => i.status === "published").length;
  const verifRate = users.length > 0 ? Math.round((verified.length / users.length) * 100) : 0;
  return {
    text: `📊 <b>إحصائيات البوت</b>\n━━━━━━━━━━━━━━━━━━━━\n\n👥 <b>المستخدمون</b>\n├ الإجمالي:    <b>${users.length}</b>\n├ نشطون اليوم: <b>${todayActive}</b>\n└ محظورون:     <b>${banned.length}</b>\n\n🔐 <b>التحقق</b>  <i>(${verifRate}% من الكل)</i>\n├ محققون:   <b>${verified.length}</b>\n├ معلقون:   <b>${pending.length}</b>\n└ مرفوضون: <b>${rejected.length}</b>\n\n🔗 <b>الاشتراك الإجباري</b>\n├ القنوات: <b>${fsList.length}</b>\n└ أكملوا:  <b>${fsCompleted}</b>\n\n📁 <b>المحتوى</b>\n├ الإجمالي: <b>${contentItems.length}</b>\n└ منشور:    <b>${publishedContent}</b>\n\n📋 <b>الأوامر:</b> ${cmds.length}   📢 <b>البث:</b> ${broadcastHistory.length}\n📩 <b>إجمالي الرسائل:</b> ${totalMsgs}`,
    keyboard: { inline_keyboard: [[{ text: "📈 إحصائيات يومية", callback_data: "stats_daily" }], [{ text: "🔙 رجوع", callback_data: "admin_back" }]] },
  };
}

function botSettingsMenu() {
  const status = data.settings.botActive ? "🟢 يعمل" : "🔴 متوقف";
  return {
    text: `🤖 <b>حالة البوت</b>\n\n📌 الحالية: ${status}\n\n<b>رسالة الإيقاف:</b>\n${data.settings.stopMessage}`,
    keyboard: { inline_keyboard: [
      [{ text: `${status} — اضغط للتغيير`, callback_data: "bot_toggle" }],
      [{ text: "✏️ تعديل رسالة الإيقاف", callback_data: "bot_edit_stop" }],
      [{ text: "🔙 رجوع", callback_data: "settings_back" }],
    ]},
  };
}

function verificationMenu() {
  const v = data.verification;
  const status = v.enabled ? "🟢 نشط" : "🔴 متوقف";
  const channel = v.channelName || v.channelId || "غير محدد";
  const pending = Object.keys(v.pendingUsers || {}).length;
  return {
    text: `✅ <b>التحقق من العضوية</b>\n\n📌 الحالة: ${status}\n📢 قناة التحقق: ${channel}\n⏳ طلبات معلقة: ${pending}\n\n🔹 اختر الإجراء:`,
    keyboard: { inline_keyboard: [
      [{ text: "🔄 " + (v.enabled ? "تعطيل" : "تفعيل") + " التحقق", callback_data: "verif_toggle" }],
      [{ text: "⏳ الطلبات المعلقة (" + pending + ")", callback_data: "verif_pending" }],
      [{ text: "✏️ رسائل التحقق", callback_data: "verif_messages" }],
      [{ text: "📢 تعيين قناة التحقق", callback_data: "verif_channel" }],
      [{ text: "📋 قائمة التحقق", callback_data: "verif_list" }],
      [{ text: "🔙 رجوع", callback_data: "settings_back" }],
    ]},
  };
}

function verificationMessagesMenu() {
  const v = data.verification;
  return {
    text: `✏️ <b>رسائل التحقق</b>\n\n📝 <b>طلب الرقم:</b>\n${v.requestMessage}\n\n🔘 <b>زر المشاركة:</b>\n${v.buttonText}\n\n✅ <b>رسالة النجاح:</b>\n${v.successMessage}\n\n❌ <b>رسالة الرفض:</b>\n${v.failMessage}`,
    keyboard: { inline_keyboard: [
      [{ text: "✏️ نص طلب الرقم", callback_data: "verif_msg_request" }],
      [{ text: "✏️ نص زر المشاركة", callback_data: "verif_msg_button" }],
      [{ text: "✏️ رسالة النجاح", callback_data: "verif_msg_success" }],
      [{ text: "✏️ رسالة الرفض", callback_data: "verif_msg_fail" }],
      [{ text: "🔙 رجوع", callback_data: "verif_back" }],
    ]},
  };
}

function verificationListMenu() {
  const v = data.verification;
  const verified = Object.keys(v.verifiedUsers || {});
  const rejected = Object.keys(v.rejectedUsers || {});
  return {
    text: `📋 <b>قائمة التحقق</b>\n\n✅ المحققون: ${verified.length}\n❌ المرفوضون: ${rejected.length}`,
    keyboard: { inline_keyboard: [
      [{ text: `✅ المحققون (${verified.length})`, callback_data: "verif_list_verified" }],
      [{ text: `❌ المرفوضون (${rejected.length})`, callback_data: "verif_list_rejected" }],
      [{ text: "➕ إضافة مستخدم", callback_data: "verif_add_user" }],
      [{ text: "🗑️ حذف مستخدم", callback_data: "verif_remove_user" }],
      [{ text: "🔙 رجوع", callback_data: "verif_back" }],
    ]},
  };
}

function protectionMenu() {
  const status = data.protection.enabled ? "🔒 مفعلة" : "🔓 معطلة";
  return {
    text: `🔒 <b>حماية المحتوى</b>\n\n📌 الحالية: ${status}\n\nعند التفعيل، يمنع المستخدمين من نسخ النصوص، حفظ الصور والفيديوهات، وتوجيه الرسائل.`,
    keyboard: { inline_keyboard: [
      [{ text: "🔄 " + (data.protection.enabled ? "تعطيل" : "تفعيل") + " الحماية", callback_data: "protect_toggle" }],
      [{ text: "🔙 رجوع", callback_data: "settings_back" }],
    ]},
  };
}

function notificationsMenu() {
  const status = data.notifications.enabled ? "🔔 مفعل" : "🔕 معطل";
  const channel = data.notifications.channelName || data.notifications.channelId || "غير محدد";
  const logAll = data.notifications.logAllActions !== false ? "🟢 مفعل" : "🔴 معطل";
  return {
    text: `🔔 <b>الإشعارات</b>\n\n📌 الحالة: ${status}\n📢 القناة: ${channel}\n📋 تسجيل جميع الإجراءات: ${logAll}\n\nعند التفعيل، ستصل جميع إجراءات المستخدمين إلى القناة المحددة.`,
    keyboard: { inline_keyboard: [
      [{ text: "🔄 " + (data.notifications.enabled ? "تعطيل" : "تفعيل") + " الإشعارات", callback_data: "notif_toggle" }],
      [{ text: "📢 تعيين قناة", callback_data: "notif_channel" }],
      [{ text: "📋 " + (data.notifications.logAllActions !== false ? "تعطيل" : "تفعيل") + " تسجيل الكل", callback_data: "notif_toggle_logall" }],
      [{ text: "🔙 رجوع", callback_data: "settings_back" }],
    ]},
  };
}

function antiSpamMenu() {
  const as = data.settings.antiSpam || {};
  const status = as.enabled ? "🟢 مفعل" : "🔴 معطل";
  const actionNames = { warn: "⚠️ تحذير", mute: "🔇 كتم", ban: "🚫 حظر" };
  return {
    text: `🛡️ <b>مكافحة السبام</b>\n\n📌 الحالة: ${status}\n📊 الحد الأقصى: ${as.maxMessages || 5} رسائل / ${as.interval || 10} ثوانٍ\n⚡ الإجراء عند السبام: ${actionNames[as.action] || "تحذير"}\n\n🔹 اختر الإجراء:`,
    keyboard: { inline_keyboard: [
      [{ text: "🔄 " + (as.enabled ? "تعطيل" : "تفعيل") + " الحماية", callback_data: "antispam_toggle" }],
      [{ text: "📊 تغيير الحد الأقصى", callback_data: "antispam_limit" }],
      [{ text: "⚡ تغيير الإجراء", callback_data: "antispam_action" }],
      [{ text: "🔙 رجوع", callback_data: "settings_back" }],
    ]},
  };
}

function welcomeMenu() {
  const w = data.welcome;
  const mediaStatus = w.mediaFileId ? `✅ ${w.mediaType}` : "❌ لا يوجد";
  const htmlStatus = w.useHtml ? "🟢 مفعل" : "🔴 معطل";
  return {
    text: `✏️ <b>رسالة الترحيب</b>\n\n📝 <b>النص:</b>\n${w.text}\n\n🖼️ <b>الوسائط:</b> ${mediaStatus}\n📄 <b>وضع HTML:</b> ${htmlStatus}\n\n📦 <b>رسالة المستخدم المسجل:</b>\n${w.registeredMessage}\n\n🔹 اختر الإجراء:`,
    keyboard: { inline_keyboard: [
      [{ text: "✏️ تعديل النص", callback_data: "welcome_edit_text" }],
      [{ text: "🖼️ صورة", callback_data: "welcome_media_photo" }, { text: "🎥 فيديو", callback_data: "welcome_media_video" }],
      [{ text: "📁 ملف", callback_data: "welcome_media_doc" }, { text: "🎞️ GIF", callback_data: "welcome_media_gif" }],
      [{ text: "🗑️ حذف الوسائط", callback_data: "welcome_delete_media" }],
      [{ text: "📄 " + (w.useHtml ? "تعطيل" : "تفعيل") + " HTML", callback_data: "welcome_toggle_html" }],
      [{ text: "✏️ رسالة المستخدم المسجل", callback_data: "welcome_edit_registered" }],
      [{ text: "📋 معاينة", callback_data: "welcome_preview" }],
      [{ text: "🔙 رجوع", callback_data: "admin_back" }],
    ]},
  };
}

function commandsMenu() {
  const keys = Object.keys(data.commands || {});
  let text = "📋 <b>إدارة الأوامر</b>\n\n";
  if (keys.length === 0) { text += "لا توجد أوامر مخصصة.\n"; }
  else { keys.forEach((k) => { const cmd = data.commands[k]; const icon = cmd.enabled ? "✅" : "❌"; const mediaIcon = cmd.mediaType ? " 🖼️" : ""; text += `${icon} /${k}${mediaIcon} - ${cmd.description}\n`; }); }
  text += "\n🔹 اختر الإجراء:";
  return {
    text,
    keyboard: { inline_keyboard: [
      [{ text: "➕ إضافة أمر", callback_data: "cmd_add" }],
      [{ text: "✏️ تعديل أمر", callback_data: "cmd_edit" }, { text: "🗑️ حذف أمر", callback_data: "cmd_delete" }],
      [{ text: "🔄 تفعيل/تعطيل", callback_data: "cmd_toggle" }, { text: "🖼️ وسائط الأمر", callback_data: "cmd_media" }],
      [{ text: "🔙 رجوع", callback_data: "admin_back" }],
    ]},
  };
}

function usersMenu() {
  const users = Object.keys(data.users || {});
  const banned = Object.keys(data.bannedUsers || {});
  const pending = Object.keys(data.verification.pendingUsers || {}).length;
  return {
    text: `👥 <b>إدارة المستخدمين</b>\n\n📌 الإجمالي: ${users.length}\n🚫 المحظورون: ${banned.length}\n⏳ معلقون: ${pending}\n\n🔹 اختر الإجراء:`,
    keyboard: { inline_keyboard: [
      [{ text: "📋 عرض الكل", callback_data: "users_list" }, { text: "🔍 بحث", callback_data: "users_search" }],
      [{ text: "📤 تصدير IDs", callback_data: "users_export" }],
      [{ text: "🗑️ حذف مستخدم", callback_data: "users_delete" }],
      [{ text: "🔙 رجوع", callback_data: "admin_back" }],
    ]},
  };
}

function usersListMenu(page) {
  const users = Object.keys(data.users || {});
  const total = users.length;
  const perPage = 8;
  const totalPages = Math.ceil(total / perPage) || 1;
  const start = (page - 1) * perPage;
  const end = Math.min(start + perPage, total);
  const pageUsers = users.slice(start, end);
  let text = "👥 <b>قائمة المستخدمين</b>\n\n";
  if (total === 0) { text += "لا يوجد مستخدمين."; }
  else {
    text += `📌 الصفحة ${page}/${totalPages} (${total} مستخدم)\n\n`;
    for (const uid of pageUsers) {
      const u = data.users[uid];
      const isBanned = data.bannedUsers?.[uid] ? " 🚫" : "";
      const isVerified = data.verification.verifiedUsers?.[uid] ? " ✅" : "";
      const phoneCountry = getCountryFromPhone(u.phone);
      text += `👤 <b>${u.name || "غير معروف"}</b>${isBanned}${isVerified}\n`;
      text += `🔢 <code>${uid}</code>`;
      if (u.username) text += `  |  @${u.username}`;
      if (u.phone) text += `\n📱 ${phoneCountry.flag} <code>+${String(u.phone).replace(/\D/g,"")}</code> <i>${phoneCountry.name}</i>`;
      if (u.joined) text += `\n📅 ${u.joined}`;
      text += "\n─────────────────\n";
    }
  }
  const buttons = [];
  if (totalPages > 1) {
    const nav = [];
    if (page > 1) nav.push({ text: "⬅️", callback_data: "users_page_" + (page - 1) });
    nav.push({ text: `${page}/${totalPages}`, callback_data: "noop" });
    if (page < totalPages) nav.push({ text: "➡️", callback_data: "users_page_" + (page + 1) });
    buttons.push(nav);
  }
  buttons.push([{ text: "🔙 رجوع", callback_data: "admin_users" }]);
  return { text, keyboard: { inline_keyboard: buttons } };
}

function bannedMenu() {
  const banned = Object.keys(data.bannedUsers || {});
  let text = `🚫 <b>المستخدمون المحظورون</b>\n\n📌 الإجمالي: ${banned.length}\n\n`;
  if (banned.length === 0) { text += "لا يوجد مستخدمون محظورون."; }
  else {
    for (const uid of banned.slice(0, 20)) {
      const u = data.bannedUsers[uid];
      text += `🚫 <code>${uid}</code> - ${u.name || "غير معروف"}\n`;
      if (u.reason) text += `   السبب: ${u.reason}\n`;
    }
    if (banned.length > 20) text += `\n... و ${banned.length - 20} آخرون`;
  }
  return {
    text,
    keyboard: { inline_keyboard: [
      [{ text: "🚫 حظر مستخدم", callback_data: "ban_user" }],
      [{ text: "✅ رفع الحظر", callback_data: "unban_user" }],
      [{ text: "🔙 رجوع", callback_data: "admin_back" }],
    ]},
  };
}

function broadcastMenu() {
  const history = data.broadcast?.history || [];
  const last = history[history.length - 1];
  let lastInfo = "لم يتم إرسال رسائل جماعية بعد.";
  if (last) { lastInfo = `📅 ${formatDate(last.date)}\n✅ نجح: ${last.success || 0} | ❌ فشل: ${last.fail || 0}`; }
  return {
    text: `📢 <b>الرسائل الجماعية</b>\n\n📌 عدد الرسائل المرسلة: ${history.length}\n\n<b>آخر رسالة:</b>\n${lastInfo}\n\n🔹 اختر نوع الرسالة:`,
    keyboard: { inline_keyboard: [
      [{ text: "📝 رسالة نصية", callback_data: "bc_text" }, { text: "🖼️ صورة", callback_data: "bc_photo" }],
      [{ text: "🎥 فيديو", callback_data: "bc_video" }, { text: "📁 ملف", callback_data: "bc_doc" }],
      [{ text: "📋 تاريخ الإرسال", callback_data: "bc_history" }],
      [{ text: "🔙 رجوع", callback_data: "admin_back" }],
    ]},
  };
}

function adminsMenu() {
  const admins = data.settings.admins || [];
  let text = "👮 <b>إدارة الأدمنات</b>\n\n";
  if (admins.length === 0) { text += "لا يوجد أدمنات إضافيون حالياً."; }
  else { admins.forEach((id, i) => { const u = data.users[id]; text += `${i + 1}. <code>${id}</code>`; if (u) text += ` - ${u.name || ""}`; text += "\n"; }); }
  return {
    text,
    keyboard: { inline_keyboard: [
      [{ text: "➕ إضافة أدمن", callback_data: "admins_add" }],
      [{ text: "🗑️ إزالة أدمن", callback_data: "admins_remove" }],
      [{ text: "🔙 رجوع", callback_data: "admin_back" }],
    ]},
  };
}

function forcedSubscriptionMenu() {
  const fs = data.forcedSubscription;
  const status = fs.enabled ? "🟢 مفعل" : "🔴 معطل";
  const count = (fs.list || []).length;
  const fsCompleted = Object.values(fs.userStatus || {}).filter((s) => s.completed).length;
  let listText = "لا توجد اشتراكات.";
  if (count > 0) {
    listText = "";
    fs.list.forEach((s, i) => { const icon = s.enabled !== false ? "✅" : "❌"; listText += `${i + 1}. ${icon} ${s.name || s.type} (${s.type})\n`; });
  }
  return {
    text: `🔗 <b>الاشتراك الإجباري</b>\n\n📌 الحالة: ${status}\n📋 الاشتراكات: ${count}\n✅ أكملوا: ${fsCompleted}\n\n━━━ <b>قائمة الاشتراكات</b> ━━━\n${listText}\n🔹 اختر الإجراء:`,
    keyboard: { inline_keyboard: [
      [{ text: "🔄 " + (fs.enabled ? "تعطيل" : "تفعيل") + " الكل", callback_data: "fs_toggle_all" }],
      [{ text: "➕ إضافة اشتراك", callback_data: "fs_add" }, { text: "✏️ تعديل", callback_data: "fs_edit" }],
      [{ text: "🗑️ حذف اشتراك", callback_data: "fs_delete" }, { text: "⚙️ إعدادات", callback_data: "fs_settings" }],
      [{ text: "📊 إحصائيات الاشتراك", callback_data: "fs_stats" }],
      [{ text: "👁️ معاينة", callback_data: "fs_preview" }],
      [{ text: "🔙 رجوع", callback_data: "admin_back" }],
    ]},
  };
}

function forcedSubscriptionSettingsMenu() {
  const fs = data.forcedSubscription;
  return {
    text: `⚙️ <b>إعدادات الاشتراك الإجباري</b>\n\n🔔 الإشعار: ${fs.settings.notification ? "🟢 مفعل" : "🔴 معطل"}\n📋 طريقة العرض: ${fs.settings.displayMode === "grouped" ? "مجمعة" : "منفصلة"}\n🔘 زر التحقق: ${fs.settings.verifyButtonText}\n✏️ رسالة العرض: ${fs.settings.groupedMessage || "غير محددة"}`,
    keyboard: { inline_keyboard: [
      [{ text: "🔔 " + (fs.settings.notification ? "تعطيل" : "تفعيل") + " الإشعار", callback_data: "fs_setting_notification" }],
      [{ text: "📋 تغيير طريقة العرض", callback_data: "fs_setting_display" }],
      [{ text: "✏️ تعديل زر التحقق", callback_data: "fs_setting_verify_text" }],
      [{ text: "✏️ تعديل رسالة العرض", callback_data: "fs_setting_grouped_message" }],
      [{ text: "🔙 رجوع", callback_data: "admin_forced_subscription" }],
    ]},
  };
}

// ====================================================================
// ========== قوائم إدارة المحتوى ==========
// ====================================================================

function contentManagementMenu() {
  const c = data.content || {};
  const items = Object.values(c.items || {});
  const total = items.length;
  const published = items.filter((i) => i.status === "published").length;
  const drafts = items.filter((i) => i.status !== "published").length;
  const channel = c.publishChannelName || c.publishChannel || "❌ غير محددة";
  return {
    text: `📁 <b>إدارة المحتوى</b>\n\n📊 <b>الإحصائيات:</b>\n  • الإجمالي: <b>${total}</b>\n  • منشور: <b>${published}</b>  |  مسودة: <b>${drafts}</b>\n  \n📢 <b>قناة النشر:</b> ${channel}\n\n🔹 اختر الإجراء:`,
    keyboard: { inline_keyboard: [
      [{ text: "➕ إضافة محتوى جديد", callback_data: "cnt_add" }],
      [{ text: `📋 قائمة المحتوى (${total})`, callback_data: "cnt_list_1" }, { text: "🔍 بحث عن محتوى", callback_data: "cnt_search" }],
      [{ text: "📢 تعيين قناة النشر", callback_data: "cnt_set_channel" }, { text: "💬 رسالة التواصل", callback_data: "cnt_set_contact" }],
      [{ text: "✏️ رسالة البحث", callback_data: "cnt_set_search_prompt" }],
      [{ text: "🔙 رجوع", callback_data: "admin_back" }],
    ]},
  };
}

function contentListMenu(page) {
  const items = Object.values(data.content?.items || {}).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const total = items.length;
  const perPage = 6;
  const totalPages = Math.ceil(total / perPage) || 1;
  page = Math.max(1, Math.min(page, totalPages));
  const start = (page - 1) * perPage;
  const pageItems = items.slice(start, start + perPage);
  let text = `📋 <b>قائمة المحتوى</b>\n📌 الصفحة ${page}/${totalPages} (${total} عنصر)\n\n`;
  if (total === 0) text = "📭 <b>لا يوجد محتوى بعد.</b>\n\nاضغط ➕ لإضافة أول محتوى.";
  const buttons = pageItems.map((item) => {
    const icon = item.status === "published" ? "✅" : "📝";
    const typeIcon = { text: "📝", photo: "🖼️", video: "🎥", mixed: "📦" }[item.type] || "📄";
    return [{ text: `${icon} ${typeIcon} ${item.id} — ${item.title.substring(0, 25)}`, callback_data: "cnt_detail_" + item.id }];
  });
  if (totalPages > 1) {
    const nav = [];
    if (page > 1) nav.push({ text: "⬅️", callback_data: "cnt_list_" + (page - 1) });
    nav.push({ text: `${page}/${totalPages}`, callback_data: "noop" });
    if (page < totalPages) nav.push({ text: "➡️", callback_data: "cnt_list_" + (page + 1) });
    buttons.push(nav);
  }
  buttons.push([{ text: "➕ إضافة محتوى", callback_data: "cnt_add" }]);
  buttons.push([{ text: "🔙 رجوع", callback_data: "admin_content" }]);
  return { text, keyboard: { inline_keyboard: buttons } };
}

function contentDetailMenu(id) {
  const item = data.content?.items?.[id];
  if (!item) return null;
  const typeIcon = { text: "📝", photo: "🖼️", video: "🎥", mixed: "📦" }[item.type] || "📄";
  const statusIcon = item.status === "published" ? "✅ منشور" : "📝 مسودة";
  const partsInfo = (item.parts || []).map((p, i) => {
    if (p.type === "text") return `  ${i + 1}. 📝 نص (${p.content?.length || 0} حرف)`;
    if (p.type === "photo") return `  ${i + 1}. 🖼️ صورة${p.caption ? " + تعليق" : ""}`;
    if (p.type === "video") return `  ${i + 1}. 🎥 فيديو${p.caption ? " + تعليق" : ""}`;
    return `  ${i + 1}. 📄 وسائط`;
  }).join("\n");
  const botUsername = data.content?.botUsername || "niswangybot";
  const publishText = buildPublishText(item, botUsername);
  return {
    text: `${typeIcon} <b>${item.title}</b>\n\n🔢 <b>رقم المحتوى:</b> <code>${id}</code>\n📌 <b>الحالة:</b> ${statusIcon}\n📅 <b>التاريخ:</b> ${formatDate(item.createdAt)}\n\n📦 <b>الأجزاء (${(item.parts || []).length}):</b>\n${partsInfo || "  لا يوجد محتوى"}\n\n─────────────────\n📢 <b>نص النشر:</b>\n<code>${publishText}</code>`,
    keyboard: { inline_keyboard: [
      [{ text: "📤 نشر على القناة", callback_data: "cnt_publish_" + id }, { text: "📋 نسخ نص النشر", callback_data: "cnt_copy_" + id }],
      [{ text: "▶️ معاينة المحتوى", callback_data: "cnt_preview_" + id }, { text: "➕ إضافة جزء", callback_data: "cnt_addpart_" + id }],
      [{ text: "✏️ تعديل العنوان", callback_data: "cnt_edittitle_" + id }, { text: "🗑️ حذف المحتوى", callback_data: "cnt_delete_" + id }],
      [{ text: "🔙 رجوع للقائمة", callback_data: "cnt_list_1" }],
    ]},
  };
}
// ====================================================================
// ========== معالج التحديثات الرئيسي ==========
// ====================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    await loadData(env);
    setLogChannel(data.notifications.channelId);
    setLogEnabled(data.notifications.enabled);
    setLogAllActions(data.notifications.logAllActions !== false);

    if (url.pathname === "/") return new Response("🤖 Bot v2.3 running!");
    if (url.pathname === "/webhook" && request.method === "POST") {
      try {
        const body = await request.json();
        await handleUpdate(body, env);
        return new Response("OK", { status: 200 });
      } catch (e) {
        console.error("Webhook error:", e);
        return new Response("Error: " + e.message, { status: 500 });
      }
    }
    if (url.pathname === "/setwebhook") {
      const token = env.BOT_TOKEN;
      const webhook = "https://" + url.hostname + "/webhook";
      const res = await fetch(
        `https://api.telegram.org/bot${token}/setWebhook?url=${webhook}&allowed_updates=["message","callback_query"]`
      );
      const result = await res.json();
      return new Response(JSON.stringify(result, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.pathname === "/stats") {
      const users = Object.keys(data.users || {}).length;
      const banned = Object.keys(data.bannedUsers || {}).length;
      return new Response(
        JSON.stringify({ users, banned, botActive: data.settings.botActive }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("Not found", { status: 404 });
  },
};

// ====================================================================
// ========== معالجة التحديثات ==========
// ====================================================================

async function handleUpdate(update, env) {
  const token = env.BOT_TOKEN;

  // ===== معالجة الكولباك =====
  if (update.callback_query) {
    const q = update.callback_query;
    const userId = String(q.from.id);
    const cbData = q.data;
    const chatId = q.message.chat.id;
    const msgId = q.message.message_id;

    // التحقق من الحظر
    if (data.bannedUsers?.[userId] && !isAdmin(userId, env)) {
      await answerCallback(q.id, data.texts.bannedUser || "🚫 أنت محظور من استخدام هذا البوت.", token, true);
      return;
    }

    // الكولباك المسموح بها للمستخدمين غير الأدمن
    const allowedCallbacks = ["start_use", "check_subscription", "noop"];
    const isFsLink = cbData.startsWith("fs_link_done_");
    const isVerifApproveReject = cbData.startsWith("verif_approve_") || cbData.startsWith("verif_reject_");
    const isVerifReapprove = cbData.startsWith("verif_reapprove_");

    if (!isAdmin(userId, env) && !allowedCallbacks.includes(cbData) && !isFsLink && !isVerifApproveReject && !isVerifReapprove) {
      const hasPerm = await checkUserPermissions(userId, chatId, token, env);
      if (!hasPerm) {
        await answerCallback(q.id, "", token);
        return;
      }
    }

    // ===== أزرار المستخدم العامة =====
    if (cbData === "start_use") {
      const user = data.users[userId] || {};
      await sendLog(userId, user.username, user.name, "▶️ بدء الاستخدام", "بدأ المستخدم استخدام البوت", token);
      const fsOk = await checkForcedSubscription(userId, token);
      if (!fsOk) {
        await showForcedSubscription(chatId, userId, token);
        await answerCallback(q.id, "", token);
        return;
      }
      if (data.verification.enabled) {
        await sendMessage(chatId, data.texts.verificationRequest || data.verification.requestMessage, token, {
          reply_markup: {
            keyboard: [[{ text: data.verification.buttonText, request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        });
      } else {
        await sendMessage(chatId, data.texts.welcomeRegistered || "📦 <b>مرحباً بعودتك!</b>", token, {
          reply_markup: getUserKeyboard(),
        });
      }
      await answerCallback(q.id, "", token);
      return;
    }

    if (cbData === "check_subscription") {
      const fsOk = await checkForcedSubscription(userId, token);
      if (fsOk) {
        if (data.verification.enabled && !data.verification.verifiedUsers?.[userId]) {
          await sendMessage(chatId, data.texts.verificationRequest || data.verification.requestMessage, token, {
            reply_markup: {
              keyboard: [[{ text: data.verification.buttonText, request_contact: true }]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          });
          await answerCallback(q.id, "", token);
          return;
        }
        const welcome = getWelcomeForUser(false, false, true, false);
        await sendMedia(chatId, welcome.mediaType, welcome.mediaFileId, welcome.text, token, {
          reply_markup: getUserKeyboard(),
        });
      } else {
        await answerCallback(q.id, data.texts.notSubscribed || "❌ لم تكمل جميع الاشتراكات!", token, true);
        await showForcedSubscription(chatId, userId, token);
      }
      await saveData(env);
      await answerCallback(q.id, "", token);
      return;
    }

    if (cbData.startsWith("fs_link_done_")) {
      const linkId = cbData.replace("fs_link_done_", "");
      if (!data.forcedSubscription.userStatus) data.forcedSubscription.userStatus = {};
      if (!data.forcedSubscription.userStatus[userId]) data.forcedSubscription.userStatus[userId] = {};
      if (!data.forcedSubscription.userStatus[userId].links) data.forcedSubscription.userStatus[userId].links = {};
      data.forcedSubscription.userStatus[userId].links[linkId] = { completed: true, timestamp: Date.now() };
      await saveData(env);
      const fsOk = await checkForcedSubscription(userId, token);
      if (fsOk) {
        await saveData(env);
        if (data.verification.enabled && !data.verification.verifiedUsers?.[userId]) {
          await sendMessage(chatId, data.texts.verificationRequest || data.verification.requestMessage, token, {
            reply_markup: {
              keyboard: [[{ text: data.verification.buttonText, request_contact: true }]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          });
          await answerCallback(q.id, "", token);
          return;
        }
        const welcome = getWelcomeForUser(false, false, true, false);
        await sendMedia(chatId, welcome.mediaType, welcome.mediaFileId, welcome.text, token, {
          reply_markup: getUserKeyboard(),
        });
      } else {
        await showForcedSubscription(chatId, userId, token);
      }
      await answerCallback(q.id, "", token);
      return;
    }

    if (cbData === "noop") {
      await answerCallback(q.id, "", token);
      return;
    }

    // ===== كولباك الأدمن =====
    if (isAdmin(userId, env)) {
      await handleAdminCallback(userId, cbData, chatId, msgId, token, env);
      await answerCallback(q.id, "", token);
    } else {
      await answerCallback(q.id, data.texts.accessDenied || "⚠️ هذا الإجراء للأدمن فقط", token, true);
    }
    return;
  }

  // ===== معالجة الرسائل =====
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const userId = String(msg.from.id);
    const text = msg.text || "";
    const username = msg.from.username || "";
    const name = (msg.from.first_name + " " + (msg.from.last_name || "")).trim();

    // التحقق من الحظر
    if (data.bannedUsers?.[userId] && !isAdmin(userId, env)) {
      await sendMessage(chatId, data.texts.bannedUser || "🚫 أنت محظور من استخدام هذا البوت.", token);
      return;
    }

    // البوت متوقف
    if (!data.settings.botActive && !isAdmin(userId, env)) {
      await sendMessage(chatId, data.texts.botStopped || data.settings.stopMessage, token);
      return;
    }

    // ===== معالجة إدخالات الأدمن =====
    if (isAdmin(userId, env)) {
      const handled = await handleAdminInput(userId, chatId, msg, token, env);
      if (handled) return;

      if (text === "/start" || text === "/admin") {
        const menu = adminMenu();
        await sendMessage(chatId, menu.text, token, {
          reply_markup: menu.keyboard,
          bypass_protection: true,
        });
        return;
      }
      if (text === "/stats") {
        const sm = statsMenu();
        await sendMessage(chatId, sm.text, token, {
          reply_markup: sm.keyboard,
          bypass_protection: true,
        });
        return;
      }

      // معالجة أمر تعديل النصوص /edit_text
      if (text.startsWith("/edit_text")) {
        const parts = text.split(" ");
        if (parts.length < 3) {
          await sendMessage(chatId, "⚠️ استخدم: /edit_text [المفتاح] [النص الجديد]", token);
          return;
        }
        const key = parts[1];
        const newText = parts.slice(2).join(" ");
        if (!data.texts || !data.texts[key]) {
          await sendMessage(chatId, `❌ المفتاح "${key}" غير موجود.`, token);
          return;
        }
        data.texts[key] = newText;
        await saveData(env);
        await sendMessage(chatId, `✅ تم تحديث النص: <b>${key}</b>\n\n${newText}`, token);
        return;
      }
      return;
    }

    // ===== المستخدم العادي =====

    // مكافحة السبام
    const spamCheck = checkAntiSpam(userId);
    if (spamCheck.spam) {
      if (spamCheck.action === "ban") {
        if (!data.bannedUsers) data.bannedUsers = {};
        data.bannedUsers[userId] = { name, username, reason: "سبام تلقائي", date: new Date().toISOString() };
        await saveData(env);
        await sendMessage(chatId, "🚫 تم حظرك بسبب السبام.", token);
        await sendLog(userId, username, name, "🚫 حظر تلقائي", "تم حظر المستخدم بسبب السبام", token, true);
        return;
      }
      if (spamCheck.action === "warn") {
        await sendMessage(chatId, "⚠️ يرجى عدم إرسال رسائل بسرعة كبيرة.", token);
        return;
      }
      return;
    }

    // تحديث النشاط
    recordActivity(userId);

    // تسجيل الإجراءات في الإشعارات
    if (text && text !== "/start") {
      await sendLog(userId, username, name, "📩 رسالة", "أرسل: " + text.substring(0, 100), token);
    }

    // التحقق من الصلاحيات (للرسائل غير /start والغير contact)
    const isStart = text && text.startsWith("/start");
    const isContact = !!msg.contact;
    if (!isStart && !isContact) {
      const hasPerm = await checkUserPermissions(userId, chatId, token, env);
      if (!hasPerm) return;
    }

    // ===== الأزرار المخصصة (من keyboard) =====
    const customBtn = data.buttons?.items?.find(b => b.label === text);
    if (customBtn) {
      await sendLog(userId, username, name, "🔘 زر مخصص", `ضغط على زر "${customBtn.label}"`, token);
      // نرسل رسالة تحتوي على زر شفاف (inline_keyboard) بالرابط
      const inlineKb = {
        inline_keyboard: [
          [{ text: customBtn.label, url: customBtn.url }]
        ]
      };
      // نرسل رسالة جديدة بها الزر الشفاف، ونبقي keyboard موجوداً
      await sendMessage(chatId, `🔗 <b>${customBtn.label}</b>`, token, {
        reply_markup: inlineKb,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
      return;
    }

    // ===== أزرار البحث والتواصل =====
    if (text === "🔍 البحث عن محتوى") {
      const canAccess = data.verification.verifiedUsers?.[userId] || !data.verification.enabled;
      if (!canAccess) {
        await sendMessage(chatId, data.texts.notVerified || "🔐 يجب إكمال التحقق أولاً.", token);
        return;
      }
      await sendLog(userId, username, name, "🔍 بحث", "بدأ عملية البحث عن محتوى", token);
      if (!adminState[userId]) adminState[userId] = { action: null, step: null, temp: {} };
      adminState[userId] = { action: "user_content_search", step: "waiting_id", temp: {} };
      const prompt = data.texts.searchPrompt || data.content?.searchPrompt || "🔍 أرسل رقم المحتوى المكون من 5 أرقام:";
      await sendMessage(chatId, prompt, token, { reply_markup: getUserKeyboard() });
      return;
    }

    if (text === "📞 تواصل معنا") {
      const contactMsg = data.texts.contactMessage || data.content?.contactMessage || "📞 <b>للتواصل معنا:</b>\n\nيمكنك التواصل مع الإدارة مباشرة.";
      await sendLog(userId, username, name, "📞 تواصل", "طلب التواصل مع الإدارة", token);
      await sendMessage(chatId, contactMsg, token, { reply_markup: getUserKeyboard() });
      return;
    }

    // معالجة رقم الهاتف (التحقق)
    if (msg.contact) {
      const contact = msg.contact;
      if (contact.user_id && String(contact.user_id) !== userId) {
        await sendMessage(chatId, "❌ يرجى مشاركة رقم هاتفك الشخصي فقط.", token);
        return;
      }
      await sendLog(userId, username, name, "📱 مشاركة رقم", "شارك رقم هاتفه للتحقق", token, true);
      if (!data.verification.enabled) {
        await sendMessage(chatId, data.texts.welcomeRegistered || "📦 <b>مرحباً!</b>", token);
        return;
      }
      if (!data.verification.channelId) {
        await sendMessage(chatId, "⚠️ لم يتم تعيين قناة للتحقق. تواصل مع الإدارة.", token);
        return;
      }
      const countryInfo = getCountryFromPhone(contact.phone_number);
      const adminMsg =
`🔔 <b>طلب تحقق جديد</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>الاسم:</b> ${name}
🆔 <b>اليوزرنيم:</b> ${username ? "@" + username : "<i>لا يوجد</i>"}
🔢 <b>المعرف:</b> <code>${userId}</code>
📱 <b>الهاتف:</b> <code>+${String(contact.phone_number).replace(/\D/g,"")}</code>
${countryInfo.flag} <b>الدولة:</b> ${countryInfo.name}
📅 <b>التاريخ:</b> ${formatDate(new Date().toISOString())}
━━━━━━━━━━━━━━━━━━━━`;
      const kb = {
        inline_keyboard: [
          [
            { text: "✅ قبول", callback_data: "verif_approve_" + userId },
            { text: "❌ رفض", callback_data: "verif_reject_" + userId },
          ],
        ],
      };
      const result = await sendMessage(data.verification.channelId, adminMsg, token, {
        reply_markup: kb,
        bypass_protection: true,
      });
      if (!result.ok) {
        await sendMessage(chatId, "⚠️ حدث خطأ في إرسال طلبك. حاول لاحقاً.", token);
        return;
      }
      if (!data.verification.pendingUsers) data.verification.pendingUsers = {};
      data.verification.pendingUsers[userId] = {
        name,
        username,
        phone: contact.phone_number,
        date: new Date().toISOString(),
      };
      await saveData(env);
      await sendMessage(chatId, "⏳ تم استلام طلبك! جاري المراجعة...", token);
      return;
    }

    // معالجة /start
    if (text.startsWith("/start")) {
      const param = text.split(" ")[1] || "";
      await sendLog(userId, username, name, "🔄 بدء", "ضغط على /start" + (param ? " " + param : ""), token);
      const isNewUser = !data.users[userId];
      const isPending = !!(data.verification.pendingUsers?.[userId]);
      const isVerified = !!(data.verification.verifiedUsers?.[userId]);
      const isRejected = !!(data.verification.rejectedUsers?.[userId]);

      if (isNewUser) {
        data.users[userId] = { name, username, joined: new Date().toLocaleString("ar-EG") };
      } else {
        data.users[userId].name = name;
        data.users[userId].username = username;
        data.users[userId].lastUsed = new Date().toLocaleString("ar-EG");
      }
      await saveData(env);

      // معالجة رابط المحتوى المباشر
      if (param.startsWith("share_")) {
        const contentId = param.replace("share_", "");
        const hasPerm = await checkUserPermissions(userId, chatId, token, env);
        if (!hasPerm) return;
        await deliverContent(chatId, contentId, token);
        return;
      }

      // الاشتراك الإجباري
      const fsOk = await checkForcedSubscription(userId, token);
      if (!fsOk) {
        await showForcedSubscription(chatId, userId, token);
        return;
      }

      // رسالة الترحيب المناسبة
      const welcome = getWelcomeForUser(isNewUser, isPending, isVerified, isRejected);
      let replyMarkup;
      if (welcome.userKeyboard) {
        replyMarkup = welcome.userKeyboard;
      } else if (welcome.buttons && welcome.buttons.length > 0) {
        replyMarkup = { inline_keyboard: welcome.buttons };
      } else {
        replyMarkup = { remove_keyboard: true };
      }
      await sendMedia(chatId, welcome.mediaType, welcome.mediaFileId, welcome.text, token, {
        reply_markup: replyMarkup,
      });
      return;
    }

    // ===== بحث المستخدم عن محتوى =====
    {
      const uState = adminState[userId];
      if (uState?.action === "user_content_search" && uState.step === "waiting_id") {
        const contentId = text.trim();
        adminState[userId] = { action: null, step: null, temp: {} };
        const canAccess = data.verification.verifiedUsers?.[userId] || !data.verification.enabled;
        if (!canAccess) {
          await sendMessage(chatId, data.texts.notVerified || "🔐 يجب إكمال التحقق أولاً.", token);
          return;
        }
        if (!/^\d{5}$/.test(contentId)) {
          await sendMessage(chatId, data.texts.contentIdInvalid || "❌ رقم المحتوى يجب أن يكون 5 أرقام بالضبط.\nمثال: <code>10001</code>", token, { reply_markup: getUserKeyboard() });
          return;
        }
        await sendLog(userId, username, name, "📂 عرض محتوى", `عرض المحتوى رقم ${contentId}`, token);
        await deliverContent(chatId, contentId, token);
        return;
      }
    }

    // الأوامر المخصصة
    if (text.startsWith("/")) {
      const cmd = text.substring(1).split(" ")[0];
      if (data.commands && data.commands[cmd] && data.commands[cmd].enabled) {
        await sendLog(userId, username, name, "🔹 أمر", "نفّذ /" + cmd, token);
        const cmdData = data.commands[cmd];
        if (data.verification.enabled && !data.verification.verifiedUsers?.[userId]) {
          await sendMessage(chatId, "❌ هذا الأمر متاح للمستخدمين المحققين فقط.", token);
          return;
        }
        if (cmdData.mediaType && cmdData.mediaFileId) {
          await sendMedia(chatId, cmdData.mediaType, cmdData.mediaFileId, cmdData.response || cmdData.description, token);
        } else {
          await sendMessage(chatId, cmdData.response || "🔹 " + cmdData.description, token);
        }
        data.stats.totalCommands = (data.stats.totalCommands || 0) + 1;
        await saveData(env);
        return;
      }
    }

    // أي رسالة غير معروفة
    await sendMessage(chatId, data.texts.unknownCommand || "❓ أمر غير معروف. أرسل /start للبدء.", token, {
      reply_markup: getUserKeyboard(),
    });
  }
}
// ====================================================================
// ========== معالجة إدخالات الأدمن النصية ==========
// ====================================================================

async function handleAdminInput(userId, chatId, msg, token, env) {
  const state = getAdminState(userId);
  if (!state.action) return false;
  const text = msg.text || "";

  // ===== تعديل نصوص مختلفة =====
  const textEdits = {
    edit_welcome: {
      field: () => (data.welcome.text = text),
      menu: welcomeMenu,
    },
    edit_registered: {
      field: () => (data.welcome.registeredMessage = text),
      menu: welcomeMenu,
    },
    edit_stop: {
      field: () => (data.settings.stopMessage = text),
      menu: botSettingsMenu,
    },
  };

  if (textEdits[state.action] && state.step === "text") {
    textEdits[state.action].field();
    await saveData(env);
    const menu = textEdits[state.action].menu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    await sendMessage(chatId, "✅ تم التحديث بنجاح.", token);
    clearAdminState(userId);
    return true;
  }

  // ===== تعديل رسائل التحقق =====
  if (state.action === "edit_verif_msg" && state.step === "text") {
    data.verification[state.temp.field] = text;
    await saveData(env);
    const menu = verificationMessagesMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    await sendMessage(chatId, "✅ تم تحديث الرسالة.", token);
    clearAdminState(userId);
    return true;
  }

  // ===== تعيين قناة التحقق =====
  if (state.action === "set_verif_channel" && state.step === "text") {
    const channelId = text.trim();
    const chatInfo = await getChatInfo(channelId, token);
    if (chatInfo) {
      data.verification.channelId = channelId;
      data.verification.channelName = chatInfo.name;
      await saveData(env);
      await sendMessage(channelId, "✅ <b>تم تعيين هذه القناة للتحقق.</b>", token, {
        bypass_protection: true,
      });
      const menu = verificationMenu();
      await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
        reply_markup: menu.keyboard,
      });
      await sendMessage(chatId, `✅ تم تعيين قناة التحقق!\n📢 ${chatInfo.name}\n🔢 ${channelId}`, token);
    } else {
      await sendMessage(chatId, "❌ فشل تعيين القناة. تأكد من صحة المعرف وأن البوت أدمن فيها.", token);
    }
    clearAdminState(userId);
    return true;
  }

  // ===== تعيين قناة الإشعارات =====
  if (state.action === "set_notif_channel" && state.step === "text") {
    const channelId = text.trim();
    const chatInfo = await getChatInfo(channelId, token);
    if (chatInfo) {
      data.notifications.channelId = channelId;
      data.notifications.channelName = chatInfo.name;
      setLogChannel(channelId);
      await saveData(env);
      await sendMessage(channelId, "✅ <b>تم تعيين هذه القناة للإشعارات.</b>", token, {
        bypass_protection: true,
      });
      const menu = notificationsMenu();
      await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
        reply_markup: menu.keyboard,
      });
      await sendMessage(chatId, `✅ تم تعيين قناة الإشعارات!\n📢 ${chatInfo.name}`, token);
    } else {
      await sendMessage(chatId, "❌ فشل تعيين القناة.", token);
    }
    clearAdminState(userId);
    return true;
  }

  // ====================================================================
  // ===== إدارة الأزرار =====
  // ====================================================================

  if (state.action === "btn_add_label" && state.step === "waiting_label") {
    state.temp.label = text.trim();
    state.step = "waiting_url";
    await sendMessage(chatId, "🔗 أدخل رابط الزر (يجب أن يبدأ بـ http:// أو https://):", token);
    return true;
  }

  if (state.action === "btn_add_label" && state.step === "waiting_url") {
    const label = state.temp.label;
    const url = text.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      await sendMessage(chatId, "❌ الرابط غير صالح. يجب أن يبدأ بـ http:// أو https://", token);
      return true;
    }
    if (!data.buttons) data.buttons = { items: [] };
    data.buttons.items.push({ id: generateButtonId(), label, url });
    await saveData(env);
    const menu = buttonsMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    await sendMessage(chatId, `✅ تم إضافة الزر: <b>${label}</b>`, token);
    clearAdminState(userId);
    return true;
  }

  if (state.action === "btn_edit_select" && state.step === "waiting_id") {
    const idx = parseInt(text.trim()) - 1;
    const items = data.buttons?.items || [];
    if (isNaN(idx) || idx < 0 || idx >= items.length) {
      await sendMessage(chatId, "❌ رقم غير صحيح. أدخل رقم الزر كما في القائمة.", token);
      return true;
    }
    state.temp.editIndex = idx;
    state.step = "waiting_field";
    const btn = items[idx];
    const buttons = [
      [{ text: "✏️ تعديل التسمية", callback_data: "btn_edit_field_label" }],
      [{ text: "✏️ تعديل الرابط", callback_data: "btn_edit_field_url" }],
      [{ text: "🔙 إلغاء", callback_data: "admin_buttons" }],
    ];
    await sendMessage(chatId, `✏️ <b>تعديل الزر:</b> ${btn.label}\nاختر الحقل:`, token, {
      reply_markup: { inline_keyboard: buttons },
    });
    clearAdminState(userId);
    return true;
  }

  if (state.action === "btn_edit_field_label" && state.step === "waiting_value") {
    const idx = state.temp.editIndex;
    const items = data.buttons?.items || [];
    if (idx === undefined || idx < 0 || idx >= items.length) {
      await sendMessage(chatId, "❌ حدث خطأ. حاول مرة أخرى.", token);
      clearAdminState(userId);
      return true;
    }
    items[idx].label = text.trim();
    await saveData(env);
    const menu = buttonsMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    await sendMessage(chatId, `✅ تم تحديث التسمية إلى: <b>${items[idx].label}</b>`, token);
    clearAdminState(userId);
    return true;
  }

  if (state.action === "btn_edit_field_url" && state.step === "waiting_value") {
    const idx = state.temp.editIndex;
    const items = data.buttons?.items || [];
    if (idx === undefined || idx < 0 || idx >= items.length) {
      await sendMessage(chatId, "❌ حدث خطأ. حاول مرة أخرى.", token);
      clearAdminState(userId);
      return true;
    }
    const url = text.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      await sendMessage(chatId, "❌ الرابط غير صالح. يجب أن يبدأ بـ http:// أو https://", token);
      return true;
    }
    items[idx].url = url;
    await saveData(env);
    const menu = buttonsMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    await sendMessage(chatId, `✅ تم تحديث الرابط إلى: <code>${items[idx].url}</code>`, token);
    clearAdminState(userId);
    return true;
  }

  if (state.action === "btn_delete" && state.step === "waiting_id") {
    const idx = parseInt(text.trim()) - 1;
    const items = data.buttons?.items || [];
    if (isNaN(idx) || idx < 0 || idx >= items.length) {
      await sendMessage(chatId, "❌ رقم غير صحيح. أدخل رقم الزر كما في القائمة.", token);
      return true;
    }
    const removed = items.splice(idx, 1)[0];
    await saveData(env);
    const menu = buttonsMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    await sendMessage(chatId, `🗑️ تم حذف الزر: <b>${removed.label}</b>`, token);
    clearAdminState(userId);
    return true;
  }

  // ====================================================================
  // ===== إدارة الأوامر =====
  // ====================================================================

  if (state.action === "cmd_add" && state.step === "cmd") {
    const cmdName = text.replace(/\//g, "").trim().toLowerCase();
    if (!/^[a-z0-9_]+$/.test(cmdName)) {
      await sendMessage(chatId, "❌ اسم الأمر يجب أن يحتوي على أحرف إنجليزية وأرقام وشرطة سفلية فقط.", token);
      return true;
    }
    state.temp.cmd = cmdName;
    state.step = "desc";
    await sendMessage(chatId, `📝 <b>أدخل وصف الأمر /${cmdName}:</b>`, token);
    return true;
  }

  if (state.action === "cmd_add" && state.step === "desc") {
    state.temp.desc = text;
    state.step = "response";
    await sendMessage(chatId, "📝 <b>أدخل نص الرد على الأمر:</b>", token);
    return true;
  }

  if (state.action === "cmd_add" && state.step === "response") {
    if (!data.commands) data.commands = {};
    data.commands[state.temp.cmd] = {
      description: state.temp.desc,
      response: text,
      enabled: true,
      mediaType: null,
      mediaFileId: null,
    };
    await saveData(env);
    await updateBotCommands(token);
    const menu = commandsMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    await sendMessage(chatId, `✅ تم إضافة الأمر /${state.temp.cmd}`, token);
    clearAdminState(userId);
    return true;
  }

  if (state.action === "cmd_edit" && state.step === "cmd") {
    const cmd = text.replace("/", "").trim();
    if (data.commands?.[cmd]) {
      state.temp.editCmd = cmd;
      state.step = "field";
      const buttons = [
        [{ text: "✏️ الوصف", callback_data: "cmd_edit_field_desc" }],
        [{ text: "✏️ نص الرد", callback_data: "cmd_edit_field_response" }],
        [{ text: "🔙 إلغاء", callback_data: "admin_commands" }],
      ];
      await sendMessage(chatId, `✏️ <b>تعديل /${cmd}</b>\nاختر الحقل:`, token, {
        reply_markup: { inline_keyboard: buttons },
      });
    } else {
      await sendMessage(chatId, `❌ الأمر /${cmd} غير موجود.`, token);
      clearAdminState(userId);
    }
    return true;
  }

  if (state.action === "cmd_edit" && state.step === "new_desc") {
    data.commands[state.temp.editCmd].description = text;
    await saveData(env);
    await updateBotCommands(token);
    const menu = commandsMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    await sendMessage(chatId, `✅ تم تحديث وصف /${state.temp.editCmd}`, token);
    clearAdminState(userId);
    return true;
  }

  if (state.action === "cmd_edit" && state.step === "new_response") {
    data.commands[state.temp.editCmd].response = text;
    await saveData(env);
    const menu = commandsMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    await sendMessage(chatId, `✅ تم تحديث رد /${state.temp.editCmd}`, token);
    clearAdminState(userId);
    return true;
  }

  if (state.action === "cmd_delete" && state.step === "cmd") {
    const cmd = text.replace("/", "").trim();
    if (data.commands?.[cmd]) {
      delete data.commands[cmd];
      await saveData(env);
      await updateBotCommands(token);
      const menu = commandsMenu();
      await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
        reply_markup: menu.keyboard,
      });
      await sendMessage(chatId, `✅ تم حذف /${cmd}`, token);
    } else {
      await sendMessage(chatId, `❌ الأمر /${cmd} غير موجود.`, token);
    }
    clearAdminState(userId);
    return true;
  }

  if (state.action === "cmd_toggle" && state.step === "cmd") {
    const cmd = text.replace("/", "").trim();
    if (data.commands?.[cmd]) {
      data.commands[cmd].enabled = !data.commands[cmd].enabled;
      await saveData(env);
      await updateBotCommands(token);
      const menu = commandsMenu();
      await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
        reply_markup: menu.keyboard,
      });
      await sendMessage(chatId, `✅ تم ${data.commands[cmd].enabled ? "تفعيل" : "تعطيل"} /${cmd}`, token);
    } else {
      await sendMessage(chatId, `❌ الأمر /${cmd} غير موجود.`, token);
    }
    clearAdminState(userId);
    return true;
  }

  if (state.action === "cmd_media_select" && state.step === "cmd") {
    const cmd = text.replace("/", "").trim();
    if (data.commands?.[cmd]) {
      state.action = "cmd_set_media";
      state.step = "waiting_media";
      state.temp.cmdName = cmd;
      await sendMessage(chatId, `🖼️ <b>أرسل الوسائط لـ /${cmd}:</b>\n\n(صورة، فيديو، ملف، GIF)\nأو أرسل "-" لحذف الوسائط.`, token);
    } else {
      await sendMessage(chatId, `❌ الأمر /${cmd} غير موجود.`, token);
      clearAdminState(userId);
    }
    return true;
  }

  if (state.action === "cmd_set_media" && state.step === "waiting_media") {
    const cmdName = state.temp.cmdName;
    if (!data.commands[cmdName]) {
      clearAdminState(userId);
      return true;
    }
    if (msg.photo) {
      data.commands[cmdName].mediaType = "photo";
      data.commands[cmdName].mediaFileId = msg.photo[msg.photo.length - 1].file_id;
    } else if (msg.video) {
      data.commands[cmdName].mediaType = "video";
      data.commands[cmdName].mediaFileId = msg.video.file_id;
    } else if (msg.document) {
      data.commands[cmdName].mediaType = "document";
      data.commands[cmdName].mediaFileId = msg.document.file_id;
    } else if (msg.animation) {
      data.commands[cmdName].mediaType = "animation";
      data.commands[cmdName].mediaFileId = msg.animation.file_id;
    } else if (text === "-") {
      data.commands[cmdName].mediaType = null;
      data.commands[cmdName].mediaFileId = null;
    } else {
      await sendMessage(chatId, '❌ أرسل صورة، فيديو، ملف، GIF، أو "-" للإلغاء.', token);
      return true;
    }
    await saveData(env);
    const menu = commandsMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    await sendMessage(chatId, "✅ تم تحديث وسائط الأمر /" + cmdName, token);
    clearAdminState(userId);
    return true;
  }

  // ====================================================================
  // ===== إدارة الأدمنات =====
  // ====================================================================

  if (state.action === "admins_add" && state.step === "text") {
    const targetId = text.trim();
    if (!data.settings.admins) data.settings.admins = [];
    if (!data.settings.admins.includes(targetId)) {
      data.settings.admins.push(targetId);
      await saveData(env);
      await sendMessage(chatId, `✅ تم إضافة الأدمن <code>${targetId}</code>`, token);
      try {
        await sendMessage(targetId, "👮 تم منحك صلاحيات الأدمن في البوت.", token);
      } catch {}
    } else {
      await sendMessage(chatId, "⚠️ هذا المستخدم أدمن بالفعل.", token);
    }
    const menu = adminsMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    clearAdminState(userId);
    return true;
  }

  if (state.action === "admins_remove" && state.step === "text") {
    const targetId = text.trim();
    if (!data.settings.admins) data.settings.admins = [];
    const idx = data.settings.admins.indexOf(targetId);
    if (idx !== -1) {
      data.settings.admins.splice(idx, 1);
      await saveData(env);
      await sendMessage(chatId, `✅ تم إزالة الأدمن <code>${targetId}</code>`, token);
    } else {
      await sendMessage(chatId, "⚠️ هذا المستخدم ليس أدمن.", token);
    }
    const menu = adminsMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    clearAdminState(userId);
    return true;
  }

  // ====================================================================
  // ===== حظر ورفع الحظر =====
  // ====================================================================

  if (state.action === "ban_user" && state.step === "id") {
    state.temp.banId = text.trim();
    state.step = "reason";
    await sendMessage(chatId, "📝 أدخل سبب الحظر (أو أرسل - لتخطي):", token);
    return true;
  }

  if (state.action === "ban_user" && state.step === "reason") {
    const targetId = state.temp.banId;
    const reason = text === "-" ? "" : text;
    if (!data.bannedUsers) data.bannedUsers = {};
    const userData = data.users[targetId] || {};
    data.bannedUsers[targetId] = {
      name: userData.name || "غير معروف",
      username: userData.username || "",
      reason,
      date: new Date().toISOString(),
    };
    await saveData(env);
    await sendMessage(chatId, `✅ تم حظر المستخدم <code>${targetId}</code>${reason ? "\nالسبب: " + reason : ""}`, token);
    try {
      await sendMessage(targetId, `🚫 تم حظرك من استخدام البوت.${reason ? "\nالسبب: " + reason : ""}`, token);
    } catch {}
    const menu = bannedMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    clearAdminState(userId);
    return true;
  }

  if (state.action === "unban_user" && state.step === "text") {
    const targetId = text.trim();
    if (data.bannedUsers && data.bannedUsers[targetId]) {
      delete data.bannedUsers[targetId];
      await saveData(env);
      await sendMessage(chatId, `✅ تم رفع الحظر عن <code>${targetId}</code>`, token);
      try {
        await sendMessage(targetId, "✅ تم رفع الحظر عنك. يمكنك الآن استخدام البوت.", token);
      } catch {}
    } else {
      await sendMessage(chatId, "⚠️ هذا المستخدم غير محظور.", token);
    }
    const menu = bannedMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    clearAdminState(userId);
    return true;
  }

  // ====================================================================
  // ===== بحث عن مستخدم =====
  // ====================================================================

  if (state.action === "users_search" && state.step === "text") {
    const query = text.trim().toLowerCase();
    const results = Object.entries(data.users || {}).filter(([id, u]) => {
      return (
        id.includes(query) ||
        (u.name && u.name.toLowerCase().includes(query)) ||
        (u.username && u.username.toLowerCase().includes(query)) ||
        (u.phone && u.phone.includes(query))
      );
    });
    let result = `🔍 <b>نتائج البحث عن "${text}"</b>\n\n`;
    if (results.length === 0) {
      result += "لم يتم العثور على نتائج.";
    } else {
      result += `وُجد ${results.length} نتيجة:\n\n`;
      for (const [id, u] of results.slice(0, 10)) {
        result += `👤 ${u.name || "غير معروف"}\n🔢 <code>${id}</code>`;
        if (u.username) result += ` | @${u.username}`;
        if (u.phone) result += `\n📱 ${u.phone}`;
        result += "\n─────\n";
      }
      if (results.length > 10) result += `... و ${results.length - 10} نتيجة أخرى`;
    }
    await sendMessage(chatId, result, token);
    clearAdminState(userId);
    return true;
  }

  // ====================================================================
  // ===== رسالة مباشرة =====
  // ====================================================================

  if (state.action === "direct_msg" && state.step === "id") {
    state.temp.targetId = text.trim();
    state.step = "message";
    await sendMessage(chatId, `📝 أدخل الرسالة التي تريد إرسالها للمستخدم <code>${state.temp.targetId}</code>:`, token);
    return true;
  }

  if (state.action === "direct_msg" && state.step === "message") {
    const targetId = state.temp.targetId;
    let sent = false;
    if (msg.photo) {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      const res = await sendPhoto(targetId, fileId, msg.caption || "", token, { bypass_protection: true });
      sent = res.ok;
    } else if (msg.video) {
      const res = await sendVideo(targetId, msg.video.file_id, msg.caption || "", token, { bypass_protection: true });
      sent = res.ok;
    } else if (msg.document) {
      const res = await sendDocument(targetId, msg.document.file_id, msg.caption || "", token, { bypass_protection: true });
      sent = res.ok;
    } else if (text) {
      const res = await sendMessage(targetId, text, token, { bypass_protection: true });
      sent = res.ok;
    }
    if (sent) {
      await sendMessage(chatId, `✅ تم إرسال الرسالة للمستخدم <code>${targetId}</code>`, token);
    } else {
      await sendMessage(chatId, `❌ فشل إرسال الرسالة للمستخدم <code>${targetId}</code>. ربما حظر البوت.`, token);
    }
    clearAdminState(userId);
    return true;
  }

  // ====================================================================
  // ===== البث الجماعي =====
  // ====================================================================

  if (state.action === "broadcast" && state.step === "message") {
    const users = Object.keys(data.users || {});
    if (users.length === 0) {
      await sendMessage(chatId, "⚠️ لا يوجد مستخدمون.", token);
      clearAdminState(userId);
      return true;
    }
    await sendMessage(chatId, `📢 <b>جاري إرسال الرسالة لـ ${users.length} مستخدم...</b>\n\n⏳ يرجى الانتظار...`, token, { bypass_protection: true });

    let success = 0,
      fail = 0;
    const batchSize = 30;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (uid) => {
          if (data.bannedUsers?.[uid]) {
            fail++;
            return;
          }
          let res;
          try {
            if (msg.photo) {
              const fileId = msg.photo[msg.photo.length - 1].file_id;
              res = await sendPhoto(uid, fileId, msg.caption || "", token, { bypass_protection: true });
            } else if (msg.video) {
              res = await sendVideo(uid, msg.video.file_id, msg.caption || "", token, { bypass_protection: true });
            } else if (msg.document) {
              res = await sendDocument(uid, msg.document.file_id, msg.caption || "", token, { bypass_protection: true });
            } else if (msg.animation) {
              res = await sendAnimation(uid, msg.animation.file_id, msg.caption || "", token, { bypass_protection: true });
            } else if (text) {
              res = await sendMessage(uid, text, token, { bypass_protection: true });
            }
            if (res?.ok) success++;
            else fail++;
          } catch {
            fail++;
          }
        })
      );
      if (i + batchSize < users.length) await new Promise((r) => setTimeout(r, 1000));
    }

    if (!data.broadcast) data.broadcast = { history: [] };
    data.broadcast.history.push({
      date: new Date().toISOString(),
      type: msg.photo ? "photo" : msg.video ? "video" : msg.document ? "document" : "text",
      success,
      fail,
      total: users.length,
    });
    if (data.broadcast.history.length > 50) data.broadcast.history.shift();
    await saveData(env);

    await sendMessage(chatId, `✅ <b>تم إرسال الرسالة الجماعية!</b>\n\n👥 الإجمالي: ${users.length}\n✅ نجح: ${success}\n❌ فشل: ${fail}`, token, { bypass_protection: true });
    clearAdminState(userId);
    return true;
  }

  // ====================================================================
  // ===== إعدادات مكافحة السبام =====
  // ====================================================================

  if (state.action === "antispam_limit" && state.step === "text") {
    const parts = text.split("/");
    const max = parseInt(parts[0]);
    const interval = parseInt(parts[1] || "10");
    if (isNaN(max) || max < 1) {
      await sendMessage(chatId, "❌ تنسيق خاطئ. مثال: 5/10", token);
      return true;
    }
    data.settings.antiSpam.maxMessages = max;
    data.settings.antiSpam.interval = interval;
    await saveData(env);
    await sendMessage(chatId, `✅ تم التحديث: ${max} رسائل كحد أقصى خلال ${interval} ثانية.`, token);
    const menu = antiSpamMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    clearAdminState(userId);
    return true;
  }

  // ====================================================================
  // ===== إدارة المحتوى =====
  // ====================================================================

  if (state.action === "cnt_set_channel" && state.step === "waiting_channel") {
    const channelId = text.trim();
    const chatInfo = await getChatInfo(channelId, token);
    if (chatInfo) {
      if (!data.content) data.content = {};
      data.content.publishChannel = channelId;
      data.content.publishChannelName = chatInfo.name;
      await saveData(env);
      await sendMessage(chatId, `✅ تم تعيين قناة النشر!\n📢 ${chatInfo.name}\n🔢 ${channelId}`, token);
      const m = contentManagementMenu();
      await editMessage(state.temp.chatId, state.temp.msgId, m.text, token, { reply_markup: m.keyboard });
    } else {
      await sendMessage(chatId, "❌ فشل تعيين القناة. تأكد من صحة المعرف وأن البوت أدمن فيها.", token);
    }
    clearAdminState(userId);
    return true;
  }

  if (state.action === "cnt_set_contact" && state.step === "waiting_text") {
    if (!data.content) data.content = {};
    data.content.contactMessage = text;
    await saveData(env);
    const m = contentManagementMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, m.text, token, { reply_markup: m.keyboard });
    await sendMessage(chatId, "✅ تم تحديث رسالة التواصل.", token);
    clearAdminState(userId);
    return true;
  }

  if (state.action === "cnt_set_search_prompt" && state.step === "waiting_text") {
    if (!data.content) data.content = {};
    data.content.searchPrompt = text;
    await saveData(env);
    const m = contentManagementMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, m.text, token, { reply_markup: m.keyboard });
    await sendMessage(chatId, "✅ تم تحديث رسالة البحث.", token);
    clearAdminState(userId);
    return true;
  }

  if (state.action === "cnt_set_botusername" && state.step === "waiting_text") {
    if (!data.content) data.content = {};
    data.content.botUsername = text.trim().replace("@", "");
    await saveData(env);
    const m = contentManagementMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, m.text, token, { reply_markup: m.keyboard });
    await sendMessage(chatId, `✅ تم تعيين يوزرنيم البوت: @${data.content.botUsername}`, token);
    clearAdminState(userId);
    return true;
  }

  if (state.action === "cnt_add" && state.step === "waiting_title") {
    const title = text.trim();
    if (!title || title.length < 2) {
      await sendMessage(chatId, "❌ العنوان قصير جداً. أدخل عنواناً واضحاً:", token);
      return true;
    }
    state.temp.title = title;
    state.step = "waiting_parts";
    const typePrompts = {
      text: "📝 أرسل النص الأول للمحتوى:",
      photo: "🖼️ أرسل الصورة الأولى (يمكنك إضافة تعليق معها):",
      video: "🎥 أرسل الفيديو الأول (يمكنك إضافة تعليق معها):",
      mixed: "📦 أرسل الجزء الأول (نص أو صورة أو فيديو):",
    };
    await sendMessage(chatId, `✅ العنوان: <b>${title}</b>\n\n${typePrompts[state.temp.type] || "أرسل الجزء الأول:"}`, token, {
      reply_markup: {
        inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "cnt_part_cancel" }]],
      },
    });
    return true;
  }

  if (state.action === "cnt_add" && state.step === "waiting_parts") {
    if (!state.temp.parts) state.temp.parts = [];
    let added = false;

    if (msg.text && !msg.text.startsWith("/")) {
      if (isTwitterUrl(msg.text)) {
        await sendMessage(chatId, "⏳ جارٍ جلب الفيديو من تويتر/X...", token);
        const result = await sendTwitterVideo(chatId, msg.text, "", token);
        if (!result) {
          await sendMessage(chatId, "❌ لم أتمكن من جلب الفيديو. تأكد أن التغريدة تحتوي فيديو والرابط صحيح.", token, {
            reply_markup: { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "cnt_part_cancel" }]] },
          });
          return true;
        }
        state.temp.parts.push({ type: result.partType, fileId: result.fileId, caption: "" });
        added = true;
      } else {
        state.temp.parts.push({ type: "text", content: msg.text });
        added = true;
      }
    } else if (msg.photo) {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      state.temp.parts.push({ type: "photo", fileId, caption: msg.caption || "" });
      added = true;
    } else if (msg.video) {
      state.temp.parts.push({ type: "video", fileId: msg.video.file_id, caption: msg.caption || "" });
      added = true;
    }

    if (!added) {
      await sendMessage(chatId, "❌ نوع غير مدعوم. أرسل نصاً، صورة، فيديو، أو رابط تويتر/X.", token);
      return true;
    }

    const count = state.temp.parts.length;
    await sendMessage(chatId, `✅ <b>تمت إضافة الجزء ${count}</b>\n\nهل تريد إضافة المزيد أم الانتهاء؟`, token, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "➕ إضافة المزيد", callback_data: "cnt_part_addmore" },
            { text: "✅ انتهيت وحفظ", callback_data: "cnt_part_done" },
          ],
          [{ text: "❌ إلغاء الكل", callback_data: "cnt_part_cancel" }],
        ],
      },
    });
    return true;
  }

  if (state.action === "cnt_addpart_existing" && state.step === "waiting_part") {
    const contentId = state.temp.contentId;
    const item = data.content?.items?.[contentId];
    if (!item) {
      clearAdminState(userId);
      return true;
    }
    if (!item.parts) item.parts = [];

    let added = false;
    if (msg.text && !msg.text.startsWith("/")) {
      if (isTwitterUrl(msg.text)) {
        await sendMessage(chatId, "⏳ جارٍ جلب الفيديو من تويتر/X...", token);
        const result = await sendTwitterVideo(chatId, msg.text, "", token);
        if (!result) {
          await sendMessage(chatId, "❌ لم أتمكن من جلب الفيديو. تأكد أن التغريدة تحتوي فيديو والرابط صحيح.", token);
          return true;
        }
        item.parts.push({ type: result.partType, fileId: result.fileId, caption: "" });
        added = true;
      } else {
        item.parts.push({ type: "text", content: msg.text });
        added = true;
      }
    } else if (msg.photo) {
      item.parts.push({ type: "photo", fileId: msg.photo[msg.photo.length - 1].file_id, caption: msg.caption || "" });
      added = true;
    } else if (msg.video) {
      item.parts.push({ type: "video", fileId: msg.video.file_id, caption: msg.caption || "" });
      added = true;
    }

    if (!added) {
      await sendMessage(chatId, "❌ نوع غير مدعوم. أرسل نصاً، صورة، فيديو، أو رابط تويتر/X.", token);
      return true;
    }
    await saveData(env);
    clearAdminState(userId);
    const m = contentDetailMenu(contentId);
    await sendMessage(chatId, `✅ تمت إضافة الجزء. الإجمالي: ${item.parts.length}`, token, { reply_markup: m?.keyboard });
    return true;
  }

  if (state.action === "cnt_edit_title" && state.step === "waiting_title") {
    const newTitle = text.trim();
    const contentId = state.temp.contentId;
    if (!newTitle || newTitle.length < 2) {
      await sendMessage(chatId, "❌ العنوان قصير جداً.", token);
      return true;
    }
    if (data.content?.items?.[contentId]) {
      data.content.items[contentId].title = newTitle;
      await saveData(env);
      const m = contentDetailMenu(contentId);
      await sendMessage(chatId, `✅ تم تحديث العنوان إلى: <b>${newTitle}</b>`, token, { reply_markup: m?.keyboard });
    }
    clearAdminState(userId);
    return true;
  }

  if (state.action === "cnt_admin_search" && state.step === "waiting_id") {
    const query = text.trim();
    clearAdminState(userId);
    const items = Object.values(data.content?.items || {});
    const found = items.filter((i) => i.id === query || i.title.toLowerCase().includes(query.toLowerCase()));
    if (found.length === 0) {
      await sendMessage(chatId, `❌ لم يُعثر على محتوى بـ: <code>${query}</code>`, token);
      return true;
    }
    if (found.length === 1) {
      const m = contentDetailMenu(found[0].id);
      await sendMessage(chatId, m.text, token, { reply_markup: m.keyboard });
    } else {
      const buttons = found.slice(0, 10).map((i) => [
        { text: `${i.id} — ${i.title.substring(0, 30)}`, callback_data: "cnt_detail_" + i.id },
      ]);
      buttons.push([{ text: "🔙 رجوع", callback_data: "admin_content" }]);
      await sendMessage(chatId, `🔍 وُجد ${found.length} نتيجة:`, token, {
        reply_markup: { inline_keyboard: buttons },
      });
    }
    return true;
  }

  // ====================================================================
  // ===== إعدادات الاشتراك الإجباري =====
  // ====================================================================

  if (state.action === "fs_setting_verify_text" && state.step === "waiting_input") {
    data.forcedSubscription.settings.verifyButtonText = text;
    await saveData(env);
    const menu = forcedSubscriptionSettingsMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    await sendMessage(chatId, "✅ تم تحديث زر التحقق.", token);
    clearAdminState(userId);
    return true;
  }

  if (state.action === "fs_setting_grouped_message" && state.step === "waiting_input") {
    data.forcedSubscription.settings.groupedMessage = text;
    await saveData(env);
    const menu = forcedSubscriptionSettingsMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    await sendMessage(chatId, "✅ تم تحديث رسالة العرض.", token);
    clearAdminState(userId);
    return true;
  }

  // ===== إضافة اشتراك إجباري =====
  if (state.action === "fs_add_data" && state.step === "waiting_id") {
    state.temp.id = text.trim();
    state.step = "waiting_name";
    await sendMessage(chatId, "📝 <b>أدخل اسم الاشتراك:</b>", token);
    return true;
  }

  if (state.action === "fs_add_data" && state.step === "waiting_name") {
    const type = state.temp.type;
    const rawInput = state.temp.id;
    const name = text.trim();
    const baseType = type.replace("_private", "");
    let telegramId = null;
    let link = rawInput;

    if (baseType === "link") {
      telegramId = null;
      link = rawInput;
    } else if (type === "channel_private" || type === "group_private") {
      telegramId = null;
      link = rawInput;
    } else {
      if (rawInput.startsWith("-") || /^\d+$/.test(rawInput)) {
        telegramId = rawInput;
        link = `https://t.me/${rawInput}`;
      } else {
        const username = rawInput.startsWith("@") ? rawInput : "@" + rawInput;
        telegramId = username;
        link = `https://t.me/${username.replace("@", "")}`;
      }
    }

    const newSub = {
      id: Date.now().toString(36),
      telegramId,
      type: baseType,
      name,
      link,
      enabled: true,
    };

    if (!data.forcedSubscription.list) data.forcedSubscription.list = [];
    data.forcedSubscription.list.push(newSub);
    data.forcedSubscription.userStatus = {};
    await saveData(env);
    await sendMessage(chatId, `✅ تم إضافة الاشتراك!\n📌 النوع: ${baseType}\n📌 الاسم: ${name}${telegramId ? "\n🔢 المعرف: " + telegramId : ""}`, token);
    const menu = forcedSubscriptionMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    clearAdminState(userId);
    return true;
  }

  // ===== تعديل اشتراك =====
  if (state.action === "fs_edit_data" && state.step === "waiting_edit_value") {
    const index = state.temp.index;
    const field = state.temp.editField;
    const fs = data.forcedSubscription;
    if (fs.list && fs.list[index]) {
      if (field === "name") fs.list[index].name = text;
      else if (field === "link") fs.list[index].link = text;
      else if (field === "message") fs.list[index].message = text;
      await saveData(env);
      await sendMessage(chatId, "✅ تم تحديث الاشتراك.", token);
      const menu = forcedSubscriptionMenu();
      await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
        reply_markup: menu.keyboard,
      });
    }
    clearAdminState(userId);
    return true;
  }

  // ===== وسائط رسالة الترحيب =====
  if (state.action === "upload_welcome_media" && state.step === "waiting_media") {
    if (msg.photo) {
      data.welcome.mediaType = "photo";
      data.welcome.mediaFileId = msg.photo[msg.photo.length - 1].file_id;
    } else if (msg.video) {
      data.welcome.mediaType = "video";
      data.welcome.mediaFileId = msg.video.file_id;
    } else if (msg.document) {
      data.welcome.mediaType = "document";
      data.welcome.mediaFileId = msg.document.file_id;
    } else if (msg.animation) {
      data.welcome.mediaType = "animation";
      data.welcome.mediaFileId = msg.animation.file_id;
    } else {
      await sendMessage(chatId, "❌ أرسل صورة، فيديو، ملف، أو GIF.", token);
      return true;
    }
    await saveData(env);
    const menu = welcomeMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    await sendMessage(chatId, "✅ تم تحديث وسائط رسالة الترحيب!", token);
    clearAdminState(userId);
    return true;
  }

  // ===== إضافة/حذف مستخدم من التحقق =====
  if (state.action === "verif_add_user" && state.step === "text") {
    const targetId = text.trim();
    if (!data.verification.verifiedUsers) data.verification.verifiedUsers = {};
    const u = data.users[targetId] || {};
    data.verification.verifiedUsers[targetId] = {
      name: u.name || "مستخدم",
      date: new Date().toISOString(),
    };
    await saveData(env);
    await sendMessage(chatId, `✅ تم إضافة المستخدم <code>${targetId}</code> للمحققين.`, token);
    const menu = verificationListMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    clearAdminState(userId);
    return true;
  }

  if (state.action === "verif_remove_user" && state.step === "text") {
    const targetId = text.trim();
    if (data.verification.verifiedUsers?.[targetId]) delete data.verification.verifiedUsers[targetId];
    if (data.verification.rejectedUsers?.[targetId]) delete data.verification.rejectedUsers[targetId];
    await saveData(env);
    await sendMessage(chatId, `✅ تم حذف المستخدم <code>${targetId}</code> من قائمة التحقق.`, token);
    const menu = verificationListMenu();
    await editMessage(state.temp.chatId, state.temp.msgId, menu.text, token, {
      reply_markup: menu.keyboard,
    });
    clearAdminState(userId);
    return true;
  }

  return false;
}

// ====================================================================
// ========== معالجة كولباك الأدمن ==========
// ====================================================================

async function handleAdminCallback(userId, cbData, chatId, msgId, token, env) {
  const state = getAdminState(userId);

  // ===== التنقل الرئيسي =====
  if (cbData === "admin_back") {
    const m = adminMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "settings_back") {
    const m = settingsMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "verif_back") {
    const m = verificationMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "cancel") {
    clearAdminState(userId);
    const m = adminMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }

  // ===== الإعدادات =====
  if (cbData === "admin_settings") {
    const m = settingsMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "settings_bot_toggle") {
    const m = botSettingsMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "bot_toggle") {
    data.settings.botActive = !data.settings.botActive;
    await saveData(env);
    const m = botSettingsMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "bot_edit_stop") {
    state.action = "edit_stop";
    state.step = "text";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "📝 أدخل رسالة الإيقاف الجديدة:\n\nالحالية:\n" + data.settings.stopMessage, token);
    return;
  }

  // ===== الإحصائيات =====
  if (cbData === "admin_stats") {
    const m = statsMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "stats_daily") {
    const daily = data.stats?.dailyActive || {};
    const keys = Object.keys(daily).sort().slice(-7);
    let text = "📈 <b>إحصائيات آخر 7 أيام</b>\n\n";
    for (const k of keys) {
      const count = typeof daily[k] === "object" ? Object.keys(daily[k]).length : 0;
      text += `📅 ${k}: <b>${count}</b> مستخدم نشط\n`;
    }
    if (keys.length === 0) text += "لا توجد بيانات بعد.";
    await sendMessage(chatId, text, token, { bypass_protection: true });
    return;
  }

  // ===== التحقق =====
  if (cbData === "settings_verification") {
    const m = verificationMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "verif_toggle") {
    data.verification.enabled = !data.verification.enabled;
    if (data.verification.enabled) {
      data.verification.verifiedUsers = {};
      data.verification.rejectedUsers = {};
      data.verification.pendingUsers = {};
      await sendMessage(chatId, "✅ تم تفعيل التحقق، وسيُطلب من جميع المستخدمين التحقق من جديد.", token);
    } else {
      await sendMessage(chatId, "✅ تم تعطيل التحقق، يمكن لجميع المستخدمين استخدام البوت.", token);
    }
    await saveData(env);
    const m = verificationMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "verif_messages") {
    const m = verificationMessagesMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "verif_msg_request") {
    state.action = "edit_verif_msg";
    state.step = "text";
    state.temp = { chatId, msgId, field: "requestMessage" };
    await sendMessage(chatId, "📝 أدخل نص طلب الرقم الجديد:\n\nالحالي:\n" + data.verification.requestMessage, token);
    return;
  }
  if (cbData === "verif_msg_button") {
    state.action = "edit_verif_msg";
    state.step = "text";
    state.temp = { chatId, msgId, field: "buttonText" };
    await sendMessage(chatId, "📝 أدخل نص الزر الجديد:\n\nالحالي:\n" + data.verification.buttonText, token);
    return;
  }
  if (cbData === "verif_msg_success") {
    state.action = "edit_verif_msg";
    state.step = "text";
    state.temp = { chatId, msgId, field: "successMessage" };
    await sendMessage(chatId, "📝 أدخل رسالة النجاح الجديدة:\n\nالحالية:\n" + data.verification.successMessage, token);
    return;
  }
  if (cbData === "verif_msg_fail") {
    state.action = "edit_verif_msg";
    state.step = "text";
    state.temp = { chatId, msgId, field: "failMessage" };
    await sendMessage(chatId, "📝 أدخل رسالة الرفض الجديدة:\n\nالحالية:\n" + data.verification.failMessage, token);
    return;
  }
  if (cbData === "verif_channel") {
    state.action = "set_verif_channel";
    state.step = "text";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "📝 أدخل معرف قناة التحقق:\n(يجب أن يكون البوت أدمن في القناة)", token);
    return;
  }
  if (cbData === "verif_list") {
    const m = verificationListMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }

  // ===== الطلبات المعلقة =====
  if (cbData === "verif_pending") {
    const pending = Object.entries(data.verification.pendingUsers || {});
    if (pending.length === 0) {
      await editMessage(chatId, msgId, "⏳ <b>لا توجد طلبات معلقة حالياً</b>", token, {
        reply_markup: { inline_keyboard: [[{ text: "🔙 رجوع", callback_data: "verif_back" }]] },
      });
      return;
    }
    let text = `⏳ <b>الطلبات المعلقة</b> — <b>${pending.length}</b> طلب\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    const buttons = [];
    for (const [id, u] of pending.slice(0, 10)) {
      const c = getCountryFromPhone(u.phone);
      text += `👤 <b>${u.name || "غير معروف"}</b>\n`;
      text += `🔢 <code>${id}</code>`;
      if (u.username) text += `  |  @${u.username}`;
      text += `\n📱 <code>+${String(u.phone || "").replace(/\D/g,"")}</code>  ${c.flag} ${c.name}\n`;
      text += `📅 ${formatDate(u.date)}\n`;
      text += `─────────────────\n`;
      buttons.push([
        { text: `✅ قبول — ${u.name || id}`, callback_data: "verif_approve_" + id },
        { text: "❌ رفض", callback_data: "verif_reject_" + id },
      ]);
    }
    if (pending.length > 10) text += `\n<i>... و ${pending.length - 10} طلبات أخرى</i>`;
    buttons.push([{ text: "🔙 رجوع", callback_data: "verif_back" }]);
    await editMessage(chatId, msgId, text, token, { reply_markup: { inline_keyboard: buttons } });
    return;
  }

  if (cbData === "verif_list_verified") {
    const v = data.verification.verifiedUsers || {};
    const keys = Object.keys(v);
    let text = `✅ <b>المستخدمون المحققون</b> — <b>${keys.length}</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    if (keys.length === 0) {
      text += "لا يوجد مستخدمون محققون بعد.";
    } else {
      keys.slice(0, 15).forEach((id) => {
        const u = v[id];
        const c = getCountryFromPhone(u.phone);
        text += `👤 <b>${u.name || "غير معروف"}</b>  ${u.phone ? c.flag : ""}\n`;
        text += `🔢 <code>${id}</code>`;
        if (u.phone) text += `  📱 <code>+${String(u.phone).replace(/\D/g,"")}</code>`;
        text += `\n📅 ${formatDate(u.date)}\n─────\n`;
      });
      if (keys.length > 15) text += `\n<i>... و ${keys.length - 15} آخرون</i>`;
    }
    await sendMessage(chatId, text, token, { bypass_protection: true });
    return;
  }

  if (cbData === "verif_list_rejected") {
    const v = data.verification.rejectedUsers || {};
    const keys = Object.keys(v);
    if (keys.length === 0) {
      await sendMessage(chatId, "❌ لا يوجد مستخدمون مرفوضون.", token);
      return;
    }
    const buttons = keys.slice(0, 10).map((id) => [
      { text: `✅ ${id}`, callback_data: "verif_reapprove_" + id },
      { text: "🗑️ حذف", callback_data: "verif_delete_rejected_" + id },
    ]);
    buttons.push([{ text: "🔙 رجوع", callback_data: "verif_back" }]);
    await editMessage(chatId, msgId, `❌ <b>المرفوضون (${keys.length})</b>\n\nاختر إجراء:`, token, {
      reply_markup: { inline_keyboard: buttons },
    });
    return;
  }

  if (cbData.startsWith("verif_reapprove_")) {
    const targetId = cbData.replace("verif_reapprove_", "");
    if (data.verification.rejectedUsers?.[targetId]) {
      const user = data.verification.rejectedUsers[targetId];
      if (!data.verification.verifiedUsers) data.verification.verifiedUsers = {};
      data.verification.verifiedUsers[targetId] = {
        name: user.name,
        phone: user.phone,
        date: new Date().toISOString(),
        reapproved: true,
      };
      delete data.verification.rejectedUsers[targetId];
      await saveData(env);
      const fsOk = await checkForcedSubscription(targetId, token);
      if (!fsOk) {
        await showForcedSubscription(chatId, targetId, token);
        await editMessage(chatId, msgId, `✅ تم قبول المستخدم، لكن يجب إكمال الاشتراك أولاً.`, token);
        return;
      }
      await sendMessage(targetId, "✅ تم قبول طلبك!\n\n" + data.verification.successMessage, token, {
        reply_markup: getUserKeyboard(),
      });
      const rc = getCountryFromPhone(user.phone);
      await editMessage(chatId, msgId,
`✅ <b>تمت إعادة قبول المستخدم</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>${user.name || "غير معروف"}</b>
🆔 ${user.username ? "@" + user.username : "<i>لا يوجد يوزرنيم</i>"}
🔢 <code>${targetId}</code>
${user.phone ? `📱 <code>+${String(user.phone).replace(/\D/g,"")}</code>  ${rc.flag} ${rc.name}` : ""}
📅 ${formatDate(new Date().toISOString())}`, token);
    }
    return;
  }

  if (cbData.startsWith("verif_delete_rejected_")) {
    const targetId = cbData.replace("verif_delete_rejected_", "");
    if (data.verification.rejectedUsers?.[targetId]) {
      delete data.verification.rejectedUsers[targetId];
      await saveData(env);
      await editMessage(chatId, msgId, "🗑️ تم حذف السجل.", token);
    }
    return;
  }

  if (cbData === "verif_add_user") {
    state.action = "verif_add_user";
    state.step = "text";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "📝 أدخل ID المستخدم للإضافة للمحققين:", token);
    return;
  }

  if (cbData === "verif_remove_user") {
    state.action = "verif_remove_user";
    state.step = "text";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "📝 أدخل ID المستخدم لحذفه من التحقق:", token);
    return;
  }

  if (cbData.startsWith("verif_approve_")) {
    const targetId = cbData.replace("verif_approve_", "");
    if (data.verification.pendingUsers?.[targetId]) {
      const user = data.verification.pendingUsers[targetId];
      if (!data.verification.verifiedUsers) data.verification.verifiedUsers = {};
      data.verification.verifiedUsers[targetId] = {
        name: user.name,
        phone: user.phone,
        date: new Date().toISOString(),
      };
      if (data.users[targetId]) data.users[targetId].phone = user.phone;
      delete data.verification.pendingUsers[targetId];
      await saveData(env);
      const approveCountry = getCountryFromPhone(user.phone);
      const fsOk = await checkForcedSubscription(targetId, token);
      if (!fsOk) {
        await showForcedSubscription(chatId, targetId, token);
        await editMessage(chatId, msgId, `✅ تم قبول المستخدم، لكن يجب إكمال الاشتراك أولاً.`, token);
        return;
      }
      await editMessage(chatId, msgId,
`✅ <b>تم قبول المستخدم</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>${user.name || "غير معروف"}</b>
🆔 ${user.username ? "@" + user.username : "<i>لا يوجد يوزرنيم</i>"}
🔢 <code>${targetId}</code>
📱 <code>+${String(user.phone || "").replace(/\D/g,"")}</code>
${approveCountry.flag} ${approveCountry.name}
📅 ${formatDate(new Date().toISOString())}`, token);
      await sendMessage(targetId, data.verification.successMessage, token, {
        reply_markup: getUserKeyboard(),
      });
    }
    return;
  }

  if (cbData.startsWith("verif_reject_")) {
    const targetId = cbData.replace("verif_reject_", "");
    if (data.verification.pendingUsers?.[targetId]) {
      const user = data.verification.pendingUsers[targetId];
      if (!data.verification.rejectedUsers) data.verification.rejectedUsers = {};
      data.verification.rejectedUsers[targetId] = {
        name: user.name,
        username: user.username,
        phone: user.phone,
        date: new Date().toISOString(),
      };
      delete data.verification.pendingUsers[targetId];
      await saveData(env);
      const rejectCountry = getCountryFromPhone(user.phone);
      await editMessage(chatId, msgId,
`❌ <b>تم رفض المستخدم</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>${user.name || "غير معروف"}</b>
🆔 ${user.username ? "@" + user.username : "<i>لا يوجد يوزرنيم</i>"}
🔢 <code>${targetId}</code>
📱 <code>+${String(user.phone || "").replace(/\D/g,"")}</code>
${rejectCountry.flag} ${rejectCountry.name}
📅 ${formatDate(new Date().toISOString())}`, token);
      await sendMessage(targetId, data.verification.failMessage, token);
    }
    return;
  }

  // ===== الحماية =====
  if (cbData === "settings_protection") {
    const m = protectionMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "protect_toggle") {
    data.protection.enabled = !data.protection.enabled;
    await saveData(env);
    const m = protectionMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }

  // ===== الإشعارات =====
  if (cbData === "settings_notifications") {
    const m = notificationsMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "notif_toggle") {
    data.notifications.enabled = !data.notifications.enabled;
    setLogEnabled(data.notifications.enabled);
    await saveData(env);
    const m = notificationsMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "notif_channel") {
    state.action = "set_notif_channel";
    state.step = "text";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "📝 أدخل معرف قناة الإشعارات:\n(يجب أن يكون البوت أدمن فيها)", token);
    return;
  }
  if (cbData === "notif_toggle_logall") {
    data.notifications.logAllActions = data.notifications.logAllActions === false ? true : false;
    setLogAllActions(data.notifications.logAllActions);
    await saveData(env);
    const m = notificationsMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }

  // ===== مكافحة السبام =====
  if (cbData === "settings_antispam") {
    const m = antiSpamMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "antispam_toggle") {
    if (!data.settings.antiSpam) data.settings.antiSpam = { enabled: false, maxMessages: 5, interval: 10, action: "warn" };
    data.settings.antiSpam.enabled = !data.settings.antiSpam.enabled;
    await saveData(env);
    const m = antiSpamMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "antispam_limit") {
    state.action = "antispam_limit";
    state.step = "text";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, `📊 أدخل الحد الأقصى بالصيغة: <code>عدد_الرسائل/ثوانٍ</code>\n\nمثال: <code>5/10</code> (5 رسائل خلال 10 ثوانٍ)\n\nالحالي: ${data.settings.antiSpam?.maxMessages || 5}/${data.settings.antiSpam?.interval || 10}`, token);
    return;
  }
  if (cbData === "antispam_action") {
    const current = data.settings.antiSpam?.action || "warn";
    const actions = ["warn", "mute", "ban"];
    const next = actions[(actions.indexOf(current) + 1) % actions.length];
    if (!data.settings.antiSpam) data.settings.antiSpam = { enabled: false, maxMessages: 5, interval: 10, action: "warn" };
    data.settings.antiSpam.action = next;
    await saveData(env);
    const m = antiSpamMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }

  // ===== رسالة الترحيب =====
  if (cbData === "admin_welcome") {
    const m = welcomeMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "welcome_edit_text") {
    state.action = "edit_welcome";
    state.step = "text";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "📝 أدخل نص الترحيب الجديد:\n(يمكنك استخدام HTML)\n\nالحالي:\n" + data.welcome.text, token);
    return;
  }
  if (cbData === "welcome_edit_registered") {
    state.action = "edit_registered";
    state.step = "text";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "📝 أدخل رسالة العودة الجديدة:\n(يمكنك استخدام HTML)\n\nالحالية:\n" + data.welcome.registeredMessage, token);
    return;
  }
  if (cbData === "welcome_toggle_html") {
    data.welcome.useHtml = !data.welcome.useHtml;
    await saveData(env);
    const m = welcomeMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "welcome_delete_media") {
    data.welcome.mediaType = null;
    data.welcome.mediaFileId = null;
    data.welcome.image = null;
    await saveData(env);
    const m = welcomeMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    await sendMessage(chatId, "🗑️ تم حذف الوسائط.", token);
    return;
  }
  if (cbData === "welcome_media_photo" || cbData === "welcome_media_video" || cbData === "welcome_media_doc" || cbData === "welcome_media_gif") {
    const typeMap = { welcome_media_photo: "صورة", welcome_media_video: "فيديو", welcome_media_doc: "ملف", welcome_media_gif: "GIF" };
    state.action = "upload_welcome_media";
    state.step = "waiting_media";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, `🖼️ أرسل ${typeMap[cbData]} لرسالة الترحيب:`, token);
    return;
  }
  if (cbData === "welcome_preview") {
    const w = data.welcome;
    const previewText = `📋 <b>معاينة رسالة الترحيب</b>\n\n👤 <b>للمستخدم الجديد:</b>\n${w.text}\n\n📦 <b>للمستخدم المسجل:</b>\n${w.registeredMessage}`;
    const mediaType = w.mediaType || (w.image ? "photo" : null);
    const mediaFileId = w.mediaFileId || w.image || null;
    await sendMedia(chatId, mediaType, mediaFileId, previewText, token, { bypass_protection: true });
    return;
  }

  // ===== الأوامر =====
  if (cbData === "admin_commands") {
    const m = commandsMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "cmd_add") {
    state.action = "cmd_add";
    state.step = "cmd";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "📝 أدخل اسم الأمر:\n(أحرف إنجليزية وأرقام فقط، بدون /)", token);
    return;
  }
  if (cbData === "cmd_edit") {
    const all = Object.keys(data.commands || {});
    if (all.length === 0) { await sendMessage(chatId, "⚠️ لا توجد أوامر.", token); return; }
    state.action = "cmd_edit";
    state.step = "cmd";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "📝 أدخل اسم الأمر للتعديل:\n\n" + all.map((c) => `• /${c}`).join("\n"), token);
    return;
  }
  if (cbData === "cmd_edit_field_desc") {
    if (!state.temp?.editCmd || !data.commands?.[state.temp.editCmd]) {
      await sendMessage(chatId, "⚠️ انتهت الجلسة. ابدأ من جديد.", token);
      clearAdminState(userId);
      return;
    }
    state.step = "new_desc";
    await sendMessage(chatId, `📝 أدخل الوصف الجديد لـ /${state.temp.editCmd}:\n\nالحالي: ${data.commands[state.temp.editCmd].description}`, token);
    return;
  }
  if (cbData === "cmd_edit_field_response") {
    if (!state.temp?.editCmd || !data.commands?.[state.temp.editCmd]) {
      await sendMessage(chatId, "⚠️ انتهت الجلسة. ابدأ من جديد.", token);
      clearAdminState(userId);
      return;
    }
    state.step = "new_response";
    await sendMessage(chatId, `📝 أدخل نص الرد الجديد لـ /${state.temp.editCmd}:\n\nالحالي: ${data.commands[state.temp.editCmd].response || "-"}`, token);
    return;
  }
  if (cbData === "cmd_delete") {
    const all = Object.keys(data.commands || {});
    if (all.length === 0) { await sendMessage(chatId, "⚠️ لا توجد أوامر.", token); return; }
    state.action = "cmd_delete";
    state.step = "cmd";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "📝 أدخل اسم الأمر للحذف:\n\n" + all.map((c) => `• /${c}`).join("\n"), token);
    return;
  }
  if (cbData === "cmd_toggle") {
    const all = Object.keys(data.commands || {});
    if (all.length === 0) { await sendMessage(chatId, "⚠️ لا توجد أوامر.", token); return; }
    state.action = "cmd_toggle";
    state.step = "cmd";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "📝 أدخل اسم الأمر:\n\n" + all.map((c) => `• /${c} (${data.commands[c].enabled ? "مفعل" : "معطل"})`).join("\n"), token);
    return;
  }
  if (cbData === "cmd_media") {
    const all = Object.keys(data.commands || {});
    if (all.length === 0) { await sendMessage(chatId, "⚠️ لا توجد أوامر.", token); return; }
    state.action = "cmd_media_select";
    state.step = "cmd";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "📝 أدخل اسم الأمر لتحديث وسائطه:\n\n" + all.map((c) => `• /${c}${data.commands[c].mediaType ? " 🖼️" : ""}`).join("\n"), token);
    return;
  }

  // ===== المستخدمون =====
  if (cbData === "admin_users") {
    const m = usersMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "users_list") {
    const m = usersListMenu(1);
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData.startsWith("users_page_")) {
    const page = parseInt(cbData.replace("users_page_", ""));
    const m = usersListMenu(page);
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "users_search") {
    state.action = "users_search";
    state.step = "text";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "🔍 أدخل اسم المستخدم، ID، أو رقم الهاتف للبحث:", token);
    return;
  }
  if (cbData === "users_export") {
    const users = Object.keys(data.users || {});
    if (users.length === 0) { await sendMessage(chatId, "⚠️ لا يوجد مستخدمون.", token); return; }
    await sendMessage(chatId, `📤 <b>قائمة IDs المستخدمين (${users.length})</b>\n\n<code>${users.join("\n")}</code>`, token, { bypass_protection: true });
    return;
  }
  if (cbData === "users_delete") {
    const users = Object.keys(data.users || {});
    if (users.length === 0) { await sendMessage(chatId, "⚠️ لا يوجد مستخدمون.", token); return; }
    const buttons = users.slice(0, 15).map((uid) => [{ text: `🗑️ ${data.users[uid]?.name || uid}`, callback_data: "users_delete_confirm_" + uid }]);
    buttons.push([{ text: "🔙 رجوع", callback_data: "admin_users" }]);
    await editMessage(chatId, msgId, "🗑️ <b>اختر مستخدماً للحذف:</b>", token, { reply_markup: { inline_keyboard: buttons } });
    return;
  }
  if (cbData.startsWith("users_delete_confirm_")) {
    const targetId = cbData.replace("users_delete_confirm_", "");
    if (data.users?.[targetId]) {
      delete data.users[targetId];
      if (data.verification.verifiedUsers?.[targetId]) delete data.verification.verifiedUsers[targetId];
      if (data.verification.rejectedUsers?.[targetId]) delete data.verification.rejectedUsers[targetId];
      if (data.verification.pendingUsers?.[targetId]) delete data.verification.pendingUsers[targetId];
      await saveData(env);
      await sendMessage(chatId, `✅ تم حذف المستخدم <code>${targetId}</code>`, token);
      const m = usersMenu();
      await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    }
    return;
  }

  // ===== المحظورون =====
  if (cbData === "admin_banned") {
    const m = bannedMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "ban_user") {
    state.action = "ban_user";
    state.step = "id";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "📝 أدخل ID المستخدم المراد حظره:", token);
    return;
  }
  if (cbData === "unban_user") {
    const banned = Object.keys(data.bannedUsers || {});
    if (banned.length === 0) { await sendMessage(chatId, "⚠️ لا يوجد مستخدمون محظورون.", token); return; }
    state.action = "unban_user";
    state.step = "text";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "📝 أدخل ID المستخدم لرفع الحظر:\n\n" + banned.map((id) => `• <code>${id}</code> - ${data.bannedUsers[id]?.name || ""}`).join("\n"), token);
    return;
  }

  // ===== الرسائل الجماعية =====
  if (cbData === "admin_broadcast") {
    const m = broadcastMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "bc_text" || cbData === "bc_photo" || cbData === "bc_video" || cbData === "bc_doc") {
    const typeMap = { bc_text: "نصية", bc_photo: "صورة", bc_video: "فيديو", bc_doc: "ملف" };
    state.action = "broadcast";
    state.step = "message";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, `📢 أرسل ${typeMap[cbData]} لإرسالها لجميع المستخدمين:`, token);
    return;
  }
  if (cbData === "bc_history") {
    const history = data.broadcast?.history || [];
    let text = `📋 <b>سجل الرسائل الجماعية (${history.length})</b>\n\n`;
    if (history.length === 0) text += "لا يوجد سجل.";
    else {
      for (const h of history.slice(-10).reverse()) {
        text += `📅 ${formatDate(h.date)} | ${h.type}\n✅ ${h.success} | ❌ ${h.fail}\n─────\n`;
      }
    }
    await sendMessage(chatId, text, token, { bypass_protection: true });
    return;
  }

  // ===== الرسائل المباشرة =====
  if (cbData === "admin_direct_msg") {
    state.action = "direct_msg";
    state.step = "id";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "📝 أدخل ID المستخدم الذي تريد إرسال رسالة له:", token);
    return;
  }

  // ===== الأدمنات =====
  if (cbData === "admin_admins") {
    const m = adminsMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "admins_add") {
    state.action = "admins_add";
    state.step = "text";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "📝 أدخل ID المستخدم لمنحه صلاحيات الأدمن:", token);
    return;
  }
  if (cbData === "admins_remove") {
    const admins = data.settings.admins || [];
    if (admins.length === 0) { await sendMessage(chatId, "⚠️ لا يوجد أدمنات إضافيون.", token); return; }
    state.action = "admins_remove";
    state.step = "text";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "📝 أدخل ID الأدمن لإزالته:\n\n" + admins.map((id) => `• <code>${id}</code>`).join("\n"), token);
    return;
  }

  // ===== النسخ الاحتياطي =====
  if (cbData === "admin_backup") {
    const backup = {
      version: "2.3",
      date: new Date().toISOString(),
      users: Object.keys(data.users || {}).length,
      commands: Object.keys(data.commands || {}).length,
      settings: data.settings,
      welcome: { text: data.welcome.text, registeredMessage: data.welcome.registeredMessage },
      forcedSubscription: { enabled: data.forcedSubscription.enabled, count: (data.forcedSubscription.list || []).length },
    };
    await sendMessage(chatId, `💾 <b>نسخة احتياطية - ملخص</b>\n\n📅 التاريخ: ${formatDate(backup.date)}\n👥 المستخدمون: ${backup.users}\n📋 الأوامر: ${backup.commands}\n\n⚠️ النسخ الاحتياطية الكاملة تتطلب الوصول لـ KV مباشرةً.\n\n<code>${JSON.stringify(backup, null, 2)}</code>`, token, { bypass_protection: true });
    return;
  }

  // ===== الاشتراك الإجباري =====
  if (cbData === "admin_forced_subscription" || cbData === "settings_forced_subscription") {
    const m = forcedSubscriptionMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "fs_toggle_all") {
    data.forcedSubscription.enabled = !data.forcedSubscription.enabled;
    await saveData(env);
    const m = forcedSubscriptionMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "fs_add") {
    state.action = "fs_add_type";
    state.step = "choose_type";
    state.temp = { chatId, msgId };
    const types = [
      [{ text: "📢 قناة عامة", callback_data: "fs_type_channel" }, { text: "🔒📢 قناة خاصة", callback_data: "fs_type_channel_private" }],
      [{ text: "👥 مجموعة عامة", callback_data: "fs_type_group" }, { text: "🔒👥 مجموعة خاصة", callback_data: "fs_type_group_private" }],
      [{ text: "🤖 بوت", callback_data: "fs_type_bot" }, { text: "🔗 رابط", callback_data: "fs_type_link" }],
      [{ text: "🔙 إلغاء", callback_data: "admin_forced_subscription" }],
    ];
    await sendMessage(chatId, "📝 اختر نوع الاشتراك:", token, { reply_markup: { inline_keyboard: types } });
    return;
  }
  if (cbData.startsWith("fs_type_")) {
    const type = cbData.replace("fs_type_", "");
    state.action = "fs_add_data";
    state.step = "waiting_id";
    state.temp = { ...state.temp, type, chatId, msgId };
    const prompts = {
      channel: "📢 أدخل معرف القناة:\n(مثال: @mychannel أو -100xxxxxxxxx)",
      channel_private: "🔒📢 أرسل رابط الدعوة للقناة الخاصة:\n(مثال: https://t.me/+xxxxxx)",
      group: "👥 أدخل معرف المجموعة:\n(مثال: @mygroup)",
      group_private: "🔒👥 أرسل رابط الدعوة للمجموعة الخاصة:\n(مثال: https://t.me/+xxxxxx)",
      bot: "🤖 أدخل معرف البوت:\n(مثال: @mybot)",
      link: "🔗 أدخل الرابط المطلوب:\n(مثال: https://youtube.com/...)",
    };
    await sendMessage(chatId, prompts[type] || "📝 أدخل المعرف:", token);
    return;
  }
  if (cbData === "fs_edit") {
    const fs = data.forcedSubscription;
    if (!fs.list?.length) { await sendMessage(chatId, "⚠️ لا توجد اشتراكات لتعديلها.", token); return; }
    const buttons = fs.list.map((s, i) => [{ text: `✏️ ${s.name || s.type + " " + (i + 1)}`, callback_data: "fs_edit_select_" + i }]);
    buttons.push([{ text: "🔙 رجوع", callback_data: "admin_forced_subscription" }]);
    await editMessage(chatId, msgId, "✏️ <b>اختر اشتراكاً لتعديله:</b>", token, { reply_markup: { inline_keyboard: buttons } });
    return;
  }
  if (cbData.startsWith("fs_edit_select_")) {
    const index = parseInt(cbData.replace("fs_edit_select_", ""));
    const sub = data.forcedSubscription.list?.[index];
    if (!sub) { await sendMessage(chatId, "⚠️ الاشتراك غير موجود.", token); return; }
    state.action = "fs_edit_data";
    state.step = "choose_field";
    state.temp = { index, chatId, msgId };
    const buttons = [
      [{ text: "✏️ الاسم", callback_data: "fs_edit_field_name" }, { text: "✏️ الرابط", callback_data: "fs_edit_field_link" }],
      [{ text: "✏️ الرسالة", callback_data: "fs_edit_field_message" }],
      [{ text: "🔄 " + (sub.enabled !== false ? "تعطيل" : "تفعيل"), callback_data: "fs_edit_field_toggle" }],
      [{ text: "🔙 رجوع", callback_data: "admin_forced_subscription" }],
    ];
    await editMessage(chatId, msgId, `✏️ <b>تعديل:</b> ${sub.name || sub.type}\n\n🔗 ${sub.link || "-"}`, token, { reply_markup: { inline_keyboard: buttons } });
    return;
  }
  if (cbData.startsWith("fs_edit_field_")) {
    const field = cbData.replace("fs_edit_field_", "");
    const index = state.temp.index;
    const sub = data.forcedSubscription.list?.[index];
    if (!sub) return;
    if (field === "toggle") {
      sub.enabled = sub.enabled === undefined ? false : !sub.enabled;
      await saveData(env);
      await sendMessage(chatId, `🔄 تم ${sub.enabled ? "تفعيل" : "تعطيل"} الاشتراك.`, token);
      const m = forcedSubscriptionMenu();
      await editMessage(state.temp.chatId, state.temp.msgId, m.text, token, { reply_markup: m.keyboard });
      clearAdminState(userId);
      return;
    }
    const prompts = {
      name: "📝 أدخل الاسم الجديد:\nالحالي: " + (sub.name || "-"),
      link: "🔗 أدخل الرابط الجديد:\nالحالي: " + (sub.link || "-"),
      message: "✏️ أدخل الرسالة الجديدة:\nالحالية: " + (sub.message || "-"),
    };
    state.step = "waiting_edit_value";
    state.temp.editField = field;
    await sendMessage(chatId, prompts[field] || "📝 أدخل القيمة الجديدة:", token);
    return;
  }
  if (cbData === "fs_delete") {
    const fs = data.forcedSubscription;
    if (!fs.list?.length) { await sendMessage(chatId, "⚠️ لا توجد اشتراكات.", token); return; }
    const buttons = fs.list.map((s, i) => [{ text: `🗑️ ${s.name || s.type + " " + (i + 1)}`, callback_data: "fs_delete_confirm_" + i }]);
    buttons.push([{ text: "🔙 رجوع", callback_data: "admin_forced_subscription" }]);
    await editMessage(chatId, msgId, "🗑️ <b>اختر اشتراكاً للحذف:</b>", token, { reply_markup: { inline_keyboard: buttons } });
    return;
  }
  if (cbData.startsWith("fs_delete_confirm_")) {
    const index = parseInt(cbData.replace("fs_delete_confirm_", ""));
    if (data.forcedSubscription.list?.[index]) {
      const removed = data.forcedSubscription.list.splice(index, 1);
      data.forcedSubscription.userStatus = {};
      await saveData(env);
      await sendMessage(chatId, `🗑️ تم حذف: ${removed[0].name || removed[0].type}`, token);
      const m = forcedSubscriptionMenu();
      await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    }
    return;
  }
  if (cbData === "fs_settings") {
    const m = forcedSubscriptionSettingsMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "fs_setting_notification") {
    data.forcedSubscription.settings.notification = !data.forcedSubscription.settings.notification;
    await saveData(env);
    const m = forcedSubscriptionSettingsMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "fs_setting_display") {
    data.forcedSubscription.settings.displayMode = data.forcedSubscription.settings.displayMode === "grouped" ? "separate" : "grouped";
    await saveData(env);
    const m = forcedSubscriptionSettingsMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "fs_setting_verify_text") {
    state.action = "fs_setting_verify_text";
    state.step = "waiting_input";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "🔘 أدخل النص الجديد لزر التحقق:\nالحالي: " + data.forcedSubscription.settings.verifyButtonText, token);
    return;
  }
  if (cbData === "fs_setting_grouped_message") {
    state.action = "fs_setting_grouped_message";
    state.step = "waiting_input";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "✏️ أدخل رسالة العرض المجمع:\n(يمكنك استخدام HTML)", token);
    return;
  }
  if (cbData === "fs_stats") {
    const fs = data.forcedSubscription;
    const total = Object.keys(data.users || {}).length;
    const completed = Object.values(fs.userStatus || {}).filter((s) => s.completed).length;
    const pending = total - completed;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    await sendMessage(chatId, `📊 <b>إحصائيات الاشتراك الإجباري</b>\n\n👥 إجمالي المستخدمين: ${total}\n✅ أكملوا الاشتراك: ${completed}\n⏳ لم يكملوا: ${pending}\n📈 معدل الإتمام: ${rate}%`, token, { bypass_protection: true });
    return;
  }
  if (cbData === "fs_preview") {
    const fs = data.forcedSubscription;
    const activeSubs = (fs.list || []).filter((s) => s.enabled !== false);
    if (activeSubs.length === 0) { await sendMessage(chatId, "⚠️ لا توجد اشتراكات نشطة.", token); return; }
    const previewText = "👁️ <b>معاينة بوابة الاشتراك</b>\n\n" + (fs.settings.groupedMessage || "📢 يجب عليك الاشتراك في:");
    const keyboard = getForcedSubscriptionKeyboard("preview");
    await sendMessage(chatId, previewText, token, keyboard ? { reply_markup: keyboard } : {});
    return;
  }

  // ====================================================================
  // ========== إدارة المحتوى ==========
  // ====================================================================

  if (cbData === "admin_content") {
    const m = contentManagementMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData.startsWith("cnt_list_")) {
    const page = parseInt(cbData.replace("cnt_list_", "")) || 1;
    const m = contentListMenu(page);
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData.startsWith("cnt_detail_")) {
    const id = cbData.replace("cnt_detail_", "");
    const m = contentDetailMenu(id);
    if (!m) { await sendMessage(chatId, "⚠️ المحتوى غير موجود.", token); return; }
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "cnt_search") {
    state.action = "cnt_admin_search";
    state.step = "waiting_id";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "🔍 أدخل رقم المحتوى (5 أرقام) للبحث عنه:", token);
    return;
  }
  if (cbData === "cnt_add") {
    state.action = "cnt_add";
    state.step = "choose_type";
    state.temp = { chatId, msgId };
    await editMessage(chatId, msgId, "📁 <b>إضافة محتوى جديد</b>\n\nاختر نوع المحتوى:", token, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📝 نصي", callback_data: "cnt_type_text" }, { text: "🖼️ صور", callback_data: "cnt_type_photo" }],
          [{ text: "🎥 فيديو", callback_data: "cnt_type_video" }, { text: "📦 متنوع", callback_data: "cnt_type_mixed" }],
          [{ text: "❌ إلغاء", callback_data: "admin_content" }],
        ],
      },
    });
    return;
  }
  if (cbData.startsWith("cnt_type_")) {
    const type = cbData.replace("cnt_type_", "");
    state.action = "cnt_add";
    state.step = "waiting_title";
    state.temp = { ...state.temp, type, parts: [] };
    const typeNames = { text: "📝 نصي", photo: "🖼️ صور", video: "🎥 فيديو", mixed: "📦 متنوع" };
    await sendMessage(chatId, `✅ النوع: ${typeNames[type]}\n\n📌 الآن أدخل <b>عنوان المحتوى</b>:`, token);
    return;
  }
  if (cbData === "cnt_part_done") {
    if (!state.temp?.parts?.length) { await sendMessage(chatId, "⚠️ لم تضف أي محتوى بعد! أرسل جزءاً على الأقل.", token); return; }
    const id = generateContentId();
    if (!data.content.items) data.content.items = {};
    data.content.items[id] = {
      id,
      title: state.temp.title,
      type: state.temp.type,
      parts: state.temp.parts,
      createdAt: new Date().toISOString(),
      status: "draft",
    };
    await saveData(env);
    clearAdminState(userId);
    const m = contentDetailMenu(id);
    await sendMessage(chatId, `✅ <b>تم حفظ المحتوى!</b>\n\n🔢 الرقم: <code>${id}</code>\n📌 العنوان: ${data.content.items[id].title}\n📦 الأجزاء: ${state.temp.parts.length}\n\n👇 يمكنك الآن نشره أو نسخ نص النشر:`, token, { reply_markup: m?.keyboard });
    return;
  }
  if (cbData === "cnt_part_cancel") {
    clearAdminState(userId);
    const m = contentManagementMenu();
    await sendMessage(chatId, "❌ تم إلغاء إضافة المحتوى.", token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "cnt_part_addmore") {
    const typePrompts = {
      text: "📝 أرسل الجزء النصي التالي:",
      photo: "🖼️ أرسل الصورة التالية (يمكنك إضافة تعليق):",
      video: "🎥 أرسل الفيديو التالي (يمكنك إضافة تعليق):",
      mixed: "📦 أرسل الجزء التالي (نص أو صورة أو فيديو):",
    };
    const prompt = typePrompts[state.temp?.type] || "📝 أرسل الجزء التالي:";
    const partsCount = state.temp?.parts?.length || 0;
    await sendMessage(chatId, `${prompt}\n\n📊 الأجزاء المضافة حتى الآن: ${partsCount}`, token, {
      reply_markup: { inline_keyboard: [[{ text: "✅ انتهيت", callback_data: "cnt_part_done" }], [{ text: "❌ إلغاء", callback_data: "cnt_part_cancel" }]] },
    });
    return;
  }
  if (cbData.startsWith("cnt_addpart_")) {
    const id = cbData.replace("cnt_addpart_", "");
    const item = data.content?.items?.[id];
    if (!item) { await sendMessage(chatId, "⚠️ المحتوى غير موجود.", token); return; }
    state.action = "cnt_addpart_existing";
    state.step = "waiting_part";
    state.temp = { chatId, msgId, contentId: id, type: item.type };
    await sendMessage(chatId, `➕ <b>إضافة جزء جديد</b>\nللمحتوى: ${item.title}\n\nأرسل الجزء (نص أو صورة أو فيديو):`, token, {
      reply_markup: { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "cnt_detail_" + id }]] },
    });
    return;
  }
  if (cbData.startsWith("cnt_preview_")) {
    const id = cbData.replace("cnt_preview_", "");
    const item = data.content?.items?.[id];
    if (!item) { await sendMessage(chatId, "⚠️ المحتوى غير موجود.", token); return; }
    await sendMessage(chatId, `👁️ <b>معاينة المحتوى</b>\n🔢 <code>${id}</code>`, token, { bypass_protection: true });
    await deliverContent(chatId, id, token);
    return;
  }
  if (cbData.startsWith("cnt_copy_")) {
    const id = cbData.replace("cnt_copy_", "");
    const item = data.content?.items?.[id];
    if (!item) return;
    const botUsername = data.content?.botUsername || "niswangybot";
    const publishText = buildPublishText(item, botUsername);
    await sendMessage(chatId, `📋 <b>نص النشر — انسخه وانشره يدوياً:</b>\n\n<code>${publishText}</code>`, token, { bypass_protection: true });
    return;
  }
  if (cbData.startsWith("cnt_publish_")) {
    const id = cbData.replace("cnt_publish_", "");
    const item = data.content?.items?.[id];
    if (!item) { await sendMessage(chatId, "⚠️ المحتوى غير موجود.", token); return; }
    const channelId = data.content?.publishChannel;
    if (!channelId) { await sendMessage(chatId, "❌ لم يتم تعيين قناة النشر.\nاذهب لـ إدارة المحتوى → تعيين قناة النشر.", token); return; }
    const botUsername = data.content?.botUsername || "niswangybot";
    const publishText = `📌 ${item.title}\n\n🔐 المقطع كامل على @${botUsername}\nادخل للبوت ثم اضغط زر 🔍 البحث واكتب:\n( ${item.id} )`;
    const keyboard = buildPublishKeyboard(item, botUsername);
    const res = await sendMessage(channelId, publishText, token, {
      reply_markup: keyboard,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    });
    if (res.ok) {
      item.status = "published";
      item.publishedAt = new Date().toISOString();
      await saveData(env);
      await sendMessage(chatId, `✅ <b>تم النشر بنجاح!</b>\n📢 القناة: ${data.content.publishChannelName || channelId}\n🔢 رقم المحتوى: <code>${id}</code>`, token);
      const m = contentDetailMenu(id);
      if (m) await sendMessage(chatId, m.text, token, { reply_markup: m.keyboard });
    } else {
      await sendMessage(chatId, `❌ فشل النشر!\n${res.description || "تأكد أن البوت أدمن في القناة."}`, token);
    }
    return;
  }
  if (cbData.startsWith("cnt_edittitle_")) {
    const id = cbData.replace("cnt_edittitle_", "");
    const item = data.content?.items?.[id];
    if (!item) return;
    state.action = "cnt_edit_title";
    state.step = "waiting_title";
    state.temp = { chatId, msgId, contentId: id };
    await sendMessage(chatId, `✏️ أدخل العنوان الجديد:\n\nالحالي: <b>${item.title}</b>`, token);
    return;
  }
  if (cbData.startsWith("cnt_delete_confirm_")) {
    const id = cbData.replace("cnt_delete_confirm_", "");
    if (data.content?.items?.[id]) {
      const title = data.content.items[id].title;
      delete data.content.items[id];
      await saveData(env);
      await sendMessage(chatId, `✅ تم حذف المحتوى:\n<code>${id}</code> — ${title}`, token);
      const m = contentListMenu(1);
      await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    }
    return;
  }
  if (cbData.startsWith("cnt_delete_")) {
    const id = cbData.replace("cnt_delete_", "");
    const item = data.content?.items?.[id];
    if (!item) return;
    await editMessage(chatId, msgId, `🗑️ <b>تأكيد الحذف</b>\n\nهل أنت متأكد من حذف:\n<code>${id}</code> — ${item.title}؟`, token, {
      reply_markup: { inline_keyboard: [[{ text: "🗑️ نعم، احذف", callback_data: "cnt_delete_confirm_" + id }, { text: "❌ إلغاء", callback_data: "cnt_detail_" + id }]] },
    });
    return;
  }
  if (cbData === "cnt_set_channel") {
    state.action = "cnt_set_channel";
    state.step = "waiting_channel";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "📢 أدخل معرف قناة النشر:\n(مثال: @mychannel أو -100xxxxxxxxx)\n\nيجب أن يكون البوت أدمن فيها.", token);
    return;
  }
  if (cbData === "cnt_set_contact") {
    state.action = "cnt_set_contact";
    state.step = "waiting_text";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, `✏️ أدخل رسالة التواصل الجديدة:\n(يمكنك استخدام HTML)\n\nالحالية:\n${data.content?.contactMessage || "غير محددة"}`, token);
    return;
  }
  if (cbData === "cnt_set_search_prompt") {
    state.action = "cnt_set_search_prompt";
    state.step = "waiting_text";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, `✏️ أدخل رسالة طلب رقم المحتوى:\n\nالحالية:\n${data.content?.searchPrompt || "غير محددة"}`, token);
    return;
  }
  if (cbData === "cnt_set_botusername") {
    state.action = "cnt_set_botusername";
    state.step = "waiting_text";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, `🤖 أدخل يوزرنيم البوت (بدون @):\n\nالحالي: ${data.content?.botUsername || "niswangybot"}`, token);
    return;
  }

  // ====================================================================
  // ========== إدارة الأزرار ==========
  // ====================================================================

  if (cbData === "admin_buttons") {
    const m = buttonsMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }
  if (cbData === "btn_add") {
    state.action = "btn_add_label";
    state.step = "waiting_label";
    state.temp = { chatId, msgId };
    await sendMessage(chatId, "📝 أدخل <b>تسمية الزر</b> (النص الذي سيظهر في لوحة المفاتيح):", token);
    return;
  }
  if (cbData === "btn_edit") {
    const items = data.buttons?.items || [];
    if (items.length === 0) { await sendMessage(chatId, "⚠️ لا توجد أزرار لتعديلها.", token); return; }
    state.action = "btn_edit_select";
    state.step = "waiting_id";
    state.temp = { chatId, msgId };
    let list = items.map((b, i) => `${i+1}. <b>${b.label}</b> — <code>${b.url}</code>`).join("\n");
    await sendMessage(chatId, `✏️ <b>اختر رقم الزر لتعديله:</b>\n\n${list}`, token);
    return;
  }
  if (cbData === "btn_delete") {
    const items = data.buttons?.items || [];
    if (items.length === 0) { await sendMessage(chatId, "⚠️ لا توجد أزرار لحذفها.", token); return; }
    state.action = "btn_delete";
    state.step = "waiting_id";
    state.temp = { chatId, msgId };
    let list = items.map((b, i) => `${i+1}. <b>${b.label}</b>`).join("\n");
    await sendMessage(chatId, `🗑️ <b>اختر رقم الزر لحذفه:</b>\n\n${list}`, token);
    return;
  }
  if (cbData === "btn_edit_field_label" || cbData === "btn_edit_field_url") {
    const field = cbData === "btn_edit_field_label" ? "label" : "url";
    const idx = state.temp?.editIndex;
    if (idx === undefined) { await sendMessage(chatId, "⚠️ حدث خطأ. حاول مرة أخرى.", token); clearAdminState(userId); return; }
    const items = data.buttons?.items || [];
    if (idx < 0 || idx >= items.length) { await sendMessage(chatId, "⚠️ الزر غير موجود.", token); clearAdminState(userId); return; }
    state.action = cbData === "btn_edit_field_label" ? "btn_edit_field_label" : "btn_edit_field_url";
    state.step = "waiting_value";
    state.temp = { chatId, msgId, editIndex: idx };
    const current = items[idx];
    await sendMessage(chatId, `📝 أدخل القيمة الجديدة لـ <b>${field}</b>:\n\nالحالية: ${field === "label" ? current.label : current.url}`, token);
    return;
  }

  // ====================================================================
  // ========== إدارة النصوص ==========
  // ====================================================================

  if (cbData === "admin_texts") {
    const m = textsManagementMenu();
    await editMessage(chatId, msgId, m.text, token, { reply_markup: m.keyboard });
    return;
  }

  // ====================================================================
  // ===== أي كولباك غير معروف =====
  // ====================================================================

  await sendMessage(chatId, "⚠️ خيار غير معروف أو منتهي الصلاحية. افتح لوحة التحكم من جديد.", token);
}
