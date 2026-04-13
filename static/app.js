const API_URL = "https://employeemanagementsystembackend-9i49.onrender.com"
window.onload = checkAuth;
let currentUser = null; 

async function checkAuth() {
    const token = localStorage.getItem("token");
    if (token) {
        const response = await fetch(`${API_URL}/users/me`, { headers: getAuthHeaders() });
        
        if (response.ok) {
            currentUser = await response.json();
            
            // Toggle Visibility
            document.getElementById("login-section").classList.add("hidden");
            document.getElementById("app-section").classList.remove("hidden");
            
            // Set User Data in Header/Nav
            const initials = currentUser.name.substring(0, 2).toUpperCase();
            document.getElementById("header-initials").textContent = initials;
            if(document.getElementById("side-initials")) {
                document.getElementById("side-initials").textContent = initials;
                document.getElementById("side-username").textContent = currentUser.username;
                document.getElementById("side-role").textContent = currentUser.is_admin ? "ADMIN" : "STANDARD USER";
            }

            // Show/Hide Admin Controls
            const adminControls = document.getElementById("admin-controls");
            if (currentUser.is_admin) {
                adminControls.classList.remove("hidden");
            } else {
                adminControls.classList.add("hidden");
            }
            
            loadDashboard();
        } else {
            logout();
        }
    } else {
        document.getElementById("login-section").classList.remove("hidden");
        document.getElementById("app-section").classList.add("hidden");
    }
}

async function loadDashboard() {
    const response = await fetch(`${API_URL}/employees/`);
    const employees = await response.json();
    
    const teamGrid = document.getElementById('team-grid');
    const tasksFeed = document.getElementById('tasks-feed');
    const archiveContainer = document.getElementById('archive-content');
    
    teamGrid.innerHTML = ''; 
    tasksFeed.innerHTML = '';
    archiveContainer.innerHTML = ''; 

    let totalTasksCompleted = 0;
    let allActiveTasksHTML = '';

    employees.forEach(emp => {
        const safeTasks = emp.tasks || [];
        const activeTasks = safeTasks.filter(t => !t.is_archived);
        const archivedTasks = safeTasks.filter(t => t.is_archived);
        
        // Count metrics
        totalTasksCompleted += safeTasks.filter(t => t.status === 'Completed').length;

        // 1. GENERATE TEAM CARDS (The Bento Grid items)
        const initials = emp.name.substring(0, 2).toUpperCase();
        let promoteBtn = currentUser.is_admin && !emp.is_admin 
            ? `<button onclick="promoteEmployee(${emp.id})" class="text-[9px] font-bold text-[#717c82] hover:text-primary uppercase tracking-widest bg-surface-container-highest px-2 py-1 rigid-border">MAKE ADMIN</button>`
            : '';
        let deleteBtn = currentUser.is_admin && currentUser.id !== emp.id 
            ? `<button onclick="deleteEmployee(${emp.id})" class="text-[9px] font-bold text-error hover:bg-error hover:text-white uppercase tracking-widest bg-error/10 px-2 py-1 rigid-border">DELETE</button>`
            : '';

        let canAssignTask = currentUser.is_admin || currentUser.id === emp.id;
        let assignTaskHTML = canAssignTask ? `
            <div class="mt-4 pt-4 border-t border-[#2a3439]/20 flex gap-2">
                <input type="text" id="task-desc-${emp.id}" placeholder="Type new task..." class="rigid-border p-2 text-xs flex-1 outline-none focus:bg-surface-container-highest font-body placeholder:text-gray-400">
                <button onclick="addTask(${emp.id})" class="bg-[#2a3439] text-white material-symbols-outlined rigid-border hover:bg-black px-2 text-sm">add</button>
            </div>
        ` : '';

        const displayEmail = emp.email ? `<br><a href="mailto:${escapeHTML(emp.email)}" class="text-primary hover:underline lowercase">${escapeHTML(emp.email)}</a>` : '';

        teamGrid.innerHTML += `
            <div class="bg-surface-container-lowest rigid-border p-6 hover:bg-surface-container transition-none relative flex flex-col justify-between">
                <div class="absolute top-4 right-4 flex gap-1">${promoteBtn} ${deleteBtn}</div>
                <div class="flex items-center gap-4 mb-2 mt-4">
                    <div class="w-12 h-12 ${emp.is_admin ? 'bg-error' : 'bg-[#495f84]'} text-white font-black flex items-center justify-center text-lg rigid-border font-headline">${initials}</div>
                    <div>
                        <h3 class="font-bold text-on-background font-headline text-sm uppercase leading-tight">${escapeHTML(emp.name)}</h3>
                        <p class="label-technical text-[9px] text-[#717c82] mt-1">${escapeHTML(emp.role)} | @${escapeHTML(emp.username)} ${displayEmail}</p>
                    </div>
                </div>
                ${assignTaskHTML}
            </div>
        `;

        // 2. GENERATE TASKS FEED (Extracting all tasks into the central list)
        activeTasks.forEach(task => {
            const safeComments = task.comments || [];
            const assignedDate = new Date(task.created_at || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

            let driveLinkHTML = task.drive_link 
                ? `<div class="mt-2 text-xs font-body">
                     <a href="${escapeHTML(task.drive_link)}" target="_blank" class="text-primary hover:text-primary-dim hover:underline font-bold inline-flex items-center gap-1">🔗 View Attachment</a>
                     <button onclick="updateDriveLink(${task.id}, true)" class="text-[#717c82] hover:text-[#2a3439] ml-4 text-[10px] label-technical tracking-wide">Edit Link</button>
                   </div>`
                : `<div class="mt-2 flex gap-2 items-center">
                     <input type="url" id="drive-link-${task.id}" placeholder="Paste file link..." class="rigid-border p-1.5 text-xs flex-1 outline-none focus:bg-surface-container font-body">
                     <button onclick="updateDriveLink(${task.id})" class="bg-surface-container-highest text-on-background font-bold label-technical text-[10px] px-3 py-1.5 rigid-border hover:bg-[#d4e3ff]">Attach</button>
                   </div>`;

            let commentsHTML = safeComments.map(c => {
                const authorName = c.author ? c.author.username : 'Unknown';
                return `<div class="text-xs text-on-background border-l-4 border-primary pl-3 py-1 mt-2 font-body"><span class="font-bold">@${escapeHTML(authorName)}:</span> ${escapeHTML(c.text)}</div>`;
            }).join('');

            allActiveTasksHTML += `
                <div class="bg-surface-container-lowest rigid-border p-5 relative group">
                    <div class="flex flex-col sm:flex-row justify-between items-start gap-4 mb-2">
                        <div class="flex-1">
                            <div class="label-technical text-[9px] text-[#717c82] mb-1">ASSIGNED TO: ${escapeHTML(emp.name)} <span class="mx-2">|</span> DATE: ${assignedDate}</div>
                            <span class="${task.status === 'Completed' ? 'line-through text-[#717c82]' : 'text-on-background font-bold'} text-lg font-headline uppercase leading-tight block">
                                ${escapeHTML(task.description)}
                            </span>
                            ${driveLinkHTML}
                        </div>
                        <div class="flex gap-2 flex-shrink-0 mt-2 sm:mt-0">
                            ${task.status !== 'Completed' 
                                ? `<button onclick="completeTask(${task.id})" class="label-technical text-[10px] bg-[#e1e9ee] text-primary hover:bg-primary hover:text-white px-3 py-2 rigid-border transition-colors">Finish</button>` 
                                : `<span class="label-technical text-[10px] text-green-600 px-3 py-2 rigid-border border-green-600 bg-green-50">Completed ✓</span>`}
                            <button onclick="archiveTask(${task.id})" class="material-symbols-outlined text-[#717c82] hover:text-on-background rigid-border px-2 py-1 bg-surface" title="Archive">inventory_2</button>
                        </div>
                    </div>
                    
                    <div class="mb-3 pl-2">${commentsHTML}</div>
                    
                    <div class="flex gap-2 mt-4 pt-3 border-t border-[#2a3439]/10">
                        <input type="text" id="comment-desc-${task.id}" placeholder="Type a comment..." class="rigid-border p-2 text-xs flex-1 outline-none focus:bg-surface-container font-body">
                        <button onclick="addComment(${task.id})" class="bg-surface-container-highest text-on-background label-technical text-[10px] px-4 py-2 rigid-border hover:bg-[#d4e3ff]">Reply</button>
                    </div>
                </div>
            `;
        });

        // 3. GENERATE ARCHIVE (Sidebar)
        archivedTasks.forEach(task => {
            const assignedDate = new Date(task.created_at || Date.now()).toLocaleDateString();
            archiveContainer.innerHTML += `
                <div class="bg-surface p-3 rigid-border mb-3 font-body opacity-80 hover:opacity-100">
                    <p class="label-technical text-[9px] text-[#717c82] mb-1">${escapeHTML(emp.name)}</p>
                    <p class="text-xs text-on-background line-through uppercase font-bold">${escapeHTML(task.description)}</p>
                    <div class="flex justify-between items-center mt-3 pt-2 border-t border-[#2a3439]/20">
                        <p class="text-[9px] font-mono text-[#717c82]">${assignedDate}</p>
                        <button onclick="unarchiveTask(${task.id})" class="label-technical text-[9px] text-primary hover:underline">Restore</button>
                    </div>
                </div>
            `;
        });
    });

    tasksFeed.innerHTML = allActiveTasksHTML || '<div class="p-8 text-center border-2 border-dashed border-[#717c82] text-[#717c82] font-headline uppercase">No active tasks found.</div>';
    
    // Update Metrics
    document.getElementById('metric-staff').textContent = employees.length.toString().padStart(2, '0');
    document.getElementById('metric-tasks').textContent = totalTasksCompleted.toLocaleString();
}

// === AUTHENTICATION LOGIC ===

async function login() {
    const emailInput = document.getElementById("login-email").value;
    const passwordInput = document.getElementById("login-password").value;
    const formData = new URLSearchParams();
    
    formData.append("username", emailInput);
    formData.append("password", passwordInput);

    const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData
    });

    if (response.ok) {
        const data = await response.json();
        localStorage.setItem("token", data.access_token);
        checkAuth();
    } else {
        alert("Invalid email or password.");
    }
}

function logout() {
    localStorage.removeItem("token");
    checkAuth();
}

function getAuthHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
    };
}

// === UI TOGGLES ===

function toggleAddEmployee() {
    document.getElementById('add-employee-form').classList.toggle('hidden');
}

function toggleArchiveMenu() {
    const sidebar = document.getElementById('archive-sidebar');
    if (sidebar.classList.contains('translate-x-full')) {
        sidebar.classList.remove('translate-x-full');
    } else {
        sidebar.classList.add('translate-x-full');
    }
}

function toggleForgotPassword() {
    document.getElementById("login-box").classList.toggle("hidden");
    document.getElementById("forgot-box").classList.toggle("hidden");
    document.getElementById("reset-msg").classList.add("hidden"); 
}

// === API ACTIONS ===

async function addEmployee() {
    const nameInput = document.getElementById('emp-name');
    const roleInput = document.getElementById('emp-role');
    const emailInput = document.getElementById('emp-email');
    const usernameInput = document.getElementById('emp-username');
    const passwordInput = document.getElementById('emp-password');
    const isAdminInput = document.getElementById('emp-is-admin'); 
    
    await fetch(`${API_URL}/employees/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
            name: nameInput.value, role: roleInput.value, email: emailInput.value, 
            username: usernameInput.value, password: passwordInput.value, is_admin: isAdminInput.checked 
        })
    });

    nameInput.value = ''; roleInput.value = ''; usernameInput.value = ''; emailInput.value = ''; passwordInput.value = '';
    isAdminInput.checked = false;
    toggleAddEmployee();
    loadDashboard(); 
}

async function deleteEmployee(employeeId) {
    if(!confirm("Are you sure you want to permanently delete this employee?")) return;
    await fetch(`${API_URL}/employees/${employeeId}`, { method: 'DELETE', headers: getAuthHeaders() });
    loadDashboard();
}

async function promoteEmployee(employeeId) {
    if(!confirm("Are you sure you want to make this user an Admin?")) return;
    await fetch(`${API_URL}/employees/${employeeId}/promote`, { method: 'PUT', headers: getAuthHeaders() });
    loadDashboard();
}

async function addTask(employeeId) {
    const descInput = document.getElementById(`task-desc-${employeeId}`);
    if (!descInput.value) return;
    await fetch(`${API_URL}/tasks/`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ description: descInput.value, employee_id: employeeId })
    });
    loadDashboard(); 
}

async function completeTask(taskId) {
    await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ status: 'Completed' })
    });
    loadDashboard();
}

async function addComment(taskId) {
    const textInput = document.getElementById(`comment-desc-${taskId}`);
    if (!textInput.value) return;
    const response = await fetch(`${API_URL}/tasks/${taskId}/comments`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ text: textInput.value })
    });
    if (response.ok) loadDashboard(); else alert("Something went wrong adding your comment.");
}

async function archiveTask(taskId) {
    await fetch(`${API_URL}/tasks/${taskId}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ is_archived: true }) });
    loadDashboard();
}

async function unarchiveTask(taskId) {
    await fetch(`${API_URL}/tasks/${taskId}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ is_archived: false }) });
    loadDashboard();
}

async function updateDriveLink(taskId, isEdit = false) {
    let newLink;
    if (isEdit) {
        newLink = prompt("Enter the new file URL:");
        if (newLink === null) return; 
    } else {
        const linkInput = document.getElementById(`drive-link-${taskId}`);
        if (!linkInput.value) return;
        newLink = linkInput.value;
    }
    await fetch(`${API_URL}/tasks/${taskId}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ drive_link: newLink }) });
    loadDashboard();
}

async function sendResetLink() {
    const email = document.getElementById("reset-email").value;
    if (!email) return alert("Please enter your email address.");

    const msgEl = document.getElementById("reset-msg");
    msgEl.textContent = "Sending...";
    msgEl.className = "text-xs text-left mt-4 font-bold font-body text-[#717c82] block"; 
    
    try {
        const response = await fetch(`${API_URL}/forgot-password?email=${encodeURIComponent(email)}`, { method: 'POST' });
        const data = await response.json();
        msgEl.textContent = data.message;
        msgEl.className = "text-xs text-left mt-4 font-bold font-body text-green-600 block";
    } catch (error) {
        msgEl.textContent = "Something went wrong. Try again.";
        msgEl.className = "text-xs text-left mt-4 font-bold font-body text-error block";
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}