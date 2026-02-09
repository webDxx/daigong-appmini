#!/bin/bash

echo "🔨 开始构建项目..."
npm run build

echo ""
echo "✅ 构建完成！"
echo ""
echo "📦 dist 目录已生成，包含以下文件："
ls -lh dist/

echo ""
echo "🌐 部署选项："
echo ""
echo "1. Netlify Drop (最简单):"
echo "   访问 https://app.netlify.com/drop"
echo "   直接拖拽 dist 文件夹到页面上即可！"
echo ""
echo "2. Vercel CLI:"
echo "   npx vercel --prod"
echo ""
echo "3. GitHub Pages:"
echo "   npx gh-pages -d dist"
echo ""
