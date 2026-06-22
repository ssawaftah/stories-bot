// ==================== إعدادات البوت ====================
const ADMIN_IDS = ['6455001010', 'ADMIN_ID_2']; // ضع معرفات الأدمن هنا

export default {
  async fetch(request, env) {
    if (request.method === 'POST') {
      const update = await request.json();
      return await handleUpdate(update, env);
    }
    return new Response('Bot is running');
  }
};

// ==================== معالجة التحديثات ====================
async function handleUpdate(update, env) {
  try {
    // معالجة الرسائل
    if (update.message) {
      return await handleMessage(update.message, env);
    }
    // معالجة ضغطات الأزرار (callback queries)
    if (update.callback_query) {
      return await handleCallbackQuery(update.callback_query, env);
    }
  } catch (error) {
    console.error('Error:', error);
  }
  return new Response('OK');
}

// ==================== معالجة الرسائل ====================
async function handleMessage(message, env) {
  const chatId = message.chat.id.toString();
  const text = message.text || '';
  const contact = message.contact;
  
  // حفظ حالة المستخدم
  const userState = await env.BOT_KV.get(`state:${chatId}`, { type: 'json' }) || {};
  
  // === بدء المحادثة ===
  if (text === '/start') {
    // التحقق من وجود اشتراك إجباري
    const hasForceSub = await checkForceSubscription(chatId, env);
    if (!hasForceSub.status) {
      return await sendMessage(env, chatId, 
        '⚠️ يجب الاشتراك في القنوات التالية أولاً:\n\n' + hasForceSub.channels,
        { reply_markup: { inline_keyboard: [[{ text: '✅ تحقق من الاشتراك', callback_data: 'check_sub' }]] } }
      );
    }
    
    // طلب رقم الهاتف للتحقق
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
  
  // === استلام جهة الاتصال ===
  if (contact) {
    const phone = contact.phone_number;
    const userId = contact.user_id || message.from.id;
    const firstName = contact.first_name || message.from.first_name;
    const lastName = contact.last_name || message.from.last_name || '';
    
    // حفظ المستخدم في KV
    const userData = {
      id: userId.toString(),
      username: message.from.username || '',
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      join_date: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      is_blocked: false
    };
    
    await env.BOT_KV.put(`user:${userId}`, JSON.stringify(userData));
    
    // إضافة للمستخدمين
    let usersList = await env.BOT_KV.get('users_list', { type: 'json' }) || [];
    if (!usersList.includes(userId.toString())) {
      usersList.push(userId.toString());
      await env.BOT_KV.put('users_list', JSON.stringify(usersList));
    }
    
    // إرسال تأكيد
    await sendMessage(env, chatId, 
      '✅ تم التحقق من هويتك بنجاح!\n\nرقم هاتفك: ' + phone + '\nطلبك قيد المعالجة.'
    );
    
    // إظهار الأقسام للمستخدم
    return await showCategories(chatId, env);
  }
  
  // === معالجة أوامر الأدمن ===
  if (ADMIN_IDS.includes(chatId)) {
    // معالجة حالات الأدمن المختلفة
    if (userState.action === 'waiting_block_id') {
      return await handleBlockUser(chatId, text, env, userState);
    }
    if (userState.action === 'waiting_unblock_id') {
      return await handleUnblockUser(chatId, text, env, userState);
    }
    if (userState.action === 'waiting_section_name') {
      return await handleAddSection(chatId, text, env, userState);
    }
    if (userState.action === 'waiting_edit_section_id') {
      return await handleEditSectionGetId(chatId, text, env, userState);
    }
    if (userState.action === 'waiting_edit_section_name') {
      return await handleEditSectionName(chatId, text, env, userState);
    }
    if (userState.action === 'waiting_delete_section_id') {
      return await handleDeleteSection(chatId, text, env, userState);
    }
    if (userState.action === 'waiting_content_section') {
      return await handleAddContentSection(chatId, text, env, userState);
    }
    if (userState.action === 'waiting_content_title') {
      return await handleAddContentTitle(chatId, text, env, userState);
    }
    if (userState.action === 'adding_content') {
      return await handleAddingContent(chatId, text, env, userState);
    }
    if (userState.action === 'waiting_edit_content_section') {
      return await handleEditContentSection(chatId, text, env, userState);
    }
    if (userState.action === 'waiting_edit_content_select') {
      return await handleEditContentSelect(chatId, text, env, userState);
    }
    if (userState.action === 'waiting_edit_content_new') {
      return await handleEditContentNew(chatId, text, env, userState);
    }
    if (userState.action === 'waiting_delete_content_section') {
      return await handleDeleteContentSection(chatId, text, env, userState);
    }
    if (userState.action === 'waiting_delete_content_select') {
      return await handleDeleteContentSelect(chatId, text, env, userState);
    }
    if (userState.action === 'waiting_force_channel') {
      return await handleAddForceChannel(chatId, text, env, userState);
    }
    if (userState.action === 'waiting_delete_force_channel') {
      return await handleDeleteForceChannel(chatId, text, env, userState);
    }
    
    // القائمة الرئيسية للأدمن
    if (text === '/admin' || text === '🔙 رجوع للقائمة الرئيسية') {
      return await showAdminMainMenu(chatId, env);
    }
  }
  
  // === معالجة المستخدم العادي ===
  if (text === '📚 عرض الأقسام') {
    return await showCategories(chatId, env);
  }
  
  // إذا كان المستخدم يتصفح قسم معين
  if (userState.viewing_section) {
    return await handleContentSelection(chatId, text, env, userState);
  }
  
  return new Response('OK');
}

// ==================== معالجة callback queries ====================
async function handleCallbackQuery(callbackQuery, env) {
  const chatId = callbackQuery.message.chat.id.toString();
  const data = callbackQuery.data;
  const messageId = callbackQuery.message.message_id;
  
  // التحقق من الاشتراك
  if (data === 'check_sub') {
    const hasForceSub = await checkForceSubscription(chatId, env);
    if (hasForceSub.status) {
      await answerCallback(env, callbackQuery.id, '✅ تم التحقق بنجاح');
      await deleteMessage(env, chatId, messageId);
      await sendMessage(env, chatId,
        '👋 مرحباً بك في بوت القصص!\n\nللتحقق من هويتك، يرجى مشاركة رقم هاتفك.',
        {
          reply_markup: {
            keyboard: [[{ text: '📱 مشاركة رقم الهاتف', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        }
      );
    } else {
      await answerCallback(env, callbackQuery.id, '❌ لم تشترك في جميع القنوات', true);
    }
    return new Response('OK');
  }
  
  // === قوائم الأدمن ===
  if (data === 'admin_users') {
    return await showUsersManagement(chatId, env, messageId);
  }
  if (data === 'admin_content') {
    return await showContentManagement(chatId, env, messageId);
  }
  if (data === 'admin_sections') {
    return await showSectionsManagement(chatId, env, messageId);
  }
  if (data === 'admin_force_sub') {
    return await showForceSubManagement(chatId, env, messageId);
  }
  if (data === 'admin_back') {
    await deleteMessage(env, chatId, messageId);
    return await showAdminMainMenu(chatId, env);
  }
  
  // إدارة المستخدمين
  if (data === 'block_user') {
    await setUserState(chatId, 'waiting_block_id', {}, env);
    return await editMessageText(env, chatId, messageId,
      '🔒 حظر مستخدم\n\nأرسل معرف المستخدم (ID) الذي تريد حظره:',
      { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_users' }]] } }
    );
  }
  if (data === 'unblock_user') {
    await setUserState(chatId, 'waiting_unblock_id', {}, env);
    return await editMessageText(env, chatId, messageId,
      '🔓 إلغاء حظر مستخدم\n\nأرسل معرف المستخدم (ID) الذي تريد إلغاء حظره:',
      { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_users' }]] } }
    );
  }
  if (data === 'blocked_list') {
    return await showBlockedUsers(chatId, env, messageId);
  }
  
  // إدارة الاشتراك الإجباري
  if (data === 'add_force_channel') {
    await setUserState(chatId, 'waiting_force_channel', {}, env);
    return await editMessageText(env, chatId, messageId,
      '➕ إضافة قناة اشتراك إجباري\n\nأرسل معرف القناة أو المجموعة (مع @) أو أرسل /all لحذف الكل:',
      { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_force_sub' }]] } }
    );
  }
  if (data === 'delete_force_channel') {
    await setUserState(chatId, 'waiting_delete_force_channel', {}, env);
    return await editMessageText(env, chatId, messageId,
      '🗑 حذف من الاشتراك الإجباري\n\nأرسل رقم القناة أو @المعرف:',
      { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_force_sub' }]] } }
    );
  }
  
  // عرض محتوى للمستخدمين
  if (data.startsWith('section_')) {
    const sectionId = data.replace('section_', '');
    return await showSectionContents(chatId, sectionId, env, messageId);
  }
  if (data.startsWith('content_')) {
    const contentId = data.replace('content_', '');
    return await showContent(chatId, contentId, env, messageId);
  }
  
  // أزرار إدارة المحتوى
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
  
  // اختيار قسم لإضافة/تعديل/حذف المحتوى
  if (data.startsWith('add_content_section_')) {
    const sectionId = data.replace('add_content_section_', '');
    await setUserState(chatId, 'waiting_content_title', { section_id: sectionId }, env);
    return await editMessageText(env, chatId, messageId,
      '📝 أرسل عنوان المحتوى الجديد:',
      { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_content' }]] } }
    );
  }
  if (data.startsWith('edit_content_section_')) {
    const sectionId = data.replace('edit_content_section_', '');
    return await showSectionContentsForEdit(chatId, sectionId, env, messageId);
  }
  if (data.startsWith('edit_content_item_')) {
    const contentId = data.replace('edit_content_item_', '');
    await setUserState(chatId, 'waiting_edit_content_new', { content_id: contentId }, env);
    return await editMessageText(env, chatId, messageId,
      '📝 أرسل المحتوى الجديد (نص أو قصة):',
      { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'edit_content' }]] } }
    );
  }
  if (data.startsWith('delete_content_section_')) {
    const sectionId = data.replace('delete_content_section_', '');
    return await showSectionContentsForDelete(chatId, sectionId, env, messageId);
  }
  if (data.startsWith('delete_content_item_')) {
    const contentId = data.replace('delete_content_item_', '');
    return await confirmDeleteContent(chatId, contentId, env, messageId);
  }
  if (data.startsWith('confirm_delete_content_')) {
    const contentId = data.replace('confirm_delete_content_', '');
    return await executeDeleteContent(chatId, contentId, env, messageId);
  }
  
  // أزرار إدارة الأقسام
  if (data === 'add_section') {
    await setUserState(chatId, 'waiting_section_name', {}, env);
    return await editMessageText(env, chatId, messageId,
      '📁 إضافة قسم جديد\n\nأرسل اسم القسم:',
      { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_sections' }]] } }
    );
  }
  if (data === 'edit_section') {
    await setUserState(chatId, 'waiting_edit_section_id', {}, env);
    return await editMessageText(env, chatId, messageId,
      '✏️ تعديل قسم\n\nأرسل رقم القسم الذي تريد تعديله:',
      { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_sections' }]] } }
    );
  }
  if (data === 'delete_section') {
    await setUserState(chatId, 'waiting_delete_section_id', {}, env);
    return await editMessageText(env, chatId, messageId,
      '🗑 حذف قسم\n\nأرسل رقم القسم الذي تريد حذفه:',
      { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_sections' }]] } }
    );
  }
  
  // أزرار إلغاء الحظر من القائمة
  if (data.startsWith('unblock_')) {
    const userId = data.replace('unblock_', '');
    return await unblockUserAction(chatId, userId, env, messageId);
  }
  
  await answerCallback(env, callbackQuery.id);
  return new Response('OK');
}

// ==================== دوال الأدمن الرئيسية ====================

async function showAdminMainMenu(chatId, env) {
  const keyboard = {
    keyboard: [
      [{ text: '👥 قسم المستخدمين' }],
      [{ text: '📊 إدارة المحتوى' }],
      [{ text: '📁 إدارة الأقسام' }],
      [{ text: '🔗 الاشتراك الإجباري' }]
    ],
    resize_keyboard: true
  };
  
  await sendMessage(env, chatId, '🎛 لوحة تحكم الأدمن\n\nاختر القسم المطلوب:', { reply_markup: keyboard });
}

// ==================== إدارة المستخدمين ====================

async function showUsersManagement(chatId, env, messageId) {
  const usersList = await env.BOT_KV.get('users_list', { type: 'json' }) || [];
  
  let text = '👥 *جميع المستخدمين*\n\n';
  
  for (const userId of usersList) {
    const userData = await env.BOT_KV.get(`user:${userId}`, { type: 'json' });
    if (userData) {
      const status = userData.is_blocked ? '🚫 محظور' : '✅ نشط';
      text += `🆔 ${userData.id}\n`;
      text += `👤 ${userData.first_name} ${userData.last_name}\n`;
      text += `📱 ${userData.phone}\n`;
      text += `📅 انضم: ${new Date(userData.join_date).toLocaleDateString('ar-SA')}\n`;
      text += `🕐 آخر نشاط: ${new Date(userData.last_activity).toLocaleDateString('ar-SA')}\n`;
      text += `الحالة: ${status}\n`;
      text += '➖➖➖➖➖➖➖➖\n';
    }
  }
  
  const keyboard = {
    inline_keyboard: [
      [{ text: '🚫 حظر مستخدم', callback_data: 'block_user' }, { text: '🔓 إلغاء حظر', callback_data: 'unblock_user' }],
      [{ text: '📋 قائمة المحظورين', callback_data: 'blocked_list' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
    ]
  };
  
  await editMessageText(env, chatId, messageId, text, { reply_markup: keyboard, parse_mode: 'Markdown' });
}

async function handleBlockUser(chatId, userId, env, userState) {
  const userData = await env.BOT_KV.get(`user:${userId}`, { type: 'json' });
  if (!userData) {
    await sendMessage(env, chatId, '❌ المستخدم غير موجود.');
  } else {
    userData.is_blocked = true;
    await env.BOT_KV.put(`user:${userId}`, JSON.stringify(userData));
    await sendMessage(env, chatId, `✅ تم حظر المستخدم: ${userId}`);
  }
  await clearUserState(chatId, env);
  await showUsersManagement(chatId, env, (await sendMessage(env, chatId, '.')).result.message_id);
}

async function handleUnblockUser(chatId, userId, env, userState) {
  const userData = await env.BOT_KV.get(`user:${userId}`, { type: 'json' });
  if (!userData) {
    await sendMessage(env, chatId, '❌ المستخدم غير موجود.');
  } else {
    userData.is_blocked = false;
    await env.BOT_KV.put(`user:${userId}`, JSON.stringify(userData));
    await sendMessage(env, chatId, `✅ تم إلغاء حظر المستخدم: ${userId}`);
  }
  await clearUserState(chatId, env);
}

async function showBlockedUsers(chatId, env, messageId) {
  const usersList = await env.BOT_KV.get('users_list', { type: 'json' }) || [];
  let text = '🚫 *المستخدمين المحظورين*\n\n';
  let hasBlocked = false;
  
  const keyboard = { inline_keyboard: [] };
  
  for (const userId of usersList) {
    const userData = await env.BOT_KV.get(`user:${userId}`, { type: 'json' });
    if (userData && userData.is_blocked) {
      hasBlocked = true;
      text += `🆔 ${userId} - ${userData.first_name} ${userData.last_name}\n`;
      keyboard.inline_keyboard.push([{ text: `🔓 إلغاء حظر ${userId}`, callback_data: `unblock_${userId}` }]);
    }
  }
  
  if (!hasBlocked) {
    text += 'لا يوجد مستخدمين محظورين.';
  }
  
  keyboard.inline_keyboard.push([{ text: '🔙 رجوع', callback_data: 'admin_users' }]);
  
  await editMessageText(env, chatId, messageId, text, { reply_markup: keyboard, parse_mode: 'Markdown' });
}

async function unblockUserAction(chatId, userId, env, messageId) {
  const userData = await env.BOT_KV.get(`user:${userId}`, { type: 'json' });
  if (userData) {
    userData.is_blocked = false;
    await env.BOT_KV.put(`user:${userId}`, JSON.stringify(userData));
    await answerCallback(env, '', '✅ تم إلغاء الحظر');
  }
  await showBlockedUsers(chatId, env, messageId);
}

// ==================== إدارة المحتوى ====================

async function showContentManagement(chatId, env, messageId) {
  const keyboard = {
    inline_keyboard: [
      [{ text: '📊 إحصائيات المحتوى', callback_data: 'content_stats' }],
      [{ text: '➕ إضافة محتوى', callback_data: 'add_content' }],
      [{ text: '✏️ تعديل محتوى', callback_data: 'edit_content' }],
      [{ text: '🗑 حذف محتوى', callback_data: 'delete_content' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
    ]
  };
  
  await editMessageText(env, chatId, messageId, '📊 *إدارة المحتوى*\n\nاختر العملية المطلوبة:', { reply_markup: keyboard, parse_mode: 'Markdown' });
}

async function showContentStats(chatId, env, messageId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  let text = '📊 *إحصائيات المحتوى*\n\n';
  
  for (const section of sections) {
    const contents = await env.BOT_KV.get(`contents:${section.id}`, { type: 'json' }) || [];
    text += `📁 ${section.name}: ${contents.length} محتوى\n`;
  }
  
  const keyboard = {
    inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_content' }]]
  };
  
  await editMessageText(env, chatId, messageId, text, { reply_markup: keyboard, parse_mode: 'Markdown' });
}

// إضافة محتوى
async function startAddContent(chatId, env, messageId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  
  if (sections.length === 0) {
    await editMessageText(env, chatId, messageId, 
      '❌ لا توجد أقسام. الرجاء إضافة قسم أولاً.',
      { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_content' }]] } }
    );
    return;
  }
  
  const keyboard = { inline_keyboard: [] };
  for (const section of sections) {
    keyboard.inline_keyboard.push([{ text: section.name, callback_data: `add_content_section_${section.id}` }]);
  }
  keyboard.inline_keyboard.push([{ text: '🔙 رجوع', callback_data: 'admin_content' }]);
  
  await editMessageText(env, chatId, messageId, '📁 اختر القسم لإضافة المحتوى:', { reply_markup: keyboard });
}

async function handleAddContentTitle(chatId, title, env, userState) {
  userState.content_title = title;
  userState.content_parts = [];
  userState.action = 'adding_content';
  await setUserState(chatId, 'adding_content', userState, env);
  
  await sendMessage(env, chatId, 
    '📝 أرسل المحتوى الآن (يمكنك إرسال عدة رسائل).\n\nعند الانتهاء اضغط على زر "تم الانتهاء".',
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
    // حفظ المحتوى
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
    
    const shareLink = `https://t.me/${(await getBotUsername(env))}?start=content_${contentId}`;
    
    await clearUserState(chatId, env);
    
    await sendMessage(env, chatId,
      `✅ تم إضافة المحتوى بنجاح!\n\n` +
      `📁 القسم: ${section?.name || userState.section_id}\n` +
      `📝 العنوان: ${userState.content_title}\n` +
      `🆔 رقم المحتوى: ${contentNumber}\n` +
      `🔗 رابط المشاركة:\n${shareLink}`,
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
    // إضافة جزء من المحتوى
    userState.content_parts = userState.content_parts || [];
    userState.content_parts.push(text);
    await setUserState(chatId, 'adding_content', userState, env);
    await sendMessage(env, chatId, '✅ تم إضافة الجزء. أرسل المزيد أو اضغط "تم الانتهاء".');
  }
}

// تعديل محتوى
async function startEditContent(chatId, env, messageId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  
  const keyboard = { inline_keyboard: [] };
  for (const section of sections) {
    keyboard.inline_keyboard.push([{ text: section.name, callback_data: `edit_content_section_${section.id}` }]);
  }
  keyboard.inline_keyboard.push([{ text: '🔙 رجوع', callback_data: 'admin_content' }]);
  
  await editMessageText(env, chatId, messageId, '📁 اختر القسم لتعديل محتواه:', { reply_markup: keyboard });
}

async function showSectionContentsForEdit(chatId, sectionId, env, messageId) {
  const contents = await env.BOT_KV.get(`contents:${sectionId}`, { type: 'json' }) || [];
  
  if (contents.length === 0) {
    await editMessageText(env, chatId, messageId, 
      '❌ لا يوجد محتوى في هذا القسم.',
      { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'edit_content' }]] } }
    );
    return;
  }
  
  const keyboard = { inline_keyboard: [] };
  for (const content of contents) {
    keyboard.inline_keyboard.push([{ text: `${content.number}. ${content.title}`, callback_data: `edit_content_item_${content.id}` }]);
  }
  keyboard.inline_keyboard.push([{ text: '🔙 رجوع', callback_data: 'edit_content' }]);
  
  await editMessageText(env, chatId, messageId, '📝 اختر المحتوى الذي تريد تعديله:', { reply_markup: keyboard });
}

async function handleEditContentNew(chatId, newContent, env, userState) {
  const contentId = userState.content_id;
  
  // البحث عن المحتوى في جميع الأقسام
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  let found = false;
  
  for (const section of sections) {
    const contents = await env.BOT_KV.get(`contents:${section.id}`, { type: 'json' }) || [];
    const contentIndex = contents.findIndex(c => c.id === contentId);
    if (contentIndex !== -1) {
      contents[contentIndex].content = newContent;
      await env.BOT_KV.put(`contents:${section.id}`, JSON.stringify(contents));
      found = true;
      break;
    }
  }
  
  await clearUserState(chatId, env);
  
  if (found) {
    await sendMessage(env, chatId, '✅ تم تعديل المحتوى بنجاح!');
  } else {
    await sendMessage(env, chatId, '❌ لم يتم العثور على المحتوى.');
  }
}

// حذف محتوى
async function startDeleteContent(chatId, env, messageId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  
  const keyboard = { inline_keyboard: [] };
  for (const section of sections) {
    keyboard.inline_keyboard.push([{ text: section.name, callback_data: `delete_content_section_${section.id}` }]);
  }
  keyboard.inline_keyboard.push([{ text: '🔙 رجوع', callback_data: 'admin_content' }]);
  
  await editMessageText(env, chatId, messageId, '📁 اختر القسم لحذف محتوى منه:', { reply_markup: keyboard });
}

async function showSectionContentsForDelete(chatId, sectionId, env, messageId) {
  const contents = await env.BOT_KV.get(`contents:${sectionId}`, { type: 'json' }) || [];
  
  if (contents.length === 0) {
    await editMessageText(env, chatId, messageId, 
      '❌ لا يوجد محتوى في هذا القسم.',
      { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'delete_content' }]] } }
    );
    return;
  }
  
  const keyboard = { inline_keyboard: [] };
  for (const content of contents) {
    keyboard.inline_keyboard.push([{ text: `🗑 ${content.number}. ${content.title}`, callback_data: `delete_content_item_${content.id}` }]);
  }
  keyboard.inline_keyboard.push([{ text: '🔙 رجوع', callback_data: 'delete_content' }]);
  
  await editMessageText(env, chatId, messageId, '🗑 اختر المحتوى الذي تريد حذفه:', { reply_markup: keyboard });
}

async function confirmDeleteContent(chatId, contentId, env, messageId) {
  const keyboard = {
    inline_keyboard: [
      [{ text: '✅ نعم، احذف', callback_data: `confirm_delete_content_${contentId}` }],
      [{ text: '❌ إلغاء', callback_data: 'delete_content' }]
    ]
  };
  
  await editMessageText(env, chatId, messageId, '⚠️ هل أنت متأكد من حذف هذا المحتوى؟', { reply_markup: keyboard });
}

async function executeDeleteContent(chatId, contentId, env, messageId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  
  for (const section of sections) {
    const contents = await env.BOT_KV.get(`contents:${section.id}`, { type: 'json' }) || [];
    const filtered = contents.filter(c => c.id !== contentId);
    if (filtered.length !== contents.length) {
      await env.BOT_KV.put(`contents:${section.id}`, JSON.stringify(filtered));
      await editMessageText(env, chatId, messageId, 
        '✅ تم حذف المحتوى بنجاح!',
        { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_content' }]] } }
      );
      return;
    }
  }
  
  await editMessageText(env, chatId, messageId, 
    '❌ لم يتم العثور على المحتوى.',
    { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_content' }]] } }
  );
}

// ==================== إدارة الأقسام ====================

async function showSectionsManagement(chatId, env, messageId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  
  let text = '📁 *إدارة الأقسام*\n\n';
  
  if (sections.length === 0) {
    text += 'لا توجد أقسام حالياً.';
  } else {
    for (let i = 0; i < sections.length; i++) {
      text += `${i + 1}. ${sections[i].name}\n`;
    }
  }
  
  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ إضافة قسم', callback_data: 'add_section' }],
      [{ text: '✏️ تعديل قسم', callback_data: 'edit_section' }],
      [{ text: '🗑 حذف قسم', callback_data: 'delete_section' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
    ]
  };
  
  await editMessageText(env, chatId, messageId, text, { reply_markup: keyboard, parse_mode: 'Markdown' });
}

async function handleAddSection(chatId, name, env, userState) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  const newSection = {
    id: Date.now().toString(),
    name: name
  };
  sections.push(newSection);
  await env.BOT_KV.put('sections', JSON.stringify(sections));
  await clearUserState(chatId, env);
  
  await sendMessage(env, chatId, `✅ تم إضافة القسم "${name}" بنجاح!`);
}

async function handleEditSectionGetId(chatId, index, env, userState) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  const idx = parseInt(index) - 1;
  
  if (idx < 0 || idx >= sections.length) {
    await sendMessage(env, chatId, '❌ رقم القسم غير صحيح.');
    await clearUserState(chatId, env);
    return;
  }
  
  userState.edit_section_id = sections[idx].id;
  userState.action = 'waiting_edit_section_name';
  await setUserState(chatId, 'waiting_edit_section_name', userState, env);
  
  await sendMessage(env, chatId, `القسم الحالي: ${sections[idx].name}\n\nأرسل الاسم الجديد للقسم:`);
}

async function handleEditSectionName(chatId, newName, env, userState) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  const idx = sections.findIndex(s => s.id === userState.edit_section_id);
  
  if (idx !== -1) {
    sections[idx].name = newName;
    await env.BOT_KV.put('sections', JSON.stringify(sections));
    await sendMessage(env, chatId, `✅ تم تعديل القسم إلى "${newName}" بنجاح!`);
  }
  
  await clearUserState(chatId, env);
}

async function handleDeleteSection(chatId, index, env, userState) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  const idx = parseInt(index) - 1;
  
  if (idx < 0 || idx >= sections.length) {
    await sendMessage(env, chatId, '❌ رقم القسم غير صحيح.');
    await clearUserState(chatId, env);
    return;
  }
  
  // التحقق من وجود محتوى في القسم
  const contents = await env.BOT_KV.get(`contents:${sections[idx].id}`, { type: 'json' }) || [];
  if (contents.length > 0) {
    await sendMessage(env, chatId, '❌ لا يمكن حذف قسم يحتوي على محتوى. احذف المحتوى أولاً.');
    await clearUserState(chatId, env);
    return;
  }
  
  const deletedName = sections[idx].name;
  sections.splice(idx, 1);
  await env.BOT_KV.put('sections', JSON.stringify(sections));
  await clearUserState(chatId, env);
  
  await sendMessage(env, chatId, `✅ تم حذف القسم "${deletedName}" بنجاح!`);
}

// ==================== الاشتراك الإجباري ====================

async function showForceSubManagement(chatId, env, messageId) {
  const channels = await env.BOT_KV.get('force_channels', { type: 'json' }) || [];
  
  let text = '🔗 *الاشتراك الإجباري*\n\n';
  
  if (channels.length === 0) {
    text += 'لا توجد قنوات حالياً.';
  } else {
    for (let i = 0; i < channels.length; i++) {
      text += `${i + 1}. ${channels[i]}\n`;
    }
  }
  
  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ إضافة', callback_data: 'add_force_channel' }],
      [{ text: '🗑 حذف', callback_data: 'delete_force_channel' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
    ]
  };
  
  await editMessageText(env, chatId, messageId, text, { reply_markup: keyboard, parse_mode: 'Markdown' });
}

async function handleAddForceChannel(chatId, channel, env, userState) {
  if (channel === '/all') {
    // حذف الكل
    await env.BOT_KV.delete('force_channels');
    await clearUserState(chatId, env);
    await sendMessage(env, chatId, '✅ تم حذف جميع قنوات الاشتراك الإجباري.');
    return;
  }
  
  const channels = await env.BOT_KV.get('force_channels', { type: 'json' }) || [];
  if (!channels.includes(channel)) {
    channels.push(channel);
    await env.BOT_KV.put('force_channels', JSON.stringify(channels));
    await sendMessage(env, chatId, `✅ تم إضافة "${channel}" للاشتراك الإجباري.`);
  } else {
    await sendMessage(env, chatId, '❌ هذه القناة موجودة بالفعل.');
  }
  
  await clearUserState(chatId, env);
}

async function handleDeleteForceChannel(chatId, input, env, userState) {
  const channels = await env.BOT_KV.get('force_channels', { type: 'json' }) || [];
  
  // التحقق مما إذا كان رقم أو معرف
  let removed = false;
  const index = parseInt(input) - 1;
  
  if (!isNaN(index) && index >= 0 && index < channels.length) {
    const removed_channel = channels.splice(index, 1)[0];
    removed = true;
    await sendMessage(env, chatId, `✅ تم حذف "${removed_channel}" من الاشتراك الإجباري.`);
  } else {
    const channelIndex = channels.indexOf(input);
    if (channelIndex !== -1) {
      channels.splice(channelIndex, 1);
      removed = true;
      await sendMessage(env, chatId, `✅ تم حذف "${input}" من الاشتراك الإجباري.`);
    }
  }
  
  if (!removed) {
    await sendMessage(env, chatId, '❌ لم يتم العثور على القناة.');
  }
  
  await env.BOT_KV.put('force_channels', JSON.stringify(channels));
  await clearUserState(chatId, env);
}

// ==================== دوال المستخدم ====================

async function showCategories(chatId, env) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  
  if (sections.length === 0) {
    return await sendMessage(env, chatId, '📚 لا توجد أقسام متاحة حالياً.');
  }
  
  const keyboard = { inline_keyboard: [] };
  
  // ترتيب الأقسام في صفوف (2 في كل صف)
  for (let i = 0; i < sections.length; i += 2) {
    const row = [];
    row.push({ text: sections[i].name, callback_data: `section_${sections[i].id}` });
    if (sections[i + 1]) {
      row.push({ text: sections[i + 1].name, callback_data: `section_${sections[i + 1].id}` });
    }
    keyboard.inline_keyboard.push(row);
  }
  
  await sendMessage(env, chatId, '📚 *الأقسام المتاحة*\n\nاختر قسماً لتصفح محتواه:', { reply_markup: keyboard, parse_mode: 'Markdown' });
}

async function showSectionContents(chatId, sectionId, env, messageId) {
  const contents = await env.BOT_KV.get(`contents:${sectionId}`, { type: 'json' }) || [];
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  const section = sections.find(s => s.id === sectionId);
  
  if (contents.length === 0) {
    await editMessageText(env, chatId, messageId,
      `📁 ${section?.name || 'القسم'}\n\nلا يوجد محتوى في هذا القسم حالياً.`,
      { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'section_back' }]] } }
    );
    return;
  }
  
  const keyboard = { inline_keyboard: [] };
  for (const content of contents) {
    keyboard.inline_keyboard.push([{ text: `${content.number}. ${content.title}`, callback_data: `content_${content.id}` }]);
  }
  keyboard.inline_keyboard.push([{ text: '🔙 رجوع للأقسام', callback_data: 'section_back' }]);
  
  // حفظ حالة التصفح
  await setUserState(chatId, 'viewing_section', { section_id: sectionId }, env);
  
  await editMessageText(env, chatId, messageId,
    `📁 *${section?.name || 'القسم'}*\n\nاختر المحتوى الذي تريد مشاهدته:`,
    { reply_markup: keyboard, parse_mode: 'Markdown' }
  );
}

async function showContent(chatId, contentId, env, messageId) {
  // البحث عن المحتوى
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
    await editMessageText(env, chatId, messageId,
      '❌ المحتوى غير متوفر.',
      { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'section_back' }]] } }
    );
    return;
  }
  
  const keyboard = {
    inline_keyboard: [
      [{ text: '🔙 رجوع للقسم', callback_data: `section_${content.section_id}` }]
    ]
  };
  
  await editMessageText(env, chatId, messageId,
    `📁 *${sectionName}*\n` +
    `📝 *${content.title}*\n` +
    `🆔 رقم: ${content.number}\n` +
    `➖➖➖➖➖➖➖\n\n` +
    content.content,
    { reply_markup: keyboard, parse_mode: 'Markdown' }
  );
}

// ==================== دوال مساعدة ====================

async function checkForceSubscription(chatId, env) {
  const channels = await env.BOT_KV.get('force_channels', { type: 'json' }) || [];
  
  if (channels.length === 0) {
    return { status: true, channels: '' };
  }
  
  let notJoined = [];
  
  for (const channel of channels) {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${env.BOT_TOKEN}/getChatMember?chat_id=${channel}&user_id=${chatId}`
      );
      const data = await response.json();
      
      if (data.ok) {
        const status = data.result.status;
        if (status === 'left' || status === 'kicked') {
          notJoined.push(channel);
        }
      }
    } catch (e) {
      // تجاهل الأخطاء
    }
  }
  
  if (notJoined.length > 0) {
    return {
      status: false,
      channels: notJoined.map(c => `👉 ${c}`).join('\n')
    };
  }
  
  return { status: true, channels: '' };
}

async function sendMessage(env, chatId, text, extra = {}) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
  const body = { chat_id: chatId, text: text, ...extra };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  return await response.json();
}

async function editMessageText(env, chatId, messageId, text, extra = {}) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/editMessageText`;
  const body = { chat_id: chatId, message_id: messageId, text: text, ...extra };
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function deleteMessage(env, chatId, messageId) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/deleteMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId })
  });
}

async function answerCallback(env, callbackQueryId, text, showAlert = false) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text: text, show_alert: showAlert })
  });
}

async function setUserState(chatId, action, data, env) {
  const state = { action: action, ...data, timestamp: Date.now() };
  await env.BOT_KV.put(`state:${chatId}`, JSON.stringify(state));
}

async function clearUserState(chatId, env) {
  await env.BOT_KV.delete(`state:${chatId}`);
}

async function getBotUsername(env) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/getMe`;
  const response = await fetch(url);
  const data = await response.json();
  return data.result.username;
}

// ==================== معالجة المحتوى عند الدخول عبر رابط ====================
async function handleContentDeepLink(chatId, contentId, env) {
  // طلب رقم الهاتف أولاً
  await sendMessage(env, chatId,
    '👋 للوصول إلى هذا المحتوى، يرجى مشاركة رقم هاتفك للتحقق.',
    {
      reply_markup: {
        keyboard: [[{ text: '📱 مشاركة رقم الهاتف', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    }
  );
  
  // حفظ أن المستخدم قادم من رابط محتوى
  await setUserState(chatId, 'deep_link_content', { content_id: contentId }, env);
}
