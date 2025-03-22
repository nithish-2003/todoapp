// Import voice assistant
import VoiceAssistant from './voice-assistant.js';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const taskInput = document.getElementById('taskInput');
    const addBtn = document.getElementById('addBtn');
    const taskList = document.getElementById('taskList');
    const taskCount = document.getElementById('taskCount');
    const clearCompletedBtn = document.getElementById('clearCompletedBtn');
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    // App State
    let tasks = [];
    let currentFilter = 'all';
    let isOnline = navigator.onLine;
    
    // Check online status
    window.addEventListener('online', () => {
        isOnline = true;
        showToast('You are online');
    });
    
    window.addEventListener('offline', () => {
        isOnline = false;
        showToast('You are offline. Changes will be saved locally.');
    });
    
    // Show toast message
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }
    
    // Load tasks from local storage
    function loadTasks() {
        const storedTasks = localStorage.getItem('tasks');
        if (storedTasks) {
            tasks = JSON.parse(storedTasks);
            renderTasks();
        }
    }
    
    // Add a new task
    function addTask() {
        const taskText = taskInput.value.trim();
        if (taskText === '') return;
        
        const newTask = {
            id: Date.now(),
            text: taskText,
            completed: false,
            created_at: new Date().toISOString()
        };
        
        // Add to tasks array and update UI
        tasks.unshift(newTask);
        localStorage.setItem('tasks', JSON.stringify(tasks));
        renderTasks();
        taskInput.value = '';
        taskInput.focus();
    }
    
    // Delete a task
    function deleteTask(id) {
        tasks = tasks.filter(task => task.id !== id);
        localStorage.setItem('tasks', JSON.stringify(tasks));
        renderTasks();
    }
    
    // Toggle task completion status
    function toggleTaskStatus(id) {
        const task = tasks.find(task => task.id === id);
        if (!task) return;
        
        task.completed = !task.completed;
        localStorage.setItem('tasks', JSON.stringify(tasks));
        renderTasks();
    }
    
    // Clear all completed tasks
    function clearCompletedTasks() {
        tasks = tasks.filter(task => !task.completed);
        localStorage.setItem('tasks', JSON.stringify(tasks));
        renderTasks();
    }
    
    // Filter tasks based on current filter
    function getFilteredTasks() {
        switch (currentFilter) {
            case 'active':
                return tasks.filter(task => !task.completed);
            case 'completed':
                return tasks.filter(task => task.completed);
            default:
                return tasks;
        }
    }
    
    // Update task count display
    function updateTaskCount() {
        const activeTasks = tasks.filter(task => !task.completed).length;
        taskCount.textContent = `${activeTasks} task${activeTasks !== 1 ? 's' : ''} left`;
    }
    
    // Render tasks to the DOM
    function renderTasks() {
        const filteredTasks = getFilteredTasks();
        taskList.innerHTML = '';
        
        filteredTasks.forEach(task => {
            const taskItem = document.createElement('li');
            taskItem.className = `task-item ${task.completed ? 'completed' : ''}`;
            
            taskItem.innerHTML = `
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                <span class="task-text">${task.text}</span>
                <button class="delete-btn"><i class="fas fa-trash"></i></button>
            `;
            
            const checkbox = taskItem.querySelector('.task-checkbox');
            checkbox.addEventListener('change', () => toggleTaskStatus(task.id));
            
            const deleteBtn = taskItem.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', () => deleteTask(task.id));
            
            // Add swipe to delete functionality for mobile
            addSwipeToDelete(taskItem, task.id);
            
            taskList.appendChild(taskItem);
        });
        
        updateTaskCount();
    }
    
    // Add swipe to delete functionality
    function addSwipeToDelete(element, taskId) {
        let touchStartX = 0;
        let touchEndX = 0;
        
        element.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        element.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe(taskId);
        }, { passive: true });
        
        function handleSwipe(id) {
            const swipeThreshold = 100; // Minimum distance for swipe
            if (touchStartX - touchEndX > swipeThreshold) {
                // Swipe left detected
                deleteTask(id);
            }
        }
    }
    
    // Set active filter
    function setFilter(filter) {
        currentFilter = filter;
        
        filterBtns.forEach(btn => {
            if (btn.getAttribute('data-filter') === filter) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        renderTasks();
    }
    
    // Event Listeners
    addBtn.addEventListener('click', addTask);
    
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });
    
    clearCompletedBtn.addEventListener('click', clearCompletedTasks);
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.getAttribute('data-filter');
            setFilter(filter);
        });
    });
    
    // Initialize voice assistant
    const voiceAssistant = new VoiceAssistant();
    const voiceAssistantBtn = document.getElementById('voiceAssistantBtn');
    const chatContainer = document.getElementById('chatContainer');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const chatCloseBtn = document.getElementById('chatCloseBtn');
    
    // Voice assistant button functionality
    voiceAssistantBtn.addEventListener('click', () => {
        if (voiceAssistant.isListening) {
            voiceAssistant.stopListening();
            voiceAssistantBtn.classList.remove('listening');
        } else {
            voiceAssistant.startListening();
            voiceAssistantBtn.classList.add('listening');
        }
        
        // Toggle chat interface
        chatContainer.classList.toggle('open');
    });
    
    // Chat interface functionality
    chatCloseBtn.addEventListener('click', () => {
        chatContainer.classList.remove('open');
    });
    
    chatSendBtn.addEventListener('click', sendChatMessage);
    
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
    
    function sendChatMessage() {
        const message = chatInput.value.trim();
        if (message === '') return;
        
        // Add user message to chat
        addMessageToChat('user', message);
        
        // Process the message
        processUserMessage(message);
        
        // Clear input
        chatInput.value = '';
        chatInput.focus();
    }
    
    function processUserMessage(message) {
        // If voice assistant is not listening, start it
        if (!voiceAssistant.isListening) {
            voiceAssistant.startListening();
            voiceAssistantBtn.classList.add('listening');
        }
        
        // If message contains wake word, process it directly
        if (message.toLowerCase().includes(voiceAssistant.wakeWord)) {
            const response = 'Yes, how can I help you?';
            addMessageToChat('assistant', response);
            voiceAssistant.speak(response);
            return;
        }
        
        // Handle task-related commands
        if (message.toLowerCase().includes('add task')) {
            const response = 'When would you like to schedule this task?';
            addMessageToChat('assistant', response);
            voiceAssistant.speak(response);
            voiceAssistant.conversationState = 'awaiting_date';
        } else if (message.toLowerCase().includes('delete task') || message.toLowerCase().includes('remove task')) {
            handleDeleteTaskCommand();
        } else if (message.toLowerCase().includes('what are my tasks') || message.toLowerCase().includes('show my tasks')) {
            handleShowTasksCommand();
        } else {
            // If in a conversation state, pass the message to the voice assistant
            if (voiceAssistant.conversationState !== 'idle') {
                // Simulate speech recognition result
                const fakeEvent = {
                    results: [[{ transcript: message }]]
                };
                voiceAssistant.handleSpeechResult(fakeEvent);
            } else {
                // Default response
                const response = "I'm not sure how to help with that. You can ask me to add a task, delete a task, or show your tasks.";
                addMessageToChat('assistant', response);
                voiceAssistant.speak(response);
            }
        }
    }
    
    async function handleDeleteTaskCommand() {
        const today = new Date().toISOString().split('T')[0];
        const tasks = await voiceAssistant.getTasksByDate(today);
        
        if (tasks.length === 0) {
            const response = 'You have no tasks scheduled for today. Which date would you like to check?';
            addMessageToChat('assistant', response);
            voiceAssistant.speak(response);
            voiceAssistant.conversationState = 'awaiting_delete_date';
        } else {
            const taskList = tasks.map((t, i) => `${i + 1}. ${t.text}`).join('\n');
            const response = `Here are your tasks for today:\n${taskList}\nWhich one would you like to delete? You can say the number or the task name.`;
            addMessageToChat('assistant', response);
            voiceAssistant.speak(response);
            voiceAssistant.pendingTask.tasksToDelete = tasks;
            voiceAssistant.conversationState = 'awaiting_delete_confirmation';
        }
    }
    
    async function handleShowTasksCommand() {
        const date = new Date().toISOString().split('T')[0];
        const tasks = await voiceAssistant.getTasksByDate(date);
        
        let response;
        if (tasks.length === 0) {
            response = 'You have no tasks scheduled for today.';
        } else {
            const taskList = tasks.map(t => `${t.text} at ${t.time}`).join('\n');
            response = `You have ${tasks.length} task${tasks.length !== 1 ? 's' : ''} for today:\n${taskList}`;
        }
        
        addMessageToChat('assistant', response);
        voiceAssistant.speak(response);
    }
    
    function addMessageToChat(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        messageDiv.textContent = text;
        
        // Add timestamp
        const timeSpan = document.createElement('div');
        timeSpan.className = 'message-time';
        const now = new Date();
        timeSpan.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageDiv.appendChild(timeSpan);
        
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Listen for chat messages from voice assistant
    document.addEventListener('chat-message', (e) => {
        const message = e.detail;
        addMessageToChat(message.sender, message.text);
    });
    
    // Initialize chat with existing messages
    const chatHistory = voiceAssistant.getChatHistory();
    if (chatHistory.length > 0) {
        chatHistory.forEach(message => {
            addMessageToChat(message.sender, message.text);
        });
    }
    
    // Initialize app
    loadTasks();
});