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
const nodemailer = require('nodemailer');

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
  // SAMEORIGIN (not DENY) so we can embed our own pages in iframes. e.g. the
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
// categories. never overwrites existing ones. so Blake's edits are preserved
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
        priceDisplay: '$500. $1,500',
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
        priceDisplay: '$1,500. $3,500',
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
        priceDisplay: '$150. $1,250',
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
      // existing services. Blake's edits and ordering are preserved.
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

/* ============================================================
   FUNNEL SUBMISSIONS ─ /api/funnel-submit

   The diagnostic funnel at /funnel POSTs the full Q&A payload
   here when the visitor reaches the solution page. We send two
   emails via Gmail SMTP:

   1. Notification to Blake (FUNNEL_NOTIFY_TO, defaults to GMAIL_USER)
      with the full answer dump, lead temperature, recommended
      package, and contact info.

   2. Path-specific auto-reply to the prospect (only if they
      provided an email). Reads as a personal note, not an
      automated form receipt.

   Required env vars:
     GMAIL_USER          ─ Gmail address that auths the SMTP send
     GMAIL_APP_PASSWORD  ─ 16-char Google App Password (not the
                           regular account password)

   Optional env vars:
     FUNNEL_NOTIFY_TO    ─ Where Blake's notifications go
                           (defaults to GMAIL_USER)
     FUNNEL_FROM_NAME    ─ Display name on outgoing email
                           (defaults to "1Coast Funnel")
   ============================================================ */

// Lazily build the SMTP transport on first use so the server still
// boots cleanly when the funnel env vars aren't set yet.
let _funnelMailer = null;
function getFunnelMailer() {
  if (_funnelMailer) return _funnelMailer;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  _funnelMailer = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
  return _funnelMailer;
}

/* ============================================================
   BRANDED EMAIL TEMPLATE

   Wraps a plain-text body in a 1Coast-branded HTML email shell.
   Designed dark-on-dark (charcoal background, cream text, gold
   accents) so dark-mode email clients (Apple Mail, Gmail mobile,
   Outlook dark) don't aggressively invert the colors and break
   the layout. Light-mode clients see the intentional dark email,
   which matches the site brand.

   - Charcoal #1f1f22 background (matches the site)
   - Cream #f4ecdc body text
   - Gold #c8a96b accents
   - Charcoal lockup logo (cream content on dark, blends seamlessly)
   - Inline styles only (email clients strip <style> blocks)
   - Table-based outer layout for Outlook compatibility
   - Mobile-first: max-width 100%, responsive padding via VW

   Usage:
     wrapEmailHtml({
       preheader: 'A short preview line shown in the inbox',
       body: 'Plain-text body. Newlines become <br>. Blank lines split paragraphs.'
     })
   ============================================================ */
const SITE_URL  = process.env.PUBLIC_SITE_URL || 'https://1coastmedia.com';
const LOGO_URL  = `${SITE_URL}/assets/1coast-lockup-charcoal-2x.png`;

// Email theme tokens. Centralized so they're easy to tune in one spot.
const EMAIL_BG       = '#1a1a1c';   // page background (slightly darker than card)
const EMAIL_CARD     = '#1f1f22';   // card surface (matches site charcoal)
const EMAIL_TEXT     = '#e6e1d3';   // primary cream text
const EMAIL_MUTED    = '#9a9483';   // muted gray-cream for secondary lines
const EMAIL_GOLD     = '#c8a96b';   // accent gold (links, eyebrow, brand)
const EMAIL_GOLD_DIM = '#8d7444';   // slightly muted gold for visited / dim

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Convert a plain-text body into HTML paragraphs. Blank lines split
// paragraphs; single newlines become <br>. Auto-link URLs.
function bodyToHtml(text) {
  const escaped = escapeHtml(text);
  const linked  = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    `<a href="$1" style="color:${EMAIL_GOLD};text-decoration:underline;text-underline-offset:3px;">$1</a>`
  );
  return linked
    .split(/\n\s*\n/)
    .map(p => `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:${EMAIL_TEXT};">${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function wrapEmailHtml({ preheader = '', body = '' } = {}) {
  const bodyHtml = bodyToHtml(body);
  const pre = preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>1Coast Media</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_BG};font-family:Georgia,'Times New Roman',serif;color:${EMAIL_TEXT};-webkit-font-smoothing:antialiased;">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${EMAIL_BG};padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${EMAIL_CARD};border:1px solid rgba(200,169,107,0.18);border-radius:16px;overflow:hidden;">

        <!-- Header: lockup -->
        <tr>
          <td align="center" style="padding:34px 28px 18px;background:${EMAIL_CARD};">
            <a href="${SITE_URL}" style="text-decoration:none;display:inline-block;">
              <img src="${LOGO_URL}" alt="1Coast Media" width="220" style="display:block;width:220px;max-width:70%;height:auto;border:0;outline:none;" />
            </a>
          </td>
        </tr>

        <!-- Gold accent line -->
        <tr>
          <td style="padding:0 28px 18px;background:${EMAIL_CARD};">
            <div style="height:1px;background:linear-gradient(90deg,transparent,${EMAIL_GOLD} 30%,${EMAIL_GOLD} 70%,transparent);line-height:1px;font-size:1px;">&nbsp;</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:8px 28px 28px;background:${EMAIL_CARD};font-family:Georgia,'Times New Roman',serif;color:${EMAIL_TEXT};">
            ${bodyHtml}
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:0 28px;background:${EMAIL_CARD};">
            <div style="height:1px;background:rgba(200,169,107,0.18);line-height:1px;font-size:1px;">&nbsp;</div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:22px 28px 28px;background:${EMAIL_CARD};color:${EMAIL_MUTED};font-family:'Inter','Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.6;">
            <div style="font-family:'Inter','Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:${EMAIL_GOLD};margin-bottom:10px;">1Coast Media</div>
            <div style="color:${EMAIL_TEXT};font-weight:600;">Blake Daniels &middot; Founder</div>
            <div style="color:${EMAIL_MUTED};margin-top:2px;">Built on the Mississippi Gulf Coast</div>
            <div style="margin-top:14px;font-size:13px;line-height:1.7;">
              <a href="tel:+12283578505" style="color:${EMAIL_TEXT};text-decoration:none;">(228) 357-8505</a>
              <span style="color:${EMAIL_MUTED};margin:0 6px;">&middot;</span>
              <a href="sms:+12283578505" style="color:${EMAIL_GOLD};text-decoration:none;">Text Blake direct</a>
              <span style="color:${EMAIL_MUTED};margin:0 6px;">&middot;</span>
              <a href="${SITE_URL}" style="color:${EMAIL_GOLD};text-decoration:none;">1coastmedia.com</a>
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// Pretty-print the answers payload for the Blake notification email.
// Skips the raw `path` and `diagnostic` keys since they're already
// surfaced higher up. Multi-select arrays render as comma lists.
function formatAnswersForEmail(answers) {
  if (!answers || typeof answers !== 'object') return '(none)';
  const skip = new Set(['path', 'diagnostic', 'contact']);
  const lines = [];
  for (const [k, v] of Object.entries(answers)) {
    if (skip.has(k) || v == null || v === '') continue;
    const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
    const value = Array.isArray(v) ? v.join(', ') : String(v);
    lines.push(`${label}: ${value}`);
  }
  return lines.length ? lines.join('\n') : '(no answers)';
}

const PATH_LABELS = {
  '1': "Marketing isn't bringing in business",
  '2': "Drowning trying to do it all themselves",
  '3': "Specific project they need handled",
  '4': "Ready to scale, needs a real team",
  '5': "Just looking around",
  '6': "Building a personal brand"
};

// Path-specific auto-reply templates. Each one opens with a question
// tied to what the prospect just said so the message reads personal,
// not automated. From the funnel spec.
function autoReplyBody(path, contactName) {
  const greet = contactName ? `Hey ${contactName.split(' ')[0]},` : 'Hey there,';
  const sig   = '\n\nBlake\n1Coast Media\n(228) 357-8505';
  const bodies = {
    '1': `${greet}\n\nSaw your fit check come through. Quick one before we talk: when you said marketing isn't bringing in business, are you running any ads right now or is it all organic?\n\nReply to this email or text me at (228) 357-8505. I'll get back to you within the hour.${sig}`,
    '2': `${greet}\n\nGot your fit check. Real quick: what's eating the most of your time today? Want to make sure we lead with the right thing on the call.\n\nReply to this email or text me at (228) 357-8505.${sig}`,
    '3': `${greet}\n\nGot the project details. Before I send a quote, one question: is there a hard deadline tied to this, or is the timeline you gave me your ideal?\n\nReply to this email or text me at (228) 357-8505. I'll have a quote back within 24 hours.${sig}`,
    '4': `${greet}\n\nSaw your fit check come through. Before we get on a call, what does dominating the market look like to you specifically? Helps me come prepared with the right plan.\n\nReply to this email or text me at (228) 357-8505.${sig}`,
    '5': `${greet}\n\nAppreciate you taking the time to fill that out. No pitch from me. If anything specific comes up later, you have my number: (228) 357-8505.\n\nIn the meantime, here's a free resource you might actually use:\n\nThe Integrated Business Growth Playbook\nhttps://1coastmedia.com/playbook\n\nIt's the same framework we use with every client. No opt-in, no upsell. Just the system, written down.${sig}`,
    '6': `${greet}\n\nSaw your fit check come through. Personal brand work is the work I love most, so I want to get this right. One question before we talk: who already follows you or knows your work, even a little, that we'd be building on?\n\nReply to this email or text me at (228) 357-8505. Building a brand around a real person is a trust thing, and I'd rather start with a real conversation than a pitch.${sig}`
  };
  return bodies[path] || bodies['5'];
}

const SUBJECT_BY_PATH = {
  '1': 'Quick question on your marketing',
  '2': 'Quick question before we talk',
  '3': 'On your project',
  '4': 'Before our call',
  '5': 'Thanks for stopping by 1Coast Media',
  '6': 'About building your brand'
};

app.post('/api/funnel-submit', async (req, res) => {
  try {
    const payload = req.body || {};
    const { path: funnelPath, temperature, recommendedPackage, answers, contact, submittedAt, userAgent } = payload;

    // Build the notification email body for Blake
    const tempLabel = temperature || 'unscored';
    const pathLabel = PATH_LABELS[funnelPath] || `Path ${funnelPath || '?'}`;
    const contactBlock = contact && (contact.name || contact.email || contact.phone)
      ? `Name:  ${contact.name || '(not given)'}\nEmail: ${contact.email || '(not given)'}\nPhone: ${contact.phone || '(not given)'}`
      : '(no contact info provided)';
    const answersBlock = formatAnswersForEmail(answers);
    const recBlock = recommendedPackage ? `Recommended package: ${recommendedPackage}` : '';

    const blakeBody = [
      `New funnel submission. ${tempLabel} lead`,
      '',
      `Path: ${pathLabel}`,
      recBlock,
      '',
      '--- Contact ---',
      contactBlock,
      '',
      '--- Answers ---',
      answersBlock,
      '',
      '--- Meta ---',
      `Submitted: ${submittedAt || new Date().toISOString()}`,
      `User-Agent: ${userAgent || '(unknown)'}`
    ].filter(Boolean).join('\n');

    const blakeSubject = `[${tempLabel}] Funnel: ${contact?.name || pathLabel}`;

    const mailer = getFunnelMailer();
    if (!mailer) {
      console.error('[funnel] GMAIL_USER / GMAIL_APP_PASSWORD not set. cannot send notification');
      return res.status(503).json({ ok: false, error: 'mail-transport-unavailable' });
    }

    const fromName = process.env.FUNNEL_FROM_NAME || '1Coast Funnel';
    const notifyTo = process.env.FUNNEL_NOTIFY_TO || process.env.GMAIL_USER;
    const fromAddr = `"${fromName}" <${process.env.GMAIL_USER}>`;

    // 1) Send Blake the notification
    await mailer.sendMail({
      from: fromAddr,
      to: notifyTo,
      // Reply-to is the prospect when they gave one, so Blake can hit
      // reply and the email goes to the prospect, not back to himself.
      replyTo: contact?.email || undefined,
      subject: blakeSubject,
      text: blakeBody,
      html: wrapEmailHtml({
        preheader: `${tempLabel} lead from the funnel.`,
        body: blakeBody
      })
    });

    // 2) Send the prospect a path-specific auto-reply (only if they
    // gave an email). Don't fail the request if this errors. Blake
    // already has the lead.
    if (contact?.email) {
      try {
        const autoText = autoReplyBody(funnelPath, contact.name);
        await mailer.sendMail({
          from: `"Blake Daniels" <${process.env.GMAIL_USER}>`,
          to: contact.email,
          replyTo: process.env.GMAIL_USER,
          subject: SUBJECT_BY_PATH[funnelPath] || 'Thanks for your fit check',
          text: autoText,
          html: wrapEmailHtml({
            preheader: SUBJECT_BY_PATH[funnelPath] || 'Thanks for your fit check',
            body: autoText
          })
        });
      } catch (autoErr) {
        console.warn('[funnel] auto-reply send failed (non-fatal):', autoErr.message);
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[funnel] submission failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/* ============================================================
   PLAYBOOK SIGNUPS ─ /api/playbook-signup

   Every chapter of /playbook has an inline form (name="email")
   that POSTs URL-encoded form data here. Forms use no-cors mode
   to avoid CORS preflight, so the response body is ignored ─
   we just need a 2xx for the connection to close cleanly.

   Two emails per signup:
   1. Notification to Blake with the chapter source, optional
      assessment scores, and metadata.
   2. Personal-feeling thank-you to the prospect with the
      playbook URL and an invite to text Blake direct.
   ============================================================ */

// Body parser for URL-encoded form posts (the playbook uses
// URLSearchParams which sends application/x-www-form-urlencoded).
// JSON body parser is already mounted globally; this just adds the
// urlencoded one alongside it.
app.use('/api/playbook-signup', express.urlencoded({ extended: false }));

app.post('/api/playbook-signup', async (req, res) => {
  try {
    const p = req.body || {};
    const email = (p.email || '').trim();
    if (!email || !/.+@.+\..+/.test(email)) {
      return res.status(400).send('invalid email');
    }

    const source       = p.source || 'Unknown chapter';
    const phone        = (p.phone || '').trim();
    const kitInterest  = p.kit_interest === 'yes';
    const pageUrl      = p.page_url || '';
    const submittedAt  = p.timestamp_iso || new Date().toISOString();
    const userAgent    = p.user_agent || '';
    const weakest      = p.weakest_pillars || '';
    const suggested    = p.suggested_reading || '';

    // Universal next-step instruction. The chapter source tells Blake what
    // the prospect was thinking about; his job is to open a conversation,
    // not deliver a pre-built asset he doesn't have. When he builds out
    // chapter-specific resources later, swap this for a lookup table.
    function nextStepFor(src) {
      // Window length scales with how late in the playbook they signed up.
      // Cover / Part 01 / Closing = 24h. Mid-book chapters = 48h. Late chapters = 72h.
      const s = (src || '').toLowerCase();
      let when = 'Within 48 hours.';
      if (s.includes('cover') || s.includes('self-assess') || s.includes('part 01') || s.includes('foundation') || s.includes('closing') || s.includes('stay in touch')) {
        when = 'Within 24 hours.';
      } else if (s.includes('part 06') || s.includes('integration') || s.includes('part 07') || s.includes('part 08') || s.includes('roadmap') || s.includes(' ai')) {
        when = 'Within 72 hours.';
      }
      return {
        when,
        send: `Reach out personally. A 2-3 sentence note acknowledging the chapter they read and one specific question about their business. Don't pitch. Don't send a template you don't have. The reply (if any) tells you what to send next.`
      };
    }

    const next = nextStepFor(source);

    // Urgency hint based on signals: phone given OR kit interest = HIGH,
    // assessment submitted = MEDIUM, otherwise NORMAL.
    let urgency = 'NORMAL';
    if (phone || kitInterest) urgency = 'HIGH (gave phone or wants the kit)';
    else if (weakest) urgency = 'MEDIUM (filled assessment)';

    const blakeBody = [
      `=========================================`,
      `  NEW PLAYBOOK SIGNUP. ${urgency}`,
      `=========================================`,
      '',
      `WHO:   ${email}`,
      `WHERE: ${source}`,
      phone ? `PHONE: ${phone}` : null,
      '',
      `>>> NEXT STEP. ${next.when}`,
      `    ${next.send}`,
      '',
      kitInterest  ? `[!] KIT INTEREST: They want the printed kit. Reply with details on how they get it.` : null,
      weakest      ? `[*] Their weakest pillars (from the assessment): ${weakest}` : null,
      suggested    ? `[*] Playbook suggested they read next: ${suggested}` : null,
      '',
      '--- Lead context ---',
      `Page URL:    ${pageUrl}`,
      `Submitted:   ${submittedAt}`,
      `User agent:  ${userAgent}`,
      '',
      `(Hit reply to email them directly. Reply-To header is set to their address.)`
    ].filter(Boolean).join('\n');

    const mailer = getFunnelMailer();
    if (!mailer) {
      console.error('[playbook] GMAIL_USER / GMAIL_APP_PASSWORD not set');
      // Still return 200 so the form UI doesn't appear broken to the visitor.
      // Blake just won't get the notification, which we'll log loudly.
      return res.status(200).send('ok-no-mail');
    }

    const fromName = process.env.FUNNEL_FROM_NAME || '1Coast Playbook';
    const notifyTo = process.env.FUNNEL_NOTIFY_TO || process.env.GMAIL_USER;
    const fromAddr = `"${fromName}" <${process.env.GMAIL_USER}>`;

    // 1) Notification to Blake
    await mailer.sendMail({
      from: fromAddr,
      to: notifyTo,
      replyTo: email, // hitting reply goes to the prospect, not back to Blake
      subject: `[Playbook] ${email} (${source})`,
      text: blakeBody,
      html: wrapEmailHtml({
        preheader: `New playbook signup from ${source}.`,
        body: blakeBody
      })
    });

    // 2) Thank-you to the prospect (non-fatal if it errors).
    // Signature lives in the email footer template, so the body skips
    // the redundant Blake / 1Coast Media / phone block at the bottom.
    try {
      const thanksBody = [
        `Hey,`,
        '',
        `Thanks for checking out the playbook. The full version stays right here whenever you want to come back to it:`,
        '',
        `https://1coastmedia.com/playbook`,
        '',
        `It's the same framework we use with every client. Twelve months, five phases, one system. No upsells, no opt-out sequence to manage, just the playbook.`,
        '',
        `If you want to talk about how any of it actually applies to your business, text me at (228) 357-8505 or hit reply.`,
        '',
        `Blake`
      ].join('\n');

      await mailer.sendMail({
        from: `"Blake Daniels" <${process.env.GMAIL_USER}>`,
        to: email,
        replyTo: process.env.GMAIL_USER,
        subject: 'Thanks for checking out the playbook',
        text: thanksBody,
        html: wrapEmailHtml({
          preheader: 'The playbook stays here whenever you want to come back to it.',
          body: thanksBody
        })
      });
    } catch (thanksErr) {
      console.warn('[playbook] thank-you send failed (non-fatal):', thanksErr.message);
    }

    return res.status(200).send('ok');
  } catch (err) {
    console.error('[playbook] signup failed:', err);
    // Return 200 even on internal error so the form UI doesn't break for
    // the visitor. The error is logged for Blake to see in Render logs.
    return res.status(200).send('ok-error-logged');
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
// Legacy /growth-machine routes (kept as 301 for any old links / SEO).
// Strategic shift: pricing is now private, so these legacy URLs should
// land on the new public services overview instead of the private packages page.
app.get('/growth-machine', (req, res) => {
  res.redirect(301, '/services');
});

// /about-us serves the current homepage content. Phase 2 will introduce a
// dedicated funnel at /, at which point this alias is no longer needed and
// about-us.html should become its own real file.
app.get('/about-us', (req, res) => {
  const aboutPath = path.join(__dirname, '..', 'about-us.html');
  const fallback  = path.join(__dirname, '..', 'index.html');
  if (fs.existsSync(aboutPath)) {
    res.sendFile(aboutPath);
  } else if (fs.existsSync(fallback)) {
    res.sendFile(fallback);
  } else {
    res.status(404).json({ error: 'about-us page not found' });
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

/* ============================================================
   /scope — internal pricing tool, gated by an env-var passcode.

   Set SCOPE_ACCESS_CODE in the environment (Render dashboard). Falls
   back to "1coast" if unset so the tool still works out of the box,
   but set it for real privacy. The calculator HTML is only served to
   authenticated requests, so the pricing logic never appears in public
   page source. Changing SCOPE_ACCESS_CODE logs everyone out.
   ============================================================ */
function scopeCode()  { return process.env.SCOPE_ACCESS_CODE || '1coast'; }
function scopeToken() { return crypto.createHash('sha256').update('1cm-scope::' + scopeCode()).digest('hex'); }
function scopeAuthed(req) { return req.cookies && req.cookies.scope_auth === scopeToken(); }
function scopeLoginPage(error) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Internal · 1Coast Media</title>
<link rel="icon" type="image/png" href="/assets/1coast-seal-cream-2x.png">
<link rel="stylesheet" href="/assets/boring.css">
<style>body{display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;margin:0}
.c{max-width:380px;width:100%;text-align:center}.c img{height:40px;width:auto;margin:0 auto 24px;display:block}
.c h2{font-size:22px;font-weight:700;margin:0 0 6px}.c p{color:var(--text-muted);font-size:14px;margin:0 0 20px}
.c input{width:100%;padding:14px 16px;border-radius:12px;box-sizing:border-box;background:#141414;border:1.5px solid var(--border-strong);color:var(--text);font-size:16px;text-align:center;letter-spacing:.1em;font-family:inherit}
.c input:focus{outline:none;border-color:var(--accent-warm)}.c button{margin-top:12px;width:100%}
.err{color:#ff8573;font-size:13px;margin-top:10px;min-height:18px}</style></head>
<body><div class="c"><img src="/assets/1coast-lockup-charcoal-2x.png" alt="1Coast Media">
<h2>Internal tool</h2><p>Scope &amp; pricing calculator. Enter the access code.</p>
<form method="POST" action="/api/scope-login">
<input type="password" name="code" placeholder="Access code" autocomplete="off" autofocus>
<div class="err">${error || ''}</div>
<button type="submit" class="btn btn-primary">Unlock</button></form></div></body></html>`;
}

app.post('/api/scope-login', express.urlencoded({ extended: false }), (req, res) => {
  const code = ((req.body && req.body.code) || '').trim();
  if (code && code.toLowerCase() === scopeCode().toLowerCase()) {
    res.cookie('scope_auth', scopeToken(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000   // 30 days
    });
    return res.redirect('/scope');
  }
  return res.status(401).send(scopeLoginPage('Wrong code.'));
});

app.post('/api/scope-logout', (req, res) => {
  res.clearCookie('scope_auth');
  res.redirect('/scope');
});

// Intercept both /scope and /scope.html so the static middleware can never
// serve the calculator file to an unauthenticated request.
app.get(['/scope', '/scope.html'], (req, res) => {
  if (!scopeAuthed(req)) return res.status(401).send(scopeLoginPage(''));
  const f = path.join(__dirname, '..', 'scope.html');
  if (fs.existsSync(f)) return res.sendFile(f);
  return res.status(404).json({ error: 'scope tool not found' });
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

// Serve static files from parent directory (root of project).
// extensions:['html'] lets /packages, /services, /offer-comparison, etc.
// resolve to their .html files without forcing the visitor to type the extension.
app.use(express.static(path.join(__dirname, '..'), { extensions: ['html'] }));

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
