# 国内部署方案

## 方案一：阿里云 OSS + CDN

### 1. 构建项目
```bash
npm run build
```

### 2. 上传到 OSS
1. 登录阿里云控制台
2. 创建 OSS Bucket（公共读权限）
3. 上传 dist 目录下的所有文件

### 3. 配置静态网站
在 OSS Bucket 设置中：
- 基础设置 → 静态页面
- 默认首页：index.html
- 默认404页：index.html（单页应用）

### 4. 绑定 CDN（可选但推荐）
- 开通阿里云 CDN
- 绑定 OSS 源站
- 配置自定义域名

**费用**：约 10-30元/月

---

## 方案二：腾讯云 COS + CDN

类似阿里云方案，步骤基本一致。

---

## 方案三：七牛云（有免费额度）

1. 注册七牛云
2. 创建对象存储空间
3. 上传构建文件
4. 配置静态网站托管
5. 绑定域名

**费用**：有免费额度，超出后约 0.01元/GB

---

## 方案四：Cloudflare Pages（国际但较稳定）

### 步骤：
1. 访问 https://pages.cloudflare.com
2. 连接 GitHub 仓库
3. 配置构建：
   - Build command: `npm run build`
   - Build output directory: `dist`
4. 部署完成

### 优化国内访问：
- 在 Cloudflare 中启用 "中国网络"
- 使用 Cloudflare CDN

---

## 方案五：自建服务器（完全可控）

如果有服务器（阿里云/腾讯云 ECS）：

### 1. 构建并上传
```bash
npm run build
scp -r dist/* root@your-server:/var/www/daigong
```

### 2. 安装 Nginx
```bash
sudo apt update
sudo apt install nginx
```

### 3. 配置 Nginx
创建 `/etc/nginx/sites-available/daigong`：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /var/www/daigong;
    index index.html;
    
    # 单页应用路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 开启 gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 4. 启用并重启
```bash
sudo ln -s /etc/nginx/sites-available/daigong /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. 配置 HTTPS
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 自动化部署脚本

创建 `deploy.sh`：

```bash
#!/bin/bash

# 构建项目
npm run build

# 上传到服务器（需配置免密登录）
rsync -avz --delete dist/ root@your-server:/var/www/daigong/

# 重启 Nginx（可选）
# ssh root@your-server "sudo systemctl reload nginx"

echo "部署完成！"
```

使用：
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 推荐方案对比

| 方案 | 难度 | 费用 | 国内访问 | 自动部署 |
|------|------|------|----------|----------|
| Vercel | ⭐ | 免费 | ⚠️ 不稳定 | ✅ |
| Cloudflare Pages | ⭐⭐ | 免费 | ⚠️ 较稳定 | ✅ |
| 阿里云 OSS+CDN | ⭐⭐⭐ | 10-30元/月 | ✅ 很稳定 | ⚠️ 需配置 |
| 腾讯云 COS+CDN | ⭐⭐⭐ | 10-30元/月 | ✅ 很稳定 | ⚠️ 需配置 |
| 自建服务器 | ⭐⭐⭐⭐ | 服务器费用 | ✅ 完全可控 | ⚠️ 需配置 |

---

## 当前建议

如果主要用户在国内，推荐：
1. **短期测试**：等待 Vercel 网络恢复，或换个网络/VPN 试试
2. **长期使用**：使用阿里云 OSS + CDN，稳定且成本低
3. **折中方案**：Cloudflare Pages，免费且相对稳定
