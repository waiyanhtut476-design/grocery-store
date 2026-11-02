import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Plus, CheckCircle2, Circle, Trash2, Calendar, User as UserIcon } from 'lucide-react';
import { Task } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { useLanguage } from '../lib/i18n';

interface TasksProps {
  user: User;
}

export function Tasks({ user }: TasksProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Task[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Task));
      setTasks(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    return () => unsubscribe();
  }, []);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    const id = doc(collection(db, 'tasks')).id;
    try {
      await setDoc(doc(db, 'tasks', id), {
        title: newTask,
        status: 'todo',
        assignedTo: user.uid,
        createdAt: serverTimestamp()
      });
      setNewTask('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks/' + id);
    }
  };

  const toggleTask = async (task: Task) => {
    const newStatus = task.status === 'todo' ? 'done' : 'todo';
    try {
      await setDoc(doc(db, 'tasks', task.id), {
        ...task,
        status: newStatus,
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tasks/' + task.id);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'tasks/' + id);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{t('tasks')}</h2>
        <p className="text-slate-500">{t('manage_tasks') || 'Track daily store operations and duties.'}</p>
      </div>

      <form onSubmit={addTask} className="relative">
        <input
          type="text"
          placeholder={t('add_task_placeholder')}
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          className="w-full pl-6 pr-16 py-4 bg-white border border-slate-200 rounded-2xl text-lg shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
        >
          <Plus className="w-6 h-6" />
        </button>
      </form>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {tasks.map((task) => (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`p-4 bg-white rounded-2xl border transition-all flex items-center gap-4 group ${
                task.status === 'done' ? 'border-slate-100 bg-slate-50/50' : 'border-slate-200 shadow-sm'
              }`}
            >
              <button
                onClick={() => toggleTask(task)}
                className={`transition-colors ${task.status === 'done' ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'}`}
              >
                {task.status === 'done' ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
              </button>
              
              <div className="flex-1">
                <p className={`font-medium transition-all ${task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                  {task.title}
                </p>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {task.createdAt?.toDate().toLocaleDateString()}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <UserIcon className="w-3 h-3" />
                    {task.assignedTo === user.uid ? 'Me' : 'Staff'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => deleteTask(task.id)}
                className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {tasks.length === 0 && !loading && (
          <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <CheckCircle2 className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">{t('tasks_completed')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
