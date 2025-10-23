// Data Storage
let inventory = [];
let suppliers = [];
let orders = [];
let customers = [];
let leads = [];
let quotes = [];
let projects = [];
let settings = {};
let currentBOMLeadIndex = null;
let currentEditingLeadIndex = null;
let currentLeadView = 'kanban'; // 'kanban' or 'table'
let currentQuoteItems = [];
let currentUser = null;
let currentUserId = null;
let currentCompanyId = null;
let currentUserRole = 'owner'; // 'owner' or 'staff'
let staffMembers = [];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to initialize
    setTimeout(() => {
        console.log('Checking Firebase initialization...');
        console.log('Firebase Auth:', window.firebaseAuth ? 'Initialized' : 'NOT initialized');
        console.log('Firebase DB:', window.firebaseDb ? 'Initialized' : 'NOT initialized');
        console.log('Firebase Storage:', window.firebaseStorage ? 'Initialized' : 'NOT initialized');
        
        if (!window.firebaseAuth || !window.firebaseDb || !window.firebaseStorage) {
            console.error('Firebase not fully initialized!');
            alert('Firebase initialization error. Please refresh the page.');
            return;
        }
        
        setupAuthentication();
    }, 1000);
});

// Firebase Authentication Setup
function setupAuthentication() {
    if (!window.firebaseAuth) {
        console.error('Firebase not initialized');
        return;
    }

    // Login mode change handler
    document.getElementById('loginMode').addEventListener('change', async (e) => {
        const mode = e.target.value;
        const companyDiv = document.getElementById('companySelectDiv');
        
        if (mode === 'staff') {
            companyDiv.style.display = 'block';
            await loadAvailableCompanies();
        } else {
            companyDiv.style.display = 'none';
        }
    });

    // Check authentication state
    window.firebaseOnAuthChange(window.firebaseAuth, async (user) => {
        if (user) {
            currentUser = user;
            currentUserId = user.uid;
            
            // Determine role and company
            const loginMode = document.getElementById('loginMode')?.value || 'owner';
            
            if (loginMode === 'owner') {
                currentUserRole = 'owner';
                currentCompanyId = user.uid; // Owner's company ID is their user ID
            } else {
                currentUserRole = 'staff';
                const selectedCompany = document.getElementById('loginCompanySelect')?.value;
                if (selectedCompany) {
                    currentCompanyId = selectedCompany;
                } else {
                    alert('Please select a company');
                    await handleLogout();
                    return;
                }
            }
            
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('appContainer').style.display = 'flex';
            document.getElementById('userEmail').textContent = user.email + (currentUserRole === 'staff' ? ' (Staff)' : ' (Owner)');
            
            // Load data from Firebase
            await loadDataFromFirebase();
            await loadSettingsFromFirebase();
            await loadStaffMembers();
            
            // Show/hide user management based on role
            const userMgmtSection = document.getElementById('userManagementSection');
            if (userMgmtSection) {
                userMgmtSection.style.display = currentUserRole === 'owner' ? 'block' : 'none';
            }
            
            // Initialize app
            setupEventListeners();
            updateDashboard();
            renderInventory();
            renderSuppliers();
            renderOrders();
            renderCustomers();
            renderLeadsKanban();
            renderQuotes();
            renderStaffMembers();
            applySettings();
        } else {
            currentUser = null;
            currentUserId = null;
            currentCompanyId = null;
            currentUserRole = 'owner';
            document.getElementById('loginScreen').style.display = 'flex';
            document.getElementById('appContainer').style.display = 'none';
        }
    });

    // Login form handler
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const mode = document.getElementById('loginMode').value;
        
        if (mode === 'staff') {
            const companyId = document.getElementById('loginCompanySelect').value;
            if (!companyId) {
                alert('Please select a company');
                return;
            }
            
            // Verify user is authorized for this company
            try {
                const userCredential = await window.firebaseSignIn(window.firebaseAuth, email, password);
                const staffDoc = await window.firebaseGetDoc(
                    window.firebaseDoc(window.firebaseDb, 'companies', companyId, 'staff', userCredential.user.uid)
                );
                
                if (!staffDoc.exists()) {
                    alert('You are not authorized to access this company');
                    await handleLogout();
                    return;
                }
            } catch (error) {
                alert('Login failed: ' + error.message);
            }
        } else {
            try {
                await window.firebaseSignIn(window.firebaseAuth, email, password);
            } catch (error) {
                alert('Login failed: ' + error.message);
            }
        }
    });

    // Register form handler
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const name = document.getElementById('registerName').value;
        
        try {
            const userCredential = await window.firebaseCreateUser(window.firebaseAuth, email, password);
            // Create user profile in Firestore
            await window.firebaseSetDoc(window.firebaseDoc(window.firebaseDb, 'users', userCredential.user.uid), {
                name: name,
                email: email,
                role: 'owner',
                createdAt: new Date().toISOString()
            });
            
            // Create company profile
            await window.firebaseSetDoc(window.firebaseDoc(window.firebaseDb, 'companies', userCredential.user.uid), {
                ownerEmail: email,
                ownerName: name,
                createdAt: new Date().toISOString()
            });
            
            alert('Account created successfully! Please login.');
            showLoginForm();
        } catch (error) {
            alert('Registration failed: ' + error.message);
        }
    });
}

async function loadAvailableCompanies() {
    const email = document.getElementById('loginEmail').value;
    if (!email) {
        alert('Please enter your email first');
        return;
    }
    
    try {
        // Query all companies where this email is a staff member
        const companiesSnapshot = await window.firebaseGetDocs(
            window.firebaseCollection(window.firebaseDb, 'companies')
        );
        
        const select = document.getElementById('loginCompanySelect');
        select.innerHTML = '<option value="">Select a company...</option>';
        
        let foundCompanies = 0;
        for (const companyDoc of companiesSnapshot.docs) {
            const staffDoc = await window.firebaseGetDoc(
                window.firebaseDoc(window.firebaseDb, 'companies', companyDoc.id, 'staff', email.replace(/[^a-zA-Z0-9]/g, '_'))
            );
            
            if (staffDoc.exists()) {
                const companyData = companyDoc.data();
                select.innerHTML += `<option value="${companyDoc.id}">${companyData.ownerName || companyData.ownerEmail}'s Company</option>`;
                foundCompanies++;
            }
        }
        
        if (foundCompanies === 0) {
            select.innerHTML = '<option value="">No companies found</option>';
            alert('You are not added as staff to any company. Please contact the company owner.');
        }
    } catch (error) {
        console.error('Error loading companies:', error);
    }
}

function showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
}

function showRegisterForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

async function handleLogout() {
    try {
        await window.firebaseSignOut(window.firebaseAuth);
        // Clear local data
        inventory = [];
        suppliers = [];
        orders = [];
        customers = [];
        leads = [];
        quotes = [];
        settings = {};
        staffMembers = [];
        currentCompanyId = null;
        currentUserRole = 'owner';
    } catch (error) {
        alert('Logout failed: ' + error.message);
    }
}

// Staff Management Functions
async function addStaffMember() {
    if (currentUserRole !== 'owner') {
        alert('Only owners can add staff members');
        return;
    }
    
    const email = document.getElementById('newStaffEmail').value.trim();
    if (!email) {
        alert('Please enter an email address');
        return;
    }
    
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        alert('Please enter a valid email address');
        return;
    }
    
    try {
        // Add to company's staff collection
        const staffId = email.replace(/[^a-zA-Z0-9]/g, '_');
        await window.firebaseSetDoc(
            window.firebaseDoc(window.firebaseDb, 'companies', currentCompanyId, 'staff', staffId),
            {
                email: email,
                addedBy: currentUser.email,
                addedAt: new Date().toISOString(),
                status: 'invited'
            }
        );
        
        document.getElementById('newStaffEmail').value = '';
        await loadStaffMembers();
        alert(`Staff member ${email} added successfully!`);
    } catch (error) {
        alert('Error adding staff member: ' + error.message);
    }
}

async function removeStaffMember(staffId) {
    if (currentUserRole !== 'owner') {
        alert('Only owners can remove staff members');
        return;
    }
    
    if (!confirm('Are you sure you want to remove this staff member?')) {
        return;
    }
    
    try {
        await window.firebaseDeleteDoc(
            window.firebaseDoc(window.firebaseDb, 'companies', currentCompanyId, 'staff', staffId)
        );
        await loadStaffMembers();
        alert('Staff member removed successfully');
    } catch (error) {
        alert('Error removing staff member: ' + error.message);
    }
}

async function loadStaffMembers() {
    if (currentUserRole !== 'owner' || !currentCompanyId) {
        return;
    }
    
    try {
        const staffSnapshot = await window.firebaseGetDocs(
            window.firebaseCollection(window.firebaseDb, 'companies', currentCompanyId, 'staff')
        );
        
        staffMembers = [];
        staffSnapshot.forEach(doc => {
            staffMembers.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        renderStaffMembers();
    } catch (error) {
        console.error('Error loading staff members:', error);
    }
}

function renderStaffMembers() {
    const tbody = document.getElementById('staffMembersTable');
    if (!tbody) return;
    
    if (staffMembers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No staff members added yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = staffMembers.map(staff => `
        <tr>
            <td>${staff.email}</td>
            <td><span class="badge badge-${staff.status === 'active' ? 'active' : 'pending'}">${staff.status || 'invited'}</span></td>
            <td>${new Date(staff.addedAt).toLocaleDateString()}</td>
            <td>
                <button class="btn-action btn-delete" onclick="removeStaffMember('${staff.id}')">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </td>
        </tr>
    `).join('');
}

// Load data from Firebase
async function loadDataFromFirebase() {
    if (!currentCompanyId) {
        console.log('No company ID, skipping Firebase load');
        return;
    }
    
    try {
        console.log('Loading data from Firebase for company:', currentCompanyId);
        const userDoc = await window.firebaseGetDoc(window.firebaseDoc(window.firebaseDb, 'companies', currentCompanyId, 'data', 'main'));
        if (userDoc.exists()) {
            const data = userDoc.data();
            inventory = data.inventory || [];
            suppliers = data.suppliers || [];
            orders = data.orders || [];
            customers = data.customers || [];
            leads = data.leads || [];
            quotes = data.quotes || [];
            projects = data.projects || [];
            console.log('Data loaded from Firebase:', {
                inventory: inventory.length,
                suppliers: suppliers.length,
                orders: orders.length,
                customers: customers.length,
                leads: leads.length,
                quotes: quotes.length,
                projects: projects.length
            });
        } else {
            console.log('No data document exists in Firebase yet');
        }
    } catch (error) {
        console.error('Error loading data from Firebase:', error);
        alert('Error loading data from Firebase: ' + error.message);
    }
}

// Load settings from Firebase
async function loadSettingsFromFirebase() {
    if (!currentCompanyId) return;
    
    try {
        const settingsDoc = await window.firebaseGetDoc(window.firebaseDoc(window.firebaseDb, 'companies', currentCompanyId, 'data', 'settings'));
        if (settingsDoc.exists()) {
            settings = settingsDoc.data();
        } else {
            // Default settings
            settings = {
                companyName: 'Your Company Name',
                companyEmail: 'info@company.com',
                companyPhone: '(555) 123-4567',
                companyWebsite: 'www.company.com',
                companyAddress: 'Street Address, City, State ZIP',
                companyLogo: '',
                currencySymbol: '$',
                dateFormat: 'MM/DD/YYYY',
                quoteTerms: 'Payment terms: 50% upfront, 50% on completion.\nDelivery: 2-4 weeks from order confirmation.\nWarranty: 1 year parts and labor.',
                invoiceTerms: 'Payment due within 30 days.\nLate fee: 2% per month on overdue balance.',
                quoteValidity: 30,
                paymentDue: 30,
                primaryColor: '#4f46e5',
                quoteTheme: 'modern'
            };
        }
        
        // Update header with logo and company name
        updateHeaderLogo();
    } catch (error) {
        console.error('Error loading settings from Firebase:', error);
    }
}

// Update header logo and company name
function updateHeaderLogo() {
    const headerLogoImg = document.getElementById('headerLogoImg');
    const headerLogoIcon = document.getElementById('headerLogoIcon');
    const headerCompanyName = document.getElementById('headerCompanyName');
    
    if (settings.companyLogo) {
        headerLogoImg.src = settings.companyLogo;
        headerLogoImg.style.display = 'block';
        headerLogoIcon.style.display = 'none';
    } else {
        headerLogoImg.style.display = 'none';
        headerLogoIcon.style.display = 'block';
    }
    
    if (settings.companyName && settings.companyName !== 'Your Company Name') {
        headerCompanyName.textContent = settings.companyName;
    }
}

// Save data to Firebase
async function saveDataToFirebase() {
    if (!currentCompanyId) {
        console.log('No company ID, skipping Firebase save');
        return;
    }
    
    try {
        console.log('Saving data to Firebase for company:', currentCompanyId);
        console.log('Data to save:', {
            inventory: inventory.length,
            suppliers: suppliers.length,
            orders: orders.length,
            customers: customers.length,
            leads: leads.length,
            quotes: quotes.length
        });
        
        await window.firebaseSetDoc(window.firebaseDoc(window.firebaseDb, 'companies', currentCompanyId, 'data', 'main'), {
            inventory: inventory,
            suppliers: suppliers,
            orders: orders,
            customers: customers,
            leads: leads,
            quotes: quotes,
            projects: projects,
            lastUpdated: new Date().toISOString(),
            lastUpdatedBy: currentUser.email
        });
        
        console.log('Data successfully saved to Firebase');
    } catch (error) {
        console.error('Error saving data to Firebase:', error);
        alert('Error saving data to Firebase: ' + error.message);
    }
}

// Save settings to Firebase
async function saveSettingsToFirebase() {
    if (!currentCompanyId) return;
    
    try {
        await window.firebaseSetDoc(window.firebaseDoc(window.firebaseDb, 'companies', currentCompanyId, 'data', 'settings'), settings);
    } catch (error) {
        console.error('Error saving settings to Firebase:', error);
    }
}

// Logo upload handler
async function handleLogoUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        alert('File size must be less than 2MB');
        input.value = '';
        return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        input.value = '';
        return;
    }
    
    try {
        // Upload to Firebase Storage
        const storageRef = window.firebaseStorageRef(window.firebaseStorage, `logos/${currentCompanyId}/${file.name}`);
        await window.firebaseUploadBytes(storageRef, file);
        const downloadURL = await window.firebaseGetDownloadURL(storageRef);
        
        // Save URL to settings
        document.getElementById('settingsCompanyLogo').value = downloadURL;
        document.getElementById('logoPreviewImg').src = downloadURL;
        document.getElementById('logoPreview').style.display = 'block';
        
        // Update settings object and header immediately
        settings.companyLogo = downloadURL;
        updateHeaderLogo();
        
        alert('Logo uploaded successfully!');
    } catch (error) {
        alert('Error uploading logo: ' + error.message);
    }
}

async function removeLogo() {
    if (!confirm('Are you sure you want to remove the logo?')) return;
    
    document.getElementById('settingsCompanyLogo').value = '';
    document.getElementById('logoPreview').style.display = 'none';
    document.getElementById('settingsCompanyLogoFile').value = '';
}

// Load data from localStorage (fallback)
function loadData() {
    const savedInventory = localStorage.getItem('inventory');
    const savedSuppliers = localStorage.getItem('suppliers');
    const savedOrders = localStorage.getItem('orders');
    const savedCustomers = localStorage.getItem('customers');
    const savedLeads = localStorage.getItem('leads');
    const savedQuotes = localStorage.getItem('quotes');
    const savedProjects = localStorage.getItem('projects');
    
    if (savedInventory) inventory = JSON.parse(savedInventory);
    if (savedSuppliers) suppliers = JSON.parse(savedSuppliers);
    if (savedOrders) orders = JSON.parse(savedOrders);
    if (savedCustomers) customers = JSON.parse(savedCustomers);
    if (savedLeads) leads = JSON.parse(savedLeads);
    if (savedQuotes) quotes = JSON.parse(savedQuotes);
    if (savedProjects) projects = JSON.parse(savedProjects);
}

// Load settings (fallback)
function loadSettings() {
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
    } else {
        // Default settings
        settings = {
            companyName: 'Your Company Name',
            companyEmail: 'info@company.com',
            companyPhone: '(555) 123-4567',
            companyWebsite: 'www.company.com',
            companyAddress: 'Street Address, City, State ZIP',
            companyLogo: '',
            currencySymbol: '$',
            dateFormat: 'MM/DD/YYYY',
            quoteTerms: 'Payment terms: 50% upfront, 50% on completion.\nDelivery: 2-4 weeks from order confirmation.\nWarranty: 1 year parts and labor.',
            invoiceTerms: 'Payment due within 30 days.\nLate fee: 2% per month on overdue balance.\nAccepted payment methods: Cash, Check, Bank Transfer.',
            quoteValidity: 30,
            paymentDue: 30,
            primaryColor: '#4f46e5',
            quoteTheme: 'modern',
            invoiceTheme: 'modern'
        };
    }
}

// Save data to localStorage (fallback)
function saveData() {
    localStorage.setItem('inventory', JSON.stringify(inventory));
    localStorage.setItem('suppliers', JSON.stringify(suppliers));
    localStorage.setItem('orders', JSON.stringify(orders));
    localStorage.setItem('customers', JSON.stringify(customers));
    localStorage.setItem('leads', JSON.stringify(leads));
    localStorage.setItem('quotes', JSON.stringify(quotes));
    localStorage.setItem('projects', JSON.stringify(projects));
    
    // Also save to Firebase
    saveDataToFirebase();
}

// Event Listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            switchPage(page);
        });
    });
    
    // Filter buttons
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const parentButtons = e.target.parentElement.querySelectorAll('.btn-filter');
            parentButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            if (e.target.dataset.filter) {
                const filter = e.target.dataset.filter;
                filterInventory(filter);
            } else if (e.target.dataset.filterLead) {
                const filter = e.target.dataset.filterLead;
                filterLeads(filter);
            }
        });
    });
    
    // Forms
    document.getElementById('addItemForm').addEventListener('submit', handleAddItem);
    document.getElementById('addSupplierForm').addEventListener('submit', handleAddSupplier);
    document.getElementById('createOrderForm').addEventListener('submit', handleCreateOrder);
    document.getElementById('addCustomerForm').addEventListener('submit', handleAddCustomer);
    document.getElementById('addLeadForm').addEventListener('submit', handleAddLead);
    document.getElementById('quickAddCustomerForm').addEventListener('submit', handleQuickAddCustomer);
    
    // Image upload preview
    document.getElementById('itemImage').addEventListener('change', handleImagePreview);
    
    // Item type change - show/hide image upload
    document.getElementById('itemType').addEventListener('change', function() {
        const imageGroup = document.getElementById('itemImageGroup');
        if (this.value === 'hardware') {
            imageGroup.style.display = 'block';
        } else {
            imageGroup.style.display = 'none';
            document.getElementById('itemImage').value = '';
            document.getElementById('imagePreview').innerHTML = '';
        }
    });
    
    // Close modals on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

// Page Navigation
function switchPage(pageName) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-page="${pageName}"]`).classList.add('active');
    
    // Update page content
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    // Try by data-page attribute first, then by ID
    let targetPage = document.querySelector(`.page[data-page="${pageName}"]`);
    if (!targetPage) {
        targetPage = document.getElementById(pageName);
    }
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // Update page title
    const titles = {
        dashboard: 'Dashboard',
        inventory: 'Inventory Management',
        suppliers: 'Supplier Management',
        orders: 'Purchase Orders',
        customers: 'Customer Management',
        leads: 'Lead Management',
        quotes: 'Quotes & Estimates',
        projects: 'Active Projects',
        finance: 'Financial Overview',
        settings: 'Settings'
    };
    document.getElementById('page-title').textContent = titles[pageName];
    
    // Load data when switching to specific pages
    if (pageName === 'settings') {
        populateSettings();
    } else if (pageName === 'projects') {
        renderProjects();
    } else if (pageName === 'finance') {
        renderFinance();
    }
}

// Dashboard Updates
function updateDashboard() {
    // Update stats
    document.getElementById('totalItems').textContent = inventory.length;
    document.getElementById('totalSuppliers').textContent = suppliers.length;
    document.getElementById('totalCustomers').textContent = customers.length;
    document.getElementById('totalLeads').textContent = leads.filter(l => l.status !== 'converted' && l.status !== 'lost').length;
    
    const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
    document.getElementById('pendingOrders').textContent = pendingOrdersCount;
    
    const totalValue = inventory.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    document.getElementById('totalValue').textContent = `$${totalValue.toLocaleString()}`;
    
    // Count active leads (not won or lost)
    const activeLeads = leads.filter(l => l.stage !== 'won' && l.stage !== 'lost').length;
    document.getElementById('totalLeads').textContent = activeLeads;
    
    // Update recent activity
    updateRecentActivity();
}

function updateRecentActivity() {
    const activityList = document.getElementById('activityList');
    
    if (inventory.length === 0 && suppliers.length === 0 && orders.length === 0 && customers.length === 0 && leads.length === 0) {
        activityList.innerHTML = '<p class="empty-state">No recent activity</p>';
        return;
    }
    
    let activities = [];
    
    // Get recent items (last 3)
    const recentItems = inventory.slice(-3).reverse();
    recentItems.forEach(item => {
        activities.push({
            type: 'item',
            text: `Added new ${item.type}: ${item.name}`,
            time: 'Recently'
        });
    });
    
    // Get recent leads (last 2)
    const recentLeads = leads.slice(-2).reverse();
    recentLeads.forEach(lead => {
        activities.push({
            type: 'lead',
            text: `New lead: ${lead.name} from ${lead.company}`,
            time: 'Recently'
        });
    });
    
    activityList.innerHTML = activities.slice(0, 5).map(activity => `
        <div class="activity-item">
            <strong>${activity.text}</strong>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                ${activity.time}
            </div>
        </div>
    `).join('') || '<p class="empty-state">No recent activity</p>';
}

// Inventory Management
function renderInventory() {
    const tbody = document.getElementById('inventoryTable');
    
    if (inventory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No items in inventory</td></tr>';
        return;
    }
    
    tbody.innerHTML = inventory.map((item, index) => `
        <tr class="main-row" data-index="${index}">
            <td>
                <i class="fas fa-chevron-right expand-icon" onclick="toggleDetailRow(${index}, 'inventory')"></i>
            </td>
            <td><strong>${item.code}</strong></td>
            <td>${item.name}</td>
            <td><span class="badge badge-${item.type}">${item.type}</span></td>
            <td>${item.supplier}</td>
            <td>${item.quantity}</td>
            <td>$${item.price.toFixed(2)}</td>
            <td>$${(item.quantity * item.price).toFixed(2)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action btn-edit" onclick="editItem(${index})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-action btn-delete" onclick="deleteItem(${index})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
        <tr class="detail-row" id="detail-inventory-${index}">
            <td colspan="9">
                <div class="detail-content">
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Item Code</span>
                            <span class="detail-value">${item.code}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Full Name</span>
                            <span class="detail-value">${item.name}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Type</span>
                            <span class="detail-value">${item.type}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Supplier</span>
                            <span class="detail-value">${item.supplier}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Quantity in Stock</span>
                            <span class="detail-value">${item.quantity}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Unit Price</span>
                            <span class="detail-value">$${item.price.toFixed(2)}</span>
                        </div>
                    </div>
                    ${item.description ? `
                        <div class="detail-item" style="margin-top: 12px;">
                            <span class="detail-label">Description</span>
                            <span class="detail-value">${item.description}</span>
                        </div>
                    ` : ''}
                    ${item.image ? `
                        <div class="detail-item" style="margin-top: 12px;">
                            <span class="detail-label">Product Image</span>
                            <img src="${item.image}" alt="${item.name}" class="item-image-preview">
                        </div>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function filterInventory(filter) {
    const tbody = document.getElementById('inventoryTable');
    
    // Update button states
    document.querySelectorAll('.filter-buttons .btn-filter').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-filter') === filter) {
            btn.classList.add('active');
        }
    });
    
    let filtered = inventory;
    if (filter !== 'all') {
        filtered = inventory.filter(item => item.type === filter);
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No items found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map((item, originalIndex) => {
        const index = inventory.indexOf(item);
        return `
        <tr class="main-row" data-index="${index}">
            <td>
                <i class="fas fa-chevron-right expand-icon" onclick="toggleDetailRow(${index}, 'inventory')"></i>
            </td>
            <td><strong>${item.code}</strong></td>
            <td>${item.name}</td>
            <td><span class="badge badge-${item.type}">${item.type}</span></td>
            <td>${item.supplier}</td>
            <td>${item.quantity}</td>
            <td>$${item.price.toFixed(2)}</td>
            <td>$${(item.quantity * item.price).toFixed(2)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action btn-edit" onclick="editItem(${index})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-action btn-delete" onclick="deleteItem(${index})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
        <tr class="detail-row" id="detail-inventory-${index}">
            <td colspan="9">
                <div class="detail-content">
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Item Code</span>
                            <span class="detail-value">${item.code}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Full Name</span>
                            <span class="detail-value">${item.name}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Type</span>
                            <span class="detail-value">${item.type}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Supplier</span>
                            <span class="detail-value">${item.supplier}</span>
                        </div>
                    </div>
                    ${item.description ? `
                        <div class="detail-item" style="margin-top: 12px;">
                            <span class="detail-label">Description</span>
                            <span class="detail-value">${item.description}</span>
                        </div>
                    ` : ''}
                    ${item.image ? `
                        <div class="detail-item" style="margin-top: 12px;">
                            <span class="detail-label">Product Image</span>
                            <img src="${item.image}" alt="${item.name}" class="item-image-preview">
                        </div>
                    ` : ''}
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

function handleAddItem(e) {
    e.preventDefault();
    
    const imageFile = document.getElementById('itemImage').files[0];
    let imageData = null;
    
    const saveItem = (image) => {
        const item = {
            code: document.getElementById('itemCode').value,
            name: document.getElementById('itemName').value,
            type: document.getElementById('itemType').value,
            supplier: document.getElementById('itemSupplier').value,
            quantity: parseInt(document.getElementById('itemQuantity').value),
            price: parseFloat(document.getElementById('itemPrice').value),
            description: document.getElementById('itemDescription').value,
            image: image
        };
        
        inventory.push(item);
        saveData();
        renderInventory();
        updateDashboard();
        closeModal('addItemModal');
        e.target.reset();
        document.getElementById('imagePreview').innerHTML = '';
    };
    
    if (imageFile && document.getElementById('itemType').value === 'hardware') {
        const reader = new FileReader();
        reader.onload = function(event) {
            saveItem(event.target.result);
        };
        reader.readAsDataURL(imageFile);
    } else {
        saveItem(null);
    }
}

function editItem(index) {
    const item = inventory[index];
    // Populate form with item data
    document.getElementById('itemCode').value = item.code;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemType').value = item.type;
    document.getElementById('itemSupplier').value = item.supplier;
    document.getElementById('itemQuantity').value = item.quantity;
    document.getElementById('itemPrice').value = item.price;
    document.getElementById('itemDescription').value = item.description || '';
    
    // Show/hide image upload based on type
    const imageGroup = document.getElementById('itemImageGroup');
    if (item.type === 'hardware') {
        imageGroup.style.display = 'block';
        if (item.image) {
            document.getElementById('imagePreview').innerHTML = `<img src="${item.image}" alt="Preview">`;
        }
    } else {
        imageGroup.style.display = 'none';
    }
    
    // Remove the old item
    inventory.splice(index, 1);
    saveData();
    
    showAddItemModal();
}

function deleteItem(index) {
    if (confirm('Are you sure you want to delete this item?')) {
        inventory.splice(index, 1);
        saveData();
        renderInventory();
        updateDashboard();
    }
}

// Supplier Management
function renderSuppliers() {
    const grid = document.getElementById('suppliersGrid');
    
    if (suppliers.length === 0) {
        grid.innerHTML = '<p class="empty-state">No suppliers added yet</p>';
        return;
    }
    
    grid.innerHTML = suppliers.map((supplier, index) => `
        <div class="supplier-card">
            <h3>${supplier.name}</h3>
            <div class="supplier-info">
                <div><i class="fas fa-user"></i> ${supplier.contact}</div>
                <div><i class="fas fa-envelope"></i> ${supplier.email}</div>
                <div><i class="fas fa-phone"></i> ${supplier.phone}</div>
                ${supplier.address ? `<div><i class="fas fa-map-marker-alt"></i> ${supplier.address}</div>` : ''}
            </div>
            <div class="action-buttons" style="margin-top: 16px;">
                <button class="btn-action btn-edit" onclick="editSupplier(${index})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-action btn-delete" onclick="deleteSupplier(${index})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

function handleAddSupplier(e) {
    e.preventDefault();
    
    const supplier = {
        name: document.getElementById('supplierName').value,
        contact: document.getElementById('supplierContact').value,
        email: document.getElementById('supplierEmail').value,
        phone: document.getElementById('supplierPhone').value,
        address: document.getElementById('supplierAddress').value
    };
    
    suppliers.push(supplier);
    saveData();
    renderSuppliers();
    updateDashboard();
    updateSupplierSelects();
    closeModal('addSupplierModal');
    e.target.reset();
}

function editSupplier(index) {
    const supplier = suppliers[index];
    document.getElementById('supplierName').value = supplier.name;
    document.getElementById('supplierContact').value = supplier.contact;
    document.getElementById('supplierEmail').value = supplier.email;
    document.getElementById('supplierPhone').value = supplier.phone;
    document.getElementById('supplierAddress').value = supplier.address || '';
    
    suppliers.splice(index, 1);
    saveData();
    
    showAddSupplierModal();
}

function deleteSupplier(index) {
    if (confirm('Are you sure you want to delete this supplier?')) {
        suppliers.splice(index, 1);
        saveData();
        renderSuppliers();
        updateDashboard();
        updateSupplierSelects();
    }
}

function updateSupplierSelects() {
    const itemSupplierSelect = document.getElementById('itemSupplier');
    const orderSupplierSelect = document.getElementById('orderSupplier');
    
    const options = suppliers.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    
    itemSupplierSelect.innerHTML = '<option value="">Select Supplier</option>' + options;
    orderSupplierSelect.innerHTML = '<option value="">Select Supplier</option>' + options;
}

// Order Management
function renderOrders() {
    const tbody = document.getElementById('ordersTable');
    
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No orders created yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = orders.map((order, index) => {
        const statusColor = order.status === 'pending' ? '#f59e0b' : 
                           order.status === 'settled' ? '#10b981' : '#6366f1';
        const paidAmount = order.paidAmount || 0;
        const pendingAmount = order.totalAmount - paidAmount;
        
        return `
        <tr>
            <td><strong>${order.id}</strong>${order.projectId ? `<br><small style="color: #6366f1;">${order.projectId}</small>` : ''}</td>
            <td>${order.date}</td>
            <td>${order.supplier}</td>
            <td>${order.items.length} item(s)</td>
            <td>${settings.currencySymbol}${order.totalAmount.toFixed(2)}</td>
            <td>
                <span class="status-badge" style="background: ${statusColor};">
                    ${order.status.toUpperCase()}
                </span>
                ${order.status === 'pending' && paidAmount > 0 ? `<br><small>Paid: ${settings.currencySymbol}${paidAmount.toFixed(2)}</small>` : ''}
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action btn-view" onclick="viewOrder(${index})">
                        <i class="fas fa-eye"></i> View
                    </button>
                    ${order.status === 'pending' ? `
                    <button class="btn-action btn-success" onclick="payPurchaseOrder(${index})" style="background: #10b981;">
                        <i class="fas fa-dollar-sign"></i> Pay
                    </button>
                    ` : ''}
                    <button class="btn-action btn-delete" onclick="deleteOrder(${index})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

function handleCreateOrder(e) {
    e.preventDefault();
    
    const orderItems = [];
    const itemRows = document.querySelectorAll('.order-item-row');
    
    itemRows.forEach(row => {
        const select = row.querySelector('.order-item-select');
        const quantity = row.querySelector('.order-item-quantity');
        
        if (select.value && quantity.value) {
            const item = inventory.find(i => i.name === select.value);
            if (item) {
                orderItems.push({
                    name: item.name,
                    quantity: parseInt(quantity.value),
                    price: item.price
                });
            }
        }
    });
    
    const totalAmount = orderItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    
    const order = {
        id: 'PO-' + String(orders.length + 1).padStart(5, '0'),
        date: document.getElementById('orderDate').value,
        supplier: document.getElementById('orderSupplier').value,
        items: orderItems,
        totalAmount: totalAmount,
        status: 'pending',
        notes: document.getElementById('orderNotes').value
    };
    
    orders.push(order);
    saveData();
    renderOrders();
    updateDashboard();
    closeModal('createOrderModal');
    e.target.reset();
    
    // Reset order items to single row
    document.getElementById('orderItems').innerHTML = `
        <div class="order-item-row">
            <select class="order-item-select" required>
                <option value="">Select Item</option>
            </select>
            <input type="number" class="order-item-quantity" placeholder="Qty" min="1" required>
            <button type="button" class="btn-icon" onclick="removeOrderItem(this)">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    updateItemSelects();
}

function viewOrder(index) {
    const order = orders[index];
    alert(`Order Details:\n\nID: ${order.id}\nSupplier: ${order.supplier}\nDate: ${order.date}\nTotal: $${order.totalAmount.toFixed(2)}\nStatus: ${order.status}\n\nItems:\n${order.items.map(i => `- ${i.name} (${i.quantity}x @ $${i.price})`).join('\n')}`);
}

function deleteOrder(index) {
    if (confirm('Are you sure you want to delete this order?')) {
        orders.splice(index, 1);
        saveData();
        renderOrders();
        updateDashboard();
    }
}

// Pay Purchase Order
async function payPurchaseOrder(index) {
    const order = orders[index];
    const paidAmount = order.paidAmount || 0;
    const pendingAmount = order.totalAmount - paidAmount;
    
    const payment = prompt(`Pay Purchase Order: ${order.id}\nSupplier: ${order.supplier}\n\nTotal: ${settings.currencySymbol}${order.totalAmount.toFixed(2)}\nPaid: ${settings.currencySymbol}${paidAmount.toFixed(2)}\nPending: ${settings.currencySymbol}${pendingAmount.toFixed(2)}\n\nEnter payment amount:`, pendingAmount.toFixed(2));
    
    if (payment === null) return;
    
    const amount = parseFloat(payment) || 0;
    if (amount <= 0) {
        alert('Please enter a valid payment amount.');
        return;
    }
    
    if (amount > pendingAmount) {
        alert('Payment amount exceeds pending balance.');
        return;
    }
    
    // Update order
    order.paidAmount = paidAmount + amount;
    
    if (order.paidAmount >= order.totalAmount) {
        order.status = 'settled';
        order.paidDate = new Date().toISOString().split('T')[0];
    }
    
    // Update project if this PO is linked to a project
    if (order.projectId) {
        const project = projects.find(p => p.id === order.projectId);
        if (project) {
            project.paidToPOs += amount;
            project.pendingPOPayments -= amount;
        }
    }
    
    saveData();
    await saveDataToFirebase();
    renderOrders();
    renderProjects();
    renderFinance();
    
    alert(`✅ Payment recorded!\n\nPO: ${order.id}\nAmount Paid: ${settings.currencySymbol}${amount.toFixed(2)}\nNew Status: ${order.status}\n${order.status === 'settled' ? 'Purchase Order is now fully settled.' : `Remaining: ${settings.currencySymbol}${(order.totalAmount - order.paidAmount).toFixed(2)}`}`);
}

function addOrderItem() {
    const container = document.getElementById('orderItems');
    const newRow = document.createElement('div');
    newRow.className = 'order-item-row';
    newRow.innerHTML = `
        <select class="order-item-select" required>
            <option value="">Select Item</option>
            ${inventory.map(item => `<option value="${item.name}">${item.name} - $${item.price}</option>`).join('')}
        </select>
        <input type="number" class="order-item-quantity" placeholder="Qty" min="1" required>
        <button type="button" class="btn-icon" onclick="removeOrderItem(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(newRow);
}

function removeOrderItem(button) {
    const container = document.getElementById('orderItems');
    if (container.children.length > 1) {
        button.parentElement.remove();
    } else {
        alert('At least one item is required');
    }
}

function updateItemSelects() {
    const selects = document.querySelectorAll('.order-item-select');
    selects.forEach(select => {
        select.innerHTML = '<option value="">Select Item</option>' +
            inventory.map(item => `<option value="${item.name}">${item.name} - $${item.price}</option>`).join('');
    });
}

// Modal Functions
function showAddItemModal() {
    updateSupplierSelects();
    document.getElementById('addItemModal').classList.add('active');
}

function showAddSupplierModal() {
    document.getElementById('addSupplierModal').classList.add('active');
}

let currentOrderBomData = null;

function showCreateOrderModal() {
    updateSupplierSelects();
    updateItemSelects();
    currentOrderBomData = null;
    
    // Populate BOM select
    const bomSelect = document.getElementById('orderBomSelect');
    const bomOptions = [];
    
    // Add leads with BOMs
    leads.forEach((lead, index) => {
        if (lead.bom && lead.bom.length > 0) {
            const customer = customers.find(c => c.id === lead.customerId);
            bomOptions.push(`<option value="lead-${index}">Lead: ${lead.id} - ${lead.name} (${customer ? customer.name : 'Unknown'})</option>`);
        }
    });
    
    // Add standalone quotes
    quotes.forEach((quote, index) => {
        const customer = customers.find(c => c.id === quote.customerId);
        bomOptions.push(`<option value="quote-${index}">Quote: ${quote.id} - ${quote.projectName} (${customer ? customer.name : 'Unknown'})</option>`);
    });
    
    bomSelect.innerHTML = '<option value="">Select BOM/Quote or Create Manual Order</option>' + bomOptions.join('');
    
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('orderDate').value = today;
    
    document.getElementById('createOrderModal').classList.add('active');
}

function loadBomToOrder() {
    const bomSelect = document.getElementById('orderBomSelect');
    const selectedValue = bomSelect.value;
    
    if (!selectedValue) {
        currentOrderBomData = null;
        return;
    }
    
    const [type, index] = selectedValue.split('-');
    let bomItems = [];
    
    if (type === 'lead') {
        const lead = leads[parseInt(index)];
        bomItems = lead.bom.map(item => ({
            name: item.name,
            maxQty: parseInt(item.quantity),
            price: parseFloat(item.price)
        }));
    } else if (type === 'quote') {
        const quote = quotes[parseInt(index)];
        bomItems = quote.items.map(item => ({
            name: item.name,
            maxQty: parseInt(item.quantity),
            price: parseFloat(item.price)
        }));
    }
    
    currentOrderBomData = {
        type: type,
        index: parseInt(index),
        items: bomItems
    };
    
    // Populate order items from BOM
    const orderItemsDiv = document.getElementById('orderItems');
    orderItemsDiv.innerHTML = bomItems.map((item, idx) => `
        <div class="order-item-row">
            <select class="order-item-select" required onchange="validateOrderQuantity(this)">
                <option value="${item.name}">${item.name} (Max: ${item.maxQty})</option>
            </select>
            <input type="number" class="order-item-quantity" placeholder="Qty" min="1" max="${item.maxQty}" value="${item.maxQty}" required onchange="validateOrderQuantity(this.parentElement.querySelector('.order-item-select'))">
            <span class="order-item-max-qty" style="color: var(--text-secondary); font-size: 12px; margin-left: 8px;">Max: ${item.maxQty}</span>
            <button type="button" class="btn-icon" onclick="removeOrderItem(this)">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function validateOrderQuantity(selectElement) {
    if (!currentOrderBomData) return true;
    
    const row = selectElement.parentElement;
    const qtyInput = row.querySelector('.order-item-quantity');
    const selectedItemName = selectElement.value;
    
    const bomItem = currentOrderBomData.items.find(item => item.name === selectedItemName);
    if (bomItem) {
        const requestedQty = parseInt(qtyInput.value);
        if (requestedQty > bomItem.maxQty) {
            alert(`Cannot order more than ${bomItem.maxQty} units of ${selectedItemName} (as specified in BOM)`);
            qtyInput.value = bomItem.maxQty;
            return false;
        }
    }
    
    return true;
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Toggle Company field based on Customer Type
function toggleCompanyField(typeSelectId, companyGroupId) {
    const typeSelect = document.getElementById(typeSelectId);
    const companyGroup = document.getElementById(companyGroupId);
    
    if (typeSelect.value === 'Corporate') {
        companyGroup.style.display = 'block';
        companyGroup.querySelector('input').required = true;
    } else {
        companyGroup.style.display = 'none';
        companyGroup.querySelector('input').required = false;
        companyGroup.querySelector('input').value = '';
    }
}

// Customer Management
function renderCustomers() {
    const tbody = document.getElementById('customersTable');
    
    if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No customers added yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = customers.map((customer, index) => `
        <tr class="main-row" data-index="${index}">
            <td>
                <i class="fas fa-chevron-right expand-icon" onclick="toggleDetailRow(${index}, 'customer')"></i>
            </td>
            <td><strong>${customer.id}</strong></td>
            <td>${customer.name}</td>
            <td>${customer.company}</td>
            <td>${customer.email}</td>
            <td>${customer.phone}</td>
            <td><span class="badge badge-${(customer.type || 'other').toLowerCase()}">${customer.type || 'Other'}</span></td>
            <td><span class="badge badge-active">Active</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action btn-edit" onclick="editCustomer(${index})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-action btn-delete" onclick="deleteCustomer(${index})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
        <tr class="detail-row" id="detail-customer-${index}">
            <td colspan="9">
                <div class="detail-content">
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Customer ID</span>
                            <span class="detail-value">${customer.id}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Name</span>
                            <span class="detail-value">${customer.name}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Company</span>
                            <span class="detail-value">${customer.company}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Email</span>
                            <span class="detail-value">${customer.email}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Phone</span>
                            <span class="detail-value">${customer.phone}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Type</span>
                            <span class="detail-value">${customer.type || 'Other'}</span>
                        </div>
                    </div>
                    ${customer.address ? `
                        <div class="detail-item" style="margin-top: 12px;">
                            <span class="detail-label">Address</span>
                            <span class="detail-value">${customer.address}</span>
                        </div>
                    ` : ''}
                    ${customer.notes ? `
                        <div class="detail-item" style="margin-top: 12px;">
                            <span class="detail-label">Notes</span>
                            <span class="detail-value">${customer.notes}</span>
                        </div>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function handleAddCustomer(e) {
    e.preventDefault();
    
    const customerType = document.getElementById('customerType').value;
    const customer = {
        id: 'CUST-' + String(customers.length + 1).padStart(5, '0'),
        name: document.getElementById('customerName').value,
        company: customerType === 'Corporate' ? document.getElementById('customerCompany').value : '',
        email: document.getElementById('customerEmail').value,
        phone: document.getElementById('customerPhone').value,
        type: customerType,
        address: document.getElementById('customerAddress').value,
        notes: document.getElementById('customerNotes').value,
        createdDate: new Date().toISOString().split('T')[0]
    };
    
    customers.push(customer);
    saveData();
    saveDataToFirebase();
    renderCustomers();
    updateDashboard();
    updateCustomerSelects();
    closeModal('addCustomerModal');
    e.target.reset();
}

function editCustomer(index) {
    const customer = customers[index];
    document.getElementById('customerName').value = customer.name;
    document.getElementById('customerType').value = customer.type || 'Other';
    
    // Trigger company field visibility
    toggleCompanyField('customerType', 'customerCompanyGroup');
    
    document.getElementById('customerCompany').value = customer.company || '';
    document.getElementById('customerEmail').value = customer.email;
    document.getElementById('customerPhone').value = customer.phone;
    document.getElementById('customerAddress').value = customer.address || '';
    document.getElementById('customerNotes').value = customer.notes || '';
    
    customers.splice(index, 1);
    saveData();
    
    showAddCustomerModal();
}

function deleteCustomer(index) {
    if (confirm('Are you sure you want to delete this customer?')) {
        customers.splice(index, 1);
        saveData();
        renderCustomers();
        updateDashboard();
    }
}

// Lead Management
function renderLeadsKanban() {
    // Clear all columns
    document.querySelectorAll('.kanban-cards').forEach(column => {
        column.innerHTML = '';
    });
    
    // Group leads by stage
    const stages = ['initial-discussion', 'site-visit', 'measurements', 'estimate', 'estimate-approval', 'won', 'lost'];
    
    stages.forEach(stage => {
        const stageLeads = leads.filter(lead => lead.stage === stage);
        const column = document.querySelector(`.kanban-column[data-stage="${stage}"] .kanban-cards`);
        const countEl = document.querySelector(`.kanban-column[data-stage="${stage}"] .kanban-count`);
        
        countEl.textContent = stageLeads.length;
        
        if (stageLeads.length === 0) {
            column.innerHTML = '<div class="kanban-empty">No leads</div>';
        } else {
            column.innerHTML = stageLeads.map((lead, idx) => {
                const leadIndex = leads.indexOf(lead);
                const customer = customers.find(c => c.id === lead.customerId);
                const customerName = customer ? customer.name : 'N/A';
                const estimateValue = lead.bom ? `$${lead.bom.total.toFixed(2)}` : 'TBD';
                
                return `
                    <div class="kanban-card" draggable="true" data-lead-index="${leadIndex}" 
                         ondragstart="drag(event)" ondragend="dragEnd(event)">
                        <div class="kanban-card-header">
                            <span class="kanban-card-id">${lead.id}</span>
                        </div>
                        <div class="kanban-card-title">${lead.name}</div>
                        <div class="kanban-card-customer">
                            <i class="fas fa-user"></i> ${customerName}
                        </div>
                        <div class="kanban-card-value">
                            <i class="fas fa-dollar-sign"></i> ${estimateValue}
                        </div>
                        <div class="kanban-card-actions">
                            ${lead.stage === 'estimate' || lead.stage === 'estimate-approval' ? `
                                <button class="btn-action" style="background: rgba(20, 184, 166, 0.1); color: #14b8a6;" onclick="openBOMModal(${leadIndex}, event)">
                                    <i class="fas fa-calculator"></i>
                                </button>
                            ` : ''}
                            <button class="btn-action btn-edit" onclick="editLead(${leadIndex}, event)">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-action btn-delete" onclick="deleteLead(${leadIndex}, event)">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    });
}

function renderLeadsTable() {
    const tbody = document.getElementById('leadsTableBody');
    
    if (leads.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No leads added yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = leads.map((lead, index) => {
        const customer = customers.find(c => c.id === lead.customerId);
        const customerName = customer ? customer.name : 'N/A';
        const estimateValue = lead.bom ? `$${lead.bom.total.toFixed(2)}` : 'TBD';
        
        return `
        <tr class="main-row" data-index="${index}">
            <td>
                <i class="fas fa-chevron-right expand-icon" onclick="toggleDetailRow(${index}, 'lead')"></i>
            </td>
            <td><strong>${lead.id}</strong></td>
            <td>${customerName}</td>
            <td><span class="badge badge-${lead.stage}">${formatStage(lead.stage)}</span></td>
            <td>${lead.source}</td>
            <td>${estimateValue}</td>
            <td>
                <div class="action-buttons">
                    ${lead.stage === 'estimate' || lead.stage === 'estimate-approval' ? `
                        <button class="btn-action" style="background: rgba(20, 184, 166, 0.1); color: #14b8a6;" onclick="openBOMModal(${index})">
                            <i class="fas fa-calculator"></i> BOM
                        </button>
                    ` : ''}
                    <button class="btn-action btn-edit" onclick="editLead(${index})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-action btn-delete" onclick="deleteLead(${index})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
        <tr class="detail-row" id="detail-lead-${index}">
            <td colspan="7">
                <div class="detail-content">
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Lead ID</span>
                            <span class="detail-value">${lead.id}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Project Name</span>
                            <span class="detail-value">${lead.name}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Customer</span>
                            <span class="detail-value">${customerName}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Stage</span>
                            <span class="detail-value"><span class="badge badge-${lead.stage}">${formatStage(lead.stage)}</span></span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Source</span>
                            <span class="detail-value">${lead.source}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Created</span>
                            <span class="detail-value">${lead.createdDate}</span>
                        </div>
                    </div>
                    ${customer ? `
                        <div style="margin-top: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
                            <strong style="display: block; margin-bottom: 8px;">Customer Details:</strong>
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 14px;">
                                <div>Company: ${customer.company}</div>
                                <div>Email: ${customer.email}</div>
                                <div>Phone: ${customer.phone}</div>
                            </div>
                        </div>
                    ` : ''}
                    ${lead.bom ? `
                        <div style="margin-top: 16px; padding: 12px; background: rgba(20, 184, 166, 0.05); border-radius: 8px; border: 1px solid rgba(20, 184, 166, 0.2);">
                            <strong style="display: block; margin-bottom: 8px;">Estimate Details:</strong>
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 14px;">
                                <div>Items: ${lead.bom.items.length}</div>
                                <div>Cost: $${lead.bom.subtotal.toFixed(2)}</div>
                                <div>Profit: $${lead.bom.profit.toFixed(2)} (${lead.bom.profitPercent}%)</div>
                            </div>
                            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(20, 184, 166, 0.2);">
                                <strong>Total Estimate: $${lead.bom.total.toFixed(2)}</strong>
                            </div>
                        </div>
                    ` : ''}
                    ${lead.interest ? `
                        <div class="detail-item" style="margin-top: 12px;">
                            <span class="detail-label">Interest/Requirements</span>
                            <span class="detail-value">${lead.interest}</span>
                        </div>
                    ` : ''}
                    ${lead.notes ? `
                        <div class="detail-item" style="margin-top: 12px;">
                            <span class="detail-label">Notes</span>
                            <span class="detail-value">${lead.notes}</span>
                        </div>
                    ` : ''}
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

function renderLeads() {
    if (currentLeadView === 'kanban') {
        renderLeadsKanban();
    } else {
        renderLeadsTable();
    }
}

function switchLeadView(view) {
    currentLeadView = view;
    
    // Update button states
    document.querySelectorAll('.page-actions .filter-buttons .btn-filter').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (view === 'kanban') {
        document.getElementById('leadsKanban').style.display = 'flex';
        document.getElementById('leadsTable').style.display = 'none';
        document.querySelector('button[onclick="switchLeadView(\'kanban\')"]').classList.add('active');
        renderLeadsKanban();
    } else {
        document.getElementById('leadsKanban').style.display = 'none';
        document.getElementById('leadsTable').style.display = 'block';
        document.querySelector('button[onclick="switchLeadView(\'table\')"]').classList.add('active');
        renderLeadsTable();
    }
}

function filterLeads(filter) {
    // This function is no longer needed with Kanban view but kept for compatibility
    switchLeadView('table');
}

function handleAddLead(e) {
    e.preventDefault();
    
    const lead = {
        id: currentEditingLeadIndex !== null ? leads[currentEditingLeadIndex].id : 'LEAD-' + String(leads.length + 1).padStart(5, '0'),
        name: document.getElementById('leadName').value,
        customerId: document.getElementById('leadCustomer').value,
        source: document.getElementById('leadSource').value,
        stage: document.getElementById('leadStage').value,
        interest: document.getElementById('leadInterest').value,
        notes: document.getElementById('leadNotes').value,
        createdDate: currentEditingLeadIndex !== null ? leads[currentEditingLeadIndex].createdDate : new Date().toISOString().split('T')[0],
        bom: currentEditingLeadIndex !== null ? leads[currentEditingLeadIndex].bom : null
    };
    
    if (currentEditingLeadIndex !== null) {
        // Update existing lead
        leads[currentEditingLeadIndex] = lead;
        currentEditingLeadIndex = null;
    } else {
        // Add new lead
        leads.push(lead);
    }
    
    saveData();
    saveDataToFirebase();
    renderLeads();
    updateDashboard();
    updateCustomerSelects(); // Make sure customer dropdown is updated
    closeModal('addLeadModal');
    e.target.reset();
    
    // Reset button text
    document.getElementById('leadSubmitText').textContent = 'Add Lead';
    document.querySelector('#leadSubmitBtn i').className = 'fas fa-plus';
}

function editLead(index, event) {
    if (event) event.stopPropagation();
    
    const lead = leads[index];
    currentEditingLeadIndex = index;
    
    document.getElementById('leadName').value = lead.name;
    document.getElementById('leadCustomer').value = lead.customerId || '';
    document.getElementById('leadSource').value = lead.source;
    document.getElementById('leadStage').value = lead.stage;
    document.getElementById('leadInterest').value = lead.interest || '';
    document.getElementById('leadNotes').value = lead.notes || '';
    
    // Update button text
    document.getElementById('leadSubmitText').textContent = 'Update Lead';
    document.querySelector('#leadSubmitBtn i').className = 'fas fa-save';
    
    showAddLeadModal();
}

function deleteLead(index, event) {
    if (event) event.stopPropagation();
    
    if (confirm('Are you sure you want to delete this lead?')) {
        leads.splice(index, 1);
        saveData();
        renderLeads();
        updateDashboard();
    }
}

// Helper Functions
function toggleDetailRow(index, type) {
    const detailRow = document.getElementById(`detail-${type}-${index}`);
    const icon = event.target;
    
    if (detailRow.classList.contains('show')) {
        detailRow.classList.remove('show');
        icon.classList.remove('expanded');
    } else {
        // Close all other detail rows
        document.querySelectorAll('.detail-row.show').forEach(row => {
            row.classList.remove('show');
        });
        document.querySelectorAll('.expand-icon.expanded').forEach(i => {
            i.classList.remove('expanded');
        });
        
        detailRow.classList.add('show');
        icon.classList.add('expanded');
    }
}

function handleImagePreview(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('imagePreview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            preview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '';
    }
}

function showAddCustomerModal() {
    document.getElementById('addCustomerModal').classList.add('active');
}

function showAddLeadModal() {
    updateCustomerSelects();
    
    // Reset button text if not editing
    if (currentEditingLeadIndex === null) {
        document.getElementById('leadSubmitText').textContent = 'Add Lead';
        document.querySelector('#leadSubmitBtn i').className = 'fas fa-plus';
    }
    
    document.getElementById('addLeadModal').classList.add('active');
}

// Drag and Drop Functions
function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev) {
    ev.dataTransfer.setData("leadIndex", ev.target.dataset.leadIndex);
    ev.target.classList.add('dragging');
}

function dragEnd(ev) {
    ev.target.classList.remove('dragging');
}

function drop(ev) {
    ev.preventDefault();
    const leadIndex = ev.dataTransfer.getData("leadIndex");
    const newStage = ev.target.closest('.kanban-column').dataset.stage;
    
    if (leadIndex && newStage) {
        const lead = leads[leadIndex];
        if (lead) {
            lead.stage = newStage;
            saveData();
            renderLeadsKanban();
            updateDashboard();
        }
    }
}

// Quick Add Customer
function showQuickAddCustomer() {
    document.getElementById('quickAddCustomerModal').classList.add('active');
}

function handleQuickAddCustomer(e) {
    e.preventDefault();
    
    const customerType = document.getElementById('quickCustomerType').value;
    const customer = {
        id: 'CUST-' + String(customers.length + 1).padStart(5, '0'),
        name: document.getElementById('quickCustomerName').value,
        company: customerType === 'Corporate' ? document.getElementById('quickCustomerCompany').value : '',
        email: document.getElementById('quickCustomerEmail').value,
        phone: document.getElementById('quickCustomerPhone').value,
        type: customerType,
        address: '',
        notes: '',
        createdDate: new Date().toISOString().split('T')[0]
    };
    
    customers.push(customer);
    saveData();
    saveDataToFirebase();
    updateCustomerSelects();
    
    // Select the newly added customer
    document.getElementById('leadCustomer').value = customer.id;
    
    closeModal('quickAddCustomerModal');
    e.target.reset();
}

function updateCustomerSelects() {
    const leadCustomerSelect = document.getElementById('leadCustomer');
    
    const options = customers.map(c => 
        `<option value="${c.id}">${c.name} - ${c.company}</option>`
    ).join('');
    
    leadCustomerSelect.innerHTML = '<option value="">Select or Search Customer</option>' + options;
}

// BOM Management
function openBOMModal(leadIndex, event) {
    if (event) event.stopPropagation();
    
    currentBOMLeadIndex = leadIndex;
    const lead = leads[leadIndex];
    const customer = customers.find(c => c.id === lead.customerId);
    
    document.getElementById('bomLeadName').textContent = lead.name;
    document.getElementById('bomCustomerName').textContent = customer ? customer.name : 'N/A';
    
    // Populate inventory select
    const bomItemSelect = document.getElementById('bomItemSelect');
    bomItemSelect.innerHTML = '<option value="">Select Item from Inventory</option>' +
        inventory.map((item, idx) => 
            `<option value="${idx}">${item.name} - ${item.type} - $${item.price.toFixed(2)}</option>`
        ).join('');
    
    // Load existing BOM if available
    if (lead.bom) {
        document.getElementById('bomProfitPercent').value = lead.bom.profitPercent;
        document.getElementById('bomNotes').value = lead.bom.notes || '';
        renderBOMItems(lead.bom.items);
        updateBOMTotals();
    } else {
        document.getElementById('bomProfitPercent').value = 20;
        document.getElementById('bomNotes').value = '';
        document.getElementById('bomItemsTable').innerHTML = '<tr><td colspan="6" class="empty-state">No items added yet</td></tr>';
        updateBOMTotals();
    }
    
    document.getElementById('bomModal').classList.add('active');
}

function addBOMItem() {
    const selectIndex = document.getElementById('bomItemSelect').value;
    const quantity = parseInt(document.getElementById('bomItemQty').value) || 1;
    
    if (!selectIndex) {
        alert('Please select an item');
        return;
    }
    
    const item = inventory[selectIndex];
    const lead = leads[currentBOMLeadIndex];
    
    if (!lead.bom) {
        lead.bom = {
            items: [],
            subtotal: 0,
            profitPercent: 20,
            profit: 0,
            total: 0,
            notes: ''
        };
    }
    
    // Check if item already exists in BOM
    const existingIndex = lead.bom.items.findIndex(i => i.name === item.name);
    if (existingIndex >= 0) {
        lead.bom.items[existingIndex].quantity += quantity;
    } else {
        lead.bom.items.push({
            name: item.name,
            type: item.type,
            quantity: quantity,
            unitPrice: item.price
        });
    }
    
    renderBOMItems(lead.bom.items);
    updateBOMTotals();
    
    document.getElementById('bomItemSelect').value = '';
    document.getElementById('bomItemQty').value = 1;
}

function removeBOMItem(index) {
    const lead = leads[currentBOMLeadIndex];
    if (lead.bom && lead.bom.items) {
        lead.bom.items.splice(index, 1);
        renderBOMItems(lead.bom.items);
        updateBOMTotals();
    }
}

function renderBOMItems(items) {
    const tbody = document.getElementById('bomItemsTable');
    
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No items added yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = items.map((item, index) => `
        <tr>
            <td>${item.name}</td>
            <td><span class="badge badge-${item.type}">${item.type}</span></td>
            <td>${item.quantity}</td>
            <td>$${item.unitPrice.toFixed(2)}</td>
            <td>$${(item.quantity * item.unitPrice).toFixed(2)}</td>
            <td>
                <button class="btn-icon" onclick="removeBOMItem(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function updateBOMTotals() {
    const lead = leads[currentBOMLeadIndex];
    if (!lead.bom || !lead.bom.items) return;
    
    const profitPercent = parseFloat(document.getElementById('bomProfitPercent').value) || 0;
    document.getElementById('bomProfitPercentDisplay').textContent = profitPercent;
    
    const subtotal = lead.bom.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const profit = subtotal * (profitPercent / 100);
    const total = subtotal + profit;
    
    document.getElementById('bomSubtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('bomProfit').textContent = `$${profit.toFixed(2)}`;
    document.getElementById('bomTotal').textContent = `$${total.toFixed(2)}`;
}

function saveBOM() {
    const lead = leads[currentBOMLeadIndex];
    if (!lead.bom || lead.bom.items.length === 0) {
        alert('Please add at least one item to the BOM');
        return;
    }
    
    const profitPercent = parseFloat(document.getElementById('bomProfitPercent').value) || 0;
    const subtotal = lead.bom.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const profit = subtotal * (profitPercent / 100);
    const total = subtotal + profit;
    
    lead.bom.subtotal = subtotal;
    lead.bom.profitPercent = profitPercent;
    lead.bom.profit = profit;
    lead.bom.total = total;
    lead.bom.notes = document.getElementById('bomNotes').value;
    
    saveData();
    renderLeads();
    alert('BOM saved successfully!');
}

function generateEstimatePDF() {
    const lead = leads[currentBOMLeadIndex];
    if (!lead.bom || lead.bom.items.length === 0) {
        alert('Please add items to the BOM and save before generating PDF');
        return;
    }
    
    // Save BOM first
    saveBOM();
    
    const customer = customers.find(c => c.id === lead.customerId);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Convert primary color hex to RGB
    const primaryColorRGB = hexToRgb(settings.primaryColor || '#4f46e5');
    
    // Add logo if exists
    let startY = 35;
    if (settings.companyLogo) {
        try {
            doc.addImage(settings.companyLogo, 'PNG', 14, 15, 40, 20);
            startY = 40;
        } catch (e) {
            console.error('Error adding logo:', e);
        }
    }
    
    // Header
    doc.setFontSize(24);
    doc.setTextColor(primaryColorRGB.r, primaryColorRGB.g, primaryColorRGB.b);
    doc.text('ESTIMATE / QUOTATION', 105, 20, { align: 'center' });
    
    // Company Info (from settings)
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(settings.companyName || 'Company Name', 14, startY);
    doc.text(settings.companyAddress || 'Address', 14, startY + 5);
    doc.text(`Phone: ${settings.companyPhone || 'Phone'}`, 14, startY + 10);
    doc.text(`Email: ${settings.companyEmail || 'Email'}`, 14, startY + 15);
    if (settings.companyWebsite) {
        doc.text(`Web: ${settings.companyWebsite}`, 14, startY + 20);
    }
    
    // Estimate Info
    doc.setFontSize(10);
    doc.text(`Estimate #: ${lead.id}`, 140, startY);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, startY + 5);
    const validityDays = settings.quoteValidity || 30;
    doc.text(`Valid Until: ${new Date(Date.now() + validityDays*24*60*60*1000).toLocaleDateString()}`, 140, startY + 10);
    
    // Customer Info
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('CUSTOMER INFORMATION', 14, startY + 30);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    
    if (customer) {
        doc.text(`Name: ${customer.name}`, 14, startY + 37);
        doc.text(`Company: ${customer.company}`, 14, startY + 42);
        doc.text(`Email: ${customer.email}`, 14, startY + 47);
        doc.text(`Phone: ${customer.phone}`, 14, startY + 52);
    }
    
    // Project Info
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('PROJECT DETAILS', 14, startY + 65);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text(`Project: ${lead.name}`, 14, startY + 72);
    
    // Items Table
    const currencySymbol = settings.currencySymbol || '$';
    const tableData = lead.bom.items.map(item => [
        item.name,
        item.type,
        item.quantity.toString(),
        `${currencySymbol}${item.unitPrice.toFixed(2)}`,
        `${currencySymbol}${(item.quantity * item.unitPrice).toFixed(2)}`
    ]);
    
    doc.autoTable({
        startY: startY + 80,
        head: [['Item Description', 'Type', 'Qty', 'Unit Price', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [primaryColorRGB.r, primaryColorRGB.g, primaryColorRGB.b] },
        foot: [
            ['', '', '', 'Subtotal:', `${currencySymbol}${lead.bom.subtotal.toFixed(2)}`],
            ['', '', '', `Profit (${lead.bom.profitPercent}%):`, `${currencySymbol}${lead.bom.profit.toFixed(2)}`],
            ['', '', '', 'TOTAL:', `${currencySymbol}${lead.bom.total.toFixed(2)}`]
        ],
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
    });
    
    // Terms & Conditions
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('TERMS & CONDITIONS', 14, finalY);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    
    const termsText = (settings.quoteTerms || 'Standard terms apply') + '\n' + (settings.invoiceTerms || '');
    const splitTerms = doc.splitTextToSize(termsText, 180);
    doc.text(splitTerms, 14, finalY + 7);
    
    if (lead.bom.notes) {
        const notesY = finalY + 7 + (splitTerms.length * 5) + 5;
        doc.setFont(undefined, 'bold');
        doc.text('NOTES:', 14, notesY);
        doc.setFont(undefined, 'normal');
        const splitNotes = doc.splitTextToSize(lead.bom.notes, 180);
        doc.text(splitNotes, 14, notesY + 5);
    }
    
    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text('Thank you for your business!', 105, pageHeight - 20, { align: 'center' });
    doc.text(`Please contact us at ${settings.companyEmail || 'email'} if you have any questions.`, 105, pageHeight - 15, { align: 'center' });
    
    // Save PDF
    doc.save(`Estimate_${lead.id}_${customer ? customer.name.replace(/\s/g, '_') : 'Customer'}.pdf`);
}

// Helper function to convert hex to RGB
function hexToRgb(hex) {
    if (!hex) return { r: 79, g: 70, b: 229 };
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 79, g: 70, b: 229 }; // Default color if parsing fails
}

// Quotes/Estimates Management
function renderQuotes() {
    const tbody = document.getElementById('quotesTable');
    
    // Combine lead BOMs and standalone quotes
    const allQuotes = [];
    
    // Add lead-based BOMs
    leads.forEach((lead, leadIndex) => {
        if (lead.bom && lead.bom.length > 0) {
            const customer = customers.find(c => c.id === lead.customerId);
            const totalCost = lead.bom.reduce((sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.price)), 0);
            const profit = totalCost * (parseFloat(lead.profitMargin) / 100);
            const estimateTotal = totalCost + profit;
            
            allQuotes.push({
                id: lead.id,
                type: 'lead',
                leadIndex: leadIndex,
                customer: customer,
                projectName: lead.name,
                items: lead.bom,
                subtotal: totalCost,
                profit: profit,
                total: estimateTotal,
                profitMargin: lead.profitMargin,
                date: lead.createdDate,
                stage: lead.stage
            });
        }
    });
    
    // Add standalone quotes
    quotes.forEach((quote, quoteIndex) => {
        const customer = customers.find(c => c.id === quote.customerId);
        allQuotes.push({
            id: quote.id,
            type: 'standalone',
            quoteIndex: quoteIndex,
            customer: customer,
            projectName: quote.projectName,
            items: quote.items,
            subtotal: quote.subtotal,
            profit: quote.profit,
            total: quote.total,
            profitMargin: quote.profitMargin,
            date: quote.createdDate,
            linkedLeadId: quote.linkedLeadId
        });
    });
    
    if (allQuotes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No quotes/estimates created yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = allQuotes.map((quote, index) => {
        return `
        <tr class="main-row" data-index="${index}">
            <td>
                <i class="fas fa-chevron-right expand-icon" onclick="toggleDetailRow(${index}, 'quote')"></i>
            </td>
            <td><strong>${quote.id}</strong></td>
            <td>${quote.projectName}</td>
            <td>${quote.customer ? quote.customer.name : 'Unknown'}</td>
            <td>${quote.items.length}</td>
            <td>${settings.currencySymbol}${quote.total.toFixed(2)}</td>
            <td>${new Date(quote.date).toLocaleDateString()}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action btn-view" onclick="viewQuotePDF('${quote.type}', ${quote.type === 'lead' ? quote.leadIndex : quote.quoteIndex})">
                        <i class="fas fa-file-pdf"></i> View PDF
                    </button>
                    <button class="btn-action btn-success" onclick="convertQuoteToProject('${quote.type}', ${quote.type === 'lead' ? quote.leadIndex : quote.quoteIndex})" style="background: #10b981;">
                        <i class="fas fa-check-circle"></i> Accept & Create Project
                    </button>
                    ${quote.type === 'standalone' ? `
                    <button class="btn-action btn-delete" onclick="deleteQuote(${quote.quoteIndex})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    ` : ''}
                </div>
            </td>
        </tr>
        <tr class="detail-row" id="detail-quote-${index}">
            <td colspan="8">
                <div class="detail-content">
                    <h4 style="margin-bottom: 12px;">Quote Details</h4>
                    ${quote.linkedLeadId ? `<p style="color: var(--text-secondary); margin-bottom: 12px;"><i class="fas fa-link"></i> Linked to Lead: ${quote.linkedLeadId}</p>` : ''}
                    <table class="bom-detail-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Type</th>
                                <th>Quantity</th>
                                <th>Unit Price</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${quote.items.map(item => `
                                <tr>
                                    <td>${item.name}</td>
                                    <td>${item.type || '-'}</td>
                                    <td>${item.quantity}</td>
                                    <td>${settings.currencySymbol}${parseFloat(item.price).toFixed(2)}</td>
                                    <td>${settings.currencySymbol}${(parseFloat(item.quantity) * parseFloat(item.price)).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                            <tr style="border-top: 2px solid #ddd; font-weight: bold;">
                                <td colspan="4" style="text-align: right;">Subtotal:</td>
                                <td>${settings.currencySymbol}${quote.subtotal.toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td colspan="4" style="text-align: right;">Profit Margin (${quote.profitMargin}%):</td>
                                <td>${settings.currencySymbol}${quote.profit.toFixed(2)}</td>
                            </tr>
                            <tr style="font-weight: bold; font-size: 1.1em;">
                                <td colspan="4" style="text-align: right;">Total Estimate:</td>
                                <td>${settings.currencySymbol}${quote.total.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

function viewQuotePDF(type, index) {
    if (type === 'lead') {
        generateEstimatePDF(index);
    } else {
        generateQuotePDF(index);
    }
}

// Convert Quote to Project
async function convertQuoteToProject(type, index) {
    let quote, customer, items, total, subtotal, profit;
    
    if (type === 'lead') {
        const lead = leads[index];
        if (!lead.bom || lead.bom.length === 0) {
            alert('This lead has no BOM items.');
            return;
        }
        
        customer = customers.find(c => c.id === lead.customerId);
        items = lead.bom;
        subtotal = lead.bom.reduce((sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.price)), 0);
        profit = subtotal * (parseFloat(lead.profitMargin) / 100);
        total = subtotal + profit;
        
        quote = {
            id: lead.id,
            projectName: lead.name,
            customerId: lead.customerId,
            items: items,
            subtotal: subtotal,
            profit: profit,
            total: total,
            profitMargin: lead.profitMargin
        };
        
        // Update lead stage to 'won'
        lead.stage = 'won';
        
    } else {
        quote = quotes[index];
        customer = customers.find(c => c.id === quote.customerId);
    }
    
    if (!customer) {
        alert('Customer not found for this quote.');
        return;
    }
    
    // Prompt for advance payment
    const advancePayment = prompt(`Enter advance payment received from ${customer.name}:\n(Quote Total: ${settings.currencySymbol}${quote.total.toFixed(2)})`, '0');
    if (advancePayment === null) return;
    
    const advance = parseFloat(advancePayment) || 0;
    
    // Create project
    const projectId = 'PRJ-' + String(projects.length + 1).padStart(5, '0');
    const project = {
        id: projectId,
        quoteId: quote.id,
        projectName: quote.projectName,
        customerId: quote.customerId,
        customerName: customer.name,
        items: quote.items,
        totalValue: quote.total,
        advanceReceived: advance,
        balanceRemaining: quote.total - advance,
        profitMargin: quote.profitMargin,
        createdDate: new Date().toISOString().split('T')[0],
        status: 'active',
        purchaseOrders: [],
        totalPOCost: 0,
        paidToPOs: 0,
        pendingPOPayments: 0
    };
    
    // Group items by supplier to create POs
    const supplierGroups = {};
    
    quote.items.forEach(item => {
        // Find the inventory item to get supplier
        const invItem = inventory.find(inv => inv.name === item.name);
        const supplier = invItem ? invItem.supplier : 'Unknown Supplier';
        
        if (!supplierGroups[supplier]) {
            supplierGroups[supplier] = [];
        }
        
        supplierGroups[supplier].push({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.quantity * item.price
        });
    });
    
    // Create POs for each supplier
    const createdPOs = [];
    for (const [supplierName, items] of Object.entries(supplierGroups)) {
        const poId = 'PO-' + String(orders.length + 1).padStart(5, '0');
        const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
        
        const purchaseOrder = {
            id: poId,
            projectId: projectId,
            projectName: quote.projectName,
            supplier: supplierName,
            date: new Date().toISOString().split('T')[0],
            items: items,
            totalAmount: totalAmount,
            status: 'pending',
            paidAmount: 0,
            paidDate: null,
            notes: `Auto-generated from project ${projectId}`
        };
        
        orders.push(purchaseOrder);
        createdPOs.push(poId);
        project.totalPOCost += totalAmount;
    }
    
    project.purchaseOrders = createdPOs;
    project.pendingPOPayments = project.totalPOCost;
    
    projects.push(project);
    
    // Save data
    saveData();
    await saveDataToFirebase();
    
    // Update views
    renderQuotes();
    renderOrders();
    renderProjects();
    renderFinance();
    updateDashboard();
    
    alert(`✅ Project Created Successfully!\n\nProject ID: ${projectId}\nPurchase Orders Created: ${createdPOs.length}\n${createdPOs.join(', ')}\n\nAdvance Received: ${settings.currencySymbol}${advance.toFixed(2)}\nBalance: ${settings.currencySymbol}${project.balanceRemaining.toFixed(2)}`);
}

// Settings Management
function populateSettings() {
    document.getElementById('settingsCompanyName').value = settings.companyName || '';
    document.getElementById('settingsCompanyAddress').value = settings.companyAddress || '';
    document.getElementById('settingsCompanyPhone').value = settings.companyPhone || '';
    document.getElementById('settingsCompanyEmail').value = settings.companyEmail || '';
    document.getElementById('settingsCompanyWebsite').value = settings.companyWebsite || '';
    document.getElementById('settingsCompanyLogo').value = settings.companyLogo || '';
    
    // Show logo preview if exists
    if (settings.companyLogo) {
        document.getElementById('logoPreviewImg').src = settings.companyLogo;
        document.getElementById('logoPreview').style.display = 'block';
    }
    
    document.getElementById('settingsCurrency').value = settings.currencySymbol || '$';
    document.getElementById('settingsDateFormat').value = settings.dateFormat || 'MM/DD/YYYY';
    
    document.getElementById('settingsQuoteTerms').value = settings.quoteTerms || '';
    document.getElementById('settingsInvoiceTerms').value = settings.invoiceTerms || '';
    document.getElementById('settingsQuoteValidity').value = settings.quoteValidity || 30;
    document.getElementById('settingsPaymentDue').value = settings.paymentDue || 30;
    
    document.getElementById('settingsPrimaryColor').value = settings.primaryColor || '#4f46e5';
    document.getElementById('settingsQuoteTheme').value = settings.quoteTheme || 'modern';
}

function saveSettings(e) {
    if (e) e.preventDefault();
    
    settings = {
        companyName: document.getElementById('settingsCompanyName').value,
        companyAddress: document.getElementById('settingsCompanyAddress').value,
        companyPhone: document.getElementById('settingsCompanyPhone').value,
        companyEmail: document.getElementById('settingsCompanyEmail').value,
        companyWebsite: document.getElementById('settingsCompanyWebsite').value,
        companyLogo: document.getElementById('settingsCompanyLogo').value,
        
        currencySymbol: document.getElementById('settingsCurrency').value,
        dateFormat: document.getElementById('settingsDateFormat').value,
        
        quoteTerms: document.getElementById('settingsQuoteTerms').value,
        invoiceTerms: document.getElementById('settingsInvoiceTerms').value,
        quoteValidity: parseInt(document.getElementById('settingsQuoteValidity').value) || 30,
        paymentDue: parseInt(document.getElementById('settingsPaymentDue').value) || 30,
        
        primaryColor: document.getElementById('settingsPrimaryColor').value,
        quoteTheme: document.getElementById('settingsQuoteTheme').value
    };
    
    localStorage.setItem('appSettings', JSON.stringify(settings));
    saveSettingsToFirebase();
    
    applySettings();
    updateHeaderLogo();
    
    // Re-render all views to apply currency changes
    renderInventory();
    renderOrders();
    renderProjects();
    renderFinance();
    updateDashboard();
    
    // Show success message
    alert('Settings saved successfully!');
}

function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
        settings = {
            companyName: 'Your Company Name',
            companyAddress: '123 Business St, City, Country',
            companyPhone: '+1 (555) 123-4567',
            companyEmail: 'info@yourcompany.com',
            companyWebsite: 'www.yourcompany.com',
            companyLogo: '',
            
            currencySymbol: '$',
            dateFormat: 'MM/DD/YYYY',
            
            quoteTerms: 'Quote valid for 30 days. Prices subject to change without notice.',
            invoiceTerms: 'Payment due within 30 days. Late payments subject to 1.5% monthly interest.',
            quoteValidity: 30,
            paymentDue: 30,
            
            primaryColor: '#4f46e5',
            quoteTheme: 'modern'
        };
        
        localStorage.setItem('appSettings', JSON.stringify(settings));
        populateSettings();
        applySettings();
        
        alert('Settings have been reset to defaults!');
    }
}

function applySettings() {
    // Apply primary color to CSS variables
    if (settings.primaryColor) {
        document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
    }
    
    // Re-render quotes if on that page to show updated currency
    const quotesPage = document.getElementById('quotes');
    if (quotesPage && quotesPage.classList.contains('active')) {
        renderQuotes();
    }
    
    // Update any visible currency symbols in the dashboard
    updateDashboard();
}

// Standalone Quote Functions
function showAddQuoteModal() {
    currentQuoteItems = [];
    
    // Populate customer dropdown
    const customerSelect = document.getElementById('quoteCustomer');
    customerSelect.innerHTML = '<option value="">Select Customer</option>' +
        customers.map(c => `<option value="${c.id}">${c.name} - ${c.company}</option>`).join('');
    
    // Populate lead dropdown
    const leadSelect = document.getElementById('quoteLead');
    leadSelect.innerHTML = '<option value="">None - Standalone Quote</option>' +
        leads.map(l => `<option value="${l.id}">${l.id} - ${l.name}</option>`).join('');
    
    // Populate inventory items
    const itemSelect = document.getElementById('quoteItemSelect');
    itemSelect.innerHTML = '<option value="">Select Item from Inventory</option>' +
        inventory.map((item, index) => 
            `<option value="${index}">${item.name} - ${item.category} (${settings.currencySymbol}${item.price})</option>`
        ).join('');
    
    // Reset form
    document.getElementById('addQuoteForm').reset();
    document.getElementById('quoteItemsTable').innerHTML = '<tr><td colspan="6" class="empty-state">No items added yet</td></tr>';
    updateQuoteTotals();
    
    showModal('addQuoteModal');
}

function addQuoteItem() {
    const itemIndex = document.getElementById('quoteItemSelect').value;
    const quantity = parseInt(document.getElementById('quoteItemQty').value);
    
    if (!itemIndex || !quantity) {
        alert('Please select an item and quantity');
        return;
    }
    
    const item = inventory[itemIndex];
    currentQuoteItems.push({
        name: item.name,
        type: item.category,
        quantity: quantity,
        price: item.price
    });
    
    renderQuoteItems();
    updateQuoteTotals();
    
    // Reset selection
    document.getElementById('quoteItemSelect').value = '';
    document.getElementById('quoteItemQty').value = '1';
}

function renderQuoteItems() {
    const tbody = document.getElementById('quoteItemsTable');
    
    if (currentQuoteItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No items added yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = currentQuoteItems.map((item, index) => `
        <tr>
            <td>${item.name}</td>
            <td>${item.type}</td>
            <td>${item.quantity}</td>
            <td>${settings.currencySymbol}${parseFloat(item.price).toFixed(2)}</td>
            <td>${settings.currencySymbol}${(item.quantity * item.price).toFixed(2)}</td>
            <td>
                <button class="btn-action btn-delete" onclick="removeQuoteItem(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function removeQuoteItem(index) {
    currentQuoteItems.splice(index, 1);
    renderQuoteItems();
    updateQuoteTotals();
}

function updateQuoteTotals() {
    const subtotal = currentQuoteItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const profitPercent = parseFloat(document.getElementById('quoteProfitPercent').value) || 0;
    const profit = subtotal * (profitPercent / 100);
    const total = subtotal + profit;
    
    document.getElementById('quoteSubtotal').textContent = `${settings.currencySymbol}${subtotal.toFixed(2)}`;
    document.getElementById('quoteProfit').textContent = `${settings.currencySymbol}${profit.toFixed(2)}`;
    document.getElementById('quoteTotal').textContent = `${settings.currencySymbol}${total.toFixed(2)}`;
    document.getElementById('quoteProfitPercentDisplay').textContent = profitPercent;
}

function saveQuote() {
    const customerId = document.getElementById('quoteCustomer').value;
    const linkedLeadId = document.getElementById('quoteLead').value;
    const projectName = document.getElementById('quoteProjectName').value;
    const profitPercent = parseFloat(document.getElementById('quoteProfitPercent').value) || 0;
    const notes = document.getElementById('quoteNotes').value;
    
    if (!customerId || !projectName) {
        alert('Please select a customer and enter a project name');
        return;
    }
    
    if (currentQuoteItems.length === 0) {
        alert('Please add at least one item to the quote');
        return;
    }
    
    const subtotal = currentQuoteItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const profit = subtotal * (profitPercent / 100);
    const total = subtotal + profit;
    
    const quote = {
        id: 'QUO-' + String(quotes.length + 1).padStart(5, '0'),
        customerId: customerId,
        linkedLeadId: linkedLeadId || null,
        projectName: projectName,
        items: [...currentQuoteItems],
        subtotal: subtotal,
        profit: profit,
        total: total,
        profitMargin: profitPercent,
        notes: notes,
        createdDate: new Date().toISOString().split('T')[0]
    };
    
    quotes.push(quote);
    saveData();
    renderQuotes();
    closeModal('addQuoteModal');
    
    alert('Quote created successfully!');
}

function deleteQuote(index) {
    if (confirm('Are you sure you want to delete this quote?')) {
        quotes.splice(index, 1);
        saveData();
        renderQuotes();
    }
}

function generateQuotePDF(quoteIndex) {
    const quote = quoteIndex !== undefined ? quotes[quoteIndex] : null;
    
    if (!quote && currentQuoteItems.length === 0) {
        alert('No quote data available');
        return;
    }
    
    // If generating from current form
    const quoteData = quote || {
        id: 'QUO-DRAFT',
        customerId: document.getElementById('quoteCustomer').value,
        projectName: document.getElementById('quoteProjectName').value,
        items: currentQuoteItems,
        subtotal: currentQuoteItems.reduce((sum, item) => sum + (item.quantity * item.price), 0),
        profitMargin: parseFloat(document.getElementById('quoteProfitPercent').value) || 0,
        notes: document.getElementById('quoteNotes').value,
        createdDate: new Date().toISOString().split('T')[0]
    };
    
    quoteData.profit = quoteData.subtotal * (quoteData.profitMargin / 100);
    quoteData.total = quoteData.subtotal + quoteData.profit;
    
    const customer = customers.find(c => c.id === quoteData.customerId);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Convert primary color hex to RGB
    const primaryColorRGB = hexToRgb(settings.primaryColor);
    
    // Header
    doc.setFontSize(24);
    doc.setTextColor(primaryColorRGB.r, primaryColorRGB.g, primaryColorRGB.b);
    doc.text('QUOTATION', 105, 20, { align: 'center' });
    
    // Company Info
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(settings.companyName, 14, 35);
    doc.text(settings.companyAddress, 14, 40);
    doc.text(`Phone: ${settings.companyPhone}`, 14, 45);
    doc.text(`Email: ${settings.companyEmail}`, 14, 50);
    if (settings.companyWebsite) {
        doc.text(`Web: ${settings.companyWebsite}`, 14, 55);
    }
    
    // Quote Info
    doc.setFontSize(10);
    doc.text(`Quote #: ${quoteData.id}`, 140, 35);
    doc.text(`Date: ${new Date(quoteData.createdDate).toLocaleDateString()}`, 140, 40);
    doc.text(`Valid Until: ${new Date(new Date(quoteData.createdDate).getTime() + 30*24*60*60*1000).toLocaleDateString()}`, 140, 45);
    
    // Customer Info
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('CUSTOMER INFORMATION', 14, 68);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    
    if (customer) {
        doc.text(`Name: ${customer.name}`, 14, 75);
        doc.text(`Company: ${customer.company}`, 14, 80);
        doc.text(`Email: ${customer.email}`, 14, 85);
        doc.text(`Phone: ${customer.phone}`, 14, 90);
    }
    
    // Project Info
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('PROJECT DETAILS', 14, 103);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text(`Project: ${quoteData.projectName}`, 14, 110);
    
    // Items Table
    const tableData = quoteData.items.map(item => [
        item.name,
        item.type,
        item.quantity.toString(),
        `${settings.currencySymbol}${parseFloat(item.price).toFixed(2)}`,
        `${settings.currencySymbol}${(item.quantity * item.price).toFixed(2)}`
    ]);
    
    doc.autoTable({
        startY: 118,
        head: [['Item Description', 'Type', 'Qty', 'Unit Price', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [primaryColorRGB.r, primaryColorRGB.g, primaryColorRGB.b] },
        foot: [
            ['', '', '', 'Subtotal:', `${settings.currencySymbol}${quoteData.subtotal.toFixed(2)}`],
            ['', '', '', `Profit (${quoteData.profitMargin}%):`, `${settings.currencySymbol}${quoteData.profit.toFixed(2)}`],
            ['', '', '', 'TOTAL:', `${settings.currencySymbol}${quoteData.total.toFixed(2)}`]
        ],
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
    });
    
    // Terms & Conditions
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('TERMS & CONDITIONS', 14, finalY);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    
    const termsText = settings.quoteTerms + '\n' + settings.paymentTerms;
    const splitTerms = doc.splitTextToSize(termsText, 180);
    doc.text(splitTerms, 14, finalY + 7);
    
    if (quoteData.notes) {
        const notesY = finalY + 7 + (splitTerms.length * 5) + 5;
        doc.setFont(undefined, 'bold');
        doc.text('NOTES:', 14, notesY);
        doc.setFont(undefined, 'normal');
        const splitNotes = doc.splitTextToSize(quoteData.notes, 180);
        doc.text(splitNotes, 14, notesY + 5);
    }
    
    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text('Thank you for your business!', 105, pageHeight - 20, { align: 'center' });
    doc.text(`Please contact us at ${settings.companyEmail} if you have any questions.`, 105, pageHeight - 15, { align: 'center' });
    
    // Save PDF
    doc.save(`Quote_${quoteData.id}_${customer ? customer.name.replace(/\s/g, '_') : 'Customer'}.pdf`);
}

// Helper function to format stage names
function formatStage(stage) {
    const stages = {
        'initial-discussion': 'Initial Discussion',
        'site-visit': 'Site Visit',
        'measurements': 'Measurements',
        'estimate': 'Estimate/BOM',
        'estimate-approval': 'Estimate Approval',
        'won': 'Won',
        'lost': 'Lost'
    };
    return stages[stage] || stage;
}

// Load Mock Data for Testing
async function loadMockData() {
    if (!confirm('This will replace all current data with mock data. Continue?')) {
        return;
    }
    
    // Mock Suppliers
    suppliers = [
        {
            id: 'SUP-00001',
            name: 'Tech Components Ltd',
            contact: 'John Smith',
            email: 'john@techcomponents.com',
            phone: '+1-555-0101',
            address: '123 Tech Street, Silicon Valley, CA 94025',
            category: 'Electronics'
        },
        {
            id: 'SUP-00002',
            name: 'Industrial Materials Co',
            contact: 'Sarah Johnson',
            email: 'sarah@industrial-materials.com',
            phone: '+1-555-0102',
            address: '456 Industry Ave, Detroit, MI 48201',
            category: 'Raw Materials'
        },
        {
            id: 'SUP-00003',
            name: 'Office Supplies Inc',
            contact: 'Mike Chen',
            email: 'mike@officesupplies.com',
            phone: '+1-555-0103',
            address: '789 Commerce Blvd, New York, NY 10001',
            category: 'Office Equipment'
        }
    ];
    
    // Mock Inventory
    inventory = [
        {
            id: 'ITM-00001',
            name: 'LED Display Panel 55"',
            category: 'Hardware',
            type: 'Hardware',
            quantity: 25,
            unit: 'pcs',
            price: 450.00,
            supplier: 'Tech Components Ltd',
            reorderLevel: 10,
            image: '',
            description: 'High-resolution 4K LED display panel'
        },
        {
            id: 'ITM-00002',
            name: 'Steel Frame Type-A',
            category: 'Hardware',
            type: 'Hardware',
            quantity: 50,
            unit: 'pcs',
            price: 85.00,
            supplier: 'Industrial Materials Co',
            reorderLevel: 15,
            image: '',
            description: 'Heavy-duty steel mounting frame'
        },
        {
            id: 'ITM-00003',
            name: 'Installation Service',
            category: 'Service',
            type: 'Service',
            quantity: 999,
            unit: 'hours',
            price: 75.00,
            supplier: 'Internal',
            reorderLevel: 0,
            image: '',
            description: 'Professional installation service per hour'
        },
        {
            id: 'ITM-00004',
            name: 'Power Supply Unit 500W',
            category: 'Hardware',
            type: 'Hardware',
            quantity: 35,
            unit: 'pcs',
            price: 120.00,
            supplier: 'Tech Components Ltd',
            reorderLevel: 12,
            image: '',
            description: 'Industrial-grade power supply'
        },
        {
            id: 'ITM-00005',
            name: 'Mounting Brackets Set',
            category: 'Hardware',
            type: 'Hardware',
            quantity: 100,
            unit: 'sets',
            price: 35.00,
            supplier: 'Industrial Materials Co',
            reorderLevel: 20,
            image: '',
            description: 'Universal mounting bracket set'
        },
        {
            id: 'ITM-00006',
            name: 'Consulting Service',
            category: 'Service',
            type: 'Service',
            quantity: 999,
            unit: 'hours',
            price: 125.00,
            supplier: 'Internal',
            reorderLevel: 0,
            image: '',
            description: 'Technical consulting and planning'
        }
    ];
    
    // Mock Customers
    customers = [
        {
            id: 'CUST-00001',
            name: 'Robert Williams',
            company: 'Williams Retail Chain',
            email: 'rwilliams@williamsretail.com',
            phone: '+1-555-1001',
            type: 'Corporate',
            address: '100 Retail Plaza, Los Angeles, CA 90001',
            notes: 'Major retail client, prefers bulk orders',
            createdDate: '2025-01-15'
        },
        {
            id: 'CUST-00002',
            name: 'Emily Davis',
            company: 'Davis Home Solutions',
            email: 'emily@davishome.com',
            phone: '+1-555-1002',
            type: 'Domestic',
            address: '234 Oak Street, Portland, OR 97201',
            notes: 'Residential client, interested in smart home solutions',
            createdDate: '2025-02-20'
        },
        {
            id: 'CUST-00003',
            name: 'James Martinez',
            company: 'Martinez Construction',
            email: 'james@martinezconstruction.com',
            phone: '+1-555-1003',
            type: 'Corporate',
            address: '567 Builder Ave, Austin, TX 78701',
            notes: 'Construction company, regular orders for commercial projects',
            createdDate: '2025-03-10'
        },
        {
            id: 'CUST-00004',
            name: 'Lisa Anderson',
            company: 'Anderson Enterprises',
            email: 'lisa@andersonent.com',
            phone: '+1-555-1004',
            type: 'Corporate',
            address: '890 Business Park Dr, Seattle, WA 98101',
            notes: 'Tech startup, modern office setup',
            createdDate: '2025-04-05'
        },
        {
            id: 'CUST-00005',
            name: 'David Thompson',
            company: 'Thompson Residence',
            email: 'david.t@email.com',
            phone: '+1-555-1005',
            type: 'Domestic',
            address: '321 Maple Lane, Boston, MA 02101',
            notes: 'Home renovation project',
            createdDate: '2025-05-12'
        }
    ];
    
    // Mock Leads
    leads = [
        {
            id: 'LEAD-00001',
            name: 'Retail Store Display Upgrade',
            customerId: 'CUST-00001',
            stage: 'estimate',
            contactPerson: 'Robert Williams',
            email: 'rwilliams@williamsretail.com',
            phone: '+1-555-1001',
            company: 'Williams Retail Chain',
            source: 'Website',
            notes: 'Looking to upgrade all store displays to LED',
            createdDate: '2025-08-01',
            bom: [
                { name: 'LED Display Panel 55"', type: 'Hardware', quantity: 15, price: 450.00 },
                { name: 'Mounting Brackets Set', type: 'Hardware', quantity: 15, price: 35.00 },
                { name: 'Installation Service', type: 'Service', quantity: 30, price: 75.00 }
            ],
            profitMargin: 25
        },
        {
            id: 'LEAD-00002',
            name: 'Smart Home Installation',
            customerId: 'CUST-00002',
            stage: 'site-visit',
            contactPerson: 'Emily Davis',
            email: 'emily@davishome.com',
            phone: '+1-555-1002',
            company: 'Davis Home Solutions',
            source: 'Referral',
            notes: 'Complete smart home setup',
            createdDate: '2025-09-15',
            bom: [],
            profitMargin: 20
        },
        {
            id: 'LEAD-00003',
            name: 'Office Building Equipment',
            customerId: 'CUST-00004',
            stage: 'initial-discussion',
            contactPerson: 'Lisa Anderson',
            email: 'lisa@andersonent.com',
            phone: '+1-555-1004',
            company: 'Anderson Enterprises',
            source: 'Cold Call',
            notes: 'New office setup, 3 floors',
            createdDate: '2025-10-01',
            bom: [],
            profitMargin: 20
        },
        {
            id: 'LEAD-00004',
            name: 'Construction Site Power Setup',
            customerId: 'CUST-00003',
            stage: 'measurements',
            contactPerson: 'James Martinez',
            email: 'james@martinezconstruction.com',
            phone: '+1-555-1003',
            company: 'Martinez Construction',
            source: 'Trade Show',
            notes: 'Temporary power setup for construction site',
            createdDate: '2025-10-10',
            bom: [],
            profitMargin: 20
        }
    ];
    
    // Mock Orders
    orders = [
        {
            id: 'PO-00001',
            supplier: 'Tech Components Ltd',
            date: '2025-10-15',
            items: [
                { item: 'LED Display Panel 55"', quantity: 20 },
                { item: 'Power Supply Unit 500W', quantity: 15 }
            ],
            status: 'Pending',
            total: 10800,
            notes: 'Urgent order for upcoming project'
        },
        {
            id: 'PO-00002',
            supplier: 'Industrial Materials Co',
            date: '2025-10-18',
            items: [
                { item: 'Steel Frame Type-A', quantity: 25 },
                { item: 'Mounting Brackets Set', quantity: 50 }
            ],
            status: 'Delivered',
            total: 3875,
            notes: 'Regular monthly order'
        }
    ];
    
    // Mock Quotes
    quotes = [
        {
            id: 'QUO-00001',
            customerId: 'CUST-00005',
            projectName: 'Home Renovation Display Setup',
            linkedLeadId: '',
            items: [
                { name: 'LED Display Panel 55"', type: 'Hardware', quantity: 2, price: 450.00 },
                { name: 'Installation Service', type: 'Service', quantity: 4, price: 75.00 }
            ],
            subtotal: 1200,
            profitMargin: 20,
            profit: 240,
            total: 1440,
            notes: 'Home theater setup',
            createdDate: '2025-10-20'
        }
    ];
    
    console.log('Mock data arrays created');
    console.log('Suppliers:', suppliers.length);
    console.log('Inventory:', inventory.length);
    console.log('Customers:', customers.length);
    console.log('Leads:', leads.length);
    console.log('Orders:', orders.length);
    console.log('Quotes:', quotes.length);
    
    // Save to local storage first
    saveData();
    console.log('Mock data saved to localStorage');
    
    // Save to Firebase
    console.log('Attempting to save to Firebase...');
    console.log('Current Company ID:', currentCompanyId);
    console.log('Current User:', currentUser);
    
    if (!currentCompanyId) {
        alert('Error: No company ID found. Please logout and login again.');
        return;
    }
    
    await saveDataToFirebase();
    console.log('Mock data saved to Firebase');
    
    // Update supplier and customer selects
    updateSupplierSelects();
    updateCustomerSelects();
    
    // Re-render all views
    renderInventory();
    renderSuppliers();
    renderOrders();
    renderCustomers();
    renderLeadsKanban();
    renderQuotes();
    updateDashboard();
    
    console.log('All views re-rendered');
    alert('Mock data loaded successfully! Check the console for details.');
}

// Render Projects
function renderProjects() {
    const tbody = document.getElementById('projectsTable');
    
    if (projects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No active projects yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = projects.map((project, index) => {
        const statusColor = project.status === 'active' ? '#10b981' : 
                           project.status === 'completed' ? '#6366f1' : '#94a3b8';
        
        return `
            <tr>
                <td><strong>${project.id}</strong></td>
                <td>${project.projectName}</td>
                <td>${project.customerName}</td>
                <td>${settings.currencySymbol}${project.totalValue.toFixed(2)}</td>
                <td>${settings.currencySymbol}${project.advanceReceived.toFixed(2)}</td>
                <td>${project.purchaseOrders.length} POs</td>
                <td>${settings.currencySymbol}${project.paidToPOs.toFixed(2)}</td>
                <td>
                    <span class="status-badge" style="background: ${statusColor};">
                        ${project.status.toUpperCase()}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-view" onclick="viewProjectDetails(${index})">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn-action btn-primary" onclick="recordPayment(${index})">
                            <i class="fas fa-dollar-sign"></i> Record Payment
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// View Project Details
function viewProjectDetails(index) {
    const project = projects[index];
    const poDetails = project.purchaseOrders.map(poId => {
        const po = orders.find(o => o.id === poId);
        return po ? `${po.id} - ${po.supplier}: ${settings.currencySymbol}${po.totalAmount.toFixed(2)} (${po.status})` : poId;
    }).join('\n');
    
    alert(`Project Details:\n\nID: ${project.id}\nName: ${project.projectName}\nCustomer: ${project.customerName}\n\nFinancials:\nTotal Value: ${settings.currencySymbol}${project.totalValue.toFixed(2)}\nAdvance Received: ${settings.currencySymbol}${project.advanceReceived.toFixed(2)}\nBalance Due: ${settings.currencySymbol}${project.balanceRemaining.toFixed(2)}\n\nPurchase Orders:\n${poDetails}\n\nTotal PO Cost: ${settings.currencySymbol}${project.totalPOCost.toFixed(2)}\nPaid: ${settings.currencySymbol}${project.paidToPOs.toFixed(2)}\nPending: ${settings.currencySymbol}${project.pendingPOPayments.toFixed(2)}`);
}

// Record Payment to Customer
async function recordPayment(index) {
    const project = projects[index];
    const payment = prompt(`Record payment from ${project.customerName}:\n\nBalance Due: ${settings.currencySymbol}${project.balanceRemaining.toFixed(2)}\n\nEnter payment amount:`, '0');
    
    if (payment === null) return;
    
    const amount = parseFloat(payment) || 0;
    if (amount <= 0) {
        alert('Please enter a valid payment amount.');
        return;
    }
    
    if (amount > project.balanceRemaining) {
        alert('Payment amount exceeds balance due.');
        return;
    }
    
    project.advanceReceived += amount;
    project.balanceRemaining -= amount;
    
    if (project.balanceRemaining <= 0) {
        project.status = 'completed';
    }
    
    saveData();
    await saveDataToFirebase();
    renderProjects();
    renderFinance();
    
    alert(`✅ Payment recorded!\n\nAmount: ${settings.currencySymbol}${amount.toFixed(2)}\nNew Balance: ${settings.currencySymbol}${project.balanceRemaining.toFixed(2)}`);
}

// Render Finance Dashboard
function renderFinance() {
    // Calculate totals
    let totalRevenue = 0;
    let totalExpenses = 0;
    let pendingPayments = 0;
    
    projects.forEach(project => {
        totalRevenue += project.advanceReceived;
        totalExpenses += project.paidToPOs;
        pendingPayments += project.pendingPOPayments;
    });
    
    const totalProfit = totalRevenue - totalExpenses;
    
    // Update summary cards
    document.getElementById('totalRevenue').textContent = `${settings.currencySymbol}${totalRevenue.toFixed(2)}`;
    document.getElementById('totalExpenses').textContent = `${settings.currencySymbol}${totalExpenses.toFixed(2)}`;
    document.getElementById('totalProfit').textContent = `${settings.currencySymbol}${totalProfit.toFixed(2)}`;
    document.getElementById('pendingPayments').textContent = `${settings.currencySymbol}${pendingPayments.toFixed(2)}`;
    
    // Render project breakdown
    const tbody = document.getElementById('financeProjectsTable');
    
    if (projects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No financial data yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = projects.map(project => {
        const projectProfit = project.advanceReceived - project.paidToPOs;
        const profitColor = projectProfit >= 0 ? '#10b981' : '#ef4444';
        
        return `
            <tr>
                <td><strong>${project.id}</strong><br><small>${project.projectName}</small></td>
                <td>${project.customerName}</td>
                <td>${settings.currencySymbol}${project.totalValue.toFixed(2)}</td>
                <td>${settings.currencySymbol}${project.advanceReceived.toFixed(2)}</td>
                <td>${settings.currencySymbol}${project.totalPOCost.toFixed(2)}</td>
                <td>${settings.currencySymbol}${project.paidToPOs.toFixed(2)}</td>
                <td>${settings.currencySymbol}${project.pendingPOPayments.toFixed(2)}</td>
                <td style="color: ${profitColor}; font-weight: bold;">
                    ${settings.currencySymbol}${projectProfit.toFixed(2)}
                </td>
                <td>
                    <span class="status-badge" style="background: ${project.status === 'active' ? '#f59e0b' : '#10b981'};">
                        ${project.status.toUpperCase()}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// Test Firebase Connection
async function testFirebaseConnection() {
    console.log('=== FIREBASE CONNECTION TEST ===');
    
    try {
        // Check if Firebase is initialized
        if (!window.firebaseAuth) {
            console.error('❌ Firebase Auth not initialized');
            alert('Firebase Auth is not initialized. Check your Firebase config.');
            return;
        }
        console.log('✅ Firebase Auth initialized');
        
        if (!window.firebaseDb) {
            console.error('❌ Firestore not initialized');
            alert('Firestore is not initialized. Check your Firebase config.');
            return;
        }
        console.log('✅ Firestore initialized');
        
        if (!window.firebaseStorage) {
            console.error('❌ Firebase Storage not initialized');
            alert('Firebase Storage is not initialized. Check your Firebase config.');
            return;
        }
        console.log('✅ Firebase Storage initialized');
        
        // Check authentication state
        const user = window.firebaseAuth.currentUser;
        if (!user) {
            console.warn('⚠️ No user logged in');
            alert('Please login first to test Firebase connection.');
            return;
        }
        console.log('✅ User logged in:', user.email);
        console.log('   User ID:', user.uid);
        console.log('   Company ID:', currentCompanyId);
        console.log('   User Role:', currentUserRole);
        
        // Try to write test data
        console.log('\nTesting Firestore write...');
        const testRef = window.firebaseDoc(window.firebaseDb, `companies/${currentCompanyId}/data/test`);
        await window.firebaseSetDoc(testRef, {
            test: 'Firebase connection test',
            timestamp: new Date().toISOString(),
            userId: user.uid
        });
        console.log('✅ Firestore write successful');
        
        // Try to read test data
        console.log('\nTesting Firestore read...');
        const testDoc = await window.firebaseGetDoc(testRef);
        if (testDoc.exists()) {
            console.log('✅ Firestore read successful:', testDoc.data());
        } else {
            console.error('❌ Firestore read failed - document not found');
        }
        
        console.log('\n=== ALL TESTS PASSED ✅ ===');
        alert('✅ Firebase is connected and working!\n\nCheck console for details.');
        
    } catch (error) {
        console.error('❌ Firebase test failed:', error);
        alert('❌ Firebase connection error:\n\n' + error.message + '\n\nCheck console for details.');
    }
}