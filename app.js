// Data Storage
let inventory = [];
let suppliers = [];
let orders = [];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
    updateDashboard();
    renderInventory();
    renderSuppliers();
    renderOrders();
});

// Load data from localStorage
function loadData() {
    const savedInventory = localStorage.getItem('inventory');
    const savedSuppliers = localStorage.getItem('suppliers');
    const savedOrders = localStorage.getItem('orders');
    
    if (savedInventory) inventory = JSON.parse(savedInventory);
    if (savedSuppliers) suppliers = JSON.parse(savedSuppliers);
    if (savedOrders) orders = JSON.parse(savedOrders);
}

// Save data to localStorage
function saveData() {
    localStorage.setItem('inventory', JSON.stringify(inventory));
    localStorage.setItem('suppliers', JSON.stringify(suppliers));
    localStorage.setItem('orders', JSON.stringify(orders));
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
            document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const filter = e.target.dataset.filter;
            filterInventory(filter);
        });
    });
    
    // Forms
    document.getElementById('addItemForm').addEventListener('submit', handleAddItem);
    document.getElementById('addSupplierForm').addEventListener('submit', handleAddSupplier);
    document.getElementById('createOrderForm').addEventListener('submit', handleCreateOrder);
    
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
        orders: 'Purchase Orders'
    };
    document.getElementById('page-title').textContent = titles[pageName];
}

// Dashboard Updates
function updateDashboard() {
    // Update stats
    document.getElementById('totalItems').textContent = inventory.length;
    document.getElementById('totalSuppliers').textContent = suppliers.length;
    
    const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
    document.getElementById('pendingOrders').textContent = pendingOrdersCount;
    
    const totalValue = inventory.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    document.getElementById('totalValue').textContent = `$${totalValue.toLocaleString()}`;
    
    // Update recent activity
    updateRecentActivity();
}

function updateRecentActivity() {
    const activityList = document.getElementById('activityList');
    
    if (inventory.length === 0 && suppliers.length === 0 && orders.length === 0) {
        activityList.innerHTML = '<p class="empty-state">No recent activity</p>';
        return;
    }
    
    let activities = [];
    
    // Get recent items (last 5)
    const recentItems = inventory.slice(-5).reverse();
    recentItems.forEach(item => {
        activities.push({
            type: 'item',
            text: `Added new ${item.type}: ${item.name}`,
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
        <tr>
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
    `).join('');
}

function filterInventory(filter) {
    const tbody = document.getElementById('inventoryTable');
    
    let filtered = inventory;
    if (filter !== 'all') {
        filtered = inventory.filter(item => item.type === filter);
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No items found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map((item, index) => `
        <tr>
            <td><strong>${item.code}</strong></td>
            <td>${item.name}</td>
            <td><span class="badge badge-${item.type}">${item.type}</span></td>
            <td>${item.supplier}</td>
            <td>${item.quantity}</td>
            <td>$${item.price.toFixed(2)}</td>
            <td>$${(item.quantity * item.price).toFixed(2)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action btn-edit" onclick="editItem(${inventory.indexOf(item)})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-action btn-delete" onclick="deleteItem(${inventory.indexOf(item)})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function handleAddItem(e) {
    e.preventDefault();
    
    const item = {
        code: document.getElementById('itemCode').value,
        name: document.getElementById('itemName').value,
        type: document.getElementById('itemType').value,
        supplier: document.getElementById('itemSupplier').value,
        quantity: parseInt(document.getElementById('itemQuantity').value),
        price: parseFloat(document.getElementById('itemPrice').value),
        description: document.getElementById('itemDescription').value
    };
    
    inventory.push(item);
    saveData();
    renderInventory();
    updateDashboard();
    closeModal('addItemModal');
    e.target.reset();
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