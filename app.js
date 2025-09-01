// Simple client-side shopping cart application for 1CoastMedia
function app() {
  return {
    // UI state
    cartOpen: false,
    // details open state per service key
    detailsOpen: {},
    // Data collections
    serviceCategories: {},
    cartServices: [],
    addons: [],
    cartAddons: [],
    oneTimeAddons: [],
    monthlyAddons: [],
    // API base URL
    apiBase: window.location.origin,
    
    // Init loads services from server
    async init() {
      try {
        // Try to load from server first
        const response = await fetch(`${this.apiBase}/api/services`);
        if (response.ok) {
          window.serviceData = await response.json();
        } else {
          console.warn('Failed to load from server, using default data');
          // Fall back to default data if server fails
          if (!window.serviceData) {
            window.serviceData = { serviceCategories: {}, addons: [] };
          }
        }
      } catch (err) {
        console.warn('Could not load from server, using default data', err);
        // Fall back to default data if server fails
        if (!window.serviceData) {
          window.serviceData = { serviceCategories: {}, addons: [] };
        }
      }
      
      // Load categories
      this.serviceCategories = window.serviceData?.serviceCategories || {};
      
      // load addons (top-level or nested)
      if (window.serviceData?.addons) {
        this.addons = window.serviceData.addons;
      } else if (window.serviceData?.serviceCategories?.addons) {
        // some older data structures place addons alongside serviceCategories
        this.addons = window.serviceData.serviceCategories.addons;
      } else {
        this.addons = [];
      }
      
      // Split add-ons into one-time and monthly lists for display
      this.oneTimeAddons = [];
      this.monthlyAddons = [];
      this.addons.forEach(a => {
        const hasMonthly = a.price && a.price.monthly && a.price.monthly > 0;
        const hasOneTime = a.price && a.price.oneTime && a.price.oneTime > 0;
        if (hasMonthly && !hasOneTime) {
          this.monthlyAddons.push(a);
        } else {
          // default to one-time list when both are defined or only one-time exists
          this.oneTimeAddons.push(a);
        }
      });
      
      // initialize detailsOpen map
      for (const category of Object.values(this.serviceCategories)) {
        for (const svc of category.services) {
          this.$set ? this.$set(this.detailsOpen, svc.key, false) : (this.detailsOpen[svc.key] = false);
        }
      }
    },
    
    // Format a number as USD
    fmtUSD(amount) {
      if (!amount || amount === 0) return '$0';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
    },
    
    // Get service by key
    getServiceByKey(key) {
      for (const category of Object.values(this.serviceCategories)) {
        const svc = category.services.find(s => s.key === key);
        if (svc) return svc;
      }
      return null;
    },
    
    // Toggle service in cart
    toggleService(key) {
      const idx = this.cartServices.indexOf(key);
      if (idx >= 0) {
        this.cartServices.splice(idx, 1);
      } else {
        this.cartServices.push(key);
      }
    },

    // Toggle an add-on in cart
    toggleAddon(key) {
      const idx = this.cartAddons.indexOf(key);
      if (idx >= 0) {
        this.cartAddons.splice(idx, 1);
      } else {
        this.cartAddons.push(key);
      }
    },

    // Get add-on by key
    getAddonByKey(key) {
      return this.addons.find(a => a.key === key) || null;
    },
    
    // Cart count
    cartCount() {
      // Count only base services for the badge
      return this.cartServices.length;
    },
    
    // Calculate cart total
    cartTotal() {
      let total = 0;
      this.cartServices.forEach(key => {
        const svc = this.getServiceByKey(key);
        if (svc && svc.price) {
          // Use one-time price if defined and > 0, otherwise fall back to monthly
          const price = svc.price.oneTime && svc.price.oneTime > 0
            ? svc.price.oneTime
            : (svc.price.monthly || 0);
          total += price;
        }
      });
      // Add-ons total
      this.cartAddons.forEach(key => {
        const addon = this.getAddonByKey(key);
        if (addon && addon.price) {
          const price = addon.price.oneTime && addon.price.oneTime > 0
            ? addon.price.oneTime
            : (addon.price.monthly || 0);
          total += price;
        }
      });
      return total;
    },
    
    // Checkout via Stripe
    async checkout() {
      // Build cart items with names and prices for Stripe
      const items = [];
      
      // Base services
      this.cartServices.forEach(key => {
        const svc = this.getServiceByKey(key);
        if (svc && svc.price) {
          items.push({
            name: svc.name,
            description: svc.outcome,
            price: svc.price
          });
        }
      });
      
      // Add-ons
      this.cartAddons.forEach(key => {
        const addon = this.getAddonByKey(key);
        if (addon && addon.price) {
          items.push({
            name: addon.name,
            description: addon.description,
            price: addon.price
          });
        }
      });
      
      if (items.length === 0) {
        alert('Your cart is empty.');
        return;
      }
      
      try {
        const response = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            cart: items, 
            contact: {} // You can add contact form data here later
          })
        });
        
        const data = await response.json();
        
        if (data.success && data.url) {
          // Redirect to Stripe Checkout
          window.location.href = data.url;
        } else {
          alert(data?.error || 'Unable to initiate checkout.');
        }
      } catch (err) {
        console.error('Checkout error:', err);
        alert('Checkout error. Please try again.');
      }
    },

    /**
     * Toggle details view for a service
     * @param {string} key
     */
    toggleDetails(key) {
      this.detailsOpen[key] = !this.detailsOpen[key];
    },
    
    /**
     * Convert a category key to a human-friendly title.
     * E.g. "signature" → "Signature", "local-authority" → "Local Authority"
     * @param {string} key
     */
    formatCategoryTitle(key) {
      if (!key) return '';
      return key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    },

    /**
     * Smoothly scroll to the services section of the page. Also optionally open the cart if desired.
     */
    scrollToServices() {
      const el = document.getElementById('services');
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };
}