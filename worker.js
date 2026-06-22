export default {
  async fetch(request, env) {
    if (request.method === 'POST') {
      try {
        const update = await request.json();
        if (update.message) return await handleMessage(update.message, env);
        if (update.callback_query) return await handleCallback(update.callback_query, env);
      } catch(e) {}
    }
    return new Response('OK');
  }
};

async function handleMessage(msg, env) {
  const chatId = msg.chat.id.toString();
  const text = msg.text || '';
  const contact = msg.contact;
  const adminIds = (env.ADMIN_IDS || '').split(',').map(id => id.trim());
  const isAdmin = adminIds.includes(chatId);
  
  // ====== /start ======
  if (text === '/start') {
    // تحقق من حالة المستخدم
    const pending = await env.BOT_KV.get(`pending:${chatId}`, { type: 'json' });
    const approved = await env.BOT_KV.get(`user:${chatId}`, { type: 'json' });
    
    if (approved && approved.approved) {
      return await sendMsg(env, chatId, '👋 مرحباً بعودتك ' + approved.name + '!\n\nتم التحقق من هويتك مسبقاً ✅');
    }
    
    if (pending) {
      return await sendMsg(env, chatId, '⏳ طلبك قيد المراجعة حالياً.\n\nسيتم إشعارك عند الرد.');
    }
    
    return await sendMsg(env, chatId, '👋 مرحباً بك!\n\nللتحقق من هويتك، يرجى مشاركة رقم هاتفك.', {
      reply_markup: {
        keyboard: [[{ text: '📱 مشاركة رقم الهاتف', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  }
  
  // ====== استلام جهة الاتصال ======
  if (contact) {
    const phone = contact.phone_number;
    const name = (contact.first_name || msg.from.first_name || '') + ' ' + (contact.last_name || msg.from.last_name || '');
    const username = msg.from.username || '';
    
    // حفظ الطلب المعلق
    const request = {
      id: chatId,
      name: name.trim(),
      phone: phone,
      username: username,
      date: new Date().toISOString()
    };
    
    await env.BOT_KV.put(`pending:${chatId}`, JSON.stringify(request));
    
    // إضافة للقائمة المعلقة
    let pendingList = await env.BOT_KV.get('pending_list', { type: 'json' }) || [];
    if (!pendingList.includes(chatId)) {
      pendingList.push(chatId);
      await env.BOT_KV.put('pending_list', JSON.stringify(pendingList));
    }
    
    // إشعار المستخدم
    await sendMsg(env, chatId, '📋 *تم استلام طلبك!*\n\nرقم هاتفك: ' + phone + '\n\n⏳ طلبك قيد المراجعة. سيتم إشعارك عند الرد.', {
      parse_mode: 'Markdown',
      reply_markup: { remove_keyboard: true }
    });
    
    // إشعار الأدمن
    for (const adminId of adminIds) {
      await sendMsg(env, adminId, 
        '🔔 *طلب انضمام جديد*\n\n' +
        `👤 الاسم: ${name.trim()}\n` +
        `📱 الهاتف: ${phone}\n` +
        `🆔 المعرف: ${chatId}\n` +
        (username ? `👤 يوزر: @${username}\n` : '') +
        `📅 التاريخ: ${new Date().toLocaleDateString('ar-SA')}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ قبول', callback_data: `approve_${chatId}` },
              { text: '❌ رفض', callback_data: `reject_${chatId}` }
            ]]
          }
        }
      );
    }
    
    return new Response('OK');
  }
  
  // ====== لوحة الأدمن ======
  if (text === '/admin' || text === '🔙 رئيسية') {
    if (!isAdmin) return await sendMsg(env, chatId, '⛔ غير مصرح.');
    return await adminPanel(chatId, env);
  }
  
  if (!isAdmin) {
    return await sendMsg(env, chatId, 'استخدم /start للبدء.');
  }
  
  // ====== أزرار الأدمن ======
  if (text === '📋 الطلبات المعلقة') return await showPending(chatId, env);
  if (text === '👥 المستخدمين') return await showUsers(chatId, env);
  if (text === '📁 الأقسام') return await showSections(chatId, env);
  if (text === '📊 المحتوى') return await showContentMenu(chatId, env);
  if (text === '🔗 اشتراك إجباري') return await showForce(chatId, env);
  
  // إدخالات الأدمن
  const state = await env.BOT_KV.get(`state:${chatId}`, { type: 'json' }) || {};
  if (state.action === 'block') return await doBlock(chatId, text, env);
  if (state.action === 'unblock') return await doUnblock(chatId, text, env);
  if (state.action === 'add_section') return await doAddSection(chatId, text, env);
  if (state.action === 'edit_section_num') return await doEditSectionNum(chatId, text, env);
  if (state.action === 'edit_section_name') return await doEditSectionName(chatId, text, env, state);
  if (state.action === 'delete_section') return await doDeleteSection(chatId, text, env);
  if (state.action === 'add_title') return await doAddTitle(chatId, text, env, state);
  if (state.action === 'adding_content') return await doAddContent(chatId, text, env, state);
  if (state.action === 'edit_content_new') return await doEditContent(chatId, text, env, state);
  if (state.action === 'add_force') return await doAddForce(chatId, text, env);
  if (state.action === 'delete_force') return await doDelForce(chatId, text, env);
  
  return await sendMsg(env, chatId, 'استخدم الأزرار للتنقل.');
}

// ==================== معالجة الأزرار ====================
async function handleCallback(cb, env) {
  const chatId = cb.message.chat.id.toString();
  const data = cb.data;
  const msgId = cb.message.message_id;
  
  try {
    // قبول / رفض مستخدم
    if (data.startsWith('approve_')) return await approveUser(chatId, data.slice(8), env, msgId);
    if (data.startsWith('reject_')) return await rejectUser(chatId, data.slice(7), env, msgId);
    
    // الطلبات المعلقة
    if (data === 'pending') return await showPending(chatId, env, msgId);
    
    // المستخدمين
    if (data === 'users') return await showUsers(chatId, env, msgId);
    if (data === 'block') { await setState(chatId, 'block', env); return await editMsg(env, chatId, msgId, '🔒 أرسل ID المستخدم:'); }
    if (data === 'unblock') { await setState(chatId, 'unblock', env); return await editMsg(env, chatId, msgId, '🔓 أرسل ID المستخدم:'); }
    if (data === 'blocked') return await showBlocked(chatId, env, msgId);
    if (data.startsWith('ub_')) { await toggleBlock(data.slice(3), false, env); return await showBlocked(chatId, env, msgId); }
    
    // الأقسام
    if (data === 'sections') return await showSections(chatId, env, msgId);
    if (data === 's_add') { await setState(chatId, 'add_section', env); return await editMsg(env, chatId, msgId, '📁 أرسل اسم القسم:'); }
    if (data === 's_edit') { await setState(chatId, 'edit_section_num', env); return await editMsg(env, chatId, msgId, '✏️ أرسل رقم القسم:'); }
    if (data === 's_del') { await setState(chatId, 'delete_section', env); return await editMsg(env, chatId, msgId, '🗑 أرسل رقم القسم:'); }
    
    // المحتوى
    if (data === 'content') return await showContentMenu(chatId, env, msgId);
    if (data === 'c_stats') return await contentStats(chatId, env, msgId);
    if (data === 'c_add') return await pickSection(chatId, env, msgId, 'add');
    if (data === 'c_edit') return await pickSection(chatId, env, msgId, 'edit');
    if (data === 'c_del') return await pickSection(chatId, env, msgId, 'del');
    if (data.startsWith('as_')) { await setState(chatId, 'add_title', { sid: data.slice(3) }, env); return await editMsg(env, chatId, msgId, '📝 أرسل عنوان المحتوى:'); }
    if (data.startsWith('es_')) return await showContents(chatId, data.slice(3), env, msgId, 'edit');
    if (data.startsWith('ds_')) return await showContents(chatId, data.slice(3), env, msgId, 'del');
    if (data.startsWith('ei_')) { await setState(chatId, 'edit_content_new', { cid: data.slice(3) }, env); return await editMsg(env, chatId, msgId, '📝 أرسل المحتوى الجديد:'); }
    if (data.startsWith('di_')) return await editMsg(env, chatId, msgId, '⚠️ متأكد؟', { inline_keyboard: [[{ text: '✅ نعم', callback_data: 'dy_' + data.slice(3) }], [{ text: '❌ لا', callback_data: 'content' }]] });
    if (data.startsWith('dy_')) return await delContent(chatId, data.slice(3), env, msgId);
    
    // اشتراك إجباري
    if (data === 'force') return await showForce(chatId, env, msgId);
    if (data === 'f_add') { await setState(chatId, 'add_force', env); return await editMsg(env, chatId, msgId, '➕ أرسل @المعرف:'); }
    if (data === 'f_del') { await setState(chatId, 'delete_force', env); return await editMsg(env, chatId, msgId, '🗑 أرسل الرقم أو @المعرف:'); }
    
    // رجوع
    if (data === 'menu') { await deleteMsg(env, chatId, msgId); return await adminPanel(chatId, env); }
    
    await answerCb(env, cb.id);
  } catch(e) {}
  return new Response('OK');
}

// ==================== قبول/رفض المستخدمين ====================
async function approveUser(adminId, userId, env, msgId) {
  const request = await env.BOT_KV.get(`pending:${userId}`, { type: 'json' });
  if (!request) {
    return await editMsg(env, adminId, msgId, '❌ الطلب لم يعد موجوداً.');
  }
  
  // حفظ كمستخدم معتمد
  const user = {
    id: userId,
    name: request.name,
    phone: request.phone,
    username: request.username,
    join_date: Date.now(),
    is_blocked: false,
    approved: true
  };
  
  await env.BOT_KV.put(`user:${userId}`, JSON.stringify(user));
  await env.BOT_KV.delete(`pending:${userId}`);
  
  // تحديث القوائم
  let usersList = await env.BOT_KV.get('users_list', { type: 'json' }) || [];
  if (!usersList.includes(userId)) {
    usersList.push(userId);
    await env.BOT_KV.put('users_list', JSON.stringify(usersList));
  }
  
  let pendingList = await env.BOT_KV.get('pending_list', { type: 'json' }) || [];
  pendingList = pendingList.filter(id => id !== userId);
  await env.BOT_KV.put('pending_list', JSON.stringify(pendingList));
  
  // إشعار المستخدم
  await sendMsg(env, userId, '✅ *تم قبول طلبك!*\n\nمرحباً بك في البوت. يمكنك الآن استخدام جميع الميزات.', { parse_mode: 'Markdown' });
  
  // تحديث رسالة الأدمن
  await editMsg(env, adminId, msgId, '✅ تم قبول المستخدم: ' + request.name, {
    reply_markup: { inline_keyboard: [[{ text: '🔙 الطلبات', callback_data: 'pending' }]] }
  });
}

async function rejectUser(adminId, userId, env, msgId) {
  const request = await env.BOT_KV.get(`pending:${userId}`, { type: 'json' });
  if (!request) {
    return await editMsg(env, adminId, msgId, '❌ الطلب لم يعد موجوداً.');
  }
  
  await env.BOT_KV.delete(`pending:${userId}`);
  
  let pendingList = await env.BOT_KV.get('pending_list', { type: 'json' }) || [];
  pendingList = pendingList.filter(id => id !== userId);
  await env.BOT_KV.put('pending_list', JSON.stringify(pendingList));
  
  // إشعار المستخدم
  await sendMsg(env, userId, '❌ *تم رفض طلبك.*\n\nللأسف لم يتم قبول طلب الانضمام.', { parse_mode: 'Markdown' });
  
  // تحديث رسالة الأدمن
  await editMsg(env, adminId, msgId, '❌ تم رفض المستخدم: ' + request.name, {
    reply_markup: { inline_keyboard: [[{ text: '🔙 الطلبات', callback_data: 'pending' }]] }
  });
}

// ==================== الطلبات المعلقة ====================
async function showPending(chatId, env, msgId) {
  const pendingList = await env.BOT_KV.get('pending_list', { type: 'json' }) || [];
  
  if (pendingList.length === 0) {
    const txt = '📋 *الطلبات المعلقة*\n\nلا توجد طلبات حالياً. ✅';
    const kb = { inline_keyboard: [[{ text: '🔙', callback_data: 'menu' }]] };
    if (msgId) await editMsg(env, chatId, msgId, txt, { reply_markup: kb, parse_mode: 'Markdown' });
    else await sendMsg(env, chatId, txt, { reply_markup: kb, parse_mode: 'Markdown' });
    return;
  }
  
  let txt = '📋 *الطلبات المعلقة*\n\n';
  const kb = { inline_keyboard: [] };
  
  for (const userId of pendingList) {
    const req = await env.BOT_KV.get(`pending:${userId}`, { type: 'json' });
    if (req) {
      txt += `👤 ${req.name}\n📱 ${req.phone}\n🆔 ${userId}\n📅 ${new Date(req.date).toLocaleDateString('ar-SA')}\n➖➖➖\n`;
      kb.inline_keyboard.push([
        { text: '✅ قبول', callback_data: `approve_${userId}` },
        { text: '❌ رفض', callback_data: `reject_${userId}` }
      ]);
    }
  }
  
  kb.inline_keyboard.push([{ text: '🔙', callback_data: 'menu' }]);
  
  if (msgId) await editMsg(env, chatId, msgId, txt, { reply_markup: kb, parse_mode: 'Markdown' });
  else await sendMsg(env, chatId, txt, { reply_markup: kb, parse_mode: 'Markdown' });
}

// ==================== لوحة الأدمن ====================
async function adminPanel(chatId, env) {
  const pendingCount = (await env.BOT_KV.get('pending_list', { type: 'json' }) || []).length;
  
  await sendMsg(env, chatId, '🎛 *لوحة تحكم الأدمن*', {
    reply_markup: {
      keyboard: [
        [{ text: `📋 الطلبات المعلقة (${pendingCount})` }],
        [{ text: '👥 المستخدمين' }, { text: '📊 المحتوى' }],
        [{ text: '📁 الأقسام' }, { text: '🔗 اشتراك إجباري' }]
      ],
      resize_keyboard: true
    },
    parse_mode: 'Markdown'
  });
}

// ==================== إدارة المستخدمين ====================
async function showUsers(chatId, env, msgId) {
  const list = await env.BOT_KV.get('users_list', { type: 'json' }) || [];
  let txt = '👥 *المستخدمين المعتمدين*\n\n';
  
  if (list.length === 0) txt += 'لا يوجد.';
  else {
    for (const uid of list.slice(-30)) {
      const u = await env.BOT_KV.get(`user:${uid}`, { type: 'json' });
      if (u) txt += `🆔${uid} 👤${u.name} 📱${u.phone} ${u.is_blocked?'🚫':'✅'}\n`;
    }
  }
  
  const kb = { inline_keyboard: [
    [{ text: '🚫 حظر', callback_data: 'block' }, { text: '🔓 إلغاء', callback_data: 'unblock' }],
    [{ text: '📋 محظورين', callback_data: 'blocked' }],
    [{ text: '🔙', callback_data: 'menu' }]
  ]};
  
  if (msgId) await editMsg(env, chatId, msgId, txt, { reply_markup: kb, parse_mode: 'Markdown' });
  else await sendMsg(env, chatId, txt, { reply_markup: kb, parse_mode: 'Markdown' });
}

async function showBlocked(chatId, env, msgId) {
  const list = await env.BOT_KV.get('users_list', { type: 'json' }) || [];
  let txt = '🚫 *محظورين*\n\n';
  const kb = { inline_keyboard: [] };
  let has = false;
  
  for (const uid of list) {
    const u = await env.BOT_KV.get(`user:${uid}`, { type: 'json' });
    if (u && u.is_blocked) {
      has = true;
      txt += `🆔${uid} - ${u.name}\n`;
      kb.inline_keyboard.push([{ text: `🔓 ${uid}`, callback_data: `ub_${uid}` }]);
    }
  }
  
  if (!has) txt += 'لا يوجد.';
  kb.inline_keyboard.push([{ text: '🔙', callback_data: 'users' }]);
  await editMsg(env, chatId, msgId, txt, { reply_markup: kb, parse_mode: 'Markdown' });
}

async function doBlock(chatId, uid, env) {
  const u = await env.BOT_KV.get(`user:${uid}`, { type: 'json' });
  if (!u) return await sendMsg(env, chatId, '❌ غير موجود');
  u.is_blocked = true;
  await env.BOT_KV.put(`user:${uid}`, JSON.stringify(u));
  await clearState(chatId, env);
  await sendMsg(env, chatId, '✅ تم الحظر');
}

async function doUnblock(chatId, uid, env) {
  const u = await env.BOT_KV.get(`user:${uid}`, { type: 'json' });
  if (!u) return await sendMsg(env, chatId, '❌ غير موجود');
  u.is_blocked = false;
  await env.BOT_KV.put(`user:${uid}`, JSON.stringify(u));
  await clearState(chatId, env);
  await sendMsg(env, chatId, '✅ تم الإلغاء');
}

async function toggleBlock(uid, block, env) {
  const u = await env.BOT_KV.get(`user:${uid}`, { type: 'json' });
  if (u) { u.is_blocked = block; await env.BOT_KV.put(`user:${uid}`, JSON.stringify(u)); }
}

// ==================== إدارة الأقسام ====================
async function showSections(chatId, env, msgId) {
  const secs = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  let txt = '📁 *الأقسام*\n\n';
  if (secs.length === 0) txt += 'لا توجد أقسام.';
  else secs.forEach((s, i) => txt += `${i + 1}. ${s.name}\n`);
  
  const kb = { inline_keyboard: [
    [{ text: '➕', callback_data: 's_add' }, { text: '✏️', callback_data: 's_edit' }, { text: '🗑', callback_data: 's_del' }],
    [{ text: '🔙', callback_data: 'menu' }]
  ]};
  
  if (msgId) await editMsg(env, chatId, msgId, txt, { reply_markup: kb, parse_mode: 'Markdown' });
  else await sendMsg(env, chatId, txt, { reply_markup: kb, parse_mode: 'Markdown' });
}

async function doAddSection(chatId, name, env) {
  const secs = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  secs.push({ id: Date.now().toString(), name: name });
  await env.BOT_KV.put('sections', JSON.stringify(secs));
  await clearState(chatId, env);
  await sendMsg(env, chatId, `✅ تم إضافة "${name}"`);
}

async function doEditSectionNum(chatId, num, env) {
  const secs = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  const idx = parseInt(num) - 1;
  if (isNaN(idx) || idx < 0 || idx >= secs.length) { await clearState(chatId, env); return await sendMsg(env, chatId, '❌ رقم خطأ'); }
  await setState(chatId, 'edit_section_name', { sid: secs[idx].id }, env);
  await sendMsg(env, chatId, `الحالي: ${secs[idx].name}\nأرسل الاسم الجديد:`);
}

async function doEditSectionName(chatId, name, env, state) {
  const secs = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  const idx = secs.findIndex(s => s.id === state.sid);
  if (idx !== -1) { secs[idx].name = name; await env.BOT_KV.put('sections', JSON.stringify(secs)); }
  await clearState(chatId, env);
  await sendMsg(env, chatId, '✅ تم التعديل');
}

async function doDeleteSection(chatId, num, env) {
  const secs = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  const idx = parseInt(num) - 1;
  if (isNaN(idx) || idx < 0 || idx >= secs.length) { await clearState(chatId, env); return await sendMsg(env, chatId, '❌ رقم خطأ'); }
  const contents = await env.BOT_KV.get(`contents:${secs[idx].id}`, { type: 'json' }) || [];
  if (contents.length > 0) { await clearState(chatId, env); return await sendMsg(env, chatId, '❌ احذف المحتوى أولاً'); }
  const name = secs[idx].name;
  secs.splice(idx, 1);
  await env.BOT_KV.put('sections', JSON.stringify(secs));
  await clearState(chatId, env);
  await sendMsg(env, chatId, `✅ تم حذف "${name}"`);
}

// ==================== إدارة المحتوى ====================
async function showContentMenu(chatId, env, msgId) {
  const kb = { inline_keyboard: [
    [{ text: '📊 إحصائيات', callback_data: 'c_stats' }],
    [{ text: '➕ إضافة', callback_data: 'c_add' }],
    [{ text: '✏️ تعديل', callback_data: 'c_edit' }],
    [{ text: '🗑 حذف', callback_data: 'c_del' }],
    [{ text: '🔙', callback_data: 'menu' }]
  ]};
  if (msgId) await editMsg(env, chatId, msgId, '📊 *المحتوى*', { reply_markup: kb, parse_mode: 'Markdown' });
  else await sendMsg(env, chatId, '📊 *المحتوى*', { reply_markup: kb, parse_mode: 'Markdown' });
}

async function contentStats(chatId, env, msgId) {
  const secs = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  let txt = '📊 *إحصائيات*\n\n';
  for (const s of secs) {
    const c = await env.BOT_KV.get(`contents:${s.id}`, { type: 'json' }) || [];
    txt += `📁 ${s.name}: ${c.length}\n`;
  }
  if (secs.length === 0) txt += 'لا توجد أقسام.';
  await editMsg(env, chatId, msgId, txt, { reply_markup: { inline_keyboard: [[{ text: '🔙', callback_data: 'content' }]] }, parse_mode: 'Markdown' });
}

async function pickSection(chatId, env, msgId, action) {
  const secs = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  if (secs.length === 0) return await editMsg(env, chatId, msgId, '❌ لا توجد أقسام.', { inline_keyboard: [[{ text: '🔙', callback_data: 'content' }]] });
  const kb = { inline_keyboard: [] };
  secs.forEach(s => kb.inline_keyboard.push([{ text: s.name, callback_data: `${action === 'add' ? 'as' : action === 'edit' ? 'es' : 'ds'}_${s.id}` }]));
  kb.inline_keyboard.push([{ text: '🔙', callback_data: 'content' }]);
  await editMsg(env, chatId, msgId, '📁 اختر القسم:', { reply_markup: kb });
}

async function doAddTitle(chatId, title, env, state) {
  state.title = title;
  state.parts = [];
  state.action = 'adding_content';
  await env.BOT_KV.put(`state:${chatId}`, JSON.stringify(state));
  await sendMsg(env, chatId, '📝 أرسل المحتوى.\nاضغط "✅ تم" للانتهاء.', {
    reply_markup: { keyboard: [[{ text: '✅ تم' }]], resize_keyboard: true }
  });
}

async function doAddContent(chatId, text, env, state) {
  if (text === '✅ تم') {
    const contents = await env.BOT_KV.get(`contents:${state.sid}`, { type: 'json' }) || [];
    contents.push({
      id: Date.now().toString(),
      num: contents.length + 1,
      title: state.title,
      content: state.parts.join('\n\n'),
      sid: state.sid
    });
    await env.BOT_KV.put(`contents:${state.sid}`, JSON.stringify(contents));
    await clearState(chatId, env);
    const secs = await env.BOT_KV.get('sections', { type: 'json' }) || [];
    const sec = secs.find(s => s.id === state.sid);
    await sendMsg(env, chatId, `✅ تم!\n📁 ${sec?.name}\n📝 ${state.title}\n🆔 ${contents.length}`, {
      reply_markup: { keyboard: [[{ text: '📊 المحتوى' }, { text: '🔙 رئيسية' }]], resize_keyboard: true }
    });
  } else {
    state.parts.push(text);
    await env.BOT_KV.put(`state:${chatId}`, JSON.stringify(state));
    await sendMsg(env, chatId, '✅ تم. تابع أو "✅ تم".');
  }
}

async function showContents(chatId, sid, env, msgId, mode) {
  const contents = await env.BOT_KV.get(`contents:${sid}`, { type: 'json' }) || [];
  if (contents.length === 0) return await editMsg(env, chatId, msgId, '❌ فارغ.', { inline_keyboard: [[{ text: '🔙', callback_data: 'content' }]] });
  const kb = { inline_keyboard: [] };
  contents.forEach(c => kb.inline_keyboard.push([{ text: `${c.num}. ${c.title}`, callback_data: `${mode === 'edit' ? 'ei' : 'di'}_${c.id}` }]));
  kb.inline_keyboard.push([{ text: '🔙', callback_data: 'content' }]);
  await editMsg(env, chatId, msgId, `${mode === 'edit' ? '✏️' : '🗑'} اختر:`, { reply_markup: kb });
}

async function doEditContent(chatId, text, env, state) {
  const secs = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  for (const s of secs) {
    const contents = await env.BOT_KV.get(`contents:${s.id}`, { type: 'json' }) || [];
    const idx = contents.findIndex(c => c.id === state.cid);
    if (idx !== -1) { contents[idx].content = text; await env.BOT_KV.put(`contents:${s.id}`, JSON.stringify(contents)); break; }
  }
  await clearState(chatId, env);
  await sendMsg(env, chatId, '✅ تم التعديل.');
}

async function delContent(chatId, cid, env, msgId) {
  const secs = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  for (const s of secs) {
    let contents = await env.BOT_KV.get(`contents:${s.id}`, { type: 'json' }) || [];
    const filtered = contents.filter(c => c.id !== cid);
    if (filtered.length !== contents.length) { await env.BOT_KV.put(`contents:${s.id}`, JSON.stringify(filtered)); break; }
  }
  await editMsg(env, chatId, msgId, '✅ تم الحذف.', { inline_keyboard: [[{ text: '🔙', callback_data: 'content' }]] });
}

// ==================== اشتراك إجباري ====================
async function showForce(chatId, env, msgId) {
  const channels = await env.BOT_KV.get('force_channels', { type: 'json' }) || [];
  let txt = '🔗 *اشتراك إجباري*\n\n';
  if (channels.length === 0) txt += 'لا توجد.';
  else channels.forEach((ch, i) => txt += `${i + 1}. ${ch}\n`);
  const kb = { inline_keyboard: [
    [{ text: '➕', callback_data: 'f_add' }, { text: '🗑', callback_data: 'f_del' }],
    [{ text: '🔙', callback_data: 'menu' }]
  ]};
  if (msgId) await editMsg(env, chatId, msgId, txt, { reply_markup: kb, parse_mode: 'Markdown' });
  else await sendMsg(env, chatId, txt, { reply_markup: kb, parse_mode: 'Markdown' });
}

async function doAddForce(chatId, ch, env) {
  const channels = await env.BOT_KV.get('force_channels', { type: 'json' }) || [];
  if (!channels.includes(ch)) { channels.push(ch); await env.BOT_KV.put('force_channels', JSON.stringify(channels)); }
  await clearState(chatId, env);
  await sendMsg(env, chatId, `✅ ${ch}`);
}

async function doDelForce(chatId, input, env) {
  let channels = await env.BOT_KV.get('force_channels', { type: 'json' }) || [];
  const num = parseInt(input);
  let removed = false;
  if (!isNaN(num) && num > 0 && num <= channels.length) {
    const r = channels.splice(num - 1, 1)[0]; removed = true;
    await sendMsg(env, chatId, `✅ ${r}`);
  } else {
    const idx = channels.indexOf(input);
    if (idx !== -1) { channels.splice(idx, 1); removed = true; await sendMsg(env, chatId, `✅ ${input}`); }
  }
  if (!removed) await sendMsg(env, chatId, '❌ غير موجود');
  else await env.BOT_KV.put('force_channels', JSON.stringify(channels));
  await clearState(chatId, env);
}

// ==================== دوال مساعدة ====================
async function sendMsg(env, chatId, text, extra = {}) {
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...extra })
  });
}

async function editMsg(env, chatId, msgId, text, extra = {}) {
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/editMessageText`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: msgId, text, ...extra })
  });
}

async function deleteMsg(env, chatId, msgId) {
  try { await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/deleteMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message_id: msgId }) }); } catch(e) {}
}

async function answerCb(env, id, text) {
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: id, text }) });
}

async function setState(chatId, action, data, env) {
  await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({ action, ...(data || {}) }));
}

async function clearState(chatId, env) {
  await env.BOT_KV.delete(`state:${chatId}`);
}
