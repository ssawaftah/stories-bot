// ====================================================================
// ========== نظام التسجيل والإشعارات ==========
// ====================================================================

let logChannelId = null;
let logEnabled = false;

export function setLogChannel(channelId) {
  logChannelId = channelId;
}

export function isLogEnabled() {
  return logEnabled;
}

export function setLogEnabled(enabled) {
  logEnabled = enabled;
}

export async function sendLog(userId, username, name, action, details, token) {
  if (!logEnabled || !logChannelId) return;
  
  const now = new Date();
  const date = now.toLocaleDateString('ar-EG');
  const time = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  const message = `
📋 **سجل الإجراءات**

👤 **الاسم:** ${name || 'غير معروف'}
🆔 **اليوزرنيم:** @${username || 'لا يوجد'}
🆔 **المعرف:** ${userId}

⚡ **الإجراء:** ${action}
📝 **التفاصيل:** ${details}

📅 **التاريخ:** ${date}
🕐 **الوقت:** ${time} (توقيت الأردن)
─────────────────`;

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: logChannelId, text: message, parse_mode: 'Markdown' })
    });
  } catch (e) {
    console.error('Log error:', e);
  }
}
