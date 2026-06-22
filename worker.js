// ==================== إعدادات الأدمن ====================
const ADMIN_IDS = ['6455001010']; // ضع معرفك الرقمي هنا (الذي يظهر من @userinfobot)

export default {
  async fetch(request, env) {
    if (request.method === 'GET') {
      return new Response('Bot is running! ✅');
    }
    
    if (request.method === 'POST') {
      try {
        const update = await request.json();
        return await handleUpdate(update, env);
      } catch (error) {
        console.error('Error:', error.message);
        return new Response('OK');
      }
    }
    
    return new Response('Method not allowed', { status: 405 });
  }
};

// ==================== معالجة التحديثات ====================
async function handleUpdate(update, env) {
  // معالجة الرسائل
  if (update.message) {
    return await handleMessage(update.message, env);
  }
  
  // معالجة callback queries (الأزرار)
  if (update.callback_query) {
    return await handleCallback(update.callback_query, env);
  }
  
  return new Response('OK');
}

// ==================== معالجة الرسائل ====================
async function handleMessage(message, env) {
  const chatId = message.chat.id.toString();
  const text = message.text || '';
  const contact = message.contact;
  
  // الحصول على حالة المستخدم
  let userState = await env.BOT_KV.get(`state:${chatId}`, { type: 'json' });
  if (!userState) userState = {};
  
  // ====== أمر البداية ======
  if (text === '/start') {
    return await sendMessage(env, chatId,
      '👋 مرحباً بك في بوت القصص!\n\nللتحقق من هويتك، يرجى مشاركة رقم هاتفك.',
      {
        reply_markup: {
          keyboard: [[{ text: '📱 مشاركة رقم الهاتف', request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }
    );
  }
  
  // ====== استلام جهة الاتصال ======
  if (contact) {
    const phone = contact.phone_number;
    const userId = message.from.id.toString();
    const firstName = contact.first_name || message.from.first_name || '';
    const lastName = contact.last_name || message.from.last_name || '';
    
    // حفظ بيانات المستخدم
    const userData = {
      id: userId,
      username: message.from.username || '',
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      join_date: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      is_blocked: false
    };
    
    await env.BOT_KV.put(`user:${userId}`, JSON.stringify(userData));
    
    // إضافة للقائمة
    let usersList = await env.BOT_KV.get('users_list', { type: 'json' });
    if (!usersList) usersList = [];
    if (!usersList.includes(userId)) {
      usersList.push(userId);
      await env.BOT_KV.put('users_list', JSON.stringify(usersList));
    }
    
    await sendMessage(env, chatId, 
      '✅ تم التحقق من هويتك بنجاح!\n\nرقم هاتفك: ' + phone
    );
    
    // إذا كان أدمن يظهر له لوحة التحكم
    if (ADMIN_IDS.includes(chatId)) {
      return await showAdminPanel(chatId, env);
    }
    
    // وإلا يظهر له الأقسام
    return await showCategoriesToUser(chatId, env);
  }
  
  // ====== لوحة تحكم الأدمن ======
  if (text === '/admin' || text === '🔙 رجوع للقائمة الرئيسية') {
    if (ADMIN_IDS.includes(chatId)) {
      return await showAdminPanel(chatId, env);
    }
  }
  
  // ====== معالجة إدخالات الأدمن حسب الحالة ======
  if (ADMIN_IDS.includes(chatId)) {
    if (userState.action === 'waiting_block_id') {
      return await handleBlockUser(chatId, text, env);
    }
    if (userState.action === 'waiting_unblock_id') {
      return await handleUnblockUser(chatId, text, env);
    }
    if (userState.action === 'waiting_section_name') {
      return await handleAddSection(chatId, text, env);
    }
    if (userState.action === 'waiting_edit_section_num') {
      return await handleEditSectionNum(chatId, text, env);
    }
    if (userState.action === 'waiting_edit_section_name') {
      return await handleEditSectionName(chatId, text, env);
    }
    if (userState.action === 'waiting_delete_section_num') {
      return await handleDeleteSectionNum(chatId, text, env);
    }
    if (userState.action === 'waiting_content_section') {
      return await handleContentSection(chatId, text, env, userState);
    }
    if (userState.action === 'waiting_content_title') {
      return await handleContentTitle(chatId, text, env, userState);
    }
    if (userState.action === 'adding_content') {
      return await handleAddingContent(chatId, text, env, userState);
    }
    if (userState.action === 'waiting_force_channel') {
      return await handleAddForceChannel(chatId, text, env);
    }
    if (userState.action === 'waiting_delete_force') {
      return await handleDeleteForceChannel(chatId, text, env);
    }
    if (userState.action === 'waiting_edit_content_select') {
      return await handleEditContentSelect(chatId, text, env, userState);
    }
    if (userState.action === 'waiting_edit_content_new') {
      return await handleEditContentNew(chatId, text, env, userState);
    }
    if (userState.action === 'waiting_delete_content_select') {
      return await handleDeleteContentSelect(chatId, text, env, userState);
    }
  }
  
  // ====== المستخدم العادي يرى الأقسام ======
  if (text === '📚 عرض الأقسام') {
    return await showCategoriesToUser(chatId, env);
  }
  
  // رسالة افتراضية
  return await sendMessage(env, chatId, 'استخدم /start للبدء أو /admin للوحة التحكم.');
}

// ==================== معالجة الأزرار (Callback) ====================
async function handleCallback(callback, env) {
  const chatId = callback.message.chat.id.toString();
  const data = callback.data;
  const messageId = callback.message.message_id;
  
  // ====== لوحة الأدمن الرئيسية ======
  if (data === 'admin_users') {
    return await showUsersList(chatId, env, messageId);
  }
  if (data === 'admin_content') {
    return await showContentMenu(chatId, env, messageId);
  }
  if (data === 'admin_sections') {
    return await showSectionsMenu(chatId, env, messageId);
  }
  if (data === 'admin_force') {
    return await showForceSubMenu(chatId, env, messageId);
  }
  if (data === 'admin_back') {
    await deleteMessage(env, chatId, messageId);
    return await showAdminPanel(chatId, env);
  }
  
  // ====== إدارة المستخدمين ======
  if (data === 'block_user') {
    await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({ action: 'waiting_block_id' }));
    return await editMessage(env, chatId, messageId,
      '🔒 أرسل معرف المستخدم (ID) الذي تريد حظره:',
      { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_users' }]] }
    );
  }
  if (data === 'unblock_user') {
    await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({ action: 'waiting_unblock_id' }));
    return await editMessage(env, chatId, messageId,
      '🔓 أرسل معرف المستخدم (ID) الذي تريد إلغاء حظره:',
      { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_users' }]] }
    );
  }
  if (data === 'blocked_list') {
    return await showBlockedList(chatId, env, messageId);
  }
  if (data.startsWith('unblock_')) {
    const userId = data.replace('unblock_', '');
    return await unblockUserById(chatId, userId, env, messageId);
  }
  
  // ====== إدارة الأقسام ======
  if (data === 'add_section') {
    await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({ action: 'waiting_section_name' }));
    return await editMessage(env, chatId, messageId,
      '📁 أرسل اسم القسم الجديد:',
      { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_sections' }]] }
    );
  }
  if (data === 'edit_section') {
    await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({ action: 'waiting_edit_section_num' }));
    return await editMessage(env, chatId, messageId,
      '✏️ أرسل رقم القسم الذي تريد تعديله:',
      { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_sections' }]] }
    );
  }
  if (data === 'delete_section') {
    await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({ action: 'waiting_delete_section_num' }));
    return await editMessage(env, chatId, messageId,
      '🗑 أرسل رقم القسم الذي تريد حذفه:',
      { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_sections' }]] }
    );
  }
  
  // ====== إدارة المحتوى ======
  if (data === 'content_stats') {
    return await showContentStats(chatId, env, messageId);
  }
  if (data === 'add_content') {
    return await startAddContent(chatId, env, messageId);
  }
  if (data === 'edit_content') {
    return await startEditContent(chatId, env, messageId);
  }
  if (data === 'delete_content') {
    return await startDeleteContent(chatId, env, messageId);
  }
  
  // اختيار قسم للمحتوى
  if (data.startsWith('add_sec_')) {
    const sectionId = data.replace('add_sec_', '');
    await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({
      action: 'waiting_content_title',
      section_id: sectionId
    }));
    return await editMessage(env, chatId, messageId,
      '📝 أرسل عنوان المحتوى:',
      { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_content' }]] }
    );
  }
  if (data.startsWith('edit_sec_')) {
    const sectionId = data.replace('edit_sec_', '');
    return await showSectionContentsForEdit(chatId, sectionId, env, messageId);
  }
  if (data.startsWith('edit_item_')) {
    const contentId = data.replace('edit_item_', '');
    await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({
      action: 'waiting_edit_content_new',
      content_id: contentId
    }));
    return await editMessage(env, chatId, messageId,
      '📝 أرسل المحتوى الجديد:',
      { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'edit_content' }]] }
    );
  }
  if (data.startsWith('del_sec_')) {
    const sectionId = data.replace('del_sec_', '');
    return await showSectionContentsForDelete(chatId, sectionId, env, messageId);
  }
  if (data.startsWith('del_item_')) {
    const contentId = data.replace('del_item_', '');
    return await confirmDeleteContent(chatId, contentId, env, messageId);
  }
  if (data.startsWith('confirm_del_')) {
    const contentId = data.replace('confirm_del_', '');
    return await executeDeleteContent(chatId, contentId, env, messageId);
  }
  
  // ====== الاشتراك الإجباري ======
  if (data === 'add_force') {
    await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({ action: 'waiting_force_channel' }));
    return await editMessage(env, chatId, messageId,
      '➕ أرسل معرف القناة (مع @):',
      { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_force' }]] }
    );
  }
  if (data === 'delete_force') {
    await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({ action: 'waiting_delete_force' }));
    return await editMessage(env, chatId, messageId,
      '🗑 أرسل رقم القناة أو @المعرف للحذف:',
      { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_force' }]] }
    );
  }
  
  // ====== تصفح المستخدم ======
  if (data.startsWith('section_')) {
    const sectionId = data.replace('section_', '');
    return await showContentsToUser(chatId, sectionId, env, messageId);
  }
  if (data.startsWith('content_')) {
    const contentId = data.replace('content_', '');
    return await showContentToUser(chatId, contentId, env, messageId);
  }
  if (data === 'back_to_sections') {
    await deleteMessage(env, chatId, messageId);
    return await showCategoriesToUser(chatId, env);
  }
  
  // رد افتراضي للأزرار
  await answerCallback(env, callback.id, 'تم');
  return new Response('OK');
}

// ==================== لوحة تحكم الأدمن ====================
async function showAdminPanel(chatId, env) {
  const keyboard = {
    keyboard: [
      [{ text: '👥 قسم المستخدمين' }],
      [{ text: '📊 إدارة المحتوى' }],
      [{ text: '📁 إدارة الأقسام' }],
      [{ text: '🔗 الاشتراك الإجباري' }]
    ],
    resize_keyboard: true
  };
  
  await sendMessage(env, chatId, '🎛 *لوحة تحكم الأدمن*\n\nاختر القسم المطلوب:', {
    reply_markup: keyboard,
    parse_mode: 'Markdown'
  });
}

// ==================== إدارة المستخدمين (أدمن) ====================
async function showUsersList(chatId, env, messageId) {
  const usersList = await env.BOT_KV.get('users_list', { type: 'json' });
  if (!usersList || usersList.length === 0) {
    return await editMessage(env, chatId, messageId,
      '👥 لا يوجد مستخدمين بعد.',
      { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_back' }]] }
    );
  }
  
  let text = '👥 *قائمة المستخدمين*\n\n';
  
  for (const userId of usersList) {
    const user = await env.BOT_KV.get(`user:${userId}`, { type: 'json' });
    if (user) {
      text += `🆔 ${user.id}\n`;
      text += `👤 ${user.first_name} ${user.last_name}\n`;
      text += `📱 ${user.phone}\n`;
      text += `📅 ${new Date(user.join_date).toLocaleDateString('ar-SA')}\n`;
      text += `🕐 ${new Date(user.last_activity).toLocaleDateString('ar-SA')}\n`;
      text += `🚫 ${user.is_blocked ? 'محظور' : 'نشط'}\n`;
      text += '➖➖➖➖➖➖\n';
    }
  }
  
  const keyboard = {
    inline_keyboard: [
      [{ text: '🚫 حظر مستخدم', callback_data: 'block_user' }, { text: '🔓 إلغاء حظر', callback_data: 'unblock_user' }],
      [{ text: '📋 قائمة المحظورين', callback_data: 'blocked_list' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
    ]
  };
  
  await editMessage(env, chatId, messageId, text, { reply_markup: keyboard, parse_mode: 'Markdown' });
}

async function handleBlockUser(chatId, userId, env) {
  const user = await env.BOT_KV.get(`user:${userId}`, { type: 'json' });
  if (!user) {
    await sendMessage(env, chatId, '❌ المستخدم غير موجود.');
  } else {
    user.is_blocked = true;
    await env.BOT_KV.put(`user:${userId}`, JSON.stringify(user));
    await sendMessage(env, chatId, `✅ تم حظر المستخدم ${userId}`);
  }
  await env.BOT_KV.delete(`state:${chatId}`);
}

async function handleUnblockUser(chatId, userId, env) {
  const user = await env.BOT_KV.get(`user:${userId}`, { type: 'json' });
  if (!user) {
    await sendMessage(env, chatId, '❌ المستخدم غير موجود.');
  } else {
    user.is_blocked = false;
    await env.BOT_KV.put(`user:${userId}`, JSON.stringify(user));
    await sendMessage(env, chatId, `✅ تم إلغاء حظر المستخدم ${userId}`);
  }
  await env.BOT_KV.delete(`state:${chatId}`);
}

async function showBlockedList(chatId, env, messageId) {
  const usersList = await env.BOT_KV.get('users_list', { type: 'json' }) || [];
  let text = '🚫 *المستخدمين المحظورين*\n\n';
  const keyboard = { inline_keyboard: [] };
  let hasBlocked = false;
  
  for (const userId of usersList) {
    const user = await env.BOT_KV.get(`user:${userId}`, { type: 'json' });
    if (user && user.is_blocked) {
      hasBlocked = true;
      text += `🆔 ${userId} - ${user.first_name}\n`;
      keyboard.inline_keyboard.push([{ text: `🔓 إلغاء حظر ${userId}`, callback_data: `unblock_${userId}` }]);
    }
  }
  
  if (!hasBlocked) text += 'لا يوجد مستخدمين محظورين.';
  keyboard.inline_keyboard.push([{ text: '🔙 رجوع', callback_data: 'admin_users' }]);
  
  await editMessage(env, chatId, messageId, text, { reply_markup: keyboard, parse_mode: 'Markdown' });
}

async function unblockUserById(chatId, userId, env, messageId) {
  const user = await env.BOT_KV.get(`user:${userId}`, { type: 'json' });
  if (user) {
    user.is_blocked = false;
    await env.BOT_KV.put(`user:${userId}`, JSON.stringify(user));
  }
  await showBlockedList(chatId, env, messageId);
}

// ==================== إدارة المحتوى (أدمن) ====================
async function showContentMenu(chatId, env, messageId) {
  const keyboard = {
    inline_keyboard: [
      [{ text: '📊 إحصائيات المحتوى', callback_data: 'content_stats' }],
      [{ text: '➕ إضافة محتوى', callback_data: 'add_content' }],
      [{ text: '✏️ تعديل محتوى', callback_data: 'edit_content' }],
      [{ text: '🗑 حذف محتوى', callback_data: 'delete_content' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
    ]
  };
  
  await editMessage(env, chatId, messageId, '📊 *إدارة المحتوى*', { reply_markup: keyboard, parse_mode: 'Markdown' });
}

async function showContentStats(chatId, env, messageId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  let text = '📊 *إحصائيات المحتوى*\n\n';
  
  for (const section of sections) {
    const contents = await env.BOT_KV.get(`contents:${section.id}`, { type: 'json' }) || [];
    text += `📁 ${section.name}: ${contents.length} محتوى\n`;
  }
  
  if (sections.length === 0) text += 'لا توجد أقسام بعد.';
  
  await editMessage(env, chatId, messageId, text, {
    reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_content' }]] },
    parse_mode: 'Markdown'
  });
}

// إضافة محتوى
async function startAddContent(chatId, env, messageId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  
  if (sections.length === 0) {
    return await editMessage(env, chatId, messageId,
      '❌ لا توجد أقسام. أضف قسماً أولاً.',
      { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_content' }]] }
    );
  }
  
  const keyboard = { inline_keyboard: [] };
  for (const section of sections) {
    keyboard.inline_keyboard.push([{ text: section.name, callback_data: `add_sec_${section.id}` }]);
  }
  keyboard.inline_keyboard.push([{ text: '🔙 رجوع', callback_data: 'admin_content' }]);
  
  await editMessage(env, chatId, messageId, '📁 اختر القسم:', { reply_markup: keyboard });
}

async function handleContentTitle(chatId, title, env, userState) {
  userState.content_title = title;
  userState.content_parts = [];
  userState.action = 'adding_content';
  await env.BOT_KV.put(`state:${chatId}`, JSON.stringify(userState));
  
  await sendMessage(env, chatId,
    '📝 أرسل المحتوى الآن (يمكنك إرسال عدة رسائل).\n\nاضغط "✅ تم الانتهاء" عند الانتهاء.',
    {
      reply_markup: {
        keyboard: [[{ text: '✅ تم الانتهاء' }]],
        resize_keyboard: true
      }
    }
  );
}

async function handleAddingContent(chatId, text, env, userState) {
  if (text === '✅ تم الانتهاء') {
    const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
    const section = sections.find(s => s.id === userState.section_id);
    
    const contents = await env.BOT_KV.get(`contents:${userState.section_id}`, { type: 'json' }) || [];
    const contentId = Date.now().toString();
    const contentNumber = contents.length + 1;
    
    const newContent = {
      id: contentId,
      number: contentNumber,
      title: userState.content_title,
      content: userState.content_parts.join('\n\n'),
      section_id: userState.section_id,
      created_at: new Date().toISOString()
    };
    
    contents.push(newContent);
    await env.BOT_KV.put(`contents:${userState.section_id}`, JSON.stringify(contents));
    
    await env.BOT_KV.delete(`state:${chatId}`);
    
    // الحصول على اسم البوت للرابط
    let botUsername = 'bot';
    try {
      const meRes = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getMe`);
      const meData = await meRes.json();
      botUsername = meData.result.username;
    } catch(e) {}
    
    const shareLink = `https://t.me/${botUsername}?start=content_${contentId}`;
    
    await sendMessage(env, chatId,
      `✅ تم إضافة المحتوى بنجاح!\n\n` +
      `📁 القسم: ${section?.name || userState.section_id}\n` +
      `📝 العنوان: ${userState.content_title}\n` +
      `🆔 رقم: ${contentNumber}\n` +
      `🔗 الرابط: ${shareLink}`,
      {
        reply_markup: {
          keyboard: [
            [{ text: '📊 إدارة المحتوى' }],
            [{ text: '🔙 رجوع للقائمة الرئيسية' }]
          ],
          resize_keyboard: true
        }
      }
    );
  } else {
    userState.content_parts.push(text);
    await env.BOT_KV.put(`state:${chatId}`, JSON.stringify(userState));
    await sendMessage(env, chatId, '✅ تم إضافة الجزء. أرسل المزيد أو اضغط "تم الانتهاء".');
  }
}

// تعديل محتوى
async function startEditContent(chatId, env, messageId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  
  if (sections.length === 0) {
    return await editMessage(env, chatId, messageId,
      '❌ لا توجد أقسام.',
      { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_content' }]] }
    );
  }
  
  const keyboard = { inline_keyboard: [] };
  for (const section of sections) {
    keyboard.inline_keyboard.push([{ text: section.name, callback_data: `edit_sec_${section.id}` }]);
  }
  keyboard.inline_keyboard.push([{ text: '🔙 رجوع', callback_data: 'admin_content' }]);
  
  await editMessage(env, chatId, messageId, '📁 اختر القسم:', { reply_markup: keyboard });
}

async function showSectionContentsForEdit(chatId, sectionId, env, messageId) {
  const contents = await env.BOT_KV.get(`contents:${sectionId}`, { type: 'json' }) || [];
  
  if (contents.length === 0) {
    return await editMessage(env, chatId, messageId,
      '❌ لا يوجد محتوى في هذا القسم.',
      { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'edit_content' }]] }
    );
  }
  
  const keyboard = { inline_keyboard: [] };
  for (const c of contents) {
    keyboard.inline_keyboard.push([{ text: `${c.number}. ${c.title}`, callback_data: `edit_item_${c.id}` }]);
  }
  keyboard.inline_keyboard.push([{ text: '🔙 رجوع', callback_data: 'edit_content' }]);
  
  await editMessage(env, chatId, messageId, '📝 اختر المحتوى للتعديل:', { reply_markup: keyboard });
}

async function handleEditContentNew(chatId, newContent, env, userState) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  
  for (const section of sections) {
    const contents = await env.BOT_KV.get(`contents:${section.id}`, { type: 'json' }) || [];
    const idx = contents.findIndex(c => c.id === userState.content_id);
    if (idx !== -1) {
      contents[idx].content = newContent;
      await env.BOT_KV.put(`contents:${section.id}`, JSON.stringify(contents));
      break;
    }
  }
  
  await env.BOT_KV.delete(`state:${chatId}`);
  await sendMessage(env, chatId, '✅ تم تعديل المحتوى بنجاح!');
}

// حذف محتوى
async function startDeleteContent(chatId, env, messageId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  
  if (sections.length === 0) {
    return await editMessage(env, chatId, messageId,
      '❌ لا توجد أقسام.',
      { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_content' }]] }
    );
  }
  
  const keyboard = { inline_keyboard: [] };
  for (const section of sections) {
    keyboard.inline_keyboard.push([{ text: section.name, callback_data: `del_sec_${section.id}` }]);
  }
  keyboard.inline_keyboard.push([{ text: '🔙 رجوع', callback_data: 'admin_content' }]);
  
  await editMessage(env, chatId, messageId, '📁 اختر القسم:', { reply_markup: keyboard });
}

async function showSectionContentsForDelete(chatId, sectionId, env, messageId) {
  const contents = await env.BOT_KV.get(`contents:${sectionId}`, { type: 'json' }) || [];
  
  if (contents.length === 0) {
    return await editMessage(env, chatId, messageId,
      '❌ لا يوجد محتوى في هذا القسم.',
      { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'delete_content' }]] }
    );
  }
  
  const keyboard = { inline_keyboard: [] };
  for (const c of contents) {
    keyboard.inline_keyboard.push([{ text: `🗑 ${c.number}. ${c.title}`, callback_data: `del_item_${c.id}` }]);
  }
  keyboard.inline_keyboard.push([{ text: '🔙 رجوع', callback_data: 'delete_content' }]);
  
  await editMessage(env, chatId, messageId, '🗑 اختر المحتوى للحذف:', { reply_markup: keyboard });
}

async function confirmDeleteContent(chatId, contentId, env, messageId) {
  await editMessage(env, chatId, messageId,
    '⚠️ هل أنت متأكد من حذف هذا المحتوى؟',
    {
      inline_keyboard: [
        [{ text: '✅ نعم احذف', callback_data: `confirm_del_${contentId}` }],
        [{ text: '❌ إلغاء', callback_data: 'delete_content' }]
      ]
    }
  );
}

async function executeDeleteContent(chatId, contentId, env, messageId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  
  for (const section of sections) {
    let contents = await env.BOT_KV.get(`contents:${section.id}`, { type: 'json' }) || [];
    const filtered = contents.filter(c => c.id !== contentId);
    if (filtered.length !== contents.length) {
      await env.BOT_KV.put(`contents:${section.id}`, JSON.stringify(filtered));
      break;
    }
  }
  
  await editMessage(env, chatId, messageId,
    '✅ تم حذف المحتوى بنجاح!',
    { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_content' }]] }
  );
}

// ==================== إدارة الأقسام (أدمن) ====================
async function showSectionsMenu(chatId, env, messageId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  
  let text = '📁 *إدارة الأقسام*\n\n';
  
  if (sections.length === 0) {
    text += 'لا توجد أقسام حالياً.';
  } else {
    sections.forEach((s, i) => {
      text += `${i + 1}. ${s.name}\n`;
    });
  }
  
  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ إضافة قسم', callback_data: 'add_section' }],
      [{ text: '✏️ تعديل قسم', callback_data: 'edit_section' }],
      [{ text: '🗑 حذف قسم', callback_data: 'delete_section' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
    ]
  };
  
  await editMessage(env, chatId, messageId, text, { reply_markup: keyboard, parse_mode: 'Markdown' });
}

async function handleAddSection(chatId, name, env) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  sections.push({ id: Date.now().toString(), name: name });
  await env.BOT_KV.put('sections', JSON.stringify(sections));
  await env.BOT_KV.delete(`state:${chatId}`);
  await sendMessage(env, chatId, `✅ تم إضافة القسم "${name}" بنجاح!`);
}

async function handleEditSectionNum(chatId, num, env) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  const idx = parseInt(num) - 1;
  
  if (idx < 0 || idx >= sections.length) {
    await env.BOT_KV.delete(`state:${chatId}`);
    return await sendMessage(env, chatId, '❌ رقم غير صحيح.');
  }
  
  await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({
    action: 'waiting_edit_section_name',
    section_id: sections[idx].id
  }));
  
  await sendMessage(env, chatId, `القسم الحالي: ${sections[idx].name}\n\nأرسل الاسم الجديد:`);
}

async function handleEditSectionName(chatId, newName, env) {
  const state = await env.BOT_KV.get(`state:${chatId}`, { type: 'json' });
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  const idx = sections.findIndex(s => s.id === state.section_id);
  
  if (idx !== -1) {
    sections[idx].name = newName;
    await env.BOT_KV.put('sections', JSON.stringify(sections));
    await sendMessage(env, chatId, `✅ تم تعديل القسم إلى "${newName}".`);
  }
  
  await env.BOT_KV.delete(`state:${chatId}`);
}

async function handleDeleteSectionNum(chatId, num, env) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  const idx = parseInt(num) - 1;
  
  if (idx < 0 || idx >= sections.length) {
    await env.BOT_KV.delete(`state:${chatId}`);
    return await sendMessage(env, chatId, '❌ رقم غير صحيح.');
  }
  
  const contents = await env.BOT_KV.get(`contents:${sections[idx].id}`, { type: 'json' }) || [];
  if (contents.length > 0) {
    await env.BOT_KV.delete(`state:${chatId}`);
    return await sendMessage(env, chatId, '❌ لا يمكن حذف قسم يحتوي على محتوى. احذف المحتوى أولاً.');
  }
  
  const deletedName = sections[idx].name;
  sections.splice(idx, 1);
  await env.BOT_KV.put('sections', JSON.stringify(sections));
  await env.BOT_KV.delete(`state:${chatId}`);
  await sendMessage(env, chatId, `✅ تم حذف القسم "${deletedName}".`);
}

// ==================== الاشتراك الإجباري (أدمن) ====================
async function showForceSubMenu(chatId, env, messageId) {
  const channels = await env.BOT_KV.get('force_channels', { type: 'json' }) || [];
  
  let text = '🔗 *الاشتراك الإجباري*\n\n';
  
  if (channels.length === 0) {
    text += 'لا توجد قنوات.';
  } else {
    channels.forEach((ch, i) => {
      text += `${i + 1}. ${ch}\n`;
    });
  }
  
  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ إضافة', callback_data: 'add_force' }],
      [{ text: '🗑 حذف', callback_data: 'delete_force' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
    ]
  };
  
  await editMessage(env, chatId, messageId, text, { reply_markup: keyboard, parse_mode: 'Markdown' });
}

async function handleAddForceChannel(chatId, channel, env) {
  const channels = await env.BOT_KV.get('force_channels', { type: 'json' }) || [];
  if (!channels.includes(channel)) {
    channels.push(channel);
    await env.BOT_KV.put('force_channels', JSON.stringify(channels));
    await sendMessage(env, chatId, `✅ تم إضافة ${channel}`);
  } else {
    await sendMessage(env, chatId, '❌ موجودة بالفعل.');
  }
  await env.BOT_KV.delete(`state:${chatId}`);
}

async function handleDeleteForceChannel(chatId, input, env) {
  let channels = await env.BOT_KV.get('force_channels', { type: 'json' }) || [];
  const num = parseInt(input);
  
  if (!isNaN(num) && num > 0 && num <= channels.length) {
    const removed = channels.splice(num - 1, 1)[0];
    await env.BOT_KV.put('force_channels', JSON.stringify(channels));
    await sendMessage(env, chatId, `✅ تم حذف ${removed}`);
  } else {
    const idx = channels.indexOf(input);
    if (idx !== -1) {
      channels.splice(idx, 1);
      await env.BOT_KV.put('force_channels', JSON.stringify(channels));
      await sendMessage(env, chatId, `✅ تم حذف ${input}`);
    } else {
      await sendMessage(env, chatId, '❌ غير موجود.');
    }
  }
  
  await env.BOT_KV.delete(`state:${chatId}`);
}

// ==================== واجهة المستخدم ====================
async function showCategoriesToUser(chatId, env) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  
  if (sections.length === 0) {
    return await sendMessage(env, chatId, '📚 لا توجد أقسام متاحة حالياً.');
  }
  
  const keyboard = { inline_keyboard: [] };
  for (let i = 0; i < sections.length; i += 2) {
    const row = [{ text: sections[i].name, callback_data: `section_${sections[i].id}` }];
    if (sections[i + 1]) {
      row.push({ text: sections[i + 1].name, callback_data: `section_${sections[i + 1].id}` });
    }
    keyboard.inline_keyboard.push(row);
  }
  
  await sendMessage(env, chatId, '📚 *الأقسام المتاحة*\nاختر قسماً:', {
    reply_markup: keyboard,
    parse_mode: 'Markdown'
  });
}

async function showContentsToUser(chatId, sectionId, env, messageId) {
  const contents = await env.BOT_KV.get(`contents:${sectionId}`, { type: 'json' }) || [];
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  const section = sections.find(s => s.id === sectionId);
  
  if (contents.length === 0) {
    return await editMessage(env, chatId, messageId,
      `📁 ${section?.name || 'القسم'}\n\nلا يوجد محتوى بعد.`,
      { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'back_to_sections' }]] }
    );
  }
  
  const keyboard = { inline_keyboard: [] };
  for (const c of contents) {
    keyboard.inline_keyboard.push([{ text: `${c.number}. ${c.title}`, callback_data: `content_${c.id}` }]);
  }
  keyboard.inline_keyboard.push([{ text: '🔙 رجوع للأقسام', callback_data: 'back_to_sections' }]);
  
  await editMessage(env, chatId, messageId,
    `📁 *${section?.name || 'القسم'}*\nاختر المحتوى:`,
    { reply_markup: keyboard, parse_mode: 'Markdown' }
  );
}

async function showContentToUser(chatId, contentId, env, messageId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  let content = null;
  let sectionName = '';
  
  for (const section of sections) {
    const contents = await env.BOT_KV.get(`contents:${section.id}`, { type: 'json' }) || [];
    const found = contents.find(c => c.id === contentId);
    if (found) {
      content = found;
      sectionName = section.name;
      break;
    }
  }
  
  if (!content) {
    return await editMessage(env, chatId, messageId,
      '❌ المحتوى غير متوفر.',
      { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'back_to_sections' }]] }
    );
  }
  
  await editMessage(env, chatId, messageId,
    `📁 *${sectionName}*\n📝 *${content.title}*\n🆔 رقم: ${content.number}\n➖➖➖➖➖\n${content.content}`,
    {
      inline_keyboard: [[{ text: '🔙 رجوع للقسم', callback_data: `section_${content.section_id}` }]],
      parse_mode: 'Markdown'
    }
  );
}

// ==================== دوال مساعدة ====================
async function sendMessage(env, chatId, text, extra = {}) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text, ...extra })
  });
}

async function editMessage(env, chatId, messageId, text, replyMarkup = null) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/editMessageText`;
  const body = { chat_id: chatId, message_id: messageId, text: text };
  if (replyMarkup) body.reply_markup = replyMarkup;
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function deleteMessage(env, chatId, messageId) {
  try {
    await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId })
    });
  } catch(e) {}
}

async function answerCallback(env, callbackId, text) {
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId, text: text })
  });
}
