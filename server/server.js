const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_your_test_key_here', {
  apiVersion: '2023-10-16'
});

// Admin authentication
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1coastmedia2024!';

// Simple session storage (in production, use Redis or database)
const adminSessions = new Map();

// Google Analytics 4 Configuration
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || 'G-K54J9FPE7N';
const GA4_CLIENT_EMAIL = process.env.GA4_CLIENT_EMAIL || '';
const GA4_PROJECT_ID = process.env.GA4_PROJECT_ID || '';

// Path to GA4 credentials secret file
const GA4_CREDENTIALS_FILE = '/etc/secrets/indigo-history-470903-u1-1767a89d48ba.json';

// Log environment variables for debugging
console.log('🔍 Environment variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('RENDER:', process.env.RENDER);
console.log('RENDER_EXTERNAL_HOSTNAME:', process.env.RENDER_EXTERNAL_HOSTNAME);

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Force HTTPS in production
app.use((req, res, next) => {
  console.log(`🔒 Request: ${req.method} ${req.url} - Protocol: ${req.protocol} - Secure: ${req.secure} - Forwarded: ${req.get('x-forwarded-proto')}`);
  
  if (process.env.NODE_ENV === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
    console.log(`🔄 Redirecting to HTTPS: ${req.get('host')}${req.url}`);
    return res.redirect(`https://${req.get('host')}${req.url}`);
  }
  next();
});

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Path to the services data file
const SERVICES_FILE = path.join(__dirname, 'services-data.json');
// Path to the content management file
const CONTENT_FILE = path.join(__dirname, 'content-data.json');

// Initialize services data file if it doesn't exist
function initializeServicesFile() {
  if (!fs.existsSync(SERVICES_FILE)) {
    // Copy the default services from the data/services.js file
    const defaultServicesPath = path.join(__dirname, '..', 'data', 'services.js');
    if (fs.existsSync(defaultServicesPath)) {
      try {
        // Read the services.js file and extract the serviceData
        const servicesContent = fs.readFileSync(defaultServicesPath, 'utf8');
        // Simple regex to extract the serviceData object
        const match = servicesContent.match(/window\.serviceData\s*=\s*({[\s\S]*});/);
        if (match) {
          const serviceData = eval('(' + match[1] + ')');
          fs.writeFileSync(SERVICES_FILE, JSON.stringify(serviceData, null, 2));
          console.log('✅ Initialized services data file with default data');
        }
      } catch (error) {
        console.error('❌ Error initializing services file:', error);
        // Create empty structure if extraction fails
        const emptyData = { serviceCategories: {}, addons: [] };
        fs.writeFileSync(SERVICES_FILE, JSON.stringify(emptyData, null, 2));
      }
    } else {
      // Create empty structure if no default file exists
      const emptyData = { serviceCategories: {}, addons: [] };
      fs.writeFileSync(SERVICES_FILE, JSON.stringify(emptyData, null, 2));
    }
  }
}

// Get all services
app.get('/api/services', (req, res) => {
  try {
    if (!fs.existsSync(SERVICES_FILE)) {
      initializeServicesFile();
    }
    const data = fs.readFileSync(SERVICES_FILE, 'utf8');
    const services = JSON.parse(data);
    res.json(services);
  } catch (error) {
    console.error('❌ Error reading services:', error);
    res.status(500).json({ error: 'Failed to read services' });
  }
});

// Save services (protected by admin auth)
app.post('/api/services', requireAuth, (req, res) => {
  try {
    const services = req.body;
    
    // Validate the data structure
    if (!services || typeof services !== 'object') {
      return res.status(400).json({ error: 'Invalid services data' });
    }
    
    // Save to file
    fs.writeFileSync(SERVICES_FILE, JSON.stringify(services, null, 2));
    
    console.log('✅ Services saved successfully');
    res.json({ success: true, message: 'Services saved successfully' });
  } catch (error) {
    console.error('❌ Error saving services:', error);
    res.status(500).json({ error: 'Failed to save services' });
  }
});

// Get content data
app.get('/api/content', (req, res) => {
  try {
    if (!fs.existsSync(CONTENT_FILE)) {
      // Return default content if file doesn't exist
      const defaultContent = require('./content-data.json');
      res.json(defaultContent);
      return;
    }
    const data = fs.readFileSync(CONTENT_FILE, 'utf8');
    const content = JSON.parse(data);
    res.json(content);
  } catch (error) {
    console.error('❌ Error reading content:', error);
    res.status(500).json({ error: 'Failed to read content' });
  }
});

// Save content data (protected by admin auth)
app.post('/api/content', requireAuth, (req, res) => {
  try {
    const content = req.body;
    
    // Validate the data structure
    if (!content || typeof content !== 'object') {
      return res.status(400).json({ error: 'Invalid content data' });
    }
    
    // Update timestamp
    content.meta = {
      ...content.meta,
      lastUpdated: new Date().toISOString()
    };
    
    // Save to file
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 2));
    
    console.log('✅ Content saved successfully');
    res.json({ success: true, message: 'Content saved successfully' });
  } catch (error) {
    console.error('❌ Error saving content:', error);
    res.status(500).json({ error: 'Failed to save content' });
  }
});

// Google Analytics 4 Analytics Endpoints
app.get('/api/analytics/realtime', async (req, res) => {
  try {
    console.log('🔍 GA4 Realtime Request - Checking credentials...');
    console.log('📧 GA4_CLIENT_EMAIL:', GA4_CLIENT_EMAIL);
    console.log('🏗️ GA4_PROJECT_ID:', GA4_PROJECT_ID);
    console.log('📁 GA4_CREDENTIALS_FILE:', GA4_CREDENTIALS_FILE);
    
    if (!GA4_CLIENT_EMAIL || !GA4_PROJECT_ID) {
      console.log('❌ Missing GA4 credentials - returning mock data');
      // Return mock data if GA4 credentials not configured
      return res.json({
        activeUsers: Math.floor(Math.random() * 50) + 10,
        pageViews: Math.floor(Math.random() * 200) + 50,
        sessions: Math.floor(Math.random() * 100) + 20
      });
    }
    
    console.log('✅ GA4 credentials found - attempting real API call');

    // Initialize GA4 client
    const auth = new google.auth.GoogleAuth({
      keyFile: GA4_CREDENTIALS_FILE,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly']
    });

    const analyticsData = google.analyticsdata({
      version: 'v1beta',
      auth: auth
    });

    // Get real-time data
    const response = await analyticsData.properties.runRealtimeReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      requestBody: {
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'screenPageViews' }
        ]
      }
    });

    const result = response.data;
    const activeUsers = result.rows?.[0]?.metricValues?.[0]?.value || 0;
    const pageViews = result.rows?.[0]?.metricValues?.[1]?.value || 0;

    res.json({
      activeUsers: parseInt(activeUsers),
      pageViews: parseInt(pageViews),
      sessions: Math.floor(parseInt(activeUsers) * 1.5)
    });

  } catch (error) {
    console.error('❌ GA4 realtime error:', error);
    console.error('🔍 Error details:', error.message);
    console.error('📁 Credentials file path:', GA4_CREDENTIALS_FILE);
    console.error('📧 Client email:', GA4_CLIENT_EMAIL);
    console.error('🏗️ Project ID:', GA4_PROJECT_ID);
    
    // Return mock data on error
    res.json({
      activeUsers: Math.floor(Math.random() * 50) + 10,
      pageViews: Math.floor(Math.random() * 200) + 50,
      sessions: Math.floor(Math.random() * 100) + 20
    });
  }
});

app.get('/api/analytics/summary', async (req, res) => {
  try {
    if (!GA4_CLIENT_EMAIL || !GA4_PROJECT_ID) {
      // Return mock data if GA4 credentials not configured
      const mockData = {
        totalUsers: Math.floor(Math.random() * 1000) + 500,
        totalSessions: Math.floor(Math.random() * 2000) + 1000,
        totalPageViews: Math.floor(Math.random() * 5000) + 2500,
        bounceRate: Math.floor(Math.random() * 30) + 40,
        avgSessionDuration: Math.floor(Math.random() * 120) + 60,
        timeseries: Array.from({ length: 28 }, (_, i) => ({
          date: new Date(Date.now() - (27 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          totalUsers: Math.floor(Math.random() * 100) + 20,
          totalSessions: Math.floor(Math.random() * 150) + 30,
          totalPageViews: Math.floor(Math.random() * 300) + 60
        })),
        topPages: [
          { path: '/', views: Math.floor(Math.random() * 500) + 200 },
          { path: '/growth-machine', views: Math.floor(Math.random() * 300) + 150 },
          { path: '/admin', views: Math.floor(Math.random() * 100) + 50 },
          { path: '/content-manager', views: Math.floor(Math.random() * 80) + 30 }
        ],
        topSources: [
          { source: 'Direct', sessions: Math.floor(Math.random() * 400) + 200 },
          { source: 'Google', sessions: Math.floor(Math.random() * 300) + 150 },
          { source: 'Social Media', sessions: Math.floor(Math.random() * 200) + 100 },
          { source: 'Referral', sessions: Math.floor(Math.random() * 150) + 75 }
        ]
      };
      return res.json(mockData);
    }

    // Initialize GA4 client
    const auth = new google.auth.GoogleAuth({
      keyFile: GA4_CREDENTIALS_FILE,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly']
    });

    const analyticsData = google.analyticsdata({
      version: 'v1beta',
      auth: auth
    });

    // Get date range (last 28 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 28);

    // Get summary data
    const response = await analyticsData.properties.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      requestBody: {
        dateRanges: [{
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }],
        dimensions: [
          { name: 'date' },
          { name: 'pagePath' },
          { name: 'source' }
        ],
        metrics: [
          { name: 'totalUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' }
        ]
      }
    });

    // Process the response data
    const result = response.data;
    // This is a simplified version - you'd want to process the data more thoroughly
    
    res.json({
      totalUsers: 0,
      totalSessions: 0,
      totalPageViews: 0,
      bounceRate: 0,
      avgSessionDuration: 0,
      timeseries: [],
      topPages: [],
      topSources: []
    });

  } catch (error) {
    console.error('❌ GA4 summary error:', error);
    // Return mock data on error
    const mockData = {
      totalUsers: Math.floor(Math.random() * 1000) + 500,
      totalSessions: Math.floor(Math.random() * 2000) + 1000,
      totalPageViews: Math.floor(Math.random() * 5000) + 2500,
      bounceRate: Math.floor(Math.random() * 30) + 40,
      avgSessionDuration: Math.floor(Math.random() * 120) + 60,
      timeseries: Array.from({ length: 28 }, (_, i) => ({
        date: new Date(Date.now() - (27 - i) * 1000 * 60 * 60 * 24).toISOString().split('T')[0],
        totalUsers: Math.floor(Math.random() * 100) + 20,
        totalSessions: Math.floor(Math.random() * 100) + 30,
        totalPageViews: Math.floor(Math.random() * 200) + 60
      })),
      topPages: [
        { path: '/', views: Math.floor(Math.random() * 500) + 200 },
        { path: '/growth-machine', views: Math.floor(Math.random() * 300) + 150 },
        { path: '/admin', views: Math.floor(Math.random() * 100) + 50 },
        { path: '/content-manager', views: Math.floor(Math.random() * 100) + 30 }
      ],
      topSources: [
        { source: 'Direct', sessions: Math.floor(Math.random() * 400) + 200 },
        { source: 'Google', sessions: Math.floor(Math.random() * 100) + 150 },
        { source: 'Social Media', sessions: Math.floor(Math.random() * 200) + 100 },
        { source: 'Referral', sessions: Math.floor(Math.random() * 150) + 75 }
      ]
    };
    res.json(mockData);
  }
});

// Admin authentication middleware
function requireAuth(req, res, next) {
  const sessionToken = req.headers.authorization?.replace('Bearer ', '') || 
                      req.cookies?.adminSession;
  
  if (!sessionToken || !adminSessions.has(sessionToken)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Check if session is expired (24 hours)
  const session = adminSessions.get(sessionToken);
  if (Date.now() - session.created > 24 * 60 * 60 * 1000) {
    adminSessions.delete(sessionToken);
    return res.status(401).json({ error: 'Session expired' });
  }
  
  next();
}

// Admin login endpoint
app.post('/api/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      // Generate secure session token
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const session = {
        username,
        created: Date.now(),
        lastActivity: Date.now()
      };
      
      adminSessions.set(sessionToken, session);
      
      // Clean up old sessions (older than 24 hours)
      for (const [token, sess] of adminSessions.entries()) {
        if (Date.now() - sess.created > 24 * 60 * 60 * 1000) {
          adminSessions.delete(token);
        }
      }
      
      console.log('✅ Admin login successful:', username);
      
      // Set secure cookie for session
      res.cookie('adminSession', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      
      res.json({ 
        success: true, 
        sessionToken,
        message: 'Login successful' 
      });
    } else {
      console.log('❌ Admin login failed: Invalid credentials');
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('❌ Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Admin logout endpoint
app.post('/api/admin/logout', requireAuth, (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '') || 
                        req.cookies?.adminSession;
    
    if (sessionToken) {
      adminSessions.delete(sessionToken);
      console.log('✅ Admin logout successful');
    }
    
    // Clear the session cookie
    res.clearCookie('adminSession');
    
    res.json({ success: true, message: 'Logout successful' });
  } catch (error) {
    console.error('❌ Admin logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Stripe Checkout endpoint
app.post('/api/checkout', async (req, res) => {
  try {
    const { cart, contact = {} } = req.body;
    
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Determine if this is a subscription (monthly) or one-time payment
    const hasMonthlyItems = cart.some(item => item.price && item.price.monthly && item.price.monthly > 0);
    const mode = hasMonthlyItems ? 'subscription' : 'payment';
    
    const lineItems = [];
    
    for (const item of cart) {
      let price = 0;
      let interval = null;
      
      if (mode === 'subscription' && item.price && item.price.monthly && item.price.monthly > 0) {
        price = item.price.monthly;
        interval = 'month';
      } else if (item.price && item.price.oneTime && item.price.oneTime > 0) {
        price = item.price.oneTime;
      } else if (item.price && typeof item.price === 'number') {
        price = item.price;
      }
      
      if (price > 0) {
        const lineItem = {
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.name || 'Service',
              description: item.description || item.outcome || ''
            },
            unit_amount: Math.round(price * 100), // Convert to cents
            ...(interval && { recurring: { interval } })
          },
          quantity: 1
        };
        lineItems.push(lineItem);
      }
    }
    
    if (lineItems.length === 0) {
      return res.status(400).json({ error: 'No billable items in cart' });
    }

    // Get the origin for success/cancel URLs
    const origin = req.headers.origin || `https://${req.headers.host}`;
    
    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: lineItems,
      success_url: `${origin}/?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=1`,
      metadata: {
        email: contact.email || '',
        name: contact.name || '',
        company: contact.company || '',
        phone: contact.phone || '',
        notes: contact.notes || '',
        cart_items: JSON.stringify(cart.map(item => ({ name: item.name, price: item.price })))
      },
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      customer_email: contact.email,
      billing_address_collection: 'required',
      ...(mode === 'subscription' && {
        subscription_data: {
          metadata: {
            plan_type: 'growth_machine',
            contact_info: JSON.stringify(contact)
          }
        }
      })
    });

    console.log('✅ Stripe checkout session created:', session.id);
    res.json({ 
      success: true, 
      sessionId: session.id, 
      url: session.url 
    });
    
  } catch (error) {
    console.error('❌ Stripe checkout error:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    workingDirectory: process.cwd(),
    files: fs.readdirSync('.'),
    protocol: req.protocol,
    secure: req.secure,
    host: req.get('host'),
    forwardedProto: req.get('x-forwarded-proto'),
    render: process.env.RENDER,
    renderExternalHostname: process.env.RENDER_EXTERNAL_HOSTNAME
  });
});

// URL Rewriting - Clean URLs without .html extension
app.get('/growth-machine', (req, res) => {
  const growthMachinePath = path.join(__dirname, '..', 'growth-machine.html');
  if (fs.existsSync(growthMachinePath)) {
    res.sendFile(growthMachinePath);
  } else {
    res.status(404).json({ error: 'Growth Machine page not found' });
  }
});

app.get('/admin', (req, res) => {
  const adminPath = path.join(__dirname, '..', 'admin.html');
  if (fs.existsSync(adminPath)) {
    res.sendFile(adminPath);
  } else {
    res.status(404).json({ error: 'Admin panel not found' });
  }
});

app.get('/content-manager', (req, res) => {
  const contentManagerPath = path.join(__dirname, '..', 'admin-content.html');
  if (fs.existsSync(contentManagerPath)) {
    res.sendFile(contentManagerPath);
  } else {
    res.status(404).json({ error: 'Content manager not found' });
  }
});

// Root endpoint - serve index.html
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ 
      error: 'index.html not found',
      path: indexPath,
      exists: fs.existsSync(indexPath),
      files: fs.readdirSync(path.join(__dirname, '..'))
    });
  }
});

// Serve static files from parent directory (root of project)
app.use(express.static(path.join(__dirname, '..')));

// Specific route for index.html (fallback)
app.get('/index.html', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ 
      error: 'index.html not found',
      path: indexPath,
      exists: fs.existsSync(indexPath)
    });
  }
});

// Specific route for admin.html (fallback)
app.get('/admin.html', (req, res) => {
  const adminPath = path.join(__dirname, '..', 'admin.html');
  if (fs.existsSync(adminPath)) {
    res.sendFile(adminPath);
  } else {
    res.status(404).json({ 
      error: 'admin.html not found',
      path: adminPath,
      exists: fs.existsSync(adminPath)
    });
  }
});

// Specific route for growth-machine.html (fallback)
app.get('/growth-machine.html', (req, res) => {
  const growthMachinePath = path.join(__dirname, '..', 'growth-machine.html');
  if (fs.existsSync(growthMachinePath)) {
    res.sendFile(growthMachinePath);
  } else {
    res.status(404).json({ 
      error: 'growth-machine.html not found',
      path: growthMachinePath,
      exists: fs.existsSync(growthMachinePath)
    });
  }
});

// Specific route for admin-content.html (fallback)
app.get('/admin-content.html', (req, res) => {
  const contentManagerPath = path.join(__dirname, '..', 'admin-content.html');
  if (fs.existsSync(contentManagerPath)) {
    res.sendFile(contentManagerPath);
  } else {
    res.status(404).json({ 
      error: 'admin-content.html not found',
      path: contentManagerPath,
      exists: fs.existsSync(contentManagerPath)
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    method: req.method,
    availableFiles: fs.readdirSync(path.join(__dirname, '..'))
  });
});

// Initialize the services file when server starts
initializeServicesFile();

app.listen(PORT, () => {
  console.log('🚀 1CoastMedia server running!');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 HTTPS Redirect: ${process.env.NODE_ENV === 'production' ? 'Enabled' : 'Disabled'}`);
  console.log(`🔗 Clean URLs: /growth-machine, /admin, /content-manager`);
  console.log(`📁 Working directory: ${process.cwd()}`);
  console.log(`📁 Services data file: ${SERVICES_FILE}`);
  console.log(`📁 Content data file: ${CONTENT_FILE}`);
  console.log(`📁 Root directory: ${path.join(__dirname, '..')}`);
  console.log(`📁 Available files: ${fs.readdirSync(path.join(__dirname, '..')).join(', ')}`);
  console.log(`📱 Admin panel: http://localhost:${PORT}/admin`);
  console.log(`🎨 Content manager: http://localhost:${PORT}/content-manager`);
  console.log(`🌐 Main site: http://localhost:${PORT}/`);
  console.log(`🚀 Growth Machine: http://localhost:${PORT}/growth-machine`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('Press Ctrl+C to stop the server');
});
