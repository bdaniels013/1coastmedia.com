// 1CoastMedia Full Service Catalog (2025)
window.serviceData = {
  serviceCategories: {
    launches: {
      name: "🚀 Launches",
      description: "🚀 Launches (One-Time Projects) - Get your business off the ground with these proven, fast-delivery services",
      services: [
        {
          key: 'website-launch',
          name: 'Website Launch',
          outcome: 'A professional, mobile-friendly website that looks great, loads fast, and turns visitors into paying customers',
          deliverables: [
            'Up to 6 custom-designed pages (Home, About, Services/Products, Contact, etc.)',
            'Contact form or booking calendar that sends leads straight to your inbox',
            'Basic SEO so people can find you on Google',
            'Built-in analytics so you can see who\'s visiting your site',
            'Quick-edit guide so you can update text or photos anytime'
          ],
          price: { oneTime: 3500, monthly: 0 },
          sla: '7-10 business days',
          acceptance: 'Site works on phones and computers, contact form works, and all promised pages are published',
          badge: 'Fast Launch'
        },
        {
          key: 'funnel-launch',
          name: 'Funnel Launch (Lead Magnet + Nurture System)',
          outcome: 'A simple system that collects leads, delivers a freebie (guide, checklist, or quiz), and automatically follows up until they\'re ready to buy',
          deliverables: [
            'Lead magnet design (ebook, checklist, or quiz)',
            'Landing page with clear call-to-action',
            'Automated thank-you and delivery email',
            '5-part follow-up email series to warm leads',
            'Dashboard that shows how many leads you\'ve collected'
          ],
          price: { oneTime: 2500, monthly: 0 },
          sla: '5-7 business days',
          acceptance: 'Test leads flow correctly from form → email list → nurture sequence',
          badge: 'Lead Machine'
        },
        {
          key: 'automation-launch',
          name: 'Automation Launch',
          outcome: 'Replace manual tasks with automations so nothing falls through the cracks',
          deliverables: [
            'Automatic lead notifications to your phone or email',
            'Instant replies to new inquiries with FAQs answered by AI',
            'CRM setup so leads are organized and tagged automatically',
            'Integration between your website, email, and payment system'
          ],
          price: { oneTime: 2000, monthly: 0 },
          sla: '7-10 business days',
          acceptance: 'At least 5 test leads flow through the system without errors',
          badge: 'Efficiency Boost'
        },
        {
          key: 'ugc-launch',
          name: 'UGC Launch (Creator Content Pack)',
          outcome: 'A bank of authentic short videos from real people that you can post to TikTok, Instagram, and YouTube Shorts to get massive organic reach',
          deliverables: [
            '15 short-form videos created by vetted content creators',
            'Captions and hashtags written for each video',
            'A simple posting plan so you know when to post for best results',
            'Rights cleared for you to repost anywhere'
          ],
          price: { oneTime: 3000, monthly: 0 },
          sla: '14 days',
          acceptance: 'At least 15 edited, ready-to-post videos delivered in correct format',
          badge: 'Viral Ready'
        },
        {
          key: 'pr-launch',
          name: 'PR Launch',
          outcome: 'Get your business media-ready and start earning press coverage',
          deliverables: [
            'Professional press kit (bio, logo, product photos, company story)',
            '6 unique press angles to pitch',
            'Contact list of 30+ relevant local or industry media outlets',
            'First outreach email campaign sent to media',
            '1 media training session (how to answer questions confidently)'
          ],
          price: { oneTime: 4000, monthly: 0 },
          sla: '14 days',
          acceptance: 'Press kit complete and 30+ pitches sent',
          badge: 'Media Ready'
        },
        {
          key: 'event-launch',
          name: 'Event Launch',
          outcome: 'Everything you need to plan, promote, and execute a successful event',
          deliverables: [
            'Event concept and run-of-show plan',
            'Sponsor deck to secure funding or vendors',
            'Online ticketing/RSVP page with automated reminders',
            '3 custom graphics and 2 promo videos for social media',
            'On-site content capture plan for photos/videos'
          ],
          price: { oneTime: 3500, monthly: 0 },
          sla: '10-14 days',
          acceptance: 'Ticket page live and functional, sponsor deck ready, at least one promo posted',
          badge: 'Event Master'
        },
        {
          key: 'commercial-launch',
          name: 'Commercial Launch (Streaming-Ready Ad)',
          outcome: 'A high-quality 30–60 second commercial built for platforms like Hulu or Amazon Prime',
          deliverables: [
            'Concept, script, and storyboard',
            'Professional video shoot (crew, gear, location)',
            'Main 30–60 second ad + shorter cutdowns',
            'Licensed music, voiceover, and closed captions',
            'Ready-to-upload files for streaming platforms'
          ],
          price: { oneTime: 8000, monthly: 0 },
          sla: '21-30 days',
          acceptance: 'Final ad approved and ready for upload with no technical errors',
          badge: 'Premium Quality'
        }
      ]
    },
    engines: {
      name: "⚙️ Engines",
      description: "⚙️ Engines (Monthly Services) - Keep your business running smoothly with these ongoing, results-driven services",
      services: [
        {
          key: 'webcare-engine',
          name: 'WebCare Engine',
          outcome: 'Keep your website fast, secure, and converting visitors into customers',
          deliverables: [
            'Regular updates and security checks',
            '1 A/B test to improve conversion each month',
            'Small content/offer updates',
            'Monthly performance report (traffic, conversions, improvements)'
          ],
          price: { oneTime: 0, monthly: 500 },
          minTerm: '3 months',
          sla: 'Monthly report delivered; site uptime and form tracking verified',
          acceptance: 'Monthly report delivered; site uptime and form tracking verified',
          badge: 'Website Care'
        },
        {
          key: 'pipeline-engine',
          name: 'Pipeline Engine',
          outcome: 'Keep your calendar full with new leads and customers each month',
          deliverables: [
            '1 new lead-generation campaign (landing page + emails)',
            '2 new promotional offers/content pieces',
            'CRM cleanup and lead organization',
            'Dashboard tracking pipeline health'
          ],
          price: { oneTime: 0, monthly: 800 },
          minTerm: '3 months',
          sla: 'At least one new campaign live and pipeline report delivered monthly',
          acceptance: 'At least one new campaign live and pipeline report delivered monthly',
          badge: 'Lead Generator'
        },
        {
          key: 'automation-engine',
          name: 'Automation Engine',
          outcome: 'Keep your business running smoothly with continuous automation improvements',
          deliverables: [
            '1–3 new automations or system improvements',
            'Monitoring and fixing automation failures',
            'Quarterly audit of all workflows with recommendations'
          ],
          price: { oneTime: 0, monthly: 600 },
          minTerm: '3 months',
          sla: 'Automations tested monthly with error rate <2%',
          acceptance: 'Automations tested monthly with error rate <2%',
          badge: 'Efficiency Expert'
        },
        {
          key: 'ugc-engine',
          name: 'UGC Engine',
          outcome: 'Fresh, authentic content every month that grows your reach organically',
          deliverables: [
            '24 short-form videos from creators',
            'Captions, hashtags, and posting plan',
            'Performance report and recommendations'
          ],
          price: { oneTime: 0, monthly: 1200 },
          minTerm: '3 months',
          sla: '24 videos delivered monthly and report provided',
          acceptance: '24 videos delivered monthly and report provided',
          badge: 'Content Creator'
        },
        {
          key: 'content-studio-engine',
          name: 'Content Studio Engine',
          outcome: 'Keep your brand looking professional with premium visuals every month',
          deliverables: [
            '8 reels professionally edited',
            '24 branded photos for social, web, or print',
            'Monthly content calendar and hook ideas'
          ],
          price: { oneTime: 0, monthly: 900 },
          minTerm: '3 months',
          sla: 'Assets delivered in required formats and calendar published',
          acceptance: 'Assets delivered in required formats and calendar published',
          badge: 'Visual Expert'
        },
        {
          key: 'pr-authority-engine',
          name: 'PR & Authority Engine',
          outcome: 'Build credibility and trust through ongoing press and reputation management',
          deliverables: [
            'At least 20 media pitches sent',
            '1 thought-leadership article or op-ed written',
            'Review and reputation management',
            'Media tracker updated monthly'
          ],
          price: { oneTime: 0, monthly: 1000 },
          minTerm: '3 months',
          sla: 'Outreach log delivered and at least 1 long-form article drafted monthly',
          acceptance: 'Outreach log delivered and at least 1 long-form article drafted monthly',
          badge: 'Authority Builder'
        },
        {
          key: 'event-engine',
          name: 'Event Engine',
          outcome: 'A dependable program to plan and promote events year-round',
          deliverables: [
            '1 anchor event per quarter or smaller monthly events',
            'Sponsor outreach and vendor coordination',
            'On-site run-of-show management',
            'Post-event recap with content assets'
          ],
          price: { oneTime: 0, monthly: 1500 },
          minTerm: '3 months',
          sla: 'Event plan approved in advance, recap delivered within 7 days post-event',
          acceptance: 'Event plan approved in advance, recap delivered within 7 days post-event',
          badge: 'Event Master'
        }
      ]
    },
    boosts: {
      name: "⚡ Boosts",
      description: "⚡ Boosts (Add-Ons) - Enhance your existing services or add specialized capabilities when you need them",
      services: [
        {
          key: 'drone-gimbal-video',
          name: 'Drone/Gimbal Video Day',
          outcome: 'Capture cinematic shots for events or ads',
          deliverables: [
            'Full day of drone/gimbal video capture',
            'Professional equipment and operator',
            'Edited footage in multiple formats',
            'Rights-cleared for commercial use'
          ],
          price: { oneTime: 800, monthly: 0 },
          sla: '1 day shoot + 3 days editing',
          acceptance: 'Footage delivered in requested formats with no technical issues',
          badge: 'Cinematic'
        },
        {
          key: 'geo-expansion-pages',
          name: 'Geo Expansion Pages',
          outcome: 'Add 5 city/region pages to rank in local searches',
          deliverables: [
            '5 custom city/region landing pages',
            'Local SEO optimization',
            'Local content and imagery',
            'Citation building for each location'
          ],
          price: { oneTime: 1200, monthly: 0 },
          sla: '10 business days',
          acceptance: 'All 5 pages live and optimized for local search',
          badge: 'Local SEO'
        },
        {
          key: 'review-boost',
          name: 'Review Boost',
          outcome: 'Automate asking for and responding to reviews',
          deliverables: [
            'Automated review request system',
            'Review response templates',
            'Review monitoring dashboard',
            'Monthly review performance report'
          ],
          price: { oneTime: 500, monthly: 0 },
          sla: '5 business days setup',
          acceptance: 'System tested and working, dashboard accessible',
          badge: 'Review Master'
        },
        {
          key: 'quiz-funnel',
          name: 'Quiz Funnel',
          outcome: 'Interactive quiz to qualify leads and collect emails',
          deliverables: [
            'Custom quiz design and questions',
            'Lead capture and scoring system',
            'Automated email sequences',
            'Results dashboard and analytics'
          ],
          price: { oneTime: 1500, monthly: 0 },
          sla: '7 business days',
          acceptance: 'Quiz live, test leads flowing, emails sending correctly',
          badge: 'Lead Qualifier'
        },
        {
          key: 'vip-launch-day',
          name: 'VIP Launch Day',
          outcome: 'All-hands-on-deck day where our team works in real time with you to maximize launch results',
          deliverables: [
            'Full team dedicated to your launch',
            'Real-time optimization and adjustments',
            'Live performance monitoring',
            'Post-launch analysis and recommendations'
          ],
          price: { oneTime: 2500, monthly: 0 },
          sla: '1 full day (8 hours)',
          acceptance: 'Launch day completed with all deliverables met',
          badge: 'VIP Service'
        },
        {
          key: 'rush-upgrade',
          name: 'Rush Upgrade',
          outcome: 'Priority 72-hour delivery for urgent needs',
          deliverables: [
            'Priority scheduling and resources',
            'Expedited delivery timeline',
            'Dedicated project manager',
            'Rush fee applied to any service'
          ],
          price: { oneTime: 500, monthly: 0 },
          sla: '72 hours from project start',
          acceptance: 'Service delivered within 72-hour timeline',
          badge: 'Rush Service'
        },
        {
          key: 'brand-refresh',
          name: 'Brand Refresh',
          outcome: 'Update your logo, colors, fonts, and templates for consistency',
          deliverables: [
            'Logo redesign (2 concepts + 1 revision)',
            'Updated color palette and typography',
            'Brand style guide',
            'Template updates for all materials'
          ],
          price: { oneTime: 2000, monthly: 0 },
          sla: '10 business days',
          acceptance: 'All brand assets updated and style guide delivered',
          badge: 'Brand Expert'
        },
        {
          key: 'data-dashboard',
          name: 'Data Dashboard',
          outcome: 'Custom dashboard with all your sales/marketing numbers in one place',
          deliverables: [
            'Custom dashboard design',
            'Data integration and automation',
            'Real-time reporting',
            'Monthly insights and recommendations'
          ],
          price: { oneTime: 1500, monthly: 0 },
          sla: '14 business days',
          acceptance: 'Dashboard live with all requested data sources connected',
          badge: 'Data Expert'
        },
        {
          key: 'compliance-pack',
          name: 'Compliance Pack',
          outcome: 'Cookie banner, privacy policies, and opt-in rules set up',
          deliverables: [
            'GDPR/CCPA compliant cookie banner',
            'Privacy policy and terms of service',
            'Email opt-in compliance setup',
            'Compliance audit and recommendations'
          ],
          price: { oneTime: 800, monthly: 0 },
          sla: '7 business days',
          acceptance: 'All compliance elements live and tested',
          badge: 'Compliance Ready'
        }
      ]
    }
  },
  addons: [
    {
      key: 'rush-upgrade',
      name: 'Rush Upgrade',
      description: 'Priority 72-hour delivery for any service',
      price: { oneTime: 500, monthly: 0 },
      applicableServices: ['all']
    },
    {
      key: 'premium-support',
      name: 'Premium Support',
      description: 'Priority support with 4-hour response time',
      price: { oneTime: 0, monthly: 200 },
      applicableServices: ['all']
    }
  ]
};