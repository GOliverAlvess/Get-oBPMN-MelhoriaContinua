import { doc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from '../firebase';
import { db } from '../firebase';
import { NotificationItem, Project, OperationalAction, Subtask } from '../types';
import { logFeature } from './changelogService';
import { calculateActionAlert } from '../utils/calculations';

export async function createNotification(params: {
  usuario_id: string;
  tipo: 'card' | 'acao' | 'tarefa';
  mensagem: string;
  referencia_id: string;
  autor_id?: string;
  subtask_id?: string;
}) {
  const { usuario_id, tipo, mensagem, referencia_id, autor_id, subtask_id } = params;

  if (!usuario_id) return;

  // Anti-spam rule: Do not notify user of actions they executed for themselves
  if (autor_id && autor_id === usuario_id) return;

  try {
    const notifId = 'notif_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    const notification: NotificationItem = {
      id: notifId,
      usuario_id,
      tipo,
      mensagem,
      referencia_id,
      lida: false,
      data: new Date().toISOString(),
      autor_id,
      subtask_id,
    };

    // Save to Firestore 'notifications' collection
    await setDoc(doc(db, 'notifications', notifId), notification);

    // Auto-record to changelog_events
    logFeature(`Notificação enviada: "${mensagem.substring(0, 50)}${mensagem.length > 50 ? '...' : ''}"`, 'Notificações', '🔔');
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
  }
}

export async function markAsRead(notificationId: string) {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { lida: true });
  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error);
  }
}

export async function deleteNotification(notificationId: string) {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    console.error('Erro ao excluir notificação:', error);
    throw error;
  }
}

export async function clearAllNotifications(
  notifications: NotificationItem[],
  currentUserId?: string,
  currentUserEmail?: string
) {
  const todayStr = new Date().toISOString().substring(0, 10);
  // Mark daily deadline check in localStorage so clearing notifications doesn't trigger immediate resurrection
  try {
    if (currentUserId) {
      localStorage.setItem(`daily_deadline_alert_${todayStr}_${currentUserId}`, 'true');
    }
    if (currentUserEmail) {
      localStorage.setItem(`daily_deadline_alert_${todayStr}_${currentUserEmail.toLowerCase()}`, 'true');
    }
  } catch (e) {}

  const notificationIds = notifications.map((n) => n.id);

  try {
    const authHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (currentUserEmail) {
      authHeaders['x-user-email'] = currentUserEmail;
    }
    if (currentUserId) {
      authHeaders['x-user-uid'] = currentUserId;
    }

    const response = await fetch('/api/notifications/clear-all', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ notificationIds }),
    });

    if (!response.ok) {
      // Fallback via deleteDoc individual
      const userNotifs = notifications.filter(n => {
        if (currentUserId && n.usuario_id === currentUserId) return true;
        if (currentUserEmail && n.usuario_id?.toLowerCase() === currentUserEmail.toLowerCase()) return true;
        return true; // if user matches current list
      });

      await Promise.all(userNotifs.map(notif => deleteDoc(doc(db, 'notifications', notif.id))));
    }
  } catch (error) {
    console.error('Erro ao limpar todas as notificações:', error);
    // Fallback via deleteDoc individual
    const userNotifs = notifications.filter(n => {
      if (currentUserId && n.usuario_id === currentUserId) return true;
      if (currentUserEmail && n.usuario_id?.toLowerCase() === currentUserEmail.toLowerCase()) return true;
      return true;
    });

    await Promise.all(userNotifs.map(notif => deleteDoc(doc(db, 'notifications', notif.id))));
  }
}

export async function markAllAsRead(notifications: NotificationItem[]) {
  try {
    const unread = notifications.filter((n) => !n.lida);
    if (unread.length === 0) return;
    await Promise.all(unread.map(notif => updateDoc(doc(db, 'notifications', notif.id), { lida: true })));
  } catch (error) {
    console.error('Erro ao marcar todas como lidas:', error);
    throw error;
  }
}

// Helpers for event-triggered notifications - STRICTLY ONLY ON CREATION / NEW ASSIGNMENT

export function notifyProjectChanges(
  oldProject: Project | null,
  newProject: Project,
  actorUserId?: string
) {
  const targetUserId = newProject.assignedTo;
  if (!targetUserId || targetUserId === 'backlog') return;

  // Anti-spam rule: Do not notify user of actions executed for themselves
  if (actorUserId && actorUserId === targetUserId) return;

  // Trigger ONLY on new card creation or reassignment to a new user
  if (!oldProject || oldProject.assignedTo !== targetUserId) {
    createNotification({
      usuario_id: targetUserId,
      tipo: 'card',
      mensagem: `Novo card atribuído a você: "${newProject.name}"`,
      referencia_id: newProject.id,
      autor_id: actorUserId,
    });
  }
}

export function notifyActionChanges(
  oldAction: OperationalAction | null,
  newAction: OperationalAction,
  actorUserId?: string
) {
  const targetUserId = newAction.responsibleId;
  if (!targetUserId) return;

  // Anti-spam rule: Do not notify user of actions executed for themselves
  if (actorUserId && actorUserId === targetUserId) return;

  // Trigger ONLY on new action creation or reassignment to a new user
  if (!oldAction || oldAction.responsibleId !== targetUserId) {
    createNotification({
      usuario_id: targetUserId,
      tipo: 'acao',
      mensagem: `Nova ação atribuída a você: "${newAction.action}" (${newAction.projectName || 'Projeto'})`,
      referencia_id: newAction.id,
      autor_id: actorUserId,
    });
  }
}

export function notifySubtaskChanges(
  projectId: string,
  projectName: string,
  oldSubtask: Subtask | null,
  newSubtask: Subtask,
  actorUserId?: string
) {
  const targetUserId = newSubtask.responsibleId;
  if (!targetUserId) return;

  // Anti-spam rule: Do not notify user of actions executed for themselves
  if (actorUserId && actorUserId === targetUserId) return;

  // Trigger ONLY on new subtask creation or reassignment
  if (!oldSubtask || oldSubtask.responsibleId !== targetUserId) {
    createNotification({
      usuario_id: targetUserId,
      tipo: 'tarefa',
      mensagem: `Nova atividade atribuída a você: "${newSubtask.title}" em ${projectName}`,
      referencia_id: projectId,
      subtask_id: newSubtask.id,
      autor_id: actorUserId,
    });
  }
}

export async function checkAndNotifyActionDeadlines(
  userId: string,
  userEmail: string | null | undefined,
  userName: string | null | undefined,
  actions: OperationalAction[],
  existingNotifications: NotificationItem[]
) {
  if (!userId && !userEmail) return;

  const todayStr = new Date().toISOString().substring(0, 10);
  const userKey = userId || userEmail || 'user';

  // Check localStorage if this user was already processed for daily deadline alert today
  try {
    if (
      (userId && localStorage.getItem(`daily_deadline_alert_${todayStr}_${userId}`) === 'true') ||
      (userEmail && localStorage.getItem(`daily_deadline_alert_${todayStr}_${userEmail.toLowerCase()}`) === 'true')
    ) {
      return;
    }
  } catch (e) {}

  // Anti-spam / Daily Rule: Regra de 1 notificação por dia
  const alreadyNotifiedToday = existingNotifications.some((n) => {
    const notifDateStr = n.data ? n.data.substring(0, 10) : '';
    return (
      notifDateStr === todayStr &&
      (n.subtask_id === 'daily_deadline_alert' || n.mensagem.includes('vencer o prazo'))
    );
  });

  if (alreadyNotifiedToday) {
    try {
      if (userId) localStorage.setItem(`daily_deadline_alert_${todayStr}_${userId}`, 'true');
      if (userEmail) localStorage.setItem(`daily_deadline_alert_${todayStr}_${userEmail.toLowerCase()}`, 'true');
    } catch (e) {}
    return;
  }

  // Filtrar ações não concluídas atribuídas ao usuário logado que estão próximas de vencer ou atrasadas
  const userPendingActions = actions.filter((action) => {
    if (action.status === 'Concluído') return false;

    const isAssigned =
      (action.responsibleId && (
        action.responsibleId === userId ||
        (userEmail && action.responsibleId.toLowerCase() === userEmail.toLowerCase())
      )) ||
      (action.responsibleName && userName && action.responsibleName.trim().toLowerCase() === userName.trim().toLowerCase());

    if (!isAssigned) return false;
    if (!action.forecastDate) return false;

    const alertStatus = calculateActionAlert(action);
    return alertStatus === 'Próximo do vencimento' || alertStatus === 'Atrasado';
  });

  if (userPendingActions.length === 0) return;

  const count = userPendingActions.length;
  const firstAction = userPendingActions[0];
  const mensagem = count === 1
    ? `Atenção: Você possui 1 ação no histórico de ações próxima de vencer o prazo ("${firstAction.action}").`
    : `Atenção: Você possui ${count} ações no histórico de ações próximas de vencer o prazo.`;

  // Mark in localStorage before creating to prevent race condition
  try {
    if (userId) localStorage.setItem(`daily_deadline_alert_${todayStr}_${userId}`, 'true');
    if (userEmail) localStorage.setItem(`daily_deadline_alert_${todayStr}_${userEmail.toLowerCase()}`, 'true');
  } catch (e) {}

  await createNotification({
    usuario_id: userId,
    tipo: 'acao',
    mensagem,
    referencia_id: 'all_deadline_actions',
    subtask_id: 'daily_deadline_alert',
  });
}


