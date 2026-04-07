const API_URL = "https://employeemanagementsystembackend-9i49.onrender.com"
window.onload = checkAuth;
let currentUser = null; 

async function checkAuth() {
    const token = localStorage.getItem("token");
    if (token) {
        const response = await fetch(`${API_URL}/users/me`, { headers: getAuthHeaders() });
        
        if (response.ok) {
            currentUser = await response.json();
            document.getElementById("login-section").classList.add("hidden");
            document.getElementById("app-section").classList.remove("hidden");
            document.getElementById("logout-btn").classList.remove("hidden");
            
            const addEmployeeForm = document.getElementById("add-employee-form");
            if (currentUser.is_admin) {
                addEmployeeForm.classList.remove("hidden");
            } else {
                addEmployeeForm.classList.add("hidden");
            }
            loadDashboard();
        } else {
            logout();
        }
    } else {
        document.getElementById("login-section").classList.remove("hidden");
        document.getElementById("app-section").classList.add("hidden");
        document.getElementById("logout-btn").classList.add("hidden");
    }
}

async function loadDashboard() {
    const response = await fetch(`${API_URL}/employees/`);
    const employees = await response.json();
    
    const dashboard = document.getElementById('dashboard');
    dashboard.innerHTML = ''; 

    const archiveContainer = document.getElementById('archive-content');
    if (archiveContainer) archiveContainer.innerHTML = ''; 

    employees.forEach(emp => {
        const safeTasks = emp.tasks || [];
        
        const activeTasks = safeTasks.filter(t => !t.is_archived);
        const archivedTasks = safeTasks.filter(t => t.is_archived);
        
        let tasksHTML = activeTasks.map(task => {
            const safeComments = task.comments || [];
            
            const assignedDate = new Date(task.created_at).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric'
            });

            // THIS IS THE PART YOU WERE MISSING: Generating the Drive Link HTML
            let driveLinkHTML = task.drive_link 
                ? `<div class="mt-2 text-xs">
                     <a href="${escapeHTML(task.drive_link)}" target="_blank" class="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 font-medium">
                       🔗 View Attached Files
                     </a>
                     <button onclick="updateDriveLink(${task.id}, true)" class="text-gray-400 hover:text-gray-600 ml-3 text-[10px] uppercase tracking-wide font-bold">Edit Link</button>
                   </div>`
                : `<div class="mt-2 flex gap-2 items-center">
                     <input type="url" id="drive-link-${task.id}" placeholder="Paste Google Drive link..." class="border border-gray-200 p-1.5 rounded text-xs flex-1 outline-none focus:border-blue-400 bg-gray-50">
                     <button onclick="updateDriveLink(${task.id})" class="bg-blue-50 text-blue-600 font-medium text-xs px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors">Attach</button>
                   </div>`;

            let commentsHTML = safeComments.map(c => {
                const authorName = c.author ? c.author.username : 'Unknown';
                return `
                    <div class="text-xs text-gray-700 border-l-4 border-gray-300 pl-3 py-1 mt-2">
                        <span class="font-bold text-gray-900">@${authorName}:</span> ${escapeHTML(c.text)}
                    </div>
                `;
            }).join('');

            return `
                <div class="bg-white p-4 rounded mt-3 border-2 border-gray-200">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex-1 pr-2">
                            <span class="${task.status === 'Completed' ? 'line-through text-gray-400' : 'text-gray-900 font-medium'} block">
                                ${escapeHTML(task.description)}
                            </span>
                            <p class="text-[10px] text-gray-400 mt-1 uppercase tracking-wide">Assigned: ${assignedDate}</p>
                            
                            ${driveLinkHTML}
                            
                        </div>
                        <div class="flex gap-2 flex-shrink-0">
                            ${task.status !== 'Completed' 
                                ? `<button onclick="completeTask(${task.id})" class="text-xs border border-green-600 text-green-700 hover:bg-green-50 px-3 py-1 rounded">Finish</button>` 
                                : `<span class="text-xs text-green-600 font-bold self-center">Done ✓</span>`}
                            <button onclick="archiveTask(${task.id})" class="text-xs border border-gray-400 text-gray-500 hover:bg-gray-100 px-3 py-1 rounded">Archive</button>
                        </div>
                    </div>
                    
                    <div class="mb-3">${commentsHTML}</div>
                    
                    <div class="flex flex-col sm:flex-row gap-2 mt-2 border-t-2 border-gray-50 pt-3">
                        <input type="text" id="comment-desc-${task.id}" placeholder="Type a comment..." class="border-2 border-gray-200 p-2 rounded text-xs flex-1 w-full outline-none focus:border-gray-500 bg-gray-50">
                        <button onclick="addComment(${task.id})" class="border border-gray-800 text-gray-800 font-medium text-xs px-4 py-2 rounded hover:bg-gray-100 w-full sm:w-auto transition-colors">Reply</button>
                    </div>
                </div>
            `;
        }).join('');

        
        if (archiveContainer) {
            archivedTasks.forEach(task => {
                const assignedDate = new Date(task.created_at).toLocaleDateString();
                archiveContainer.innerHTML += `
                    <div class="bg-gray-50 p-3 rounded border border-gray-200 opacity-75 mb-3">
                        <p class="text-xs font-bold text-gray-600 mb-1">${emp.name}'s Task:</p>
                        <p class="text-sm text-gray-800 line-through">${escapeHTML(task.description)}</p>
                        <div class="flex justify-between items-center mt-2">
                            <p class="text-[10px] text-gray-500">${assignedDate}</p>
                            <button onclick="unarchiveTask(${task.id})" class="text-[10px] text-blue-600 hover:underline">Unarchive</button>
                        </div>
                    </div>
                `;
            });
        }

        let promoteBtn = currentUser.is_admin && !emp.is_admin 
            ? `<button onclick="promoteEmployee(${emp.id})" class="text-xs font-semibold text-gray-500 hover:text-gray-900 mr-3">MAKE ADMIN</button>`
            : '';

        let deleteBtn = currentUser.is_admin && currentUser.id !== emp.id 
            ? `<button onclick="deleteEmployee(${emp.id})" class="text-xs font-semibold text-red-500 hover:text-red-700">DELETE</button>`
            : '';

        let canAssignTask = currentUser.is_admin || currentUser.id === emp.id;
        
        let assignTaskHTML = canAssignTask ? `
            <div class="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t-2 border-gray-100">
                <input type="text" id="task-desc-${emp.id}" placeholder="New task..." class="border-2 border-gray-200 p-2 rounded text-sm flex-1 w-full outline-none focus:border-gray-800">
                <button onclick="addTask(${emp.id})" class="bg-gray-800 text-white text-sm px-4 py-2 rounded w-full sm:w-auto hover:bg-gray-900">Assign</button>
            </div>
        ` : '';

        dashboard.innerHTML += `
            <div class="bg-white p-6 rounded-lg border-2 border-gray-300 relative">
                <div class="absolute top-4 right-4">${promoteBtn} ${deleteBtn}</div>
                <h3 class="text-lg font-bold text-gray-900">${emp.name} 
                    <span class="text-xs font-normal ${emp.is_admin ? 'text-red-600 font-bold' : 'text-gray-500'}">
                        (@${emp.username}) ${emp.is_admin ? '[SUDO]' : ''}
                    </span>
                </h3>
                <p class="text-sm text-gray-600 mb-4">${emp.role}</p>
                <div class="mb-4">
                    <h4 class="font-semibold text-sm text-gray-500 tracking-wider uppercase mb-2">Current Tasks</h4>
                    ${tasksHTML || '<p class="text-sm text-gray-400">No active tasks.</p>'}
                </div>
                ${assignTaskHTML}
            </div>
        `;
    });
}

async function login() {
    const usernameInput = document.getElementById("login-username").value;
    const passwordInput = document.getElementById("login-password").value;
    const formData = new URLSearchParams();
    formData.append("username", usernameInput);
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
        alert("Invalid username or password");
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

async function addEmployee() {
    const nameInput = document.getElementById('emp-name');
    const roleInput = document.getElementById('emp-role');
    const usernameInput = document.getElementById('emp-username');
    const passwordInput = document.getElementById('emp-password');
    const isAdminInput = document.getElementById('emp-is-admin'); 
    
    await fetch(`${API_URL}/employees/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
            name: nameInput.value, 
            role: roleInput.value,
            username: usernameInput.value,
            password: passwordInput.value,
            is_admin: isAdminInput.checked 
        })
    });

    nameInput.value = ''; roleInput.value = ''; usernameInput.value = ''; passwordInput.value = '';
    isAdminInput.checked = false;
    loadDashboard(); 
}

async function deleteEmployee(employeeId) {
    if(!confirm("Are you sure you want to delete this employee?")) return;
    await fetch(`${API_URL}/employees/${employeeId}`, { method: 'DELETE', headers: getAuthHeaders() });
    loadDashboard();
}

async function promoteEmployee(employeeId) {
    if(!confirm("Are you sure you want to grant this user Sudo privileges?")) return;
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
    if (response.ok) loadDashboard(); 
    else alert("Something went wrong adding your comment!");
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function toggleArchiveMenu() {
    const sidebar = document.getElementById('archive-sidebar');
    const archiveBtn = document.getElementById('archive-btn');
    
    if (sidebar) {
        
        sidebar.classList.toggle('-translate-x-full');
        
        
        if (sidebar.classList.contains('-translate-x-full')) {
            archiveBtn.classList.remove('hidden');
        } else {
            archiveBtn.classList.add('hidden');
        }
    }
}

async function archiveTask(taskId) {
    await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'PUT', 
        headers: getAuthHeaders(), 
        body: JSON.stringify({ is_archived: true })
    });
    loadDashboard();
}

async function unarchiveTask(taskId) {
    await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'PUT', 
        headers: getAuthHeaders(), 
        body: JSON.stringify({ is_archived: false })
    });
    loadDashboard();
}

async function updateDriveLink(taskId, isEdit = false) {
    let newLink;
    
    if (isEdit) {
        newLink = prompt("Enter the new Google Drive link:");
        if (newLink === null) return; 
    } else {
        const linkInput = document.getElementById(`drive-link-${taskId}`);
        if (!linkInput.value) return;
        newLink = linkInput.value;
    }

    await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'PUT', 
        headers: getAuthHeaders(), 
        body: JSON.stringify({ drive_link: newLink })
    });
    loadDashboard();
}