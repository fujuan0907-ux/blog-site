// ============================================
// Blog App - ES Module
// 使用 ESM import 方式加载 Supabase
// ============================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 从全局获取配置（config.js 必须在此之前加载）
const SUPABASE_URL = window.__SUPABASE_URL__;
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__;
const SITE_URL = window.__SITE_URL__;

if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_URL') {
  console.error('⚠️ 请先在 js/config.js 中配置你的 Supabase 信息！');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// 认证相关函数
// ============================================

export async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: {
      data: { username },
      emailRedirectTo: `${SITE_URL}/login.html`,
    },
  });
  return { data, error };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function resetPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/update-password.html`,
  });
  return { data, error };
}

export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  return { data, error };
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

// ============================================
// 文章相关函数
// ============================================

export async function getPosts(options = {}) {
  let query = supabase
    .from('posts')
    .select(`id, title, content, media_urls, user_id, created_at, updated_at, profiles!posts_user_id_fkey (username)`)
    .order('created_at', { ascending: false });
  if (options.limit) query = query.limit(options.limit);
  if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  const { data, error } = await query;
  return { data, error };
}

export async function getPostById(id) {
  const { data, error } = await supabase
    .from('posts')
    .select(`id, title, content, media_urls, user_id, created_at, updated_at, profiles!posts_user_id_fkey (username)`)
    .eq('id', id).single();
  return { data, error };
}

export async function createPost(title, content, mediaUrls) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('请先登录');
  const { data, error } = await supabase.from('posts').insert({
    user_id: user.id, title, content, media_urls: mediaUrls || [],
  }).select().single();
  return { data, error };
}

export async function updatePost(id, title, content, mediaUrls) {
  const { data, error } = await supabase.from('posts')
    .update({ title, content, media_urls, updated_at: new Date() })
    .eq('id', id).select().single();
  return { data, error };
}

export async function deletePost(id) {
  const { error } = await supabase.from('posts').delete().eq('id', id);
  return { error };
}

// ============================================
// 文件上传
// ============================================

export async function uploadMedia(file, userId) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
  const { data, error } = await supabase.storage.from('post-media')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });
  if (error) return { error };
  const { data: urlData } = supabase.storage.from('post-media').getPublicUrl(fileName);
  return { url: urlData.publicUrl, error: null };
}

// ============================================
// UI 辅助函数
// ============================================

export function showAlert(elementId, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

export function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function excerpt(text, maxLen = 150) {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

function getYouTubeId(url) {
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return match ? match[1] : null;
}

function getBilibiliId(url) {
  const match = url.match(/bilibili\.com\/video\/(BV[\w]+)/);
  return match ? match[1] : null;
}

export function renderMedia(mediaUrls) {
  if (!mediaUrls || mediaUrls.length === 0) return '';
  return mediaUrls.map(media => {
    let html = '<div class="post-detail-media">';
    if (media.type === 'image') {
      html += `<img src="${escapeHtml(media.url)}" alt="${escapeHtml(media.caption || '')}" loading="lazy">`;
    } else if (media.type === 'video') {
      const ytId = getYouTubeId(media.url);
      const blId = getBilibiliId(media.url);
      if (ytId) {
        html += `<iframe src="https://www.youtube.com/embed/${ytId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      } else if (blId) {
        html += `<iframe src="https://player.bilibili.com/player.html?bvid=${blId}" frameborder="0" allowfullscreen></iframe>`;
      } else {
        html += `<video src="${escapeHtml(media.url)}" controls></video>`;
      }
    }
    if (media.caption) html += `<p class="media-caption">${escapeHtml(media.caption)}</p>`;
    html += '</div>';
    return html;
  }).join('');
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// 导航栏更新
// ============================================

export async function updateNavbar() {
  const navAuth = document.getElementById('nav-auth');
  if (!navAuth) return;
  const { user } = await getCurrentUser();
  if (user) {
    navAuth.innerHTML = `
      <a href="new-post.html" class="btn btn-primary btn-sm">✏️ 写文章</a>
      <span style="font-size:0.85rem;color:var(--gray-500);">${escapeHtml(user.email)}</span>
      <a href="#" id="btn-logout" class="btn btn-outline btn-sm">退出</a>`;
    document.getElementById('btn-logout')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await signOut();
      window.location.href = 'index.html';
    });
  } else {
    navAuth.innerHTML = `
      <a href="login.html" class="btn btn-outline btn-sm">登录</a>
      <a href="register.html" class="btn btn-primary btn-sm">注册</a>`;
  }
}
