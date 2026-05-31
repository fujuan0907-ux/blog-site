// ============================================
// Supabase 配置文件
// 请将下面的值替换为你的 Supabase 项目信息
// 在 Supabase Dashboard → Settings → API 中获取
// ============================================

const SUPABASE_CONFIG = {
  // 你的 Supabase 项目 URL（格式: https://xxxxxxxxxxxx.supabase.co）
  url: 'https://kieznunxgzsaxxokvspx.supabase.co',

  // 你的 Supabase anon/public key（公开的客户端密钥）
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZXpudW54Z3pzYXh4b2t2c3B4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjI2NDIsImV4cCI6MjA5NTc5ODY0Mn0.9peQ-Xc6FgNYTrz9IxM9322uWfG_6tCsxd-AyP4JSkU',

  // 你的网站域名（用于密码重置回调）
  siteUrl: 'https://blog.serviceforlibre.com',
};

// ============================================
// 重要安全提醒：
// 1. anon key 可以暴露在前端，但必须配合 RLS 策略使用
// 2. 永远不要在前端使用 service_role key！
// 3. 请在 Supabase Dashboard → Authentication → URL Configuration
//    设置 Site URL 和 Redirect URLs
// ============================================
