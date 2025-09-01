# 🚀 Live Deployment Guide

Get your 1CoastMedia offers site live on the internet!

## 🌟 **Recommended: Render.com (Free & Easy)**

### Step 1: Prepare Your Files
```bash
# Make sure all files are committed
git add .
git commit -m "Ready for production deployment"
git push origin main
```

### Step 2: Deploy on Render
1. **Sign up** at [render.com](https://render.com)
2. **Click "New +"** → **"Web Service"**
3. **Connect GitHub** and select your repository
4. **Configure deployment:**
   - **Name**: `1coastmedia-offers`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Port**: `3000`
   - **Auto-Deploy**: ✅ Enabled

### Step 3: Get Your Live URL
- Render will give you: `https://your-app-name.onrender.com`
- Your site will be live at that URL!
- Admin panel: `https://your-app-name.onrender.com/admin.html`

## 🚂 **Alternative: Railway.app (Also Free)**

1. Go to [railway.app](https://railway.app)
2. Connect GitHub repository
3. Deploy as Node.js app
4. Get live URL automatically

## 🖥️ **Your Own Server (Advanced)**

### Upload Files
```bash
# Upload all files to your server
scp -r . user@your-server.com:/var/www/1coastmedia/

# SSH into your server
ssh user@your-server.com

# Navigate to directory
cd /var/www/1coastmedia/server

# Install dependencies
npm install

# Start server
npm start
```

### Use PM2 for Production
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start server.js --name "1coastmedia"

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
```

## 🔧 **Production Configuration**

### Environment Variables
Set these on your hosting platform:

```bash
NODE_ENV=production
PORT=3000
```

### Custom Domain (Optional)
1. **Buy domain** (Namecheap, GoDaddy, etc.)
2. **Point DNS** to your hosting provider
3. **Configure SSL** (automatic on Render/Railway)

## 📱 **Update Your Live Site**

### Add New Offers
1. Go to `https://your-live-url.com/admin.html`
2. Add/edit offers just like before
3. Changes are saved to the server
4. Visible immediately on your live site

### Access from Anywhere
- **Phone**: `https://your-live-url.com`
- **Computer**: `https://your-live-url.com`
- **Tablet**: `https://your-live-url.com`
- **Any device**: `https://your-live-url.com`

## 🚨 **Important Notes**

### Data Persistence
- ✅ Offers saved on server (not lost when browser clears)
- ✅ Accessible from any device
- ✅ Data backed up in JSON file
- ✅ No more localStorage issues

### Security
- 🔒 Admin panel accessible to anyone (consider adding password protection)
- 🔒 Data stored in simple JSON file (consider database for high-traffic sites)
- 🔒 HTTP by default (Render/Railway provide HTTPS automatically)

### Performance
- ⚡ Lightweight Node.js server
- ⚡ Static files served efficiently
- ⚡ JSON data loaded quickly
- ⚡ No database queries

## 🆘 **Troubleshooting**

### Site Not Loading
- Check if server is running
- Verify port configuration
- Check hosting platform logs

### Offers Not Showing
- Verify data in `services-data.json`
- Check browser console for errors
- Test API endpoint: `/api/health`

### Admin Panel Issues
- Ensure you're using the live URL
- Check if server is accessible
- Verify file permissions

## 🎯 **Next Steps After Deployment**

1. **Test everything** on your live site
2. **Add your new offer** through the admin panel
3. **Share your live URL** with customers
4. **Monitor performance** and usage
5. **Consider adding authentication** to admin panel

## 📞 **Need Help?**

- **Render/Railway**: Check their documentation
- **Server issues**: Check terminal/logs
- **Code problems**: Review error messages
- **General questions**: Check the main README.md

---

**🎉 Congratulations!** Your 1CoastMedia offers site is now live on the internet and accessible from anywhere!
