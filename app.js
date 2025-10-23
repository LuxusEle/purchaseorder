// Data Storage
let inventory = [];
let suppliers = [];
let orders = [];
let customers = [];
let leads = [];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
    updateDashboard();
    renderInventory();
    renderSuppliers();
    renderOrders();
    renderCustomers();
    renderLeads();
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
function renderLeads() {
    const tbody = document.getElementById('leadsTable');
    
    if (leads.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No leads added yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = leads.map((lead, index) => `
        <tr class="main-row" data-index="${index}">
            <td>
                <i class="fas fa-chevron-right expand-icon" onclick="toggleDetailRow(${index}, 'lead')"></i>
            </td>
            <td><strong>${lead.id}</strong></td>
            <td>${lead.name}</td>
            <td>${lead.company}</td>
            <td>${lead.email}</td>
            <td>${lead.phone}</td>
            <td><span class="badge badge-${lead.status}">${lead.status}</span></td>
            <td>${lead.source}</td>
            <td>
                <div class="action-buttons">
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
            <td colspan="9">
                <div class="detail-content">
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Lead ID</span>
                            <span class="detail-value">${lead.id}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Name</span>
                            <span class="detail-value">${lead.name}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Company</span>
                            <span class="detail-value">${lead.company}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Email</span>
                            <span class="detail-value">${lead.email}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Phone</span>
                            <span class="detail-value">${lead.phone}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Source</span>
                            <span class="detail-value">${lead.source}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Status</span>
                            <span class="detail-value"><span class="badge badge-${lead.status}">${lead.status}</span></span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Created</span>
                            <span class="detail-value">${lead.createdDate}</span>
                        </div>
                    </div>
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
    `).join('');
}

function filterLeads(filter) {
    const tbody = document.getElementById('leadsTable');
    
    let filtered = leads;
    if (filter !== 'all') {
        filtered = leads.filter(lead => lead.status === filter);
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No leads found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map((lead, originalIndex) => {
        const index = leads.indexOf(lead);
        return `
        <tr class="main-row" data-index="${index}">
            <td>
                <i class="fas fa-chevron-right expand-icon" onclick="toggleDetailRow(${index}, 'lead')"></i>
            </td>
            <td><strong>${lead.id}</strong></td>
            <td>${lead.name}</td>
            <td>${lead.company}</td>
            <td>${lead.email}</td>
            <td>${lead.phone}</td>
            <td><span class="badge badge-${lead.status}">${lead.status}</span></td>
            <td>${lead.source}</td>
            <td>
                <div class="action-buttons">
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
            <td colspan="9">
                <div class="detail-content">
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Lead ID</span>
                            <span class="detail-value">${lead.id}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Name</span>
                            <span class="detail-value">${lead.name}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Status</span>
                            <span class="detail-value"><span class="badge badge-${lead.status}">${lead.status}</span></span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Source</span>
                            <span class="detail-value">${lead.source}</span>
                        </div>
                    </div>
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

function handleAddLead(e) {
    e.preventDefault();
    
    const lead = {
        id: 'LEAD-' + String(leads.length + 1).padStart(5, '0'),
        name: document.getElementById('leadName').value,
        company: document.getElementById('leadCompany').value,
        email: document.getElementById('leadEmail').value,
        phone: document.getElementById('leadPhone').value,
        source: document.getElementById('leadSource').value,
        status: document.getElementById('leadStatus').value,
        interest: document.getElementById('leadInterest').value,
        notes: document.getElementById('leadNotes').value,
        createdDate: new Date().toISOString().split('T')[0]
    };
    
    leads.push(lead);
    saveData();
    renderLeads();
    updateDashboard();
    closeModal('addLeadModal');
    e.target.reset();
}

function editLead(index) {
    const lead = leads[index];
    document.getElementById('leadName').value = lead.name;
    document.getElementById('leadCompany').value = lead.company;
    document.getElementById('leadEmail').value = lead.email;
    document.getElementById('leadPhone').value = lead.phone;
    document.getElementById('leadSource').value = lead.source;
    document.getElementById('leadStatus').value = lead.status;
    document.getElementById('leadInterest').value = lead.interest || '';
    document.getElementById('leadNotes').value = lead.notes || '';
    
    leads.splice(index, 1);
    saveData();
    
    showAddLeadModal();
}

function deleteLead(index) {
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
    document.getElementById('addLeadModal').classList.add('active');
}