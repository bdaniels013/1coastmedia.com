const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const { google } = require('googleapis');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Required secrets (env-only; never hardcode) ---
const REQUIRED_ENV = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length) {
  console.error(`❌ Missing required environment variables: ${missingEnv.join(', ')}`);
  console.error('   Set these in your hosting dashboard (Render/Vercel) or a local .env file.');
  console.error('   See server/env-example.txt for the full list.');
  process.exit(1);
}

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

// Stripe webhook secret
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Admin authentication
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

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
app.use(cookieParser());

// Stripe webhook endpoint needs raw body - must be before JSON parser
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  console.log('🔔 Webhook request received');
  console.log('📋 Headers:', req.headers);
  console.log('🔑 Signature:', req.headers['stripe-signature']);
  console.log('📦 Body length:', req.body ? req.body.length : 'No body');
  
  const sig = req.headers['stripe-signature'];
  let event;

  if (!sig) {
    console.error('❌ No Stripe signature found in headers');
    return res.status(400).send('No Stripe signature found');
  }

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    console.log('✅ Webhook signature verified');
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    console.error('🔍 Webhook secret being used:', STRIPE_WEBHOOK_SECRET ? 'Present' : 'Missing');
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  console.log('🔔 Webhook event received:', event.type);

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('💳 Checkout session completed:', session.id);
        console.log('📊 Session metadata:', session.metadata);
        break;
        
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('💰 Payment succeeded:', paymentIntent.id, 'Amount:', paymentIntent.amount);
        break;
        
      case 'customer.subscription.created':
        const subscription = event.data.object;
        console.log('🔄 Subscription created:', subscription.id);
        break;
        
      case 'customer.subscription.updated':
        const updatedSubscription = event.data.object;
        console.log('🔄 Subscription updated:', updatedSubscription.id);
        break;
        
      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object;
        console.log('🔄 Subscription deleted:', deletedSubscription.id);
        break;
        
      case 'invoice.payment_succeeded':
        const invoice = event.data.object;
        console.log('📄 Invoice payment succeeded:', invoice.id);
        break;
        
      case 'invoice.payment_failed':
        const failedInvoice = event.data.object;
        console.log('❌ Invoice payment failed:', failedInvoice.id);
        break;
        
      default:
        console.log(`🤷 Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// JSON body parser for other endpoints
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
  // SAMEORIGIN (not DENY) so we can embed our own pages in iframes — e.g. the
  // Visual Sales Module on the homepage. Still blocks foreign sites from
  // iframing us (clickjacking protection).
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Use DATA_DIR for persistence; default to current server directory
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname);

// Path to the services data file
const SERVICES_FILE = path.join(DATA_DIR, 'services-data.json');
// Path to the content management file
const CONTENT_FILE = path.join(DATA_DIR, 'content-data.json');
// Path to uploaded image files (lives on the persistent disk so uploads survive deploys)
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`✅ Created upload directory: ${UPLOAD_DIR}`);
}

// --- Image upload (multer) ---
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-z0-9-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 60) || 'image';
    cb(null, `${Date.now()}-${base}${ext}`);
  }
});
const uploadMiddleware = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB cap per file
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed.'));
  }
});

// Initialize services data file if it doesn't exist
function initializeServicesFile() {
  if (!fs.existsSync(SERVICES_FILE)) {
    const emptyData = { serviceCategories: {}, addons: [] };
    fs.writeFileSync(SERVICES_FILE, JSON.stringify(emptyData, null, 2));
    console.log('✅ Initialized services data file (empty catalog)');
  }
}

// Seed required service categories (monthly-addons, specialty-projects) so the
// admin panel and the /services page render them on first boot. Only ADDS missing
// categories — never overwrites existing ones — so Blake's edits are preserved
// across deploys on Render's persistent disk.
const REQUIRED_CATEGORY_TEMPLATES = {
  'monthly-addons': {
    name: 'Monthly Add-Ons',
    description: 'Recurring services that stack on any package.',
    services: [
      {
        key: 'social-media-management',
        name: 'Social Media Management',
        outcome: 'Posting, scheduling, community engagement, comments, and DMs. Built into Growth Machine and Growth Partner. Add it to Content Presence or Content Momentum.',
        price: { oneTime: 0, monthly: 500 },
        priceDisplay: '$500 – $1,500',
        priceNote: '/ month',
        deliverables: [
          '$500 / mo: 1 platform, scheduled posting, basic engagement',
          '$1,000 / mo: 2 platforms, active posting, comments and DMs',
          '$1,500 / mo: 3 platforms, full community management, trend monitoring'
        ],
        badge: 'Social',
        image: '/assets/services/icon-addon-social-media.png',
        sla: '',
        acceptance: '',
        minTerm: 0
      },
      {
        key: 'ongoing-pr-retainer',
        name: 'Ongoing PR Retainer',
        outcome: '1 to 2 press releases per month plus active media outreach and relationship building. Local, regional, and national targeting.',
        price: { oneTime: 0, monthly: 1500 },
        priceDisplay: '$1,500 – $3,500',
        priceNote: '/ month',
        deliverables: [],
        badge: 'PR',
        image: '/assets/services/icon-addon-pr-retainer.png',
        sla: '',
        acceptance: '',
        minTerm: 0
      },
      {
        key: 'additional-filming-day',
        name: 'Additional Filming Day',
        outcome: 'Add an extra production day to any active retainer for more content volume, a special event, or a campaign push.',
        price: { oneTime: 750, monthly: 0 },
        priceDisplay: '$750',
        priceNote: 'per day',
        deliverables: [],
        badge: 'Filming',
        image: '/assets/services/icon-addon-filming-day.png',
        sla: '',
        acceptance: '',
        minTerm: 0
      },
      {
        key: 'extra-short-form-clip-batch',
        name: 'Extra Short-Form Clip Batch',
        outcome: 'A bonus batch of cutdowns when you need more posting volume for a launch, trend, or campaign moment.',
        price: { oneTime: 400, monthly: 0 },
        priceDisplay: '$400',
        priceNote: 'per batch (10 clips)',
        deliverables: [],
        badge: 'Clips',
        image: '/assets/services/icon-addon-shortform-clips.png',
        sla: '',
        acceptance: '',
        minTerm: 0
      },
      {
        key: 'extra-podcast-episode',
        name: 'Extra Podcast Episode',
        outcome: 'Produce an additional podcast episode beyond your weekly cadence. Same edit, thumbnail, and short-form treatment.',
        price: { oneTime: 750, monthly: 0 },
        priceDisplay: '$750',
        priceNote: 'per episode',
        deliverables: [],
        badge: 'Podcast',
        image: '/assets/services/icon-addon-podcast-episode.png',
        sla: '',
        acceptance: '',
        minTerm: 0
      },
      {
        key: 'additional-long-form-episode',
        name: 'Additional Long-Form Episode',
        outcome: 'One extra long-form anchor piece per month. Interview, deep dive, or YouTube-style episode beyond your standard cadence.',
        price: { oneTime: 1250, monthly: 0 },
        priceDisplay: '$1,250',
        priceNote: 'per episode',
        deliverables: [],
        badge: 'Long-form',
        image: '/assets/services/icon-addon-longform-episode.png',
        sla: '',
        acceptance: '',
        minTerm: 0
      },
      {
        key: 'rush-turnaround',
        name: 'Rush Turnaround',
        outcome: '24- to 48-hour priority editing on any deliverable. Jumps the queue for time-sensitive launches and trend moments.',
        price: { oneTime: 250, monthly: 0 },
        priceDisplay: '$250',
        priceNote: 'per project',
        deliverables: [],
        badge: 'Rush',
        image: '/assets/services/icon-addon-rush-turnaround.png',
        sla: '',
        acceptance: '',
        minTerm: 0
      },
      {
        key: 'additional-platform-distribution',
        name: 'Additional Platform Distribution',
        outcome: 'Expand publishing to one more platform (YouTube, LinkedIn, Pinterest, Threads, etc.) with native posting and analytics.',
        price: { oneTime: 0, monthly: 200 },
        priceDisplay: '$200',
        priceNote: '/ month per platform',
        deliverables: [],
        badge: 'Distribution',
        image: '/assets/services/icon-addon-platform-dist.png',
        sla: '',
        acceptance: '',
        minTerm: 0
      }
    ]
  },
  'specialty-projects': {
    name: 'Specialty Projects',
    description: 'One-off projects and standalone productions. Stack on any package or book solo.',
    services: [
      {
        key: 'website-build',
        name: 'Website Build / Redesign',
        outcome: 'Custom design, build, and launch. Mobile-first, SEO-ready, conversion-optimized.',
        price: { oneTime: 3500, monthly: 0 },
        priceDisplay: 'Custom scope',
        priceNote: 'typical range $3,500 to $12,000',
        deliverables: [],
        badge: 'Web',
        image: '/assets/services/icon-specialty-website.png',
        sla: '',
        acceptance: '',
        minTerm: 0
      },
      {
        key: 'single-press-release',
        name: 'Single Press Release',
        outcome: 'Written, formatted, and distributed to news outlets. Pick your reach.',
        price: { oneTime: 450, monthly: 0 },
        priceDisplay: 'From $450',
        priceNote: '/ release',
        deliverables: [
          'Local Gulf Coast: $450',
          'Regional (MS / AL / LA): $950',
          'National: $2,500'
        ],
        badge: 'PR',
        image: '/assets/services/icon-specialty-press-release.png',
        sla: '',
        acceptance: '',
        minTerm: 0
      },
      {
        key: 'photo-mini-session',
        name: 'Photo Mini Session',
        outcome: '20 to 30 edited photos delivered in 48 to 72 hours. Products, staff, venue, menu items.',
        price: { oneTime: 350, monthly: 0 },
        priceDisplay: '$350',
        priceNote: 'per session',
        deliverables: [],
        badge: 'Photo',
        image: '/assets/services/icon-specialty-photo-session.png',
        sla: '',
        acceptance: '',
        minTerm: 0
      },
      {
        key: 'ugc-view-boosts',
        name: 'UGC View Boosts',
        outcome: 'Guaranteed local views from our Gulf Coast creator network. Pay per boost, stack as needed.',
        price: { oneTime: 150, monthly: 0 },
        priceDisplay: '$150 – $1,250',
        priceNote: 'per boost',
        deliverables: [
          '$150 → +10,000 views',
          '$350 → +25,000 views',
          '$650 → +50,000 views',
          '$1,250 → +100,000 views'
        ],
        badge: 'Distribution',
        image: '/assets/services/icon-specialty-ugc-boost.png',
        sla: '',
        acceptance: '',
        minTerm: 0
      },
      {
        key: 'brand-video-production',
        name: 'Brand Video Production',
        outcome: 'Story-driven brand film built around your business. Founder story, product showcase, mission piece.',
        price: { oneTime: 1500, monthly: 0 },
        priceDisplay: 'Custom scope',
        priceNote: 'typical range $1,500 to $5,000+',
        deliverables: [],
        badge: 'Video',
        image: '/assets/services/icon-specialty-brand-video.png',
        sla: '',
        acceptance: '',
        minTerm: 0
      },
      {
        key: 'event-coverage',
        name: 'Event Coverage',
        outcome: 'Full event capture: highlight reel, social cutdowns, photos, and recap content for grand openings, conferences, fundraisers, or community events.',
        price: { oneTime: 1500, monthly: 0 },
        priceDisplay: 'Custom scope',
        priceNote: 'typical range $1,500 to $4,500',
        deliverables: [],
        badge: 'Event',
        image: '/assets/services/icon-specialty-event-coverage.png',
        sla: '',
        acceptance: '',
        minTerm: 0
      },
      {
        key: 'commercial-promo-video',
        name: 'Commercial / Promo Video',
        outcome: 'Polished 30 to 90 second commercial or promotional spot built for social ads, web, or broadcast.',
        price: { oneTime: 2500, monthly: 0 },
        priceDisplay: 'Custom scope',
        priceNote: 'typical range $2,500 to $7,500+',
        deliverables: [],
        badge: 'Commercial',
        image: '/assets/services/icon-specialty-commercial.png',
        sla: '',
        acceptance: '',
        minTerm: 0
      },
      {
        key: 'property-showcase-video',
        name: 'Property Showcase (Listing) Video',
        outcome: 'Professional listing walkthrough with cinematic camera work, drone, and edited cutdowns for MLS, IG, and TikTok.',
        price: { oneTime: 750, monthly: 0 },
        priceDisplay: 'From $750',
        priceNote: 'per listing',
        deliverables: [],
        badge: 'Real Estate',
        image: '/assets/services/icon-specialty-property-video.png',
        sla: '',
        acceptance: '',
        minTerm: 0
      },
      {
        key: 'luxury-listing-real-estate',
        name: 'Luxury Listing & Real Estate Content',
        outcome: 'Premium photo + video package for high-end listings: cinematic walkthrough, twilight exteriors, drone, lifestyle shots, social cutdowns.',
        price: { oneTime: 2500, monthly: 0 },
        priceDisplay: 'From $2,500',
        priceNote: 'per listing',
        deliverables: [],
        badge: 'Luxury',
        image: '/assets/services/icon-specialty-luxury-listing.png',
        sla: '',
        acceptance: '',
        minTerm: 0
      },
      {
        key: 'development-community-promo',
        name: 'Development & Community Promo Video',
        outcome: 'Big-vision promo for new developments, master-planned communities, mixed-use projects, or tourism / destination campaigns.',
        price: { oneTime: 5000, monthly: 0 },
        priceDisplay: 'Custom scope',
        priceNote: 'typical range $5,000 to $15,000+',
        deliverables: [],
        badge: 'Development',
        image: '/assets/services/icon-specialty-community-promo.png',
        sla: '',
        acceptance: '',
        minTerm: 0
      }
    ]
  }
};

function ensureRequiredCategories() {
  try {
    initializeServicesFile();
    const raw = fs.readFileSync(SERVICES_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!data.serviceCategories || typeof data.serviceCategories !== 'object') {
      data.serviceCategories = {};
    }
    if (!Array.isArray(data.addons)) data.addons = [];

    let changed = false;
    for (const [key, template] of Object.entries(REQUIRED_CATEGORY_TEMPLATES)) {
      const existing = data.serviceCategories[key];
      if (!existing) {
        // Brand-new category: insert the whole template.
        data.serviceCategories[key] = JSON.parse(JSON.stringify(template));
        changed = true;
        console.log(`✅ Seeded missing required category: ${key}`);
        continue;
      }

      // Category exists. Additively sync any new template services that aren't in
      // the stored data yet (matched by service.key). Never overwrites or removes
      // existing services — Blake's edits and ordering are preserved.
      if (!Array.isArray(existing.services)) existing.services = [];
      const existingByKey = new Map();
      for (const svc of existing.services) {
        if (svc && svc.key) existingByKey.set(svc.key, svc);
      }
      for (const templateSvc of (template.services || [])) {
        if (!templateSvc || !templateSvc.key) continue;
        const existingSvc = existingByKey.get(templateSvc.key);
        if (!existingSvc) {
          existing.services.push(JSON.parse(JSON.stringify(templateSvc)));
          changed = true;
          console.log(`✅ Added new service to ${key}: ${templateSvc.key}`);
          continue;
        }
        // Backfill the image field if it's empty AND the template provides one.
        // Never overwrites a non-empty image (preserves Blake's manual uploads).
        if ((!existingSvc.image || existingSvc.image === '') && templateSvc.image) {
          existingSvc.image = templateSvc.image;
          changed = true;
          console.log(`🖼  Backfilled image for ${key}/${templateSvc.key}: ${templateSvc.image}`);
        }
      }
    }

    if (changed) {
      fs.writeFileSync(SERVICES_FILE, JSON.stringify(data, null, 2));
      console.log('✅ services-data.json updated with required categories / services');
    }
  } catch (err) {
    console.error('❌ ensureRequiredCategories failed:', err);
  }
}

// Helper function to get date range based on selection
function getDateRange(range) {
  const endDate = new Date();
  const startDate = new Date();
  
  switch (range) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - startDate.getDay());
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'month':
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case '28days':
    default:
      startDate.setDate(startDate.getDate() - 28);
      break;
  }
  
  return { startDate, endDate };
}

// Helper function to generate mock data based on date range
function generateMockData(range) {
  const { startDate, endDate } = getDateRange(range);
  const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  
  return {
    totalUsers: Math.floor(Math.random() * 1000) + 500,
    totalSessions: Math.floor(Math.random() * 2000) + 1000,
    totalPageViews: Math.floor(Math.random() * 5000) + 2500,
    bounceRate: Math.floor(Math.random() * 30) + 40,
    avgSessionDuration: Math.floor(Math.random() * 120) + 60,
    timeseries: Array.from({ length: daysDiff }, (_, i) => ({
      date: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      totalUsers: Math.floor(Math.random() * 1000) + 20,
      totalSessions: Math.floor(Math.random() * 150) + 30,
      totalPageViews: Math.floor(Math.random() * 300) + 60
    })),
    topPages: [
      { path: '/', views: Math.floor(Math.random() * 500) + 200 },
      { path: '/growth-machine', views: Math.floor(Math.random() * 300) + 150 },
      { path: '/admin', views: Math.floor(Math.random() * 100) + 50 },
      { path: '/content-manager', views: Math.floor(Math.random() * 100) + 30 }
    ],
    topSources: [
      { source: 'Direct', sessions: Math.floor(Math.random() * 400) + 200 },
      { source: 'Google', sessions: Math.floor(Math.random() * 300) + 150 },
      { source: 'Social Media', sessions: Math.floor(Math.random() * 200) + 100 },
      { source: 'Referral', sessions: Math.floor(Math.random() * 150) + 75 }
    ]
  };
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

    // Strict schema validation
    if (
      !services ||
      typeof services !== 'object' ||
      !services.serviceCategories ||
      typeof services.serviceCategories !== 'object' ||
      !Array.isArray(services.addons)
    ) {
      return res.status(400).json({ error: 'Invalid services schema' });
    }

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

// Upload an image (admin auth required). Accepts multipart/form-data with field "file".
// Returns { success, url } where url is a /uploads/<filename> path ready to paste into
// any image field (services, packages, add-ons, specialty projects).
app.post('/api/upload', requireAuth, (req, res) => {
  uploadMiddleware.single('file')(req, res, (err) => {
    if (err) {
      console.error('❌ Upload failed:', err.message);
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file received' });
    }
    const url = `/uploads/${req.file.filename}`;
    console.log(`✅ Uploaded image: ${req.file.filename} (${req.file.size} bytes)`);
    res.json({
      success: true,
      url,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  });
});

// List uploaded images (admin auth required). Lets the admin UI show a gallery / picker.
app.get('/api/uploads', requireAuth, (req, res) => {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) return res.json({ files: [] });
    const entries = fs.readdirSync(UPLOAD_DIR)
      .filter((name) => !name.startsWith('.'))
      .map((name) => {
        const stat = fs.statSync(path.join(UPLOAD_DIR, name));
        return { filename: name, url: `/uploads/${name}`, size: stat.size, uploadedAt: stat.mtimeMs };
      })
      .sort((a, b) => b.uploadedAt - a.uploadedAt);
    res.json({ files: entries });
  } catch (err) {
    console.error('❌ Failed to list uploads:', err);
    res.status(500).json({ error: 'Failed to list uploads' });
  }
});

// Delete an uploaded image (admin auth required).
app.delete('/api/uploads/:filename', requireAuth, (req, res) => {
  try {
    const filename = path.basename(req.params.filename); // strip any path traversal
    const filePath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
    fs.unlinkSync(filePath);
    console.log(`🗑  Deleted upload: ${filename}`);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Failed to delete upload:', err);
    res.status(500).json({ error: 'Failed to delete upload' });
  }
});

// Serve uploaded files publicly under /uploads/*
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '7d',
  fallthrough: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  }
}));

// Google Analytics 4 Analytics Endpoints
app.get('/api/analytics/realtime', async (req, res) => {
  try {
    // Get date range from query parameters
    const dateRange = req.query.range || '28days';
    
    console.log('🔍 GA4 Realtime Request - Checking credentials...');
    console.log('📧 GA4_CLIENT_EMAIL:', GA4_CLIENT_EMAIL);
    console.log('🏗️ GA4_PROJECT_ID:', GA4_PROJECT_ID);
    console.log('📁 GA4_CREDENTIALS_FILE:', GA4_CREDENTIALS_FILE);
    console.log('📅 Date Range:', dateRange);
    
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

    // Get real-time data - Fixed dimensions & metrics compatibility
    const response = await analyticsData.properties.runRealtimeReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      requestBody: {
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
    // Get date range from query parameters
    const dateRange = req.query.range || '28days';
    
    if (!GA4_CLIENT_EMAIL || !GA4_PROJECT_ID) {
      // Return mock data if GA4 credentials not configured
      const mockData = generateMockData(dateRange);
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

    // Get date range based on parameter
    const { startDate, endDate } = getDateRange(dateRange);

    // Get summary data
    // Get summary data - Fixed dimensions & metrics compatibility
    const response = await analyticsData.properties.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      requestBody: {
        dateRanges: [{
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' }
        ]
      }
    });

    // Process the response data
    const result = response.data;
    
    // Extract basic metrics
    const totalUsers = result.rows?.[0]?.metricValues?.[0]?.value || 0;
    const totalSessions = result.rows?.[0]?.metricValues?.[1]?.value || 0;
    const totalPageViews = result.rows?.[0]?.metricValues?.[2]?.value || 0;

    res.json({
      totalUsers: parseInt(totalUsers),
      totalSessions: parseInt(totalSessions),
      totalPageViews: parseInt(totalPageViews),
      bounceRate: 45, // Default value since bounceRate requires different dimensions
      avgSessionDuration: 120, // Default value since averageSessionDuration requires different dimensions
      timeseries: Array.from({ length: 28 }, (_, i) => ({
        date: new Date(Date.now() - (27 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        totalUsers: Math.floor(parseInt(totalUsers) / 28) + Math.floor(Math.random() * 20),
        totalSessions: Math.floor(parseInt(totalSessions) / 28) + Math.floor(Math.random() * 30),
        totalPageViews: Math.floor(parseInt(totalPageViews) / 28) + Math.floor(Math.random() * 40)
      })),
      topPages: [
        { path: '/', views: Math.floor(parseInt(totalPageViews) * 0.4) },
        { path: '/growth-machine', views: Math.floor(parseInt(totalPageViews) * 0.3) },
        { path: '/admin', views: Math.floor(parseInt(totalPageViews) * 0.1) },
        { path: '/content-manager', views: Math.floor(parseInt(totalPageViews) * 0.1) }
      ],
      topSources: [
        { source: 'Direct', sessions: Math.floor(parseInt(totalSessions) * 0.5) },
        { source: 'Google', sessions: Math.floor(parseInt(totalSessions) * 0.3) },
        { source: 'Social Media', sessions: Math.floor(parseInt(totalSessions) * 0.15) },
        { source: 'Referral', sessions: Math.floor(parseInt(totalSessions) * 0.05) }
      ]
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

// Protected, non-mutating session check
app.get('/api/admin/session', requireAuth, (req, res) => {
  res.json({ success: true });
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
// Legacy /growth-machine redirects to /services (the Growth Machine package section)
app.get('/growth-machine', (req, res) => {
  res.redirect(301, '/services#pkg-growth-machine');
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

// NEW: Enterprise Solutions clean URL
app.get('/enterprise-solutions', (req, res) => {
  const enterpriseSolutionsPath = path.join(__dirname, '..', 'enterprise-solutions.html');
  if (fs.existsSync(enterpriseSolutionsPath)) {
    res.sendFile(enterpriseSolutionsPath);
  } else {
    res.status(404).json({ error: 'Enterprise Solutions page not found' });
  }
});

// NEW: Services clean URL
app.get('/services', (req, res) => {
  const servicesPath = path.join(__dirname, '..', 'services.html');
  if (fs.existsSync(servicesPath)) {
    res.sendFile(servicesPath);
  } else {
    res.status(404).json({ error: 'Services page not found' });
  }
});

// NEW: Compare Offers clean URL
app.get('/offer-comparison', (req, res) => {
  const comparePath = path.join(__dirname, '..', 'offer-comparison.html');
  if (fs.existsSync(comparePath)) {
    res.sendFile(comparePath);
  } else {
    res.status(404).json({ error: 'Offer Comparison page not found' });
  }
});

// Alias route for convenience
app.get('/compare-offers', (req, res) => {
  res.redirect(301, '/offer-comparison');
});

// Legacy /growth-machine.html redirects to /services (the Growth Machine package section)
app.get('/growth-machine.html', (req, res) => {
  res.redirect(301, '/services#pkg-growth-machine');
});

// Specific route for services.html (fallback)
app.get('/services.html', (req, res) => {
  const servicesPath = path.join(__dirname, '..', 'services.html');
  if (fs.existsSync(servicesPath)) {
    res.sendFile(servicesPath);
  } else {
    res.status(404).json({ 
      error: 'services.html not found',
      path: servicesPath,
      exists: fs.existsSync(servicesPath)
    });
  }
});

// Specific route for offer-comparison.html (fallback)
app.get('/offer-comparison.html', (req, res) => {
  const comparePath = path.join(__dirname, '..', 'offer-comparison.html');
  if (fs.existsSync(comparePath)) {
    res.sendFile(comparePath);
  } else {
    res.status(404).json({
      error: 'offer-comparison.html not found',
      path: comparePath,
      exists: fs.existsSync(comparePath)
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

// Initialize the services file and seed required categories when server starts
initializeServicesFile();
ensureRequiredCategories();

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
  console.log(`🧭 Services: http://localhost:${PORT}/services`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('Press Ctrl+C to stop the server');
});
