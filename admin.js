// Simple admin dashboard logic for the 1CoastMedia site
function adminApp() {
  return {
    // Authentication state
    isLoggedIn: false,
    currentUser: '',
    sessionToken: '',
    loginForm: { username: '', password: '' },
    loginError: '',
    isLoggingIn: false,
    
    serviceCategories: {},
    flatServices: [],
    flatAddons: [],
    addons: [],
    totalSales: 0,
    // Form models for new entries
    newService: { category: '', key: '', name: '', outcome: '', deliverables: '', oneTime: '', monthly: '' },
    newAddon: { key: '', name: '', description: '', oneTime: '', monthly: '' },
    // Save all changes flag (not used but could be for UI)
    saving: false,
    // API base URL
    apiBase: window.location.origin,
    
    async init() {
      try {
        // Load data from server
        const response = await fetch(`${this.apiBase}/api/services`);
        if (response.ok) {
          window.serviceData = await response.json();
        } else {
          console.warn('Failed to load services from server, using default data');
          // Fall back to default data if server fails
          if (!window.serviceData) {
            window.serviceData = { serviceCategories: {}, addons: [] };
          }
        }
      } catch (err) {
        console.warn('Could not load services from server, using default data', err);
        // Fall back to default data if server fails
        if (!window.serviceData) {
          window.serviceData = { serviceCategories: {}, addons: [] };
        }
      }
      
      // Ensure window.serviceData exists
      if (!window.serviceData) {
        window.serviceData = { serviceCategories: {}, addons: [] };
      }
      
      // Copy categories to internal state
      this.serviceCategories = window.serviceData.serviceCategories || {};
      
      // Flatten services into a single list for display
      this.flatServices = [];
      for (const [catKey, cat] of Object.entries(this.serviceCategories)) {
        (cat.services || []).forEach(svc => {
          this.flatServices.push({
            key: svc.key,
            name: svc.name,
            outcome: svc.outcome || '',
            deliverables: (svc.deliverables || []).join(', '),
            priceOneTime: svc.price?.oneTime || 0,
            priceMonthly: svc.price?.monthly || 0,
            category: catKey
          });
        });
      }
      
      // Load add-ons
      let addonList = [];
      if (window.serviceData.addons && Array.isArray(window.serviceData.addons)) addonList = window.serviceData.addons;
      else if (window.serviceData.serviceCategories?.addons) addonList = window.serviceData.serviceCategories.addons;
      this.flatAddons = addonList.map(a => ({
        key: a.key,
        name: a.name,
        description: a.description || '',
        priceOneTime: a.price?.oneTime || 0,
        priceMonthly: a.price?.monthly || 0
      }));
      
      // initialise form categories with first category key if available
      const firstCat = Object.keys(this.serviceCategories)[0] || '';
      if (!this.newService.category) this.newService.category = firstCat;
      
      // Check if user is already logged in (check localStorage for session)
      this.checkExistingSession();
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
        const response = await fetch(`${this.apiBase}/api/admin/session`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        });

        if (response.status === 401) {
          this.clearSession();
        } else {
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
    
    /**
     * Find the original service definition by key from the current window.serviceData
     * Used to preserve outcome, deliverables and other metadata when saving changes.
     * @param {string} key
     */
    findOriginalService(key) {
      const cats = window.serviceData?.serviceCategories || {};
      for (const cat of Object.values(cats)) {
        const svc = (cat.services || []).find(s => s.key === key);
        if (svc) return svc;
      }
      return null;
    },
    
    // Computed counts
    get servicesCount() {
      return this.flatServices.length;
    },
    get addonsCount() {
      return this.flatAddons.length;
    },
    
    // Format USD
    fmtUSD(amount) {
      if (!amount || amount === 0) return '$0';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
    },

    /**
     * Add a new service to the catalog
     */
    addService() {
      const { category, key, name, outcome, deliverables, oneTime, monthly } = this.newService;
      if (!category || !key || !name) {
        alert('Please fill out category, key and name');
        return;
      }
      // Ensure category exists
      if (!this.serviceCategories[category]) {
        this.serviceCategories[category] = { description: '', services: [] };
      }
      // Check duplicate key
      for (const cat of Object.values(this.serviceCategories)) {
        if (cat.services.some(s => s.key === key)) {
          alert('Service key already exists');
          return;
        }
      }
      const priceOne = parseFloat(oneTime) || 0;
      const priceMon = parseFloat(monthly) || 0;
      // Parse deliverables from comma-separated string
      const deliverableList = (deliverables || '')
        .split(',')
        .map(d => d.trim())
        .filter(Boolean);
      const newSvc = {
        key: key,
        name: name,
        outcome: outcome || '',
        deliverables: deliverableList,
        price: { oneTime: priceOne, monthly: priceMon }
      };
      this.serviceCategories[category].services.push(newSvc);
      this.flatServices.push({ key, name, outcome: outcome || '', deliverables: deliverableList.join(', '), priceOneTime: priceOne, priceMonthly: priceMon, category });
      // Reset form fields
      this.newService.key = '';
      this.newService.name = '';
      this.newService.outcome = '';
      this.newService.deliverables = '';
      this.newService.oneTime = '';
      this.newService.monthly = '';
      // Persist
      this.saveData();
    },
    
    /**
     * Delete a service by key
     */
    deleteService(key) {
      for (const catKey in this.serviceCategories) {
        const cat = this.serviceCategories[catKey];
        const idx = cat.services.findIndex(s => s.key === key);
        if (idx >= 0) {
          cat.services.splice(idx, 1);
          break;
        }
      }
      this.flatServices = this.flatServices.filter(s => s.key !== key);
      this.saveData();
    },
    
    /**
     * Add a new add-on
     */
    addAddon() {
      const { key, name, description, oneTime, monthly } = this.newAddon;
      if (!key || !name) {
        alert('Please fill out key and name for the add-on');
        return;
      }
      // Duplicate check
      if (this.flatAddons.some(a => a.key === key)) {
        alert('Add-on key already exists');
        return;
      }
      const priceOne = parseFloat(oneTime) || 0;
      const priceMon = parseFloat(monthly) || 0;
      const newAddon = {
        key: key,
        name: name,
        description: description || '',
        price: { oneTime: priceOne, monthly: priceMon },
        applicableServices: ['all']
      };
      // Add to global data structure
      if (!window.serviceData.addons) window.serviceData.addons = [];
      window.serviceData.addons.push(newAddon);
      this.flatAddons.push({ key, name, description: description || '', priceOneTime: priceOne, priceMonthly: priceMon });
      // Reset form
      this.newAddon.key = '';
      this.newAddon.name = '';
      this.newAddon.description = '';
      this.newAddon.oneTime = '';
      this.newAddon.monthly = '';
      this.saveData();
    },
    
    /**
     * Delete an add-on by key
     */
    deleteAddon(key) {
      if (window.serviceData.addons) {
        const idx = window.serviceData.addons.findIndex(a => a.key === key);
        if (idx >= 0) window.serviceData.addons.splice(idx, 1);
      }
      this.flatAddons = this.flatAddons.filter(a => a.key !== key);
      this.saveData();
    },
    
    /**
     * Save all changes made to services and add-ons.
     * This rebuilds the serviceCategories object from the flat lists and
     * merges in existing metadata (e.g. outcome, deliverables).
     */
    async saveChanges() {
      // Build new category structure
      const newCategories = {};
      this.flatServices.forEach(svc => {
        const catKey = svc.category || '';
        if (!newCategories[catKey]) {
          // Preserve existing category description if available
          const existingCat = this.serviceCategories[catKey] || {};
          newCategories[catKey] = {
            description: existingCat.description || '',
            services: []
          };
        }
        // Preserve existing metadata
        const orig = this.findOriginalService(svc.key) || {};
        const updatedSvc = {
          key: svc.key,
          name: svc.name,
          // Use edited outcome if provided; otherwise fall back to original
          outcome: svc.outcome !== undefined ? svc.outcome : (orig.outcome || ''),
          // Parse deliverables from comma-separated string if edited, else use original array
          deliverables: svc.deliverables !== undefined
            ? svc.deliverables.split(',').map(d => d.trim()).filter(Boolean)
            : (orig.deliverables || []),
          sla: orig.sla || '',
          price: {
            oneTime: parseFloat(svc.priceOneTime) || 0,
            monthly: parseFloat(svc.priceMonthly) || 0
          }
        };
        newCategories[catKey].services.push(updatedSvc);
      });
      
      // Replace categories
      this.serviceCategories = newCategories;
      
      // Update global serviceData
      window.serviceData.serviceCategories = newCategories;
      
      // Update add-ons
      // Build new add-ons list preserving applicableServices if present
      const newAddons = this.flatAddons.map(a => {
        // Find original addon by key
        let orig = null;
        if (window.serviceData.addons) {
          orig = window.serviceData.addons.find(item => item.key === a.key);
        }
        return {
          key: a.key,
          name: a.name,
          description: a.description || '',
          price: {
            oneTime: parseFloat(a.priceOneTime) || 0,
            monthly: parseFloat(a.priceMonthly) || 0
          },
          applicableServices: orig?.applicableServices || ['all']
        };
      });
      window.serviceData.addons = newAddons;
      
      // Persist all data
      await this.saveData();
      alert('Changes saved successfully');
    },

    /**
     * Move a service up or down in the flat list. Updates only the view; call saveChanges() to persist.
     */
    moveServiceUp(index) {
      if (index <= 0) return;
      const item = this.flatServices.splice(index, 1)[0];
      this.flatServices.splice(index - 1, 0, item);
    },
    moveServiceDown(index) {
      if (index >= this.flatServices.length - 1) return;
      const item = this.flatServices.splice(index, 1)[0];
      this.flatServices.splice(index + 1, 0, item);
    },
    moveAddonUp(index) {
      if (index <= 0) return;
      const item = this.flatAddons.splice(index, 1)[0];
      this.flatAddons.splice(index - 1, 0, item);
    },
    moveAddonDown(index) {
      if (index >= this.flatAddons.length - 1) return;
      const item = this.flatAddons.splice(index, 1)[0];
      this.flatAddons.splice(index + 1, 0, item);
    },

    // Drag-and-drop support
    dragServiceIndex: null,
    dragAddonIndex: null,
    handleServiceDragStart(event, index) {
      this.dragServiceIndex = index;
    },
    handleServiceDrop(event, index) {
      if (this.dragServiceIndex === null || this.dragServiceIndex === index) return;
      const item = this.flatServices.splice(this.dragServiceIndex, 1)[0];
      this.flatServices.splice(index, 0, item);
      this.dragServiceIndex = null;
    },
    handleAddonDragStart(event, index) {
      this.dragAddonIndex = index;
    },
    handleAddonDrop(event, index) {
      if (this.dragAddonIndex === null || this.dragAddonIndex === index) return;
      const item = this.flatAddons.splice(this.dragAddonIndex, 1)[0];
      this.flatAddons.splice(index, 0, item);
      this.dragAddonIndex = null;
    },
    
    /**
     * Persist current serviceData to server
     */
    async saveData() {
      try {
        // Update window.serviceData from serviceCategories structure
        window.serviceData.serviceCategories = this.serviceCategories;
        
        // Save to server
        const response = await fetch(`${this.apiBase}/api/services`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.sessionToken}`
          },
          body: JSON.stringify(window.serviceData)
        });
        
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
        
        console.log('Services saved to server successfully');
        return true;
      } catch (error) {
        console.error('Error saving to server:', error);
        alert('Failed to save to server. Please try again.');
        return false;
      }
    }
  };
}