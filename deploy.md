# 部署指南

## 方式一：Vercel 部署（推荐）

### 步骤：
1. 注册 Vercel: https://vercel.com
2. 导入 GitHub 仓库
3. 自动部署完成
4. 绑定自定义域名

**优点**: 免费、自动HTTPS、全球CDN加速、自动部署

---

## 方式二：服务器部署（Nginx）

### 1. 构建项目
```bash
npm run build
```

### 2. 将 dist 目录上传到服务器
```bash
scp -r dist/* root@your-server:/var/www/daigong
```

### 3. Nginx 配置

创建配置文件 `/etc/nginx/sites-available/daigong`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/daigong;
    index index.html;

    # 支持 React Router
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 开启 gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 4. 启用配置并重启 Nginx
```bash
sudo ln -s /etc/nginx/sites-available/daigong /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. 配置 HTTPS（使用 Let's Encrypt）
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 域名配置

### DNS 记录设置

#### Vercel 部署：
- 类型: CNAME
- 名称: @ 或 www
- 值: cname.vercel-dns.com

#### 自己的服务器：
- 类型: A
- 名称: @
- 值: 你的服务器IP地址

---

## 注意事项

1. **环境变量**: Supabase 的 URL 和 KEY 已经在代码中，如果需要更换，记得在 Vercel/Netlify 的环境变量中配置

2. **自动部署**: Vercel/Netlify 会在你推送代码到 GitHub 时自动重新部署

3. **性能优化**: 
   - 已启用 gzip 压缩
   - 静态资源自动缓存
   - 代码已经过生产优化（minify）

4. **安全建议**:
   - 建议将 Supabase 的敏感信息改为环境变量
   - 配置 HTTPS（Vercel/Netlify 自动提供）
   - 设置 Supabase 的 RLS（Row Level Security）策略

---

## 推荐：Vercel 部署

最简单快捷的方式是使用 Vercel：
1. 一键导入 GitHub 仓库
2. 自动配置构建
3. 自动部署
4. 免费 HTTPS 和 CDN
5. 支持自定义域名
6. 每次 push 代码自动重新部署

访问 https://vercel.com 开始部署！
