# 1CoastMedia Offers - Server Edition

This is a permanent solution to the localStorage issue. Now your offers will be stored on a server and accessible from any device.

## 🚀 Quick Start

### 1. Install Node.js
If you don't have Node.js installed, download it from [nodejs.org](https://nodejs.org/)

### 2. Start the Server
Simply run the startup script:
```bash
./start-server.sh
```

Or manually:
```bash
cd server
npm install
npm start
```

### 3. Access Your Site
- **Main website**: http://localhost:3000/index.html
- **Admin panel**: http://localhost:3000/admin.html

## 🔧 How It Works

- **Before**: Offers were stored in localStorage (device-specific, temporary)
- **Now**: Offers are stored on a server in a JSON file (persistent, accessible from anywhere)

## 📁 File Structure

```
├── server/
│   ├── server.js          # Main server file
│   ├── package.json       # Dependencies
│   └── services-data.json # Your offers data (auto-created)
├── admin.html             # Admin panel (unchanged)
├── admin.js               # Admin logic (updated for server)
├── app.js                 # Main app logic (updated for server)
├── index.html             # Main website (unchanged)
├── data/services.js       # Default services (fallback)
└── start-server.sh        # Easy startup script
```

## 🌐 Deployment

### Local Development
- Server runs on port 3000
- Data stored in `server/services-data.json`

### Production Deployment
To deploy to your live server:

1. Upload all files to your server
2. Install Node.js on your server
3. Run `npm install` in the server directory
4. Start with `npm start` or use a process manager like PM2

### Environment Variables
- `PORT`: Change server port (default: 3000)

## 🔄 Data Migration

Your existing offers from localStorage will need to be recreated in the admin panel. The server will automatically initialize with the default services from `data/services.js`.

## 🛠️ Troubleshooting

### Server won't start
- Check if Node.js is installed: `node --version`
- Check if port 3000 is available
- Look for error messages in the terminal

### Offers not showing
- Check if server is running: http://localhost:3000/api/health
- Check browser console for errors
- Verify data in `server/services-data.json`

### Admin panel not working
- Make sure you're accessing via http://localhost:3000/admin.html
- Check browser console for JavaScript errors
- Verify server is running and accessible

## 📱 Benefits

✅ **Persistent**: Offers saved on server, not lost when browser clears
✅ **Multi-device**: Access from phone, computer, tablet
✅ **Backup**: Data stored in JSON file, easy to backup
✅ **Simple**: No database setup required
✅ **Fast**: Lightweight Node.js server

## 🔒 Security Note

This is a simple solution for basic use. For production with multiple users, consider:
- Adding authentication to admin panel
- Using a proper database
- Adding rate limiting
- HTTPS encryption

## 📞 Support

If you run into issues:
1. Check the terminal output for error messages
2. Verify all files are in the correct locations
3. Make sure Node.js is properly installed
4. Check if port 3000 is available on your system
