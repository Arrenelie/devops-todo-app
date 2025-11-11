from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="Task Manager API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Task(BaseModel):
    id: Optional[int] = None
    title: str
    description: Optional[str] = None
    completed: bool = False
    created_at: Optional[str] = None


def init_db():
    # ИСПРАВЛЯЕМ ПУТЬ - используем абсолютный путь в контейнере
    db_path = '/app/tasks.db'
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            completed BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()
    print(f"✅ Database initialized at {db_path}")


@app.on_event("startup")
def startup():
    init_db()


@app.get("/")
async def root():
    return {"message": "Task Manager API", "version": "1.0"}


@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.post("/tasks/", response_model=Task)
async def create_task(task: Task):
    conn = sqlite3.connect('/app/tasks.db')  # ИСПРАВЛЯЕМ ПУТЬ
    c = conn.cursor()
    c.execute(
        'INSERT INTO tasks (title, description) VALUES (?, ?)',
        (task.title, task.description)
    )
    task_id = c.lastrowid
    conn.commit()

    c.execute('SELECT * FROM tasks WHERE id = ?', (task_id,))
    result = c.fetchone()
    conn.close()

    return Task(
        id=result[0],
        title=result[1],
        description=result[2],
        completed=bool(result[3]),
        created_at=result[4]
    )


@app.get("/tasks/", response_model=List[Task])
async def get_tasks():
    conn = sqlite3.connect('/app/tasks.db')  # ИСПРАВЛЯЕМ ПУТЬ
    c = conn.cursor()
    c.execute('SELECT * FROM tasks ORDER BY id DESC')
    results = c.fetchall()
    conn.close()

    tasks = []
    for result in results:
        tasks.append(Task(
            id=result[0],
            title=result[1],
            description=result[2],
            completed=bool(result[3]),
            created_at=result[4]
        ))
    return tasks


@app.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: int):
    conn = sqlite3.connect('/app/tasks.db')  # ИСПРАВЛЯЕМ ПУТЬ
    c = conn.cursor()
    c.execute('SELECT * FROM tasks WHERE id = ?', (task_id,))
    result = c.fetchone()
    conn.close()

    if result:
        return Task(
            id=result[0],
            title=result[1],
            description=result[2],
            completed=bool(result[3]),
            created_at=result[4]
        )
    raise HTTPException(status_code=404, detail="Task not found")


@app.put("/tasks/{task_id}/complete", response_model=Task)
async def complete_task(task_id: int):
    conn = sqlite3.connect('/app/tasks.db')  # ИСПРАВЛЯЕМ ПУТЬ
    c = conn.cursor()

    c.execute('SELECT * FROM tasks WHERE id = ?', (task_id,))
    result = c.fetchone()

    if not result:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")

    c.execute('UPDATE tasks SET completed = TRUE WHERE id = ?', (task_id,))
    conn.commit()

    c.execute('SELECT * FROM tasks WHERE id = ?', (task_id,))
    result = c.fetchone()
    conn.close()

    return Task(
        id=result[0],
        title=result[1],
        description=result[2],
        completed=bool(result[3]),
        created_at=result[4]
    )


@app.delete("/tasks/{task_id}")
async def delete_task(task_id: int):
    conn = sqlite3.connect('/app/tasks.db')  # ИСПРАВЛЯЕМ ПУТЬ
    c = conn.cursor()

    c.execute('SELECT * FROM tasks WHERE id = ?', (task_id,))
    result = c.fetchone()

    if not result:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")

    c.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
    conn.commit()
    conn.close()

    return {"message": f"Task {task_id} deleted successfully"}


if __name__ == "__main__":
    import uvicorn

    print("🚀 Starting server...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")