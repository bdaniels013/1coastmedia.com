// 1CoastMedia Full Service Catalog (2025)
window.serviceData = {
  serviceCategories: {
    signature: {
      description: "★ Signature Programs - Our standout, lead offers designed for maximum impact",
      services: [
        {
          key: '48-hour-launch',
          name: '48-Hour Launch Funnel',
          outcome: 'Complete funnel live and converting in 48 hours',
          deliverables: [
            'Landing page + thank-you page',
            'GA4/pixels setup',
            '3 ad creatives',
            '1 welcome email'
          ],
          price: { oneTime: 1950, monthly: 0 },
          sla: '48 hours',
          acceptance: 'Test lead captured, analytics events firing, QA report provided',
          badge: 'Fastest ROI'
        },
        {
          key: 'local-authority',
          name: 'Local Authority Sprint',
          outcome: 'Dominate local search in your area',
          deliverables: [
            'GBP overhaul',
            'Top-20 citation cleanup',
            'Local schema implementation',
            '4 GBP posts + 10 geo-photos',
            '1 local landing page'
          ],
          price: { oneTime: 1500, monthly: 0 },
          sla: '7 days',
          acceptance: 'Schema validates, posts live, citations log provided',
          badge: 'Local Favorite'
        },
        {
          key: 'event-surge',
          name: 'Event Surge Kit',
          outcome: 'Complete event marketing system ready to drive attendance',
          deliverables: [
            'Event page/ticket embed',
            '2 short promo videos',
            '3 flyer sizes (print + digital)',
            'GBP Event setup',
            'Geo ad setup + email blast'
          ],
          price: { oneTime: 1200, monthly: 0 },
          sla: '5-7 days',
          acceptance: 'Page live, test opt-in fires',
          badge: 'Event-Ready'
        },
        {
          key: 'brand-intensive',
          name: 'Brand-in-a-Day Intensive',
          outcome: 'Complete brand identity in one intensive day',
          deliverables: [
            'Logo (2 concepts + 1 revision)',
            'Color palette + typography',
            'Mini brand guide',
            '6 social media templates',
            '1 motion bumper video'
          ],
          price: { oneTime: 1750, monthly: 0 },
          sla: '1 day',
          acceptance: 'All brand assets delivered'
        },
        {
          key: 'site-in-week',
          name: 'Site-in-a-Week (6pp)',
          outcome: 'Professional 6-page website live in one week',
          deliverables: [
            '6 responsive pages',
            'Design system',
            'Basic SEO optimization',
            'CRM/lead handoff setup',
            'Analytics + training'
          ],
          price: { oneTime: 3500, monthly: 0 },
          sla: '1 week',
          acceptance: 'Lighthouse ≥90, forms working',
          badge: 'Best Seller'
        },
        {
          key: 'creator-concierge',
          name: 'Creator Concierge',
          outcome: 'Professional creator content management',
          deliverables: [
            '8 short videos monthly',
            '12 social posts',
            'Engagement 30min/day',
            '2 UGC assets',
            'Monthly insights report'
          ],
          price: { oneTime: 0, monthly: 1800 },
          minTerm: '3 months',
          sla: 'Weekly deliveries',
          acceptance: 'All content delivered on schedule'
        },
        {
          key: 'cannabis-kit',
          name: 'Compliance-Safe Cannabis/Hemp Kit',
          outcome: 'Compliant cannabis/hemp marketing system',
          deliverables: [
            '2 SEO articles monthly',
            'Compliant directory placement',
            'Email/SMS flows setup',
            'GBP hygiene maintenance'
          ],
          price: { oneTime: 0, monthly: 1400 },
          minTerm: '3 months',
          sla: 'Monthly deliveries',
          acceptance: 'All compliance requirements met'
        },
        {
          key: 'review-rocket',
          name: 'Review Rocket',
          outcome: 'Automated review generation system',
          deliverables: [
            'Review landing page',
            'Automation (100 invites)',
            'Email/SMS templates',
            'Signage file'
          ],
          price: { oneTime: 350, monthly: 0 },
          sla: '3-5 days',
          acceptance: 'System live and sending invites'
        },
        {
          key: 'roi-guard-ppc',
          name: 'ROI-Guard PPC Management',
          outcome: 'Profitable ad campaigns with conversion guarantee',
          deliverables: [
            'Campaign build + creatives',
            'Weekly optimization',
            'Performance reporting',
            'Conversion guarantee'
          ],
          price: { oneTime: 800, monthly: 0 }, // 12% of ad spend (min $700/mo)
          minTerm: '3 months',
          sla: 'Weekly optimization',
          acceptance: 'Campaigns live and tracking conversions',
          guarantee: 'No conversions by day 45 → 2 free A/B tests'
        },
        {
          key: 'ugc-lab',
          name: 'UGC Lab (Starter)',
          outcome: 'Authentic user-generated content from micro-creators',
          deliverables: [
            '4 UGC videos monthly',
            'Hook library updates',
            'Creator coordination',
            'Content optimization'
          ],
          price: { oneTime: 0, monthly: 1200 },
          minTerm: '2 months',
          sla: 'Monthly deliveries',
          acceptance: 'All UGC content delivered'
        }
      ]
    },
    core: {
      description: "Core Packages - Optimized base services every business needs",
      services: [
        {
          key: 'website-launch-pro',
          name: 'Website Launch — Pro',
          outcome: 'Professional website that converts visitors to customers',
          deliverables: [
            '6 responsive pages',
            'Design system',
            'SEO basics',
            'CRM/pixel handoff',
            'GA4 goals + training'
          ],
          price: { oneTime: 2800, monthly: 0 },
          sla: '3-4 weeks',
          acceptance: 'Site live and fully functional'
        },
        {
          key: 'brand-essentials',
          name: 'Brand Essentials Kit',
          outcome: 'Complete brand identity foundation',
          deliverables: [
            'Logo (3 concepts, 2 revisions)',
            'Color palette + typography',
            'Mini brand guide',
            'Social avatars/banners'
          ],
          price: { oneTime: 1200, monthly: 0 },
          sla: '1-2 weeks',
          acceptance: 'All brand assets delivered'
        },
        {
          key: 'content-sprint',
          name: 'Content Sprint — 30 Days',
          outcome: 'Month of professional content ready to publish',
          deliverables: [
            '12 social posts',
            '2 short videos',
            '20 professional photos',
            'Content calendar'
          ],
          price: { oneTime: 1950, monthly: 0 },
          sla: '4 weeks',
          acceptance: 'All content delivered with calendar'
        },
        {
          key: 'local-growth',
          name: 'Local Growth Kit',
          outcome: 'Local search optimization foundation',
          deliverables: [
            'GBP optimization',
            'Citations cleanup',
            'Local schema setup',
            'Review system implementation'
          ],
          price: { oneTime: 1000, monthly: 0 },
          sla: '2-3 weeks',
          acceptance: 'All local SEO elements live'
        }
      ]
    },
    oneTime: {
      description: "One-Time Add-Ons - Project boosts for immediate impact",
      services: [
        {
          key: 'logo-design',
          name: 'Logo Design',
          outcome: 'Professional logo with full file set',
          deliverables: [
            '3 logo concepts',
            '2 revision rounds',
            'Full file set (AI, PNG, SVG, etc.)'
          ],
          price: { oneTime: 400, monthly: 0 },
          sla: '5 days',
          acceptance: 'Final logo files delivered'
        },
        {
          key: 'style-guide',
          name: 'Brand Style Guide Mini',
          outcome: 'Brand consistency guidelines',
          deliverables: [
            'Fonts and colors guide',
            '2 template covers',
            'Usage guidelines'
          ],
          price: { oneTime: 350, monthly: 0 },
          sla: '4 days',
          acceptance: 'Style guide delivered'
        },
        {
          key: 'copywriting-sprint',
          name: 'Copywriting Sprint (≤6pp)',
          outcome: 'Professional copy for up to 6 pages',
          deliverables: [
            'Page copy for up to 6 pages',
            'SEO optimization',
            'Call-to-action optimization'
          ],
          price: { oneTime: 500, monthly: 0 },
          sla: '5 days',
          acceptance: 'All copy delivered and approved'
        },
        {
          key: 'landing-page',
          name: 'Landing Page (Design+Build)',
          outcome: 'High-converting landing page',
          deliverables: [
            'Custom design + build',
            'Mobile optimization',
            'QA testing'
          ],
          price: { oneTime: 1200, monthly: 0 },
          sla: '7 days',
          acceptance: 'QA ≥90 desktop score'
        },
        {
          key: 'promo-video',
          name: 'Promo Video (30-45s)',
          outcome: 'Professional promotional video',
          deliverables: [
            '30-45 second video',
            '2 aspect ratios',
            'Captions included'
          ],
          price: { oneTime: 800, monthly: 0 },
          sla: '6 days',
          acceptance: 'Final video in all formats'
        },
        {
          key: 'event-flyer',
          name: 'Event Flyer',
          outcome: 'Professional event marketing materials',
          deliverables: [
            'Print-ready flyer',
            'Instagram story version'
          ],
          price: { oneTime: 200, monthly: 0 },
          sla: '3 days',
          acceptance: 'Files delivered in both formats'
        },
        {
          key: 'email-campaign',
          name: 'Email Campaign Setup',
          outcome: 'Professional email campaign ready to send',
          deliverables: [
            'Email design + copy',
            'List segmentation',
            'Send scheduling'
          ],
          price: { oneTime: 300, monthly: 0 },
          sla: '3 days',
          acceptance: 'Campaign ready to send'
        },
        {
          key: 'seo-audit',
          name: 'SEO Starter Audit & Fix (10 items)',
          outcome: 'Improved search rankings and site performance',
          deliverables: [
            'Technical SEO audit',
            '10 priority fixes implemented',
            'Performance report'
          ],
          price: { oneTime: 600, monthly: 0 },
          sla: '7 days',
          acceptance: 'All 10 items fixed and documented'
        },
        {
          key: 'photography-pack',
          name: 'Photography Pack (20 edits)',
          outcome: 'Professional photos ready for marketing',
          deliverables: [
            '20 professionally edited photos',
            'Multiple format exports',
            'Usage rights included'
          ],
          price: { oneTime: 450, monthly: 0 },
          sla: '7 days',
          acceptance: 'All photos delivered in requested formats'
        },
        {
          key: 'checkout-integration',
          name: 'Checkout/Booking Integration',
          outcome: 'Seamless payment and booking system',
          deliverables: [
            'Payment gateway setup',
            'Booking system integration',
            'Testing and QA'
          ],
          price: { oneTime: 350, monthly: 0 },
          sla: '4 days',
          acceptance: 'System live and processing transactions'
        }
      ]
    },
    monthly: {
      description: "Monthly Add-Ons - Recurring services with minimum terms",
      services: [
        {
          key: 'social-starter',
          name: 'Social Media Starter',
          outcome: 'Consistent social presence that builds your brand',
          deliverables: [
            '1 platform management',
            '12 posts monthly',
            'Engagement 15min/day',
            'Monthly report'
          ],
          price: { oneTime: 0, monthly: 900 },
          minTerm: '3 months',
          sla: 'Weekly posting',
          acceptance: 'All posts published on schedule'
        },
        {
          key: 'social-growth',
          name: 'Social Media Growth',
          outcome: 'Multi-platform growth with video content',
          deliverables: [
            '2 platforms management',
            '16 posts + 2 reels monthly',
            'Engagement 30min/day',
            'Insights report'
          ],
          price: { oneTime: 0, monthly: 1400 },
          minTerm: '3 months',
          sla: 'Weekly deliveries',
          acceptance: 'All content delivered with performance insights'
        },
        {
          key: 'website-maintenance',
          name: 'Website Maintenance',
          outcome: 'Website always updated and secure',
          deliverables: [
            'Weekly updates',
            '3 hours edits monthly',
            'Uptime monitoring',
            'Monthly report'
          ],
          price: { oneTime: 0, monthly: 300 },
          minTerm: '3 months',
          sla: 'Weekly maintenance',
          acceptance: 'Site maintained and report delivered'
        },
        {
          key: 'seo-standard',
          name: 'SEO Retainer Standard',
          outcome: 'Steady organic growth and visibility',
          deliverables: [
            '2 SEO articles monthly',
            'Keyword planning',
            'On-page fixes',
            'Performance report'
          ],
          price: { oneTime: 0, monthly: 1200 },
          minTerm: '4 months',
          sla: 'Monthly deliveries',
          acceptance: 'All SEO work completed with report'
        },
        {
          key: 'seo-growth',
          name: 'SEO Retainer Growth',
          outcome: 'Aggressive SEO growth and technical optimization',
          deliverables: [
            '4 SEO articles monthly',
            'Technical fixes',
            'Citation building',
            'Growth roadmap'
          ],
          price: { oneTime: 0, monthly: 1800 },
          minTerm: '4 months',
          sla: 'Monthly deliveries',
          acceptance: 'All deliverables completed with roadmap'
        },
        {
          key: 'paid-ads',
          name: 'Paid Ads Management',
          outcome: 'Profitable ad campaigns with ongoing optimization',
          deliverables: [
            'Campaign management',
            'Creative optimization',
            'Performance reporting',
            'ROI tracking'
          ],
          price: { oneTime: 800, monthly: 0 }, // 12% of ad spend (min $700/mo)
          minTerm: '3 months',
          sla: 'Weekly optimization',
          acceptance: 'Campaigns optimized and reporting delivered'
        },
        {
          key: 'email-standard',
          name: 'Email Marketing Standard',
          outcome: 'Regular email communication with your audience',
          deliverables: [
            '2 email sends monthly',
            'List hygiene',
            'Performance report'
          ],
          price: { oneTime: 0, monthly: 700 },
          minTerm: '2 months',
          sla: 'Bi-weekly sends',
          acceptance: 'Emails sent and report delivered'
        },
        {
          key: 'email-growth',
          name: 'Email Marketing Growth',
          outcome: 'Advanced email marketing with automation',
          deliverables: [
            '4 email sends monthly',
            'A/B testing',
            'Automation setup',
            'Insights report'
          ],
          price: { oneTime: 0, monthly: 1200 },
          minTerm: '3 months',
          sla: 'Weekly sends',
          acceptance: 'All emails sent with automation active'
        },
        {
          key: 'content-lite',
          name: 'Content Retainer Lite',
          outcome: 'Regular professional content creation',
          deliverables: [
            'Half-day photo shoot',
            '30 edited photos',
            '2 short videos'
          ],
          price: { oneTime: 0, monthly: 1300 },
          minTerm: '3 months',
          sla: 'Monthly shoot',
          acceptance: 'All content delivered monthly'
        },
        {
          key: 'content-pro',
          name: 'Content Retainer Pro',
          outcome: 'Comprehensive content creation package',
          deliverables: [
            'Full-day photo shoot',
            '50 edited photos',
            '4 short videos'
          ],
          price: { oneTime: 0, monthly: 2100 },
          minTerm: '3 months',
          sla: 'Monthly shoot',
          acceptance: 'All content delivered monthly'
        },
        {
          key: 'analytics-cro',
          name: 'Analytics & CRO',
          outcome: 'Data-driven optimization and conversion improvement',
          deliverables: [
            'Custom dashboard',
            'Event tracking setup',
            '1 A/B test monthly'
          ],
          price: { oneTime: 0, monthly: 450 },
          minTerm: '2 months',
          sla: 'Monthly optimization',
          acceptance: 'Dashboard updated and test results delivered'
        }
      ]
    }
  },

  bundles: [
    {
      key: 'local-dominator',
      name: 'Local Dominator',
      description: 'Complete local market domination package',
      includes: ['Local Authority Sprint', 'GBP posts', 'Review Rocket'],
      price: { oneTime: 1000, monthly: 300 },
      savings: 'Save $750 vs individual services'
    },
    {
      key: 'growth-wave',
      name: 'Growth Wave (Quarterly)',
      description: 'Quarterly growth acceleration package',
      includes: ['Campaign refresh', 'LP refresh', '6 graphics', '2 shorts', 'Email/GBP'],
      price: { oneTime: 2500, monthly: 0 },
      billing: 'Quarterly + media costs',
      savings: 'Save $1200 vs individual services'
    },
    {
      key: 'launch-ads',
      name: 'Launch + Ads',
      description: 'Complete website launch with advertising setup',
      includes: ['Website Launch Pro', 'ROI-Guard PPC', '1 A/B test'],
      price: { oneTime: 2800, monthly: 0 },
      note: 'Plus PPC management fees',
      savings: 'Save $1000 vs individual services'
    }
  ],

  addons: [
    {
      key: 'rush-delivery',
      name: 'Rush Delivery (50% surcharge)',
      description: 'Expedited delivery for urgent projects',
      price: { oneTime: 0, monthly: 0 }, // 50% of base service price
      applicableServices: ['all']
    },
    {
      key: 'extra-revisions',
      name: 'Extra Revisions ($75/hour)',
      description: 'Additional revisions beyond included rounds',
      price: { oneTime: 75, monthly: 0 }, // Per hour
      applicableServices: ['all']
    },
    {
      key: 'print-qr',
      name: 'Print QR Code',
      description: 'Physical QR code for Review Rocket',
      price: { oneTime: 50, monthly: 0 },
      applicableServices: ['review-rocket']
    }
  ]
};