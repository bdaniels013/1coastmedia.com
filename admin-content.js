// Content Manager for 1CoastMedia
function contentManager() {
  return {
    // Authentication state
    isLoggedIn: false,
    currentUser: '',
    sessionToken: '',
    loginForm: { username: '', password: '' },
    loginError: '',
    isLoggingIn: false,
    
    // Content management
    content: {},
    activeTab: 'mainPage',
    saveStatus: null,
    isSaving: false,
    
    // Tab switching with analytics loading
    switchTab(tabName) {
      this.activeTab = tabName;
      
      // Load analytics only when Analytics tab is clicked
      if (tabName === 'analytics' && this.isLoggedIn) {
        this.loadAnalytics();
      }
    },
    
    // Test GA4 connection manually
    async testGA4Connection() {
      console.log('🧪 Testing GA4 connection...');
      alert('🧪 Testing GA4 connection... Check console and Render logs!');
      
      try {
        // Test realtime endpoint
        console.log('📡 Testing /api/analytics/realtime...');
        const realtimeResponse = await fetch(`${this.apiBase}/api/analytics/realtime`);
        console.log('📡 Realtime response status:', realtimeResponse.status);
        
        if (realtimeResponse.ok) {
          const realtimeData = await realtimeResponse.json();
          console.log('📊 Realtime data:', realtimeData);
        } else {
          console.error('❌ Realtime failed:', realtimeResponse.statusText);
        }
        
        // Test summary endpoint
        console.log('📡 Testing /api/analytics/summary...');
        const summaryResponse = await fetch(`${this.apiBase}/api/analytics/summary`);
        console.log('📡 Summary response status:', summaryResponse.status);
        
        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          console.log('📊 Summary data:', summaryData);
        } else {
          console.error('❌ Summary failed:', summaryResponse.statusText);
        }
        
      } catch (error) {
        console.error('❌ Test failed:', error);
        alert('❌ Test failed: ' + error.message);
      }
    },
    
    // Date range functions
    setDateRange(range) {
      this.dateRange = range;
      // Reload analytics with new date range
      if (this.activeTab === 'analytics') {
        this.loadAnalytics();
      }
    },
    
    getDateRangeText() {
      const now = new Date();
      switch (this.dateRange) {
        case 'today':
          return `Today: ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;
        case 'week':
          const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
          const weekEnd = new Date(now.setDate(now.getDate() - now.getDay() + 6));
          return `This Week: ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
        case 'month':
          return `This Month: ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
        case '28days':
          const daysAgo = new Date(now.getTime() - (28 * 24 * 60 * 60 * 1000));
          return `Last 28 Days: ${daysAgo.toLocaleDateString()} - ${now.toLocaleDateString()}`;
        default:
          return 'Last 28 Days';
      }
    },
    
    // Analytics
    analytics: {
      realtime: null,
      summary: null
    },
    isRefreshingAnalytics: false,
    dateRange: '28days', // Default to 28 days
    
    // API base URL
    apiBase: window.location.origin,
    
    async init() {
      // Check if user is already logged in
      this.checkExistingSession();
      
      // Load content data
      await this.loadContent();
      
      // Don't auto-load analytics - only load when user clicks Analytics tab
      // await this.loadAnalytics();
    },
    
    // Authentication methods
    async login() {
      this.isLoggingIn = true;
      this.loginError = '';
      
      try {
        const response = await fetch(`${this.apiBase}/api/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.loginForm)
        });
        
        const data = await response.json();
        
        if (data.success) {
          this.sessionToken = data.sessionToken;
          this.currentUser = this.loginForm.username;
          this.isLoggedIn = true;
          
          // Store session in localStorage
          localStorage.setItem('adminSession', this.sessionToken);
          localStorage.setItem('adminUser', this.currentUser);
          
          // Clear login form
          this.loginForm = { username: '', password: '' };
          
          console.log('✅ Login successful');
        } else {
          this.loginError = data.error || 'Login failed';
        }
      } catch (error) {
        console.error('Login error:', error);
        this.loginError = 'Network error. Please try again.';
      } finally {
        this.isLoggingIn = false;
      }
    },
    
    async logout() {
      try {
        // Call logout endpoint
        await fetch(`${this.apiBase}/api/admin/logout`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.sessionToken}`
          }
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
      
      // Clear local state
      this.isLoggedIn = false;
      this.currentUser = '';
      this.sessionToken = '';
      this.loginError = '';
      
      // Clear localStorage
      localStorage.removeItem('adminSession');
      localStorage.removeItem('adminUser');
      
      console.log('✅ Logout successful');
    },
    
    checkExistingSession() {
      const savedSession = localStorage.getItem('adminSession');
      const savedUser = localStorage.getItem('adminUser');
      
      if (savedSession && savedUser) {
        // Verify session is still valid by making a test request
        this.verifySession(savedSession, savedUser);
      }
    },
    
    async verifySession(sessionToken, username) {
      try {
        // Try to make a request to a protected endpoint
        const response = await fetch(`${this.apiBase}/api/services`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({ test: true })
        });
        
        if (response.status === 401) {
          // Session expired, clear it
          this.clearSession();
        } else {
          // Session is valid
          this.sessionToken = sessionToken;
          this.currentUser = username;
          this.isLoggedIn = true;
        }
      } catch (error) {
        console.error('Session verification error:', error);
        this.clearSession();
      }
    },
    
    clearSession() {
      localStorage.removeItem('adminSession');
      localStorage.removeItem('adminUser');
      this.isLoggedIn = false;
      this.currentUser = '';
      this.sessionToken = '';
    },
    
    // Content management methods
    async loadContent() {
      try {
        const response = await fetch(`${this.apiBase}/api/content`);
        if (response.ok) {
          this.content = await response.json();
          console.log('✅ Content loaded successfully');
        } else {
          console.warn('Failed to load content from server, using default data');
          this.loadDefaultContent();
        }
      } catch (error) {
        console.warn('Could not load content from server, using default data', error);
        this.loadDefaultContent();
      }
    },
    
    loadDefaultContent() {
      // Default content structure
      this.content = {
        mainPage: {
          hero: {
            title: "1CoastMedia",
            subtitle: "Digital Marketing & Web Development Services",
            description: "Transform your Gulf Coast business with our comprehensive digital solutions. From stunning websites to powerful marketing campaigns, we drive results that matter.",
            ctaButton: "Get Started",
            ctaLink: "#services",
            growthMachineButton: "🚀 Growth Machine",
            growthMachineLink: "./growth-machine"
          },
          services: {
            title: "Our Services",
            subtitle: "Comprehensive digital solutions for your business",
            description: "Choose from our range of services or build a custom package that fits your needs perfectly."
          },
          growthMachineHighlight: {
            title: "All Inclusive Growth Machine",
            subtitle: "The Definitive Engine for Revenue Revolution",
            description: "Envision a future where your Gulf Coast business operates like a well-oiled machine—customers streaming in consistently, revenue curves trending upward, and your time liberated from the endless cycle of marketing trials and errors.",
            ctaButton: "View Packages",
            ctaLink: "./growth-machine"
          },
          contact: {
            title: "Ready to Get Started?",
            subtitle: "Let's discuss how we can transform your business",
            description: "Book a free consultation to explore your options and find the perfect solution for your needs."
          }
        },
        growthMachine: {
          hero: {
            title: "All Inclusive Growth Machine",
            subtitle: "The Definitive Engine for Revenue Revolution",
            description: "Envision a future where your Gulf Coast business operates like a well-oiled machine—customers streaming in consistently, revenue curves trending upward, and your time liberated from the endless cycle of marketing trials and errors."
          },
          packages: {
            starter: {
              name: "Growth Starter",
              price: 4500,
              billing: "monthly",
              description: "Essential Momentum for Foundational Wins",
              features: [
                "Custom design, mobile optimization, SEO setup",
                "Landing pages, lead capture forms",
                "Basic e-commerce integration",
                "Ongoing maintenance",
                "15 custom content pieces/month",
                "Up to 2 UGC campaigns (50k min impressions)",
                "Bi-quarterly event coordination",
                "Local PR (free: 1-2 releases/quarter)",
                "Dedicated account manager",
                "Bi-weekly strategy calls"
              ],
              ctaButton: "Add to Cart",
              ctaSecondary: "Book a Call to Tailor This Tier"
            },
            machine: {
              name: "Growth Machine",
              price: 6500,
              billing: "monthly",
              description: "Optimized Power for Steady Acceleration",
              features: [
                "All Starter features + enhanced e-commerce",
                "20-30 content pieces monthly",
                "100k+ UGC impressions",
                "Email/text automation sequences",
                "Quarterly events",
                "Local + national PR (1 release/month)",
                "Weekly strategy calls"
              ],
              ctaButton: "Add to Cart",
              ctaSecondary: "Book a Call to Tailor This Tier"
            },
            accelerator: {
              name: "Growth Accelerator",
              price: 9000,
              billing: "monthly",
              description: "Elite Mastery for Unparalleled Dominance",
              features: [
                "All Machine features + advanced e-commerce",
                "30-40 content pieces (including premium productions)",
                "150k+ UGC impressions",
                "Full automations with A/B testing",
                "Monthly events",
                "Local, national, global PR (2+ releases/month)",
                "Twice-weekly calls + priority revisions"
              ],
              ctaButton: "Add to Cart",
              ctaSecondary: "Book a Call to Tailor This Tier"
            }
          },
          whyChoose: {
            title: "Why the Growth Machine Transforms Doubt into Decisive Action",
            description: "We know the mental hurdles: Budget constraints, fear of underwhelming results, uncertainty about fit, or skepticism from past experiences. Here's how we dismantle them, making this the clear, empowering choice:",
            benefits: [
              {
                title: "Budget-Smart Scalability",
                description: "Tiers start accessible and build value incrementally, saving you 40-60% versus hiring separate experts for web, content, UGC, events, PR, and more (which often exceeds $15,000/month)."
              },
              {
                title: "Guaranteed, Trackable Impact",
                description: "Every tier includes custom KPI tracking (clicks, conversions, sales) with real-time dashboards and adjustments—proving ROI from the start."
              },
              {
                title: "Perfect Alignment for Your Stage",
                description: "Whether you're a startup retailer testing digital waters or an established venue seeking national spotlight, tiers adapt seamlessly."
              },
              {
                title: "Zero-Risk Commitment",
                description: "With our performance pledge—if customer growth doesn't materialize, get an extra month free—plus handcrafted UGC and PR expertise, you're safeguarded."
              },
              {
                title: "Comprehensive, Hands-Off Mastery",
                description: "We execute every digital task—web updates, content calendars, influencer enforcement, event pages/ticket sales, media outreach, and emerging needs—freeing you completely."
              }
            ]
          },
          testimonials: [
            {
              quote: "Starter's e-com and local PR kickstarted our online sales—up 40% in three months, no headaches.",
              author: "Small Retailer, Pascagoula"
            },
            {
              quote: "Machine tier's UGC and automations filled our calendar—revenue climbed 55%, all hands-off.",
              author: "Hospitality Business, Gulfport"
            },
            {
              quote: "Accelerator's global PR and events positioned us nationally—bookings soared 70%. Game-changer.",
              author: "Tourism Operator, Biloxi"
            }
          ],
          finalCta: {
            title: "Seal the Decision: Your Growth Awaits",
            description: "The lingering question—\"Is this the right move?\"—answers itself: With tiers that empower revenue from e-com and PR at every level, comprehensive coverage that handles everything, and safeguards that minimize risk, the Growth Machine is the strategic imperative your business deserves.",
            buttonText: "Book a Free 30-Min Call",
            buttonLink: "#contact"
          }
        },
        navigation: {
          mainMenu: [
            { text: "Services", link: "#services" },
            { text: "Growth Machine", link: "./growth-machine" },
            { text: "About", link: "#about" },
            { text: "Contact", link: "#contact" }
          ],
          footerLinks: [
            { text: "Privacy Policy", link: "/privacy" },
            { text: "Terms of Service", link: "/terms" },
            { text: "Support", link: "/support" }
          ]
        },
        meta: {
          lastUpdated: new Date().toISOString(),
          version: "1.0.0"
        }
      };
    },
    
    async saveContent() {
      this.isSaving = true;
      this.saveStatus = null;
      
      try {
        // Process features arrays (convert from newline-separated text)
        Object.values(this.content.growthMachine.packages).forEach(pkg => {
          if (typeof pkg.features === 'string') {
            pkg.features = pkg.features.split('\n').filter(f => f.trim());
          }
        });
        
        const response = await fetch(`${this.apiBase}/api/content`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.sessionToken}`
          },
          body: JSON.stringify(this.content)
        });
        
        const data = await response.json();
        
        if (data.success) {
          this.saveStatus = {
            type: 'success',
            message: '✅ Content saved successfully! Your changes are now live.'
          };
          console.log('✅ Content saved successfully');
        } else {
          this.saveStatus = {
            type: 'error',
            message: `❌ Failed to save content: ${data.error}`
          };
        }
      } catch (error) {
        console.error('Error saving content:', error);
        this.saveStatus = {
          type: 'error',
          message: '❌ Network error. Please try again.'
        };
      } finally {
        this.isSaving = false;
        
        // Clear status after 5 seconds
        setTimeout(() => {
          this.saveStatus = null;
        }, 5000);
      }
    },
    
    // Analytics methods
    async loadAnalytics() {
      // Only load if we're on the analytics tab and not already loading
      if (this.activeTab !== 'analytics' || this.isRefreshingAnalytics) {
        return;
      }
      
      this.isRefreshingAnalytics = true;
      console.log('📊 Loading analytics data...');
      
      try {
        // Load real-time data
        const realtimeResponse = await fetch(`${this.apiBase}/api/analytics/realtime`);
        if (realtimeResponse.ok) {
          this.analytics.realtime = await realtimeResponse.json();
        }
        
        // Load summary data
        const summaryResponse = await fetch(`${this.apiBase}/api/analytics/summary`);
        if (summaryResponse.ok) {
          this.analytics.summary = await summaryResponse.json();
        }
        
        console.log('✅ Analytics loaded successfully');
      } catch (error) {
        console.error('Error loading analytics:', error);
      } finally {
        this.isRefreshingAnalytics = false;
      }
    },
    
    async refreshAnalytics() {
      // Only refresh if we're on the analytics tab
      if (this.activeTab === 'analytics') {
        // Clear existing data to force fresh load
        this.analytics.realtime = null;
        this.analytics.summary = null;
        
        // Force reload
        await this.loadAnalytics();
      }
    },
    
    // Chart creation removed - no more infinite scrolling issues
  };
}
