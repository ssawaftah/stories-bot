// معرف الأدمن - غيره إلى معرفك
const ADMIN_IDS = ['6455001010'];
// معرف الأدمن - غيره إلى معرفك


export default {
  async fetch(request, env) {
    if (request.method === 'GET') {
      return new Response('Bot is running! ✅');
    }
    
    if (request.method === 'POST') {
      try {
        const update = await request.json();
        
        // معالجة الرسائل
        if (update.message) {
          const msg = update.message;
          const chatId = msg.chat.id.toString();
          const text = msg.text || '';
          const contact = msg.contact;
          
          // إذا أرسل جهة اتصال
          if (contact) {
            const phone = contact.phone_number;
            const userId = msg.from.id.toString();
            const firstName = contact.first_name || msg.from.first_name || '';
            const lastName = contact.last_name || msg.from.last_name || '';
            
            // حفظ بيانات المستخدم
            const userData = {
              id: userId,
              username: msg.from.username || '',
              first_name: firstName,
              last_name: lastName,
              phone: phone,
              join_date: new Date().toISOString(),
              last_activity: new Date().toISOString(),
              is_blocked: false
            };
            
            await env.BOT_KV.put(`user:${userId}`, JSON.stringify(userData));
            
            // إضافة للقائمة
            let usersList = await env.BOT_KV.get('users_list', { type: 'json' }) || [];
            if (!usersList.includes(userId)) {
              usersList.push(userId);
              await env.BOT_KV.put('users_list', JSON.stringify(usersList));
            }
            
            // حذف حالة المستخدم
            await env.BOT_KV.delete(`state:${chatId}`);
            
            // إرسال تأكيد
            await sendMsg(env, chatId, 
              '✅ تم التحقق من هويتك بنجاح!\n\nرقم هاتفك: ' + phone
            );
            
            // إذا أدمن يظهر لوحة التحكم
            if (ADMIN_IDS.includes(chatId)) {
              return await sendMsg(env, chatId, 
                '🎛 *لوحة تحكم الأدمن*\n\nاختر القسم:',
                {
                  reply_markup: {
                    keyboard: [
                      [{ text: '👥 قسم المستخدمين' }],
                      [{ text: '📊 إدارة المحتوى' }],
                      [{ text: '📁 إدارة الأقسام' }],
                      [{ text: '🔗 الاشتراك الإجباري' }]
                    ],
                    resize_keyboard: true
                  },
                  parse_mode: 'Markdown'
                }
              );
            }
            
            // مستخدم عادي - عرض الأقسام
            return await showCategoriesToUser(chatId, env);
          }
          
          // ====== حالة المستخدم (للأدمن) ======
          let userState = await env.BOT_KV.get(`state:${chatId}`, { type: 'json' }) || {};
          
          // أمر start
          if (text === '/start') {
            return await sendMsg(env, chatId,
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
          
          // أمر admin
          if (text === '/admin' || text === '🔙 رجوع للقائمة الرئيسية') {
            if (ADMIN_IDS.includes(chatId)) {
              await env.BOT_KV.delete(`state:${chatId}`);
              return await sendMsg(env, chatId,
                '🎛 *لوحة تحكم الأدمن*',
                {
                  reply_markup: {
                    keyboard: [
                      [{ text: '👥 قسم المستخدمين' }],
                      [{ text: '📊 إدارة المحتوى' }],
                      [{ text: '📁 إدارة الأقسام' }],
                      [{ text: '🔗 الاشتراك الإجباري' }]
                    ],
                    resize_keyboard: true
                  },
                  parse_mode: 'Markdown'
                }
              );
            }
          }
          
          // ====== أزرار الأدمن من الكيبورد ======
          if (ADMIN_IDS.includes(chatId)) {
            if (text === '👥 قسم المستخدمين') {
              return await showUsersList(chatId, env, null);
            }
            if (text === '📊 إدارة المحتوى') {
              return await showContentMenu(chatId, env, null);
            }
            if (text === '📁 إدارة الأقسام') {
              return await showSectionsMenu(chatId, env, null);
            }
            if (text === '🔗 الاشتراك الإجباري') {
              return await showForceSubMenu(chatId, env, null);
            }
            
            // معالجة حالات الأدمن
            if (userState.action === 'waiting_block_id') {
              return await blockUser(chatId, text, env);
            }
            if (userState.action === 'waiting_unblock_id') {
              return await unblockUser(chatId, text, env);
            }
            if (userState.action === 'waiting_section_name') {
              return await addSection(chatId, text, env);
            }
            if (userState.action === 'waiting_edit_section_num') {
              return await editSectionNum(chatId, text, env);
            }
            if (userState.action === 'waiting_edit_section_name') {
              return await editSectionName(chatId, text, env);
            }
            if (userState.action === 'waiting_delete_section_num') {
              return await deleteSectionNum(chatId, text, env);
            }
            if (userState.action === 'waiting_content_title') {
              return await addContentTitle(chatId, text, env, userState);
            }
            if (userState.action === 'adding_content') {
              return await addingContent(chatId, text, env, userState);
            }
            if (userState.action === 'waiting_edit_content_new') {
              return await editContentNew(chatId, text, env, userState);
            }
            if (userState.action === 'waiting_force_channel') {
              return await addForceChannel(chatId, text, env);
            }
            if (userState.action === 'waiting_delete_force') {
              return await deleteForceChannel(chatId, text, env);
            }
          }
          
          // المستخدم العادي
          if (text === '📚 عرض الأقسام') {
            return await showCategoriesToUser(chatId, env);
          }
          
          // رد افتراضي
          return await sendMsg(env, chatId, 'استخدم /start للبدء أو /admin للوحة التحكم.');
        }
        
        // معالجة الأزرار (callback queries)
        if (update.callback_query) {
          const cb = update.callback_query;
          const chatId = cb.message.chat.id.toString();
          const data = cb.data;
          const msgId = cb.message.message_id;
          
          // لوحة الأدمن
          if (data === 'admin_users') return await showUsersList(chatId, env, msgId);
          if (data === 'admin_content') return await showContentMenu(chatId, env, msgId);
          if (data === 'admin_sections') return await showSectionsMenu(chatId, env, msgId);
          if (data === 'admin_force') return await showForceSubMenu(chatId, env, msgId);
          if (data === 'admin_back') {
            await deleteMsg(env, chatId, msgId);
            return await sendMsg(env, chatId, '🎛 *لوحة تحكم الأدمن*', {
              reply_markup: {
                keyboard: [
                  [{ text: '👥 قسم المستخدمين' }],
                  [{ text: '📊 إدارة المحتوى' }],
                  [{ text: '📁 إدارة الأقسام' }],
                  [{ text: '🔗 الاشتراك الإجباري' }]
                ],
                resize_keyboard: true
              },
              parse_mode: 'Markdown'
            });
          }
          
          // المستخدمين
          if (data === 'block_user') {
            await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({ action: 'waiting_block_id' }));
            return await editMsg(env, chatId, msgId, '🔒 أرسل معرف المستخدم (ID) للحظر:');
          }
          if (data === 'unblock_user') {
            await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({ action: 'waiting_unblock_id' }));
            return await editMsg(env, chatId, msgId, '🔓 أرسل معرف المستخدم (ID) لإلغاء الحظر:');
          }
          if (data === 'blocked_list') return await showBlockedList(chatId, env, msgId);
          if (data.startsWith('unblock_')) {
            return await unblockById(chatId, data.replace('unblock_', ''), env, msgId);
          }
          
          // الأقسام
          if (data === 'add_section') {
            await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({ action: 'waiting_section_name' }));
            return await editMsg(env, chatId, msgId, '📁 أرسل اسم القسم الجديد:');
          }
          if (data === 'edit_section') {
            await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({ action: 'waiting_edit_section_num' }));
            return await editMsg(env, chatId, msgId, '✏️ أرسل رقم القسم للتعديل:');
          }
          if (data === 'delete_section') {
            await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({ action: 'waiting_delete_section_num' }));
            return await editMsg(env, chatId, msgId, '🗑 أرسل رقم القسم للحذف:');
          }
          
          // المحتوى
          if (data === 'content_stats') return await showContentStats(chatId, env, msgId);
          if (data === 'add_content') return await startAddContent(chatId, env, msgId);
          if (data === 'edit_content') return await startEditContent(chatId, env, msgId);
          if (data === 'delete_content') return await startDeleteContent(chatId, env, msgId);
          
          if (data.startsWith('add_sec_')) {
            const secId = data.replace('add_sec_', '');
            await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({ action: 'waiting_content_title', section_id: secId }));
            return await editMsg(env, chatId, msgId, '📝 أرسل عنوان المحتوى:');
          }
          if (data.startsWith('edit_sec_')) {
            return await showContentsForEdit(chatId, data.replace('edit_sec_', ''), env, msgId);
          }
          if (data.startsWith('edit_item_')) {
            const cId = data.replace('edit_item_', '');
            await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({ action: 'waiting_edit_content_new', content_id: cId }));
            return await editMsg(env, chatId, msgId, '📝 أرسل المحتوى الجديد:');
          }
          if (data.startsWith('del_sec_')) {
            return await showContentsForDelete(chatId, data.replace('del_sec_', ''), env, msgId);
          }
          if (data.startsWith('del_item_')) {
            const cId = data.replace('del_item_', '');
            return await editMsg(env, chatId, msgId, '⚠️ هل أنت متأكد من الحذف؟', {
              inline_keyboard: [
                [{ text: '✅ نعم', callback_data: `confirm_del_${cId}` }],
                [{ text: '❌ لا', callback_data: 'delete_content' }]
              ]
            });
          }
          if (data.startsWith('confirm_del_')) {
            return await executeDeleteContent(chatId, data.replace('confirm_del_', ''), env, msgId);
          }
          
          // الاشتراك الإجباري
          if (data === 'add_force') {
            await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({ action: 'waiting_force_channel' }));
            return await editMsg(env, chatId, msgId, '➕ أرسل معرف القناة (مع @):');
          }
          if (data === 'delete_force') {
            await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({ action: 'waiting_delete_force' }));
            return await editMsg(env, chatId, msgId, '🗑 أرسل رقم القناة أو @المعرف:');
          }
          
          // تصفح المستخدم
          if (data.startsWith('section_')) {
            return await showContentsToUser(chatId, data.replace('section_', ''), env, msgId);
          }
          if (data.startsWith('content_')) {
            return await showContentToUser(chatId, data.replace('content_', ''), env, msgId);
          }
          if (data === 'back_to_sections') {
            await deleteMsg(env, chatId, msgId);
            return await showCategoriesToUser(chatId, env);
          }
          
          await answerCb(env, cb.id, 'تم');
        }
        
        return new Response('OK');
      } catch (error) {
        return new Response('OK');
      }
    }
    
    return new Response('OK');
  }
};

// ==================== دوال المستخدمين ====================
async function showUsersList(chatId, env, msgId) {
  const usersList = await env.BOT_KV.get('users_list', { type: 'json' }) || [];
  let text = '👥 *قائمة المستخدمين*\n\n';
  
  if (usersList.length === 0) {
    text += 'لا يوجد مستخدمين.';
  } else {
    for (const uid of usersList) {
      const u = await env.BOT_KV.get(`user:${uid}`, { type: 'json' });
      if (u) {
        text += `🆔 ${u.id} | 👤 ${u.first_name} ${u.last_name}\n`;
        text += `📱 ${u.phone} | 🚫 ${u.is_blocked ? 'محظور' : 'نشط'}\n`;
        text += `📅 ${new Date(u.join_date).toLocaleDateString('ar-SA')}\n`;
        text += '➖➖➖➖➖\n';
      }
    }
  }
  
  const kb = {
    inline_keyboard: [
      [{ text: '🚫 حظر', callback_data: 'block_user' }, { text: '🔓 إلغاء حظر', callback_data: 'unblock_user' }],
      [{ text: '📋 المحظورين', callback_data: 'blocked_list' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
    ]
  };
  
  if (msgId) {
    await editMsg(env, chatId, msgId, text, { reply_markup: kb, parse_mode: 'Markdown' });
  } else {
    await sendMsg(env, chatId, text, { reply_markup: kb, parse_mode: 'Markdown' });
  }
}

async function blockUser(chatId, userId, env) {
  const u = await env.BOT_KV.get(`user:${userId}`, { type: 'json' });
  if (!u) return await sendMsg(env, chatId, '❌ غير موجود.');
  u.is_blocked = true;
  await env.BOT_KV.put(`user:${userId}`, JSON.stringify(u));
  await env.BOT_KV.delete(`state:${chatId}`);
  await sendMsg(env, chatId, `✅ تم حظر ${userId}`);
}

async function unblockUser(chatId, userId, env) {
  const u = await env.BOT_KV.get(`user:${userId}`, { type: 'json' });
  if (!u) return await sendMsg(env, chatId, '❌ غير موجود.');
  u.is_blocked = false;
  await env.BOT_KV.put(`user:${userId}`, JSON.stringify(u));
  await env.BOT_KV.delete(`state:${chatId}`);
  await sendMsg(env, chatId, `✅ تم إلغاء حظر ${userId}`);
}

async function showBlockedList(chatId, env, msgId) {
  const usersList = await env.BOT_KV.get('users_list', { type: 'json' }) || [];
  let text = '🚫 *المحظورين*\n\n';
  const kb = { inline_keyboard: [] };
  let has = false;
  
  for (const uid of usersList) {
    const u = await env.BOT_KV.get(`user:${uid}`, { type: 'json' });
    if (u && u.is_blocked) {
      has = true;
      text += `🆔 ${uid} - ${u.first_name}\n`;
      kb.inline_keyboard.push([{ text: `🔓 إلغاء حظر ${uid}`, callback_data: `unblock_${uid}` }]);
    }
  }
  
  if (!has) text += 'لا يوجد محظورين.';
  kb.inline_keyboard.push([{ text: '🔙 رجوع', callback_data: 'admin_users' }]);
  
  await editMsg(env, chatId, msgId, text, { reply_markup: kb, parse_mode: 'Markdown' });
}

async function unblockById(chatId, userId, env, msgId) {
  const u = await env.BOT_KV.get(`user:${userId}`, { type: 'json' });
  if (u) { u.is_blocked = false; await env.BOT_KV.put(`user:${userId}`, JSON.stringify(u)); }
  await showBlockedList(chatId, env, msgId);
}

// ==================== دوال الأقسام ====================
async function showSectionsMenu(chatId, env, msgId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  let text = '📁 *الأقسام*\n\n';
  
  if (sections.length === 0) text += 'لا توجد أقسام.';
  else sections.forEach((s, i) => text += `${i + 1}. ${s.name}\n`);
  
  const kb = {
    inline_keyboard: [
      [{ text: '➕ إضافة', callback_data: 'add_section' }],
      [{ text: '✏️ تعديل', callback_data: 'edit_section' }],
      [{ text: '🗑 حذف', callback_data: 'delete_section' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
    ]
  };
  
  if (msgId) await editMsg(env, chatId, msgId, text, { reply_markup: kb, parse_mode: 'Markdown' });
  else await sendMsg(env, chatId, text, { reply_markup: kb, parse_mode: 'Markdown' });
}

async function addSection(chatId, name, env) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  sections.push({ id: Date.now().toString(), name });
  await env.BOT_KV.put('sections', JSON.stringify(sections));
  await env.BOT_KV.delete(`state:${chatId}`);
  await sendMsg(env, chatId, `✅ تم إضافة "${name}"`);
}

async function editSectionNum(chatId, num, env) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  const idx = parseInt(num) - 1;
  if (idx < 0 || idx >= sections.length) {
    await env.BOT_KV.delete(`state:${chatId}`);
    return await sendMsg(env, chatId, '❌ رقم غير صحيح.');
  }
  await env.BOT_KV.put(`state:${chatId}`, JSON.stringify({ action: 'waiting_edit_section_name', section_id: sections[idx].id }));
  await sendMsg(env, chatId, `الحالي: ${sections[idx].name}\nأرسل الاسم الجديد:`);
}

async function editSectionName(chatId, newName, env) {
  const state = await env.BOT_KV.get(`state:${chatId}`, { type: 'json' });
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  const idx = sections.findIndex(s => s.id === state.section_id);
  if (idx !== -1) { sections[idx].name = newName; await env.BOT_KV.put('sections', JSON.stringify(sections)); }
  await env.BOT_KV.delete(`state:${chatId}`);
  await sendMsg(env, chatId, `✅ تم التعديل إلى "${newName}"`);
}

async function deleteSectionNum(chatId, num, env) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  const idx = parseInt(num) - 1;
  if (idx < 0 || idx >= sections.length) {
    await env.BOT_KV.delete(`state:${chatId}`);
    return await sendMsg(env, chatId, '❌ رقم غير صحيح.');
  }
  const contents = await env.BOT_KV.get(`contents:${sections[idx].id}`, { type: 'json' }) || [];
  if (contents.length > 0) {
    await env.BOT_KV.delete(`state:${chatId}`);
    return await sendMsg(env, chatId, '❌ القسم يحتوي على محتوى. احذف المحتوى أولاً.');
  }
  const name = sections[idx].name;
  sections.splice(idx, 1);
  await env.BOT_KV.put('sections', JSON.stringify(sections));
  await env.BOT_KV.delete(`state:${chatId}`);
  await sendMsg(env, chatId, `✅ تم حذف "${name}"`);
}

// ==================== دوال المحتوى ====================
async function showContentMenu(chatId, env, msgId) {
  const kb = {
    inline_keyboard: [
      [{ text: '📊 إحصائيات', callback_data: 'content_stats' }],
      [{ text: '➕ إضافة', callback_data: 'add_content' }],
      [{ text: '✏️ تعديل', callback_data: 'edit_content' }],
      [{ text: '🗑 حذف', callback_data: 'delete_content' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
    ]
  };
  if (msgId) await editMsg(env, chatId, msgId, '📊 *إدارة المحتوى*', { reply_markup: kb, parse_mode: 'Markdown' });
  else await sendMsg(env, chatId, '📊 *إدارة المحتوى*', { reply_markup: kb, parse_mode: 'Markdown' });
}

async function showContentStats(chatId, env, msgId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  let text = '📊 *إحصائيات*\n\n';
  for (const s of sections) {
    const c = await env.BOT_KV.get(`contents:${s.id}`, { type: 'json' }) || [];
    text += `📁 ${s.name}: ${c.length}\n`;
  }
  if (sections.length === 0) text += 'لا توجد أقسام.';
  await editMsg(env, chatId, msgId, text, { reply_markup: { inline_keyboard: [[{ text: '🔙', callback_data: 'admin_content' }]] }, parse_mode: 'Markdown' });
}

async function startAddContent(chatId, env, msgId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  if (sections.length === 0) {
    return await editMsg(env, chatId, msgId, '❌ لا توجد أقسام.', { inline_keyboard: [[{ text: '🔙', callback_data: 'admin_content' }]] });
  }
  const kb = { inline_keyboard: [] };
  sections.forEach(s => kb.inline_keyboard.push([{ text: s.name, callback_data: `add_sec_${s.id}` }]));
  kb.inline_keyboard.push([{ text: '🔙', callback_data: 'admin_content' }]);
  await editMsg(env, chatId, msgId, '📁 اختر القسم:', { reply_markup: kb });
}

async function addContentTitle(chatId, title, env, state) {
  state.content_title = title;
  state.content_parts = [];
  state.action = 'adding_content';
  await env.BOT_KV.put(`state:${chatId}`, JSON.stringify(state));
  await sendMsg(env, chatId, '📝 أرسل المحتوى.\nاضغط "✅ تم الانتهاء" عند الانتهاء.', {
    reply_markup: { keyboard: [[{ text: '✅ تم الانتهاء' }]], resize_keyboard: true }
  });
}

async function addingContent(chatId, text, env, state) {
  if (text === '✅ تم الانتهاء') {
    const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
    const section = sections.find(s => s.id === state.section_id);
    const contents = await env.BOT_KV.get(`contents:${state.section_id}`, { type: 'json' }) || [];
    const newContent = {
      id: Date.now().toString(),
      number: contents.length + 1,
      title: state.content_title,
      content: state.content_parts.join('\n\n'),
      section_id: state.section_id,
      created_at: new Date().toISOString()
    };
    contents.push(newContent);
    await env.BOT_KV.put(`contents:${state.section_id}`, JSON.stringify(contents));
    await env.BOT_KV.delete(`state:${chatId}`);
    
    await sendMsg(env, chatId,
      `✅ تمت الإضافة!\n📁 ${section?.name}\n📝 ${state.content_title}\n🆔 ${newContent.number}`,
      { reply_markup: { keyboard: [[{ text: '📊 إدارة المحتوى' }, { text: '🔙 رجوع للقائمة الرئيسية' }]], resize_keyboard: true } }
    );
  } else {
    state.content_parts.push(text);
    await env.BOT_KV.put(`state:${chatId}`, JSON.stringify(state));
    await sendMsg(env, chatId, '✅ تمت إضافة الجزء. أرسل المزيد أو اضغط "تم الانتهاء".');
  }
}

async function startEditContent(chatId, env, msgId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  if (sections.length === 0) return await editMsg(env, chatId, msgId, '❌ لا توجد أقسام.', { inline_keyboard: [[{ text: '🔙', callback_data: 'admin_content' }]] });
  const kb = { inline_keyboard: [] };
  sections.forEach(s => kb.inline_keyboard.push([{ text: s.name, callback_data: `edit_sec_${s.id}` }]));
  kb.inline_keyboard.push([{ text: '🔙', callback_data: 'admin_content' }]);
  await editMsg(env, chatId, msgId, '📁 اختر القسم:', { reply_markup: kb });
}

async function showContentsForEdit(chatId, sectionId, env, msgId) {
  const contents = await env.BOT_KV.get(`contents:${sectionId}`, { type: 'json' }) || [];
  if (contents.length === 0) return await editMsg(env, chatId, msgId, '❌ لا يوجد محتوى.', { inline_keyboard: [[{ text: '🔙', callback_data: 'edit_content' }]] });
  const kb = { inline_keyboard: [] };
  contents.forEach(c => kb.inline_keyboard.push([{ text: `${c.number}. ${c.title}`, callback_data: `edit_item_${c.id}` }]));
  kb.inline_keyboard.push([{ text: '🔙', callback_data: 'edit_content' }]);
  await editMsg(env, chatId, msgId, '📝 اختر المحتوى:', { reply_markup: kb });
}

async function editContentNew(chatId, newText, env, state) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  for (const s of sections) {
    const contents = await env.BOT_KV.get(`contents:${s.id}`, { type: 'json' }) || [];
    const idx = contents.findIndex(c => c.id === state.content_id);
    if (idx !== -1) { contents[idx].content = newText; await env.BOT_KV.put(`contents:${s.id}`, JSON.stringify(contents)); break; }
  }
  await env.BOT_KV.delete(`state:${chatId}`);
  await sendMsg(env, chatId, '✅ تم التعديل!');
}

async function startDeleteContent(chatId, env, msgId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  if (sections.length === 0) return await editMsg(env, chatId, msgId, '❌ لا توجد أقسام.', { inline_keyboard: [[{ text: '🔙', callback_data: 'admin_content' }]] });
  const kb = { inline_keyboard: [] };
  sections.forEach(s => kb.inline_keyboard.push([{ text: s.name, callback_data: `del_sec_${s.id}` }]));
  kb.inline_keyboard.push([{ text: '🔙', callback_data: 'admin_content' }]);
  await editMsg(env, chatId, msgId, '📁 اختر القسم:', { reply_markup: kb });
}

async function showContentsForDelete(chatId, sectionId, env, msgId) {
  const contents = await env.BOT_KV.get(`contents:${sectionId}`, { type: 'json' }) || [];
  if (contents.length === 0) return await editMsg(env, chatId, msgId, '❌ لا يوجد محتوى.', { inline_keyboard: [[{ text: '🔙', callback_data: 'delete_content' }]] });
  const kb = { inline_keyboard: [] };
  contents.forEach(c => kb.inline_keyboard.push([{ text: `🗑 ${c.number}. ${c.title}`, callback_data: `del_item_${c.id}` }]));
  kb.inline_keyboard.push([{ text: '🔙', callback_data: 'delete_content' }]);
  await editMsg(env, chatId, msgId, '🗑 اختر المحتوى:', { reply_markup: kb });
}

async function executeDeleteContent(chatId, contentId, env, msgId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  for (const s of sections) {
    let contents = await env.BOT_KV.get(`contents:${s.id}`, { type: 'json' }) || [];
    const filtered = contents.filter(c => c.id !== contentId);
    if (filtered.length !== contents.length) { await env.BOT_KV.put(`contents:${s.id}`, JSON.stringify(filtered)); break; }
  }
  await editMsg(env, chatId, msgId, '✅ تم الحذف!', { inline_keyboard: [[{ text: '🔙', callback_data: 'admin_content' }]] });
}

// ==================== دوال الاشتراك الإجباري ====================
async function showForceSubMenu(chatId, env, msgId) {
  const channels = await env.BOT_KV.get('force_channels', { type: 'json' }) || [];
  let text = '🔗 *الاشتراك الإجباري*\n\n';
  if (channels.length === 0) text += 'لا توجد قنوات.';
  else channels.forEach((ch, i) => text += `${i + 1}. ${ch}\n`);
  
  const kb = {
    inline_keyboard: [
      [{ text: '➕ إضافة', callback_data: 'add_force' }],
      [{ text: '🗑 حذف', callback_data: 'delete_force' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
    ]
  };
  if (msgId) await editMsg(env, chatId, msgId, text, { reply_markup: kb, parse_mode: 'Markdown' });
  else await sendMsg(env, chatId, text, { reply_markup: kb, parse_mode: 'Markdown' });
}

async function addForceChannel(chatId, channel, env) {
  const channels = await env.BOT_KV.get('force_channels', { type: 'json' }) || [];
  if (!channels.includes(channel)) { channels.push(channel); await env.BOT_KV.put('force_channels', JSON.stringify(channels)); }
  else return await sendMsg(env, chatId, '❌ موجودة.');
  await env.BOT_KV.delete(`state:${chatId}`);
  await sendMsg(env, chatId, `✅ تمت إضافة ${channel}`);
}

async function deleteForceChannel(chatId, input, env) {
  let channels = await env.BOT_KV.get('force_channels', { type: 'json' }) || [];
  const num = parseInt(input);
  if (!isNaN(num) && num > 0 && num <= channels.length) {
    const r = channels.splice(num - 1, 1)[0];
    await env.BOT_KV.put('force_channels', JSON.stringify(channels));
    await sendMsg(env, chatId, `✅ تم حذف ${r}`);
  } else {
    const idx = channels.indexOf(input);
    if (idx !== -1) { channels.splice(idx, 1); await env.BOT_KV.put('force_channels', JSON.stringify(channels)); await sendMsg(env, chatId, `✅ تم حذف ${input}`); }
    else await sendMsg(env, chatId, '❌ غير موجودة.');
  }
  await env.BOT_KV.delete(`state:${chatId}`);
}

// ==================== دوال المستخدم العادي ====================
async function showCategoriesToUser(chatId, env) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  if (sections.length === 0) return await sendMsg(env, chatId, '📚 لا توجد أقسام.');
  
  const kb = { inline_keyboard: [] };
  for (let i = 0; i < sections.length; i += 2) {
    const row = [{ text: sections[i].name, callback_data: `section_${sections[i].id}` }];
    if (sections[i + 1]) row.push({ text: sections[i + 1].name, callback_data: `section_${sections[i + 1].id}` });
    kb.inline_keyboard.push(row);
  }
  await sendMsg(env, chatId, '📚 *الأقسام*', { reply_markup: kb, parse_mode: 'Markdown' });
}

async function showContentsToUser(chatId, sectionId, env, msgId) {
  const contents = await env.BOT_KV.get(`contents:${sectionId}`, { type: 'json' }) || [];
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  const section = sections.find(s => s.id === sectionId);
  
  if (contents.length === 0) {
    return await editMsg(env, chatId, msgId, `📁 ${section?.name}\nلا يوجد محتوى.`, { inline_keyboard: [[{ text: '🔙', callback_data: 'back_to_sections' }]] });
  }
  
  const kb = { inline_keyboard: [] };
  contents.forEach(c => kb.inline_keyboard.push([{ text: `${c.number}. ${c.title}`, callback_data: `content_${c.id}` }]));
  kb.inline_keyboard.push([{ text: '🔙 رجوع', callback_data: 'back_to_sections' }]);
  
  await editMsg(env, chatId, msgId, `📁 *${section?.name}*`, { reply_markup: kb, parse_mode: 'Markdown' });
}

async function showContentToUser(chatId, contentId, env, msgId) {
  const sections = await env.BOT_KV.get('sections', { type: 'json' }) || [];
  let content = null, sectionName = '';
  
  for (const s of sections) {
    const contents = await env.BOT_KV.get(`contents:${s.id}`, { type: 'json' }) || [];
    const found = contents.find(c => c.id === contentId);
    if (found) { content = found; sectionName = s.name; break; }
  }
  
  if (!content) return await editMsg(env, chatId, msgId, '❌ غير متوفر.', { inline_keyboard: [[{ text: '🔙', callback_data: 'back_to_sections' }]] });
  
  await editMsg(env, chatId, msgId,
    `📁 *${sectionName}*\n📝 *${content.title}*\n🆔 ${content.number}\n➖➖➖\n${content.content}`,
    { inline_keyboard: [[{ text: '🔙 للقسم', callback_data: `section_${content.section_id}` }]], parse_mode: 'Markdown' }
  );
}

// ==================== دوال API مساعدة ====================
async function sendMsg(env, chatId, text, extra = {}) {
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...extra })
  });
}

async function editMsg(env, chatId, msgId, text, extra = {}) {
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: msgId, text, ...extra })
  });
}

async function deleteMsg(env, chatId, msgId) {
  try {
    await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: msgId })
    });
  } catch(e) {}
}

async function answerCb(env, cbId, text) {
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: cbId, text })
  });
}
