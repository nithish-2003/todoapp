// Voice Assistant Module

class VoiceAssistant {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.wakeWord = 'hey darling';
        this.conversationState = 'idle';
        this.pendingTask = {};
        this.chatHistory = [];
        this.initSpeechRecognition();
        this.initVoices();
        this.initDB();
    }

    initSpeechRecognition() {
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = this.handleSpeechResult.bind(this);
            this.recognition.onerror = this.handleSpeechError.bind(this);
        } else {
            console.error('Speech recognition not supported');
        }
    }

    initVoices() {
        let voices = [];
        const setVoices = () => {
            voices = this.synthesis.getVoices();
            this.femaleVoice = voices.find(voice => voice.name.includes('female') || voice.name.includes('Female'));
        };

        setVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = setVoices;
        }
    }

    startListening() {
        if (this.recognition && !this.isListening) {
            this.recognition.start();
            this.isListening = true;
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
            this.isListening = false;
        }
    }

    speak(text) {
        const utterance = new SpeechSynthesisUtterance(text);
        if (this.femaleVoice) {
            utterance.voice = this.femaleVoice;
        }
        utterance.pitch = 1.2;
        utterance.rate = 1.0;
        this.synthesis.speak(utterance);
    }

    async parseDate(dateStr) {
        // More sophisticated date parsing
        const months = {
            'january': '01', 'jan': '01', 'february': '02', 'feb': '02', 'march': '03', 'mar': '03',
            'april': '04', 'apr': '04', 'may': '05', 'june': '06', 'jun': '06', 'july': '07', 'jul': '07',
            'august': '08', 'aug': '08', 'september': '09', 'sep': '09', 'october': '10', 'oct': '10',
            'november': '11', 'nov': '11', 'december': '12', 'dec': '12'
        };
        
        // Extract day, month, year from the string
        let day, month, year;
        
        // Check for month names
        for (const monthName in months) {
            if (dateStr.includes(monthName)) {
                month = months[monthName];
                break;
            }
        }
        
        // Extract day
        const dayMatch = dateStr.match(/\b(\d{1,2})(st|nd|rd|th)?\b/);
        if (dayMatch) {
            day = dayMatch[1].padStart(2, '0');
        }
        
        // Extract year
        const yearMatch = dateStr.match(/\b(20\d{2})\b/);
        if (yearMatch) {
            year = yearMatch[1];
        } else {
            // Default to current year if not specified
            year = new Date().getFullYear();
        }
        
        // If we couldn't parse the date, use today's date
        if (!month || !day) {
            const today = new Date();
            return today.toISOString().split('T')[0];
        }
        
        return `${year}-${month}-${day}`;
    }
    
    parseTime(timeStr) {
        // Convert spoken time to 24-hour format
        let hour, minute = '00';
        
        // Check for hour
        const hourMatch = timeStr.match(/\b(\d{1,2})\b/);
        if (hourMatch) {
            hour = parseInt(hourMatch[1]);
            
            // Check for AM/PM
            if (timeStr.includes('pm') && hour < 12) {
                hour += 12;
            } else if (timeStr.includes('am') && hour === 12) {
                hour = 0;
            }
            
            // Format hour as two digits
            hour = hour.toString().padStart(2, '0');
        } else {
            // Default to current hour if not specified
            hour = new Date().getHours().toString().padStart(2, '0');
        }
        
        // Check for minutes
        const minuteMatch = timeStr.match(/:(\d{1,2})/);
        if (minuteMatch) {
            minute = minuteMatch[1].padStart(2, '0');
        }
        
        return `${hour}:${minute}`;
    }

    async initDB() {
        const request = indexedDB.open('TodoDB', 1);
        
        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('tasks')) {
                const store = db.createObjectStore('tasks', { keyPath: 'id' });
                store.createIndex('date', 'date');
            }
        };

        request.onsuccess = (event) => {
            this.db = event.target.result;
        };
    }

    async addTaskToDB(task) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readwrite');
            const store = transaction.objectStore('tasks');
            const request = store.add(task);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getTasksByDate(date) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const index = store.index('date');
            const request = index.getAll(date);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteTask(taskId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readwrite');
            const store = transaction.objectStore('tasks');
            const request = store.delete(taskId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // This method is already implemented above with better functionality

    async handleSpeechResult(event) {
        const transcript = Array.from(event.results)
            .map(result => result[0].transcript.toLowerCase())
            .join('');

        // Add user message to chat history
        if (transcript.trim() !== '') {
            this.addMessageToChat('user', transcript);
        }

        if (transcript.includes(this.wakeWord)) {
            const response = 'Yes, how can I help you?';
            this.speak(response);
            this.addMessageToChat('assistant', response);
            this.conversationState = 'idle';
            this.pendingTask = {};
            this.stopListening();
            this.startListening();
            return;
        }

        switch (this.conversationState) {
            case 'idle':
                if (transcript.includes('add task') || transcript.includes('add this task')) {
                    const response = 'When would you like to schedule this task?';
                    this.speak(response);
                    this.addMessageToChat('assistant', response);
                    this.conversationState = 'awaiting_date';
                } else if (transcript.includes('delete task') || transcript.includes('remove task')) {
                    // Get today's tasks to show options
                    const today = new Date().toISOString().split('T')[0];
                    const tasks = await this.getTasksByDate(today);
                    
                    if (tasks.length === 0) {
                        const response = 'You have no tasks scheduled for today. Which date would you like to check?';
                        this.speak(response);
                        this.addMessageToChat('assistant', response);
                        this.conversationState = 'awaiting_delete_date';
                    } else {
                        const taskList = tasks.map((t, i) => `${i + 1}. ${t.text}`).join('\n');
                        const response = `Here are your tasks for today:\n${taskList}\nWhich one would you like to delete? You can say the number or the task name.`;
                        this.speak(response);
                        this.addMessageToChat('assistant', response);
                        this.pendingTask.tasksToDelete = tasks;
                        this.conversationState = 'awaiting_delete_confirmation';
                    }
                } else if (transcript.includes('what are my tasks') || transcript.includes('show my tasks') || transcript.includes('remaining tasks')) {
                    // Check if a specific date is mentioned
                    let date;
                    if (transcript.includes('today')) {
                        date = new Date().toISOString().split('T')[0];
                    } else if (transcript.includes('tomorrow')) {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        date = tomorrow.toISOString().split('T')[0];
                    } else {
                        // Try to parse a date from the transcript
                        for (const month of Object.keys({
                            'january': '01', 'jan': '01', 'february': '02', 'feb': '02', 'march': '03', 'mar': '03',
                            'april': '04', 'apr': '04', 'may': '05', 'june': '06', 'jun': '06', 'july': '07', 'jul': '07',
                            'august': '08', 'aug': '08', 'september': '09', 'sep': '09', 'october': '10', 'oct': '10',
                            'november': '11', 'nov': '11', 'december': '12', 'dec': '12'
                        })) {
                            if (transcript.includes(month)) {
                                date = await this.parseDate(transcript);
                                break;
                            }
                        }
                        
                        if (!date) {
                            date = new Date().toISOString().split('T')[0]; // Default to today
                        }
                    }
                    
                    const tasks = await this.getTasksByDate(date);
                    let response;
                    
                    if (tasks.length === 0) {
                        const dateObj = new Date(date);
                        const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                        response = `You have no tasks scheduled for ${formattedDate}.`;
                    } else {
                        const dateObj = new Date(date);
                        const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                        const taskList = tasks.map(t => `${t.text} at ${t.time}`).join('\n');
                        response = `You have ${tasks.length} task${tasks.length !== 1 ? 's' : ''} for ${formattedDate}:\n${taskList}`;
                    }
                    
                    this.speak(response);
                    this.addMessageToChat('assistant', response);
                } else if (transcript.includes('completed tasks')) {
                    // Implement showing completed tasks
                    const response = 'This feature is coming soon!';
                    this.speak(response);
                    this.addMessageToChat('assistant', response);
                } else if (transcript.includes('help')) {
                    const response = 'I can help you manage your tasks. You can say:\n- Add a task\n- Delete a task\n- What are my tasks for today\n- What are my tasks for [date]\n- Show my completed tasks';
                    this.speak(response);
                    this.addMessageToChat('assistant', response);
                }
                break;

            case 'awaiting_date':
                // Parse the date from the transcript
                this.pendingTask.date = await this.parseDate(transcript);
                const dateObj = new Date(this.pendingTask.date);
                const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                
                const response = `I'll schedule it for ${formattedDate}. What is the task?`;
                this.speak(response);
                this.addMessageToChat('assistant', response);
                this.conversationState = 'awaiting_task';
                break;

            case 'awaiting_task':
                this.pendingTask.text = transcript;
                const taskResponse = `At what time should I schedule "${transcript}"?`;
                this.speak(taskResponse);
                this.addMessageToChat('assistant', taskResponse);
                this.conversationState = 'awaiting_time';
                break;

            case 'awaiting_time':
                this.pendingTask.time = this.parseTime(transcript);
                this.pendingTask.id = Date.now();
                this.pendingTask.completed = false;
                
                await this.addTaskToDB(this.pendingTask);
                
                const timeObj = new Date(`2000-01-01T${this.pendingTask.time}`);
                const formattedTime = timeObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
                const confirmResponse = `Task added: "${this.pendingTask.text}" on ${new Date(this.pendingTask.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at ${formattedTime}.`;
                
                this.speak(confirmResponse);
                this.addMessageToChat('assistant', confirmResponse);
                this.conversationState = 'idle';
                this.pendingTask = {};
                break;

            case 'awaiting_delete_date':
                const deleteDate = await this.parseDate(transcript);
                const tasksToDelete = await this.getTasksByDate(deleteDate);
                
                if (tasksToDelete.length === 0) {
                    const noTasksResponse = `You have no tasks scheduled for ${new Date(deleteDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`;
                    this.speak(noTasksResponse);
                    this.addMessageToChat('assistant', noTasksResponse);
                    this.conversationState = 'idle';
                } else {
                    const taskList = tasksToDelete.map((t, i) => `${i + 1}. ${t.text}`).join('\n');
                    const response = `Here are your tasks for ${new Date(deleteDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}:\n${taskList}\nWhich one would you like to delete? You can say the number or the task name.`;
                    this.speak(response);
                    this.addMessageToChat('assistant', response);
                    this.pendingTask.tasksToDelete = tasksToDelete;
                    this.conversationState = 'awaiting_delete_confirmation';
                }
                break;

            case 'awaiting_delete_confirmation':
                // Try to find the task to delete by number or name
                let taskToDelete = null;
                const tasks = this.pendingTask.tasksToDelete || [];
                
                // Check if user mentioned a number
                const numberMatch = transcript.match(/\b(\d+)\b/);
                if (numberMatch) {
                    const taskIndex = parseInt(numberMatch[1]) - 1;
                    if (taskIndex >= 0 && taskIndex < tasks.length) {
                        taskToDelete = tasks[taskIndex];
                    }
                } else {
                    // Try to find by task text similarity
                    for (const task of tasks) {
                        if (transcript.includes(task.text.toLowerCase())) {
                            taskToDelete = task;
                            break;
                        }
                    }
                }
                
                if (taskToDelete) {
                    await this.deleteTask(taskToDelete.id);
                    const response = `I've deleted the task "${taskToDelete.text}".`;
                    this.speak(response);
                    this.addMessageToChat('assistant', response);
                } else {
                    const response = "I'm sorry, I couldn't identify which task you want to delete. Please try again.";
                    this.speak(response);
                    this.addMessageToChat('assistant', response);
                }
                
                this.conversationState = 'idle';
                this.pendingTask = {};
                break;
    }
    }

    handleSpeechError(event) {
        console.error('Speech recognition error:', event.error);
        this.isListening = false;
        
        // Add error message to chat
        this.addMessageToChat('system', `Speech recognition error: ${event.error}`);
    }
    
    // Chat interface methods
    addMessageToChat(sender, text) {
        const message = {
            id: Date.now(),
            sender,
            text,
            timestamp: new Date().toISOString()
        };
        
        this.chatHistory.push(message);
        
        // Limit chat history to last 50 messages
        if (this.chatHistory.length > 50) {
            this.chatHistory = this.chatHistory.slice(-50);
        }
        
        // Dispatch event for UI to update
        const event = new CustomEvent('chat-message', { detail: message });
        document.dispatchEvent(event);
        
        return message;
    }
    
    getChatHistory() {
        return this.chatHistory;
    }
    
    clearChatHistory() {
        this.chatHistory = [];
        // Dispatch event for UI to update
        document.dispatchEvent(new CustomEvent('chat-history-cleared'));
    }
}

// Export the VoiceAssistant class
export default VoiceAssistant;