// Data Storage
let inventory = [];
let suppliers = [];
let orders = [];
let customers = [];
let leads = [];
let currentBOMLeadIndex = null;
let currentEditingLeadIndex = null;
let currentLeadView = 'kanban'; // 'kanban' or 'table'

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
    updateDashboard();
    renderInventory();
    renderSuppliers();
    renderOrders();
    renderCustomers();
    renderLeadsKanban();
});

// Load data from localStorage
function loadData() {
    const savedInventory = localStorage.getItem('inventory');
    const savedSuppliers = localStorage.getItem('suppliers');
    const savedOrders = localStorage.getItem('orders');
    const savedCustomers = localStorage.getItem('customers');
    const savedLeads = localStorage.getItem('leads');
    
    if (savedInventory) inventory = JSON.parse(savedInventory);
    if (savedSuppliers) suppliers = JSON.parse(savedSuppliers);
    if (savedOrders) orders = JSON.parse(savedOrders);
    if (savedCustomers) customers = JSON.parse(savedCustomers);
    if (savedLeads) leads = JSON.parse(savedLeads);
}

// Save data to localStorage
function saveData() {
    localStorage.setItem('inventory', JSON.stringify(inventory));
    localStorage.setItem('suppliers', JSON.stringify(suppliers));
    localStorage.setItem('orders', JSON.stringify(orders));
    localStorage.setItem('customers', JSON.stringify(customers));
    localStorage.setItem('leads', JSON.stringify(leads));
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
    document.getElementById(pageName).classList.add('active');
    
    // Update page title
    const titles = {
        dashboard: 'Dashboard',
        inventory: 'Inventory Management',
        suppliers: 'Supplier Management',
        orders: 'Purchase Orders',
        customers: 'Customer Management',
        leads: 'Lead Management'
    };
    document.getElementById('page-title').textContent = titles[pageName];
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
    
    tbody.innerHTML = orders.map((order, index) => `
        <tr>
            <td><strong>${order.id}</strong></td>
            <td>${order.date}</td>
            <td>${order.supplier}</td>
            <td>${order.items.length} item(s)</td>
            <td>$${order.totalAmount.toFixed(2)}</td>
            <td><span class="badge badge-${order.status}">${order.status}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action btn-edit" onclick="viewOrder(${index})">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-action btn-delete" onclick="deleteOrder(${index})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
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

function showCreateOrderModal() {
    updateSupplierSelects();
    updateItemSelects();
    
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('orderDate').value = today;
    
    document.getElementById('createOrderModal').classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Customer Management
function renderCustomers() {
    const tbody = document.getElementById('customersTable');
    
    if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No customers added yet</td></tr>';
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
            <td colspan="8">
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
    
    const customer = {
        id: 'CUST-' + String(customers.length + 1).padStart(5, '0'),
        name: document.getElementById('customerName').value,
        company: document.getElementById('customerCompany').value,
        email: document.getElementById('customerEmail').value,
        phone: document.getElementById('customerPhone').value,
        address: document.getElementById('customerAddress').value,
        notes: document.getElementById('customerNotes').value,
        createdDate: new Date().toISOString().split('T')[0]
    };
    
    customers.push(customer);
    saveData();
    renderCustomers();
    updateDashboard();
    closeModal('addCustomerModal');
    e.target.reset();
}

function editCustomer(index) {
    const customer = customers[index];
    document.getElementById('customerName').value = customer.name;
    document.getElementById('customerCompany').value = customer.company;
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
    renderLeads();
    updateDashboard();
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
    
    const customer = {
        id: 'CUST-' + String(customers.length + 1).padStart(5, '0'),
        name: document.getElementById('quickCustomerName').value,
        company: document.getElementById('quickCustomerCompany').value,
        email: document.getElementById('quickCustomerEmail').value,
        phone: document.getElementById('quickCustomerPhone').value,
        address: '',
        notes: '',
        createdDate: new Date().toISOString().split('T')[0]
    };
    
    customers.push(customer);
    saveData();
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
    
    // Header
    doc.setFontSize(24);
    doc.setTextColor(79, 70, 229);
    doc.text('ESTIMATE / QUOTATION', 105, 20, { align: 'center' });
    
    // Company Info (placeholder)
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('Your Company Name', 14, 35);
    doc.text('Address Line 1, City, State ZIP', 14, 40);
    doc.text('Phone: (555) 123-4567', 14, 45);
    doc.text('Email: info@yourcompany.com', 14, 50);
    
    // Estimate Info
    doc.setFontSize(10);
    doc.text(`Estimate #: ${lead.id}`, 140, 35);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, 40);
    doc.text(`Valid Until: ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}`, 140, 45);
    
    // Customer Info
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('CUSTOMER INFORMATION', 14, 65);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    
    if (customer) {
        doc.text(`Name: ${customer.name}`, 14, 72);
        doc.text(`Company: ${customer.company}`, 14, 77);
        doc.text(`Email: ${customer.email}`, 14, 82);
        doc.text(`Phone: ${customer.phone}`, 14, 87);
    }
    
    // Project Info
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('PROJECT DETAILS', 14, 100);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text(`Project: ${lead.name}`, 14, 107);
    
    // Items Table
    const tableData = lead.bom.items.map(item => [
        item.name,
        item.type,
        item.quantity.toString(),
        `$${item.unitPrice.toFixed(2)}`,
        `$${(item.quantity * item.unitPrice).toFixed(2)}`
    ]);
    
    doc.autoTable({
        startY: 115,
        head: [['Item Description', 'Type', 'Qty', 'Unit Price', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        foot: [
            ['', '', '', 'Subtotal:', `$${lead.bom.subtotal.toFixed(2)}`],
            ['', '', '', `Profit (${lead.bom.profitPercent}%):`, `$${lead.bom.profit.toFixed(2)}`],
            ['', '', '', 'TOTAL:', `$${lead.bom.total.toFixed(2)}`]
        ],
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
    });
    
    // Notes/Terms
    if (lead.bom.notes) {
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('TERMS & CONDITIONS', 14, finalY);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        
        const splitNotes = doc.splitTextToSize(lead.bom.notes, 180);
        doc.text(splitNotes, 14, finalY + 7);
    }
    
    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text('Thank you for your business!', 105, pageHeight - 20, { align: 'center' });
    doc.text('Please contact us if you have any questions regarding this estimate.', 105, pageHeight - 15, { align: 'center' });
    
    // Save PDF
    doc.save(`Estimate_${lead.id}_${customer ? customer.name.replace(/\s/g, '_') : 'Customer'}.pdf`);
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