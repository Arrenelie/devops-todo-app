const { createApp } = Vue;

const API_BASE_URL = '/api';  // Теперь через nginx proxy

createApp({
    data() {
        return {
            tasks: [],
            newTask: {
                title: '',
                description: ''
            },
            loading: false,
            actionLoading: false,
            filter: null,
            healthStatus: {},
            lastUpdate: 'никогда'
        };
    },
    computed: {
        filteredTasks() {
            if (this.filter === null) return this.tasks;
            return this.tasks.filter(task => task.completed === this.filter);
        },
        activeTasks() {
            return this.tasks.filter(task => !task.completed);
        },
        completedTasks() {
            return this.tasks.filter(task => task.completed);
        },
        totalTasks() {
            return this.tasks.length;
        }
    },
    mounted() {
        this.loadTasks();
        this.checkHealth();
        
        // Обновляем статус каждые 30 секунд
        setInterval(this.checkHealth, 30000);
        // Обновляем задачи каждую минуту
        setInterval(this.loadTasks, 60000);
    },
    methods: {
        async loadTasks() {
            this.loading = true;
            try {
                const response = await fetch(`${API_BASE_URL}/tasks/`);
                if (!response.ok) throw new Error('Network response was not ok');
                
                this.tasks = await response.json();
                // Сортируем по дате создания (новые сверху)
                this.tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                this.updateLastUpdate();
            } catch (error) {
                console.error('Ошибка загрузки задач:', error);
                this.showAlert('Ошибка загрузки задач', 'danger');
            } finally {
                this.loading = false;
            }
        },
        
        async addTask() {
            if (!this.newTask.title.trim()) {
                this.showAlert('Введите название задачи', 'warning');
                return;
            }
            
            this.actionLoading = true;
            try {
                const response = await fetch(`${API_BASE_URL}/tasks/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        title: this.newTask.title.trim(),
                        description: this.newTask.description?.trim() || null
                    })
                });
                
                if (!response.ok) throw new Error('Network response was not ok');
                
                const task = await response.json();
                this.tasks.unshift(task); // Добавляем в начало
                this.newTask.title = '';
                this.newTask.description = '';
                this.updateLastUpdate();
                this.showAlert('Задача добавлена!', 'success');
            } catch (error) {
                console.error('Ошибка создания задачи:', error);
                this.showAlert('Ошибка создания задачи', 'danger');
            } finally {
                this.actionLoading = false;
            }
        },
        
        async completeTask(taskId) {
            this.actionLoading = true;
            try {
                const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/complete`, {
                    method: 'PUT'
                });
                
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error('Задача не найдена');
                    }
                    throw new Error('Network response was not ok');
                }
                
                const updatedTask = await response.json();
                const index = this.tasks.findIndex(task => task.id === taskId);
                if (index !== -1) {
                    this.tasks.splice(index, 1, updatedTask);
                }
                this.updateLastUpdate();
                this.showAlert('Задача выполнена!', 'success');
            } catch (error) {
                console.error('Ошибка обновления задачи:', error);
                this.showAlert(error.message, 'danger');
            } finally {
                this.actionLoading = false;
            }
        },
        
        async deleteTask(taskId) {
            if (!confirm('Вы уверены, что хотите удалить эту задачу?')) return;
            
            this.actionLoading = true;
            try {
                const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error('Задача не найдена');
                    }
                    throw new Error('Network response was not ok');
                }
                
                this.tasks = this.tasks.filter(task => task.id !== taskId);
                this.updateLastUpdate();
                this.showAlert('Задача удалена!', 'success');
            } catch (error) {
                console.error('Ошибка удаления задачи:', error);
                this.showAlert(error.message, 'danger');
            } finally {
                this.actionLoading = false;
            }
        },
        
        async checkHealth() {
            try {
                const response = await fetch(`${API_BASE_URL}/health`);
                if (!response.ok) throw new Error('Network response was not ok');
                
                this.healthStatus = await response.json();
            } catch (error) {
                console.error('Ошибка проверки здоровья:', error);
                this.healthStatus = { status: 'unhealthy', timestamp: new Date() };
            }
        },
        
        formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        },
        
        updateLastUpdate() {
            this.lastUpdate = new Date().toLocaleTimeString('ru-RU');
        },
        
        showAlert(message, type = 'info') {
            // Создаем временное уведомление
            const alert = document.createElement('div');
            alert.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
            alert.style.cssText = 'top: 20px; right: 20px; z-index: 1050; min-width: 300px;';
            alert.innerHTML = `
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            
            document.body.appendChild(alert);
            
            // Автоматически удаляем через 3 секунды
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.parentNode.removeChild(alert);
                }
            }, 3000);
        }
    }
}).mount('#app');