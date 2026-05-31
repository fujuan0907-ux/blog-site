// ============================================
// Blog App - 零依赖版本（纯 fetch 调用 Supabase API）
// 无需加载任何外部库，直接使用 REST API
// ============================================

const API = {
  url: window.__SUPABASE_URL__,
  key: window.__SUPABASE_ANON_KEY__,
  siteUrl: window.__SITE_URL__,

  async request(method, path, body, jwt) {
    const headers = {
      'apikey': this.key,
      'Content-Type': 'application/json',
    };
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${this.url}${path}`, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) throw new Error(data?.message || data?.msg || `请求失败 (${res.status})`);
    return data;
  },

  async uploadFile(path, file, jwt) {
    const headers = { 'apikey': this.key };
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
    const form = new FormData();
    form.append('', file);
    const res = await fetch(`${this.url}/storage/v1/object/${path}`, {
      method: 'POST', headers, body: form,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.message || '上传失败');
    }
    return res.json();
  },
};

// ============================================
// 认证
// ============================================

async function signUp(email, password, username) {
  const res = await fetch(`${API.url}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'apikey': API.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, data: { username } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.msg || '注册失败');
  return data;
}

async function signIn(email, password) {
  const res = await fetch(`${API.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': API.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description || data?.msg || '登录失败');
  // 保存 session 到 localStorage
  if (data.access_token) {
    localStorage.setItem('sb-token', JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
      user: data.user,
    }));
  }
  return data;
}

async function signOut() {
  const session = getLocalSession();
  if (session?.access_token) {
    await fetch(`${API.url}/auth/v1/logout`, {
      method: 'POST',
      headers: { 'apikey': API.key, 'Authorization': `Bearer ${session.access_token}` },
    }).catch(() => {});
  }
  localStorage.removeItem('sb-token');
}

async function resetPassword(email) {
  const res = await fetch(`${API.url}/auth/v1/recover`, {
    method: 'POST',
    headers: { 'apikey': API.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data?.msg || '发送失败');
  }
}

async function updatePassword(newPassword) {
  const res = await fetch(`${API.url}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'apikey': API.key,
      'Authorization': `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: newPassword }),
  });
  if (!res.ok) throw new Error('更新密码失败');
}

function getLocalSession() {
  try { return JSON.parse(localStorage.getItem('sb-token')); } catch { return null; }
}

function getAccessToken() {
  return getLocalSession()?.access_token || null;
}

async function getCurrentUser() {
  const token = getAccessToken();
  if (!token) return { user: null };
  try {
    const res = await fetch(`${API.url}/auth/v1/user`, {
      headers: { 'apikey': API.key, 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { localStorage.removeItem('sb-token'); return { user: null }; }
    const user = await res.json();
    return { user };
  } catch {
    return { user: null };
  }
}

// ============================================
// 文章 CRUD
// ============================================

async function getPosts(options = {}) {
  const params = new URLSearchParams();
  params.set('select', 'id,title,content,media_urls,user_id,created_at,updated_at,profiles!posts_user_id_fkey(username)');
  params.set('order', 'created_at.desc');
  if (options.limit) params.set('limit', options.limit);
  if (options.offset) params.set('offset', options.offset);

  const res = await fetch(`${API.url}/rest/v1/posts?${params}`, {
    headers: { 'apikey': API.key, 'Authorization': `Bearer ${API.key}` },
  });
  if (!res.ok) throw new Error('加载文章失败');
  return await res.json();
}

async function getPostById(id) {
  const res = await fetch(`${API.url}/rest/v1/posts?id=eq.${id}&select=id,title,content,media_urls,user_id,created_at,updated_at,profiles!posts_user_id_fkey(username)`, {
    headers: { 'apikey': API.key, 'Authorization': `Bearer ${API.key}` },
  });
  if (!res.ok) throw new Error('文章不存在');
  const data = await res.json();
  return data?.[0] || null;
}

async function createPost(title, content, mediaUrls) {
  const user = getLocalSession()?.user;
  if (!user) throw new Error('请先登录');
  const res = await fetch(`${API.url}/rest/v1/posts`, {
    method: 'POST',
    headers: {
      'apikey': API.key,
      'Authorization': `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ title, content, media_urls: mediaUrls || [], user_id: user.id }),
  });
  if (!res.ok) throw new Error('发布失败');
  const data = await res.json();
  return data?.[0] || data;
}

async function updatePost(id, title, content, mediaUrls) {
  const res = await fetch(`${API.url}/rest/v1/posts?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': API.key,
      'Authorization': `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ title, content, media_urls: mediaUrls || [], updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error('更新失败');
  const data = await res.json();
  return data?.[0] || data;
}

async function deletePost(id) {
  const res = await fetch(`${API.url}/rest/v1/posts?id=eq.${id}`, {
    method: 'DELETE',
    headers: {
      'apikey': API.key,
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });
  if (!res.ok) throw new Error('删除失败');
}

// ============================================
// 文件上传
// ============================================

async function uploadMedia(file, userId) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
  const token = getAccessToken();
  const headers = { 'apikey': API.key };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const form = new FormData();
  form.append('', file);
  form.append('cacheControl', '3600');

  const res = await fetch(`${API.url}/storage/v1/object/post-media/${fileName}`, {
    method: 'POST', headers, body: form,
  });
  if (!res.ok) throw new Error('图片上传失败');
  return { url: `${API.url}/storage/v1/object/public/post-media/${fileName}` };
}

// ============================================
// UI 辅助
// ============================================

function showAlert(elementId, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function formatDate(dateStr) {
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

function excerpt(text, maxLen = 150) {
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

function renderMedia(mediaUrls) {
  if (!mediaUrls || mediaUrls.length === 0) return '';
  return mediaUrls.map(media => {
    let html = '<div class="post-detail-media">';
    if (media.type === 'image') {
      html += `<img src="${escapeHtml(media.url)}" alt="${escapeHtml(media.caption || '')}" loading="lazy">`;
    } else if (media.type === 'video') {
      const ytId = getYouTubeId(media.url);
      const blId = getBilibiliId(media.url);
      if (ytId) html += `<iframe src="https://www.youtube.com/embed/${ytId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      else if (blId) html += `<iframe src="https://player.bilibili.com/player.html?bvid=${blId}" frameborder="0" allowfullscreen></iframe>`;
      else html += `<video src="${escapeHtml(media.url)}" controls></video>`;
    }
    if (media.caption) html += `<p class="media-caption">${escapeHtml(media.caption)}</p>`;
    html += '</div>';
    return html;
  }).join('');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function updateNavbar() {
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
