import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, CheckCheck, FileText, CheckSquare, ListTodo, ChevronDown, Clock, X, Trash2, Check } from 'lucide-react';
import { NotificationItem } from '../types';
import { markAsRead, markAllAsRead, deleteNotification } from '../lib/notificationService';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NotificationBellProps {
  notifications: NotificationItem[];
  onSelectNotification?: (item: NotificationItem) => void;
}

export default function NotificationBell({
  notifications,
  onSelectNotification,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [notifToDelete, setNotifToDelete] = useState<NotificationItem | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.lida).length;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Sort by date descending
  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  );

  const displayedNotifications = showAll
    ? sortedNotifications
    : sortedNotifications.slice(0, 10);

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.lida) {
      await markAsRead(item.id);
    }
    if (onSelectNotification) {
      onSelectNotification(item);
    }
    setIsOpen(false);
  };

  const handleToggleRead = async (e: React.MouseEvent, item: NotificationItem) => {
    e.stopPropagation();
    if (!item.lida) {
      await markAsRead(item.id);
    }
  };

  const handleDeleteRequest = (e: React.MouseEvent, item: NotificationItem) => {
    e.stopPropagation();
    setNotifToDelete(item);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead(notifications);
  };

  const formatTime = (isoString: string) => {
    try {
      const date = parseISO(isoString);
      const distance = formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
      return distance;
    } catch (e) {
      return format(new Date(), 'dd/MM/yyyy HH:mm');
    }
  };

  const getTypeIcon = (tipo: NotificationItem['tipo']) => {
    switch (tipo) {
      case 'card':
        return <FileText size={16} className="text-indigo-500" />;
      case 'acao':
        return <CheckSquare size={16} className="text-emerald-500" />;
      case 'tarefa':
        return <ListTodo size={16} className="text-amber-500" />;
      default:
        return <Bell size={16} className="text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 bg-theme-card border border-theme-border rounded-2xl shadow-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-95 group relative flex items-center justify-center"
        title="Notificações"
        aria-label="Notificações"
      >
        <Bell size={20} className="group-hover:rotate-12 transition-transform" />
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-md animate-pulse border-2 border-white dark:border-slate-800">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[100] overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">
                  Notificações
                </h3>
                {unreadCount > 0 && (
                  <span className="bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {unreadCount} não lida{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 transition-all"
                    title="Marcar todas como lidas"
                  >
                    <CheckCheck size={14} />
                    <span className="hidden sm:inline">Limpar todas</span>
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
              {sortedNotifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700/50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Bell size={22} className="text-slate-400 dark:text-slate-500 opacity-60" />
                  </div>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Nenhuma notificação por enquanto
                  </p>
                  <p className="text-[11px] mt-1 text-slate-400 dark:text-slate-500">
                    Você será avisado aqui sobre tarefas, cards e ações atribuídas a você.
                  </p>
                </div>
              ) : (
                displayedNotifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`w-full p-3.5 text-left transition-all flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/40 relative group cursor-pointer ${
                      !item.lida
                        ? 'bg-indigo-50/40 dark:bg-indigo-950/20'
                        : 'bg-white dark:bg-slate-800'
                    }`}
                  >
                    {/* Unread dot indicator */}
                    <div className="pt-1 shrink-0 flex items-center justify-center">
                      {!item.lida ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm" title="Não lida" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 opacity-50" title="Lida" />
                      )}
                    </div>

                    {/* Icon */}
                    <div className="p-2 bg-slate-100 dark:bg-slate-700/80 rounded-xl shrink-0">
                      {getTypeIcon(item.tipo)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-12">
                      <p className={`text-xs leading-relaxed ${
                        !item.lida
                          ? 'font-bold text-slate-800 dark:text-slate-100'
                          : 'font-medium text-slate-600 dark:text-slate-300'
                      }`}>
                        {item.mensagem}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                        <Clock size={11} />
                        <span>{formatTime(item.data)}</span>
                      </div>
                    </div>

                    {/* Actions: Mark read & Delete */}
                    <div className="absolute right-2 top-3 flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      {!item.lida && (
                        <button
                          type="button"
                          onClick={(e) => handleToggleRead(e, item)}
                          title="Marcar como lida"
                          className="p-1.5 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 bg-white dark:bg-slate-700 rounded-lg shadow-sm hover:scale-105 transition-all"
                        >
                          <Check size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteRequest(e, item)}
                        title="Excluir notificação"
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-white dark:bg-slate-700 rounded-lg shadow-sm hover:scale-105 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer / Ver todas */}
            {sortedNotifications.length > 10 && (
              <div className="p-2.5 text-center border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>{showAll ? 'Mostrar menos' : `Ver todas (${sortedNotifications.length})`}</span>
                  <ChevronDown size={14} className={`transition-transform ${showAll ? 'rotate-180' : ''}`} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {notifToDelete && (
          <div 
            className="fixed inset-0 z-[999] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 cursor-default"
            onClick={(e) => {
              e.stopPropagation();
              setNotifToDelete(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-slate-700 max-w-sm w-full space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 rounded-xl">
                  <Trash2 size={20} />
                </div>
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                  Excluir notificação
                </h4>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                Deseja realmente excluir esta notificação?
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNotifToDelete(null)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (notifToDelete) {
                      await deleteNotification(notifToDelete.id);
                      setNotifToDelete(null);
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 rounded-xl shadow-md transition-all active:scale-95"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

