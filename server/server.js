const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Save services
app.post('/api/services', (req, res) => {
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

// Specific route for index.html
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

// Specific route for admin.html
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
  console.log(`📁 Working directory: ${process.cwd()}`);
  console.log(`📁 Services data file: ${SERVICES_FILE}`);
  console.log(`📁 Root directory: ${path.join(__dirname, '..')}`);
  console.log(`📁 Available files: ${fs.readdirSync(path.join(__dirname, '..')).join(', ')}`);
  console.log(`📱 Admin panel: http://localhost:${PORT}/admin.html`);
  console.log(`🌐 Main site: http://localhost:${PORT}/index.html`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('Press Ctrl+C to stop the server');
});
