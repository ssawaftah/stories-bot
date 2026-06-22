import { Router } from 'itty-router';

const router = Router();

// قاعدة بيانات مؤقتة في الذاكرة (KV)
let kvData = {};

// دوال مساعدة للتعامل مع KV
async function getKV(key) {
  try {
    const value = await NISWANGY_DB.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return kvData[key] || null;
  }
}

async function putKV(key, value) {
  try {
    await NISWANGY_DB.put(key, JSON.stringify(value));
  } catch {
    kvData[key] = value;
  }
}

async function listKV(prefix) {
  try {
    const list = await NISWANGY_DB.list({ prefix });
    const items = [];
    for (const key of list.keys) {
      const value = await getKV(key.name);
      if (value) items.push(value);
    }
    return items;
  } catch {
    return Object.keys(kvData)
      .filter(k => k.startsWith(prefix))
      .map(k => kvData[k]);
  }
}

// إرسال رسالة
async function sendMessage(chatId, text, options = {}) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...options })
  });
  return response.json();
}

// تحرير رسالة
async function editMessageText(chatId, messageId, text, options = {}) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, ...options })
  });
}

// الرد على callback query
async function answerCallbackQuery(queryId, text = '') {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: queryId, text })
  });
}

// التحقق من الاشتراك في القناة
async function checkSubscription(userId) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_USERNAME}&user_id=${userId}`;
    const response = await fetch(url);
    const data = await response.json();
    return data.ok && ['member', 'administrator', 'creator'].includes(data.result.status);
  } catch {
    return false;
  }
}

// توليد ID فريد
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// إعداد الأقسام الافتراضية
async function initDefaultCategories() {
  const categories = await listKV('cat:');
  if (categories.length === 0) {
    const defaults = [
      { id: 'funny', name: '😂 قصص مضحكة', stories: [] },
      { id: 'horror', name: '👻 قصص رعب', stories: [] },
      { id: 'romantic', name: '💕 قصص رومنسية', stories: [] },
      { id: 'variety', name: '📚 قصص متنوعة', stories: [] },
      { id: 'strange', name: '🤯 قصص غريبة', stories: [] },
      { id: 'videos', name: '🎬 مقاطع', stories: [] }
    ];
    for (const cat of defaults) {
      await putKV(`cat:${cat.id}`, cat);
    }
  }
}

// القائمة الرئيسية
function getMainMenu() {
  return {
    inline_keyboard: [
      [{ text: "😂 قصص مضحكة", callback_data: "cat_funny" }],
      [{ text: "👻 قصص رعب", callback_data: "cat_horror" }],
      [{ text: "💕 قصص رومنسية", callback_data: "cat_romantic" }],
      [{ text: "📚 قصص متنوعة", callback_data: "cat_variety" }],
      [{ text: "🤯 قصص غريبة", callback_data: "cat_strange" }],
      [{ text: "🎬 مقاطع", callback_data: "cat_videos" }],
      [{ text: "🔍 البحث عن طريق رقم المحتوى", callback_data: "search" }]
    ]
  };
}

// قائمة رجوع
function getBackMenu(categoryId) {
  return {
    inline_keyboard: [
      [{ text: "🔙 رجوع", callback_data: `cat_${categoryId}` }],
      [{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]
    ]
  };
}

// معالجة الرسائل
async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const userId = message.from.id;

  // أمر البداية
  if (text === '/start') {
    const user = await getKV(`user:${userId}`);
    
    if (!user || !user.registered) {
      await sendMessage(chatId, 
        "🎭 *مرحباً بك في بوت نسوانجي*\n\n" +
        "📱 *يجب مشاركة رقم هاتفك للمتابعة*\n" +
        "هذا ضروري لمنع السبام وضمان أمان المحتوى",
        {
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [[{ text: "📱 مشاركة رقم الهاتف", request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        }
      );
    } else {
      await sendMessage(chatId, "🎯 *القائمة الرئيسية*", {
        parse_mode: 'Markdown',
        reply_markup: getMainMenu()
      });
    }
  }
  
  // لوحة تحكم المشرف
  else if (text === '/admin' && userId.toString() === ADMIN_ID) {
    await sendMessage(chatId, "👨‍💻 *لوحة تحكم المشرف*", {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "📊 إحصائيات", callback_data: "admin_stats" }],
          [{ text: "👥 المستخدمين", callback_data: "admin_users" }],
          [{ text: "📚 إضافة قصة", callback_data: "admin_add_story" }],
          [{ text: "📢 إرسال للكل", callback_data: "admin_broadcast" }]
        ]
      }
    });
  }
  
  // البحث عن محتوى
  else if (text.startsWith('/search_')) {
    const query = text.replace('/search_', '').trim();
    const stories = await listKV('story:');
    const result = stories.find(s => s.id === query);
    
    if (result) {
      await sendMessage(chatId, `📖 *${result.title}*\n\n${result.content}\n\n📌 الرقم: \`${result.id}\``, {
        parse_mode: 'Markdown',
        reply_markup: getBackMenu(result.category)
      });
    } else {
      await sendMessage(chatId, "❌ لم يتم العثور على محتوى بهذا الرقم");
    }
  }
  
  // استقبال محتوى جديد من المشرف
  else if (userId.toString() === ADMIN_ID && message.reply_to_message) {
    const replyText = message.reply_to_message.text;
    
    if (replyText && replyText.includes('أرسل القصة بالتنسيق:')) {
      try {
        const lines = text.split('\n');
        const story = {
          id: generateId(),
          title: lines[0].replace('العنوان:', '').trim(),
          category: lines[1].replace('القسم:', '').trim(),
          content: lines.slice(2).join('\n').replace('المحتوى:', '').trim(),
          created_at: new Date().toISOString()
        };
        
        await putKV(`story:${story.id}`, story);
        
        // تحديث القسم
        const category = await getKV(`cat:${story.category}`);
        if (category) {
          if (!category.stories) category.stories = [];
          category.stories.push(story.id);
          await putKV(`cat:${story.category}`, category);
        }
        
        await sendMessage(chatId, `✅ تمت إضافة القصة بنجاح!\n📌 الرقم: \`${story.id}\``, { parse_mode: 'Markdown' });
      } catch (e) {
        await sendMessage(chatId, "❌ خطأ في التنسيق، تأكد من صحة البيانات");
      }
    }
  }
}

// معالجة جهات الاتصال
async function handleContact(message) {
  if (message.contact && message.contact.user_id === message.from.id) {
    const user = {
      id: message.from.id,
      username: message.from.username || '',
      first_name: message.from.first_name || '',
      last_name: message.from.last_name || '',
      phone: message.contact.phone_number,
      registered: true,
      joined_date: new Date().toISOString(),
      last_activity: new Date().toISOString()
    };
    
    await putKV(`user:${user.id}`, user);
    await putKV(`phone:${user.phone}`, user.id.toString());
    
    await sendMessage(message.chat.id, "✅ تم التحقق بنجاح!", {
      reply_markup: { remove_keyboard: true }
    });
    
    await sendMessage(message.chat.id, "🎯 *القائمة الرئيسية*", {
      parse_mode: 'Markdown',
      reply_markup: getMainMenu()
    });
  }
}

// معالجة الأزرار
async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const messageId = callbackQuery.message.message_id;
  const userId = callbackQuery.from.id;

  await answerCallbackQuery(callbackQuery.id);

  // التحقق من الاشتراك
  if (FORCE_SUBSCRIBE === 'true') {
    const subscribed = await checkSubscription(userId);
    if (!subscribed) {
      return sendMessage(chatId, `⚠️ يجب الاشتراك في ${CHANNEL_USERNAME} أولاً`);
    }
  }

  // عرض محتوى قسم
  if (data.startsWith('cat_')) {
    const categoryId = data.replace('cat_', '');
    const category = await getKV(`cat:${categoryId}`);
    
    if (!category) return;
    
    const stories = [];
    if (category.stories) {
      for (const storyId of category.stories) {
        const story = await getKV(`story:${storyId}`);
        if (story) stories.push(story);
      }
    }
    
    if (stories.length === 0) {
      await editMessageText(chatId, messageId, `📚 *${category.name}*\n\n⚠️ لا توجد قصص حالياً`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: "🔙 رجوع", callback_data: "main_menu" }]] }
      });
      return;
    }
    
    const buttons = [];
    for (let i = 0; i < stories.length; i += 2) {
      const row = stories.slice(i, i + 2).map(s => ({
        text: s.title.substring(0, 30),
        callback_data: `story_${s.id}`
      }));
      buttons.push(row);
    }
    buttons.push([{ text: "🔙 رجوع", callback_data: "main_menu" }]);
    
    await editMessageText(chatId, messageId, `📚 *${category.name}*\nاختر القصة:`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });
  }
  
  // عرض قصة
  else if (data.startsWith('story_')) {
    const storyId = data.replace('story_', '');
    const story = await getKV(`story:${storyId}`);
    
    if (!story) {
      return sendMessage(chatId, "⚠️ القصة غير متوفرة");
    }
    
    await sendMessage(chatId, `📖 *${story.title}*\n\n${story.content}\n\n📌 الرقم: \`${story.id}\``, {
      parse_mode: 'Markdown',
      reply_markup: getBackMenu(story.category)
    });
  }
  
  // العودة للقائمة الرئيسية
  else if (data === 'main_menu') {
    await editMessageText(chatId, messageId, "🎯 *القائمة الرئيسية*", {
      parse_mode: 'Markdown',
      reply_markup: getMainMenu()
    });
  }
  
  // طلب رقم المحتوى للبحث
  else if (data === 'search') {
    await sendMessage(chatId, "🔍 أرسل رقم المحتوى للبحث:\nمثال: `/search_abc123`", {
      parse_mode: 'Markdown'
    });
  }
  
  // إحصائيات المشرف
  else if (data === 'admin_stats' && userId.toString() === ADMIN_ID) {
    const users = await listKV('user:');
    const stories = await listKV('story:');
    const categories = await listKV('cat:');
    
    await editMessageText(chatId, messageId,
      `📊 *إحصائيات البوت*\n\n` +
      `👥 المستخدمين: ${users.length}\n` +
      `📚 القصص: ${stories.length}\n` +
      `📁 الأقسام: ${categories.length}`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: "🔙 رجوع", callback_data: "main_menu" }]] }
      }
    );
  }
  
  // عرض المستخدمين
  else if (data === 'admin_users' && userId.toString() === ADMIN_ID) {
    const users = await listKV('user:');
    let text = "👥 *قائمة المستخدمين:*\n\n";
    
    users.slice(0, 20).forEach((u, i) => {
      text += `${i + 1}. ${u.first_name} - ${u.phone}\n`;
    });
    
    if (users.length > 20) text += `\n... و ${users.length - 20} آخرين`;
    
    await editMessageText(chatId, messageId, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: "🔙 رجوع", callback_data: "main_menu" }]] }
    });
  }
  
  // طلب إضافة قصة
  else if (data === 'admin_add_story' && userId.toString() === ADMIN_ID) {
    const categories = await listKV('cat:');
    let text = "📝 *لإضافة قصة جديدة*\n\n";
    text += "أرسل رسالة بهذا التنسيق:\n\n";
    text += "العنوان: [اسم القصة]\n";
    text += "القسم: [اختر من القائمة]\n";
    text += "المحتوى: [نص القصة]\n\n";
    text += "*الأقسام المتاحة:*\n";
    categories.forEach(c => text += `• ${c.id}\n`);
    
    await sendMessage(chatId, text, { parse_mode: 'Markdown' });
  }
  
  // إرسال رسالة للجميع
  else if (data === 'admin_broadcast' && userId.toString() === ADMIN_ID) {
    await sendMessage(chatId, 
      "📢 *إرسال رسالة جماعية*\n\n" +
      "قم بالرد على هذه الرسالة بالرسالة التي تريد إرسالها لجميع المستخدمين",
      { parse_mode: 'Markdown' }
    );
  }
}

// Webhook endpoint
router.post('/webhook', async (request) => {
  try {
    const update = await request.json();
    
    if (update.message?.contact) {
      await handleContact(update.message);
    } else if (update.message) {
      await handleMessage(update.message);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }
    
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response('Error', { status: 500 });
  }
});

// إعداد webhook
router.get('/setup', async () => {
  try {
    // تهيئة الأقسام الافتراضية
    await initDefaultCategories();
    
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;
    const url = new URL(request.url);
const hostname = url.hostname; // مثلاً niswangy-bot.username.workers.dev
const webhookUrl = `https://${hostname}/webhook`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });
    
    const data = await response.json();
    return new Response(JSON.stringify(data, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

export default {
  async fetch(request, env, ctx) {
    // جعل المتغيرات متاحة
    Object.assign(globalThis, env);
    return router.handle(request);
  }
};
